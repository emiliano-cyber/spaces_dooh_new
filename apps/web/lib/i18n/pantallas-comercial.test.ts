import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { huellasEnItaliano } from './guardias-italiano'
import { huellasEnPortugues } from './guardias-portugues'
import { culpablesEnItaliano } from '../test/barrido-italiano'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'

// ============================================================================
//  I18N · LOTE «COMERCIAL», RENDIDO DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El mismo patron que `pantallas-propuestas.test.ts` (el piloto): se monta el
//  componente REAL dentro del proveedor, se rinde con `renderToStaticMarkup` y
//  se comprueba el texto, en dos sentidos:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Pantallas: Comercial (`/comercial`) con su ficha del sitio, el alta de
//  pantalla, la reserva y la vision de Space Eye; Comercial negociacion
//  (`/comercial-opex`), y los Codigos de negociacion (`/codigos-promocionales`).
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//  `renderToStaticMarkup` no ejecuta efectos ni clics: un dialogo que se abre
//  al pulsar, una lista que llega por `fetch` en un `useEffect`, NO se pintan.
//  Sin jsdom, la unica forma de rendir esas ramas es arrancar el estado en el
//  valor que tendrian tras el clic: `useState` se envuelve y, si hay un valor
//  FORZADO en la cola y su predicado casa con el valor inicial de la llamada,
//  se usa ese. La cola se consume EN ORDEN DE RENDER (profundidad primero): un
//  `forzar(esNull, null)` es un «dejalo como esta» para saltar un estado.
//
//  ─── EL ESPANOL IDENTICO ───────────────────────────────────────────────────
//  Con `VOLCAR_HTML=<carpeta>` la prueba escribe el HTML ESPANOL de cada
//  estado en esa carpeta. Se volco ANTES de tocar los componentes y DESPUES, y
//  se compararon con `diff -r` (ver `docs/i18n/revision-comercial.md`).
//
//  ─── LO QUE NO VE ──────────────────────────────────────────────────────────
//  Desde la costura (2026-11-02) las unidades, `periodicidadLabel`,
//  `textoOrigenDoohmain`, el candado y el « (obligatorio)» de `Campo` SI se
//  comprueban: salen traducidos y el barrido con el diccionario de compartidos
//  (al final del archivo) los vigila. Siguen en espanol, y no se comprueban,
//  los motivos de `lib/negociacion.ts` y de `lib/codigo-promocional.ts`,
//  `FotoUploaderMock` y `RejillaDialog`. `SlotsBadge`, `ClientesBadge` y
//  `CalendarioDisponibilidad` ya salen traducidos (lote operaciones y clientes,
//  2026-11-02), pero los vigila `pantallas-operaciones.test.ts`, no esta. Los
//  mensajes del servidor van por I18N-05.
// ============================================================================

const forzado = vi.hoisted(() => ({
  cola: [] as Array<{ si: (inicial: unknown) => boolean; valor: unknown }>,
}))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const cabeza = forzado.cola[0]
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    if (cabeza && cabeza.si(valorInicial)) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/comercial',
}))

// Los cuadros reales van por portales de Radix, que en el servidor no pintan
// nada. Se sustituyen por su contenido en linea: lo que se mide es el TEXTO.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement(
          'div',
          null,
          createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null,
          p.children as never,
          p.footer as never,
        )
      : null,
}))
vi.mock('@/components/demo/ui/Sheet', () => ({
  Sheet: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement(
          'aside',
          null,
          createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null,
          p.children as never,
          p.footer as never,
        )
      : null,
}))
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: { open: boolean; title: string; confirmLabel?: string; children: unknown }) =>
    p.open
      ? createElement('div', null, createElement('h2', null, p.title), p.children as never, createElement('button', null, p.confirmLabel))
      : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement(
      'section',
      null,
      createElement('h3', null, p.titulo),
      p.subtitulo as never,
      p.resumen as never,
      p.accion as never,
      p.children as never,
    ),
}))
// MapLibre no existe en node, y los mapas no llevan texto del lote.
vi.mock('@/components/demo/MapView', () => ({ MapView: () => createElement('div', null, '[mapa]') }))
vi.mock('@/components/demo/comercial-opex/SelectorUbicacion', () => ({
  SelectorUbicacion: () => createElement('div', null, '[selector]'),
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => true }))

// ─── Datos de prueba ────────────────────────────────────────────────────────
const SITIO_DIGITAL = {
  id: 's1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL', esRotativo: true, exhibicion: 'digital',
  estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO', estatusLegal: 'EN_ORDEN', lat: 19.4, lng: -99.1,
  alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', claveInterna: 'K-01', codigoProveedor: 'PR-001', propio: false,
  totalSpots: 8, spotsDisponibles: 6, spotsPorHora: 360, duracionSpotSeg: 10, horario: '06:00–24:00',
  cms: 'DOOHMAIN', doohmainPantalla: null, doohmainEfectiva: 'scr_9', doohmainOrigen: 'mapa',
  resolucionPx: '1920x1080', tipoContenido: 'VIDEO', alto: 3, ancho: 6, caras: 1, tipoEstructura: 'unipolar',
  vista: 'Norte', tramo: 'Centro', iluminado: true, comercializacion: 'TRADICIONAL', enNetwork: false,
  tarifaPublicada: 30000, unidad: 'mensual', modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 100 }],
  rejilla: [], predioId: 'pr1', arrendadorId: null, maxClientes: 3, clientesActivos: 1,
  direccionComercial: 'Reforma 222', direccionPredio: 'Reforma 222 int', tieneFotos: false, notas: null,
  pausaLegal: false,
}
const SITIO_FIJO = {
  ...SITIO_DIGITAL, id: 's2', nombre: 'Muro Insurgentes', tipoMedio: 'ESPECTACULAR', esRotativo: false,
  exhibicion: 'fija', alcaldia: 'Benito Juárez', codigoProveedor: 'PR-002', totalSpots: null,
  spotsDisponibles: null, spotsPorHora: null, cms: null, tarifaPublicada: 50000, predioId: 'pr2',
  modalidadesDetalle: [], maxClientes: null, clientesActivos: 0,
}
const SITIO_PROPIO = {
  ...SITIO_FIJO, id: 's3', nombre: 'Azotea Propia', tipoMedio: 'MURAL', codigoProveedor: 'PR-003',
  estatusComercial: 'OCUPADO', estatusOperativo: 'EN_MANTENIMIENTO', estatusLegal: 'SUSPENDIDO', propio: true,
  pausaLegal: true, motivoPausaLegal: 'Litigio del predio', pausaLegalEn: '2026-10-01', tarifaPublicada: 20000,
  predioId: 'pr3', iluminado: false, comercializacion: 'PROGRAMATICO', enNetwork: true, vista: 'Sureste',
}
// Sin contrato y sin margen: la rama «sin contrato activo» de la ficha.
const SITIO_SIN_CONTRATO = {
  ...SITIO_FIJO, id: 's4', nombre: 'Valla Sur', estatusComercial: 'RESERVADO', predioId: 'pr9',
}
const CONTRATOS = [
  { id: 'c1', predioId: 'pr1', sitioId: 's1', estatus: 'VIGENTE', arrendadorId: 'ar1', montoRenta: 10000,
    periodicidad: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: null, autoRenovable: true },
  { id: 'c2', predioId: 'pr2', sitioId: 's2', estatus: 'INCOMPLETO', arrendadorId: 'ar1', montoRenta: null,
    periodicidad: null, fechaInicio: '2026-01-01', fechaFin: '2027-01-01', autoRenovable: false },
]
const PROPUESTAS = [
  { id: 'p1', folio: 'PR-0001', nombre: 'Campaña Navidad', estatus: 'ENVIADA', clienteId: null, codigoTexto: null,
    items: [{ sitioId: 's1', fechaInicio: '2026-11-01', fechaFin: '2099-11-30' }] },
  { id: 'p3', folio: 'PR-0003', nombre: 'Verano', estatus: 'RECHAZADA', clienteId: 'c1', codigoTexto: null, items: [] },
]
const CONFIG = { maxClientesPantalla: 3, loopSeg: 60, spotSeg: 10, topeDescuentoPct: 30 }

const datos = vi.hoisted(() => ({
  sitios: [] as unknown[],
  propuestas: [] as unknown[],
  margenes: [] as unknown[],
}))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useSitios: () => datos.sitios,
    usePropuestas: () => datos.propuestas,
    useClientes: () => [
      { id: 'c1', nombre: 'Refrescos del Norte' },
      { id: 'c2', nombre: 'Bebidas Sur' },
    ],
    useCampanas: () => [{ id: 'k1', clienteId: 'c2' }],
    useContratos: () => CONTRATOS,
    useArrendadores: () => [{ id: 'ar1', nombre: 'Don Pepe', telefono: '555 0101', email: 'pepe@ejemplo.mx' }],
    useReservas: () => [
      { sitioId: 's1', campanaId: 'k1', estatus: 'CONFIRMADA', fechaInicio: '2000-01-01', fechaFin: '2099-01-01' },
      { sitioId: 's2', campanaId: 'k1', estatus: 'CONFIRMADA', fechaInicio: '2000-01-01', fechaFin: '2099-01-01' },
    ],
    useConfigNegocio: () => CONFIG,
    useIncidencias: () => [{ sitioId: 's3', estatus: 'ABIERTA', descripcion: 'Lona rota' }],
    usePagosRenta: () => [
      { contratoId: 'c1', fechaPago: '2026-10-01', estatus: 'PAGADO', periodo: '2026-10-01' },
      { contratoId: 'c1', fechaPago: null, estatus: 'PENDIENTE', periodo: '2026-11-01' },
    ],
    usePredios: () => [
      { id: 'pr1', nombre: 'Predio Reforma' },
      { id: 'pr2', nombre: 'Predio Sur' },
    ],
    useMargenPorSitio: () => datos.margenes,
  }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.sitios = [SITIO_DIGITAL, SITIO_FIJO, SITIO_PROPIO]
  datos.propuestas = PROPUESTAS
  datos.margenes = [{ sitioId: 's1', tieneContrato: true, rentaMensual: 10000 }]
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

// El HTML escapa comillas y apostrofos; se comparan textos, no marcado.
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esFalse = (v: unknown) => v === false
const esVacio = (v: unknown) => v === ''
const esArregloVacio = (v: unknown) => Array.isArray(v) && v.length === 0

// El reloj va FIJO: «hace 2 h», la hora de la foto y las fechas por omision de
// la reserva salen del reloj, y sin fijarlo el HTML volcado cambia en cada
// corrida y el `diff` de antes/despues no diria nada.
const AHORA = new Date('2026-11-02T18:00:00.000Z')
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()

// ─── Comercial negociacion: un espacio con todo ─────────────────────────────
const ESPACIO = {
  id: 'e1', nombre: 'Azotea Insurgentes 1420', tipoEspacio: 'muro', direccion: 'Insurgentes 1420',
  etapa: 'NEGOCIACION', visibilidad: 'CERCANA', vendedorNombre: 'Ana', ultimoContactoEn: hace(60 * 24 * 3),
  creadoEn: '2026-09-01T12:00:00Z',
}
const ESPACIO_FRIO = {
  id: 'e2', nombre: 'Muro Tlalpan', tipoEspacio: null, direccion: null, etapa: 'CONTACTADO',
  visibilidad: null, vendedorNombre: null, ultimoContactoEn: hace(60 * 24 * 45), creadoEn: '2026-08-01T12:00:00Z',
}
const ESPACIO_SIN = {
  id: 'e3', nombre: 'Terreno Sur', tipoEspacio: null, direccion: null, etapa: 'PERDIDO',
  visibilidad: 'LEJANA', vendedorNombre: 'Ana', ultimoContactoEn: null, creadoEn: '2026-08-01T12:00:00Z',
}
const DETALLE = {
  ...ESPACIO, etapaResponsable: 3, anchoM: 12, altoM: 6, superficieM2: 400, presupuestoMin: 8000,
  presupuestoMax: 12000, presupuestoAutoriza: 'Dirección comercial', lat: 19.4, lng: -99.1,
  ubicacionFijadaPorNombre: 'Ana', ubicacionFijadaEn: '2026-10-01', ubicacionOrigen: 'BUSCADOR',
  siguientePaso: 'Mandar contrato',
  contactos: [
    { id: 'ct1', nombre: 'Sra. Carmen', papel: 'dueña', telefono: '555 0202', email: 'carmen@ejemplo.mx', esLegal: true },
    { id: 'ct2', nombre: 'Luis', papel: null, telefono: null, email: null, esLegal: false },
  ],
  ofertas: [{ id: 'o1', version: 1, fecha: '2026-10-02', importeMensual: 9000, plazoMeses: 36, estado: 'CONTRAOFERTA', notas: 'pide más' }],
  competencia: [{ id: 'cp1', nombre: 'Medios X', nota: 'ofrece 10 mil', desde: '2026-09-15' }],
  avances: [
    { id: 'a1', creadoEn: '2026-09-10T12:00:00Z', canal: 'VISITA', contactoNombre: null, usuarioNombre: null,
      etapaAnterior: 'PROSPECTO', etapaNueva: 'CONTACTADO', nota: 'Primera visita' },
    { id: 'a2', creadoEn: '2026-10-30T12:00:00Z', canal: 'LLAMADA', contactoNombre: 'Sra. Carmen', usuarioNombre: 'Ana',
      etapaAnterior: 'CONTACTADO', etapaNueva: 'NEGOCIACION', nota: 'Acepta platicar' },
  ],
  notas: [{ id: 'n1', autorNombre: null, creadoEn: '2026-10-01T12:00:00Z', texto: 'Acceso por la azotea' }],
}
const DETALLE_VACIO = {
  ...ESPACIO_SIN, etapaResponsable: null, anchoM: null, altoM: null, superficieM2: null, presupuestoMin: null,
  presupuestoMax: null, presupuestoAutoriza: null, lat: null, lng: null, siguientePaso: null,
  contactos: [], ofertas: [], competencia: [], avances: [], notas: [],
}

// ─── Codigos de negociacion ─────────────────────────────────────────────────
const CODIGOS = [
  { id: 'cd1', codigo: 'VERANO20', descuentoPct: 20, vigenteDesde: '2020-01-01', vigenteHasta: '2099-12-31', usosMaximos: 100, usos: 40 },
  { id: 'cd2', codigo: 'FUTURO', descuentoPct: 10, vigenteDesde: '2099-01-01', vigenteHasta: '2099-12-31', usosMaximos: null, usos: 0 },
  { id: 'cd3', codigo: 'VIEJO', descuentoPct: 5, vigenteDesde: '2020-01-01', vigenteHasta: '2020-12-31', usosMaximos: null, usos: 3 },
  { id: 'cd4', codigo: 'LLENO', descuentoPct: 15, vigenteDesde: '2020-01-01', vigenteHasta: '2099-12-31', usosMaximos: 2, usos: 2 },
]

// ─── Las pantallas ──────────────────────────────────────────────────────────
type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  /** Texto espanol que TIENE que salir en `es` (y no en `en`). */
  espanol: string[]
  /** Texto ingles que tiene que salir en `en`. */
  ingles: string[]
  /** Texto italiano que tiene que salir en `it` (lote L2, 2026-11-03). */
  italiano?: string[]
}

const comercial = async () => (await import('../../app/(app)/(shell)/comercial/page')).default
const ficha = async () => (await import('../../components/demo/comercial/SiteFicha')).SiteFicha
const vision = async () => (await import('../../components/demo/comercial/SpaceEyeVision')).SpaceEyeVision
const opex = async () => (await import('../../components/demo/comercial-opex/ComercialOpex')).ComercialOpex
const codigos = async () => (await import('../../components/demo/codigos/GestionCodigos')).GestionCodigos
const HOY = '2026-11-02T18:00:00.000Z'

const PANTALLAS: Pantalla[] = [
  {
    nombre: 'comercial · la lista con una propuesta abierta',
    pintar: async (idioma) => pintar(idioma, createElement(await comercial())),
    espanol: [
      'Tu red en el mapa · 3 sitios',
      'Nueva pantalla',
      'Libres para vender',
      'de 3 pantallas',
      'Slots digitales libres',
      'sumando las digitales de la vista',
      'En propuesta',
      'pantallas en 1 propuesta abierta · no bloquean',
      'Bloqueadas por contrato',
      'contrato incompleto: se arreglan en Arrendadores',
      'pantallas que piden propuestas abiertas · avisan, no bloquean',
      ' · sin cliente todavía',
      '1 pantalla · ',
      'Enviada',
      'Buscar avenida, distrito…',
      'Todos los tipos',
      'Pantalla digital',
      'Todos los distritos',
      'Toda disponibilidad',
      'No disponible',
      'Cualquier precio',
      'Inventario',
      '3 resultados',
      'Descargar estas pantallas en Excel',
      'Descargar estas pantallas en CSV',
      'Seleccionar para reservar',
      'Completar el contrato en Arrendadores',
      'Contrato incompleto',
      'Propia',
      'Pantalla propia',
      'Disponible',
      'Ocupado',
      'Ocupado o bloqueado',
      'Reservado · sin OC',
    ],
    ingles: [
      'Your network on the map · 3 sites',
      'New screen',
      'Free to sell',
      'In a proposal',
      'Blocked by contract',
      'Nov 1, 2026',
      'Incomplete contract',
      'Owned',
      'Available',
    ],
  },
  {
    nombre: 'comercial · filtros sin resultados',
    pintar: async (idioma) => {
      forzar(esVacio, 'zzz') // q
      forzar(esVacio, 'MURAL') // fTipo
      forzar(esVacio, '') // fDistrito
      forzar(esVacio, 'OCUPADO') // fDisp
      return pintar(idioma, createElement(await comercial()))
    },
    espanol: [
      'Tu red en el mapa · 0 sitios',
      'de 0 pantallas filtradas',
      'no hay digitales en la vista',
      'todas con contrato completo',
      'Limpiar (3)',
      'Ninguna pantalla cumple: «zzz» · tipo «Mural» · no disponible. Quita un filtro o pulsa Limpiar.',
      '0 resultados',
    ],
    ingles: ['Clear (3)', 'No screens match', 'click Clear'],
  },
  {
    nombre: 'comercial · sin propuestas abiertas ni digitales con slots',
    pintar: async (idioma) => {
      datos.propuestas = []
      datos.sitios = [{ ...SITIO_DIGITAL, spotsDisponibles: null, totalSpots: null, spotsPorHora: 120 }]
      return pintar(idioma, createElement(await comercial()))
    },
    espanol: ['ninguna propuesta abierta', 'las digitales no tienen slots capturados', ' slots/h'],
    ingles: ['no open proposals'],
  },
  {
    nombre: 'comercial · con una pantalla seleccionada',
    pintar: async (idioma) => {
      forzar((v) => v instanceof Set, new Set(['s1']))
      return pintar(idioma, createElement(await comercial()))
    },
    espanol: ['1 sel. · ', '/mes', 'Reservar', 'Quitar de selección'],
    ingles: ['1 selected · ', '/mo', 'Book'],
  },
  {
    nombre: 'ficha de una pantalla digital con contrato',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      return pintar(idioma, createElement(Ficha, { sitio: SITIO_DIGITAL as never, open: true, onOpenChange: () => {}, onReservar: () => {} }))
    },
    espanol: [
      'Reservar este sitio',
      'Operativo',
      'Permiso en orden',
      'Editar',
      'Pausar por situación legal',
      'Reubicar',
      'Eliminar',
      'Galería',
      'Características',
      'Código proveedor',
      'Medidas',
      'Caras',
      'Estructura',
      'Vista',
      'Norte',
      'Tramo',
      'Exhibición',
      'digital · rotativo',
      'Iluminado',
      'Sí',
      'Resolución',
      'Contenido',
      'Video',
      'Total de slots',
      'Slots disponibles',
      'Slots por hora',
      'Duración por slot',
      'Horario',
      'Id en DOOHmain',
      'scr_9 · del mapa del servidor (no está escrita en la ficha)',
      'Comercialización',
      'Tradicional',
      'En Network',
      'Inteligencia artificial · Space Eye',
      'Sincronizar con Space Eye',
      'Sincronizar',
      'Datos comerciales',
      'Tarifa publicada (mensual)',
      'Renta al arrendador (mensual)',
      'Margen',
      'Tarifas por unidad (1)',
      'CPS · costo por salida',
      'Mensual',
      'Tarifas por franja',
      'Sin rejilla: esta pantalla se vende con las tarifas de arriba a cualquier hora y en cualquier época. Añade una solo si el prime o una temporada cuestan distinto.',
      'Arrendador y renta',
      'Don Pepe',
      'Vigente',
      'Renta',
      'Cada cuándo se paga',
      'Vigencia',
      'por definir',
      'Renovación',
      'Automática',
      'Último pago',
      'Próximo:',
      'Pendiente',
      'Ubicación',
      'Dirección comercial',
      'Dirección del predio',
      'Coordenadas',
      'Disponibilidad',
    ],
    ingles: [
      'Book this site', 'Gallery', 'Commercial data', 'Rates per daypart', 'Landlord and rent', 'Jan 1, 2026', 'North',
      // Costura: `textoOrigenDoohmain`, `etiquetaUnidad` y `periodicidadLabel` con el idioma.
      'scr_9 · from the server map (not entered on the profile)',
      'CPS · cost per play', 'Monthly',
      // La unidad de la tarifa publicada es un dato («mensual»): en ingles, su nombre.
      'Published rate (monthly)',
    ],
  },
  {
    nombre: 'ficha de una pantalla propia en pausa legal, con incidencia',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      return pintar(idioma, createElement(Ficha, { sitio: SITIO_PROPIO as never, open: true, onOpenChange: () => {} }))
    },
    espanol: [
      'Sitio ocupado · no disponible para reservar',
      'En mantenimiento',
      'Permiso suspendido',
      'Pausada por situación legal',
      ' · desde 01/10/2026',
      'No disponible comercialmente mientras esté en pausa.',
      'Reanudar',
      'Incidencia activa',
      'Mural',
      'fija',
      'Programático',
      'Sureste',
      'Propia: sin renta',
      'Pantalla propia: no se le paga renta a nadie. Su costo es la luz y la operación; el margen real lo ves en ',
      'Reportes',
      'Sin tarifas por unidad. Se vende solo con la tarifa publicada de arriba; para cotizar por spot, hora o programático hay que añadirlas aquí.',
      'Pantalla propia: sin arrendador ni renta.',
    ],
    ingles: ['Not available to book (status: Occupied)', 'Paused for legal reasons', 'Active incident', 'Owned: no rent', 'Southeast'],
  },
  {
    nombre: 'ficha de una pantalla sin contrato',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      datos.margenes = []
      return pintar(idioma, createElement(Ficha, { sitio: SITIO_SIN_CONTRATO as never, open: true, onOpenChange: () => {} }))
    },
    espanol: [
      'Sitio reservado · sin oc · no disponible para reservar',
      'Sin contrato activo',
      'Sin contrato de arrendamiento activo no se puede calcular el margen: falta saber qué se paga por el espacio. Complétalo en ',
      'Sin arrendador ni renta registrados para este espacio.',
      'No',
    ],
    ingles: ['No active contract', 'No landlord or rent on record for this space.', 'Not available to book (status: Booked · no PO)'],
  },
  {
    nombre: 'ficha con sus cuadros abiertos (editar, tarifas, pausa, reubicar, eliminar)',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      forzar(esArregloVacio, []) // fotos
      forzar(esFalse, true) // editOpen
      forzar(esFalse, true) // modalidadesOpen
      forzar(esFalse, false) // rejillaOpen
      forzar(esFalse, false) // borrando
      forzar(esFalse, true) // borrarOpen
      forzar(esFalse, true) // pausaOpen
      forzar(esVacio, '') // motivoPausa
      forzar(esFalse, false) // pausando
      forzar(esFalse, true) // reubicarOpen
      forzar(esArregloVacio, []) // quitadas (ModalidadesDialog)
      forzar(esArregloVacio, [{ unidad: 'hora', tarifa: '' }]) // nuevas
      return pintar(idioma, createElement(Ficha, { sitio: SITIO_DIGITAL as never, open: true, onOpenChange: () => {} }))
    },
    espanol: [
      'Editar pantalla',
      'De la empresa: sin renta ni contrato. Se vende sin contrato y su costo es luz y operación.',
      'Tipo de medio',
      'Vista (dirección)',
      '— Sin definir —',
      'Noroeste',
      'Distrito / alcaldía',
      'Ancho (m)',
      'Alto (m)',
      'unipolar, mupi…',
      'Tarifa publicada (mensual)',
      '— Sin asignar —',
      'La renta y su periodicidad viven en el contrato, no en la pantalla. El importe se puede corregir desde la tabla de Inventario; la periodicidad y la vigencia, en Arrendadores.',
      'Cupo de clientes',
      'Máximo de clientes distintos',
      'Global: 3',
      'Cuántos anunciantes distintos pueden compartir esta pantalla a la vez. Vacío = usa el valor global (3), que se fija en Administración. Un cliente que ya está en la pantalla puede seguir metiendo campañas mientras queden slots.',
      ' Ahora mismo tiene ',
      'Especificaciones DOOH',
      'Cantidad de slots',
      'Duración por slot (s)',
      'Ej. 180',
      'Hoy se usa scr_9 (mapa del servidor)',
      'Al publicar se usa ',
      '. Escríbelo aquí para fijarlo en la ficha.',
      'Ej. 06:00–24:00',
      'Notas',
      'Guardar cambios',
      'Tarifas por unidad de venta',
      'Una tarifa por cada forma de vender esta pantalla. Es lo que usa el cotizador de Propuestas: sin una tarifa de «spot» no se puede cotizar por spot.',
      'Dejar de vender por esta unidad',
      'Añadir unidad…',
      'Añadir',
      'Guardar tarifas',
      'La pantalla saldrá de la disponibilidad comercial (queda bloqueada) hasta que la reanudes.',
      'Motivo',
      'Ej. Litigio del predio, permiso suspendido, orden de autoridad…',
      'Pausar',
      'Reubicar pantalla',
      'Mueve la pantalla a otro predio. Se generará una OT de reubicación en Operaciones.',
      'Predio destino',
      '— Elige el predio —',
      'Eliminar Pantalla Reforma',
      'Eliminar pantalla',
      'Se elimina la pantalla y deja de poder reservarse. Sus reservas y su historial quedan como estén: ',
      'esta acción no se puede deshacer',
    ],
    ingles: [
      'Edit screen', 'Rates per sales unit', ' It currently has ', 'Display address', 'Pause for legal reasons', 'Relocate screen', 'Delete screen', 'Save changes',
      // Costura: el origen del id de DOOHmain, en ingles, y la unidad de la
      // tarifa nueva («Por hora»).
      ', from the server map (not entered on the profile). Enter it here to pin it on the profile.',
      'Per hour',
      // El sitio tiene 1 cliente: con el plural cambiado saldria «1 clients.».
      ' client.',
    ],
  },
  {
    nombre: 'alta de pantalla',
    pintar: async (idioma) => {
      const { AltaSitioDialog } = await import('../../components/demo/comercial/AltaSitioDialog')
      return pintar(idioma, createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: [
      'Alta de pantalla',
      'Registra una nueva ubicación en tu inventario',
      'Crear pantalla',
      'Identificación',
      'Es de la empresa: no se le paga renta a nadie. Se puede vender sin contrato y su costo es solo luz y operación.',
      'Arrendador (dueño del espacio)',
      'Elige un arrendador…',
      'p. ej. Espectacular Av. Brasil',
      'Tipo / formato',
      'Espectacular',
      'Mobiliario urbano',
      'Puente peatonal',
      'Distrito / plaza',
      'p. ej. Miraflores',
      'Dirección física',
      'Dirección que se muestra',
      'Latitud',
      'Longitud',
      'Características del espacio',
      'Cuenta con iluminación',
      'Tarifa publicada ($)',
      'Regla de comercialización',
      'Programático',
      'Compartir a la Network (inventario no vendido)',
    ],
    ingles: ['Add a screen', 'Create screen', 'Landlord (space owner)', 'Billboard'],
  },
  {
    nombre: 'alta de pantalla digital',
    pintar: async (idioma) => {
      const { AltaSitioDialog } = await import('../../components/demo/comercial/AltaSitioDialog')
      forzar((v) => v === 'ESPECTACULAR', 'PANTALLA_DIGITAL')
      return pintar(idioma, createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: ['Resolución (px)', 'Tipo de contenido', 'Imagen', 'Otros'],
    ingles: ['Content type', 'Image', 'Other'],
  },
  {
    nombre: 'reservar dos pantallas digitales sin cupo',
    pintar: async (idioma) => {
      const { ReservaDialog } = await import('../../components/demo/comercial/ReservaDialog')
      forzar(esVacio, 'Seguros Andinos') // cliente
      const sitios = [
        { ...SITIO_DIGITAL, maxClientes: 1 },
        { ...SITIO_DIGITAL, id: 's2', nombre: 'Pantalla Sur', totalSpots: 12, spotsDisponibles: 12, maxClientes: 1 },
      ]
      return pintar(idioma, createElement(ReservaDialog, { open: true, onOpenChange: () => {}, sitios: sitios as never, onReserved: () => {} }))
    },
    espanol: [
      'Reservar sitios',
      '2 sitios seleccionados',
      'Total mensual',
      ' slots',
      ' c/u',
      'Reservar (tentativa)',
      'Nombre de campaña',
      'p. ej. Lanzamiento Q3',
      'Inicio',
      'Fin',
      'Tipo de campaña',
      'Automático (Digital — según sitios)',
      'Digital (DOOH) — sin imprenta',
      'Fijo (OOH) — con imprenta',
      'Híbrida — con imprenta',
      'Loop de ',
      ' slots por loop',
      '(referencia, de Administración → Configuración)',
      '2 de las pantallas elegidas tienen su propio número de slots, y manda el suyo.',
      '2 pantallas ya llegaron a su cupo de clientes',
      ' cliente en esas fechas (Bebidas Sur)',
      'La reserva se rechazará completa. Quita esas pantallas, cambia las fechas, o sube su cupo desde su ficha.',
      'Reserva ',
      'de 6 slots',
      'Quedan ',
    ],
    ingles: ['Book sites', '2 sites selected', 'Monthly total', 'Book (tentative)', '2 screens have reached their client cap', 'cap of 1 client on those dates, taken by Bebidas Sur', '(reference value, set in Settings)'],
  },
  {
    nombre: 'reservar una pantalla con slots propios',
    pintar: async (idioma) => {
      const { ReservaDialog } = await import('../../components/demo/comercial/ReservaDialog')
      forzar(esVacio, 'Seguros Andinos') // cliente
      const sitios = [{ ...SITIO_DIGITAL, maxClientes: 1 }]
      return pintar(idioma, createElement(ReservaDialog, { open: true, onOpenChange: () => {}, sitios: sitios as never, onReserved: () => {} }))
    },
    espanol: [
      '1 sitio seleccionado',
      'Pantalla Reforma tiene 8 slots propios y manda sobre este número.',
      'Una pantalla ya llegó a su cupo de clientes',
    ],
    ingles: ['1 site selected', 'One screen has reached its client cap'],
  },
  {
    nombre: 'space eye · sin conexion',
    pintar: async (idioma) => {
      const V = await vision()
      forzar(esNull, null) // data
      forzar((v) => v === true, false) // cargando
      forzar(esNull, 'tiempo agotado') // error
      return pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
    },
    espanol: ['No se pudo conectar con Space Eye'],
    ingles: ['Could not connect to Space Eye'],
  },
  {
    nombre: 'space eye · sin integracion',
    pintar: async (idioma) => {
      const V = await vision()
      forzar(esNull, { disponible: false, motivo: 'no_configurado' })
      forzar((v) => v === true, false)
      return pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
    },
    espanol: ['La integración con Space Eye no está configurada en este entorno.'],
    ingles: ['The Space Eye integration is not configured in this environment.'],
  },
  {
    nombre: 'space eye · sin camara',
    pintar: async (idioma) => {
      const V = await vision()
      forzar(esNull, { disponible: false })
      forzar((v) => v === true, false)
      return pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
    },
    espanol: ['Esta pantalla no tiene una cámara Space Eye vinculada (sin dispositivo con ese código).'],
    ingles: ['This screen has no linked Space Eye camera'],
  },
  {
    nombre: 'space eye · foto correcta, en grande',
    pintar: async (idioma) => {
      const V = await vision()
      forzar(esNull, {
        disponible: true,
        dispositivo: { online: true, bateriaPct: 80, ultimaConexion: hace(120), modelo: 'Moto G' },
        foto: { url: 'x.jpg', tomadaEn: hace(5), esCorrecta: true, score: 0.93, verificacionEstatus: 'OK', gps: { lat: 19.4, lng: -99.1 } },
      })
      forzar((v) => v === true, false) // cargando
      forzar(esNull, null) // error
      forzar(esFalse, true) // verFoto
      return pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
    },
    espanol: [
      'En línea',
      'Última señal hace 2 h',
      'Ver foto en grande',
      'Cámara Space Eye de Pantalla Reforma',
      'hace 5 min',
      'Anuncio correcto · confianza 93%',
      'Cámara Space Eye',
    ],
    ingles: ['Online', 'Last signal 2 h ago', '5 min ago', 'Correct ad · confidence 93%', 'Space Eye camera'],
  },
  {
    nombre: 'space eye · foto que no coincide, y sin foto',
    pintar: async (idioma) => {
      const V = await vision()
      forzar(esNull, {
        disponible: true,
        dispositivo: { online: false, bateriaPct: null, ultimaConexion: hace(60 * 24 * 3), modelo: null },
        foto: { url: 'x.jpg', tomadaEn: null, esCorrecta: false, score: 0.4, verificacionEstatus: null },
      })
      forzar((v) => v === true, false)
      const a = pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
      forzar(esNull, { disponible: true, dispositivo: { online: true, ultimaConexion: hace(0) }, foto: null })
      forzar((v) => v === true, false)
      const b = pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
      forzar(esNull, {
        disponible: true,
        dispositivo: { online: true },
        foto: { url: 'x.jpg', tomadaEn: hace(60), esCorrecta: null, score: null, verificacionEstatus: null },
      })
      forzar((v) => v === true, false)
      const c = pintar(idioma, createElement(V, { sitioId: 's1', sitioNombre: 'Pantalla Reforma' }))
      return a + b + c
    },
    espanol: [
      'Desconectado',
      'Última señal hace 3 d',
      'foto',
      'No coincide con la creatividad · 40%',
      'hace segundos',
      'La cámara está vinculada pero aún no ha subido fotos.',
      'Sin verificación IA aún',
    ],
    ingles: ['Offline', '3 d ago', 'Does not match the creative · 40%', 'The camera is linked but has not uploaded any photos yet.', 'No AI check yet'],
  },
  {
    nombre: 'comercial negociacion · un espacio con todo',
    pintar: async (idioma) => {
      const C = await opex()
      forzar(esNull, [ESPACIO, ESPACIO_FRIO]) // espacios
      forzar((v) => v === 0, 5) // total
      forzar(esNull, null) // error
      forzar(esNull, null) // elegido
      forzar(esNull, DETALLE) // detalle
      return pintar(idioma, createElement(C, { hoyIso: HOY }))
    },
    espanol: [
      'Comercial negociación',
      'Prospección de arrendadores: los espacios que se están persiguiendo, quién manda en cada uno y cómo va la negociación de su renta.',
      'Nuevo espacio',
      'En seguimiento',
      'se muestran los 2 con algo más reciente de 5',
      'En negociación',
      'todavía sin cerrar con el dueño',
      'Activos',
      'negociación cerrada',
      'Sin contacto +30 días',
      'en negociación y sin bitácora reciente',
      'Espacios en seguimiento',
      'Nombre o dirección…',
      'Todos',
      'Inactivos',
      'Sin contacto +30 d',
      'hace 3 d',
      'hace 45 d',
      ' · Cercana',
      ' · en seguimiento desde ',
      'Búsqueda del responsable',
      'Sin contacto',
      'Vecinos o intermediarios',
      'Dueño identificado',
      'En contacto con el dueño',
      'Responsable legal confirmado',
      'Pasar a «En contacto con el dueño»',
      'Último contacto: Sra. Carmen',
      'Llamada',
      'Siguiente paso:',
      'Ficha técnica',
      'Tipo de espacio',
      'Ej. espectacular en azotea, muro, unipolar',
      'Visibilidad',
      'Sin definir',
      'Lejana',
      'Área de la cara',
      'Superficie del terreno (m²)',
      'Renta autorizada, mínimo',
      'Renta autorizada, máximo',
      'Quién autoriza',
      'Ej. Dirección comercial',
      'Guardar ficha',
      'Competencia (1)',
      'desde 15/09/2026',
      'Quién',
      'Qué ofrece o qué se sabe',
      'Responsables y contactos (2)',
      'firma',
      'No firma',
      'Firma',
      'Quitar a Sra. Carmen',
      'Nombre del contacto',
      'Papel (dueño, vecina…)',
      'Teléfono',
      'Correo',
      'Es quien firma',
      'Agregar contacto',
      'Buscar dirección, coordenadas o enlace de Google Maps',
      'Calle y número, coordenadas o enlace de Google Maps',
      'Ubicar',
      'También puedes pegar coordenadas (19.4326, -99.1332 o 19°25\'57"N 99°07\'59"W) o un enlace de Google Maps. Después arrastra el pin para afinarlo.',
      'Guardada por Ana el 01/10/2026 · desde el buscador · GPS del teléfono: pendiente',
      'Ofertas de renta al arrendador (1)',
      'Versión',
      'Fecha',
      'Plazo',
      'Estado',
      '36 meses',
      'Estado de la oferta v1',
      'Contraoferta',
      'Aceptada',
      'Renta mensual',
      'Meses',
      'Notas de la oferta',
      'Nueva versión',
      'Historial (2)',
      'Canal…',
      'Visita en sitio',
      'Con quién…',
      'Qué pasó',
      'Siguiente paso',
      'Registrar contacto',
      'con Sra. Carmen',
      '· Usuario eliminado',
      'Notas adicionales (1)',
      'Nota nueva',
      'Acceso, horarios, permisos, lo que haga falta recordar…',
      'Las notas no se editan ni se borran: quedan con su autor y su fecha.',
      'Agregar nota',
      'Usuario eliminado · 01/10/2026',
    ],
    ingles: ['Lease negotiation', 'New space', 'Spaces being tracked', 'Finding the decision-maker', 'Last contact: Sra. Carmen', 'Next step:', 'Spec sheet', 'Sep 15, 2026'],
  },
  {
    nombre: 'comercial negociacion · sin espacios, con el alta abierta',
    pintar: async (idioma) => {
      const C = await opex()
      forzar(esNull, []) // espacios
      forzar(esNull, null) // error
      forzar(esNull, null) // elegido
      forzar(esNull, null) // detalle
      forzar(esFalse, true) // alta
      return pintar(idioma, createElement(C, { hoyIso: HOY }))
    },
    espanol: [
      'predios y pantallas',
      'Todavía no hay espacios. Da de alta el primero con «Nuevo espacio».',
      'Aquí verás el detalle de cada espacio: quién manda, la ficha, las ofertas al dueño y la bitácora. Da de alta el primero para empezar.',
      'Lo mínimo para empezar a darle seguimiento. La ficha, la ubicación y los contactos se completan después.',
      'Qué es',
      'Un predio (muro, azotea, terreno)',
      'Una pantalla que ya existe',
      'Ej. Azotea Insurgentes 1420',
      'Dirección',
      'Primer contacto',
      'Cómo surgió',
    ],
    ingles: ['No spaces yet.', 'A property (wall, rooftop, lot)', 'How it came up'],
  },
  {
    nombre: 'comercial negociacion · filtro vacio y un espacio perdido sin nada',
    pintar: async (idioma) => {
      const C = await opex()
      forzar(esNull, [ESPACIO_SIN, ESPACIO]) // espacios
      forzar(esNull, null) // error
      forzar(esNull, null) // elegido
      forzar(esNull, DETALLE_VACIO) // detalle
      forzar(esFalse, false) // alta
      forzar(esVacio, 'zzz') // busqueda
      return pintar(idioma, createElement(C, { hoyIso: HOY }))
    },
    espanol: [
      '0 de 2',
      'Ningún espacio coincide. Quita el filtro para ver los 2.',
      'Sin dirección · en seguimiento desde ',
      'Inactivo',
      'Todavía no se sabe con quién hablar.',
      'Todavía no se le ha ofrecido nada.',
      'Sin competencia identificada.',
      'Sin ubicación guardada · GPS del teléfono: pendiente',
      'Sin contactos registrados.',
      'Sin notas todavía.',
      // Lote servidor (02/11): el aviso de la ficha sale de `motivoEdicion`.
      'El espacio está perdido: ya solo admite notas',
    ],
    ingles: ['0 of 2', 'No spaces match.', 'Inactive', 'No notes yet.', 'The space is lost: it only accepts notes now'],
  },
  {
    nombre: 'codigos · la lista, con el selector de propuesta abierto',
    pintar: async (idioma) => {
      const G = await codigos()
      forzar(esArregloVacio, CODIGOS) // codigos
      forzar(esNull, null) // error
      forzar((v) => v === true, false) // cargando
      forzar(esNull, 'cd1') // asignando
      forzar(esVacio, 'p3') // propuestaSel
      return pintar(idioma, createElement(G))
    },
    espanol: [
      'El uso se cuenta cuando alguien aplica el código a una cotización, no cuando se cierra la venta.',
      'Es lo que permite decirle al cliente «sí, tu código vale» en el momento en que lo teclea, en vez de descubrir al firmar que ya se había acabado. A cambio, una cotización abandonada con el código puesto retiene un uso: quitarle el código, o borrarla, lo devuelve.',
      'Y se ',
      'compone',
      ' con las demás capas: un 20 % por volumen, un 20 % comercial y un 20 % de código dejan al cliente pagando el ',
      '51,2 %',
      ', no el 40 %.',
      'Códigos de esta empresa',
      'Solo de esta empresa · vigencia inclusiva',
      'Vigentes · ',
      'Próximos · ',
      'Agotados · ',
      'Vencidos · ',
      'Las promociones las pone cada empresa: estos códigos no se comparten con nadie más. Los dos extremos de la vigencia son ',
      'inclusivos',
      ' — «hasta el 30» incluye el 30. Dejar el tope de usos vacío significa ',
      'sin tope',
      '; entonces el único freno es la fecha.',
      'Código',
      'Descuento',
      'Usos',
      'Vigente',
      'Próximo',
      'Vencido',
      'Agotado',
      '20 %',
      '01/01/2020 → 31/12/2099',
      '40 de 100',
      '0 de sin tope',
      'Asignar a propuesta',
      'Eliminar: deja de poder aplicarse. Lo ya cotizado y lo ya aprobado no se mueven, pero su cuenta de usos se pierde: si vuelves a crearlo con el mismo código, empieza de cero.',
      'Propuesta para VERANO20',
      'Elige una propuesta…',
      'PR-0001 — Campaña Navidad · sin cliente · enviada',
      'PR-0003 — Verano · Refrescos del Norte · rechazada',
      'Asignar',
      'Consume un uso del código y queda ',
      'pendiente de aprobación',
      ': el cliente no lo ve hasta que un administrador o gerente lo apruebe desde la propuesta.',
      ' Esta propuesta está rechazada: asignarle el código la reactiva a borrador.',
      'Nuevo código',
      'Descuento (%)',
      'Descuento por ciento',
      'Vigente desde',
      'Vigente hasta',
      'Tope de usos',
      'Tope de usos (vacío = sin tope)',
      'Añadir código',
    ],
    ingles: [
      'Negotiation codes for this company',
      'Assign to proposal',
      '20%',
      'Jan 1, 2020 → Dec 31, 2099',
      '40 of 100',
      '0 (no cap)',
      'Limit reached',
      'PR-0003 — Verano · Refrescos del Norte · rejected',
      'New negotiation code',
      'Add negotiation code',
    ],
  },
  {
    nombre: 'codigos · cargando, vacio y sin propuestas a las que asignar',
    pintar: async (idioma) => {
      const G = await codigos()
      const a = pintar(idioma, createElement(G))
      forzar(esArregloVacio, []) // codigos
      forzar(esNull, null)
      forzar((v) => v === true, false)
      const b = pintar(idioma, createElement(G))
      datos.propuestas = []
      forzar(esArregloVacio, CODIGOS)
      forzar(esNull, null)
      forzar((v) => v === true, false)
      forzar(esNull, 'cd1')
      const c = pintar(idioma, createElement(G))
      return a + b + c
    },
    espanol: [
      'Cargando los códigos',
      'Todavía no hay ninguno. Sin códigos, todo se vende como hoy.',
      'No hay propuestas a las que asignarlo: solo se puede en una propuesta en borrador, enviada o rechazada, y que no lleve ya otro código.',
    ],
    ingles: ['Loading negotiation codes', 'None yet.'],
  },
  {
    nombre: 'codigos · el encabezado de la pagina',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/codigos-promocionales/page')
      forzar(esArregloVacio, [])
      forzar(esNull, null)
      forzar((v) => v === true, false)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Códigos de negociación',
      'Códigos con vencimiento y cupo que un vendedor aplica a una cotización. Los pone esta empresa y no se comparten con nadie más.',
    ],
    ingles: ['Negotiation codes'],
  },
  {
    // Retoque de la costura (validador, mutante M1b): ningun estado tenia un
    // sitio digital SIN id de DOOHmain, asi que quitar el `idioma` de
    // `textoOrigenDoohmain(null, idioma)` en `SiteFicha` no lo veia nadie.
    nombre: 'ficha de una pantalla digital sin id de DOOHmain',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      const sitio = { ...SITIO_DIGITAL, id: 's9', doohmainEfectiva: null, doohmainOrigen: null }
      return pintar(idioma, createElement(Ficha, { sitio: sitio as never, open: true, onOpenChange: () => {} }))
    },
    espanol: ['ninguna: al publicar, esta pantalla no recibiría nada'],
    ingles: ['none: when publishing, this screen would receive nothing'],
  },
  {
    // Ola 5 (recorrido en navegador): el dato real de una pantalla fija es
    // `fijo` (migracion g500_estaticas, el importador), no `fija`. El mapa solo
    // conocia `fija`, asi que la ficha inglesa decia «Display: fijo».
    nombre: 'ficha de una pantalla fija con el dato real «fijo»',
    pintar: async (idioma) => {
      const Ficha = await ficha()
      const sitio = { ...SITIO_FIJO, id: 's8', exhibicion: 'fijo' }
      return pintar(idioma, createElement(Ficha, { sitio: sitio as never, open: true, onOpenChange: () => {} }))
    },
    espanol: ['>fijo<'],
    ingles: ['>static<'],
  },
]

// Con `VOLCAR_HTML=<carpeta>`, el HTML espanol de cada estado a disco: es lo
// que se compara antes y despues de tocar los componentes (`diff -r`).
const VOLCAR = process.env.VOLCAR_HTML
function volcar(nombre: string, html: string) {
  if (!VOLCAR) return
  mkdirSync(VOLCAR, { recursive: true })
  writeFileSync(join(VOLCAR, `${nombre.replace(/[^\w]+/g, '_')}.html`), html)
}

describe('lote COMERCIAL · en ESPANOL sale el texto de siempre', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      volcar(p.nombre, crudo)
      const html = texto(crudo)
      const faltan = p.espanol.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

describe('lote COMERCIAL · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      // Las que coinciden en los dos idiomas (un dato, una palabra igual) no
      // cuentan: solo las que el ingles debe cambiar.
      const quedan = p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))
      expect(quedan).toEqual([])
      const faltan = p.ingles.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

describe('lote COMERCIAL · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario del lote aparece en las pantallas en ingles', async () => {
    // La lista de arriba es a mano y se puede quedar corta. Esta usa el
    // diccionario: de cada texto espanol del lote se sacan los trozos fijos
    // (lo que hay entre huecos) y se buscan en el HTML ingles de TODAS las
    // pantallas. Un `t()` olvidado deja su frase espanola a la vista y cae aqui.
    const { ES_COMERCIAL, EN_COMERCIAL } = await import('./textos/comercial')
    const { ES_CODIGOS, EN_CODIGOS } = await import('./textos/codigos')
    const ES: Record<string, string> = { ...ES_COMERCIAL, ...ES_CODIGOS }
    const EN: Record<string, string> = { ...EN_COMERCIAL, ...EN_CODIGOS }
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.sitios = [SITIO_DIGITAL, SITIO_FIJO, SITIO_PROPIO]
      datos.propuestas = PROPUESTAS
      datos.margenes = [{ sitioId: 's1', tieneContrato: true, rentaMensual: 10000 }]
      const crudo = await p.pintar('en')
      // Solo lo que se LEE: nodos de texto y los atributos visibles.
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Costura (2026-11-02): `textoOrigenDoohmain` ya recibe el idioma, asi que
    // su «mapa del servidor» ya NO se quita: si vuelve en espanol, cae aqui.
    // Y el « (obligatorio)» ya no se salta: `Campo` lo traduce desde el lote de
    // compartidos, asi que en ingles no debe quedar ninguno, sea de quien sea.
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES)) {
      const en = EN[clave]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        // Trozos cortos («de», «Total») chocan con texto ingles o con datos.
        if (t.length < 8 || en.includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito: datos
// o palabras que el glosario deja sin traducir.
const COMUNES = new Set<string>([
  'Video', // igual en los dos idiomas
  'Don Pepe', // dato
  'No', // «No» tambien es ingles
  'Mural', // igual en ingles (decision del orquestador, 2026-11-02)
  'Propia', // tambien esta dentro del nombre del sitio de prueba, «Azotea Propia»
  ' slots/h', // «slots» no se traduce
  ' slots',
  'Global: 3', // igual en ingles
  'Latitud', // esta dentro de «Latitude»
  'Longitud', // esta dentro de «Longitude»
  'Noroeste', // el VALOR de la opcion (`value="Noroeste"`) es el dato guardado; se traduce lo que se pinta
])

describe('lote COMERCIAL · los espejos reproducen EXACTAMENTE las etiquetas compartidas', () => {
  // Igual que el menu con `nav.ts` y los estatus de propuestas con `estatus.ts`:
  // las etiquetas originales siguen siendo la verdad en espanol, y si alguien
  // cambia una alla, esta prueba obliga a traerla al diccionario.
  it('estatus del sitio, tipo de medio, contrato y pago (`StatusBadge`, `tipo-medio`)', async () => {
    const { DICCIONARIOS } = await import('./diccionario')
    const { SITIO_LABEL, CONTRATO_LABEL, PAGO_LABEL } = await import('../../components/demo/StatusBadge')
    const { TIPO_MEDIO_LABEL } = await import('../tipo-medio')
    const c = await import('../../components/demo/comercial/claves')
    const pares: Array<[Record<string, string>, Record<string, string>]> = [
      [SITIO_LABEL, c.CLAVE_SITIO_ESTATUS],
      [TIPO_MEDIO_LABEL, c.CLAVE_TIPO_MEDIO],
      [CONTRATO_LABEL, c.CLAVE_CONTRATO_ESTATUS],
      [PAGO_LABEL, c.CLAVE_PAGO_ESTATUS],
    ]
    for (const [etiquetas, claves] of pares) {
      expect(Object.keys(claves).sort()).toEqual(Object.keys(etiquetas).sort())
      for (const k of Object.keys(etiquetas)) {
        expect(DICCIONARIOS.es[claves[k] as keyof typeof DICCIONARIOS.es]).toBe(etiquetas[k])
      }
    }
  })

  it('etapas, visibilidad, canales, ofertas y busqueda del responsable (`captacion`, `negociacion`)', async () => {
    const { DICCIONARIOS } = await import('./diccionario')
    const { ETIQUETA_ETAPA } = await import('../captacion')
    const n = await import('../negociacion')
    const o = await import('../../components/demo/comercial-opex/ComercialOpex')
    const pares: Array<[Record<string, string>, Record<string, string>]> = [
      [ETIQUETA_ETAPA, o.CLAVE_ETAPA],
      [n.ETIQUETA_VISIBILIDAD, o.CLAVE_VISIBILIDAD],
      [n.ETIQUETA_CANAL, o.CLAVE_CANAL],
      [n.ETIQUETA_OFERTA, o.CLAVE_OFERTA],
    ]
    for (const [etiquetas, claves] of pares) {
      expect(Object.keys(claves).sort()).toEqual(Object.keys(etiquetas).sort())
      for (const k of Object.keys(etiquetas)) {
        expect(DICCIONARIOS.es[claves[k] as keyof typeof DICCIONARIOS.es]).toBe(etiquetas[k])
      }
    }
    expect(o.CLAVE_RESPONSABLE.map((k) => DICCIONARIOS.es[k])).toEqual([...n.ETAPAS_RESPONSABLE])
  })
})

describe('costura · los MODULOS COMPARTIDOS en las pantallas de Comercial', () => {
  it('ninguna frase espanola de `textos/compartidos.ts` aparece en ingles', async () => {
    // El mismo segundo barrido que hace `pantallas-propuestas.test.ts`, ahora
    // sobre Comercial (costura, 2026-11-02): las unidades, las periodicidades y
    // el origen del id de DOOHmain salen de modulos compartidos, y una llamada
    // sin `idioma` deja su espanol a la vista sin que lo vea el barrido del
    // lote (que solo mira `comercial.*` y `codigos.*`). Umbral de 4 letras y
    // palabra entera, como alli.
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.sitios = [SITIO_DIGITAL, SITIO_FIJO, SITIO_PROPIO]
      datos.propuestas = PROPUESTAS
      datos.margenes = [{ sitioId: 's1', tieneContrato: true, rentaMensual: 10000 }]
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
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

// ─── El dinero: el simbolo de la moneda de la INSTANCIA (dueno, 2026-11-02) ──
//
// En ingles, una instancia MXN escribe `MX$` y una USD `$`; en espanol, MXN
// `$` y USD `US$` (la tabla de `lib/i18n/dinero.ts`). Antes de este cambio las
// pantallas traducidas llamaban `formatMonto(n)` sin idioma y el ingles de una
// instancia MXN escribia `$`: un lector anglosajon lo lee como dolares. Se
// mira el HTML pintado, con las DOS monedas y en los DOS idiomas, y se exige
// que haya importes que mirar (un arnes que no encuentra ninguno no prueba
// nada).
describe('lote COMERCIAL · cada importe lleva el simbolo de la moneda de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  const vistos: Record<string, number> = {}
  for (const moneda of MONEDAS) {
    for (const idioma of ['es', 'en', 'it'] as const) {
      PANTALLAS.forEach((p) => {
        it(`${moneda} · ${idioma} · ${p.nombre}`, async () => {
          fijarMonedaInstancia(moneda)
          const { importes, ajenos } = leerDinero(texto(await p.pintar(idioma)), idioma, moneda)
          vistos[`${moneda}-${idioma}`] = (vistos[`${moneda}-${idioma}`] ?? 0) + importes
          expect(ajenos).toEqual([])
        })
      })
      it(`${moneda} · ${idioma} · el arnes encontro importes que mirar`, () => {
        expect(vistos[`${moneda}-${idioma}`] ?? 0).toBeGreaterThan(0)
      })
    }
  }
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote COMERCIAL · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})

// ─── ITALIANO · lote L2 «Comercial y propuestas» (2026-11-03) ───────────────
//
// Las mismas pantallas, rendidas en ITALIANO. Mientras falte una clave, el
// italiano cae al INGLES sin dar ningun error (`conCaidaAlIngles`), asi que
// aqui se mira lo pintado en tres sentidos:
//
//   (a) ninguna frase de las listas a mano (`espanol` / `ingles`) queda en el
//       HTML italiano, salvo las que el italiano dice igual a proposito o las
//       que son de OTRO ambito (otro lote: `compartidos`, `servidor`…);
//   (b) barrido con el diccionario: ningun trozo espanol NI INGLES de
//       `comercial.*` y `codigos.*` aparece en el HTML italiano (un `t()` que
//       cae al ingles deja su frase inglesa a la vista y cae aqui);
//   (c) ninguna huella de formato espanol o ingles (`guardias-italiano.ts`).
//
// Los ejemplos de los campos de cifras con decimales («Es. 12.9» en el ancho)
// llevan PUNTO a proposito: el campo se lee con `Number()`, y un «12,9» que
// el usuario copiara del ejemplo se guardaria como 0. Ver
// `docs/i18n/revision-italiano-l2-comercial.md`.
const PERMITIDOS_IT = [/^12\.9$/, /^7\.2$/, /^15,000\.50$/, /^212,500\.50$/]

// Frases de las listas que en italiano se dicen IGUAL a proposito.
const COMUNES_IT = new Set<string>([
  ...COMUNES,
  'Digital', // «Digitale» la contiene
  'Inventario', // igual en italiano
  '1 sel. · ', // igual en italiano
  '/mes', // «/mese» lo contiene
  'Operativo', 'Motivo', 'Tipo / formato', 'foto', 'firma', 'Firma', // iguales en italiano
  'Fin', // «Fine» lo contiene
  'Superficie del terreno (m²)', // igual en italiano
  'con Sra. Carmen', // «con» y el dato
  'Online', 'Offline', // iguales en italiano
  '20%', // igual en ingles y en italiano
])

// Frases inglesas de las listas que en esta pantalla NO son de este lote: las
// pinta un modulo de otro ambito (`compartidos`, `servidor`), que traduce otro
// lote. Se quedan en ingles hasta que ese lote cierre.
const AJENAS_IT = new Set<string>([
  'scr_9 · from the server map (not entered on the profile)', // compartidos (origen DOOHmain)
  ', from the server map (not entered on the profile). Enter it here to pin it on the profile.', // id: compartidos
  'CPS · cost per play', // compartidos (unidades)
  'Monthly', // compartidos (periodicidades)
  'Per hour', // compartidos (unidades)
  'none: when publishing, this screen would receive nothing', // compartidos
  'The space is lost: it only accepts notes now', // servidor
  'Published rate (monthly)', // la unidad «monthly» la pone compartidos
  ' (required)', // el « (obligatorio)» de `Campo`: compartidos
  'from the server map (not entered on the profile)', // `compartidos.doohmain.origen.mapa`, en el «Al publicar…» de la ficha
])

function legible(crudo: string): string {
  const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
  return texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
}

const ITALIANO: Record<string, string[]> = {
  'comercial · la lista con una propuesta abierta': [
    'La tua rete sulla mappa · 3 siti', 'Nuovo impianto', 'su 3 impianti', 'impianti in 1 proposta aperta · non bloccano',
    'Prenotato · senza OdA', '3 risultati', 'Occupato o bloccato',
  ],
  'comercial · filtros sin resultados': ['Azzera (3)', 'Nessun impianto corrisponde: «zzz» · tipo «Murale» · non disponibile. Togli un filtro o clicca Azzera.', '0 risultati'],
  'comercial · sin propuestas abiertas ni digitales con slots': ['nessuna proposta aperta', ' slot/h'],
  'comercial · con una pantalla seleccionada': ['1 sel. · ', '/mese', 'Togli dalla selezione'],
  'ficha de una pantalla propia en pausa legal, con incidencia': ['Non prenotabile (stato: Occupato)', 'Sospeso per motivi legali', ' · dal giorno 1 ott 2026'],
  'ficha con sus cuadros abiertos (editar, tarifas, pausa, reubicar, eliminar)': [' Al momento ha ', ' cliente.', 'Vuoto = usa il valore globale (3), che si imposta in Impostazioni.'],
  'reservar dos pantallas digitales sin cupo': [
    '2 siti selezionati', '2 impianti hanno già raggiunto il loro limite di clienti',
    ' — limite di 1 cliente in quelle date, occupato da Bebidas Sur', ' slot per loop',
  ],
  'reservar una pantalla con slots propios': [
    '1 sito selezionato', 'Pantalla Reforma ha 8 slot propri, che prevalgono su questo numero.',
    'Un impianto ha già raggiunto il suo limite di clienti',
  ],
  'space eye · foto correcta, en grande': ['Ultimo segnale 2 h fa', '5 min fa', 'Annuncio corretto · affidabilità 93%'],
  'space eye · foto que no coincide, y sin foto': ['Ultimo segnale 3 gg fa', 'pochi secondi fa', 'Non corrisponde alla creatività · 40%'],
  'comercial negociacion · un espacio con todo': [
    '36 mesi', 'MX$ 9.000,00/mese', 'dal giorno 15 set 2026', 'si mostrano i 2 con attività più recente su 5',
    'Salvata da Ana in data 1 ott 2026 · dalla ricerca · GPS del telefono: in sospeso', 'Passa a «In contatto con il proprietario»',
  ],
  'comercial negociacion · filtro vacio y un espacio perdido sin nada': ['0 di 2', 'Nessuno spazio corrisponde. Togli il filtro per vedere tutti gli spazi (2).'],
  'codigos · la lista, con el selector de propuesta abierto': [
    '51,2%', '40 di 100', '0 (senza limite)', '1 gen 2020 → 31 dic 2099', 'PR-0003 — Verano · Refrescos del Norte · rifiutata',
    'a cascata',
  ],
}
for (const p of PANTALLAS) p.italiano = ITALIANO[p.nombre]

describe('lote COMERCIAL · en ITALIANO', () => {
  // El italiano que TIENE que salir en algunas pantallas (`ITALIANO`, arriba):
  // concordancias de genero y numero con el hueco, plurales y formatos. Una
  // pantalla que no este alli solo se mira con el barrido y la guardia.
  it('las frases italianas declaradas son de pantallas que existen', () => {
    const nombres = new Set(PANTALLAS.map((p) => p.nombre))
    expect(Object.keys(ITALIANO).filter((n) => !nombres.has(n))).toEqual([])
  })

  beforeEach(() => {
    process.env.IDIOMA_ITALIANO = '1'
  })
  afterEach(() => {
    delete process.env.IDIOMA_ITALIANO
  })

  for (const p of PANTALLAS) {
    it(`${p.nombre} · sin frases espanolas ni inglesas de las listas`, async () => {
      const html = texto(await p.pintar('it'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES_IT.has(f))).toEqual([])
      expect(p.ingles.filter((f) => html.includes(f) && !COMUNES_IT.has(f) && !AJENAS_IT.has(f))).toEqual([])
      expect((p.italiano ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
    it(`${p.nombre} · sin formatos espanoles ni ingleses`, async () => {
      expect(huellasEnItaliano(await p.pintar('it'), { permitidos: PERMITIDOS_IT })).toEqual([])
    })
  }

  // Validacion del lote (V5, V6): los datos de arriba no tienen un porcentaje
  // con decimales ni una cifra de cuatro digitos, asi que una cifra sin el
  // idioma pasaba sin que nada la viera. Estados SOLO italianos: el HTML
  // espanol e ingles de las pruebas de arriba no cambia.
  it('codigos · un descuento con decimales y usos de cuatro cifras, en italiano', async () => {
    const G = await codigos()
    forzar(esArregloVacio, [
      { id: 'cd9', codigo: 'MEDIO', descuentoPct: 12.5, vigenteDesde: '2020-01-01', vigenteHasta: '2099-12-31', usosMaximos: 5000, usos: 1200 },
    ])
    forzar(esNull, null)
    forzar((v) => v === true, false)
    const html = texto(await pintar('it', createElement(G)))
    expect(html).toContain('12,5%')
    expect(html).toContain('1.200 di 5.000')
    expect(huellasEnItaliano(html)).toEqual([])
  })

  it('reserva · el total de slots con miles, en italiano', async () => {
    const { ReservaDialog } = await import('../../components/demo/comercial/ReservaDialog')
    forzar(esVacio, 'Seguros Andinos')
    const sitios = [
      { ...SITIO_DIGITAL, totalSpots: 1200, spotsDisponibles: 1200 },
      { ...SITIO_DIGITAL, id: 's2', nombre: 'Pantalla Sur', totalSpots: 1200, spotsDisponibles: 1200 },
    ]
    const html = texto(pintar('it', createElement(ReservaDialog, { open: true, onOpenChange: () => {}, sitios: sitios as never, onReserved: () => {} })))
    expect(html).toContain('>2.400<')
    expect(html).not.toContain('2,400')
  })

  it('barrido: ningun trozo espanol ni ingles de `comercial.*` ni `codigos.*` en el HTML italiano', async () => {
    const { ES_COMERCIAL, EN_COMERCIAL, IT_COMERCIAL } = await import('./textos/comercial')
    const { ES_CODIGOS, EN_CODIGOS, IT_CODIGOS } = await import('./textos/codigos')
    const ES: Record<string, string> = { ...ES_COMERCIAL, ...ES_CODIGOS }
    const EN: Record<string, string> = { ...EN_COMERCIAL, ...EN_CODIGOS }
    const IT: Record<string, string | undefined> = { ...IT_COMERCIAL, ...IT_CODIGOS }
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.sitios = [SITIO_DIGITAL, SITIO_FIJO, SITIO_PROPIO]
      datos.propuestas = PROPUESTAS
      datos.margenes = [{ sitioId: 's1', tieneContrato: true, rentaMensual: 10000 }]
      html += legible(await p.pintar('it'))
    }
    // Los datos de prueba no son interfaz.
    // Ni lo que pinta OTRO ambito y aun cae al ingles (sus trozos chocan con
    // los de este lote: «(required)», «server map»).
    for (const d of ['Pantalla Reforma', 'Azotea Insurgentes 1420', 'Seguros Andinos', 'Campaña Navidad', ...AJENAS_IT]) {
      html = html.split(d).join('\n')
    }
    const culpables: string[] = []
    let vistos = 0
    for (const [clave, es] of Object.entries(ES)) {
      const it = IT[clave] ?? ''
      for (const [lado, frase] of [['es', es], ['en', EN[clave]]] as const) {
        for (const trozo of frase.split(/\{\w+\}/)) {
          const t = trozo.trim()
          if (t.length < 8 || it.includes(t)) continue
          if (html.includes(t)) culpables.push(`${clave} · ${lado} «${t}»`)
        }
      }
      // Y lo contrario: el italiano SI esta (un arnes que no ve nada no prueba nada).
      if (it && it.split(/\{\w+\}/).some((t) => t.trim().length >= 8 && html.includes(t.trim()))) vistos++
    }
    expect(culpables).toEqual([])
    expect(vistos).toBeGreaterThan(250)
  })
})

// ============================================================================
//  LOTE L2 DEL PORTUGUES (2026-11-05) · las mismas pantallas, en portugues.
//  Como el italiano, pero con la caida al ESPANOL (que no se ve): ninguna
//  frase espanola ni inglesa de `comercial.*` ni `codigos.*` (barrido con el
//  diccionario, sin el espanol pendiente de OTROS lotes), ningun formato
//  ajeno y el portugues esperado donde hay concordancia o formato.
// ============================================================================
// Los ejemplos de captura del alta («Ex.: 12.9») siguen la captura MEXICANA
// hasta la tarea roja `feat/portugues-cifras` (P2): hoy dicen la verdad.
const PERMITIDOS_PT = [/^12\.9$/, /^7\.2$/, /^15,000\.50$/, /^212,500\.50$/]
const DATOS_PT = ['Pantalla Reforma', 'Azotea Insurgentes 1420', 'Seguros Andinos', 'Campaña Navidad']

const PORTUGUES: Record<string, string[]> = {
  'comercial · la lista con una propuesta abierta': [
    'Sua rede no mapa · 3 pontos', 'Novo ponto', 'de 3 pontos', 'pontos em 1 proposta aberta · não bloqueiam',
    'Reservado · sem PC', '3 resultados', 'Ocupado ou bloqueado', '1 ponto · 1 de nov. de 2026–30 de nov. de 2099',
  ],
  'comercial · filtros sin resultados': [
    'Limpar (3)', 'de 0 pontos filtrados',
    'Nenhum ponto corresponde a: “zzz” · tipo “Mural” · indisponível. Remova um filtro ou clique em Limpar.',
  ],
  'comercial · sin propuestas abiertas ni digitales con slots': ['nenhuma proposta aberta', '· 120 slots/h', '1 resultado'],
  'comercial · con una pantalla seleccionada': ['1 sel. · ', '/mês', 'MX$ 30.000,00'],
  'ficha de una pantalla propia en pausa legal, con incidencia': [
    'Ponto não reservável (status: Ocupado)', 'Pausado por situação legal', ' · desde 1 de out. de 2026', 'Ocorrência ativa',
  ],
  'ficha de una pantalla digital con contrato': ['Tarifa publicada (mensal)', 'MX$ 20.000,00 · 67%', 'CPS · custo por inserção'],
  'reservar dos pantallas digitales sin cupo': [
    '2 pontos selecionados', '2 pontos já atingiram seu limite de clientes', ' — limite de 1 cliente nessas datas (Bebidas Sur)',
    '2 dos pontos escolhidos têm seu próprio número de slots, que prevalece.', 'Pré-reservar',
  ],
  'reservar una pantalla con slots propios': [
    '1 ponto selecionado', 'Pantalla Reforma tem 8 slots próprios, que prevalecem sobre este número.',
    'Um ponto já atingiu seu limite de clientes',
  ],
  'space eye · foto correcta, en grande': ['Último sinal há 2 h', 'há 5 min', 'Anúncio correto · confiança 93%', '2 de nov. de 2026, 11:55'],
  'space eye · foto que no coincide, y sin foto': ['Último sinal há 3 d', 'Último sinal há poucos segundos', 'Não corresponde ao criativo · 40%'],
  'comercial negociacion · un espacio con todo': [
    '36 meses', 'MX$ 9.000,00/mês', 'desde 15 de set. de 2026', 'mostrando os 2 com atividade mais recente, de 5',
    'Salva por Ana · 1 de out. de 2026 · pela busca · GPS do celular: pendente',
  ],
  'comercial negociacion · filtro vacio y un espacio perdido sin nada': ['0 de 2', 'Nenhum espaço corresponde. Remova o filtro para ver todos (2).'],
  'codigos · la lista, con el selector de propuesta abierto': [
    '51,2%', '40 de 100', '0 (sem limite)', '1 de jan. de 2020 → 31 de dez. de 2099', 'PR-0003 — Verano · Refrescos del Norte · recusada',
    'aplica em cascata',
  ],
}

describe('lote L2 · COMERCIAL en PORTUGUES', () => {
  async function diccionarios() {
    const { ES_COMERCIAL, EN_COMERCIAL, PT_COMERCIAL } = await import('./textos/comercial')
    const { ES_CODIGOS, EN_CODIGOS, PT_CODIGOS } = await import('./textos/codigos')
    return {
      es: { ...ES_COMERCIAL, ...ES_CODIGOS } as Record<string, string>,
      en: { ...EN_COMERCIAL, ...EN_CODIGOS } as Record<string, string>,
      it: { ...PT_COMERCIAL, ...PT_CODIGOS } as Partial<Record<string, string>>,
    }
  }

  beforeEach(() => {
    process.env.IDIOMA_PORTUGUES = '1'
  })
  afterEach(() => {
    delete process.env.IDIOMA_PORTUGUES
  })

  it('las frases portuguesas declaradas son de pantallas que existen', () => {
    const nombres = new Set(PANTALLAS.map((p) => p.nombre))
    expect(Object.keys(PORTUGUES).filter((n) => !nombres.has(n))).toEqual([])
  })

  for (const p of PANTALLAS) {
    it(`${p.nombre} · sin espanol ni ingles del lote, sin formatos ajenos`, async () => {
      const crudo = await p.pintar('pt')
      volcar(`${p.nombre} en PORTUGUES`, crudo)
      expect(culpablesEnItaliano(crudo, await diccionarios(), { ignorar: [...DATOS_PT] })).toEqual([])
      expect(huellasEnPortugues(crudo, { permitidos: PERMITIDOS_PT })).toEqual([])
      const html = texto(crudo)
      expect((PORTUGUES[p.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }

  // La leccion del italiano L2 (V5, V6): sin un porcentaje con decimales ni
  // una cifra de cuatro digitos, una cifra sin el idioma pasa sin que nada la
  // vea. Estados SOLO portugueses: el HTML es/en/it de arriba no cambia.
  it('codigos · un descuento con decimales y usos de cuatro cifras, en portugues', async () => {
    const G = await codigos()
    forzar(esArregloVacio, [
      { id: 'cd9', codigo: 'MEDIO', descuentoPct: 12.5, vigenteDesde: '2020-01-01', vigenteHasta: '2099-12-31', usosMaximos: 5000, usos: 1200 },
    ])
    forzar(esNull, null)
    forzar((v) => v === true, false)
    const html = texto(await pintar('pt', createElement(G)))
    expect(html).toContain('12,5%')
    expect(html).toContain('1.200 de 5.000')
    expect(huellasEnPortugues(html)).toEqual([])
  })

  it('reserva · el total de slots con miles, en portugues', async () => {
    const { ReservaDialog } = await import('../../components/demo/comercial/ReservaDialog')
    forzar(esVacio, 'Seguros Andinos')
    const sitios = [
      { ...SITIO_DIGITAL, totalSpots: 1200, spotsDisponibles: 1200 },
      { ...SITIO_DIGITAL, id: 's2', nombre: 'Pantalla Sur', totalSpots: 1200, spotsDisponibles: 1200 },
    ]
    const html = texto(pintar('pt', createElement(ReservaDialog, { open: true, onOpenChange: () => {}, sitios: sitios as never, onReserved: () => {} })))
    expect(html).toContain('>2.400<')
    expect(html).not.toContain('2,400')
  })
})
