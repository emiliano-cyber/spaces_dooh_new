// ============================================================================
//  lib/franja-programada.ts — la franja en la que SE TRANSMITE una campaña, y
//  la regla que la contrasta con la que SE VENDIÓ.   PROG-01.
// ----------------------------------------------------------------------------
//  DECISIÓN DEL DUEÑO (2026-09-30), textual: «es para horario transmisión ya
//  que el precio ya debe de estar en la campaña después de la propuesta».
//
//  Hay DOS franjas en la vida de una campaña y no son la misma cosa:
//
//   · la CONTRATADA — `reservas.franja_id`, heredada del ítem de la propuesta y
//     congelada con su precio en `propuestas.snapshot_economico`. Es lo que el
//     cliente aceptó y NO se toca desde aquí (`campanas-repo.ts`, donde se
//     prohíbe elegirla en la campaña).
//   · la PROGRAMADA — `campanas.franja_programada_id`. Es una instrucción de
//     operación: en qué horario tiene que salir. No mueve un peso.
//
//  Que difieran es posible y HOY SOLO SE AVISA. «Avisar o bloquear» es una
//  DECISIÓN PENDIENTE DEL DUEÑO: puede haber motivos legítimos (un cliente que
//  acepta un cambio de horario, una pantalla apagada en el prime). Por eso la
//  regla vive AQUÍ, una sola vez, y la usan el servidor —que calcula los avisos
//  en la lectura— y las dos pantallas. El día que decida bloquear se cambia en
//  este archivo y en el controller, no en tres sitios que acabarían diciendo
//  cosas distintas.
//
//  Y la franja programada TAMPOCO viaja al CMS: el SDK de DOOHmain no tiene
//  `--hora` ni `--dias` (`doohmain_sdk/__main__.py:66-75`). Programarla aquí es
//  dejar escrito qué tiene que meter a mano quien opera la pantalla.
// ============================================================================

export type FranjaRef = {
  id: string
  nombre: string
  horaInicio?: string
  horaFin?: string
}

/** Una franja CONTRATADA en las reservas de una campaña, con cuántas pantallas la llevan. */
export type FranjaContratada = {
  franjaId: string | null
  franjaNombre: string | null
  pantallas: number
}

export type AvisoProgramacion = {
  franjaContratadaId: string
  franjaContratadaNombre: string | null
  pantallas: number
  texto: string
}

/** «Prime · 06:00–10:00», o solo el nombre si no trae horario. */
export function etiquetaFranja(f: FranjaRef): string {
  return f.horaInicio && f.horaFin ? `${f.nombre} · ${f.horaInicio}–${f.horaFin}` : f.nombre
}

const pantallas = (n: number) => `${n} pantalla${n === 1 ? '' : 's'}`

/**
 * Los avisos «se vendió como X y se programa en Y» de UNA campaña.
 *
 * Las tres decisiones, con su porqué:
 *
 *  1. **Sin franja programada no se avisa.** Sin programar no hay contraste; y
 *     avisar en toda campaña vendida con franja haría que el recuadro saliera
 *     siempre, y un aviso que sale siempre deja de leerse.
 *  2. **Lo vendido sin franja no es una discrepancia.** «Todo el día» no es un
 *     compromiso horario; programarlo en una franja no contradice nada de lo
 *     que el cliente aceptó.
 *  3. **Se agrupa por franja contratada.** Tres pantallas vendidas en Prime son
 *     UN aviso con «3 pantallas», no tres avisos iguales.
 *
 * Un nombre de franja contratada que no llega (dada de baja y sin join, por
 * ejemplo) se dice como «otra franja»: nunca un «se vendió como null».
 */
export function avisosDeProgramacion(e: {
  programada: FranjaRef | null
  contratadas: FranjaContratada[]
}): AvisoProgramacion[] {
  if (!e.programada) return []
  const programada = e.programada
  const porFranja = new Map<string, { nombre: string | null; pantallas: number }>()
  for (const c of e.contratadas) {
    if (!c.franjaId || c.franjaId === programada.id) continue
    const previo = porFranja.get(c.franjaId)
    porFranja.set(c.franjaId, {
      nombre: previo?.nombre ?? c.franjaNombre ?? null,
      pantallas: (previo?.pantallas ?? 0) + Math.max(0, Number(c.pantallas) || 0),
    })
  }
  return [...porFranja.entries()].map(([id, v]) => ({
    franjaContratadaId: id,
    franjaContratadaNombre: v.nombre,
    pantallas: v.pantallas,
    texto:
      `Se vendió como ${v.nombre ? `«${v.nombre}»` : 'otra franja'} (${pantallas(v.pantallas)}) ` +
      `y se programa en «${programada.nombre}». El precio y lo contratado no cambian; ` +
      `confirma con el cliente que el horario de transmisión es el acordado.`,
  }))
}

/**
 * El texto de la bitácora de acciones para una asignación en bloque.
 *
 * Se nombra la franja y se CUENTA, y los folios van en la entidad: el filtro de
 * Actividad busca por persona y por texto, y «Actualizó campañas» no dice qué.
 */
export function textoAccionProgramacion(e: {
  franja: FranjaRef | null
  campanas: { folio: string | null; nombre: string }[]
}): { accion: string; entidad: string } {
  const n = e.campanas.length
  const cuantas = `${n} campaña${n === 1 ? '' : 's'}`
  const accion = e.franja
    ? `Programó la franja «${e.franja.nombre}» en ${cuantas}`
    : `Quitó la franja programada de ${cuantas}`
  const entidad = e.campanas.map((c) => c.folio || c.nombre).join(', ')
  return { accion, entidad }
}
