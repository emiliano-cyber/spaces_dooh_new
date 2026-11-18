// ============================================================================
//  lib/data/en-propuesta.ts — Lo TENTATIVO: pantallas y spots «en veremos».
// ----------------------------------------------------------------------------
//  TENT-PROP (26/10). Regla del dueño: «lo tentativo debe ser un spot o una
//  pantalla fija que está en veremos en una propuesta, es decir, solo es
//  propuesta: aún no está aprobada ni creada la campaña».
//
//  Hasta hoy «tentativo» era un ESTADO DE LA RESERVA (TENTATIVA, con caducidad
//  de 7 días), y ningún flujo lo creaba: reservar desde Comercial y generar la
//  campaña desde una propuesta insertan CONFIRMADA (`campanas-repo.ts`). Así
//  que la tarjeta «Reservas tentativas», el ámbar de Disponibilidad y el del
//  mapa no podían encenderse nunca, mientras el motor de Reportes sí contaba
//  esas reservas como ingreso. Se retira, y lo tentativo se CALCULA de las
//  propuestas abiertas — que es donde de verdad vive lo que está en veremos.
//
//  Y «solo avisa» (decisión del dueño, 26/10): una pantalla en propuesta NO
//  impide cotizarla o venderla a otro cliente; varias propuestas pueden
//  competir por la misma. Bloquea solo lo confirmado. Por eso aquí no hay ni
//  un cálculo de disponibilidad: solo la lista de quién la está pidiendo.
//
//  Fechas de CALENDARIO comparadas como `AAAA-MM-DD`: con el formato fijo la
//  comparación de texto es la del calendario, y no entra la zona horaria (ver
//  `diasHasta` en derive.ts para el error que eso evita).
// ============================================================================

/** Estatus de una propuesta que todavía está en veremos. */
export const ESTATUS_EN_VEREMOS = ['BORRADOR', 'ENVIADA'] as const

export interface ItemEnPropuesta {
  sitioId: string
  propuestaId: string
  folio: string
  estatus: (typeof ESTATUS_EN_VEREMOS)[number]
  /** `null` si la propuesta aún no tiene cliente: no se inventa uno. */
  clienteNombre: string | null
  fechaInicio: string
  fechaFin: string
  /** Spots pedidos en una digital; `null` en una fija o si no se capturaron. */
  spots: number | null
}

interface PropuestaLike {
  id: string
  folio: string
  estatus: string
  clienteId: string | null
  items: {
    sitioId: string
    fechaInicio: string
    fechaFin: string
    spotsPorDia: number | null
    espaciosComprados?: number | null
  }[]
}

const dia = (iso: string) => iso.slice(0, 10)

export function itemsEnPropuesta(
  propuestas: PropuestaLike[],
  clientes: { id: string; nombre: string }[],
): ItemEnPropuesta[] {
  const nombre = new Map(clientes.map((c) => [c.id, c.nombre]))
  const out: ItemEnPropuesta[] = []
  for (const p of propuestas) {
    if (!(ESTATUS_EN_VEREMOS as readonly string[]).includes(p.estatus)) continue
    for (const it of p.items ?? []) {
      out.push({
        sitioId: it.sitioId,
        propuestaId: p.id,
        folio: p.folio,
        estatus: p.estatus as ItemEnPropuesta['estatus'],
        clienteNombre: p.clienteId ? (nombre.get(p.clienteId) ?? null) : null,
        fechaInicio: dia(it.fechaInicio),
        fechaFin: dia(it.fechaFin),
        // La MISMA precedencia con la que una propuesta aprobada reserva slots
        // (`campanas-repo.ts`, `espacios_comprados ?? spots_por_dia`): en una
        // línea de la calculadora `spots_por_dia` son los pases al día de la
        // cuenta —540, 3240— y no los slots que se piden.
        spots: it.espaciosComprados ?? it.spotsPorDia ?? null,
      })
    }
  }
  return out
}

export interface PropuestaEnVeremos {
  propuestaId: string
  folio: string
  estatus: ItemEnPropuesta['estatus']
  clienteNombre: string | null
  pantallas: number
  desde: string
  hasta: string
}

/**
 * Una fila por propuesta abierta con algo todavía por delante (`hasta` >= hoy):
 * la tarjeta «En propuesta» de Comercial. Una propuesta cuyas fechas ya pasaron
 * sigue abierta en Propuestas, pero ya no aparta nada que vender.
 * Ordenadas por la que empieza antes.
 */
export function agruparPorPropuesta(items: ItemEnPropuesta[], hoyIso: string): PropuestaEnVeremos[] {
  const hoy = dia(hoyIso)
  const porId = new Map<string, PropuestaEnVeremos & { sitios: Set<string> }>()
  for (const it of items) {
    let p = porId.get(it.propuestaId)
    if (!p) {
      p = { propuestaId: it.propuestaId, folio: it.folio, estatus: it.estatus, clienteNombre: it.clienteNombre, pantallas: 0, desde: it.fechaInicio, hasta: it.fechaFin, sitios: new Set() }
      porId.set(it.propuestaId, p)
    }
    p.sitios.add(it.sitioId)
    if (it.fechaInicio < p.desde) p.desde = it.fechaInicio
    if (it.fechaFin > p.hasta) p.hasta = it.fechaFin
  }
  return [...porId.values()]
    .filter((p) => p.hasta >= hoy)
    .map(({ sitios, ...p }) => ({ ...p, pantallas: sitios.size }))
    .sort((a, b) => a.desde.localeCompare(b.desde) || a.folio.localeCompare(b.folio))
}

/**
 * Las propuestas abiertas que piden `sitioId` en algún día de [desde, hasta]
 * (inclusive). Una propuesta sale UNA vez aunque traiga la pantalla en varias
 * líneas: lo que se avisa es «quién la está pidiendo», no cuántas líneas.
 */
export function enPropuestaEntre(
  items: ItemEnPropuesta[],
  sitioId: string,
  desde: string,
  hasta: string,
): ItemEnPropuesta[] {
  const d = dia(desde)
  const h = dia(hasta)
  const vistas = new Set<string>()
  const out: ItemEnPropuesta[] = []
  for (const it of items) {
    if (it.sitioId !== sitioId || it.fechaInicio > h || it.fechaFin < d) continue
    if (vistas.has(it.propuestaId)) continue
    vistas.add(it.propuestaId)
    out.push(it)
  }
  return out
}
