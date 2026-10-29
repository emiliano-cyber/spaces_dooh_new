import { saldoCobranza, type Alerta } from '@/lib/data/derive'
import type { Tono } from '@/components/demo/StatusBadge'
import { enPropuestaEntre, type ItemEnPropuesta } from '@/lib/data/en-propuesta'

// ============================================================================
//  components/demo/inicio/indicadores.ts — Lo que el Dashboard calcula del
//  store, aparte del estado de resultados (que sale del motor de Reportes:
//  `pnl-del-mes.ts`).
// ----------------------------------------------------------------------------
//  DASH-REF (26/10). Salen de comparar el inicio con el de los referentes del
//  sector (Broadsign Ayuda, SignDash, HighSign, AdQuick, Moving Walls) y de los
//  CRM generales (Salesforce, HubSpot, Pipedrive, Zoho): cobranza por
//  antigüedad, pipeline con lo ganado en el mes, huecos por renovar, alertas
//  por gravedad y el pin del mapa por lo que pasa HOY.
//
//  Todo con fechas de CALENDARIO. `new Date('2026-07-17')` es medianoche UTC,
//  que en México cae en el día anterior; este repo ya pagó ese error y lo
//  documenta en `derive.ts` → `diasHasta`. Por eso se cuenta con días enteros
//  construidos con `Date.UTC` desde las partes del texto, igual que el motor de
//  reportes, y «hoy» se toma de las partes LOCALES.
//
//  Vive fuera del `.tsx` porque `vitest.config.ts` no monta jsdom.
// ============================================================================

const DIA = 86_400_000

/** Día absoluto de una fecha de calendario `AAAA-MM-DD` (o un ISO completo, se toma la fecha). */
function nDia(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / DIA
}

/** Hoy, como día absoluto, desde las partes LOCALES. */
function nHoy(hoy: Date): number {
  return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) / DIA
}

/** `AAAA-MM-DD` de un día absoluto. */
function isoDe(n: number): string {
  return new Date(n * DIA).toISOString().slice(0, 10)
}

/** ¿El instante `iso` cae en el mismo mes de calendario LOCAL que `hoy`? */
function mismoMes(iso: string, hoy: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth()
}

// ─── 3 · Por cobrar por antigüedad ─────────────────────────────────────────
// El KPI plano «Por cobrar $X» no distingue lo que vence el mes que viene de
// lo que lleva cuatro meses vencido, que es la única pregunta que importa en la
// mañana. Tramos estándar de cuentas por cobrar.

export type ClaveTramo = 'corriente' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90'

export const TRAMOS_COBRANZA: { clave: ClaveTramo; label: string }[] = [
  { clave: 'corriente', label: 'Sin vencer' },
  { clave: 'd1_30', label: '1–30 días' },
  { clave: 'd31_60', label: '31–60 días' },
  { clave: 'd61_90', label: '61–90 días' },
  { clave: 'd90', label: 'Más de 90' },
]

export interface AntiguedadCobranza {
  total: number
  vencido: number
  tramos: { clave: ClaveTramo; label: string; monto: number; n: number }[]
}

function tramoDe(atraso: number): ClaveTramo {
  if (atraso <= 0) return 'corriente'
  if (atraso <= 30) return 'd1_30'
  if (atraso <= 60) return 'd31_60'
  if (atraso <= 90) return 'd61_90'
  return 'd90'
}

export function antiguedadCobranza(
  cobranzas: { facturaId: string; fechaVencimiento: string; estatus: string; montoPagado: number; monto?: number | null }[],
  facturas: { id: string; monto: number }[],
  hoy: Date,
): AntiguedadCobranza {
  const facPorId = new Map(facturas.map((f) => [f.id, f]))
  const tramos = TRAMOS_COBRANZA.map((t) => ({ ...t, monto: 0, n: 0 }))
  const porClave = new Map(tramos.map((t) => [t.clave, t]))
  const h = nHoy(hoy)
  for (const c of cobranzas) {
    if (c.estatus === 'PAGADA') continue
    // El SALDO, con la misma regla que el KPI de siempre: la cuota de una
    // parcialidad si la tiene, si no la factura, menos lo abonado.
    const saldo = saldoCobranza(c, facPorId.get(c.facturaId))
    if (saldo <= 0) continue
    // Vence HOY no es vencida: el día del vencimiento todavía se puede pagar.
    const t = porClave.get(tramoDe(h - nDia(c.fechaVencimiento)))!
    t.monto += saldo
    t.n += 1
  }
  for (const t of tramos) t.monto = Math.round(t.monto * 100) / 100
  const total = Math.round(tramos.reduce((s, t) => s + t.monto, 0) * 100) / 100
  const vencido = Math.round((total - porClave.get('corriente')!.monto) * 100) / 100
  return { total, vencido, tramos }
}

// ─── 4 · Pipeline comercial ────────────────────────────────────────────────
// Sustituye a «Tentativas vs confirmadas», que comparaba propuestas abiertas
// contra el acumulado HISTÓRICO de reservas: dos cosas de periodos distintos en
// la misma gráfica.
//
// «Ganado» se mide por `aprobadaEn`, que existe desde `20261009_propuestas_
// fechas_estatus.sql`. Una aprobada de antes no tiene fecha y NO se cuenta en
// el mes: suponerla de este mes inflaría lo ganado con historia.

export interface PipelineComercial {
  abierto: { n: number; valor: number; enviadas: number }
  ganadoMes: { n: number; valor: number }
  /** Aprobadas ÷ decididas en los últimos 90 días. `null` = no hubo decisiones, que no es 0 %. */
  tasaCierre: number | null
  porVendedor: { nombre: string; n: number; valor: number }[]
}

export const VENTANA_TASA_DIAS = 90

export function pipelineComercial(
  propuestas: {
    estatus: string
    neto: number
    netoAprobado?: number
    vendedorId?: string | null
    // P19 (29/10) · el nombre congelado en la propuesta: sobrevive al borrado
    // del usuario y sirve cuando la lista de usuarios no llega.
    vendedorNombre?: string | null
    aprobadaEn?: string | null
    rechazadaEn?: string | null
  }[],
  usuarios: { id: string; nombre: string }[],
  hoy: Date,
  // Quien está en sesión. La lista de usuarios solo viaja a quien ve
  // `operaciones` (`app/api/estado/route.ts`): a un VENDEDOR le llega vacía, y
  // sin esto ni su propio nombre se resolvería.
  yo?: { id: string; nombre: string } | null,
): PipelineComercial {
  const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]))
  if (yo) nombre.set(yo.id, yo.nombre)
  // Con vendedor pero sin su nombre a la vista NO es «Sin vendedor»: esa
  // etiqueta afirma que la propuesta no tiene, y sí tiene.
  // P19 · y sin id pero con el nombre congelado tampoco: el vendedor se borró,
  // y la propuesta sabe quién era.
  const etiqueta = (id: string | null | undefined, congelado?: string | null) =>
    (id ? nombre.get(id) : undefined) ?? (congelado?.trim() || (id ? 'Otros vendedores' : 'Sin vendedor'))
  const abierto = { n: 0, valor: 0, enviadas: 0 }
  const ganadoMes = { n: 0, valor: 0 }
  const vend = new Map<string, { nombre: string; n: number; valor: number }>()
  const desde = nHoy(hoy) - VENTANA_TASA_DIAS
  let aprobadas = 0
  let decididas = 0

  for (const p of propuestas) {
    if (p.estatus === 'BORRADOR' || p.estatus === 'ENVIADA') {
      abierto.n += 1
      abierto.valor += Number(p.neto) || 0
      if (p.estatus === 'ENVIADA') abierto.enviadas += 1
    }
    if (p.estatus === 'APROBADA' && p.aprobadaEn) {
      if (nDia(p.aprobadaEn) >= desde) { aprobadas += 1; decididas += 1 }
      if (mismoMes(p.aprobadaEn, hoy)) {
        // Lo APROBADO, no lo cotizado: con aprobación sitio por sitio el
        // cliente puede quedarse con una parte.
        const valor = Number(p.netoAprobado) || Number(p.neto) || 0
        ganadoMes.n += 1
        ganadoMes.valor += valor
        const nom = etiqueta(p.vendedorId, p.vendedorNombre)
        const v = vend.get(nom) ?? { nombre: nom, n: 0, valor: 0 }
        v.n += 1
        v.valor += valor
        vend.set(nom, v)
      }
    }
    if (p.estatus === 'RECHAZADA' && p.rechazadaEn && nDia(p.rechazadaEn) >= desde) decididas += 1
  }

  return {
    abierto,
    ganadoMes,
    tasaCierre: decididas > 0 ? aprobadas / decididas : null,
    porVendedor: [...vend.values()].sort((a, b) => b.valor - a.valor).slice(0, 5),
  }
}

// ─── 5 · Huecos y renovaciones ─────────────────────────────────────────────
// Sustituye a «Campañas por finalizar», que avisaba de que una campaña
// terminaba pero no de lo que importa: que la cara se queda VACÍA y a quién
// ofrecerle renovar. Es lo que SignDash pone al frente y HighSign llama
// «gap alerts».
//
// Una reserva confirmada que termina en la ventana deja hueco salvo que haya
// RELEVO — otra reserva viva (no cancelada) en la misma pantalla que empiece
// a más tardar el día siguiente y siga después:
//   · en una FIJA, de cualquier campaña: la cara solo admite una;
//   · en una DIGITAL, del MISMO cliente: los slots de una campaña no los
//     ocupan las demás que ya estaban al aire, así que solo una renovación
//     cierra el hueco.
// Digital es `PANTALLA_DIGITAL`, la regla de booking (S0-3), no la de
// presentación: un rotativo sobre estructura estática se vende como fijo.
//
// TENT-PROP (26/10) · una PROPUESTA abierta que pide la cara no es relevo:
// puede no cerrarse, y lo tentativo solo avisa. El hueco sigue, pero lleva los
// folios que la piden dentro de la ventana — que es exactamente a quién llamar.

export const VENTANA_HUECOS_DIAS = 30

export interface Hueco {
  sitioId: string
  sitioNombre: string
  campanaId: string
  campanaNombre: string
  clienteNombre: string | null
  fechaFin: string
  dias: number
  digital: boolean
  slots: number | null
  /** Folios de propuestas abiertas que piden esta pantalla en la ventana tras el fin. */
  enPropuesta: string[]
}

export function huecosProximos(
  datos: {
    sitios: { id: string; nombre: string; tipoMedio: string }[]
    campanas: { id: string; nombre: string; clienteId: string | null }[]
    clientes: { id: string; nombre: string }[]
    reservas: {
      id: string
      sitioId: string
      campanaId: string
      fechaInicio: string
      fechaFin: string
      estatus: string
      spotsReservados: number | null
    }[]
    /** Lo que piden las propuestas abiertas (`itemsEnPropuesta`). Ausente = nada. */
    enPropuesta?: ItemEnPropuesta[]
  },
  hoy: Date,
  ventanaDias: number = VENTANA_HUECOS_DIAS,
): Hueco[] {
  const h = nHoy(hoy)
  const sitio = new Map(datos.sitios.map((s) => [s.id, s]))
  const campana = new Map(datos.campanas.map((c) => [c.id, c]))
  const cliente = new Map(datos.clientes.map((c) => [c.id, c.nombre]))
  const vivas = datos.reservas.filter((r) => r.estatus !== 'CANCELADA')
  const porSitio = new Map<string, typeof vivas>()
  for (const r of vivas) porSitio.set(r.sitioId, [...(porSitio.get(r.sitioId) ?? []), r])

  const out: Hueco[] = []
  for (const r of vivas) {
    if (r.estatus !== 'CONFIRMADA') continue
    const s = sitio.get(r.sitioId)
    if (!s) continue
    const fin = nDia(r.fechaFin)
    const dias = fin - h
    if (dias < 0 || dias > ventanaDias) continue
    const digital = s.tipoMedio === 'PANTALLA_DIGITAL'
    const clienteId = campana.get(r.campanaId)?.clienteId ?? null
    const relevo = (porSitio.get(r.sitioId) ?? []).some((o) => {
      if (o.id === r.id) return false
      if (nDia(o.fechaInicio) > fin + 1 || nDia(o.fechaFin) <= fin) return false
      return !digital || (clienteId != null && campana.get(o.campanaId)?.clienteId === clienteId)
    })
    if (relevo) continue
    const c = campana.get(r.campanaId)
    out.push({
      sitioId: s.id,
      sitioNombre: s.nombre,
      campanaId: r.campanaId,
      campanaNombre: c?.nombre ?? '',
      clienteNombre: clienteId ? (cliente.get(clienteId) ?? null) : null,
      fechaFin: isoDe(fin),
      dias,
      digital,
      slots: digital ? r.spotsReservados : null,
      enPropuesta: enPropuestaEntre(datos.enPropuesta ?? [], s.id, isoDe(fin + 1), isoDe(fin + 1 + ventanaDias)).map(
        (x) => x.folio,
      ),
    })
  }
  return out.sort((a, b) => a.dias - b.dias || a.sitioNombre.localeCompare(b.sitioNombre))
}

// ─── 6 · Alertas por gravedad ──────────────────────────────────────────────
// `construirAlertas` las genera agrupadas por TIPO (rentas, contratos,
// licencias, cobranza, incidencias, OT) y el Dashboard enseñaba las seis
// primeras: las de renta empujaban fuera una factura vencida o una OT fuera de
// plazo aunque fueran rojas. Rojas primero; dentro de cada nivel se respeta el
// orden de origen (`sort` es estable).
export function ordenarAlertas<T extends Pick<Alerta, 'nivel'>>(alertas: T[]): T[] {
  const peso = (a: T) => (a.nivel === 'rojo' ? 0 : 1)
  return [...alertas].sort((a, b) => peso(a) - peso(b))
}

// ─── 8 · El pin del mapa, por lo que pasa HOY ──────────────────────────────
// `pinTono` lee `sitios.estatus_comercial`, una columna guardada que no se
// recalcula cuando una reserva termina: un espectacular cuya campaña acabó
// ayer seguía en rojo. Aquí se mira la reserva que cubre el día: vendida (no
// cancelada, la regla del guard del servidor) en rojo. Y desde TENT-PROP
// (26/10) el ámbar es «en propuesta»: libre hoy, pero una propuesta abierta la
// pide para hoy. Antes era la reserva TENTATIVA, que ningún flujo creaba.
export function tonoPinHoy(
  s: { id: string; tipoMedio: string; esRotativo: boolean; exhibicion: string },
  reservas: { sitioId: string; estatus: string; fechaInicio: string; fechaFin: string }[],
  hoy: Date,
  enPropuesta: ItemEnPropuesta[] = [],
): Tono {
  const digital =
    s.tipoMedio === 'PANTALLA_DIGITAL' || s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
  if (digital) return 'azul'
  const h = nHoy(hoy)
  for (const r of reservas) {
    if (r.sitioId !== s.id || r.estatus === 'CANCELADA') continue
    if (nDia(r.fechaInicio) > h || nDia(r.fechaFin) < h) continue
    return 'rojo'
  }
  return enPropuestaEntre(enPropuesta, s.id, isoDe(h), isoDe(h)).length > 0 ? 'ambar' : 'verde'
}

// ─── 7 · Cuánto de la tarifa publicada se cobra ────────────────────────────
// La «realización de precio» del sector: el neto cobrado contra la tarifa de
// lista de las mismas reservas. Sale del motor de Reportes (dimensión `tarifa`)
// para el mes en curso, así que solo cuenta las ventas nacidas de una propuesta
// —las únicas con tarifa publicada congelada— y lo dice.
export type PrecioDelMes =
  | { fase: 'cargando' }
  | { fase: 'datos'; pct: number; conTarifa: number; sinTarifa: number }
  | { fase: 'sin-datos' }
  | { fase: 'sin-acceso' }
  | { fase: 'error' }

export function precioDesdeRespuesta(status: number, cuerpo: unknown): PrecioDelMes {
  if (status === 401 || status === 403) return { fase: 'sin-acceso' }
  if (status < 200 || status >= 300) return { fase: 'error' }
  const t = (cuerpo as { tarifas?: Record<string, unknown> } | null)?.tarifas
  if (!t || typeof t.ingresoLista !== 'number' || typeof t.ingresoComparable !== 'number') return { fase: 'error' }
  // Sin tarifa de lista con la que comparar no hay porcentaje: un 0 % diría que
  // se regaló todo.
  if (t.ingresoLista <= 0) return { fase: 'sin-datos' }
  return {
    fase: 'datos',
    pct: Math.round((t.ingresoComparable / t.ingresoLista) * 100),
    conTarifa: Number(t.reservasConTarifa) || 0,
    sinTarifa: Number(t.reservasSinTarifa) || 0,
  }
}
