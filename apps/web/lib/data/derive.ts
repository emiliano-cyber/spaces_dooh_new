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
import { factorMensual, diasAvisoPago, diasCriticoPago } from '../renta-periodicidad'

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
  // Ocupación de la red PONDERADA por capacidad: un slot digital y una cara fija
  // valen un espacio cada uno (ver `ocupacionRed`). No es el % de pantallas con
  // algo vendido — ese dato es `sitiosOcupados/sitiosTotales`, más abajo.
  ocupacionPct: number
  sitiosOcupados: number
  sitiosTotales: number
  espaciosOcupados: number // slots digitales vendidos + caras fijas tomadas
  capacidadRed: number     // slots de las digitales + 1 por cada fija
  ocupacionDigitales: { sitios: number; ocupados: number; capacidad: number }
  ocupacionFijas: { sitios: number; ocupados: number; capacidad: number }
  sinSlotsCapturados: number // digitales sin slots capturados (entran valiendo 1)
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

// ─── Vigencia por fechas vs estado guardado (A-1 de la auditoría QA) ────────
// `estadoComercial` refleja el FLUJO (confirmar, publicar, facturar), no el
// calendario, así que nadie lo mueve cuando pasa la fecha fin: la auditoría vio
// campañas "Activa" terminadas hace días y "Completada" con vigencia hasta 2028.
//
// No se toca el estado guardado: COMPLETADA condiciona la facturación y
// reescribirlo desde un job puede dar por entregado algo que nunca se entregó.
// Lo que sí se puede es dejar de AFIRMAR algo falso: se deriva la vigencia real
// y se marca la incoherencia para que la pantalla la muestre.
export type VigenciaCampana = 'por_empezar' | 'vigente' | 'vencida'

export function vigenciaCampana(
  c: { fechaInicio: string; fechaFin: string },
  hoy: Date = startOfToday(),
): VigenciaCampana {
  const ini = new Date(c.fechaInicio).getTime()
  const fin = new Date(c.fechaFin).getTime()
  const hoyMs = hoy.getTime()
  if (Number.isNaN(ini) || Number.isNaN(fin)) return 'vigente'
  if (hoyMs < ini) return 'por_empezar'
  // El día de fin cuenta completo: una campaña que termina hoy sigue vigente.
  if (hoyMs > fin + 86_399_999) return 'vencida'
  return 'vigente'
}

// ¿El estado guardado contradice al calendario? Solo los dos casos que un
// usuario percibe como error; el resto de combinaciones son legítimas (una
// CANCELADA vencida no es incoherente, por ejemplo).
export function estadoContradiceFechas(c: {
  estadoComercial: string
  fechaInicio: string
  fechaFin: string
}): boolean {
  const v = vigenciaCampana(c)
  if (c.estadoComercial === 'ACTIVA' && v === 'vencida') return true
  if (c.estadoComercial === 'COMPLETADA' && v !== 'vencida') return true
  return false
}

// ─── Comisión → divisor: el neto NUNCA es negativo (C-2 de la auditoría QA) ─
// Ojo con el nombre heredado: `divisor` MULTIPLICA (neto = bruto × divisor).
// Se calculaba como `1 - comisionPct/100` sin acotar, así que una comisión de
// 150% daba -0.5 y el neto salía NEGATIVO: así nació la campaña TEST_EdgeCase
// con -135 333.33, que además contaminaba los KPI del dashboard sumándose.
//
// Una comisión ≥ 100% significa que la agencia se lleva todo: el neto es CERO,
// nunca negativo. Acotar aquí es defensa en profundidad — el alta ya valida el
// rango (propuestas-controller), pero las filas viejas siguen en la BD y se
// leen en cada listado.
export function divisorDeComision(comisionPct: number | null | undefined): number {
  const pct = Number(comisionPct)
  if (!Number.isFinite(pct) || pct <= 0) return 1
  return Math.max(0, 1 - pct / 100)
}

// ─── Tarifa de un sitio: una sola fuente (A-8 de la auditoría QA) ───────────
// `sitios` arrastra DOS columnas para el mismo número, en la MISMA unidad:
// `tarifaPublicada` (la que mantienen las modalidades y la ficha) y
// `tarifaMensual` (heredada). Al editar la ficha se escriben ambas, pero las
// filas cargadas por importación quedaron descuadradas: tres pantallas de G500
// tenían 45 000 en `tarifaMensual` y 85 000 en `tarifaPublicada`. Comercial leía
// la primera y Network la segunda, así que el vendedor cotizaba a un precio y el
// dueño veía otro para la misma pantalla.
//
// `tarifaPublicada` manda: es la que respaldan las modalidades por unidad.
// `tarifaMensual` queda solo como respaldo para filas que aún no la tengan.
export function tarifaDeSitio(s: { tarifaPublicada?: number | null; tarifaMensual?: number | null }): number {
  return Number(s.tarifaPublicada) || Number(s.tarifaMensual) || 0
}

// ─── Rangos del filtro de precio (M-6 de la auditoría QA) ───────────────────
// Comercial ofrecía «≤ $8k · ≤ $15k · ≤ $25k» escritos a mano mientras TODO el
// inventario está en $45 000+: las tres opciones devolvían cero resultados, así
// que el filtro no filtraba — aparentaba un inventario vacío. Arreglar contra
// qué columna comparaba (A-8) no tocó esto: los rangos seguían inventados.
//
// Los cortes salen ahora de la distribución REAL, igual que la lista de
// distritos del mismo formulario sale de los sitios y no de un catálogo escrito
// aparte. Se toman tres cuartiles y no un reparto en partes iguales entre el
// mínimo y el máximo: con nueve pantallas a 45 000 y tres a 85 000, el reparto
// uniforme deja dos cortes en una franja donde no hay nada.
//
// Dos garantías, y las dos importan porque su ausencia ES el hallazgo:
//
//   · cada corte DEVUELVE algo — sale de un valor que existe en la lista y solo
//     se redondea hacia ARRIBA, así que el sitio que lo originó siempre entra;
//   · cada corte EXCLUYE algo — los que llegan al máximo se descartan, porque
//     una opción que no quita nada es «Cualquier precio» con otro nombre.
//
// Si no queda ningún corte que cumpla las dos (un solo sitio, o todos al mismo
// precio) se devuelve la lista vacía y el filtro no se pinta. Es el mismo
// criterio que el paginador de M-7: un control que no puede cambiar lo que se
// ve es ruido, y además sugiere que hay más datos de los que hay.
export function rangosDePrecio(tarifas: number[]): number[] {
  const vals = tarifas.filter((t) => Number.isFinite(t) && t > 0).sort((a, b) => a - b)
  if (vals.length < 2) return []
  const max = vals[vals.length - 1]
  const brutos = [0.25, 0.5, 0.75].map(
    (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))],
  )

  // El redondeo se prueba de la cifra más redonda a la más fina, y se toma la
  // PRIMERA que deje algún corte en pie. Sin esto, un inventario caro y muy
  // junto —cuatro pantallas entre 1.2M y 1.45M— sube los tres cuartiles al
  // mismo 1.5M, que supera al máximo y se descarta: los tres cortes mueren y el
  // filtro no se pinta, pese a haber dispersión de sobra para filtrar. Bajar la
  // finura solo cuando hace falta deja intacto el caso normal.
  for (const finura of [1, 5, 25]) {
    const cortes: number[] = []
    for (const bruto of brutos) {
      const corte = redondearACifraLegible(bruto, finura)
      if (corte < max && !cortes.includes(corte)) cortes.push(corte)
    }
    if (cortes.length > 0) return cortes
  }
  return []
}

// Un cuartil crudo es «$46,333.33», que en un desplegable se lee como un error
// de cálculo. Se sube al múltiplo legible más cercano, con el paso escalado a la
// magnitud (5 000 en decenas de miles, 500 en miles) para no redondear 8 200 a
// 50 000, y dividido por `finura` cuando el paso grande resulta demasiado basto
// para la dispersión que hay. SIEMPRE hacia arriba: hacia abajo el corte podría
// caer por debajo del valor que lo originó y dejar la opción en cero
// resultados, que es justo el defecto que esto viene a quitar.
function redondearACifraLegible(v: number, finura: number): number {
  const paso = Math.max(1, (Math.pow(10, Math.floor(Math.log10(v)) - 1) * 5) / finura)
  return Math.ceil(v / paso) * paso
}

// ─── Ocupación: una sola definición (A-2 de la auditoría QA) ────────────────
// Un sitio está ocupado HOY si tiene una reserva CONFIRMADA que cubre el día.
// Es la MISMA regla que usa `ocupacionSerie` para la gráfica y la que refleja
// Disponibilidad. Antes el KPI contaba `estatusComercial === 'OCUPADO'`, una
// columna almacenada que ninguna ruta de reserva digital deja en ese valor
// (las digitales quedan en 'RESERVADO' salvo que se agoten los spots): el
// resultado era "Ocupación 0% · 0 de 12" junto a una gráfica marcando 42%.
export function sitiosOcupadosHoy(state: DemoState): Set<string> {
  const inicioDia = startOfToday().getTime()
  const finDia = inicioDia + 86_400_000 - 1
  const conReserva = new Set<string>()
  for (const r of state.reservas) {
    if (r.estatus !== 'CONFIRMADA') continue
    const ri = new Date(r.fechaInicio).getTime()
    const rf = new Date(r.fechaFin).getTime()
    if (ri <= finDia && rf >= inicioDia) conReserva.add(r.sitioId)
  }
  // Solo sitios que existen en el estado: una reserva puede apuntar a un sitio
  // dado de baja, y contarlo inflaría la ocupación por encima del 100%.
  return new Set(state.sitios.filter((s) => conReserva.has(s.id)).map((s) => s.id))
}

// ─── Ocupación de la red: ponderada por capacidad ───────────────────────────
// Contar "pantallas ocupadas / pantallas totales" mezcla dos inventarios que no
// se venden igual. Un espectacular es UNA cara: se toma entero o no se toma.
// Una pantalla digital se vende por slots: 3 campañas en una de 12 dejan 9
// slots vendibles. Con el conteo por pantalla, esa digital marcaba lo mismo que
// el espectacular —100% ocupada— y el KPI de la red se disparaba.
//
//   capacidad = Σ digitales(totalSpots) + Σ fijas(1)
//   ocupado   = Σ digitales(campañas distintas vigentes, tope totalSpots)
//             + Σ fijas(1 si tiene reserva vigente)
//
// La unidad del lado digital son CAMPAÑAS DISTINTAS, no `spotsReservados`. Dos
// razones: es la misma unidad con la que el servidor decide si aún se puede
// vender (`campanas-repo.ts`, "1 slot = 1 campaña"), y `spotsReservados` no es
// fiable como medida de ocupación —el diálogo de reserva manda por defecto
// TODOS los spots libres, así que una sola campaña dejaría la pantalla al 100%.
//
// Sigue valiendo la regla A-2: solo cuentan las reservas CONFIRMADAS que cubren
// la ventana. Reservar no es vender.
export interface OcupacionRed {
  /** 0–100, ponderado por capacidad. */
  pct: number
  /** Espacios vendidos: slots digitales ocupados + caras fijas tomadas. */
  ocupados: number
  /** Espacios vendibles de toda la red. */
  capacidad: number
  /** Pantallas con al menos un espacio vendido (para el subtítulo del KPI). */
  sitiosOcupados: number
  sitiosTotales: number
  digitales: { sitios: number; ocupados: number; capacidad: number }
  fijas: { sitios: number; ocupados: number; capacidad: number }
  /** Digitales sin `totalSpots` capturado: entran valiendo 1 y se reportan. */
  sinSlots: number
}

// Una digital sin slots capturados no se puede ponderar. Se cuenta como un solo
// espacio (el trato más conservador: nunca infla la capacidad de la red) y se
// devuelve el número aparte para poder decirlo en la UI en vez de esconderlo.
const CAPACIDAD_SIN_SLOTS = 1

export function ocupacionRed(
  state: DemoState,
  ventana?: { desde: number; hasta: number },
): OcupacionRed {
  const desde = ventana?.desde ?? startOfToday().getTime()
  const hasta = ventana?.hasta ?? desde + 86_400_000 - 1

  // Campañas distintas por sitio. Dos reservas de la MISMA campaña sobre la
  // misma pantalla (p. ej. dos tramos de fechas) ocupan un slot, no dos.
  const campanasPorSitio = new Map<string, Set<string>>()
  for (const r of state.reservas) {
    if (r.estatus !== 'CONFIRMADA') continue
    const ri = new Date(r.fechaInicio).getTime()
    const rf = new Date(r.fechaFin).getTime()
    if (ri > hasta || rf < desde) continue
    let set = campanasPorSitio.get(r.sitioId)
    if (!set) campanasPorSitio.set(r.sitioId, (set = new Set()))
    set.add(r.campanaId || r.id)
  }

  const digitales = { sitios: 0, ocupados: 0, capacidad: 0 }
  const fijas = { sitios: 0, ocupados: 0, capacidad: 0 }
  let sitiosOcupados = 0
  let sinSlots = 0

  for (const s of state.sitios) {
    const vendidas = campanasPorSitio.get(s.id)?.size ?? 0
    if (esDigital(s)) {
      const slots = s.totalSpots != null && s.totalSpots > 0 ? s.totalSpots : null
      if (slots == null) sinSlots++
      const capacidad = slots ?? CAPACIDAD_SIN_SLOTS
      // Tope: más campañas que slots es un dato imposible (el guard de reserva
      // lo impide), pero si llegara, no debe empujar la red por encima del 100%.
      digitales.capacidad += capacidad
      digitales.ocupados += Math.min(vendidas, capacidad)
      digitales.sitios++
    } else {
      fijas.capacidad += 1
      fijas.ocupados += vendidas > 0 ? 1 : 0
      fijas.sitios++
    }
    if (vendidas > 0) sitiosOcupados++
  }

  const capacidad = digitales.capacidad + fijas.capacidad
  const ocupados = digitales.ocupados + fijas.ocupados
  return {
    pct: capacidad > 0 ? (ocupados / capacidad) * 100 : 0,
    ocupados,
    capacidad,
    sitiosOcupados,
    sitiosTotales: state.sitios.length,
    digitales,
    fijas,
    sinSlots,
  }
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

  // Ocupación ponderada por capacidad (slots en digitales, 1 cara en fijas).
  // `sitiosOcupados/sitiosTotales` se conserva como dato secundario: responde
  // "cuántas pantallas tienen algo vendido", que no es lo mismo que el %.
  const red = ocupacionRed(state)
  const sitiosTotales = red.sitiosTotales
  const sitiosOcupados = red.sitiosOcupados
  const ocupacionPct = red.pct

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
    espaciosOcupados: red.ocupados,
    capacidadRed: red.capacidad,
    ocupacionDigitales: red.digitales,
    ocupacionFijas: red.fijas,
    sinSlotsCapturados: red.sinSlots,
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

  const contratoPorId = new Map(state.contratos.map((c) => [c.id, c]))
  const sitioDeContrato = (contratoId: string): string => {
    const con = contratoPorId.get(contratoId)
    const sit = con && state.sitios.find((s) => s.id === con.sitioId)
    return sit?.nombre ?? 'Sitio'
  }

  // Renta vencida: UNA alerta por contrato, con cuántas cuotas se deben y el
  // total. Antes se emitía una por cuota, lo cual funcionaba mientras la renta
  // era mensual o anual (uno o dos rezagos como mucho). Con periodicidades
  // cortas deja de funcionar: un contrato diario impago un mes son 30 alertas
  // rojas idénticas que empujan fuera del panel a las incidencias, las OT y las
  // licencias. Agrupando, un contrato moroso pesa lo mismo que cualquier otro
  // problema y el número de cuotas dice de un vistazo cuán atrasado va.
  const vencidos = new Map<string, { n: number; total: number; masViejo: string }>()
  for (const p of state.pagosRenta) {
    if (p.estatus !== 'VENCIDO') continue
    const acc = vencidos.get(p.contratoId)
    if (!acc) vencidos.set(p.contratoId, { n: 1, total: p.monto, masViejo: p.periodo })
    else {
      acc.n++
      acc.total += p.monto
      if (p.periodo < acc.masViejo) acc.masViejo = p.periodo
    }
  }
  for (const [contratoId, v] of vencidos) {
    alertas.push({
      id: `al-pago-${contratoId}`,
      tipo: 'pago',
      nivel: 'rojo',
      titulo: 'Renta vencida',
      detalle:
        v.n === 1
          ? `${sitioDeContrato(contratoId)} — pago ${v.masViejo} sin liquidar (${formatMonto(v.total)})`
          : `${sitioDeContrato(contratoId)} — ${v.n} cuotas sin liquidar desde ${v.masViejo} (${formatMonto(v.total)})`,
    })
  }

  // Renta por vencer: un solo aviso por contrato (el próximo pago pendiente).
  //
  // El margen de anticipación NO es fijo: escala con la periodicidad del
  // contrato (`diasAvisoPago`, en lib/renta-periodicidad.ts). El 90 fijo de
  // antes estaba pensado para rentas anuales; aplicado a una renta diaria o
  // semanal avisaría de un pago meses antes de que exista, y el aviso dejaría
  // de señalar nada porque siempre estaría encendido. Un contrato anual sigue
  // avisando a 90 días y poniéndose rojo a 15, igual que antes.
  const proxPago = new Map<string, (typeof state.pagosRenta)[number]>()
  for (const p of state.pagosRenta) {
    if (p.estatus !== 'PENDIENTE') continue
    const prev = proxPago.get(p.contratoId)
    if (!prev || p.periodo < prev.periodo) proxPago.set(p.contratoId, p)
  }
  for (const p of proxPago.values()) {
    const periodicidad = contratoPorId.get(p.contratoId)?.periodicidad ?? null
    const dias = diasHasta(p.periodo)
    if (dias < 0 || dias > diasAvisoPago(periodicidad)) continue
    alertas.push({
      id: `al-pagov-${p.id}`,
      tipo: 'pago',
      nivel: dias <= diasCriticoPago(periodicidad) ? 'rojo' : 'ambar',
      titulo: 'Renta por vencer',
      detalle:
        dias === 0
          ? `${sitioDeContrato(p.contratoId)} — vence hoy (${formatMonto(p.monto)})`
          : `${sitioDeContrato(p.contratoId)} — vence en ${dias} ${dias === 1 ? 'día' : 'días'} (${formatMonto(p.monto)})`,
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
// La tabla de factores (incluidas las etiquetas legacy del seed viejo) vive en
// lib/renta-periodicidad.ts, compartida con el servidor y la UI: tenerla
// duplicada aquí hacía que añadir una periodicidad al enum la contara como
// mensual en el P&L sin que nada fallara.
//
// Acepta nulos porque un contrato INCOMPLETO todavía no tiene importe ni
// periodicidad (ver ADR 0001). Aporta 0 al costo: un pendiente de captura no es
// un costo conocido, y suponerle un valor falsearía el margen en la otra
// dirección. Los llamadores ya filtran por `contratoActivo`, que excluye
// INCOMPLETO; esto es la red de seguridad por si alguno deja de hacerlo.
function rentaAMensual(monto: number | null, periodicidad: string | null): number {
  if (monto == null) return 0
  return monto * factorMensual(periodicidad)
}

// ¿El contrato está activo (representa un costo de renta real hoy)?
function contratoActivo(estatus: string): boolean {
  return estatus === 'VIGENTE' || estatus === 'POR_VENCER' || estatus === 'RENOVADO'
}

// ─── Qué le falta a un contrato INCOMPLETO ──────────────────────────────────
// Los cuatro datos que exige `contrato_completo_ck`. Se dice CUÁL falta en vez
// de dar por hecho que es el importe: un contrato abierto desde el alta de la
// pantalla (ADR 0002) suele traer ya la renta —la trae el Excel del import— y
// quedarse sin vigencia ni periodicidad. El aviso genérico «falta capturar su
// importe» mandaba entonces a capturar algo que ya estaba capturado.
interface ContratoIncompletoParcial {
  arrendadorId?: string | null
  fechaFin?: string | null
  montoRenta?: number | null
  periodicidad?: string | null
}

// Orden fijo: el mismo en que se capturan en la hoja del contrato, para que la
// frase se lea como el recorrido del formulario y no en un orden arbitrario.
const FALTANTES_ORDEN = ['arrendador', 'vigencia', 'importe', 'periodicidad'] as const

export function faltantesDeContrato(c: ContratoIncompletoParcial): string[] {
  const faltan: string[] = []
  if (!c.arrendadorId) faltan.push('arrendador')
  if (!c.fechaFin) faltan.push('vigencia')
  if (c.montoRenta == null) faltan.push('importe')
  if (!c.periodicidad) faltan.push('periodicidad')
  return faltan
}

// Lo que falta EN CONJUNTO en un grupo de contratos, sin repetir, ya redactado
// ("vigencia y periodicidad"). Cadena vacía si no falta nada: el llamador
// decide entonces si el aviso tiene sentido siquiera.
export function faltaEnContratos(contratos: ContratoIncompletoParcial[]): string {
  const set = new Set<string>()
  for (const c of contratos) for (const f of faltantesDeContrato(c)) set.add(f)
  const l = FALTANTES_ORDEN.filter((f) => set.has(f))
  if (!l.length) return ''
  if (l.length === 1) return l[0]
  return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`
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
// Pantallas que NO se pueden vender todavía porque su contrato está incompleto
// (ADR 0003). Devuelve el conjunto de ids bloqueados.
//
// Esta función es el ESPEJO en cliente de `exigirContratoCompleto()` del
// servidor y las dos reglas deben coincidir: si divergen, el selector deja
// elegir una pantalla que la API rechazará después, o —peor— tacha una que sí
// era vendible. Concretamente:
//
//   · Solo INCOMPLETO y CANCELADO dejan de acreditar. VENCIDO SÍ cuenta como
//     completo (está caducado, no incompleto), así que NO sirve `contratoActivo()`
//     de aquí abajo, que además excluye VENCIDO.
//   · La cobertura se mira en los dos anclajes y con el mismo discriminador que
//     usa el resto del módulo: el contrato del predio cubre a todas sus pantallas;
//     el contrato propio solo cuenta si NO tiene predio.
const NO_ACREDITAN = new Set(['INCOMPLETO', 'CANCELADO'])

export function sitiosSinContratoCompleto(
  sitios: { id: string; predioId?: string | null }[],
  contratos: { estatus: string; predioId?: string | null; sitioId: string }[],
): Set<string> {
  const prediosCubiertos = new Set<string>()
  const pantallasCubiertas = new Set<string>()
  for (const c of contratos) {
    if (NO_ACREDITAN.has(c.estatus)) continue
    if (c.predioId) prediosCubiertos.add(c.predioId)
    else if (c.sitioId) pantallasCubiertas.add(c.sitioId)
  }
  const bloqueadas = new Set<string>()
  for (const s of sitios) {
    const cubierta =
      (s.predioId != null && prediosCubiertos.has(s.predioId)) || pantallasCubiertas.has(s.id)
    if (!cubierta) bloqueadas.add(s.id)
  }
  return bloqueadas
}

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

// Monto con dos decimales y separador de miles. Los negativos van entre
// paréntesis, que es la convención contable y lo que pidió la auditoría (M9):
// «$ -156,986.66» se lee mal en una columna de cifras — el signo se pierde
// entre dígitos y una cantidad que resta parece que suma. El color lo pone
// quien lo pinta (`tono`), no el formateador.
export function formatMonto(n: number): string {
  const cifra = Math.abs(n).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return n < 0 ? `($ ${cifra})` : `$ ${cifra}`
}

// Monto compacto para ejes, tarjetas y etiquetas ($ 18.5k, $ 4.9M).
//
// Antes dividía SIEMPRE entre mil, así que cuatro millones y medio salían como
// «$ 4897.5k»: sin separador de miles, sin unidad reconocible y más largo que
// la cifra que abreviaba. Se escala por magnitud y se apoya en toLocaleString
// para que, si la cifra abreviada aún tiene miles (1,234.5M), lleve su coma.
export function formatMontoCorto(n: number): string {
  // El redondeo puede DESBORDAR la escala: 999,999 cae en el tramo de miles,
  // redondea a 1000 y sale «$ 1,000.0k» — el mismo defecto que este arreglo
  // venía a quitar, reaparecido justo en el borde. Cuando pasa, se sube a la
  // escala siguiente y sale «$ 1M», que es lo que uno diría en voz alta.
  const abs = Math.abs(n)
  const ESCALAS: [number, string][] = [[1, ''], [1_000, 'k'], [1_000_000, 'M']]
  let i = 0
  while (i < ESCALAS.length - 1 && abs >= ESCALAS[i + 1][0]) i++
  const redondear = (indice: number) => Math.round((abs / ESCALAS[indice][0]) * 10) / 10
  if (redondear(i) >= 1000 && i < ESCALAS.length - 1) i++
  const valor = redondear(i)
  const sufijo = ESCALAS[i][1]
  // Un decimal solo si aporta: 4.9M sí, 5.0M no. Se mira el valor ya redondeado
  // — sobre el crudo, 4,999,999 daba «5.0M» con un decimal que no dice nada.
  const decimales = sufijo && valor % 1 !== 0 ? 1 : 0
  const cifra = valor.toLocaleString('es-MX', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
  return n < 0 ? `($ ${cifra}${sufijo})` : `$ ${cifra}${sufijo}`
}

// Fecha dd/mm/yyyy (formato de la demo).
//
// Distingue DOS formas, porque llegan las dos y no se pintan igual:
//
//   · "YYYY-MM-DD" a secas — una fecha de CALENDARIO. Es lo que manda
//     `pagos_renta.periodo`, que es una columna `text` y viaja literal.
//     `new Date('2026-08-29')` la interpreta como medianoche UTC, y en México
//     (UTC−6) eso cae a las 18:00 del día ANTERIOR: se imprimía 28/08/2026 para
//     el 29. Es la MISMA trampa que `diasHasta` ya resolvía, y por eso la celda
//     de vencimiento decía «28/08/2026 en 29 días» — la cuenta bien y la fecha
//     mal, con el mismo dato. Se construye en hora LOCAL desde las partes.
//
//   · Con hora ("…T06:00:00.000Z") — o bien un INSTANTE real (pausa_legal_en,
//     recordatorio_en, fecha_programada son `timestamptz`), o bien una columna
//     `date` que el driver ya resolvió a la medianoche LOCAL del servidor. En
//     ambos casos el día correcto es el local, así que se deja como estaba.
//
// OJO: eso segundo solo se sostiene mientras el servidor comparta zona con
// quien mira. En un servidor en UTC, un `date` sale como "…T00:00:00.000Z" y un
// navegador en México lo pinta un día antes — el mismo fallo, por la otra
// punta. No se arregla aquí adivinando (un timestamptz legítimo puede caer
// justo en medianoche UTC: las 18:00 de México); la solución de raíz es que el
// driver devuelva las columnas `date` como texto plano, y entonces caen en la
// primera rama.
export function formatFecha(iso: string): string {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(iso)
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
  /** Espacios ocupados en el bucket (slots digitales + caras fijas), no pantallas. */
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

// Ocupación por bucket, con la MISMA definición que el KPI: ponderada por
// capacidad (slots en digitales, 1 cara en fijas). Antes esta serie contaba
// pantallas y el KPI contaba otra cosa; A-2 se originó justo así, con dos
// definiciones del mismo concepto divergiendo en pantalla.
//
// `diasOcupados`/`diasDisponibles` pasan a ser espacios·día (un slot vendido
// durante un día es 1), no pantallas·día.
export function ocupacionSerie(state: DemoState, gran: Granularidad): SerieOcupacion {
  const { buckets, dias } = CONFIG_GRAN[gran]
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

    const red = ocupacionRed(state, { desde: bStart.getTime(), hasta: bEnd.getTime() })
    diasOcupados += red.ocupados * dias
    diasDisponibles += red.capacidad * dias

    puntos.push({ label: etiquetaBucket(bStart, gran), pct: red.pct, ocupados: red.ocupados })
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

// ─── ADR 0008 · cupo de clientes de una pantalla ────────────────────────────
// Quién ocupa una pantalla en un rango de fechas, en IDs de cliente. El servidor
// hace exactamente esta cuenta dentro de la transacción de reserva
// (`campanas-repo.ts`); esto es su espejo para que la UI pueda avisar ANTES de
// mandar la reserva. No es una autorización: la decisión sigue siendo del
// servidor. Vive aquí, y no en cada pantalla, para que la regla de solape se
// escriba una sola vez.
export function clientesEnPantalla(
  datos: { reservas: Reserva[]; campanas: Campana[] },
  sitioId: string,
  desde: number,
  hasta: number,
): string[] {
  const clientePorCampana = new Map(datos.campanas.map((c) => [c.id, c.clienteId]))
  const ids = new Set<string>()
  for (const r of datos.reservas) {
    // Bloquean cupo las reservas NO canceladas (tentativas + confirmadas): una
    // tentativa viva ya tiene el lugar apartado.
    if (r.sitioId !== sitioId || r.estatus === 'CANCELADA') continue
    const ri = new Date(r.fechaInicio).getTime()
    const rf = new Date(r.fechaFin).getTime()
    if (ri > hasta || rf < desde) continue
    const cid = clientePorCampana.get(r.campanaId)
    if (cid) ids.add(cid)
  }
  return [...ids]
}

// Cupo efectivo: el de la pantalla, o el default global. null = sin límite.
export function cupoDePantalla(
  sitio: { maxClientes?: number | null },
  config?: { maxClientesPantalla?: number | null } | null,
): number | null {
  return sitio.maxClientes ?? config?.maxClientesPantalla ?? null
}

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

// ─── Conciliación de renta por emplazamiento y arrendador (R3.7) ────────────
//
// Responde «¿qué le debo a cada propietario y qué ya le pagué?». Hasta ahora eso
// solo se podía saber contrato por contrato: la información estaba, pero había
// que sumarla a mano y nadie lo hacía.
//
// El agrupador intermedio es el EMPLAZAMIENTO, no el contrato ni la pantalla,
// porque es la unidad que el negocio reconoce: un predio con seis caras es una
// negociación con un propietario, no seis. Se resuelve con el mismo anclaje dual
// del contrato — predio si lo tiene, pantalla suelta si no.
//
// Vive aquí y no en Finanzas a propósito: Finanzas recibe los pagos SIN los
// contratos (ver `listarPagosRenta`), justamente para no exponerle importes ni
// datos del propietario. Sin contratos no hay a quién agrupar.

export interface ResumenRenta {
  n: number
  monto: number
}

export interface ConciliacionEmplazamiento {
  id: string
  tipo: 'PREDIO' | 'PANTALLA'
  nombre: string
  contratos: number
  pagado: ResumenRenta
  pendiente: ResumenRenta
  vencido: ResumenRenta
  /** Periodo impago más próximo. `null` si no queda nada por pagar. */
  proximoPeriodo: string | null
}

export interface ConciliacionArrendador {
  arrendadorId: string | null
  arrendador: string
  emplazamientos: ConciliacionEmplazamiento[]
  pagado: ResumenRenta
  pendiente: ResumenRenta
  vencido: ResumenRenta
  proximoPeriodo: string | null
}

const vacio = (): ResumenRenta => ({ n: 0, monto: 0 })

function acumular(r: ResumenRenta, monto: number) {
  r.n += 1
  r.monto += monto || 0
}

export function conciliacionRenta(state: DemoState): ConciliacionArrendador[] {
  const contratoPorId = new Map(state.contratos.map((c) => [c.id, c]))
  const predioPorId = new Map((state.predios ?? []).map((p) => [p.id, p]))
  const sitioPorId = new Map(state.sitios.map((s) => [s.id, s]))
  const arrPorId = new Map((state.arrendadores ?? []).map((a) => [a.id, a]))

  // clave = arrendador \u0000 emplazamiento, para no mezclar dos predios del mismo
  // propietario ni el mismo predio de dos propietarios distintos.
  const porGrupo = new Map<string, ConciliacionEmplazamiento & { arrendadorId: string | null }>()
  const contratosVistos = new Map<string, Set<string>>()

  for (const p of state.pagosRenta) {
    const c = contratoPorId.get(p.contratoId)
    // Un pago sin contrato no es agrupable por propietario. No se descarta en
    // silencio: se agrupa aparte para que se vea que existe, en vez de
    // desaparecer de un cuadre que pretende estar completo.
    const emplId = c ? (c.predioId ?? c.sitioId) : null
    const tipo: 'PREDIO' | 'PANTALLA' = c?.predioId ? 'PREDIO' : 'PANTALLA'
    const nombre = !c
      ? 'Sin contrato'
      : c.predioId
        ? predioPorId.get(c.predioId)?.nombre ?? 'Predio'
        : sitioPorId.get(c.sitioId)?.nombre ?? 'Pantalla'
    // El arrendador del contrato manda; si el contrato aún está incompleto no
    // lo tiene, y entonces se hereda el del predio, que sí se conoce.
    const arrId =
      c?.arrendadorId ?? (c?.predioId ? predioPorId.get(c.predioId)?.arrendadorId ?? null : null)

    const clave = `${arrId ?? '-'}\u0000${emplId ?? '-'}`
    let g = porGrupo.get(clave)
    if (!g) {
      g = {
        arrendadorId: arrId,
        id: emplId ?? 'sin-contrato',
        tipo,
        nombre,
        contratos: 0,
        pagado: vacio(),
        pendiente: vacio(),
        vencido: vacio(),
        proximoPeriodo: null,
      }
      porGrupo.set(clave, g)
      contratosVistos.set(clave, new Set())
    }
    if (c) contratosVistos.get(clave)!.add(c.id)

    if (p.estatus === 'PAGADO') acumular(g.pagado, p.monto)
    else if (p.estatus === 'VENCIDO') acumular(g.vencido, p.monto)
    else acumular(g.pendiente, p.monto)

    // El próximo a pagar es el periodo impago más antiguo: es el que urge, no el
    // más cercano en el futuro.
    if (p.estatus !== 'PAGADO' && (!g.proximoPeriodo || p.periodo < g.proximoPeriodo)) {
      g.proximoPeriodo = p.periodo
    }
  }

  for (const [clave, g] of porGrupo) g.contratos = contratosVistos.get(clave)!.size

  // Rollup a arrendador.
  const porArrendador = new Map<string, ConciliacionArrendador>()
  for (const g of porGrupo.values()) {
    const k = g.arrendadorId ?? '-'
    let a = porArrendador.get(k)
    if (!a) {
      a = {
        arrendadorId: g.arrendadorId,
        arrendador: g.arrendadorId
          ? arrPorId.get(g.arrendadorId)?.nombre ?? 'Arrendador'
          : 'Sin arrendador asignado',
        emplazamientos: [],
        pagado: vacio(),
        pendiente: vacio(),
        vencido: vacio(),
        proximoPeriodo: null,
      }
      porArrendador.set(k, a)
    }
    const { arrendadorId: _omit, ...empl } = g
    a.emplazamientos.push(empl)
    for (const campo of ['pagado', 'pendiente', 'vencido'] as const) {
      a[campo].n += g[campo].n
      a[campo].monto += g[campo].monto
    }
    if (g.proximoPeriodo && (!a.proximoPeriodo || g.proximoPeriodo < a.proximoPeriodo)) {
      a.proximoPeriodo = g.proximoPeriodo
    }
  }

  // Primero quien tiene deuda vencida: es el orden en que hay que actuar.
  const orden = (x: ConciliacionArrendador | ConciliacionEmplazamiento) =>
    [-x.vencido.monto, -x.pendiente.monto] as const
  const cmp = (a: any, b: any) => {
    const [av, ap] = orden(a)
    const [bv, bp] = orden(b)
    return av - bv || ap - bp || String(a.nombre ?? a.arrendador).localeCompare(String(b.nombre ?? b.arrendador))
  }
  const salida = [...porArrendador.values()].sort(cmp)
  for (const a of salida) a.emplazamientos.sort(cmp)
  return salida
}
