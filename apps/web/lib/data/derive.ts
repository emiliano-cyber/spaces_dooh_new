// ============================================================================
//  lib/data/derive.ts — Selectores DERIVADOS (puros, sin estado propio)
// ----------------------------------------------------------------------------
//  Funciones puras que calculan, a partir del DemoState, las cosas que la UI
//  necesita pero que NO se almacenan: etapa del pipeline, candado de
//  facturación, métricas del dashboard, semáforos de cobranza. Se mantienen
//  aquí (no en los componentes) para que mock y http den resultados idénticos.
// ============================================================================

import type {
  DemoState,
  Campana,
  EtapaPipeline,
  Cobranza,
  EstCobranza,
  Sitio,
  Reserva,
  EstReserva,
  TipoMedio,
  OrdenTrabajo,
  EstOT,
} from './types'

// Orden canónico de las 10 etapas del pipeline (sección 7.4).
export const ETAPAS_PIPELINE: EtapaPipeline[] = [
  'reservada',
  'confirmada',
  'oc_recibida',
  'creativo_recibido',
  'creativo_validado',
  'en_imprenta',
  'en_produccion',
  'instalada',
  'reporte_generado',
  'lista_facturar',
]

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  reservada: 'Reservada',
  confirmada: 'Confirmada',
  oc_recibida: 'OC recibida',
  creativo_recibido: 'Creativo recibido',
  creativo_validado: 'Creativo validado',
  en_imprenta: 'En imprenta',
  en_produccion: 'En producción',
  instalada: 'Instalada / al aire',
  reporte_generado: 'Reporte generado',
  lista_facturar: 'Lista para facturar',
}

// ─── Etapas aplicables a una campaña según su tipo ──────────────────────────
// La revisión de creativo (recibido/validado) y la impresión son etapas
// excluyentes según el medio:
//   • DOOH (digital): el arte del cliente se recibe y aprueba, pero NO se
//     imprime → se omite "En imprenta".
//   • OOH (fija/física): la lona se imprime y monta; NO hay etapa de revisión
//     de creativo → se omiten "Creativo recibido" y "Creativo validado", queda
//     "En imprenta".
//   • HÍBRIDA: tiene ambos flujos, conserva todas las etapas.
const ETAPAS_CREATIVO: EtapaPipeline[] = ['creativo_recibido', 'creativo_validado']
export function etapasPipeline(c: Campana): EtapaPipeline[] {
  if (c.tipoCampana === 'DOOH') {
    return ETAPAS_PIPELINE.filter((e) => e !== 'en_imprenta')
  }
  if (c.tipoCampana === 'OOH') {
    return ETAPAS_PIPELINE.filter((e) => !ETAPAS_CREATIVO.includes(e))
  }
  return ETAPAS_PIPELINE
}

// ─── Candado de facturación ─────────────────────────────────────────────────
// Las tres condiciones (todas son campos reales de Prisma en Campana):
//   OC recibida + fotos comprobatorias + reporte de publicación.
export function candadoFacturacion(c: Campana): boolean {
  return c.ocRecibida && c.fotosComprobatorias && c.reportePublicacion
}

// ─── Etapa actual del pipeline ──────────────────────────────────────────────
// Devuelve la etapa MÁS avanzada que la campaña ha alcanzado.
export function pipelineStage(c: Campana, state: DemoState): EtapaPipeline {
  if (c.estadoComercial === 'LISTA_FACTURAR' || candadoFacturacion(c)) {
    return 'lista_facturar'
  }
  if (c.reportePublicacion) return 'reporte_generado'

  const ots = state.ordenesTrabajo.filter(
    (o) => o.campanaId === c.id && (o.tipo === 'MONTAJE_LONA' || o.tipo === 'MONTAJE_DIGITAL'),
  )
  const tieneEvidencia = ots.some((o) =>
    state.evidencias.some((e) => e.otId === o.id),
  )
  if (tieneEvidencia || ots.some((o) => o.estatus === 'COMPLETADA')) {
    return 'instalada'
  }

  // Etapas que aplican a esta campaña según su tipo (digital/fija/híbrida).
  const aplica = (e: EtapaPipeline) => etapasPipeline(c).includes(e)

  const ois = state.ordenesImpresion.filter((o) => o.campanaId === c.id)
  if (ois.some((o) => o.estatus === 'LISTO_MONTAJE' || o.estatus === 'IMPRESO')) {
    return 'en_produccion'
  }
  // "En imprenta" solo aplica a medios físicos (OOH/HÍBRIDA), no a digitales.
  if (aplica('en_imprenta') && ois.length > 0) return 'en_imprenta'

  // "Creativo recibido/validado" solo aplica a medios con revisión de arte
  // (DOOH/HÍBRIDA); la fija (OOH) los omite.
  const creas = state.creatividades.filter((cr) => cr.campanaId === c.id)
  if (aplica('creativo_validado') && creas.some((cr) => cr.estatusValidacion === 'VALIDADA')) return 'creativo_validado'
  if (aplica('creativo_recibido') && creas.length > 0) return 'creativo_recibido'

  if (c.ocRecibida) return 'oc_recibida'
  if (c.estadoComercial === 'CONFIRMADA' || c.estadoComercial === 'ACTIVA') return 'confirmada'
  return 'reservada'
}

export function etapaIndex(
  etapa: EtapaPipeline,
  etapas: EtapaPipeline[] = ETAPAS_PIPELINE,
): number {
  return etapas.indexOf(etapa)
}

// Fecha conocida de cada etapa (donde se puede derivar del estado). Las que no
// tienen fuente quedan undefined y el Stepper simplemente no muestra fecha.
export function fechasPipeline(
  c: Campana,
  state: DemoState,
): Partial<Record<EtapaPipeline, string>> {
  const f: Partial<Record<EtapaPipeline, string>> = {}
  const reservas = state.reservas.filter((r) => r.campanaId === c.id)
  const creas = state.creatividades.filter((cr) => cr.campanaId === c.id)
  const ois = state.ordenesImpresion.filter((o) => o.campanaId === c.id)
  const ots = state.ordenesTrabajo.filter((o) => o.campanaId === c.id)

  if (reservas.length) f.reservada = min(reservas.map((r) => r.creadoEn))
  if (c.estadoComercial !== 'DRAFT' && c.estadoComercial !== 'COTIZACION') {
    f.confirmada = c.fechaInicio
  }
  if (creas.length) f.creativo_recibido = min(creas.map((cr) => cr.creadoEn))
  if (creas.some((cr) => cr.estatusValidacion === 'VALIDADA')) {
    f.creativo_validado = min(creas.map((cr) => cr.creadoEn))
  }
  if (ois.length) f.en_imprenta = min(ois.map((o) => o.creadoEn))
  const listo = ois.filter((o) => o.estatus === 'LISTO_MONTAJE' || o.estatus === 'IMPRESO')
  if (listo.length) f.en_produccion = min(listo.map((o) => o.creadoEn))
  const completadas = ots.filter((o) => o.fechaCompletada)
  if (completadas.length) f.instalada = max(completadas.map((o) => o.fechaCompletada as string))
  if (c.reportePublicacion) f.reporte_generado = state.evidencias
    .filter((e) => ots.some((o) => o.id === e.otId))
    .map((e) => e.timestamp)[0]
  return f
}

function min(xs: string[]): string {
  return xs.slice().sort()[0]
}
function max(xs: string[]): string {
  return xs.slice().sort().at(-1) as string
}

// ─── Semáforo de cobranza (recalculado vs hoy) ──────────────────────────────
export function estadoCobranza(cob: Cobranza): EstCobranza {
  if (cob.estatus === 'PAGADA') return 'PAGADA'
  const dias = diasHasta(cob.fechaVencimiento)
  if (dias < 0) return 'VENCIDA'
  if (dias <= 30) return 'POR_VENCER'
  return 'AL_CORRIENTE'
}

// ─── Métricas del dashboard del dueño (7.1) ─────────────────────────────────

// Costo operativo estimado por orden de trabajo (mano de obra de cuadrilla).
// Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
const COSTO_OPERATIVO_POR_OT = 1500

export interface DashboardMetrics {
  ingresoMes: number
  // Motor de costos (3 fuentes) → costoTotalMes.
  costoEspaciosMes: number   // costo de compra de los sitios vendidos
  costoImpresionMes: number  // producción de lonas (órdenes de impresión)
  costoOperacionMes: number  // mano de obra de cuadrilla (órdenes de trabajo)
  costoTotalMes: number      // suma de los tres
  costoRentaMes: number      // renta a arrendadores (gasto fijo, informativo)
  margen: number // S/
  margenPct: number // 0–100
  porCobrar: number
  ocupacionPct: number
  sitiosOcupados: number
  sitiosTotales: number
  reservasTentativas: number
  reservasConfirmadas: number
  valorTentativo: number
  valorConfirmado: number
  alertas: Alerta[]
}

export interface Alerta {
  id: string
  nivel: 'rojo' | 'ambar'
  titulo: string
  detalle: string
}

export function dashboardMetrics(state: DemoState): DashboardMetrics {
  const confirmadas = state.reservas.filter((r) => r.estatus === 'CONFIRMADA')
  const tentativas = state.reservas.filter((r) => r.estatus === 'TENTATIVA')
  const ingresoMes = confirmadas.reduce((s, r) => s + r.precio, 0)
  const valorConfirmado = ingresoMes
  const valorTentativo = tentativas.reduce((s, r) => s + r.precio, 0)

  // ── Motor de costos (3 fuentes) ──────────────────────────────────────────
  const sitioPorId = new Map(state.sitios.map((s) => [s.id, s]))
  // 1) Espacios: lo que nos cuesta cada sitio que vendimos (costoCompra) por
  //    cada reserva CONFIRMADA. Es el costo de los ingresos reconocidos.
  const costoEspaciosMes = confirmadas.reduce(
    (sum, r) => sum + (sitioPorId.get(r.sitioId)?.costoCompra ?? 0),
    0,
  )
  // 2) Impresión: costo de producir la lona por cada orden de impresión, según
  //    la tarifa de impresión del sitio (solo medios físicos).
  const costoImpresionMes = state.ordenesImpresion.reduce(
    (sum, oi) => sum + (sitioPorId.get(oi.sitioId ?? '')?.tarifaImpresion ?? 0),
    0,
  )
  // 3) Operación: mano de obra de cuadrilla por cada orden de trabajo activa.
  const otsOperativas = state.ordenesTrabajo.filter((o) => o.estatus !== 'CANCELADA')
  const costoOperacionMes = otsOperativas.length * COSTO_OPERATIVO_POR_OT

  const costoTotalMes = costoEspaciosMes + costoImpresionMes + costoOperacionMes

  // Renta a arrendadores: gasto fijo informativo. NO se suma al margen para no
  // duplicar con el costo de compra del espacio (que ya representa ese costo).
  const costoRentaMes = state.contratos
    .filter((c) => c.estatus === 'VIGENTE' || c.estatus === 'POR_VENCER')
    .reduce((s, c) => s + c.montoRenta, 0)

  const margen = ingresoMes - costoTotalMes
  const margenPct = ingresoMes > 0 ? (margen / ingresoMes) * 100 : 0

  const porCobrar = state.cobranzas
    .filter((c) => estadoCobranza(c) !== 'PAGADA')
    .reduce((s, c) => {
      const fac = state.facturas.find((f) => f.id === c.facturaId)
      return s + (fac ? fac.monto - c.montoPagado : 0)
    }, 0)

  const sitiosTotales = state.sitios.length
  const sitiosOcupados = state.sitios.filter(
    (s) => s.estatusComercial === 'OCUPADO',
  ).length
  const ocupacionPct = sitiosTotales > 0 ? (sitiosOcupados / sitiosTotales) * 100 : 0

  return {
    ingresoMes,
    costoEspaciosMes,
    costoImpresionMes,
    costoOperacionMes,
    costoTotalMes,
    costoRentaMes,
    margen,
    margenPct,
    porCobrar,
    ocupacionPct,
    sitiosOcupados,
    sitiosTotales,
    reservasTentativas: tentativas.length,
    reservasConfirmadas: confirmadas.length,
    valorTentativo,
    valorConfirmado,
    alertas: construirAlertas(state),
  }
}

// Margen de UNA campaña con el mismo motor de costos (espacios + impresión +
// operación). Útil en el detalle de campaña y en reportería.
export interface MargenCampana {
  ingreso: number
  costoEspacios: number
  costoImpresion: number
  costoOperacion: number
  costoTotal: number
  margen: number
  margenPct: number
}
export function margenCampana(c: Campana, state: DemoState): MargenCampana {
  const sitioPorId = new Map(state.sitios.map((s) => [s.id, s]))
  const reservas = state.reservas.filter(
    (r) => r.campanaId === c.id && r.estatus !== 'CANCELADA',
  )
  const ingreso = reservas.reduce((s, r) => s + r.precio, 0)
  const costoEspacios = reservas.reduce(
    (s, r) => s + (sitioPorId.get(r.sitioId)?.costoCompra ?? 0),
    0,
  )
  const costoImpresion = state.ordenesImpresion
    .filter((o) => o.campanaId === c.id)
    .reduce((s, o) => s + (sitioPorId.get(o.sitioId ?? '')?.tarifaImpresion ?? 0), 0)
  const ots = state.ordenesTrabajo.filter(
    (o) => o.campanaId === c.id && o.estatus !== 'CANCELADA',
  )
  const costoOperacion = ots.length * COSTO_OPERATIVO_POR_OT
  const costoTotal = costoEspacios + costoImpresion + costoOperacion
  const margen = ingreso - costoTotal
  const margenPct = ingreso > 0 ? (margen / ingreso) * 100 : 0
  return { ingreso, costoEspacios, costoImpresion, costoOperacion, costoTotal, margen, margenPct }
}

// Reporte probatorio de una campaña: contratado vs. entregado + testigos.
export interface ReporteCampana {
  sitiosContratados: number
  sitiosEntregados: number
  cumplimientoPct: number
  testigos: number // fotos comprobatorias (proof-of-play)
  diasContratados: number
}
export function reporteCampana(c: Campana, state: DemoState): ReporteCampana {
  const reservas = state.reservas.filter((r) => r.campanaId === c.id && r.estatus !== 'CANCELADA')
  const sitiosContratados = new Set(reservas.map((r) => r.sitioId)).size
  const ots = state.ordenesTrabajo.filter(
    (o) => o.campanaId === c.id && (o.tipo === 'MONTAJE_LONA' || o.tipo === 'MONTAJE_DIGITAL'),
  )
  const testigos = state.evidencias.filter((e) => ots.some((o) => o.id === e.otId))
  // Un sitio está "entregado" si su OT de montaje está completada o tiene testigo.
  const entregados = new Set<string>()
  for (const o of ots) {
    const tieneTestigo = state.evidencias.some((e) => e.otId === o.id)
    if (o.sitioId && (o.estatus === 'COMPLETADA' || tieneTestigo)) entregados.add(o.sitioId)
  }
  const dias = (a: string, b: string) =>
    Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  const diasContratados = reservas.reduce((s, r) => s + dias(r.fechaInicio, r.fechaFin), 0)
  const sitiosEntregados = entregados.size
  return {
    sitiosContratados,
    sitiosEntregados,
    cumplimientoPct: sitiosContratados > 0 ? (sitiosEntregados / sitiosContratados) * 100 : 0,
    testigos: testigos.length,
    diasContratados,
  }
}

function construirAlertas(state: DemoState): Alerta[] {
  const alertas: Alerta[] = []

  // Pagos de renta vencidos / por vencer
  for (const p of state.pagosRenta) {
    if (p.estatus === 'VENCIDO') {
      const con = state.contratos.find((c) => c.id === p.contratoId)
      const sit = con && state.sitios.find((s) => s.id === con.sitioId)
      alertas.push({
        id: `al-pago-${p.id}`,
        nivel: 'rojo',
        titulo: 'Renta vencida',
        detalle: `${sit?.nombre ?? 'Sitio'} — pago ${p.periodo} sin liquidar`,
      })
    }
  }

  // Contratos por vencer (renovación)
  for (const c of state.contratos) {
    if (c.estatus === 'POR_VENCER') {
      const sit = state.sitios.find((s) => s.id === c.sitioId)
      const dias = diasHasta(c.fechaFin)
      alertas.push({
        id: `al-con-${c.id}`,
        nivel: dias <= 15 ? 'rojo' : 'ambar',
        titulo: 'Contrato por vencer',
        detalle: `${sit?.nombre ?? 'Sitio'} — vence en ${dias} días`,
      })
    }
  }

  // Cobranzas vencidas / por vencer
  for (const cob of state.cobranzas) {
    const est = estadoCobranza(cob)
    if (est === 'VENCIDA' || est === 'POR_VENCER') {
      const fac = state.facturas.find((f) => f.id === cob.facturaId)
      alertas.push({
        id: `al-cob-${cob.id}`,
        nivel: est === 'VENCIDA' ? 'rojo' : 'ambar',
        titulo: est === 'VENCIDA' ? 'Factura vencida' : 'Factura por vencer',
        detalle: `${fac?.folio ?? 'Factura'} — ${formatMonto(fac?.monto ?? 0)}`,
      })
    }
  }

  // Incidencias abiertas que bloquean sitios
  for (const inc of state.incidencias) {
    if (inc.estatus === 'ABIERTA' && inc.impactaComercial) {
      const sit = state.sitios.find((s) => s.id === inc.sitioId)
      alertas.push({
        id: `al-inc-${inc.id}`,
        nivel: 'rojo',
        titulo: 'Sitio bloqueado por incidencia',
        detalle: `${sit?.nombre ?? 'Sitio'} — ${inc.tipo.toLowerCase()}`,
      })
    }
  }

  // Órdenes de trabajo vencidas / por vencer (SLA de cierre en campo). Una OT
  // abierta que pasó su fecha compromiso frena el candado de facturación.
  for (const ot of state.ordenesTrabajo) {
    const sla = estadoSLAOT(ot)
    if (sla !== 'VENCIDA' && sla !== 'POR_VENCER') continue
    const sit = state.sitios.find((s) => s.id === ot.sitioId)
    const dias = diasHasta(ot.fechaProgramada!)
    const sinAsignar = ot.asignadoAUserId ? '' : ' · sin asignar'
    alertas.push({
      id: `al-ot-${ot.id}`,
      nivel: sla === 'VENCIDA' ? 'rojo' : 'ambar',
      titulo: sla === 'VENCIDA' ? 'OT vencida' : 'OT por vencer',
      detalle:
        `${ot.folio} · ${sit?.nombre ?? 'sin sitio'} — ` +
        (sla === 'VENCIDA' ? `venció hace ${Math.abs(dias)} día(s)` : `vence en ${dias} día(s)`) +
        sinAsignar,
    })
  }

  return alertas
}

// ─── SLA de órdenes de trabajo (OT vencida / por vencer) ────────────────────
export type EstadoSLA = 'VENCIDA' | 'POR_VENCER' | 'EN_TIEMPO' | 'SIN_FECHA'

// Estados en los que la OT sigue ABIERTA (aún debe cerrarse en campo).
const OT_ABIERTAS: EstOT[] = ['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'BLOQUEADA', 'EN_REVISION']
export function otAbierta(ot: OrdenTrabajo): boolean {
  return OT_ABIERTAS.includes(ot.estatus)
}

// SLA respecto a la fecha programada (compromiso). Solo aplica a OT abiertas
// con fecha: VENCIDA = el compromiso ya pasó; POR_VENCER = dentro del umbral.
export function estadoSLAOT(ot: OrdenTrabajo, umbralPorVencerDias = 2): EstadoSLA {
  if (!otAbierta(ot) || !ot.fechaProgramada) return 'SIN_FECHA'
  const dias = diasHasta(ot.fechaProgramada)
  if (dias < 0) return 'VENCIDA'
  if (dias <= umbralPorVencerDias) return 'POR_VENCER'
  return 'EN_TIEMPO'
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

export function diasHasta(iso: string): number {
  const ahora = new Date()
  ahora.setHours(0, 0, 0, 0)
  const objetivo = new Date(iso)
  objetivo.setHours(0, 0, 0, 0)
  return Math.round((objetivo.getTime() - ahora.getTime()) / 86_400_000)
}

export function formatMonto(n: number): string {
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Monto compacto para ejes/etiquetas ($ 18.5k).
export function formatMontoCorto(n: number): string {
  if (Math.abs(n) >= 1000) return `$ ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `$ ${n.toFixed(0)}`
}

// Fecha dd/mm/yyyy (formato de la demo).
export function formatFecha(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// dd/mm/yyyy HH:mm — para timestamps (fecha de creación / subida de imágenes).
export function formatFechaHora(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`
}

// ─── Serie de ocupación día/semana/mes (7.1) ────────────────────────────────

export type Granularidad = 'dia' | 'semana' | 'mes'

export interface PuntoOcupacion {
  label: string
  pct: number
  ocupados: number
}

export interface SerieOcupacion {
  puntos: PuntoOcupacion[]
  diasOcupados: number
  diasDisponibles: number
}

const CONFIG_GRAN: Record<Granularidad, { buckets: number; dias: number }> = {
  dia: { buckets: 14, dias: 1 },
  semana: { buckets: 8, dias: 7 },
  mes: { buckets: 6, dias: 30 },
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Ocupación = sitios con reserva CONFIRMADA que solapa el bucket / total sitios.
export function ocupacionSerie(state: DemoState, gran: Granularidad): SerieOcupacion {
  const { buckets, dias } = CONFIG_GRAN[gran]
  const total = state.sitios.length || 1
  const confirmadas = state.reservas.filter((r) => r.estatus === 'CONFIRMADA')
  const inicio = startOfToday()

  const puntos: PuntoOcupacion[] = []
  let diasOcupados = 0
  let diasDisponibles = 0

  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(inicio)
    bStart.setDate(bStart.getDate() + i * dias)
    const bEnd = new Date(bStart)
    bEnd.setDate(bEnd.getDate() + dias - 1)
    bEnd.setHours(23, 59, 59, 999)

    const sitiosOcupados = new Set<string>()
    for (const r of confirmadas) {
      const ri = new Date(r.fechaInicio).getTime()
      const rf = new Date(r.fechaFin).getTime()
      if (ri <= bEnd.getTime() && rf >= bStart.getTime()) sitiosOcupados.add(r.sitioId)
    }
    const ocupados = sitiosOcupados.size
    diasOcupados += ocupados * dias
    diasDisponibles += total * dias

    puntos.push({ label: etiquetaBucket(bStart, gran), pct: (ocupados / total) * 100, ocupados })
  }

  return { puntos, diasOcupados, diasDisponibles }
}

function etiquetaBucket(d: Date, gran: Granularidad): string {
  if (gran === 'mes') {
    return d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')
  }
  if (gran === 'semana') {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}`
  }
  return String(d.getDate())
}

// ─── Disponibilidad futura (calendario de ocupación) ────────────────────────
//  Responde "¿qué tengo libre en septiembre?": cruza las reservas VIGENTES
//  (no canceladas: tentativas + confirmadas) contra una rejilla de periodos
//  (catorcena o mes) y marca cada sitio×periodo como LIBRE / PARCIAL / OCUPADO.
//  Estáticas = ocupación única (solapa → OCUPADO). Digitales = por slots
//  (usados vs total_spots): PARCIAL mientras queden slots, OCUPADO al agotarse.

export type GranDisponibilidad = 'catorcena' | 'mes'
export type EstadoCelda = 'LIBRE' | 'PARCIAL' | 'OCUPADO'

export interface OcupanteCelda {
  campana: string
  estatus: EstReserva // TENTATIVA | CONFIRMADA
  spots: number | null
}
export interface CeldaDisponibilidad {
  estado: EstadoCelda
  ocupantes: OcupanteCelda[]
  spotsUsados: number
  spotsTotal: number | null // capacidad (solo digitales)
}
export interface PeriodoDisponibilidad {
  clave: string
  label: string
  inicio: string // ISO date (solo fecha)
  fin: string // ISO date (solo fecha)
}
export interface FilaDisponibilidad {
  sitioId: string
  nombre: string
  clave: string
  tipoMedio: TipoMedio
  digital: boolean
  totalSpots: number | null
  celdas: CeldaDisponibilidad[]
  libres: number // n.º de periodos LIBRE (para resumen / orden)
}
export interface Disponibilidad {
  periodos: PeriodoDisponibilidad[]
  filas: FilaDisponibilidad[]
  totalSitios: number
}
export interface OpcionesDisponibilidad {
  desde: string // ISO date (YYYY-MM-DD) del inicio de la rejilla
  periodos: number
  gran: GranDisponibilidad
  soloDisponibles?: boolean // deja solo filas con al menos un periodo libre
}

function esDigital(s: Sitio): boolean {
  return (
    s.tipoMedio === 'PANTALLA_DIGITAL' ||
    s.esRotativo ||
    s.exhibicion === 'digital' ||
    s.exhibicion === 'rotativo'
  )
}

function fechaISOsolo(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function construirPeriodos(
  desde: Date,
  cantidad: number,
  gran: GranDisponibilidad,
): PeriodoDisponibilidad[] {
  const periodos: PeriodoDisponibilidad[] = []
  if (gran === 'mes') {
    let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1)
    for (let i = 0; i < cantidad; i++) {
      const ini = new Date(cursor)
      const fin = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) // último día del mes
      periodos.push({
        clave: `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`,
        label: ini.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }).replace('.', ''),
        inicio: fechaISOsolo(ini),
        fin: fechaISOsolo(fin),
      })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  } else {
    const cursor = new Date(desde)
    cursor.setHours(0, 0, 0, 0)
    for (let i = 0; i < cantidad; i++) {
      const ini = new Date(cursor)
      const fin = new Date(cursor)
      fin.setDate(fin.getDate() + 13) // catorcena = 14 días
      periodos.push({
        clave: `c-${fechaISOsolo(ini)}`,
        label: `${ini.getDate()}/${ini.getMonth() + 1}–${fin.getDate()}/${fin.getMonth() + 1}`,
        inicio: fechaISOsolo(ini),
        fin: fechaISOsolo(fin),
      })
      cursor.setDate(cursor.getDate() + 14)
    }
  }
  return periodos
}

export function disponibilidad(state: DemoState, opts: OpcionesDisponibilidad): Disponibilidad {
  const base = new Date(`${opts.desde}T00:00:00`)
  const desde = isNaN(base.getTime()) ? startOfToday() : base
  const periodos = construirPeriodos(desde, Math.max(1, opts.periodos), opts.gran)

  // Bloquean inventario las reservas NO canceladas (tentativas vigentes +
  // confirmadas). Las tentativas vencidas ya las caducó el servidor.
  const activas = state.reservas.filter((r) => r.estatus !== 'CANCELADA')
  const campanaNombre = new Map(state.campanas.map((c) => [c.id, c.nombre]))
  const porSitio = new Map<string, Reserva[]>()
  for (const r of activas) {
    const arr = porSitio.get(r.sitioId)
    if (arr) arr.push(r)
    else porSitio.set(r.sitioId, [r])
  }

  const filas: FilaDisponibilidad[] = state.sitios.map((s) => {
    const digital = esDigital(s)
    const rs = porSitio.get(s.id) ?? []
    let libres = 0
    const celdas: CeldaDisponibilidad[] = periodos.map((p) => {
      const pIni = new Date(`${p.inicio}T00:00:00`).getTime()
      const pFin = new Date(`${p.fin}T23:59:59`).getTime()
      const solapan = rs.filter((r) => {
        const ri = new Date(r.fechaInicio).getTime()
        const rf = new Date(r.fechaFin).getTime()
        return ri <= pFin && rf >= pIni
      })
      const ocupantes: OcupanteCelda[] = solapan.map((r) => ({
        campana: campanaNombre.get(r.campanaId) ?? '—',
        estatus: r.estatus,
        spots: r.spotsReservados,
      }))
      const spotsTotal = digital ? s.totalSpots : null
      let spotsUsados = 0
      let estado: EstadoCelda
      if (digital) {
        // Rotativas/digitales comparten slots. Una reserva sin spots explícitos
        // (venta por paquete, no por spot) ocupa al menos 1 slot = 1 anunciante.
        spotsUsados = solapan.reduce((acc, r) => acc + (r.spotsReservados ?? 1), 0)
        if (solapan.length === 0) estado = 'LIBRE'
        else if (spotsTotal != null && spotsUsados >= spotsTotal) estado = 'OCUPADO'
        else estado = 'PARCIAL' // quedan slots libres
      } else {
        estado = solapan.length > 0 ? 'OCUPADO' : 'LIBRE'
      }
      if (estado === 'LIBRE') libres++
      return { estado, ocupantes, spotsUsados, spotsTotal }
    })
    return {
      sitioId: s.id,
      nombre: s.nombre,
      clave: s.claveInterna || s.codigoProveedor || '',
      tipoMedio: s.tipoMedio,
      digital,
      totalSpots: digital ? s.totalSpots : null,
      celdas,
      libres,
    }
  })

  const filtradas = opts.soloDisponibles ? filas.filter((f) => f.libres > 0) : filas
  return { periodos, filas: filtradas, totalSitios: state.sitios.length }
}
