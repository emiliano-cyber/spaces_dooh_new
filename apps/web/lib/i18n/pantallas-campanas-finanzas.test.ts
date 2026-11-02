import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «CAMPANAS Y FINANZAS», RENDIDO DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El mismo patron que `pantallas-propuestas.test.ts` (el piloto): se monta el
//  componente REAL dentro del proveedor, se rinde con `renderToStaticMarkup`
//  y se comprueba el texto:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//
//  Sin DOM no hay clics ni efectos: un dialogo abierto, una seccion plegada
//  que se despliega o un panel que pide sus datos en un `useEffect` no se
//  pintarian nunca. Se arranca el estado en el valor que tendria despues. Cada
//  entrada de la cola lleva un predicado sobre el valor INICIAL de la llamada
//  y, opcionalmente, sobre la PILA: la ficha de campana tiene once secciones
//  `Seccion` que nacen plegadas segun su estado, y la unica forma estable de
//  abrirlas todas sin depender del orden de los demas `useState(false)` es
//  reconocer que la llamada sale de `Seccion`.
//
//  ─── EL VOLCADO PARA COMPARAR EL ESPANOL ───────────────────────────────────
//
//  Con `I18N_VOLCAR=<carpeta>` la prueba escribe el HTML espanol de cada
//  estado en esa carpeta. Se corre ANTES y DESPUES de tocar los componentes y
//  las dos carpetas se comparan con `diff -r`: asi se demostro que el espanol
//  no cambio ni una letra.
//
//  ─── LO QUE NO VE ──────────────────────────────────────────────────────────
//
//  Desde la costura (2026-11-02) la reserva y su frecuencia (`lib/periodos.ts`),
//  el horario de DOOHmain, `AvisoFranjaCMS`, la etiqueta del periodo y el «Sin
//  asignar» de las razones sociales SI se comprueban: el barrido con el
//  diccionario de compartidos (al final del archivo) los vigila. Siguen en
//  espanol los avisos de franja que manda el servidor, `PipelineView`,
//  `KPICard`, `EmptyState`, `ConfirmDialog` y el CSV del estado de cuenta (ver
//  la nota de la boveda §11). Los mensajes del servidor van por I18N-05.
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown; fijo?: boolean }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    if (forzado.cola.length) {
      const pila = new Error().stack ?? ''
      // Las entradas `fijo` se aplican a TODAS las llamadas que casan (las
      // secciones de la ficha); el resto, a la primera, en orden.
      const fija = forzado.cola.find((f) => f.fijo && f.si(valorInicial, pila))
      if (fija) return real.useState(fija.valor)
      const cabeza = forzado.cola.find((f) => !f.fijo)
      if (cabeza && cabeza.si(valorInicial, pila)) {
        forzado.cola.splice(forzado.cola.indexOf(cabeza), 1)
        return real.useState(cabeza.valor)
      }
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/campanas',
}))

vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement('div', null, createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
      : null,
}))
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: { open: boolean; title: string; confirmLabel?: string; children: unknown }) =>
    p.open
      ? createElement('div', null, createElement('h2', null, p.title), p.children as never,
          createElement('button', null, p.confirmLabel ?? 'Confirmar'))
      : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never,
      p.resumen as never, p.accion as never, p.children as never),
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => datos.puede }))
// Componentes de OTRO lote que la pagina de Finanzas monta: aqui no cuentan.
vi.mock('@/components/demo/arrendadores/PagosRentaCard', () => ({ PagosRentaCard: () => null }))
vi.mock('@/components/demo/arrendadores/CompromisoRentaCard', () => ({ CompromisoRentaCard: () => null }))
vi.mock('@/lib/campanas-vista', () => ({
  useVistaCampanas: () => ({
    vista: { compacta: false, minimizadas: [], ocultas: datos.ocultas },
    alternarCompacta: () => {}, alternarMinimizada: () => {}, alternarOculta: () => {}, mostrarTodas: () => {},
  }),
}))

// ─── Datos de prueba ────────────────────────────────────────────────────────
const CAMP = {
  id: 'c1', folio: 'CA-0001', nombre: 'Campaña Verano', clienteId: 'cl1', propuestaId: 'p1', agencia: null,
  marca: 'Refresco', tipoCampana: 'HIBRIDA', fechaInicio: '2026-01-01', fechaFin: '2026-06-30',
  presupuestoBruto: 11600, presupuestoNeto: 10000, moneda: 'MXN', estadoComercial: 'ACTIVA',
  enviadaDominio: true, enviadaDominioEn: null, validacionEstatus: 'PENDIENTE', validacionMotivo: null,
  validacionPor: null, validacionEn: null, ocRecibida: false, fotosComprobatorias: false, reportePublicacion: false,
  ocUrl: null, contratoUrl: null, reportePublicacionUrl: null, portalToken: 'tok', portalActivo: true, notas: null,
  creadoEn: '2026-01-01',
}
const CAMP_TELCO = {
  ...CAMP, id: 'camp-telco', folio: 'CA-0002', nombre: 'Telco Andina', estadoComercial: 'COMPLETADA',
  fechaInicio: '2026-01-01', fechaFin: '2099-12-31', creadoEn: '2026-02-01',
}
const CAMP_SIN = { ...CAMP, id: 'c3', folio: 'CA-0003', nombre: 'Otoño', presupuestoBruto: null, creadoEn: '2026-03-01' }
const CAMP_CONF = { ...CAMP, id: 'c4', folio: 'CA-0004', nombre: 'Lanzamiento', estadoComercial: 'CONFIRMADA', creadoEn: '2026-03-02' }
const RESUMEN = [
  { campana: CAMP, clienteNombre: 'Refrescos del Norte', etapa: 'publicada', index: 3, totalPasos: 10, candado: true },
  { campana: CAMP_TELCO, clienteNombre: 'Telco', etapa: 'facturada', index: 9, totalPasos: 10, candado: false },
  { campana: CAMP_SIN, clienteNombre: null, etapa: 'reservada', index: 0, totalPasos: 10, candado: false },
  { campana: CAMP_CONF, clienteNombre: null, etapa: 'confirmada', index: 1, totalPasos: 10, candado: false },
]
const POR_VALIDAR = Array.from({ length: 6 }, (_, i) => ({ ...CAMP, id: `v${i}`, folio: `CA-01${i}`, nombre: `Validar ${i}` }))
const CLIENTE = {
  id: 'cl1', nombre: 'Refrescos del Norte', rfc: null, razonSocial: null, regimenFiscal: null, cpFiscal: null,
  usoCfdi: 'G03', ivaPct: 16,
}
const CREAS = [
  { id: 'cr1', campanaId: 'c1', nombre: 'Arte 1', archivoUrl: null, codigo: null, formato: null, resolucion: null,
    estatusValidacion: 'VALIDADA', rechazadoMotivo: null, retiradoEn: null, creadoEn: '2026-01-01' },
  { id: 'cr2', campanaId: 'c1', nombre: 'Arte 2', archivoUrl: null, codigo: null, formato: null, resolucion: null,
    estatusValidacion: 'PENDIENTE', rechazadoMotivo: null, retiradoEn: '2026-01-05', creadoEn: '2026-01-01' },
]
const OTS = Array.from({ length: 6 }, (_, i) => ({
  id: `o${i}`, campanaId: 'c1', folio: `OT-${i}`, descripcion: 'Instalación', estatus: 'ASIGNADA',
  fechaProgramada: '2026-01-01',
}))
const OIS = Array.from({ length: 6 }, (_, i) => ({ id: `oi${i}`, campanaId: 'c1', folio: `OI-${i}`, material: 'Lona', estatus: 'EN_PRODUCCION' }))

const FACTURAS = Array.from({ length: 11 }, (_, i) => ({
  id: `f${i}`, folio: `F-00${i}`, campanaId: 'c9', clienteId: 'cl1', subtotal: 1000, igv: 160, monto: 1160,
  moneda: 'MXN', fechaEmision: '2026-10-01', estatus: i === 0 ? 'EMITIDA' : i === 1 ? 'PAGADA' : 'ANULADA',
  serie: 'A', folioFiscal: 'ABCDEF12-3456-7890', rfc: 'RFN010101AAA', razonSocial: 'Refrescos SA',
  usoCfdi: 'G03', entidadEmisoraId: null, creadoEn: '2026-10-01',
}))
const COBRANZAS = [
  { id: 'cb1', facturaId: 'f0', plazoDias: 90, fechaVencimiento: '2026-01-01', estatus: 'PENDIENTE', montoPagado: 100,
    recordatorioEn: '2026-01-02', recordatoriosEnviados: 2, creadoEn: '2026-01-01', numero: 1, totalCuotas: 2, monto: 580 },
  { id: 'cb2', facturaId: 'f0', plazoDias: 90, fechaVencimiento: '2099-01-01', estatus: 'PENDIENTE', montoPagado: 0,
    recordatorioEn: null, recordatoriosEnviados: 1, creadoEn: '2026-01-01', numero: 2, totalCuotas: 2, monto: 580 },
  { id: 'cb3', facturaId: 'f1', plazoDias: 60, fechaVencimiento: '2026-01-01', estatus: 'PAGADA', montoPagado: 1160,
    recordatorioEn: null, recordatoriosEnviados: 1, creadoEn: '2026-01-01' },
]
const RESUMEN_FIN = {
  periodo: { desde: '2026-11-01', hasta: '2026-11-30', etiqueta: 'Noviembre 2026' },
  hoy: '2026-11-02',
  resumen: {
    saldoInicial: 1000, saldoFinal: 2000, cobrado: 500, corte: '2026-11-02', abonosSinFecha: 200,
    facturado: { monto: 1500, facturas: 1 }, vencido: { monto: 300, facturas: 2 },
    renta: { pagada: 0, porPagar: 400 },
  },
  movimientos: [
    { fecha: '2026-11-01', tipo: 'factura', folio: 'F-001', clienteId: 'cl1', cargo: 1160, abono: 0, saldo: 2160 },
    { fecha: '2026-11-02', tipo: 'abono', folio: 'F-001', clienteId: 'cl1', cargo: 0, abono: 160, saldo: 2000, aproximado: true },
  ],
}

const datos = vi.hoisted(() => ({
  puede: true,
  ocultas: [] as string[],
  campana: null as unknown,
  resumen: [] as unknown[],
  campanas: [] as unknown[],
  facturas: [] as unknown[],
  cobranzas: [] as unknown[],
  creas: [] as unknown[],
  readiness: null as unknown,
}))

vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useCampana: (id: string) => (id === 'nada' ? null : datos.campana),
    useCampanas: () => datos.campanas,
    useCampanasResumen: () => datos.resumen,
    useClientes: () => [CLIENTE],
    // `spotsPorDia: 12` (costura): para que la ficha pinte `etiquetaFrecuencia`.
    useReservas: () => [
      { id: 'r1', campanaId: 'c1', sitioId: 's1', unidad: 'mensual', cantidad: 1, precio: 1000, spotsPorDia: 12, estatus: 'CONFIRMADA' },
    ],
    useSitios: () => [{ id: 's1', nombre: 'Pantalla Reforma', alcaldia: 'Cuauhtémoc', computerVision: true, admobilizeId: 'AM-1' }],
    useCreatividades: () => datos.creas,
    useOrdenesImpresion: () => OIS,
    useOrdenesTrabajo: () => OTS,
    useEvidencias: () => [],
    useMargenCampana: () => ({ margen: -500, margenPct: -5, ingreso: 10000, costoEspacios: 2000, costoImpresion: 0, costoOperacion: 0 }),
    useOrdenesCompra: () => [{ campanaId: 'c1', folio: 'ODC-1', numeroOc: '4500', monto: 11600, fecha: '2026-01-02', documentoUrl: 'x.pdf' }],
    useReporteCampana: () => ({ cumplimientoPct: 50, sitiosContratados: 2, sitiosEntregados: 1, testigos: 3, diasContratados: 20 }),
    usePipeline: () => null,
    useReadiness: () => datos.readiness,
    useFacturas: () => datos.facturas,
    useCobranzas: () => datos.cobranzas,
    usePagosRenta: () => [],
    useConfigNegocio: () => ({ plazosCobranza: [60, 90] }),
    useEntidadesFiscales: () => [],
  }
})

function reiniciar() {
  forzado.cola = []
  datos.puede = true
  datos.ocultas = []
  datos.campana = CAMP
  datos.resumen = RESUMEN
  datos.campanas = [...RESUMEN.map((r) => ({ ...r.campana, enviadaDominio: false })), ...POR_VALIDAR]
  datos.facturas = FACTURAS
  datos.cobranzas = COBRANZAS
  datos.creas = CREAS
  datos.readiness = { candado: false, ocRecibida: false, fotosComprobatorias: true, reportePublicacion: false }
}

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  reiniciar()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}
function texto(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esFalse = (v: unknown) => v === false
const esTrue = (v: unknown) => v === true
const esVacio = (v: unknown) => v === ''
const es = (x: unknown) => (v: unknown) => v === x
// ¿La llamada a `useState` la hace DIRECTAMENTE este componente? (La linea 0
// de la pila es «Error», la 1 el envoltorio de arriba y la 2 quien lo llamo.)
const desde = (pila: string, componente: string) => (pila.split(/\r?\n/)[2] ?? '').includes(`at ${componente} `)
const forzarEn = (componente: string, si: (v: unknown) => boolean, valor: unknown) =>
  forzado.cola.push({ si: (v, pila) => si(v) && desde(pila, componente), valor })
// Las once secciones de la ficha, abiertas.
const abrirSecciones = () =>
  forzado.cola.push({ si: (v, pila) => v === false && /\bat Seccion\b/.test(pila), valor: true, fijo: true })

type Pantalla = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[] }

const PUBLICACION = {
  tipo: 'parcial', fallidas: 1, omitidas: 1, error: null,
  filas: [
    { sitio: 'S-1', ok: true, estado: 'published', screen: 'scr-1', creativoNombre: 'Arte 1' },
    { sitio: 'S-2', ok: false, estado: null, screen: null, creativoNombre: null, error: null },
    { sitio: 'S-3', ok: true, estado: 'otro_cms', cms: 'BROADSIGN', creativoNombre: null },
    { sitio: 'S-4', ok: true, estado: 'already_published', screen: 'scr-4', creativoNombre: null },
  ],
}
const VISTA_DOOHMAIN = {
  publicacionEncendida: false,
  horarioIndividual: { horaInicio: '08:00', horaFin: '20:00', dias: [1, 2] },
  franjaCampana: { origen: 'programada', nombre: 'Mañana', horaInicio: '06:00', horaFin: '12:00' },
  cliente: { nombre: 'Refrescos del Norte', rfc: 'RFN010101AAA', razonSocial: 'Refrescos SA', direccion: null, tipo: null },
  lista: 'L-1',
  filas: [
    { sitio: 's1', sitioNombre: 'Pantalla Reforma', destino: 'doohmain', screen: 'scr-1', creativoNombre: 'Arte 1',
      programacion: { cantDia: 10, cantTotal: 100, horaInicio: null, horaFin: null, dias: null, autoCant: false } },
    { sitio: 's2', sitioNombre: 'Pantalla Sur', destino: 'otro_cms', screen: null, creativoNombre: 'Arte 1',
      programacion: { cantDia: 10, cantTotal: 100, horaInicio: null, horaFin: null, dias: null, autoCant: false } },
    { sitio: 's3', sitioNombre: 'Pantalla Norte', destino: 'sin_pantalla', screen: null, creativoNombre: 'Arte 1',
      programacion: { cantDia: 10, cantTotal: 100, horaInicio: null, horaFin: null, dias: null, autoCant: false } },
  ],
  sinCreativo: [{ sitio: 's4', sitioNombre: 'Pantalla Oriente' }],
  fechaInicio: '2026-01-01',
  fechaFin: '2026-06-30',
}
const CONSULTAS = [
  { id: 'q1', tipo: 'stats', campanaId: 'c1', auths: [], pantallas: [], desde: '2026-01-01', hasta: '2026-01-31',
    payload: [], vacio: true, error: null, consultadoEn: '2026-02-01T10:00:00Z' },
  { id: 'q2', tipo: 'stats', campanaId: 'c1', auths: [], pantallas: [], desde: '2026-01-01', hasta: '2026-01-15',
    payload: [], vacio: false, error: 'x', consultadoEn: '2026-02-01T09:00:00Z' },
  { id: 'q3', tipo: 'stats', campanaId: 'c1', auths: [], pantallas: [], desde: '2026-01-01', hasta: '2026-01-10',
    payload: [], vacio: true, error: null, consultadoEn: '2026-02-01T08:00:00Z' },
  { id: 'q4', tipo: 'stats', campanaId: 'c1', auths: [], pantallas: [], desde: '2026-01-01', hasta: '2026-01-05',
    payload: [{ n: 1 }], vacio: false, error: null, consultadoEn: '2026-02-01T07:00:00Z' },
]
const CREATIVOS_DOOHMAIN = [
  { creativoId: 'cr1', nombre: 'Arte 1', auth: 'a', pantallas: ['scr-1', 'scr-2'], estado: 'active', inicio: null, fin: null },
  { creativoId: 'cr2', nombre: 'Arte 2', auth: 'b', pantallas: [], estado: null, inicio: null, fin: null },
]

const PANTALLAS: Pantalla[] = [
  // ─── CAMPANAS ───────────────────────────────────────────────────────────
  {
    nombre: 'lista de campanas',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/campanas/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Cada campaña viaja sola por la empresa · pipeline en vivo',
      'Activas', '1 confirmada por arrancar', 'Por validar publicación', 'enviadas al dominio',
      'Listas para facturar', 'candado abierto', 'Contratado vigente', '1 activa sin presupuesto capturado',
      'Por validar (6)', 'Enviadas al dominio, esperan aprobación antes de publicar', 'Validar', 'Ver todas (6)',
      'Buscar por nombre, folio o cliente…', 'Todos los estados', 'Activa (2)', 'Lista para facturar (0)',
      'Esconder los pipelines: una fila por campaña', 'Vista compacta', '4 de 4', 'hilo conductor',
      'Publicada · 4/10', 'Completada', '· periodo terminado', '· cerrada antes de tiempo',
      'Se marcó como completada antes de que terminara su periodo.', 'El periodo contratado ya terminó.',
      'Lista para facturar', 'Minimizar esta campaña', 'Ocultar de mi lista',
      'Ocultar de mi lista (solo en este navegador; la campaña sigue igual para todos)', 'Reservada', 'OC recibida',
      'Sin presupuesto capturado en la propuesta', 'Ver pipeline', 'CA-010 · HIBRIDA',
    ],
    ingles: ['CA-010 · Hybrid', 'demo storyline', 'Campaigns', 'Ready to invoice', 'To review (6)', 'Search by name, internal ref. or client…', 'View pipeline', 'Jan 1, 2026–Jun 30, 2026'],
  },
  {
    nombre: 'lista filtrada sin resultados (texto y estado)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/campanas/page')
      forzar(esVacio, 'xyz')
      forzar(esVacio, 'CANCELADA')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ninguna campaña coincide con la búsqueda', 'No hay resultados para «xyz» en estado Cancelada.', 'Limpiar filtros'],
    ingles: ['No campaign matches the search', 'Clear filters'],
  },
  {
    nombre: 'lista filtrada sin resultados (solo estado)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/campanas/page')
      forzar(esVacio, '')
      forzar(esVacio, 'CANCELADA')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['No hay campañas en estado Cancelada.'],
    ingles: ['There are no campaigns with status Cancelled.'],
  },
  {
    nombre: 'lista vacia',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/campanas/page')
      datos.resumen = []
      datos.campanas = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Todavía no hay campañas',
      'Las campañas se generan al aprobar una propuesta. Crea una propuesta y apruébala para verla aquí.',
      'Ir a Propuestas', 'sin campañas activas',
    ],
    ingles: ['No campaigns yet', 'Go to Proposals'],
  },
  {
    nombre: 'lista con todas ocultas y la cola completa',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/campanas/page')
      datos.ocultas = RESUMEN.map((r) => r.campana.id)
      forzar(esFalse, true) // todasPorValidar
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Ocultaste todas las campañas de esta vista',
      'Ocultar solo las quita de tu lista en este navegador: siguen activas para todos.',
      'Mostrar ocultas (4)', 'Ver menos', '0 de 4',
    ],
    ingles: ['Show hidden (4)', 'Show less'],
  },
  {
    nombre: 'ficha de la campana (todas las secciones abiertas)',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/campanas/[id]/page')
      abrirSecciones()
      return pintar(idioma, createElement(Ficha, { params: { id: 'c1' } }))
    },
    espanol: [
      'Portal del cliente', 'Esta campaña incluye 1 pantalla con IA · medición de audiencia (AdMobilize)',
      'Creativos', 'Por aprobar', 'Gestionar', 'Validada', 'Imagen', 'Código',
      'Validación de publicación', 'Pendiente de validar', 'Enviada al dominio / CMS', 'Anuncios cargados (1/2 validados)',
      'Información de los anuncios', 'Retirado', 'Retirado; su arte sigue en DOOHmain (quítalo en su panel)',
      'Bajar creativo (finaliza su campaña en DOOHmain)', 'Aprobar publicación', 'Rechazar',
      'Extensiones', 'Termina el', 'Para alargarla hace falta el contrato firmado de la extensión.', 'Extender campaña',
      'Candado de facturación', 'Pendiente', 'Cerrado: faltan condiciones por cumplir', 'Orden de compra recibida',
      'Fotografías comprobatorias', 'Reporte de publicación', 'Registrar OC del cliente', 'Número de OC del cliente',
      'Monto', 'Fecha', 'Registrar OC', 'Número, monto y fecha vienen precargados de la campaña; ajústalos si el cliente dio otros.',
      'El documento de la OC es el contrato (se adjunta en “Datos de facturación”).',
      'El candado se abre cuando se cumplen estas condiciones.',
      'Comercial', 'Completo', 'Subtotal (neto)', 'IVA (16%)', 'Total', 'Agencia', 'Directo', 'OC recibida', 'No',
      'Datos de facturación', 'Cliente', 'Razón social', '— falta —', 'Régimen fiscal', 'CP fiscal', 'Uso CFDI',
      'G03 · Gastos en general', 'Completa RFC y razón social en', 'para poder facturar esta campaña.',
      'Contrato del cliente', 'Sin contrato adjunto', 'Subir contrato (PDF)',
      'Rentabilidad', 'Margen -5%', 'Total contratado (cliente)', 'snapshot',
      'Snapshot económico congelado en la aceptación — igual al total de la propuesta y de la factura (IVA incluido)',
      'Ingreso del medio (neto)', '− Costo de espacios', 'estimado',
      'Costo de compra interno estimado — no está ligado a un contrato de arrendador vigente',
      '− Costo de impresión', '− Costo de operación',
      'Reporte de cumplimiento', '50% entregado', 'Sitios contratados', 'Sitios entregados', 'Testigos (fotos)', 'Días contratados',
      'Orden de compra', 'Folio ODC', 'Número de OC (cliente)', 'Documento',
      'Sitios de la campaña', 'Confirmada', 'Imprenta', 'En producción', 'Órdenes de trabajo', 'Asignada', 'Vencida',
      'Fecha compromiso', 'Evidencias fotográficas', 'Aún sin fotografías', 'Las evidencias se suben al cerrar la OT móvil.',
      'Reproducciones (proof of play)', 'Margen', 'Entregado', 'Candado', '6 abiertas de 6', 'Evidencias',
      'Campañas (10)', 'Ocultar el menú de campañas', 'Ocultar', 'Otras campañas', 'Minimizar',
      'Cuauhtémoc · 1 mes · ', '12 pases al día',
    ],
    ingles: [
      'Client portal', 'Billing lock', 'Publication review', 'Profitability', 'Delivery report', 'Purchase order',
      'Campaign sites', 'Work orders', 'Photo evidence', 'Plays (proof of play)', 'Campaigns (10)', 'Jan 1, 2026–Jun 30, 2026',
      // Costura: `resumenReserva` y `etiquetaFrecuencia` (lib/periodos.ts) con el idioma.
      'Cuauhtémoc · 1 month · ', '12 plays per day',
      // «Pricing» para la seccion «Comercial» (decision del orquestador).
      'Pricing',
    ],
  },
  {
    nombre: 'ficha de una campana que no existe',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/campanas/[id]/page')
      return pintar(idioma, createElement(Ficha, { params: { id: 'nada' } }))
    },
    espanol: ['Campaña no encontrada.', 'Volver a campañas'],
    ingles: ['Campaign not found.', 'Back to campaigns'],
  },
  {
    nombre: 'validacion: sin enviar, con creativos aprobados',
    pintar: async (idioma) => {
      const { ValidacionPanel } = await import('../../components/demo/campanas/ValidacionPanel')
      datos.campana = { ...CAMP, enviadaDominio: false }
      datos.creas = [CREAS[0], { ...CREAS[0], id: 'cr3' }]
      return pintar(idioma, createElement(ValidacionPanel, { campanaId: 'c1' }))
    },
    espanol: [
      'Enviar al dominio', 'Aprobar los creativos no los sube a DOOHmain.', 'Tienes 2 aprobados listos.',
      'Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain', 'al aprobar la publicación.',
    ],
    ingles: ['Submit for publishing', 'You have 2 approved creatives ready.'],
  },
  {
    nombre: 'validacion: sin enviar, un solo aprobado',
    pintar: async (idioma) => {
      const { ValidacionPanel } = await import('../../components/demo/campanas/ValidacionPanel')
      datos.campana = { ...CAMP, enviadaDominio: false }
      return pintar(idioma, createElement(ValidacionPanel, { campanaId: 'c1' }))
    },
    espanol: ['Tienes 1 aprobado listo.'],
    ingles: ['You have 1 approved creative ready.'],
  },
  {
    nombre: 'validacion: rechazada',
    pintar: async (idioma) => {
      const { ValidacionPanel } = await import('../../components/demo/campanas/ValidacionPanel')
      datos.campana = { ...CAMP, enviadaDominio: false, validacionEstatus: 'RECHAZADA', validacionEn: '2026-01-03T10:00:00Z',
        validacionPor: 'Ana', validacionMotivo: 'Logo borroso' }
      return pintar(idioma, createElement(ValidacionPanel, { campanaId: 'c1' }))
    },
    espanol: ['Publicación rechazada', 'Rechazada', ' por ', 'Motivo: ', 'Corregir y reenviar al dominio'],
    ingles: ['Rejected by', 'Reason: Logo borroso', 'Fix and resubmit for publishing'],
  },
  {
    nombre: 'validacion: aprobada, con el resultado de DOOHmain y los tres dialogos',
    pintar: async (idioma) => {
      const { ValidacionPanel } = await import('../../components/demo/campanas/ValidacionPanel')
      datos.campana = { ...CAMP, validacionEstatus: 'APROBADA', validacionEn: '2026-01-03T10:00:00Z', validacionPor: 'Ana' }
      forzar(esNull, null) // busyCr
      forzar(esNull, CREAS[0]) // confirmar
      forzar(esFalse, true) // confirmarAprobar
      forzar(esNull, PUBLICACION) // publicacion
      forzar(esFalse, true) // confirmarReintento
      return pintar(idioma, createElement(ValidacionPanel, { campanaId: 'c1' }))
    },
    espanol: [
      'Publicación aprobada', 'Aprobada', 'Volver a publicar en DOOHmain',
      'Publicada en DOOHmain con 1 pantalla(s) con error', 'Publicada', 'sin pantalla en DOOHmain', 'Error',
      'no va a DOOHmain: la opera Broadsign', 'Ya estaba publicada',
      'Bajar creativo', '¿Seguro que quieres bajar', 'Si estaba publicado, su', 'el arte no se puede quitar de DOOHmain',
      '(su API no lo permite): quedará marcado como “pendiente en DOOHmain”.', 'Sí, bajar',
      'Aprobar y publicar en DOOHmain', 'Al aprobar, los anuncios se suben a DOOHmain.',
      'Una vez publicados no se pueden eliminar ni reemplazar desde el sistema',
      '(la API de DOOHmain no lo permite): cualquier cambio posterior deberá hacerse',
      'manualmente en el panel de DOOHmain', '¿Continuar?', 'Sí, publicar',
      'Se manda otra vez a DOOHmain cada pantalla de la campaña con la pieza que tiene asignada',
      'Lo que ya está publicado no se duplica. La', 'campaña no cambia de estado.', 'Sí, volver a publicar',
    ],
    ingles: ['Publish again in DOOHmain', 'Yes, publish', 'Remove creative'],
  },
  ...(['apagada', 'sin-pantallas', 'error-sin-filas', 'error', 'ok-omitidas', 'ok'] as const).map((tipo) => ({
    nombre: `validacion: resultado de DOOHmain «${tipo}»`,
    pintar: async (idioma: Idioma) => {
      const { ValidacionPanel } = await import('../../components/demo/campanas/ValidacionPanel')
      datos.campana = { ...CAMP, validacionEstatus: 'APROBADA' }
      const filas = tipo === 'error-sin-filas' || tipo === 'apagada' || tipo === 'sin-pantallas' ? [] : PUBLICACION.filas
      const r = {
        tipo: tipo.startsWith('error') ? 'error' : tipo.startsWith('ok') ? 'ok' : tipo,
        fallidas: 0, omitidas: tipo === 'ok-omitidas' ? filas.length : 0, error: null, filas,
      }
      forzar(esNull, null)
      forzar(esNull, null)
      forzar(esNull, r)
      return pintar(idioma, createElement(ValidacionPanel, { campanaId: 'c1' }))
    },
    espanol: [
      {
        apagada: 'No se subió nada a DOOHmain: la publicación está apagada en esta instancia',
        'sin-pantallas': 'No había pantallas digitales que subir a DOOHmain',
        'error-sin-filas': 'No se publicó en DOOHmain: sin detalle',
        error: 'No se publicó en ninguna pantalla de DOOHmain',
        'ok-omitidas': 'Ninguna pantalla de esta campaña va a DOOHmain: todas usan otro CMS',
        ok: 'Publicada en DOOHmain',
      }[tipo],
    ],
    ingles: ['DOOHmain'],
  })),
  {
    nombre: 'lo que se manda a DOOHmain (con franja y horario propio)',
    pintar: async (idioma) => {
      const { ProgramacionDoohmain } = await import('../../components/demo/campanas/ProgramacionDoohmain')
      // Costura: una fila mas, sin pauta y con horario y dias, para que se
      // pinten los tres textos de `lib/doohmain-programacion.ts`.
      forzar(esNull, {
        ...VISTA_DOOHMAIN,
        filas: [
          ...VISTA_DOOHMAIN.filas,
          { sitio: 's5', sitioNombre: 'Pantalla Reforma', destino: 'doohmain', screen: 'scr-5', creativoNombre: 'Arte 2',
            programacion: { cantDia: null, cantTotal: null, horaInicio: '07:30', horaFin: '09:00', dias: [1, 2], autoCant: false } },
        ],
      })
      return pintar(idioma, createElement(ProgramacionDoohmain, { campanaId: 'c1', clave: 'k' }))
    },
    espanol: [
      'Todo el día (sin franja)', '07:30 a 09:00 · lun, mar', 'Las que quepan',
      'Lo que se manda a DOOHmain', 'Actualizar',
      'La publicación en DOOHmain está apagada en esta instancia: esto es lo que se mandaría.',
      'Horario en DOOHmain: la franja programada', 'La campaña ya tiene franja, así que no lleva',
      'otro horario.', 'Tiene además un horario propio (08:00 a 20:00), de antes, y es el que se',
      'manda: quítalo para que viaje la franja.', 'Quitar',
      'Cliente:', ' · lista L-1', 'Pantalla', 'Creativo', 'Horario', 'Por día', 'Total campaña',
      'No va a DOOHmain: la opera otro CMS', 'Sin pantalla de DOOHmain asignada',
      'Sin creativo aprobado asignado: al publicar, esta pantalla no recibe nada.',
      'Del 2026-01-01 al 2026-06-30. Si la campaña tiene franja, DOOHmain reparte las del día dentro de ese',
      'horario. Un anuncio ya publicado no cambia de horario al volver a publicar.',
    ],
    ingles: [
      'What gets sent to DOOHmain', 'Refresh', 'Per day',
      'All day (no daypart)', '07:30 to 09:00 · Mon, Tue', 'As many as fit',
    ],
  },
  {
    nombre: 'lo que se manda a DOOHmain (sin franja, el horario propio editable)',
    pintar: async (idioma) => {
      const { ProgramacionDoohmain } = await import('../../components/demo/campanas/ProgramacionDoohmain')
      forzar(esNull, { ...VISTA_DOOHMAIN, publicacionEncendida: true, franjaCampana: null, filas: [], sinCreativo: [] })
      return pintar(idioma, createElement(ProgramacionDoohmain, { campanaId: 'c1', clave: 'k' }))
    },
    espanol: [
      'Horario de esta campaña en DOOHmain', 'De', 'Hora de inicio', 'Hora de fin', 'Días de la semana',
      'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom',
      'Solo para campañas sin franja horaria. Sin días marcados, sale todos los días.', 'Guardar horario',
      'Esta campaña no tiene pantallas digitales que mandar.',
    ],
    ingles: ['This campaign’s schedule in DOOHmain', 'Save schedule', 'Mon', 'Sun'],
  },
  {
    nombre: 'lo que se manda a DOOHmain (sin permiso, horario contratado)',
    pintar: async (idioma) => {
      const { ProgramacionDoohmain } = await import('../../components/demo/campanas/ProgramacionDoohmain')
      datos.puede = false
      forzar(esNull, { ...VISTA_DOOHMAIN, franjaCampana: null, filas: [], sinCreativo: [] })
      return pintar(idioma, createElement(ProgramacionDoohmain, { campanaId: 'c1', clave: 'k' }))
    },
    espanol: ['Horario de la campaña:'],
    ingles: ['Campaign schedule:'],
  },
  {
    nombre: 'candado con el monto ilegible',
    pintar: async (idioma) => {
      const { CandadoPanel } = await import('../../components/demo/campanas/CandadoPanel')
      const { CRUDO_INVALIDO } = await import('../captura-cifra')
      forzar(esVacio, '4500')
      forzar(esVacio, CRUDO_INVALIDO)
      return pintar(idioma, createElement(CandadoPanel, { campanaId: 'c1' }))
    },
    espanol: ['El monto no se entiende: la coma separa miles y el punto, decimales (212,500.50).'],
    ingles: ['The amount can’t be read'],
  },
  {
    nombre: 'candado abierto',
    pintar: async (idioma) => {
      const { CandadoPanel } = await import('../../components/demo/campanas/CandadoPanel')
      datos.readiness = { candado: true, ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true }
      return pintar(idioma, createElement(CandadoPanel, { campanaId: 'c1' }))
    },
    espanol: ['Lista para facturar'],
    ingles: ['Ready to invoice'],
  },
  {
    nombre: 'datos de facturacion (tarjeta propia)',
    pintar: async (idioma) => {
      const { DatosFacturacion } = await import('../../components/demo/campanas/DatosFacturacion')
      return pintar(idioma, createElement(DatosFacturacion, { campana: { ...CAMP, contratoUrl: 'x.pdf' } as never }))
    },
    espanol: ['Datos de facturación', 'Faltan datos fiscales', 'Ver contrato', 'Reemplazar contrato'],
    ingles: ['Billing details', 'Tax details missing', 'View contract'],
  },
  {
    nombre: 'datos de facturacion sin cliente',
    pintar: async (idioma) => {
      const { DatosFacturacion } = await import('../../components/demo/campanas/DatosFacturacion')
      return pintar(idioma, createElement(DatosFacturacion, { campana: { ...CAMP, clienteId: 'otro' } as never, sinCard: true }))
    },
    espanol: ['Esta campaña no tiene cliente asignado.'],
    ingles: ['This campaign has no client assigned.'],
  },
  {
    nombre: 'horario de transmision (franja programada)',
    pintar: async (idioma) => {
      const { FranjaProgramadaCampana } = await import('../../components/demo/campanas/FranjaProgramadaCampana')
      forzar((v) => Array.isArray(v) && v.length === 0, [
        { id: 'f1', nombre: 'Mañana', horaInicio: '06:00', horaFin: '12:00', activo: false },
        { id: 'f2', nombre: 'Tarde', horaInicio: '12:00', horaFin: '18:00', activo: true },
      ])
      forzar(esNull, {
        id: 'c1', folio: 'CA-0001', nombre: 'x', estadoComercial: 'ACTIVA', fechaInicio: '', fechaFin: '',
        franjaProgramadaId: 'f1', contratadas: [{ franjaId: null, pantallas: 2 }, { franjaId: 'zz', franjaNombre: null, pantallas: 1 }],
        avisos: [],
      })
      forzar(esTrue, false) // cargando
      forzar(esFalse, true) // puede
      return pintar(idioma, createElement(FranjaProgramadaCampana, { campanaId: 'c1' }))
    },
    espanol: [
      'Horario de transmisión', 'Vendida (no cambia aquí)', 'Todo el día (2)', 'otra franja (1)', 'Se transmite en',
      ' (dada de baja)', 'Franja de transmisión', 'Sin franja programada', 'Guardar',
    ],
    ingles: ['Broadcast schedule', 'All day (2)', 'No daypart scheduled'],
  },
  {
    nombre: 'horario de transmision (sin permiso)',
    pintar: async (idioma) => {
      const { FranjaProgramadaCampana } = await import('../../components/demo/campanas/FranjaProgramadaCampana')
      forzar((v) => Array.isArray(v) && v.length === 0, [{ id: 'f2', nombre: 'Tarde', horaInicio: '12:00', horaFin: '18:00', activo: true }])
      forzar(esNull, { id: 'c1', folio: null, nombre: 'x', estadoComercial: 'ACTIVA', fechaInicio: '', fechaFin: '',
        franjaProgramadaId: null, contratadas: [], avisos: [] })
      forzar(esTrue, false)
      return pintar(idioma, createElement(FranjaProgramadaCampana, { campanaId: 'c1' }))
    },
    espanol: ['Solo el gerente de ventas, el director comercial y la dirección pueden cambiar el', 'horario de transmisión.'],
    ingles: ['Only the sales manager'],
  },
  {
    nombre: 'creativos en DOOHmain, pausar',
    pintar: async (idioma) => {
      const { CreativosEnDoohmain } = await import('../../components/demo/campanas/CreativosEnDoohmain')
      forzar(esNull, CREATIVOS_DOOHMAIN)
      forzar(esNull, null)
      forzar(esNull, { cr: CREATIVOS_DOOHMAIN[0], accion: 'pausar' })
      return pintar(idioma, createElement(CreativosEnDoohmain, { campanaId: 'c1' }))
    },
    espanol: [
      'En DOOHmain ahora', 'Volver a preguntar a DOOHmain', 'sin pantallas registradas', 'Sin confirmar', 'Pausar', 'Reanudar',
      'Pausar en DOOHmain', 'Sí, pausar', 'deja de reproducirse en', '2 pantalla(s) de DOOHmain. El arte se queda en su lista y se',
      'puede reanudar cuando quieras.',
    ],
    ingles: ['In DOOHmain now', 'Pause', 'Yes, pause'],
  },
  {
    nombre: 'creativos en DOOHmain, reanudar',
    pintar: async (idioma) => {
      const { CreativosEnDoohmain } = await import('../../components/demo/campanas/CreativosEnDoohmain')
      forzar(esNull, CREATIVOS_DOOHMAIN)
      forzar(esNull, null)
      forzar(esNull, { cr: CREATIVOS_DOOHMAIN[0], accion: 'reanudar' })
      return pintar(idioma, createElement(CreativosEnDoohmain, { campanaId: 'c1' }))
    },
    espanol: ['Reanudar en DOOHmain', 'Sí, reanudar', 'vuelve a reproducirse en', 'DOOHmain con la programación que ya tenía.'],
    ingles: ['Resume in DOOHmain', 'Yes, resume'],
  },
  {
    nombre: 'extender campana (sin contrato)',
    pintar: async (idioma) => {
      const { ExtenderCampanaDialog } = await import('../../components/demo/campanas/ExtenderCampanaDialog')
      return pintar(idioma, createElement(ExtenderCampanaDialog, { campana: CAMP, onClose: () => {}, onDone: () => {} }))
    },
    espanol: [
      'Extender campaña', 'Nueva fecha de fin', 'Contrato firmado de la extensión (PDF)', 'Adjuntar contrato (PDF)',
      'Sin el contrato firmado de la extensión no se puede extender. Queda en el expediente de la',
      'campaña junto con el folio del tramo nuevo; el contrato original del cliente no se toca.', 'Extender', 'Cancelar',
    ],
    ingles: ['Extend campaign', 'New end date', 'Attach contract (PDF)'],
  },
  {
    nombre: 'extender campana (con contrato)',
    pintar: async (idioma) => {
      const { ExtenderCampanaDialog } = await import('../../components/demo/campanas/ExtenderCampanaDialog')
      forzar(esNull, { nombre: 'ext.pdf', url: 'data:x' })
      return pintar(idioma, createElement(ExtenderCampanaDialog, { campana: CAMP, onClose: () => {}, onDone: () => {} }))
    },
    espanol: ['Quitar contrato'],
    ingles: ['Remove contract'],
  },
  {
    nombre: 'extensiones con contrato',
    pintar: async (idioma) => {
      const { ExtensionesCampana } = await import('../../components/demo/campanas/ExtensionesCampana')
      forzar(esNull, [{ id: 'e1', folio: 'CA-0001.1', fechaFinAnterior: '2026-06-30', fechaFinNueva: '2026-07-31',
        contratoUrl: 'x.pdf', usuarioNombre: 'Ana' }])
      return pintar(idioma, createElement(ExtensionesCampana, { campana: CAMP }))
    },
    espanol: ['Ver contrato', ' · Ana'],
    ingles: ['Jun 30, 2026 → Jul 31, 2026', 'View contract'],
  },
  {
    nombre: 'extensiones vacias',
    pintar: async (idioma) => {
      const { ExtensionesCampana } = await import('../../components/demo/campanas/ExtensionesCampana')
      forzar(esNull, [])
      return pintar(idioma, createElement(ExtensionesCampana, { campana: { ...CAMP, fechaFin: null } }))
    },
    espanol: ['Sin extensiones con contrato.'],
    ingles: ['No extensions with a contract.'],
  },
  {
    nombre: 'proof of play: de esta campana',
    pintar: async (idioma) => {
      const { PlaylogsPanel } = await import('../../components/demo/campanas/PlaylogsPanel')
      forzar(esNull, CONSULTAS)
      forzar(esFalse, true)
      return pintar(idioma, createElement(PlaylogsPanel, { campanaId: 'c1', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }))
    },
    espanol: [
      'Cuántas veces se reprodujo el creativo en las pantallas digitales, según lo que reporta',
      'De esta campaña', 'Historial de sus pantallas', 'Desde', 'Hasta', 'Consultar a DOOHmain',
      '2026-01-01 a 2026-01-31', 'Fuente: DOOHmain · consultado', 'DOOHmain no reporta reproducciones en ese rango.',
      'Es lo esperado mientras la campaña no haya salido al aire. Un cero aquí es lo que',
      'Consultas anteriores (3)', 'error', 'sin reproducciones', 'con datos',
    ],
    ingles: ['This campaign', 'Ask DOOHmain', 'Previous queries (3)'],
  },
  {
    nombre: 'proof of play: historial de pantallas con datos',
    pintar: async (idioma) => {
      const { PlaylogsPanel } = await import('../../components/demo/campanas/PlaylogsPanel')
      forzar(esNull, [{ ...CONSULTAS[3], tipo: 'metrics' }])
      forzar(esFalse, true)
      forzar(es('campana'), 'pantallas')
      return pintar(idioma, createElement(PlaylogsPanel, { campanaId: 'c1' }))
    },
    espanol: [
      'Todo lo que DOOHmain registró en las pantallas donde se publicó esta campaña, día por día. Incluye',
      'no cuenta como prueba de esta campaña', 'DOOHmain devolvió datos. Se muestran sin interpretar: todavía no hemos visto una',
    ],
    ingles: ['does not count as proof for this campaign'],
  },
  {
    nombre: 'proof of play: sin consultas y sin publicar',
    pintar: async (idioma) => {
      const { PlaylogsPanel } = await import('../../components/demo/campanas/PlaylogsPanel')
      const a = pintar(idioma, createElement(PlaylogsPanel, { campanaId: 'c1' }))
      forzar(esNull, [])
      forzar(esFalse, true)
      return a + pintar(idioma, createElement(PlaylogsPanel, { campanaId: 'c1' }))
    },
    espanol: [
      'Esta campaña no está publicada en DOOHmain, así que no hay reproducciones que consultar.',
      'Las pantallas fijas se comprueban con las evidencias fotográficas.',
      'Aún no se ha consultado. Elige un rango y pregunta.',
    ],
    ingles: ['Not queried yet.'],
  },
  {
    nombre: 'galeria de evidencias con fotos',
    pintar: async (idioma) => {
      const { EvidenciaGaleria } = await import('../../components/demo/campanas/EvidenciaGaleria')
      return pintar(idioma, createElement(EvidenciaGaleria, {
        fotos: [{ url: 'http://x/a.jpg', tomadaEn: '2026-01-01T10:00:00Z', subidaEn: '2026-01-01T11:00:00Z' }, { url: 'mock://b' }],
      }))
    },
    espanol: ['alt="evidencia"', 'foto', 'Fecha de creación de la imagen', 'Fecha de subida'],
    ingles: ['Upload date'],
  },
  {
    nombre: 'agregar creativo con codigo y vista previa',
    pintar: async (idioma) => {
      const { AgregarCreativo } = await import('../../components/demo/campanas/AgregarCreativo')
      forzar(esFalse, false) // subiendo
      forzar(esFalse, true) // codeOpen
      forzar(esNull, { nombre: 'Banner', codigo: '<p>x</p>' })
      return pintar(idioma, createElement(AgregarCreativo, { campanaId: 'c1' }))
    },
    espanol: [
      'Nombre del creativo', 'Pega aquí el código del creativo (HTML/UTF)…', 'Vista previa', 'Vista previa del creativo',
      'Subir creativo', 'Así se verá el creativo en la pantalla:',
    ],
    ingles: ['Creative name', 'Upload creative', 'Creative preview'],
  },
  {
    nombre: 'menu de campanas plegado',
    pintar: async (idioma) => {
      const { CampanasNavVista } = await import('../../components/demo/campanas/CampanasNav')
      return pintar(idioma, createElement(CampanasNavVista, { campanas: [CAMP] as never, activeId: 'c1', plegado: true, onAlternar: () => {} }))
    },
    espanol: ['Mostrar el menú de campañas', 'Mostrar', 'Campañas (1)', 'Activa'],
    ingles: ['Show the campaign menu', 'Campaigns (1)', 'Active'],
  },
  {
    nombre: 'listas de la ficha vacias',
    pintar: async (idioma) => {
      const { ListaImpresionCampana, ListaOTCampana } = await import('../../components/demo/campanas/ListasCampana')
      return pintar(idioma, createElement('div', null,
        createElement(ListaImpresionCampana, { ordenes: [] }), createElement(ListaOTCampana, { ordenes: [], trail: [] })))
    },
    espanol: ['Sin órdenes de impresión.', 'Sin órdenes de trabajo.'],
    ingles: ['No print orders.', 'No work orders.'],
  },

  // ─── FINANZAS ───────────────────────────────────────────────────────────
  {
    nombre: 'finanzas (con datos, una factura desplegada y su comprobante)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      forzar((v) => v instanceof Set, new Set(['f0']))
      forzar(esNull, 'f0') // verFactura
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Facturación, cobranza y renta a arrendadores', 'Resumen del periodo', 'Este mes', 'Mes pasado', 'Trimestre',
      'Trimestre pasado', 'Año', 'Rango', 'Periodo', 'Listas para facturar', ' · IVA inc.', 'Generar factura',
      'Cobranza', 'Cuotas', 'Vencidas', 'Por vencer', 'Al corriente', 'Folio', 'Folio fiscal', 'Cliente', 'Monto',
      'Plazo', 'Vence', 'Estatus', 'Emite: ', '0 de 2 cuotas pagadas', '90 días', 'Vencida',
      'Cuota 1 de 2', 'saldo ', 'Pagos y comprobantes', 'Registrar pago', 'Recordar', '2 enviados', '1 enviado',
      'Pagada', 'Facturas', 'Emitidas', 'Pagadas', 'Anuladas', 'Emitida', 'Campaña', 'La emite',
      'Ver el comprobante', 'Anulada', 'Ver todas (11)', 'Estado de cuenta', 'Todos los clientes', 'Mes', 'CSV',
      'Comprobante F-000', 'La recibe', 'Uso: ', 'Serie', 'Fecha de emisión', 'Subtotal', 'Imprimir', 'Cerrar',
      'Emite: Sin asignar',
    ],
    ingles: [
      'Collections', 'Invoices', 'Account statement', 'Payment receipt F-000', 'Invoice no.', 'CFDI UUID', 'Payment terms', 'Payments and proof of payment', 'Billed to', 'CFDI use: G03', 'Installment 1 of 2', '2 sent', '1 sent', 'Show all (11)',
      // Costura: `etiquetaAsignacion` con el idioma.
      'Issued by: Unassigned',
    ],
  },
  {
    nombre: 'finanzas vacia',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      datos.facturas = []
      datos.cobranzas = []
      datos.resumen = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Sin facturas en cobranza.', 'Todavía no hay facturas',
      'Aquí aparecerán en cuanto emitas la primera desde «Listas para facturar».',
      'Nada por facturar ahora. Cuando una campaña complete su candado (OC + fotos + reporte) aparecerá aquí.',
    ],
    // «proof photos», como la condicion del candado en la ficha (costura).
    ingles: ['No invoices yet', 'Nothing to invoice right now.', '(PO + proof photos + report)'],
  },
  {
    nombre: 'finanzas sin permiso de facturar',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      datos.puede = false
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Lista · requiere Finanzas'],
    ingles: ['Ready · requires Finance'],
  },
  {
    nombre: 'generar factura en parcialidades',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      forzar(esNull, CAMP) // facturar
      forzarEn('GenerarFacturaDialog', esFalse, true) // enCuotas
      forzarEn('GenerarFacturaDialog', esVacio, 'MENSUAL') // periodicidad
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Generar factura', 'Subtotal (neto)', 'IVA (16%)', 'Total', 'Con cuál de tus razones sociales se emite',
      'Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales;',
      'la factura se emite igual y queda «sin asignar».', 'Cobrar en parcialidades', '· campaña de 6 meses',
      'Cuotas', '6 cuotas mensuales', '3 cuotas bimestrales', 'Primer vencimiento', '6 cuotas de',
      '(la última ajusta el redondeo) · suman', 'Plazo de cobranza (informativo con parcialidades)', '60 días', '90 días',
      'Emitir factura', 'Cancelar', 'Sin asignar…',
    ],
    ingles: [
      'Issue invoice', 'Bill in installments', '6 monthly installments', 'Payment terms (for reference only when billing in installments)',
      // Costura: `opcionesDeAsignacion` con el idioma.
      'Unassigned…',
    ],
  },
  {
    nombre: 'generar factura de una campana de un mes',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      forzar(esNull, { ...CAMP, fechaFin: '2026-01-31' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['· campaña de 1 mes', 'Plazo de cobranza'],
    ingles: ['· 1-month campaign'],
  },
  {
    nombre: 'generar factura de una campana sin duracion',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      forzar(esNull, { ...CAMP, fechaFin: '2025-01-01' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Esta campaña dura 0 meses: no admite un', 'reparto en cuotas iguales, así que se cobra en una sola exhibición.'],
    ingles: ['This campaign lasts 0 months'],
  },
  {
    nombre: 'registrar pago que excede el saldo',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/finanzas/page')
      forzar(esNull, null)
      forzar(esNull, null)
      forzar(esNull, null)
      forzar(esNull, { id: 'cb1', folio: 'F-000', saldo: 1000 })
      forzar(es('1000'), '2000')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Registrar pago', 'F-000 · saldo', 'Monto del abono', 'Fecha en que se recibió', 'Comprobante de pago',
      'Adjuntar PDF o imagen', '⚠ El monto excede el saldo (', '). Solo se aplicará el saldo pendiente.',
      'Al cubrir el saldo total, la cobranza pasa a', 'y se detienen los recordatorios.', 'Liquidar total', 'Registrar abono',
    ],
    ingles: ['Record payment', 'Record full payment', 'Record partial payment'],
  },
  {
    nombre: 'pagos recibidos',
    pintar: async (idioma) => {
      const { PagosCobranzaModal } = await import('../../components/demo/finanzas/ComprobantePago')
      forzar(esNull, [
        { id: 'a1', monto: 100, fecha: '2026-01-02', origen: 'registro', registradoPor: 'Ana', tieneComprobante: true },
        { id: 'a2', monto: 50, fecha: null, origen: 'historico', registradoPor: null, tieneComprobante: false },
      ])
      return pintar(idioma, createElement(PagosCobranzaModal, { cobranzaId: 'cb1', folio: 'F-000', puedeAdjuntar: true, onClose: () => {} }))
    },
    espanol: ['Pagos recibidos', 'Sin fecha', ' · cobrado antes del 08/10 (aproximado)', 'Comprobante', 'Sin comprobante', 'Reemplazar', 'Adjuntar', 'Cerrar'],
    ingles: ['Payments received', 'No date', 'No proof of payment'],
  },
  {
    nombre: 'pagos recibidos: cargando y vacio',
    pintar: async (idioma) => {
      const { PagosCobranzaModal } = await import('../../components/demo/finanzas/ComprobantePago')
      const a = pintar(idioma, createElement(PagosCobranzaModal, { cobranzaId: 'cb1', folio: 'F-000', puedeAdjuntar: true, onClose: () => {} }))
      forzar(esNull, [])
      return a + pintar(idioma, createElement(PagosCobranzaModal, { cobranzaId: 'cb1', folio: 'F-000', puedeAdjuntar: true, onClose: () => {} }))
    },
    espanol: ['Cargando…', 'Esta cobranza aún no tiene pagos registrados.'],
    ingles: ['This collection has no payments recorded yet.'],
  },
  {
    nombre: 'campo de comprobante con archivo',
    pintar: async (idioma) => {
      const { CampoComprobante } = await import('../../components/demo/finanzas/ComprobantePago')
      return pintar(idioma, createElement(CampoComprobante, { nombre: 'recibo.pdf', onCambio: () => {}, onQuitar: () => {} }))
    },
    espanol: ['Comprobante de pago', 'aria-label="Quitar"'],
    ingles: ['Proof of payment'],
  },
  {
    nombre: 'estado de cuenta con movimientos',
    pintar: async (idioma) => {
      const { EstadoCuenta } = await import('../../components/demo/finanzas/EstadoCuenta')
      forzar(esNull, RESUMEN_FIN)
      return pintar(idioma, createElement(EstadoCuenta))
    },
    espanol: [
      'Estado de cuenta', 'Todos los clientes · Noviembre 2026', 'Saldo al inicio', '+ Facturado', '− Cobrado',
      '= Saldo al cierre', 'Vencido al 02/11/2026', 'Fecha', 'Movimiento', 'Cargo', 'Abono', 'Saldo', 'Factura',
      'Pago recibido', 'fecha aproximada', 'Pago anterior a que el sistema guardara fechas: lleva la fecha de su factura',
    ],
    // Costura: la etiqueta del periodo la manda el servidor en espanol; en
    // ingles se rearma con `etiquetaPeriodo` (lote compartidos).
    ingles: ['Opening balance', 'Closing balance', 'Overdue as of Nov 2, 2026', 'Payment received', 'All clients · November 2026'],
  },
  {
    nombre: 'estado de cuenta sin movimientos',
    pintar: async (idioma) => {
      const { EstadoCuenta } = await import('../../components/demo/finanzas/EstadoCuenta')
      forzar(esNull, { ...RESUMEN_FIN, movimientos: [] })
      return pintar(idioma, createElement(EstadoCuenta))
    },
    espanol: ['Sin facturas ni pagos en noviembre 2026.'],
    ingles: ['No invoices or payments in November 2026.'],
  },
  {
    nombre: 'resumen del periodo con cifras',
    pintar: async (idioma) => {
      const { TableroPeriodo } = await import('../../components/demo/finanzas/TableroPeriodo')
      forzar(esNull, RESUMEN_FIN)
      forzar(esTrue, false)
      return pintar(idioma, createElement(TableroPeriodo))
    },
    espanol: [
      'Noviembre 2026 · 01/11/2026 a 30/11/2026', 'Por cobrar al cierre', 'al inicio: ', 'Vencido',
      '2 facturas al 02/11/2026', 'Facturado', '1 factura', 'Cobrado', 'pagos recibidos en el periodo',
      'Renta a propietarios', 'Pagada', 'Por pagar del periodo',
      'de lo cobrado son pagos de antes de que el sistema guardara la fecha de',
      'cada pago: se fecharon con la fecha de su factura, así que su mes es aproximado.',
    ],
    ingles: ['Receivable at close', 'Overdue', '2 invoices as of Nov 2, 2026', '1 invoice', 'Rent to landlords', 'November 2026 · Nov 1, 2026 to Nov 30, 2026'],
  },
  {
    // Costura: con un rango a mano la etiqueta del servidor YA son las fechas;
    // en ingles el subtitulo las pinta una vez, no dos.
    nombre: 'resumen del periodo con un rango a mano',
    pintar: async (idioma) => {
      const { TableroPeriodo } = await import('../../components/demo/finanzas/TableroPeriodo')
      forzar(esNull, {
        ...RESUMEN_FIN,
        periodo: { desde: '2026-01-05', hasta: '2026-03-09', etiqueta: '2026-01-05 a 2026-03-09' },
      })
      forzar(esTrue, false)
      return pintar(idioma, createElement(TableroPeriodo))
    },
    espanol: ['2026-01-05 a 2026-03-09 · 05/01/2026 a 09/03/2026'],
    ingles: ['Jan 5, 2026 to Mar 9, 2026'],
  },
  {
    nombre: 'resumen del periodo: rango sin fechas',
    pintar: async (idioma) => {
      const { TableroPeriodo } = await import('../../components/demo/finanzas/TableroPeriodo')
      forzar(es('mes'), 'rango')
      return pintar(idioma, createElement(TableroPeriodo))
    },
    espanol: ['Elige la fecha de inicio y la de fin.', 'aria-label="Desde"', 'aria-label="Hasta"'],
    ingles: ['Choose the start and end dates.', 'Custom range', 'This quarter', 'This year'],
  },
  {
    nombre: 'comprobante de una factura que no cuadra',
    pintar: async (idioma) => {
      const { ComprobanteDialog } = await import('../../components/demo/finanzas/ComprobanteDialog')
      return pintar(idioma, createElement(ComprobanteDialog, {
        factura: { ...FACTURAS[0], igv: 1 } as never, campanas: [CAMP], entidades: [], onOpenChange: () => {},
        formatMonto: (n: number) => String(n),
      }))
    },
    espanol: [
      'Los importes de este comprobante no cuadran: el subtotal más el IVA no da el total.', 'Revísalo antes de entregarlo.',
      // El emisor sin asignar y la fecha tal cual la guarda la factura.
      'Sin asignar', '2026-10-01',
    ],
    // Costura: el emisor de `armarComprobante` y la fecha, en ingles.
    ingles: ['The amounts on this payment receipt do not add up', 'Unassigned', 'Oct 1, 2026'],
  },
  {
    // Retoque de la costura (validador): con un rango a mano, «in {periodo}»
    // salia «No invoices or payments in Jan 5, 2026 to Mar 9, 2026.». El
    // espanol sigue como siempre (la etiqueta del servidor en minusculas).
    nombre: 'estado de cuenta sin movimientos, con un rango a mano',
    pintar: async (idioma) => {
      const { EstadoCuenta } = await import('../../components/demo/finanzas/EstadoCuenta')
      forzar(esNull, {
        ...RESUMEN_FIN,
        movimientos: [],
        periodo: { desde: '2026-01-05', hasta: '2026-03-09', etiqueta: '2026-01-05 a 2026-03-09' },
      })
      return pintar(idioma, createElement(EstadoCuenta))
    },
    espanol: ['Sin facturas ni pagos en 2026-01-05 a 2026-03-09.'],
    ingles: ['No invoices or payments from Jan 5, 2026 to Mar 9, 2026.'],
  },
]

describe('lote CAMPANAS y FINANZAS · en ESPANOL sale el texto de siempre', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(texto(f)))).toEqual([])
    })
  })
})

describe('lote CAMPANAS y FINANZAS · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(texto(f)) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito.
const COMUNES = new Set<string>([
  'Total', 'Error', 'No', 'snapshot', 'CSV', 'Subtotal', ' · Ana',
  // Cortas que chocan con texto ingles («De» en «Delivery», «Mar» y «Mes»).
  'De', 'Mar', 'Mes',
  // «Serie» esta dentro de «Series».
  'Serie',
  // Coinciden con datos de prueba: «Pantalla Reforma», «Campaña Verano», «Validar 0».
  'Pantalla', 'Campaña', 'Validar',
])

describe('lote CAMPANAS y FINANZAS · barrido con el diccionario entero', () => {
  it('ninguna frase espanola de los dos diccionarios aparece en las pantallas en ingles', async () => {
    // Las listas de arriba son a mano y se pueden quedar cortas. Esta usa los
    // diccionarios: de cada texto espanol se sacan los trozos fijos (lo que hay
    // entre huecos) y se buscan en el HTML ingles de TODAS las pantallas. Un
    // `t()` olvidado deja su frase espanola a la vista y cae aqui.
    const { ES_CAMPANAS, EN_CAMPANAS } = await import('./textos/campanas')
    const { ES_FINANZAS, EN_FINANZAS } = await import('./textos/finanzas')
    // Solo lo que se LEE: nodos de texto y atributos visibles.
    let html = ''
    for (const p of PANTALLAS) {
      // Cada pantalla arranca de los datos de siempre: varias los cambian.
      reiniciar()
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Costura (2026-11-02): ya NO se quitan el aviso de la franja
    // (`AvisoFranjaCMS`) ni el horario de `lib/doohmain-programacion.ts`
    // («Todo el día (sin franja)»): los dos salen traducidos y, si alguien
    // vuelve a pintarlos sin idioma, este barrido lo ve. Solo se quitan los
    // nombres de los datos de prueba.
    const ajenos = ['Pantalla Reforma', 'Pantalla Sur', 'Pantalla Norte', 'Pantalla Oriente']
    for (const a of ajenos) html = html.split(a).join('\n')
    const culpables: string[] = []
    const pares: [Record<string, string>, Record<string, string>][] = [
      [ES_CAMPANAS, EN_CAMPANAS],
      [ES_FINANZAS, EN_FINANZAS],
    ]
    for (const [es, en] of pares) {
      for (const [clave, frase] of Object.entries(es)) {
        for (const trozo of frase.split(/\{\w+\}/)) {
          const t = trozo.trim()
          // Trozos cortos («Total», «Cliente:») chocan con texto ingles o datos.
          if (t.length < 8 || en[clave].includes(t)) continue
          if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
        }
      }
    }
    expect(culpables).toEqual([])
  })
})

describe('costura · el periodo de Finanzas en ingles', () => {
  it('con un rango a mano, el subtitulo no repite las fechas', async () => {
    reiniciar()
    const p = PANTALLAS.find((x) => x.nombre === 'resumen del periodo con un rango a mano')!
    const html = texto(await p.pintar('en'))
    expect(html).not.toContain('Mar 9, 2026 · Jan 5, 2026')
    // Ni la etiqueta espanola del servidor tal cual llega.
    expect(html).not.toContain('2026-01-05 a 2026-03-09')
  })
})

describe('costura · los MODULOS COMPARTIDOS en las pantallas de Campanas y Finanzas', () => {
  it('ninguna frase espanola de `textos/compartidos.ts` aparece en ingles', async () => {
    // El segundo barrido de `pantallas-propuestas.test.ts`, sobre este lote
    // (costura, 2026-11-02): la reserva, la frecuencia, el horario de DOOHmain
    // y la etiqueta del periodo salen de modulos compartidos. Umbral de 4 letras
    // y palabra entera, como alli.
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    let html = ''
    for (const p of PANTALLAS) {
      reiniciar()
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    for (const a of ['Pantalla Reforma', 'Pantalla Sur', 'Pantalla Norte', 'Pantalla Oriente']) html = html.split(a).join('\n')
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_COMPARTIDOS)) {
      const en = EN_COMPARTIDOS[clave as keyof typeof EN_COMPARTIDOS]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en.includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})
