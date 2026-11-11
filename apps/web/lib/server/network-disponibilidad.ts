// ============================================================================
//  lib/server/network-disponibilidad.ts — qué días tiene libres una pantalla.
// ----------------------------------------------------------------------------
//  Lo consume `GET /api/network/espacios` (11/11), la puerta por la que la
//  nueva app de Network jala los espacios con el switch encendido. Es puro a
//  propósito: recibe las reservas ya leídas y devuelve periodos, así que se
//  prueba sin base.
//
//  ─── La regla es la del alta de reservas, no otra ─────────────────────────
//  `campanas-repo.ts` (alta de una reserva) decide así si una pantalla cabe:
//   · ESTÁTICA → exclusiva: cualquier reserva no cancelada que pise la fecha
//     la ocupa. Aquí: capacidad 1.
//   · DIGITAL  → por slots: ocupada cuando las campañas DISTINTAS con reserva
//     activa llegan a `total_spots`. Sin `total_spots` no hay tope, y el alta
//     tampoco lo pone: siempre libre.
//  Si esta función y el alta divergen, la app ofrece fechas que luego no se
//  pueden vender. Por eso las reservas que entran aquí son las mismas que el
//  alta mira: todas las que no están CANCELADAS.
//
//  Una diferencia que hay que saber: aquí se cuenta DÍA A DÍA. El alta de una
//  digital cuenta las campañas que pisan CUALQUIER día del rango pedido, así
//  que un rango largo puede chocar aunque cada día suelto tenga hueco (la A en
//  la primera mitad y la B en la segunda, con tope 2). Lo que se publica como
//  libre es libre por día; vender un tramo largo lo valida el alta.
// ============================================================================

export interface ReservaOcupa {
  campanaId: string
  desde: string // YYYY-MM-DD, inclusivo
  hasta: string // YYYY-MM-DD, inclusivo
}

export interface Periodo {
  desde: string
  hasta: string
}

const DIA_MS = 86_400_000

function aDia(fecha: string): number {
  return Math.floor(Date.parse(`${fecha}T00:00:00Z`) / DIA_MS)
}
function aFecha(dia: number): string {
  return new Date(dia * DIA_MS).toISOString().slice(0, 10)
}

/**
 * Periodos libres de una pantalla entre `desde` y `hasta` (los dos inclusive).
 *
 * `capacidad` es cuántas campañas distintas caben el mismo día: 1 en una
 * estática, `total_spots` en una digital, y `null` cuando no hay tope.
 */
export function periodosLibres(
  desde: string,
  hasta: string,
  reservas: ReservaOcupa[],
  capacidad: number | null,
): Periodo[] {
  const ini = aDia(desde)
  const fin = aDia(hasta)
  if (!(fin >= ini)) return []
  if (capacidad == null) return [{ desde, hasta }]

  // Campañas distintas por día. Un Set por día y no un contador: dos reservas
  // de la misma campaña en la misma pantalla ocupan UN slot, igual que en el
  // `count(distinct campana_id)` del alta.
  const porDia = new Map<number, Set<string>>()
  for (const r of reservas) {
    const a = Math.max(aDia(r.desde), ini)
    const b = Math.min(aDia(r.hasta), fin)
    for (let d = a; d <= b; d++) {
      let s = porDia.get(d)
      if (!s) porDia.set(d, (s = new Set()))
      s.add(r.campanaId)
    }
  }

  const libres: Periodo[] = []
  let abierto: number | null = null
  for (let d = ini; d <= fin; d++) {
    const libre = (porDia.get(d)?.size ?? 0) < capacidad
    if (libre && abierto === null) abierto = d
    if (!libre && abierto !== null) {
      libres.push({ desde: aFecha(abierto), hasta: aFecha(d - 1) })
      abierto = null
    }
  }
  if (abierto !== null) libres.push({ desde: aFecha(abierto), hasta: aFecha(fin) })
  return libres
}

/** Capacidad de una pantalla según el alta de reservas (ver cabecera). */
export function capacidadDe(tipoMedio: string | null, totalSpots: number | null): number | null {
  if (tipoMedio !== 'PANTALLA_DIGITAL') return 1
  return totalSpots == null ? null : Number(totalSpots)
}
