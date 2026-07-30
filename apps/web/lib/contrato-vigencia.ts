// ============================================================================
//  lib/contrato-vigencia.ts — Desde cuándo puede empezar un contrato NUEVO
//  sobre un espacio que ya tuvo otro.
//
//  Un predio (o una pantalla suelta) es UN espacio: no puede estar arrendado dos
//  veces a la vez. Cuando se firma un contrato nuevo sobre un espacio con
//  historial, su vigencia tiene que empezar DESPUÉS de donde terminó el anterior.
//  Sin esa regla se puede capturar un contrato que solapa al previo, y entonces:
//
//   · `contratoVigentePorSitio` (derive.ts) tiene dos candidatos activos para el
//     mismo espacio y elige uno — el P&L reporta una renta y esconde la otra.
//   · el calendario de pagos genera cuotas de los dos para los días solapados:
//     se le paga dos veces al propietario por el mismo periodo.
//
//  El día siguiente, no el mismo: `fecha_fin` es INCLUSIVA en todo el módulo.
//  `estatusPorFechas` solo marca VENCIDO cuando quedan menos de 0 días, y el
//  generador del calendario itera `while (cursor <= fin)`. Un contrato que
//  empieza el mismo día en que termina el anterior solapa ese día.
// ============================================================================

export interface ContratoPrevio {
  estatus: string
  fechaFin?: string | null
  predioId?: string | null
  sitioId?: string | null
}

// Un CANCELADO no reserva el calendario: hubo acuerdo y se rompió, así que el
// espacio queda libre desde ya y obligar a esperar a su fecha de fin nominal
// impediría re-arrendarlo. Un INCOMPLETO no tiene `fecha_fin` que respetar.
const NO_RESERVAN = new Set(['CANCELADO'])

// Suma días a un 'YYYY-MM-DD' sin pasar por la zona horaria local: `new Date()`
// sobre una fecha suelta la interpreta como UTC y en México (UTC−6) se corre al
// día anterior. Se opera en UTC y se recorta a 10 caracteres.
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export interface InicioMinimo {
  // Primer día admisible para el contrato nuevo (YYYY-MM-DD).
  desde: string
  // Fin del contrato anterior, para poder explicarlo en el mensaje.
  ultimoFin: string
}

/**
 * Calcula desde cuándo puede empezar un contrato nuevo sobre un espacio.
 *
 * El ancla es el PREDIO si lo hay, y la pantalla solo si no lo hay: es la misma
 * regla de cobertura que usa el resto del módulo (un predio tiene un contrato
 * que comparten todas sus caras; una pantalla suelta tiene el suyo).
 *
 * Devuelve null si no hay historial que respetar — espacio nuevo, o cuyos
 * contratos previos están cancelados o incompletos.
 */
export function inicioMinimoContrato(
  contratos: ContratoPrevio[],
  ancla: { predioId?: string | null; sitioId?: string | null },
): InicioMinimo | null {
  const { predioId, sitioId } = ancla
  if (!predioId && !sitioId) return null

  let ultimoFin: string | null = null
  for (const c of contratos) {
    if (NO_RESERVAN.has(c.estatus)) continue
    if (!c.fechaFin) continue // INCOMPLETO: no hay vigencia que respetar
    const suyo = predioId ? c.predioId === predioId : !c.predioId && c.sitioId === sitioId
    if (!suyo) continue
    const fin = c.fechaFin.slice(0, 10)
    if (!ultimoFin || fin > ultimoFin) ultimoFin = fin
  }
  if (!ultimoFin) return null
  return { desde: sumarDias(ultimoFin, 1), ultimoFin }
}
