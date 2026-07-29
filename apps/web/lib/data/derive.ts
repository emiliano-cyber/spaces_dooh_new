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
  Propuesta,
  ContratoArrendamiento,
} from './types'

// Orden canónico de las 10 etapas del pipeline (sección 7.4).
export const ETAPAS_PIPELINE: EtapaPipeline[] = [
  'reservada',
  'confirmada',
  'oc_recibida',
  'creativo_recibido',
  'creativo_validado',
  'enviada_dominio',
  'publicada',
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
  enviada_dominio: 'Enviada al dominio',
  publicada: 'Publicada',
  en_imprenta: 'En imprenta',
  en_produccion: 'En producción',
  instalada: 'Instalada / al aire',
  reporte_generado: 'Reporte generado',
  lista_facturar: 'Lista para facturar',
}

// ─── Etapas aplicables a una campaña según su tipo ──────────────────────────
// La revisión de creativo (recibido/validado) y las etapas FÍSICAS son
// excluyentes según el medio:
//   • DOOH (digital): el arte se recibe y aprueba y sale al aire por "Publicada"
//     (DOOHmain). NO hay impresión, producción ni instalación física → se omiten
//     "En imprenta", "En producción" e "Instalada / al aire".
//   • OOH (fija/física): la lona se imprime, produce y monta; NO hay etapa de
//     revisión de creativo → se omiten "Creativo recibido/validado".
//   • HÍBRIDA: tiene ambos flujos, conserva todas las etapas.
const ETAPAS_CREATIVO: EtapaPipeline[] = ['creativo_recibido', 'creativo_validado']
// Publicación al dominio/CMS: solo aplica a medios digitales (DOOH/HÍBRIDA); la
// fija (OOH) no tiene CMS.
const ETAPAS_PUBLICACION: EtapaPipeline[] = ['enviada_dominio', 'publicada']
// Etapas FÍSICAS (impresión, producción, montaje/instalación): solo medios fijos.
const ETAPAS_FISICAS: EtapaPipeline[] = ['en_imprenta', 'en_produccion', 'instalada']
export function etapasPipeline(c: Campana): EtapaPipeline[] {
  if (c.tipoCampana === 'DOOH') {
    return ETAPAS_PIPELINE.filter((e) => !ETAPAS_FISICAS.includes(e))
  }
  if (c.tipoCampana === 'OOH') {
    return ETAPAS_PIPELINE.filter(
      (e) => !ETAPAS_CREATIVO.includes(e) && !ETAPAS_PUBLICACION.includes(e),
    )
  }
  return ETAPAS_PIPELINE
}

// ─── Candado de facturación (regla ÚNICA, por segmento — A-2) ────────────────
// La evidencia se exige SOLO para los segmentos que la campaña realmente tiene:
//   • FÍSICO  (OOH/HÍBRIDA): fotos comprobatorias = testigos de la OT de montaje.
//   • DIGITAL (DOOH/HÍBRIDA): reporte de publicación = proof-of-play con
//     reproducciones reales (o publicación aprobada).
// El candado global es el AND de los segmentos aplicables (una HÍBRIDA exige
// AMBOS: la evidencia física NO da por cumplido lo digital ni viceversa). Una
// campaña 100% física o 100% digital exige solo su único segmento.
//
// Esta es la ÚNICA definición del candado: el gate de facturación del servidor
// (finanzas-repo) también la usa, para no duplicar la regla.
export function candadoDeSegmentos(
  tipoCampana: string,
  f: { ocRecibida: boolean; evidenciaFisica: boolean; evidenciaDigital: boolean },
): boolean {
  if (!f.ocRecibida) return false
  const exigeFisica = tipoCampana === 'OOH' || tipoCampana === 'HIBRIDA'
  const exigeDigital = tipoCampana === 'DOOH' || tipoCampana === 'HIBRIDA'
  return (!exigeFisica || f.evidenciaFisica) && (!exigeDigital || f.evidenciaDigital)
}

export function candadoFacturacion(c: Campana): boolean {
  return candadoDeSegmentos(c.tipoCampana, {
    ocRecibida: c.ocRecibida,
    evidenciaFisica: c.fotosComprobatorias,
    evidenciaDigital: c.reportePublicacion,
  })
}

// ─── Etapa actual del pipeline ──────────────────────────────────────────────
// Devuelve la etapa MÁS avanzada que la campaña ha alcanzado.
export function pipelineStage(c: Campana, state: DemoState): EtapaPipeline {
  // Etapas que aplican a esta campaña según su tipo (digital/fija/híbrida).
  // INVARIANTE: esta función solo puede devolver una etapa contenida en
  // `etapasPipeline(c)`. Si devuelve una que no está, `etapaIndex` da -1 y el
  // Stepper pinta TODOS los pasos como pendientes (ni check ni etapa actual),
  // que es como se veía el pipeline roto en el detalle de campaña.
  const aplica = (e: EtapaPipeline) => etapasPipeline(c).includes(e)

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
  // `instalada` es etapa FÍSICA: una campaña DOOH la excluye de su pipeline
  // aunque tenga OT de MONTAJE_DIGITAL completada. Su avance se expresa por
  // `publicada`, más abajo.
  if (aplica('instalada') && (tieneEvidencia || ots.some((o) => o.estatus === 'COMPLETADA'))) {
    return 'instalada'
  }

  const ois = state.ordenesImpresion.filter((o) => o.campanaId === c.id)
  if (aplica('en_produccion') && ois.some((o) => o.estatus === 'LISTO_MONTAJE' || o.estatus === 'IMPRESO')) {
    return 'en_produccion'
  }
  // "En imprenta" solo aplica a medios físicos (OOH/HÍBRIDA), no a digitales.
  if (aplica('en_imprenta') && ois.length > 0) return 'en_imprenta'

  // Publicación al dominio/CMS (DOOH/HÍBRIDA): "enviada" al mandarse y "publicada"
  // cuando el revisor aprueba (la campaña queda al aire).
  if (aplica('publicada') && c.enviadaDominio && c.validacionEstatus === 'APROBADA') return 'publicada'
  if (aplica('enviada_dominio') && c.enviadaDominio) return 'enviada_dominio'

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
  const i = etapas.indexOf(etapa)
  // Red de seguridad: un -1 se propaga al Stepper como "ningún paso alcanzado"
  // y el pipeline se ve vacío. Si alguna vez vuelve a colarse una etapa que no
  // pertenece a este tipo de campaña, degradamos al primer paso en vez de
  // mostrar un timeline en blanco.
  return i === -1 ? 0 : i
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
  if (c.enviadaDominio && c.enviadaDominioEn) f.enviada_dominio = c.enviadaDominioEn
  if (c.enviadaDominio && c.validacionEstatus === 'APROBADA' && c.validacionEn) {
    f.publicada = c.validacionEn
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

// Saldo vivo de una cobranza. Con parcialidades, el importe a cobrar es el de
// LA CUOTA (`cobranza.monto`), no el de la factura: usar el de la factura en
// cada una multiplicaría la cartera por el número de cuotas — una campaña de
// 120 000 en 12 mensualidades figuraría como 1 440 000 por cobrar.
// `monto` en null = cobro único (histórico): ahí sí manda el total de la factura.
export function saldoCobranza(
  cob: { monto?: number | null; montoPagado: number },
  factura: { monto: number } | undefined,
): number {
  const total = cob.monto != null ? cob.monto : (factura?.monto ?? 0)
  return Math.round((total - cob.montoPagado) * 100) / 100
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

// ─── Totalización por moneda (A-3) ──────────────────────────────────────────
// Suma importes RESPETANDO la moneda. Si todos comparten moneda, devuelve el
// total escalar. Si hay MÁS de una moneda, NO suma 1:1 (eso mezclaría divisas):
// devuelve `total = null`, el desglose `porMoneda` y marca `mixto`. La conversión
// con tipo de cambio queda explícitamente FUERA de scope (decisión pendiente).
export interface TotalPorMoneda {
  mixto: boolean
  moneda: string | null // la moneda única, o null si hay mezcla
  total: number | null // total escalar si la moneda es única; null si es mixto
  porMoneda: Record<string, number>
}
export function totalizarMoneda(
  items: Array<{ monto: number; moneda?: string | null }>,
): TotalPorMoneda {
  const porMoneda: Record<string, number> = {}
  for (const it of items) {
    const m = (typeof it.moneda === 'string' && it.moneda.trim()) || 'MXN'
    porMoneda[m] = (porMoneda[m] ?? 0) + (Number(it.monto) || 0)
  }
  const monedas = Object.keys(porMoneda)
  if (monedas.length <= 1) {
    return { mixto: false, moneda: monedas[0] ?? null, total: monedas.length ? porMoneda[monedas[0]] : 0, porMoneda }
  }
  return { mixto: true, moneda: null, total: null, porMoneda }
}

export interface DashboardMetrics {
  ingresoMes: number
  // Motor de costos (3 fuentes) → costoTotalMes.
  costoEspaciosMes: number   // costo del espacio = renta atribuida del predio (reemplaza costo de compra)
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
  // A-3 · moneda. `moneda` es la moneda única de los importes (o null si hay
  // mezcla). `monedasMixtas` marca que P&L/por-cobrar/costo-renta abarcan más de
  // una divisa: en ese caso los escalares de arriba son un 1:1 NO confiable y la
  // UI debe usar los desgloses `*PorMoneda` (no convertir sin tipo de cambio).
  moneda: string | null
  monedasMixtas: boolean
  ingresoPorMoneda: Record<string, number>
  porCobrarPorMoneda: Record<string, number>
  costoRentaPorMoneda: Record<string, number>
}

// Tipos (categorías) de alerta. Sirven para que el usuario elija en el Dashboard
// cuáles ver en pantalla y cuáles no (todas encendidas por default).
export type TipoAlerta = 'pago' | 'contrato' | 'cobranza' | 'incidencia' | 'ot' | 'licencia'

export interface Alerta {
  id: string
  tipo: TipoAlerta
  nivel: 'rojo' | 'ambar'
  titulo: string
  detalle: string
}

// Margen de aviso para licencias y permisos. Más ancho que el de contratos (90)
// porque renovar ante la autoridad es un trámite, no una firma.
export const DIAS_AVISO_LICENCIA = 120

export const LICENCIA_LABEL: Record<string, string> = {
  MUNICIPAL: 'Licencia municipal',
  AMBIENTAL: 'Permiso ambiental',
  ESTRUCTURAL: 'Dictamen estructural',
  OTRO: 'Permiso',
}

export function dashboardMetrics(state: DemoState): DashboardMetrics {
  const confirmadas = state.reservas.filter((r) => r.estatus === 'CONFIRMADA')
  const tentativas = state.reservas.filter((r) => r.estatus === 'TENTATIVA')
  const ingresoMes = confirmadas.reduce((s, r) => s + r.precio, 0)
  const valorConfirmado = ingresoMes
  const valorTentativo = tentativas.reduce((s, r) => s + r.precio, 0)

  // ── Motor de costos (3 fuentes) ──────────────────────────────────────────
  const sitioPorId = new Map(state.sitios.map((s) => [s.id, s]))
  // 1) Espacios: el costo del espacio es la RENTA atribuida del predio a cada
  //    pantalla vendida (reserva CONFIRMADA). La renta REEMPLAZA al costo de
  //    compra (un solo costo, sin doble conteo). Sin contrato activo ⇒ 0.
  const rentaAtribuida = rentaAtribuidaPorSitio(state)
  const costoEspaciosMes = confirmadas.reduce(
    (sum, r) => sum + (rentaAtribuida.get(r.sitioId) ?? 0),
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

  // Renta a arrendadores: total BRUTO mensual de los contratos activos
  // (informativo). El costo que ENTRA al margen es la renta ATRIBUIDA a las
  // pantallas vendidas (costoEspaciosMes); este bruto NO se suma aparte para no
  // duplicar (la renta ya es el costo del espacio).
  const costoRentaMes = state.contratos
    .filter((c) => contratoActivo(c.estatus))
    .reduce((s, c) => s + rentaAMensual(c.montoRenta, c.periodicidad), 0)

  const margen = ingresoMes - costoTotalMes
  const margenPct = ingresoMes > 0 ? (margen / ingresoMes) * 100 : 0

  const porCobrar = state.cobranzas
    .filter((c) => estadoCobranza(c) !== 'PAGADA')
    .reduce((s, c) => {
      const fac = state.facturas.find((f) => f.id === c.facturaId)
      return s + (fac ? saldoCobranza(c, fac) : 0)
    }, 0)

  // ── Moneda (A-3): desglose por divisa de los agregados de dinero. La reserva
  //    NO guarda moneda: la hereda de su campaña. Factura y contrato sí la traen.
  const monedaCampana = new Map(state.campanas.map((c) => [c.id, c.moneda]))
  const ingresoTot = totalizarMoneda(
    confirmadas.map((r) => ({ monto: r.precio, moneda: monedaCampana.get(r.campanaId) })),
  )
  const porCobrarTot = totalizarMoneda(
    state.cobranzas
      .filter((c) => estadoCobranza(c) !== 'PAGADA')
      .map((c) => {
        const fac = state.facturas.find((f) => f.id === c.facturaId)
        return { monto: fac ? saldoCobranza(c, fac) : 0, moneda: fac?.moneda }
      }),
  )
  const costoRentaTot = totalizarMoneda(
    state.contratos
      .filter((c) => contratoActivo(c.estatus))
      .map((c) => ({ monto: rentaAMensual(c.montoRenta, c.periodicidad), moneda: c.moneda })),
  )
  const monedasPresentes = new Set([
    ...Object.keys(ingresoTot.porMoneda),
    ...Object.keys(porCobrarTot.porMoneda),
    ...Object.keys(costoRentaTot.porMoneda),
  ])
  const monedasMixtas = monedasPresentes.size > 1
  const moneda = monedasMixtas ? null : ([...monedasPresentes][0] ?? null)

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
    moneda,
    monedasMixtas,
    ingresoPorMoneda: ingresoTot.porMoneda,
    porCobrarPorMoneda: porCobrarTot.porMoneda,
    costoRentaPorMoneda: costoRentaTot.porMoneda,
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
  // Costo del espacio = renta atribuida del predio (reemplaza costoCompra).
  const rentaAtribuida = rentaAtribuidaPorSitio(state)
  const costoEspacios = reservas.reduce(
    (s, r) => s + (rentaAtribuida.get(r.sitioId) ?? 0),
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

  const sitioDeContrato = (contratoId: string): string => {
    const con = state.contratos.find((c) => c.id === contratoId)
    const sit = con && state.sitios.find((s) => s.id === con.sitioId)
    return sit?.nombre ?? 'Sitio'
  }

  // Renta vencida: cada pago impago cuyo vencimiento ya pasó.
  for (const p of state.pagosRenta) {
    if (p.estatus === 'VENCIDO') {
      alertas.push({
        id: `al-pago-${p.id}`,
        tipo: 'pago',
        nivel: 'rojo',
        titulo: 'Renta vencida',
        detalle: `${sitioDeContrato(p.contratoId)} — pago ${p.periodo} sin liquidar`,
      })
    }
  }

  // Renta por vencer: se avisa con al menos 3 MESES (90 días) de anticipación.
  // Un solo aviso por contrato (el próximo pago pendiente, anual o mensual).
  const proxPago = new Map<string, (typeof state.pagosRenta)[number]>()
  for (const p of state.pagosRenta) {
    if (p.estatus !== 'PENDIENTE') continue
    const prev = proxPago.get(p.contratoId)
    if (!prev || p.periodo < prev.periodo) proxPago.set(p.contratoId, p)
  }
  for (const p of proxPago.values()) {
    const dias = diasHasta(p.periodo)
    if (dias < 0 || dias > 90) continue
    alertas.push({
      id: `al-pagov-${p.id}`,
      tipo: 'pago',
      nivel: dias <= 15 ? 'rojo' : 'ambar',
      titulo: 'Renta por vencer',
      detalle: `${sitioDeContrato(p.contratoId)} — vence en ${dias} días (${formatMonto(p.monto)})`,
    })
  }

  // Contratos: incompletos, por vencer (a 3 meses) y vencidos.
  for (const c of state.contratos) {
    const sit = state.sitios.find((s) => s.id === c.sitioId)
    // Pendiente de captura: la pantalla se vendió pero no consta qué se le paga
    // a su propietario, así que su margen sale inflado (ADR 0001). Sin esta
    // alerta el contrato incompleto se queda en Arrendadores sin que nadie lo
    // cierre.
    if (c.estatus === 'INCOMPLETO') {
      alertas.push({
        id: `al-coninc-${c.id}`,
        tipo: 'contrato',
        nivel: 'ambar',
        titulo: 'Contrato incompleto',
        detalle: `${sit?.nombre ?? 'Sitio'} — falta arrendador e importe de renta`,
      })
    } else if (c.estatus === 'POR_VENCER' && c.fechaFin) {
      const dias = diasHasta(c.fechaFin)
      alertas.push({
        id: `al-con-${c.id}`,
        tipo: 'contrato',
        nivel: dias <= 30 ? 'rojo' : 'ambar',
        titulo: 'Contrato por vencer',
        detalle: `${sit?.nombre ?? 'Sitio'} — vence en ${dias} días`,
      })
    } else if (c.estatus === 'VENCIDO' && c.fechaFin) {
      const dias = Math.abs(diasHasta(c.fechaFin))
      alertas.push({
        id: `al-conv-${c.id}`,
        tipo: 'contrato',
        nivel: 'rojo',
        titulo: 'Contrato vencido',
        detalle: `${sit?.nombre ?? 'Sitio'} — venció hace ${dias} días`,
      })
    }
  }

  // Licencias y permisos por vencer o vencidos (F-2 de la auditoría).
  //
  // Un permiso vencido AVISA pero NO bloquea la venta. Es decisión del dueño del
  // producto: bloquear en automático frenaría ventas cuando el permiso ya está
  // renovado pero todavía no capturado, que es el caso más frecuente.
  //
  // El umbral es más ancho que el de los contratos (120 días contra 90) porque un
  // trámite ante la autoridad tarda: enterarse con un mes de margen no alcanza
  // para renovarlo a tiempo.
  for (const l of state.licencias ?? []) {
    const dias = diasHasta(l.fechaVencimiento)
    if (dias > DIAS_AVISO_LICENCIA) continue
    // A quién ampara: el predio —y con él todas sus pantallas— o una suelta.
    const donde = l.predioId
      ? state.predios.find((p) => p.id === l.predioId)?.nombre
      : state.sitios.find((s) => s.id === l.sitioId)?.nombre
    const que = `${LICENCIA_LABEL[l.tipo] ?? 'Permiso'}${l.folio ? ` ${l.folio}` : ''}`
    alertas.push(
      dias < 0
        ? {
            id: `al-licv-${l.id}`,
            tipo: 'licencia',
            nivel: 'rojo',
            titulo: 'Licencia vencida',
            detalle: `${donde ?? 'Ubicación'} — ${que} venció hace ${Math.abs(dias)} días`,
          }
        : {
            id: `al-lic-${l.id}`,
            tipo: 'licencia',
            nivel: dias <= 30 ? 'rojo' : 'ambar',
            titulo: 'Licencia por vencer',
            detalle: `${donde ?? 'Ubicación'} — ${que} vence en ${dias} días`,
          },
    )
  }

  // Cobertura: lo vendido no puede exceder lo contratado con el propietario.
  // Al generar la campaña debe existir un contrato que abarque TODO el periodo
  // vendido (ADR 0001). Si la reserva termina después de que vence el contrato
  // del sitio, estamos comprometiendo con el cliente un espacio sobre el que ya
  // no tendremos derechos: hay que renovar antes o recortar la campaña.
  // Se agrupa por sitio para no repetir la misma alerta por cada reserva.
  const descubiertos = new Map<string, { sitio: string; campana: string; hasta: string; fin: string | null }>()
  for (const r of state.reservas) {
    if (r.estatus === 'CANCELADA') continue
    // Contrato de referencia: el que cubre más lejos entre los que valen hoy.
    // Un INCOMPLETO cuenta como cobertura porque la campaña ya lo estiró hasta
    // su fin; lo que le falta (importe, arrendador) lo denuncia su propia alerta.
    const suyos = state.contratos.filter(
      (c) => c.sitioId === r.sitioId && (contratoActivo(c.estatus) || c.estatus === 'INCOMPLETO'),
    )
    if (!suyos.length) continue // sin contrato: ya lo cubre «Contrato incompleto»
    const cubreHasta = suyos
      .map((c) => c.fechaFin)
      .filter(Boolean)
      .sort()
      .at(-1) as string | undefined
    if (cubreHasta && cubreHasta.slice(0, 10) >= r.fechaFin.slice(0, 10)) continue
    const sit = state.sitios.find((s) => s.id === r.sitioId)
    const camp = state.campanas.find((c) => c.id === r.campanaId)
    const prev = descubiertos.get(r.sitioId)
    if (!prev || r.fechaFin > prev.hasta) {
      descubiertos.set(r.sitioId, {
        sitio: sit?.nombre ?? 'Sitio',
        campana: camp?.nombre ?? 'campaña',
        hasta: r.fechaFin,
        fin: cubreHasta ?? null,
      })
    }
  }
  for (const [sitioId, d] of descubiertos) {
    alertas.push({
      id: `al-cobertura-${sitioId}`,
      tipo: 'contrato',
      nivel: 'rojo',
      titulo: 'El contrato no cubre la campaña',
      detalle: `${d.sitio} — «${d.campana}» va hasta ${formatFecha(d.hasta)} y el contrato ${
        d.fin ? `vence el ${formatFecha(d.fin)}` : 'no tiene fecha de fin'
      }`,
    })
  }

  // Cobranzas vencidas / por vencer
  for (const cob of state.cobranzas) {
    const est = estadoCobranza(cob)
    if (est === 'VENCIDA' || est === 'POR_VENCER') {
      const fac = state.facturas.find((f) => f.id === cob.facturaId)
      alertas.push({
        id: `al-cob-${cob.id}`,
        tipo: 'cobranza',
        nivel: est === 'VENCIDA' ? 'rojo' : 'ambar',
        titulo: est === 'VENCIDA' ? 'Factura vencida' : 'Factura por vencer',
        detalle: `${fac?.folio ?? 'Factura'} — ${formatMonto(fac?.monto ?? 0)}`,
      })
    }
  }

  // Pantallas en pausa legal (fuera de disponibilidad comercial)
  for (const s of state.sitios) {
    if (s.pausaLegal) {
      alertas.push({
        id: `al-pausa-${s.id}`,
        tipo: 'incidencia',
        nivel: 'rojo',
        titulo: 'Pantalla en pausa legal',
        detalle: `${s.nombre}${s.motivoPausaLegal ? ` — ${s.motivoPausaLegal}` : ''}`,
      })
    }
  }

  // Incidencias abiertas que bloquean sitios
  for (const inc of state.incidencias) {
    if (inc.estatus === 'ABIERTA' && inc.impactaComercial) {
      const sit = state.sitios.find((s) => s.id === inc.sitioId)
      alertas.push({
        id: `al-inc-${inc.id}`,
        tipo: 'incidencia',
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
      tipo: 'ot',
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

// ─── Funnel comercial (propuestas: enviadas → aprobadas → perdidas) ─────────
export interface FunnelPropuestas {
  total: number
  borrador: number
  enviadas: number
  aprobadas: number
  rechazadas: number
  pipelineValue: number // $ en vuelo (borrador + enviada), por total c/IVA
  ganadoValue: number // $ de aprobadas
  perdidoValue: number // $ de rechazadas
  winRate: number | null // aprobadas / (aprobadas + rechazadas)
  conversion: number | null // aprobadas / (propuestas que salieron al cliente)
}

// Agrega las propuestas por estado y calcula win rate + valor de pipeline.
export function funnelPropuestas(props: Propuesta[]): FunnelPropuestas {
  let borrador = 0, enviadas = 0, aprobadas = 0, rechazadas = 0
  let pipelineValue = 0, ganadoValue = 0, perdidoValue = 0
  for (const p of props) {
    switch (p.estatus) {
      case 'BORRADOR': borrador++; pipelineValue += p.total; break
      case 'ENVIADA': enviadas++; pipelineValue += p.total; break
      case 'APROBADA': aprobadas++; ganadoValue += p.total; break
      case 'RECHAZADA': rechazadas++; perdidoValue += p.total; break
    }
  }
  const cerradas = aprobadas + rechazadas
  const tocadas = enviadas + aprobadas + rechazadas // salieron al cliente alguna vez
  return {
    total: props.length,
    borrador, enviadas, aprobadas, rechazadas,
    pipelineValue, ganadoValue, perdidoValue,
    winRate: cerradas > 0 ? aprobadas / cerradas : null,
    conversion: tocadas > 0 ? aprobadas / tocadas : null,
  }
}

// ─── Rentabilidad por pantalla (ingreso vs renta de arrendador) ─────────────
export interface MargenSitio {
  sitioId: string
  nombre: string
  clave: string
  rentaMensual: number // renta ATRIBUIDA del predio a esta pantalla (mensual; 0 si no hay contrato activo)
  ingresoMensual: number // ingreso de reservas activas hoy en el sitio
  margenMensual: number // ingreso − renta atribuida
  tieneContrato: boolean
  arrendador: string | null
  activo: boolean // ¿tiene reserva vigente hoy?
}

// Normaliza el monto de renta a mensual según la periodicidad del contrato.
// Enum canónico (M3): SEMANAL ×30/7 · CATORCENAL ×30/14 · QUINCENAL ×2 ·
// MENSUAL ×1 · BIMESTRAL ÷2 · TRIMESTRAL ÷3 · SEMESTRAL ÷6 · ANUAL ÷12.
// Acepta nulos porque un contrato INCOMPLETO todavía no tiene importe ni
// periodicidad (ver ADR 0001). Aporta 0 al costo: un pendiente de captura no es
// un costo conocido, y suponerle un valor falsearía el margen en la otra
// dirección. Los llamadores ya filtran por `contratoActivo`, que excluye
// INCOMPLETO; esto es la red de seguridad por si alguno deja de hacerlo.
function rentaAMensual(monto: number | null, periodicidad: string | null): number {
  if (monto == null) return 0
  const F: Record<string, number> = {
    SEMANAL: 30 / 7, CATORCENAL: 30 / 14, QUINCENAL: 2, MENSUAL: 1,
    BIMESTRAL: 1 / 2, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12,
  }
  const p = (periodicidad || '').toUpperCase()
  if (p in F) return monto * F[p]
  // Compat con etiquetas legacy (minúsculas / otros idiomas).
  const per = p.toLowerCase()
  if (per.includes('anu') || per.includes('año') || per.includes('year')) return monto / 12
  if (per.includes('semestr')) return monto / 6
  if (per.includes('trimestr')) return monto / 3
  if (per.includes('bimestr')) return monto / 2
  if (per.includes('catorc')) return monto * (30 / 14)
  if (per.includes('quinc')) return monto * 2
  if (per.includes('seman')) return monto * (30 / 7)
  if (per.includes('dia')) return monto * 30
  return monto // mensual por defecto
}

// ¿El contrato está activo (representa un costo de renta real hoy)?
function contratoActivo(estatus: string): boolean {
  return estatus === 'VIGENTE' || estatus === 'POR_VENCER' || estatus === 'RENOVADO'
}

// Contrato que gobierna cada pantalla. Hay DOS anclajes posibles y son
// EXCLUYENTES entre sí:
//
//   · Pantalla que pertenece a un PREDIO → manda el contrato del predio, que es
//     el mismo para todas sus pantallas (un predio, un contrato).
//   · Pantalla SUELTA (sin predio) → su propio contrato, anclado a ella.
//
// El discriminador es `predioId`, nunca `sitioId`: un contrato de predio TAMBIÉN
// trae `sitioId` —la columna es NOT NULL y conserva una pantalla del predio por
// histórico—, así que resolver por `sitioId` primero contaría el mismo contrato
// dos veces y le cobraría la renta completa a una de las caras.
//
// Si una pantalla con predio arrastrara además un contrato propio (los crea el
// flujo de propuesta cuando no encuentra cobertura), gana el del predio: es la
// regla del negocio y de paso evita sumar la renta dos veces.
export function contratoVigentePorSitio(state: DemoState): Map<string, ContratoArrendamiento> {
  const mayorRenta = (a: ContratoArrendamiento, b: ContratoArrendamiento) =>
    rentaAMensual(a.montoRenta, a.periodicidad) >= rentaAMensual(b.montoRenta, b.periodicidad) ? a : b

  const porPredio = new Map<string, ContratoArrendamiento>()
  const porPantalla = new Map<string, ContratoArrendamiento>()
  for (const c of state.contratos) {
    if (!contratoActivo(c.estatus)) continue
    if (c.predioId) {
      // No debería haber dos activos en el mismo predio (lo impide el índice
      // `contratos_predio_activo_uq`); si los hubiera, el de mayor renta.
      const prev = porPredio.get(c.predioId)
      porPredio.set(c.predioId, prev ? mayorRenta(prev, c) : c)
    } else if (c.sitioId) {
      // Pantalla suelta. Aquí NO hay índice único que lo garantice todavía, así
      // que la desempata la misma regla conservadora: la renta mayor.
      const prev = porPantalla.get(c.sitioId)
      porPantalla.set(c.sitioId, prev ? mayorRenta(prev, c) : c)
    }
  }

  const out = new Map<string, ContratoArrendamiento>()
  for (const s of state.sitios) {
    // Manda el contrato del predio. Si el predio NO tiene contrato pero la
    // pantalla arrastra uno propio, vale ese: el flujo de propuesta crea
    // contratos VIGENTES con importe y sin predio (`campanas-repo.ts`, la renta
    // que se captura en la propuesta), y descartarlos volvería a dejar renta
    // real fuera del P&L. Nunca se suman los dos: si el predio tiene contrato,
    // el propio de la pantalla se ignora.
    const c = (s.predioId ? porPredio.get(s.predioId) : undefined) ?? porPantalla.get(s.id)
    if (c) out.set(s.id, c)
  }
  return out
}

// Renta mensual ATRIBUIDA a cada pantalla:
//   · Contrato de predio → se reparte entre las caras del predio:
//       rentaAtribuida = rentaMensual × (caras_pantalla / Σ caras del predio).
//   · Contrato de pantalla suelta → la renta ÍNTEGRA es de esa pantalla. No se
//     divide entre sus caras: las caras son lados de la MISMA pantalla, no
//     pantallas distintas entre las que repartir.
// Sin contrato activo ⇒ 0. NUNCA usa costoCompra: la renta ES el costo del
// espacio (un solo costo, sin doble conteo).
export function rentaAtribuidaPorSitio(state: DemoState): Map<string, number> {
  const contratoDe = contratoVigentePorSitio(state)
  // Σ caras por predio: solo hace falta para repartir un contrato de predio.
  const carasPredio = new Map<string, number>()
  for (const s of state.sitios) {
    if (!s.predioId) continue
    carasPredio.set(s.predioId, (carasPredio.get(s.predioId) ?? 0) + (s.caras || 1))
  }
  const out = new Map<string, number>()
  for (const s of state.sitios) {
    const c = contratoDe.get(s.id)
    if (!c) { out.set(s.id, 0); continue }
    const renta = rentaAMensual(c.montoRenta, c.periodicidad)
    // Quien decide si la renta se reparte es el ANCLAJE DEL CONTRATO, no el
    // predio de la pantalla: un contrato sin predio cubre solo a esta pantalla,
    // aunque ella pertenezca a un predio. Repartirlo entre las caras del predio
    // le cobraría a pantallas que ese contrato no cubre.
    if (!c.predioId) { out.set(s.id, renta); continue }
    const total = carasPredio.get(c.predioId) ?? 0
    out.set(s.id, total > 0 ? renta * ((s.caras || 1) / total) : 0)
  }
  return out
}

// Margen mensual por pantalla: ingreso de las reservas vigentes hoy menos la
// renta del arrendador. Responde "¿qué pantallas ganan y cuáles matar?".
export function margenPorSitio(state: DemoState): MargenSitio[] {
  const hoy = startOfToday().getTime()
  const activasPorSitio = new Map<string, number>()
  for (const r of state.reservas) {
    if (r.estatus === 'CANCELADA') continue
    const ini = new Date(r.fechaInicio).getTime()
    const fin = new Date(r.fechaFin).getTime()
    if (ini <= hoy && fin >= hoy) {
      activasPorSitio.set(r.sitioId, (activasPorSitio.get(r.sitioId) ?? 0) + r.precio)
    }
  }
  // Renta atribuida por pantalla (contrato de predio repartido entre sus caras,
  // o contrato propio de la pantalla suelta).
  const rentaAtribuida = rentaAtribuidaPorSitio(state)
  // MISMA resolución que la renta: si aquí se buscara solo por predio, una
  // pantalla suelta con contrato propio saldría con `tieneContrato: false` —
  // diciendo que no hay contrato cuando sí lo hay, y sin arrendador a quién pagar.
  const contratoDe = contratoVigentePorSitio(state)

  return state.sitios.map((s) => {
    const con = contratoDe.get(s.id) ?? null
    // rentaMensual = renta del predio ATRIBUIDA a esta pantalla (no la renta completa).
    const rentaMensual = rentaAtribuida.get(s.id) ?? 0
    const arr = con ? state.arrendadores.find((a) => a.id === con.arrendadorId) : null
    const ingresoMensual = activasPorSitio.get(s.id) ?? 0
    return {
      sitioId: s.id,
      nombre: s.nombre,
      clave: s.claveInterna || s.codigoProveedor || '',
      rentaMensual: Math.round(rentaMensual),
      ingresoMensual: Math.round(ingresoMensual),
      margenMensual: Math.round(ingresoMensual - rentaMensual),
      tieneContrato: !!con,
      arrendador: arr?.nombre ?? null,
      activo: ingresoMensual > 0,
    }
  })
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

export function diasHasta(iso: string): number {
  const ahora = new Date()
  ahora.setHours(0, 0, 0, 0)
  // Todo lo que llega aquí es una fecha de CALENDARIO —vigencia de un contrato,
  // periodo de un pago, vencimiento de un permiso—, nunca un instante.
  //
  // `new Date('2026-07-17')` la interpreta como medianoche UTC. En México (UTC−6)
  // eso cae a las 18:00 del día ANTERIOR en hora local, y el `setHours(0,0,0,0)`
  // de después la dejaba en el día 16: la cuenta salía corrida un día. Se veía en
  // los avisos —«venció hace 13 días» cuando habían pasado 12— y también en los
  // contratos, donde uno vencido ayer decía «hace 0 días».
  //
  // Por eso se toman los diez primeros caracteres (`YYYY-MM-DD`, que es lo que
  // guardó la base) y se construye la fecha en hora LOCAL. Vale igual para el
  // formato corto y para el timestamp completo que devuelve el driver.
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const objetivo =
    a && m && d ? new Date(a, m - 1, d) : new Date(iso)
  objetivo.setHours(0, 0, 0, 0)
  return Math.round((objetivo.getTime() - ahora.getTime()) / 86_400_000)
}

// Etiqueta del medio para la UI: "Digital" (vende slots) o "Fija" (vende lona).
// OJO: esta es la regla de PRESENTACIÓN y es más amplia que la de BOOKING
// (`esDigital`, abajo), que por S0-3 solo considera digital a PANTALLA_DIGITAL:
// un rotativo sobre estructura estática se muestra como digital pero se reserva
// como fijo. Hoy no hay ninguna pantalla así, pero si la hubiera, las dos reglas
// difieren a propósito. No las unifiques sin decidir antes cuál gana.
export function medioLabel(s: Pick<Sitio, 'tipoMedio' | 'esRotativo' | 'exhibicion'>): string {
  const digital =
    s.tipoMedio === 'PANTALLA_DIGITAL' ||
    !!s.esRotativo ||
    s.exhibicion === 'digital' ||
    s.exhibicion === 'rotativo'
  return digital ? 'Digital' : 'Fija'
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

// S0-3: el TIPO DE MEDIO gobierna las reglas de booking. Solo las pantallas
// digitales (PANTALLA_DIGITAL) manejan concurrencia por slots; todo lo demás
// (espectacular, valla, mural…) es estático = 1 cara = reserva exclusiva.
// La exhibición 'rotativo' sobre una estructura estática ya NO la vuelve digital.
function esDigital(s: Sitio): boolean {
  return s.tipoMedio === 'PANTALLA_DIGITAL'
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
