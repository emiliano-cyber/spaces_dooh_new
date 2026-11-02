import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

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
//  `SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`,
//  `FotoUploaderMock` y `RejillaDialog`. Los mensajes del servidor van por I18N-05.
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
    ],
    ingles: ['0 of 2', 'No spaces match.', 'Inactive', 'No notes yet.'],
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
