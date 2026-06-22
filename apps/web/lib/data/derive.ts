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

export interface DashboardMetrics {
  ingresoMes: number
  costoRentaMes: number
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

  const costoRentaMes = state.contratos
    .filter((c) => c.estatus === 'VIGENTE' || c.estatus === 'POR_VENCER')
    .reduce((s, c) => s + c.montoRenta, 0)

  const margen = ingresoMes - costoRentaMes
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

  return alertas
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
