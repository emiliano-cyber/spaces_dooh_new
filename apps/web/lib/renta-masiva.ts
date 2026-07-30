// ============================================================================
//  lib/renta-masiva.ts — Reparto de un cambio MASIVO de renta sobre contratos.
//
//  El cambio se pide sobre PANTALLAS (es lo que el usuario selecciona en la
//  tabla) pero se aplica sobre CONTRATOS, y los dos conjuntos no coinciden: un
//  contrato de predio lo comparten todas las caras de ese predio. De ahí salen
//  las dos trampas que este módulo existe para resolver:
//
//   1. DUPLICADOS. Seleccionar 5 pantallas de un mismo predio son 5 pantallas
//      pero UN contrato. Sin deduplicar se mandarían 5 PATCH al mismo destino y
//      el resumen diría «5 rentas actualizadas» donde hubo una sola. Peor con
//      el modo porcentaje: cada PATCH aplicaría el % sobre el resultado del
//      anterior si el servidor releyera, y el importe se dispararía.
//
//   2. ALCANCE MAYOR QUE LA SELECCIÓN. Si se seleccionan 2 de las 5 caras de un
//      predio, el cambio alcanza igual a las otras 3: el contrato es uno. Eso NO
//      se puede evitar, pero sí contarse y avisarse antes de guardar. La
//      diferencia entre un efecto colateral y una sorpresa es exactamente esa.
//
//  Puro, sin React ni red: es aritmética de dinero y merece pruebas propias.
// ============================================================================

export interface SitioRenta {
  id: string
  predioId?: string | null
}

// El contrato que gobierna una pantalla, con su renta actual.
export interface ContratoRenta {
  contratoId: string
  renta: number
  dePredio: boolean
}

export interface CambioRenta {
  contratoId: string
  montoRenta: number
}

export interface PlanRentaMasiva {
  // Un elemento por contrato DISTINTO. Es lo que se manda a la API.
  cambios: CambioRenta[]
  // Pantallas seleccionadas que no tienen contrato: se omiten.
  sinContrato: number
  // Pantallas NO seleccionadas que quedan alcanzadas por compartir contrato con
  // alguna que sí lo estaba. Es el número que hay que enseñar antes de aplicar.
  alcanceExtra: number
  // Contratos descartados por quedar en un importe no utilizable (≤ 0). Pasa al
  // ajustar por % una renta que todavía no se ha capturado: 0 × 1.1 = 0.
  omitidosSinImporte: number
}

/**
 * Calcula qué contratos hay que tocar y a cuánto.
 *
 * @param seleccionadas pantallas marcadas por el usuario
 * @param todas         inventario completo, para medir el alcance real
 * @param contratoDe    resuelve el contrato que gobierna una pantalla
 * @param modo          'fijar' pone el mismo importe; 'ajustar' aplica un %
 * @param valor         importe (fijar) o porcentaje (ajustar, admite negativo)
 */
export function planearRentaMasiva(
  seleccionadas: SitioRenta[],
  todas: SitioRenta[],
  contratoDe: (s: SitioRenta) => ContratoRenta | null,
  modo: 'fijar' | 'ajustar',
  valor: number,
): PlanRentaMasiva {
  const porContrato = new Map<string, number>()
  let sinContrato = 0

  for (const s of seleccionadas) {
    const c = contratoDe(s)
    if (!c) { sinContrato++; continue }
    // El Map deduplica: la segunda cara del mismo predio no vuelve a calcular
    // nada. Esto es lo que impide aplicar el % dos veces sobre el mismo importe.
    if (porContrato.has(c.contratoId)) continue
    const nuevo = modo === 'fijar' ? valor : Math.round(c.renta * (1 + valor / 100))
    porContrato.set(c.contratoId, nuevo)
  }

  // Un importe ≤ 0 no se manda: lo rechaza `contrato_monto_ck` y se leería como
  // «el espacio es gratis».
  let omitidosSinImporte = 0
  for (const [id, monto] of [...porContrato]) {
    if (!Number.isFinite(monto) || monto <= 0) {
      porContrato.delete(id)
      omitidosSinImporte++
    }
  }

  // Alcance real: cuántas pantallas del inventario cuelgan de los contratos que
  // se van a tocar, menos las que el usuario ya sabe que seleccionó.
  const idsSeleccionadas = new Set(seleccionadas.map((s) => s.id))
  let alcanceExtra = 0
  for (const s of todas) {
    if (idsSeleccionadas.has(s.id)) continue
    const c = contratoDe(s)
    if (c && porContrato.has(c.contratoId)) alcanceExtra++
  }

  return {
    cambios: [...porContrato].map(([contratoId, montoRenta]) => ({ contratoId, montoRenta })),
    sinContrato,
    alcanceExtra,
    omitidosSinImporte,
  }
}
