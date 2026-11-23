// ============================================================================
//  lib/prioridad-imprenta.ts — En qué orden se imprime.
// ----------------------------------------------------------------------------
//  Pedido del dueño (17/11): «un mapeado de prioridad de imprenta, de cuáles son
//  las más próximas y cuáles son las últimas». Hasta hoy la lista de Imprenta
//  salía en orden de alta (`creado_en asc`), y una lona para una campaña que
//  arranca mañana podía quedar debajo de diez que arrancan en dos meses.
//
//  La urgencia la manda la FECHA DE INICIO DE LA CAMPAÑA —o, desde el 20/11, la
//  FECHA ESPECIAL de la orden si alguien la puso—, no la de alta de la orden: la lona tiene que estar impresa y montada antes de ese día. Lo que ya
//  está «Listo para montaje» deja de ser trabajo de imprenta y se va al final,
//  pase lo que pase con su fecha.
//
//  Puro y sin reloj: `hoy` entra como parámetro para que las pruebas no
//  dependan del día en que se corren (ver `cfe83d83`, que arregló una prueba
//  que fechaba con el reloj real).
// ============================================================================

export type GrupoPrioridad = 'ATRASADA' | 'SEMANA' | 'MES' | 'DESPUES' | 'SIN_FECHA' | 'LISTA'

// El orden en que se pintan los grupos: lo más urgente arriba.
export const ORDEN_GRUPOS: GrupoPrioridad[] = ['ATRASADA', 'SEMANA', 'MES', 'DESPUES', 'SIN_FECHA', 'LISTA']

// Umbrales en días naturales hasta el inicio de la campaña. Una semana es el
// margen típico de producción + montaje de una lona; a más de un mes no corre.
export const DIAS_SEMANA = 7
export const DIAS_MES = 30

export interface EntradaPrioridad {
  id: string
  folio: string
  estatus: string
  // Fecha de inicio de la campaña (ISO o YYYY-MM-DD). null si no hay campaña.
  inicioCampana: string | null
  // FLUJO-CREA (20/11) · la «fecha especial» (fecha requerida) de la orden. Si
  // está puesta MANDA sobre el inicio de la campaña: una lona que el cliente
  // quiere antes del arranque —o una que puede esperar— se mueve en la cola
  // sin tocar las fechas de la campaña. null o ausente = manda el inicio.
  fechaEspecial?: string | null
}

// De dónde sale la fecha que ordena: la especial de la orden o el inicio de su
// campaña. null = no hay ninguna (SIN_FECHA). La pantalla lo dice en cada fila.
export type BasePrioridad = 'ESPECIAL' | 'INICIO'

export interface Priorizada<T> {
  orden: T
  grupo: GrupoPrioridad
  // Días naturales desde hoy hasta la fecha que manda. Negativo = ya pasó. null = sin fecha.
  dias: number | null
  // Lugar en la cola de trabajo (1 = la primera que hay que imprimir). Las
  // listas para montaje no cuentan: ya no son trabajo de imprenta.
  lugar: number | null
  // Qué fecha manda en esta orden (FLUJO-CREA, 20/11).
  base: BasePrioridad | null
}

const ESTATUS_LISTA = 'LISTO_MONTAJE'

// Días entre dos fechas de calendario, sin horas: «2026-11-17T23:00Z» y
// «2026-11-18» están a 1 día, no a 0,04. Se toma la parte de fecha tal cual,
// sin pasar por la zona horaria del navegador (que la movería un día).
export function diasEntre(desde: string, hasta: string): number | null {
  const a = aDia(desde)
  const b = aDia(hasta)
  if (a == null || b == null) return null
  return Math.round((b - a) / 86_400_000)
}

function aDia(s: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''))
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(t) ? t : null
}

export function grupoDe(estatus: string, dias: number | null): GrupoPrioridad {
  if (estatus === ESTATUS_LISTA) return 'LISTA'
  if (dias == null) return 'SIN_FECHA'
  if (dias < 0) return 'ATRASADA'
  if (dias <= DIAS_SEMANA) return 'SEMANA'
  if (dias <= DIAS_MES) return 'MES'
  return 'DESPUES'
}

/**
 * Ordena las órdenes de impresión por urgencia y les pone su lugar en la cola.
 * `hoy` en YYYY-MM-DD (o ISO). Estable: a igual fecha, el folio desempata.
 */
export function priorizarImpresion<T extends EntradaPrioridad>(ordenes: T[], hoy: string): Priorizada<T>[] {
  const conDatos = ordenes.map((orden) => {
    const base: BasePrioridad | null = orden.fechaEspecial ? 'ESPECIAL' : orden.inicioCampana ? 'INICIO' : null
    const fecha = base === 'ESPECIAL' ? orden.fechaEspecial : orden.inicioCampana
    const dias = fecha ? diasEntre(hoy, fecha) : null
    return { orden, dias, base, grupo: grupoDe(orden.estatus, dias) }
  })
  conDatos.sort((a, b) => {
    const g = ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo)
    if (g !== 0) return g
    // Dentro del grupo, la que arranca antes va primero. Sin fecha, al final
    // de su grupo (solo pasa en SIN_FECHA y en LISTA).
    const da = a.dias ?? Number.POSITIVE_INFINITY
    const db = b.dias ?? Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return a.orden.folio.localeCompare(b.orden.folio)
  })
  let lugar = 0
  return conDatos.map((x) => ({ ...x, lugar: x.grupo === 'LISTA' ? null : ++lugar }))
}

/**
 * El día de calendario LOCAL de una fecha, en YYYY-MM-DD. No `toISOString()`:
 * en México, de las 18:00 en adelante ese ya es «mañana» en UTC, y la orden que
 * arranca mañana diría «arranca hoy».
 */
export function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Cuántas órdenes caen en cada grupo, con los seis grupos siempre presentes. */
export function conteoPorGrupo(lista: { grupo: GrupoPrioridad }[]): Record<GrupoPrioridad, number> {
  const c = Object.fromEntries(ORDEN_GRUPOS.map((g) => [g, 0])) as Record<GrupoPrioridad, number>
  for (const x of lista) c[x.grupo]++
  return c
}
