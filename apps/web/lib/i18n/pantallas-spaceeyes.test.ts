import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «SPACE EYES», RENDIDO DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El mismo patron que `pantallas-comercial.test.ts`: se monta el componente
//  REAL dentro del proveedor, se rinde con `renderToStaticMarkup` y se
//  comprueba el texto en dos sentidos:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Pantallas: todo `/space-eyes/*` — la lista de equipos, la ficha con sus
//  cuatro pestañas (fotos, pantalla y fallas, creativos, equipo), el historico,
//  la vista en vivo, la galeria, las fallas de la flota, las campañas de
//  verificacion, la programacion, la verificacion, las graficas, ajustar texto,
//  el alta de un dispositivo, la demostracion, el aviso «sin respuesta» y las
//  solicitudes de activacion del padre.
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//  `renderToStaticMarkup` no ejecuta efectos ni clics: todo lo que llega de
//  Space Eye por `fetch` en un `useEffect` NO se pinta. Sin jsdom, la unica
//  forma de rendir esas ramas es arrancar el estado en el valor que tendria
//  despues: `useState` se envuelve y, si hay un valor FORZADO en la cola y su
//  predicado casa con el valor inicial de la llamada, se usa ese. La cola se
//  consume EN ORDEN DE RENDER (profundidad primero, hijos incluidos): un
//  `forzar(esNull, null)` es un «dejalo como esta» para saltar un estado.
//
//  ─── EL ESPANOL IDENTICO ───────────────────────────────────────────────────
//  Con `I18N_VOLCAR=<carpeta>` la prueba escribe el HTML ESPANOL de cada
//  estado. Se volco ANTES de tocar los componentes y DESPUES, y se compararon
//  con `diff -rq` (ver `docs/i18n/revision-spaceeyes.md`). El reloj va fijo
//  (`vi.setSystemTime`): «hace 2 min» y las fechas salen del reloj.
//
//  ─── LO QUE NO VE ──────────────────────────────────────────────────────────
//  Los textos que manda el SERVIDOR (el nombre y la zona de una falla de
//  `fallasApi`, el `mensaje` de pedir una foto, las alertas de telemetria, el
//  `actualizacion.texto` de la lista) son datos y siguen en espanol (I18N-05).
//  Los avisos emergentes (`toast`) no salen en el HTML: los vigila
//  `textos/spaceeyes.test.ts`, que lee del fuente QUE clave usa cada uno.
// ============================================================================

const forzado = vi.hoisted(() => ({
  cola: [] as Array<{ si: (inicial: unknown) => boolean; valor: unknown }>,
}))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    // `Button` lleva su propio `useState(false)` (la guarda de doble clic): sin
    // saltarlo, cada boton se comeria un `forzar(esFalse, …)` de la pantalla y
    // la cola dependeria de cuantos botones hay antes. Se reconoce en la PILA.
    if (/[\\/]ui[\\/]Button\.tsx/.test(new Error().stack ?? '')) return real.useState(inicial)
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

const nav = vi.hoisted(() => ({ params: { id: '7' } as Record<string, string> }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/space-eyes',
  useParams: () => nav.params,
}))

const sesion = vi.hoisted(() => ({ puede: true, rol: 'DUENO' }))
vi.mock('@/components/demo/shell/SesionContext', () => ({
  usePuede: () => sesion.puede,
  useSesionCtx: () => ({ sesion: { usuario: { rol: sesion.rol } }, refrescar: () => {} }),
}))

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

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
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: {
    open: boolean
    title: string
    confirmLabel?: string
    confirmarEscribiendo?: string
    children: unknown
  }) =>
    p.open
      ? createElement(
          'div',
          null,
          createElement('h2', null, p.title),
          p.children as never,
          p.confirmarEscribiendo ? createElement('em', null, p.confirmarEscribiendo) : null,
          createElement('button', null, p.confirmLabel),
        )
      : null,
}))
// Radix Tabs solo pinta el panel activo: aqui se pintan TODOS, que es lo que
// deja medir las cuatro pestañas de la ficha en un solo estado.
vi.mock('@/components/demo/ui/Tabs', () => ({
  Tabs: (p: { tabs: { value: string; label: string }[]; children: unknown }) =>
    createElement(
      'div',
      null,
      createElement('nav', null, ...p.tabs.map((t) => createElement('button', { key: t.value }, t.label))),
      p.children as never,
    ),
  TabPanel: (p: { children: unknown }) => createElement('section', null, p.children as never),
}))
// El visor de la galeria es un `Dialog` de Radix: abierto se pinta en linea.
vi.mock('@radix-ui/react-dialog', () => {
  const caja = (tag: string) => {
    const Caja = (p: { children?: unknown; 'aria-label'?: string }) =>
      createElement(tag, p['aria-label'] ? { 'aria-label': p['aria-label'] } : null, p.children as never)
    Caja.displayName = `Radix-${tag}`
    return Caja
  }
  return {
    Root: (p: { open: boolean; children: unknown }) => (p.open ? createElement('div', null, p.children as never) : null),
    Portal: caja('div'),
    Overlay: caja('div'),
    Content: caja('div'),
    Title: caja('h2'),
    Description: caja('p'),
    Close: caja('button'),
  }
})

// ─── Reloj fijo ─────────────────────────────────────────────────────────────
const AHORA = new Date('2026-11-02T18:00:00.000Z')
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()
const dentro = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  sesion.puede = true
  sesion.rol = 'DUENO'
  nav.params = { id: '7' }
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
const esTrue = (v: unknown) => v === true
const esVacio = (v: unknown) => v === ''
const esCero = (v: unknown) => v === 0
const esUno = (v: unknown) => v === 1
const esIndefinido = (v: unknown) => v === undefined
const esArregloVacio = (v: unknown) => Array.isArray(v) && v.length === 0
const es = (x: unknown) => (v: unknown) => v === x
const esObjeto = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)

// ─── Datos de prueba ────────────────────────────────────────────────────────
const FOTO_URL = '/spaces-dooh/api/space-eyes/foto/?p=a.jpg'
const EQUIPOS = [
  {
    id: 1, nombre: 'Reforma 222 · Cara A', codigoPantalla: 'K-01', empresa: 'Acme', modelo: 'A52', online: true,
    bateriaPct: 92, senalDbm: -70, redTipo: 'CELLULAR', ultimaConexion: hace(2), estatus: 'active',
    ultimaFoto: { url: FOTO_URL, miniatura: FOTO_URL, tomadaEn: hace(30), giro: 0 },
    pantalla: { id: 's1', nombre: 'Reforma S1' }, actualizacion: { sola: true, texto: 'ok', tono: 'ok' },
  },
  {
    id: 2, nombre: 'GN-02', codigoPantalla: 'K-02', empresa: 'Beta', modelo: null, online: false,
    bateriaPct: 12, senalDbm: -95, redTipo: 'WIFI', ultimaConexion: hace(60 * 5), estatus: null, ultimaFoto: null,
    pantalla: null, actualizacion: { sola: false, texto: 'x', tono: 'visita' },
  },
  {
    id: 3, nombre: 'Insurgentes', codigoPantalla: null, empresa: null, modelo: null, online: false, bateriaPct: null,
    senalDbm: null, redTipo: null, ultimaConexion: null, estatus: null, ultimaFoto: null, pantalla: null,
    actualizacion: { sola: false, texto: 'x', tono: 'aviso' },
  },
  {
    id: 4, nombre: 'Tlalpan', codigoPantalla: 'K-04', empresa: 'Acme', modelo: null, online: true, bateriaPct: 40,
    senalDbm: -85, redTipo: 'CELLULAR', ultimaConexion: hace(60 * 24 * 30), estatus: null, ultimaFoto: null,
    pantalla: null,
  },
]

const FOTO_EQUIPO = (i: number, extra: Record<string, unknown> = {}) => ({
  url: FOTO_URL, miniatura: FOTO_URL, tomadaEn: hace(10 + i), ancho: 1920, alto: 1080, origen: 'on_demand',
  verificacionEstatus: 'verified', esCorrecta: true, score: 0.93, gps: { lat: 19.4326, lng: -99.1332 }, giro: 0, ...extra,
})
const DETALLE = {
  id: 7, uid: 'u7', nombre: 'Reforma 222 · Cara A', codigoPantalla: 'K-01', empresa: 'Acme', modelo: 'A52',
  online: true, bateriaPct: 92, senalDbm: -70, redTipo: 'CELLULAR', ultimaConexion: hace(2), estatus: 'active',
  ultimaFoto: null, versionApp: '0.16.4', fabricante: 'Samsung', direccion: 'Reforma 222', bateriaTemp: 31,
  equipoTemp: 38, redOperador: 'Telcel', cargando: true, almacenamientoLibreMb: 2048,
  datos: { movilMes: 312 * 1024 ** 2, wifiMes: 20 * 1024 ** 2 },
  fotos: [FOTO_EQUIPO(0), FOTO_EQUIPO(1, { origen: 'scheduled' })],
}
const DATOS_FICHA = { equipo: DETALLE, pantalla: { id: 's1', nombre: 'Reforma S1', fotoCliente: null } }
const DATOS_FICHA_SIN = {
  equipo: { ...DETALLE, codigoPantalla: 'K-77', cargando: false, datos: null, bateriaPct: null, senalDbm: null,
    redTipo: 'WIFI', redOperador: null, ultimaConexion: null, online: false, fotos: [], bateriaTemp: null, equipoTemp: null,
    fabricante: null, modelo: null, versionApp: null, almacenamientoLibreMb: null },
  pantalla: null,
}
const DATOS_FICHA_COMPARAR = {
  equipo: { ...DETALLE, fotos: [FOTO_EQUIPO(0, { esCorrecta: false, score: 0.41 })] },
  pantalla: { id: 's1', nombre: 'Reforma S1', fotoCliente: '/cliente.jpg' },
}
const DATOS_FICHA_PENDIENTE = {
  equipo: { ...DETALLE, fotos: [FOTO_EQUIPO(0, { esCorrecta: null, score: null, gps: null, ancho: null })] },
  pantalla: { id: 's1', nombre: 'Reforma S1', fotoCliente: '/cliente.jpg' },
}

const TELEMETRIA = {
  muestras: 1234,
  serie: [
    { bucket: '2026-11-02 10:00:00', battery_pct: 80, signal_dbm: -80 },
    { bucket: '2026-11-02 11:00:00', battery_pct: null, signal_dbm: null },
    { bucket: '2026-11-02 12:00:00', battery_pct: 18, signal_dbm: -108 },
    { bucket: '2026-11-02 13:00:00', battery_pct: 17, signal_dbm: -101 },
  ],
  alertas: [{ type: 'bateria', level: 'critical', message: 'ALERTA-17', value: 17 }],
}

const FALLA_API = (id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id, tipo: 'gabinete_apagado', nombre: 'F-APAGADO', estado, donde: 'ZONA-4',
  confianza: 0.87, detectadaEn: hace(90), recuperadaEn: null, cerradaPor: null, nota: null, evidencia: '/e.jpg',
  evidenciaMini: '/em.jpg', evidenciaRecuperacion: null, ...extra,
})
const PANTALLA_EQUIPO = {
  disponible: true, vigilando: true, aprendiendo: false, gabinetes: 15, horario: { inicio: '06:00', fin: '24:00' },
  ultimaRevision: { cuando: hace(20), pantalla: 'OK' },
  fallas: [
    FALLA_API(1, 'abierta'),
    FALLA_API(2, 'recuperada', { recuperadaEn: hace(30), cerradaPor: 'usuario', evidenciaRecuperacion: '/r.jpg' }),
    FALLA_API(3, 'descartada', { evidencia: null, evidenciaMini: null }),
  ],
}
const CREATIVOS_EQUIPO = {
  disponible: true, vigilando: true, aprendiendo: true, creativos: [
    { id: 'c1', primeraVez: hace(60 * 30), ultimaVez: hace(5), vistas: 42, foto: '/c1.jpg' },
  ],
}

// ─── Las pantallas ──────────────────────────────────────────────────────────
type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  /** Texto espanol que TIENE que salir en `es` (y no en `en`). */
  espanol: string[]
  /** Texto ingles que tiene que salir en `en`. */
  ingles: string[]
}

// Rutas FIJAS y no una plantilla: un `import()` con la ruta armada hace que Vite avise
// (dynamic-import-vars) en cada corrida.
const MODULOS: Record<string, () => Promise<Record<string, unknown>>> = {
  ListaEquipos: () => import('../../components/demo/space-eyes/ListaEquipos'),
  FichaEquipo: () => import('../../components/demo/space-eyes/FichaEquipo'),
  Historial: () => import('../../components/demo/space-eyes/Historial'),
  PantallaYCreativos: () => import('../../components/demo/space-eyes/PantallaYCreativos'),
  CreativosConfig: () => import('../../components/demo/space-eyes/CreativosConfig'),
  PantallaConfig: () => import('../../components/demo/space-eyes/PantallaConfig'),
  EquipoAdmin: () => import('../../components/demo/space-eyes/EquipoAdmin'),
  VistaEnVivo: () => import('../../components/demo/space-eyes/VistaEnVivo'),
  Galeria: () => import('../../components/demo/space-eyes/Galeria'),
  FallasFlota: () => import('../../components/demo/space-eyes/FallasFlota'),
  CampanasEyes: () => import('../../components/demo/space-eyes/CampanasEyes'),
  Programacion: () => import('../../components/demo/space-eyes/Programacion'),
  Verificacion: () => import('../../components/demo/space-eyes/Verificacion'),
  Graficas: () => import('../../components/demo/space-eyes/Graficas'),
  AjustarTexto: () => import('../../components/demo/space-eyes/AjustarTexto'),
  AltaDispositivo: () => import('../../components/demo/space-eyes/AltaDispositivo'),
  DemoSpaceEyes: () => import('../../components/demo/space-eyes/DemoSpaceEyes'),
  SinRespuesta: () => import('../../components/demo/space-eyes/SinRespuesta'),
  SolicitudesActivacion: () => import('../../components/demo/space-eyes/SolicitudesActivacion'),
}
const comp = async (archivo: string, nombre: string) =>
  (await MODULOS[archivo]())[nombre] as (p: never) => ReactElement
const el = (C: unknown, props: Record<string, unknown> = {}) => createElement(C as never, props as never)

const PANTALLAS: Pantalla[] = []
const pantalla = (p: Pantalla) => PANTALLAS.push(p)

// ═══ La lista de equipos ════════════════════════════════════════════════════
pantalla({
  nombre: 'lista · con equipos',
  pintar: async (idioma) => {
    const C = await comp('ListaEquipos', 'ListaEquipos')
    forzar(esNull, EQUIPOS)
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: [
    'Los equipos que vigilan tus pantallas: qué están viendo y cómo están.',
    'Actualizar',
    'Agregar dispositivo',
    'En línea',
    'de 4 equipos',
    'Sin comunicación',
    'más de 10 min',
    'Batería crítica',
    'bajo 20%',
    'Última captura',
    'de toda la flota',
    'Todos · 4',
    'En línea · 1',
    'Con atención · 3',
    'Se actualizan a mano · 2',
    'Todas las empresas',
    'Buscar equipo o pantalla',
    'Empresa',
    'Última captura de Reforma 222 · Cara A',
    'Sin capturas todavía',
    'sin pantalla asignada',
    'Para actualizar necesita una visita',
    'Para actualizar pide un toque',
    'sin dato',
    'Móvil',
    'hace 2 min',
    'hace 5 h',
    'hace 30 min',
    'hace 4 semanas',
    'nunca',
    'EN LÍNEA',
    'SIN COMUNICACIÓN',
    'PENDIENTE DE VINCULAR',
  ],
  ingles: [
    'Add device',
    'of 4 devices',
    'Critical battery',
    'All · 4',
    'Online · 1',
    'Need attention · 3',
    'Manual updates · 2',
    'All companies',
    'Needs a site visit to update',
    '2 min ago',
    '30 min',
    '4 weeks ago',
    'never',
    'NOT REPORTING',
    'PENDING PAIRING',
    'no screen assigned',
    'Mobile',
  ],
})
pantalla({
  nombre: 'lista · no configurada',
  pintar: async (idioma) => {
    const C = await comp('ListaEquipos', 'ListaEquipos')
    forzar(esNull, [])
    forzar(esFalse, true)
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: ['La integración con Space Eyes no está configurada en este entorno.'],
  ingles: [
    'The Space Eyes integration is not configured in this environment.',
  ],
})
pantalla({
  nombre: 'lista · error',
  pintar: async (idioma) => {
    const C = await comp('ListaEquipos', 'ListaEquipos')
    forzar(esNull, null)
    forzar(esNull, 'Fallo de red')
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: ['No se pudo consultar Space Eyes'],
  ingles: [],
})
pantalla({
  nombre: 'lista · vacia',
  pintar: async (idioma) => {
    const C = await comp('ListaEquipos', 'ListaEquipos')
    forzar(esNull, [])
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: ['Todavía no hay equipos Space Eyes dados de alta para esta cuenta.', 'sin fotos todavía'],
  ingles: [
    'There are no Space Eyes devices registered for this account yet.',
    'no photos yet',
  ],
})
pantalla({
  nombre: 'lista · filtro sin resultados',
  pintar: async (idioma) => {
    const C = await comp('ListaEquipos', 'ListaEquipos')
    forzar(esNull, EQUIPOS)
    forzar(esTrue, false)
    forzar(esVacio, 'zzz')
    return pintar(idioma, el(C))
  },
  espanol: ['Ningún equipo coincide con el filtro.'],
  ingles: [
    'No devices match the filter.',
  ],
})

// ═══ La ficha de un equipo ══════════════════════════════════════════════════
const ficha = async () => comp('FichaEquipo', 'FichaEquipo')
pantalla({
  nombre: 'ficha · captura del equipo, pestañas cargando',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, DATOS_FICHA)
    forzar(esTrue, false)
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: [
    'Tomar foto',
    'Subir foto',
    'Actualizar estado',
    'Fotos',
    'Pantalla y fallas',
    'Creativos',
    'Equipo',
    'En vivo',
    'Captura Space Eyes',
    'Foto del cliente',
    'Comparar',
    'Última conexión ',
    'Batería ',
    'Telcel ',
    'buena',
    'Última captura ',
    'CAPTURA SPACE EYES',
    ' · a demanda',
    'Ampliar',
    'Descargar',
    'Anuncio correcto · confianza 93%',
    'Recientes',
    'Captura del ',
    'Energía',
    'cargando',
    'Temp. batería',
    'Temp. equipo',
    'Conexión',
    'Datos de este mes',
    'Móvil ',
    'WiFi ',
    'Pantalla asociada',
    'Abrir la ficha →',
    'Histórico del equipo',
    'Detalles del equipo',
    'Modelo',
    'Versión del agente',
    'Almacenamiento libre',
    'Capturas guardadas',
    'Captura de Space Eyes de Reforma 222 · Cara A',
    'Leyendo la pantalla del equipo…',
    'Leyendo la vigilancia de la pantalla…',
    'Leyendo la vigilancia de creativos…',
    'Leyendo el equipo…',
  ],
  ingles: [
    'Take photo',
    'Upload photo',
    'Screen and faults',
    'Creatives',
    'Space Eyes capture',
    'SPACE EYES CAPTURE',
    ' · on demand',
    'Correct ad · confidence 93%',
    'Last connection ',
    'Power',
    'charging',
    'Linked screen',
    'Open the profile →',
    'Device history',
    'Reading the device screen…',
    'Reading the device…',
  ],
})
pantalla({
  nombre: 'ficha · foto del cliente sin pantalla',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, DATOS_FICHA_SIN)
    forzar(esTrue, false)
    forzar(es('equipo'), 'cliente')
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: [
    'sin pantalla asignada',
    'Este equipo no tiene una pantalla asignada donde guardar la foto',
    'Este equipo no tiene una pantalla asignada, así que no hay galería donde guardar la foto del cliente.',
    'Sin capturas',
    'sin cargar',
    'sin dato',
    'Ningún sitio de tu inventario tiene el código ',
    ', así que este equipo no está enlazado a una pantalla.',
    'nunca',
  ],
  ingles: [
    'This device has no assigned screen, so there is no gallery to store the client photo.',
    'No site in your inventory has the code ',
    ', so this device is not linked to a screen.',
    'not charging',
  ],
})
pantalla({
  nombre: 'ficha · comparar, no coincide',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, DATOS_FICHA_COMPARAR)
    forzar(esTrue, false)
    forzar(es('equipo'), 'comparar')
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: [
    'FOTO DEL CLIENTE',
    'Subida a la galería de la pantalla',
    'Foto del cliente de Reforma 222 · Cara A',
    'Ampliar: FOTO DEL CLIENTE',
    'Ampliar: CAPTURA SPACE EYES',
    'No coincide con la creatividad · 41%',
  ],
  ingles: [
    'CLIENT PHOTO',
    'Uploaded to the screen gallery',
    'Enlarge: CLIENT PHOTO',
    'Does not match the creative · 41%',
  ],
})
pantalla({
  nombre: 'ficha · foto del cliente, verificacion pendiente',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, DATOS_FICHA_PENDIENTE)
    forzar(esTrue, false)
    forzar(es('equipo'), 'cliente')
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: ['FOTO DEL CLIENTE', 'Subida a la galería de la pantalla', 'Verificación de IA pendiente'],
  ingles: [
    'AI verification pending',
  ],
})
pantalla({
  nombre: 'ficha · pidiendo la foto',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, { ...DATOS_FICHA, pantalla: { id: 's1', nombre: 'Reforma S1', fotoCliente: null } })
    forzar(esTrue, false)
    forzar(es('quieto'), 'esperando')
    forzar(esNull, 'ORDEN-OK') // el mensaje lo manda el servidor: dato
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: ['Esperando la foto…', 'Pidiéndole la foto al equipo…', 'Suele tardar entre 5 y 20 segundos'],
  ingles: [
    'Waiting for the photo…',
    'Asking the device for the photo…',
    'It usually takes 5 to 20 seconds',
  ],
})
pantalla({
  nombre: 'ficha · nadie ha subido foto del cliente',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esNull, DATOS_FICHA)
    forzar(esTrue, false)
    forzar(es('equipo'), 'cliente')
    forzar(es('quieto'), 'pidiendo')
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: ['Nadie ha subido todavía una foto de esta pantalla. Usa «Subir foto».', 'Pidiendo…'],
  ingles: [
    'Nobody has uploaded a photo of this screen yet. Use “Upload photo”.',
    'Requesting…',
  ],
})
pantalla({
  nombre: 'ficha · equipo no encontrado',
  pintar: async (idioma) => {
    const C = await ficha()
    forzar(esTrue, false)
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: ['No se pudo abrir el equipo', 'Equipo no encontrado'],
  ingles: [
    'Could not open the device',
    'Device not found',
  ],
})
pantalla({
  nombre: 'pagina · id invalido',
  pintar: async (idioma) => {
    nav.params = { id: 'abc' }
    const { default: Pagina } = await import('../../app/(app)/(shell)/space-eyes/[id]/page')
    return pintar(idioma, el(Pagina))
  },
  espanol: ['Equipo no encontrado', 'La dirección no corresponde a ningún equipo Space Eyes.'],
  ingles: [
    'Device not found',
    'This address does not match any Space Eyes device.',
  ],
})

// ═══ El historico ═══════════════════════════════════════════════════════════
const historial = async () => comp('Historial', 'Historial')
pantalla({
  nombre: 'historial · abierto con datos',
  pintar: async (idioma) => {
    const C = await historial()
    forzar(esFalse, true)
    forzar(esNull, TELEMETRIA)
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: [
    'Histórico del equipo',
    '1,234 reportes',
    'Batería',
    'peor 17%',
    '20% · batería baja',
    'Señal',
    'peor -108 dBm',
    '−105 dBm · señal débil',
    'Batería por hora. Peor valor del rango: 17 %.',
    'Señal por hora. Peor valor del rango: -108 dBm.',
    'ALERTA-17',
    'Ver los datos',
    'Batería y señal por hora',
    'Hora',
  ],
  ingles: [
    '1,234 reports',
    'worst 17%',
    '20% · low battery',
    '−105 dBm · weak signal',
    'Battery per hour. Worst value in the range: 17%.',
    'Show the data',
  ],
})
pantalla({
  nombre: 'historial · sin datos en el rango',
  pintar: async (idioma) => {
    const C = await historial()
    forzar(esFalse, true)
    forzar(esNull, { muestras: 0, serie: [], alertas: [] })
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: [
    'Este equipo no reportó nada en el rango elegido, así que no hay nada que dibujar. Prueba con un rango más amplio.',
    '0 reportes',
  ],
  ingles: [
    'This device reported nothing in the chosen range, so there is nothing to plot. Try a wider range.',
    '0 reports',
  ],
})
pantalla({
  nombre: 'historial · grafica sin dato',
  pintar: async (idioma) => {
    const C = await historial()
    forzar(esFalse, true)
    forzar(esNull, { muestras: 3, serie: [{ bucket: '2026-11-02 10:00:00', battery_pct: 50, signal_dbm: null }], alertas: [] })
    return pintar(idioma, el(C, { id: 7 }))
  },
  espanol: ['sin dato', 'Señal por hora. Peor valor del rango: sin dato dBm.'],
  ingles: [],
})

// ═══ Pantalla y creativos (solo lectura) ════════════════════════════════════
const pyc = async () => comp('PantallaYCreativos', 'PantallaYCreativos')
pantalla({
  nombre: 'pantalla y creativos · con fallas y creativos',
  pintar: async (idioma) => {
    const C = await pyc()
    forzar(esNull, PANTALLA_EQUIPO)
    forzar(esNull, CREATIVOS_EQUIPO)
    return pintar(idioma, el(C, { id: 7, onAmpliar: () => {} }))
  },
  espanol: [
    'Pantalla y fallas',
    'El equipo revisa su pantalla y avisa solo cuando confirma una falla o cuando se arregla.',
    'Vigilando',
    'Pantalla: ',
    '15 gabinetes',
    'Encendida de ',
    ' a ',
    'Última revisión: ',
    'hace 20 min',
    'Ver la foto de evidencia',
    'Evidencia de la falla',
    'Detectada ',
    ' · confianza ',
    'Detectada',
    'Falla',
    'Dónde',
    'Estado',
    'Cerrada',
    'Evidencia',
    'Abierta',
    'Recuperada',
    'No era falla',
    ' · a mano',
    'al detectar',
    'al recuperar',
    'Creativos detectados',
    'Cada anuncio distinto que ha pasado por la pantalla, reconocido por el propio equipo.',
    'Aprendiendo',
    'Creativo detectado',
    'Apareció ',
    'Visto ',
    ' veces · último ',
  ],
  ingles: [
    'Screen: ',
    '15 cabinets',
    'On from ',
    'Last check: ',
    'Detected ',
    ' · confidence ',
    'Open',
    'Cleared',
    'Not a fault',
    'when detected',
    'Detected creatives',
    'Seen ',
    ' times · last ',
  ],
})
pantalla({
  nombre: 'pantalla y creativos · sin vigilancia',
  pintar: async (idioma) => {
    const C = await pyc()
    forzar(esNull, { disponible: true, vigilando: false, gabinetes: null, horario: null, ultimaRevision: null, fallas: [] })
    forzar(esNull, { disponible: true, vigilando: false, creativos: [] })
    return pintar(idioma, el(C, { id: 7, onAmpliar: () => {} }))
  },
  espanol: [
    'Apagada',
    'sin marcar',
    'todavía ninguna',
    'Este equipo no está vigilando su pantalla. Se enciende en Space Eye (necesita la app 0.15 o posterior).',
    'Este equipo no está vigilando los creativos de su pantalla.',
  ],
  ingles: [
    'not marked',
    'none yet',
    'This device is not monitoring the creatives on its screen.',
  ],
})
pantalla({
  nombre: 'pantalla y creativos · solo fallas, sin datos',
  pintar: async (idioma) => {
    const C = await pyc()
    forzar(esNull, { disponible: false })
    forzar(esNull, { disponible: true, vigilando: true, creativos: [] })
    return pintar(idioma, el(C, { id: 7, onAmpliar: () => {}, soloFallas: true }))
  },
  espanol: ['Historial de fallas', 'Sin datos', 'Space Eye no tiene datos de pantalla de este equipo.'],
  ingles: [
    'Fault history',
    'Space Eye has no screen data for this device.',
  ],
})
pantalla({
  nombre: 'pantalla y creativos · vigilando sin fallas',
  pintar: async (idioma) => {
    const C = await pyc()
    forzar(esNull, { ...PANTALLA_EQUIPO, fallas: [] })
    forzar(esNull, { disponible: true, vigilando: true, creativos: [] })
    return pintar(idioma, el(C, { id: 7, onAmpliar: () => {} }))
  },
  espanol: ['Sin fallas abiertas.', 'Todavía no ha detectado creativos nuevos.'],
  ingles: [],
})
pantalla({
  nombre: 'pantalla y creativos · error',
  pintar: async (idioma) => {
    const C = await pyc()
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    return pintar(idioma, el(C, { id: 7, onAmpliar: () => {} }))
  },
  espanol: ['No se pudo leer lo que el equipo vio en su pantalla: '],
  ingles: [],
})

// ═══ Vigilancia de creativos (ajustes) ══════════════════════════════════════
const creativos = async () => comp('CreativosConfig', 'CreativosConfig')
const CFG = { vigilar: true, aprendiendo: true, aprendizaje_min: 120, desde: hace(30), max_dia: 20, cada_min: 45, envio_min: 90 }
const HALLAZGO = { id: 5, photo_id: 9, descartado: 0, primera_vez: hace(60), ultima_vez: hace(3), vistas: 7, thumbnail_path: 't.jpg', storage_path: 's.jpg' }
pantalla({
  nombre: 'creativos · aprendiendo con hallazgos y avisos',
  pintar: async (idioma) => {
    const C = await creativos()
    forzar(esNull, { config: CFG, fotos_hoy: 3, creativos: [HALLAZGO, { ...HALLAZGO, id: 6, photo_id: null }] })
    forzar(esNull, '0.16.2')
    forzar(esNull, 3.1 * 1024 ** 3)
    forzar(esTrue, false)
    forzar(esFalse, false)
    forzar(esFalse, true)
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, onAmpliar: () => {} }))
  },
  espanol: [
    'Vigilancia de creativos',
    'El equipo reconoce los anuncios de su pantalla sin gastar datos y solo sube foto cuando aparece uno que no conocía.',
    'Aprendiendo',
    'Vigilar la pantalla',
    'Falta marcar la pantalla (en «Pantalla y fallas»): sin eso el equipo no reconoce creativos, porque el fondo los confunde entre sí.',
    'Aprendiendo el loop hasta ',
    ': en este plazo no toma fotos.',
    'Fotos hoy',
    'En el catálogo',
    'Frecuencia',
    'Continuo (avisa al minuto)',
    'Cada 30 min',
    'Cada hora',
    'Cada 2 horas',
    'Cada 3 horas',
    'Cada 6 horas',
    'Cada 12 horas',
    'Cada 45 min',
    'Volver a aprender',
    'Mandar las fotos nuevas',
    'Al momento',
    'Juntas cada 2 horas',
    'Juntas cada 4 horas',
    'Juntas cada 8 horas',
    'Juntas cada 12 horas',
    'Juntas cada 90 min',
    'Solo las nuevas: una foto por creativo. Mirar no gasta datos.',
    'Datos del chip este mes',
    ' / 4 GB',
    'Mirando por intervalos, un creativo que sale una sola vez entre dos miradas no se ve. Para no perder ninguno, usa «Continuo»: mirar no gasta datos, y con «Juntas cada N horas» decides cuándo llegan las fotos.',
    'Creativos nuevos detectados',
    'Ver en grande',
    'Creativo detectado',
    'No es nuevo',
    'No era un creativo nuevo (reflejo, pantalla apagada…)',
    'Volver a aprender la pantalla',
    'Se borra todo lo que el equipo aprendió de esta pantalla. Vuelve a aprender durante el plazo de aprendizaje, y en ese tiempo no toma fotos.',
    'Datos móviles (chip) que el equipo lleva este mes, según su propio reporte. Casi todo lo gasta la vista en vivo; las fotos de creativos pesan poco.',
    'Continuo: el equipo mira su pantalla todo el día dentro del horario y avisa en menos de un minuto cuando sale un creativo nuevo. Sigue sin gastar datos: solo manda la foto de lo nuevo.',
    'Mirar y mandar son dos cosas: el equipo mira todo el tiempo y aquí se elige cuándo viajan las fotos. Juntas llega una por creativo, la más nítida; un creativo que se repite no se vuelve a mandar.',
  ],
  ingles: [
    'Creative monitoring',
    'Continuous (alerts within a minute)',
    'Every half hour',
    'Every twelve hours',
    'Every 45 min',
    'Batched every two hours',
    'Batched every 90 min',
    'Relearn',
    'Relearn the screen',
    'SIM data this month',
    'Not new',
    'Learning the loop until ',
  ],
})
pantalla({
  nombre: 'creativos · apagado en una PC',
  pintar: async (idioma) => {
    const C = await creativos()
    forzar(esNull, { config: { ...CFG, vigilar: false }, fotos_hoy: 0, creativos: [] })
    forzar(esNull, 'pc-agent v1.2.0')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: false }))
  },
  espanol: [
    'Apagado',
    'Este equipo no sabe vigilar su pantalla todavía: los celulares necesitan la app 0.15.0 o posterior, y el agente de PC no lo tiene.',
  ],
  ingles: [
    'Off',
    'This device cannot monitor its screen yet: phones need app 0.15.0 or later, and the PC agent does not have it.',
  ],
})
pantalla({
  nombre: 'creativos · continuo, sin hallazgos ni consumo',
  pintar: async (idioma) => {
    const C = await creativos()
    forzar(esNull, { config: { ...CFG, aprendiendo: false, cada_min: 0, envio_min: 0 }, fotos_hoy: 0, creativos: [] })
    forzar(esNull, 'pi-agent v0.7.0')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true }))
  },
  espanol: ['Vigilando en continuo', 'Todavía no ha detectado creativos nuevos.', 'El equipo todavía no reporta su consumo.'],
  ingles: [
    'Monitoring continuously',
    'The device does not report its usage yet.',
  ],
})
pantalla({
  nombre: 'creativos · error',
  pintar: async (idioma) => {
    const C = await creativos()
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esTrue, true)
    forzar(esNull, 'sin red')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true }))
  },
  espanol: ['No se pudo leer la vigilancia de creativos: '],
  ingles: [],
})

// ═══ Pantalla y fallas (ajustes) ════════════════════════════════════════════
const pconfig = async () => comp('PantallaConfig', 'PantallaConfig')
const PANT = { esquinas: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]], filas: 3, columnas: 5, horario: { inicio: '07:00', fin: '23:00' } }
const ULTIMO = {
  ts: hace(15), pantalla: 'APAGADA', camara: 'MOVIDA', vistazos: 10, cambios: 2, interrumpida: true, vistazos_usados: 4,
  aprendiendo: true, camara_permitida: false, excluidas: [[0, 1]],
}
pantalla({
  nombre: 'pantalla config · vigilando con la ultima revision',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, {
      pantalla: PANT,
      salud: { vigilar: true, desde: hace(10), aprendizaje_min: 77, aprendiendo: true, cada_min: 60, aviso_rapido: false },
      ultimo: ULTIMO,
    })
    forzar(esNull, '0.16.0')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: false }))
  },
  espanol: [
    'Pantalla y fallas',
    'El equipo revisa su pantalla por sí mismo y solo avisa cuando confirma una falla o cuando se arregla. No manda video ni fotos mientras todo está bien.',
    'Aprendiendo',
    'Vigilar fallas',
    'Pantalla',
    ' gabinetes ',
    'Encendida de ',
    'Marcar la pantalla la cambia para el equipo y borra lo que aprendió: solo lo hace el Dueño.',
    'Aprendizaje',
    'Cuánto observa antes de empezar a avisar.',
    'Solo la primera vuelta (pruebas)',
    '30 minutos',
    '2 horas',
    '6 horas',
    '24 horas',
    '77 min',
    'Frecuencia',
    'Cada cuánto revisa la pantalla (dentro del horario).',
    'Cada 5 min (pruebas)',
    'Cada 15 min (pruebas)',
    'Cada 30 min',
    'Cada hora',
    'Cada 2 horas',
    'Cada 3 horas',
    'Avisar al instante si la pantalla se apaga completa',
    'En menos de un minuto y una sola vez por apagón; se cierra sola cuando vuelve.',
    'Apagado',
    'Última revisión',
    ' · pantalla apagada · la cámara se movió (10 vistazos, 2 cambios de anuncio). La vuelta se interrumpió (vista en vivo o una foto): se usaron 4 de 10 vistazos.',
    'Aprendiendo la pantalla hasta ',
    ': en este plazo no avisa de fallas.',
    'Android no le deja usar la cámara en segundo plano, así que no está revisando la pantalla. Abre la app Space Eye en el celular una vez y se arregla sola. Pasa tras reiniciar el celular, salvo que la app sea dueña del dispositivo.',
    'Gabinetes que nunca cambian (no se revisan): ',
    '. Suelen estar tapados por algo; si no hay nada delante, revísalos: podrían llevar tiempo apagados.',
    'Antes de avisar, el equipo aprende cómo se ve la pantalla normalmente. Siempre aprende al menos su primera vuelta con la pantalla funcionando.',
  ],
  ingles: [
    'Learning',
    'Monitor faults',
    ' cabinets ',
    'First pass only (testing)',
    'Every five minutes (testing)',
    'Alert immediately if the whole screen goes off',
    ' · screen off · the camera moved (10 looks, 2 ad changes). The pass was interrupted (live view or a photo): 4 of 10 looks were used.',
    'Cabinets that never change (not checked): ',
  ],
})
pantalla({
  nombre: 'pantalla config · sin marcar, editando sin foto',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, { pantalla: null, salud: null, ultimo: null })
    forzar(esNull, '0.16.0')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { esquinas: [], filas: '', columnas: 1, excluir: [], horario: { inicio: '06:00', fin: '25:00' } })
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Vigilancia apagada',
    'Falta marcar dónde está la pantalla en la foto: sin eso el equipo no vigila fallas ni creativos.',
    'Sin marcar',
    'Encendido',
    'Esquinas',
    'Zonas tapadas',
    'Filas',
    'Columnas',
    'El horario va en HH:MM, de 00:00 a 24:00.',
    'Toca las 4 esquinas de la pantalla en orden: ',
    'arriba izquierda, arriba derecha, abajo derecha, abajo izquierda',
    '. Después puedes arrastrarlas. Pon filas y columnas de gabinetes para que las líneas coincidan con las uniones. Si cambias el zoom o el lente del equipo, hay que volver a marcarla.',
    'Toma primero una foto del equipo para poder marcar la pantalla.',
    'Guardar pantalla',
    'Cancelar',
    'Volver a empezar',
  ],
  ingles: [
    'Monitoring off',
    'Not marked',
    'Corners',
    'Blocked areas',
    'Hours go in HH:MM, from 00:00 to 24:00.',
    'Click the 4 corners of the screen in order: ',
    'top left, top right, bottom right, bottom left',
    'Save screen',
    'Start over',
  ],
})
pantalla({
  nombre: 'pantalla config · zonas tapadas con foto y confirmar',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, { pantalla: PANT, salud: { vigilar: true, aprendiendo: false, cada_min: 15, aprendizaje_min: 0 }, ultimo: null })
    forzar(esNull, 'pi-agent v0.7.2')
    forzar(esNull, '/foto.jpg')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { esquinas: PANT.esquinas, filas: 3, columnas: 5, excluir: [[0, 0]], horario: { inicio: '06:00', fin: '24:00' } })
    forzar(es('esquinas'), 'excluir')
    forzar(esFalse, false)
    forzar(esFalse, true)
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Vigilando',
    'Encendido',
    'El equipo todavía no ha hecho ninguna revisión.',
    'Toca los gabinetes que algo tapa siempre (una barda, un árbol, un poste): no se revisan. El equipo también las aprende solo en sus primeras 24 horas.',
    'Última foto del equipo',
    'Cambió el encuadre de la pantalla',
    'Cambiaron las esquinas o los gabinetes, así que el equipo olvida lo que había aprendido. Vuelve a aprender antes de poder avisar de fallas.',
    'Guardar de todos modos',
  ],
  ingles: [
    'The device has not done any check yet.',
    'Click the cabinets that something always blocks',
    'The screen framing changed',
    'Save anyway',
  ],
})
pantalla({
  nombre: 'pantalla config · agente de PC y cambiar pantalla',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, { pantalla: PANT, salud: { vigilar: true, aprendiendo: false, cada_min: 60, aprendizaje_min: 120 }, ultimo: { ts: hace(5), pantalla: 'OK', vistazos: 3, cambios: 0 } })
    forzar(esNull, 'pc-agent v1.2.0')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'La vigilancia de fallas necesita la app 0.15.0 o posterior en el celular, o el agente 0.7.0 en la Raspberry. El agente de PC todavía no la tiene.',
    'Cambiar pantalla',
    ' · pantalla se ve bien (3 vistazos, 0 cambios de anuncio).',
  ],
  ingles: [
    'Change screen',
    ' · screen looks fine (3 looks, 0 ad changes).',
  ],
})
pantalla({
  nombre: 'pantalla config · marcar, sin juzgar y error',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, { pantalla: null, salud: { vigilar: true, aprendiendo: false, cada_min: 60, aprendizaje_min: 120 }, ultimo: { ts: hace(5), pantalla: 'INCONCLUSO', camara: 'SIN_IMAGEN' } })
    forzar(esNull, '0.16.0')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['Marcar la pantalla', ' · pantalla no se pudo juzgar · sin imagen (0 vistazos, 0 cambios de anuncio).'],
  ingles: [
    'Mark the screen',
    ' · screen could not be judged · no image (0 looks, 0 ad changes).',
  ],
})
pantalla({
  nombre: 'pantalla config · congelada y cargando',
  pintar: async (idioma) => {
    const C = await pconfig()
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['Leyendo la pantalla del equipo…'],
  ingles: [],
})
pantalla({
  nombre: 'pantalla config · error',
  pintar: async (idioma) => {
    const C = await pconfig()
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['No se pudo leer la pantalla del equipo: '],
  ingles: [],
})

// ═══ El equipo (administracion) ═════════════════════════════════════════════
const admin = async () => comp('EquipoAdmin', 'EquipoAdmin')
const EQUIPO_SE = {
  id: 7, name: 'Reforma 222', billboard_code: 'K-01', address: 'Reforma 222', city: 'CDMX', state: 'CDMX',
  status: 'maintenance', lat: '19.4', lng: '-99.1', manufacturer: 'Samsung', model: 'A52', android_version: '11',
  app_version: '0.16.0', app_version_code: 20, device_owner: 0, app_actualiza_sola: 0, app_actualiza_motivo: 'android_viejo',
  last_seen_at: hace(3), camera_ajustes: null, photo_rotation: 0,
}
const ESTADO_SE = { network_type: 'LTE', network_operator: 'Telcel', source_ip: '1.2.3.4', storage_free_mb: 4096, cpu_temp: 45, battery_temp: 30 }
const VERSIONES = { disponible: true, version: '0.17.0', version_code: 22, agente_pc: { disponible: true, version: '1.3.0' }, agente_pi: { disponible: true, version: '0.7.1' } }
pantalla({
  nombre: 'equipo · android atrasado, editar y actualizar',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, EQUIPO_SE)
    forzar(esNull, ESTADO_SE)
    forzar(esNull, VERSIONES)
    forzar(esNull, null) // error
    forzar(esFalse, true) // FichaYDatos: abierto
    forzar(esObjeto, { name: 'Reforma 222', billboard_code: 'K-01', address: '', city: '', state: '', status: 'active', lat: '999', lng: '' })
    forzar(esNull, null) // fallo
    forzar(esNull, null) // msg
    forzar(esNull, 'actualizar') // Ordenes: pedir
    forzar(esFalse, false) // enviando
    forzar(esNull, null) // msg
    forzar(esFalse, true) // AjustesImagen: abierto
    forzar(esObjeto, {})
    forzar(esFalse, true) // wbManual
    forzar(esFalse, true) // expManual
    forzar(esNull, null) // fotoPrueba
    forzar(esNull, null) // msg
    forzar(esNull, [{ id: 1, level: 'warning', category: 'red', message: 'sin red', logged_at: hace(4) }]) // Registros: logs
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: false }))
  },
  espanol: [
    'Ficha del equipo',
    'Dónde está y qué aparato es.',
    'Editar datos',
    'Sitio',
    'Nombre',
    'Código del espectacular',
    'Dirección',
    'Estado',
    'En mantenimiento',
    'Aparato',
    'Modelo',
    'Versión de la app',
    'Conexión y salud',
    'Red',
    'Operador',
    'IP pública',
    'Última conexión',
    'Almacenamiento libre',
    'Temperatura CPU',
    'Temperatura batería',
    'Editar datos del sitio',
    'Guardar',
    'Ej. Espectacular Reforma 222',
    'Ciudad',
    'Latitud',
    'Longitud',
    'La latitud va de −90 a 90 y la longitud de −180 a 180.',
    'Déjalas vacías si no las sabes. Sirven para ubicar la pantalla y para calcular la luz de su sitio, que es lo que decide a qué horas la foto sale limpia y a qué horas sale con líneas.',
    'Estado de la pantalla',
    'En operación',
    'Activa',
    'Dada de baja',
    'Mantenimiento y dada de baja dejan a la pantalla fuera de las programaciones: no le llegan fotos y deja de gastar datos, sin borrar nada. En operación y activa hoy se comportan igual.',
    'Programa del equipo',
    'Reiniciar la app, o instalarle la versión publicada, sin ir al sitio.',
    'Instalada',
    'Publicada',
    'Hay una versión nueva: ',
    'Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior.',
    'Actualizaciones: ',
    'Actualizar app',
    'Reiniciar app',
    'Actualizar el programa del equipo',
    'Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior. ¿Enviar de todos modos?',
    'Ajustes de imagen',
    'Se guardan en el equipo y se aplican a todas sus fotos, incluidas las programadas.',
    'Ocultar',
    'Giro de la foto',
    'Sin giro',
    'Endereza la foto al recibirla. Es distinto de la orientación de la vista en vivo.',
    'Centro horizontal',
    'Centro vertical',
    'Brillo',
    'Exposición',
    'Contraste',
    'Saturación',
    'Nitidez',
    'Pantalla de LED',
    'Cuadros a promediar',
    'un disparo',
    'Contra las líneas de la pantalla: cada cuadro las agarra en otra posición y al promediarlos se cancelan (con 16 la marca baja de 40% a 10%). Tarda ~1 s más y, si el creativo cambia a media captura, sale mezclado.',
    'Dónde mide la luz',
    'Centro del cuadro (normal)',
    'Solo el centro — para exponer la pantalla',
    'Todo el cuadro por igual',
    'Por zonas',
    'Fijar la exposición a mano',
    'Obturador',
    'Ganancia',
    'Al fijarlo se pierde el automático: hay que mover los dos juntos o la foto sale quemada o a oscuras según la hora.',
    'Balance de blancos',
    'Automático',
    'Luz de día',
    'Nublado',
    'Foco incandescente',
    'Fluorescente',
    'Interior',
    'Ajustar el color a mano (necesario si las hojas salen moradas)',
    'Rojo',
    'Azul',
    'Pantalla de LED: punto de partida',
    'Promedia 16 cuadros, baja la exposición y mide la luz en la pantalla',
    'Hojas moradas: punto de partida',
    'Para cámaras sin filtro infrarrojo, donde la vegetación sale morada',
    'Restablecer',
    'Foto de prueba',
    'Probar',
    'Estos ajustes cambian lo que la cámara ve en todas sus fotos: solo los mueve el Dueño.',
    '«Probar» guarda los ajustes y pide una foto para ver cómo quedan.',
    'Cada prueba consume una foto de datos. En equipos con SIM, úsala con medida.',
    'Registros del equipo',
    'Lo que el equipo reporta de sí mismo, para diagnosticarlo en campo.',
  ],
  ingles: [
    'Device profile',
    'Billboard code',
    'Under maintenance',
    'Edit site details',
    'Latitude goes from −90 to 90 and longitude from −180 to 180.',
    'A new version is available: ',
    'Someone has to confirm on the phone for every update: it runs Android 11 or earlier.',
    'Updates: ',
    'Update the device software',
    ' Send anyway?',
    'Image settings',
    'Photo rotation',
    'single shot',
    'Set exposure manually',
    'Purple leaves: starting point',
    'These settings change what the camera sees in all its photos: only the Owner can change them.',
    'Device logs',
  ],
})
pantalla({
  nombre: 'equipo · raspberry al dia, reiniciar el equipo',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, app_version: 'pi-agent v0.7.1', app_version_code: null, status: 'provisioning', camera_ajustes: '{"cuadros":16}' })
    forzar(esNull, { ...ESTADO_SE, storage_free_mb: null, cpu_temp: null, battery_temp: null })
    forzar(esNull, VERSIONES)
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'equipo')
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esFalse, true) // AjustesImagen abierto
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, [])
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Reiniciar la app o el equipo, o instalarle la versión publicada, sin ir al sitio.',
    'Tiene la versión publicada.',
    'Actualizaciones: Se actualiza sola.',
    'Reiniciar equipo',
    'Reiniciar la Raspberry',
    'Se reinicia la Raspberry entera, no solo la app: es lo que destraba una cámara o una red que se quedaron colgadas. Deja de reportar uno o dos minutos y vuelve sola.',
    '16 cuadros',
    'Sin registros todavía.',
  ],
  ingles: [
    'Restart the app or the device, or install the published version, without going to the site.',
    'It has the published version.',
    'Updates: Updates on its own.',
    'Restart the Raspberry',
    '16 frames',
    'No logs yet.',
  ],
})
pantalla({
  nombre: 'equipo · PC, actualizar y registros caidos',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, app_version: 'pc-agent v1.2.0', app_version_code: null })
    forzar(esNull, null)
    forzar(esNull, VERSIONES)
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'actualizar')
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, null) // logs
    forzar(esFalse, false) // cargando
    forzar(esNull, 'sin red') // fallo
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Se instalará el agente publicado en esta PC. Verifica la huella del archivo antes de sustituirlo y, si el programa nuevo no arranca, vuelve solo al anterior.',
    'Mostrar',
    'No se pudieron leer los registros: ',
  ],
  ingles: [],
})
pantalla({
  nombre: 'equipo · raspberry, actualizar',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, app_version: 'pi-agent v0.7.0', app_version_code: null })
    forzar(esNull, null)
    forzar(esNull, VERSIONES)
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'actualizar')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Se instalará el agente publicado en esta Raspberry. Verifica la huella y lo prueba antes de reemplazar nada; si la versión nueva no arranca, vuelve sola a la anterior. La identidad del equipo y sus fotos pendientes se conservan.',
    'Leyendo registros…',
  ],
  ingles: [],
})
pantalla({
  nombre: 'equipo · kiosco, reiniciar la app y sin publicar',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, device_owner: 1 })
    forzar(esNull, null)
    forzar(esNull, { disponible: false })
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'reiniciar')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'nada publicado',
    'Actualizaciones: Se actualiza sola (modo kiosco).',
    'Reiniciar la aplicación',
    'Se reinicia la aplicación en el equipo. Deja de reportar unos segundos y vuelve sola.',
    'Reiniciar',
  ],
  ingles: [
    'nothing published',
    'Updates: Updates on its own (kiosk mode).',
    'Restart the app',
  ],
})
pantalla({
  nombre: 'equipo · se actualiza solo, version sin numero',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, app_actualiza_sola: 1, app_version_code: 10 })
    forzar(esNull, null)
    forzar(esNull, { disponible: true, version_code: 22 })
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'actualizar')
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'sin número',
    'Se instala sola, sin tocar el equipo.',
    'Actualizaciones: Se actualiza sola, sin tocar el teléfono.',
    'Se instalará la versión publicada en este equipo. Tardará un par de minutos y la app se reiniciará sola.',
  ],
  ingles: [
    'no number',
    'The published version will be installed on this device. It takes a couple of minutes and the app restarts on its own.',
  ],
})
pantalla({
  nombre: 'equipo · versiones sin dato, motivos de actualizacion',
  pintar: async (idioma) => {
    const C = await admin()
    forzar(esNull, { ...EQUIPO_SE, app_actualiza_motivo: 'sin_instalar_apps' })
    return pintar(idioma, el(C, { equipoId: 7, puedeOperar: false, puedeEncuadrar: false }))
  },
  espanol: ['sin dato', 'Actualizaciones: Pide un toque: en el teléfono está apagado «Instalar apps desconocidas» para Space Eye.'],
  ingles: [],
})
for (const [motivo, frase, codigo] of [
  ['otro_dueno', 'Pide un toque: otra tienda administra sus actualizaciones.', 20],
  ['sin_permiso', 'La próxima actualización pide un toque en el teléfono; después se actualiza sola.', 20],
  [null, 'Necesita una visita: esta versión no se puede actualizar a distancia.', 8],
] as const) {
  pantalla({
    nombre: `equipo · actualizaciones, ${motivo ?? 'version vieja'}`,
    pintar: async (idioma) => {
      const C = await admin()
      forzar(esNull, { ...EQUIPO_SE, app_actualiza_motivo: motivo, app_version_code: codigo })
      return pintar(idioma, el(C, { equipoId: 7, puedeOperar: false, puedeEncuadrar: false }))
    },
    espanol: [`Actualizaciones: ${frase}`],
    ingles: [],
  })
}
pantalla({
  nombre: 'equipo · cargando y error',
  pintar: async (idioma) => {
    const C = await admin()
    const a = pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
    forzado.cola = []
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    return a + pintar(idioma, el(C, { equipoId: 7, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['Leyendo el equipo…', 'No se pudo leer el equipo: '],
  ingles: [],
})

// ═══ La vista en vivo ═══════════════════════════════════════════════════════
const vivo = async () => comp('VistaEnVivo', 'VistaEnVivo')
const EQ_VIVO = { id: 7, nombre: 'Reforma 222', appVersion: '0.16.0', online: false }
pantalla({
  nombre: 'vivo · apagado, el equipo no reporta',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.16.0', vivo_por_servidor: true })
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Vista en vivo',
    'Foto',
    'Iniciar',
    'Vista en vivo apagada',
    'Iniciar vista en vivo',
    'El equipo no está reportando: puede que no conteste.',
    'Se detiene sola a los 3 minutos para no gastar datos del equipo.',
  ],
  ingles: [
    'Live view',
    'Start',
    'Live view off',
    'Start live view',
    'The device is not reporting: it may not answer.',
  ],
})
pantalla({
  nombre: 'vivo · sin permiso para operar',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.16.0', vivo_por_servidor: true })
    return pintar(idioma, el(C, { equipo: { ...EQ_VIVO, online: true }, puedeOperar: false, puedeEncuadrar: false }))
  },
  espanol: ['Necesitas permiso para operar equipos para abrir la vista.'],
  ingles: [],
})
pantalla({
  nombre: 'vivo · PC sin vista en vivo',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: 'pc-agent v1.0.3' })
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Agente anterior a la vista en vivo',
    'Esta PC corre el agente v1.0. Actualízala y la vista en vivo se enciende sola. Mientras tanto, usa «Foto» para ver el sitio.',
  ],
  ingles: [],
})
pantalla({
  nombre: 'vivo · punto a punto',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.12.0', vivo_por_servidor: false })
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Este equipo transmite punto a punto',
    'Su versión no pasa el video por el servidor de medios, y desde aquí solo se puede ver por ahí. Actualiza la app del equipo para verlo en vivo.',
  ],
  ingles: [],
})
pantalla({
  nombre: 'vivo · conectando',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.16.0', vivo_por_servidor: true })
    forzar(es('apagado'), 'conectando')
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Conectando…',
    'Conectando con el equipo…',
    'Puede tardar unos segundos mientras la cámara arranca. No hace falta volver a presionar.',
  ],
  ingles: [],
})
pantalla({
  nombre: 'vivo · no se pudo iniciar',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.16.0', vivo_por_servidor: true })
    forzar(esVacio, 'ERR-WHEP') // el motivo lo trae el error del visor: dato
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['No se pudo iniciar la transmisión', 'Reintentar'],
  ingles: [],
})
pantalla({
  nombre: 'vivo · no se pudo leer el equipo',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: ['No se pudo leer el equipo'],
  ingles: [],
})
// En vivo: estado 'vivo', y el orden de los useState de la vista.
const enVivo = (dispositivo: unknown, extra: Array<[(v: unknown) => boolean, unknown]>) => {
  forzar(esNull, dispositivo)
  forzar(es('apagado'), 'vivo')
  for (const [si, valor] of extra) forzar(si, valor)
}
pantalla({
  nombre: 'vivo · telefono, quien no encuadra mueve el lente',
  pintar: async (idioma) => {
    const C = await vivo()
    enVivo({ app_version: '0.16.0', vivo_por_servidor: true }, [
      [esCero, 95], // restante
      [es('main'), 'wide'], // lente
      [esFalse, true], // enfoqueFijo (reencuadrando y tomandoFoto ya pasaron)
      [esCero, 90], // rotacion
    ])
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: false }))
  },
  espanol: [
    'En vivo',
    'La transmisión se detiene sola para no gastar datos del equipo',
    'Corte en ',
    'Detener',
    'Tomar foto',
    'Enfoque fijo',
    'Zoom',
    'Exposición',
    'Balance de blancos',
    'Balance auto',
    'Luz de día',
    'Nublado',
    'Incandescente',
    'Fluorescente',
    'Girar a la izquierda',
    'Girar a la derecha',
    'Lente',
    'Lente normal',
    'Gran angular 0.5x',
    'Gran angular: abarca más desde la misma distancia. Solo si el equipo lo tiene.',
    'Ver con este lente',
    'Abre la vista con este lente. No cambia el encuadre del sitio.',
    'Descartar',
    'Volver al encuadre que tiene guardado el equipo',
    'Volver',
    'Volver a la orientación guardada del equipo',
    'Mueve el zoom, el lente, la luz y el enfoque a tu gusto y pide la foto: ',
    'sale como la estás viendo',
    'Nada de esto se guarda, así que el encuadre del sitio no cambia —fijarlo para todos lo hace solo el Dueño, porque borra lo que el equipo aprendió de su pantalla—.',
  ],
  ingles: [
    'Live',
    'Stops in ',
    'Stop',
    'Focus locked',
    'Auto balance',
    'Wide angle 0.5x',
    'View with this lens',
    'Discard',
    'Revert',
    'it comes out as you see it',
  ],
})
pantalla({
  nombre: 'vivo · raspberry, quien encuadra mueve el recorte',
  pintar: async (idioma) => {
    const C = await vivo()
    enVivo({ app_version: 'pi-agent v0.7.0' }, [
      [esCero, 30],
      [esCero, 0.3], // zoom
      [esCero, 0], // exposicion
      [esCero, 90], // rotacion
    ])
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Brillo',
    'Mover a los lados',
    'Mover arriba y abajo',
    'Fijar encuadre',
    'Guarda el encuadre actual. Se aplica también a las fotos programadas.',
    'Fijar orientación',
    'Fijar esta orientación para todos',
    'Lo que ves al mover los deslizadores es una vista previa: el equipo no cambia hasta que pulses ',
    ' (ahí la vista se reabre un segundo para traer la imagen nítida).',
    'La orientación fija es la que todos ven al abrir la vista.',
  ],
  ingles: [
    'Lock framing',
    'Lock orientation',
    'What you see while moving the sliders is a preview: the device does not change until you click ',
  ],
})
pantalla({
  nombre: 'vivo · raspberry, quien no encuadra acerca',
  pintar: async (idioma) => {
    const C = await vivo()
    enVivo({ app_version: 'pi-agent v0.7.0' }, [[esCero, 30], [esCero, 0.3]])
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: false }))
  },
  espanol: [
    'Ver nítido',
    'Abre la vista a este acercamiento, ya nítida. No cambia el encuadre del sitio.',
    'Aquí el acercamiento es una vista previa: «Ver nítido» abre la imagen de verdad. ',
  ],
  ingles: [],
})
pantalla({
  nombre: 'vivo · telefono, encuadre guardado',
  pintar: async (idioma) => {
    const C = await vivo()
    enVivo({ app_version: '0.16.0', vivo_por_servidor: true }, [[esCero, 30]])
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Encuadre guardado',
    'Fijar enfoque',
    'Toca el video para enfocar. El zoom, la exposición y el balance cambian la cámara al momento, pero son temporales: solo el zoom y el lente se guardan, al pulsar ',
  ],
  ingles: [
    'Framing saved',
    'Lock focus',
    'Click the video to focus.',
  ],
})
pantalla({
  nombre: 'vivo · vista en uso y reencuadrando',
  pintar: async (idioma) => {
    const C = await vivo()
    forzar(esNull, { app_version: '0.16.0', vivo_por_servidor: true })
    forzar(esNull, null) // errorCarga
    forzar(esNull, { con: 'Ana', minutos: 2 }) // ocupada
    forzar(esFalse, true) // reencuadrando
    forzar(esFalse, true) // tomandoFoto
    return pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
  },
  espanol: [
    'Vista en uso',
    ' está viendo este equipo desde hace 2 min.',
    'Este equipo solo admite un espectador a la vez: cada conexión de video gasta datos móviles del sitio. La transmisión se corta sola a los 3 minutos.',
    'Aplicando el encuadre nuevo…',
    'Pidiendo…',
  ],
  ingles: [
    'View in use',
    ' has been watching this device for 2 min.',
    'Applying the new framing…',
  ],
})
pantalla({
  nombre: 'vivo · aplicando y abriendo',
  pintar: async (idioma) => {
    const C = await vivo()
    enVivo({ app_version: 'pi-agent v0.7.0' }, [[esCero, 30], [esFalse, true], [esCero, 0.3]])
    const a = pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: true }))
    forzado.cola = []
    enVivo({ app_version: 'pi-agent v0.7.0' }, [[esCero, 30], [esFalse, true], [es('main'), 'wide']])
    return a + pintar(idioma, el(C, { equipo: EQ_VIVO, puedeOperar: true, puedeEncuadrar: false }))
  },
  espanol: ['Aplicando…', 'Abriendo…'],
  ingles: [],
})

// ═══ La galeria ═════════════════════════════════════════════════════════════
const galeria = async () => comp('Galeria', 'Galeria')
const FOTO_SE = (id: number, extra: Record<string, unknown> = {}) => ({
  id, device_id: 1, device_name: 'Reforma 222', taken_at: hace(id), storage_path: null, thumbnail_path: null,
  source: 'scheduled', verification_status: 'pending', is_correct: null, gps_lat: null, gps_lng: null,
  display_rotation: 0, overlay_style: null, ...extra,
})
const VERIF = ['pending', 'queued', 'running', 'failed', 'skipped', 'raro']
const ORIGENES = ['manual', 'scheduled', 'on_demand', 'creative_change', 'falla', 'boot']
const FOTOS = Array.from({ length: 20 }, (_, i) =>
  FOTO_SE(i + 1, {
    source: ORIGENES[i % ORIGENES.length],
    verification_status: i === 0 ? 'verified' : i === 1 ? 'verified' : VERIF[i % VERIF.length],
    is_correct: i === 0 ? 1 : 0,
    device_name: i === 3 ? null : 'Reforma 222',
  }),
)
pantalla({
  nombre: 'galeria · fotos con paginacion exacta',
  pintar: async (idioma) => {
    const C = await galeria()
    forzar(esNull, FOTOS)
    forzar(esCero, 45)
    forzar(esTrue, false)
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222' }])
    return pintar(idioma, el(C))
  },
  espanol: [
    'Galería de fotos',
    'Todas las fotos de los equipos: programadas, pedidas a mano, de creativos nuevos y de fallas.',
    'Actualizar',
    'Descargar álbum',
    'Descarga en un .zip todas las fotos que coinciden con los filtros, con su marca',
    'Desde',
    'Hasta',
    'Origen',
    'Todos los orígenes',
    'Manual',
    'Programada',
    'A petición',
    'Creativo nuevo',
    'Falla de pantalla',
    'Al encender',
    'Equipo',
    'Todos los equipos',
    'Ver foto de Reforma 222 en grande',
    'Ver foto de equipo en grande',
    'No se pudo cargar',
    'Eliminar fotografía',
    'Equipo 1',
    'Verificada · correcta',
    'Verificada · no coincide',
    'Sin verificar',
    'En cola',
    'Verificando',
    'Falló la verificación',
    'Omitida',
    ' fotos',
    'Anterior',
    'Página 1 de 3',
    'Siguiente',
  ],
  ingles: [
    'Photo gallery',
    'Download album',
    'All sources',
    'On request',
    'Screen fault',
    'At startup',
    'Verified · correct',
    'Verified · does not match',
    'Not verified',
    'Verification failed',
    ' photos',
    'Page 1 of 3',
    'Next',
  ],
})
pantalla({
  nombre: 'galeria · filtros sin fotos',
  pintar: async (idioma) => {
    const C = await galeria()
    forzar(esObjeto, { desde: '2026-10-01', hasta: '', origen: 'falla', equipo: '99' })
    forzar(esNull, [])
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: ['Equipo 99', 'Quitar filtros', 'Sin fotos para los filtros seleccionados.'],
  ingles: [
    'Device 99',
    'Clear filters',
    'No photos for the selected filters.',
  ],
})
pantalla({
  nombre: 'galeria · sin fotos',
  pintar: async (idioma) => {
    const C = await galeria()
    forzar(esNull, [])
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: ['Todavía no hay fotos de ningún equipo.'],
  ingles: [],
})
pantalla({
  nombre: 'galeria · error',
  pintar: async (idioma) => {
    const C = await galeria()
    forzar(esTrue, false)
    forzar(esNull, 'Space Eye respondió 500')
    return pintar(idioma, el(C))
  },
  espanol: ['No se pudieron consultar las fotos', 'Reintentar'],
  ingles: [],
})
pantalla({
  nombre: 'galeria · visor abierto, borrar y album',
  pintar: async (idioma) => {
    const C = await galeria()
    const dos = [FOTO_SE(1, { gps_lat: '19.4', gps_lng: '-99.1', storage_path: 's.jpg' }), FOTO_SE(2)]
    forzar(esObjeto, { desde: '', hasta: '', origen: 'manual', equipo: '' })
    forzar(esUno, 2) // pagina
    forzar(esNull, dos)
    forzar(esCero, 30)
    forzar(esTrue, false)
    forzar(esNull, null) // error
    forzar(esNull, dos[0]) // abierta
    forzar(esNull, dos[0]) // aBorrar
    forzar(esNull, '3/10') // album
    forzar(esFalse, false) // Miniatura 1: rota
    forzar(esFalse, false) // FotoGirada 1: vertical
    forzar(esFalse, false) // Miniatura 2: rota
    forzar(esCero, 0) // Visor: giroUsuario
    forzar(esNull, null) // render
    forzar(esFalse, true) // fallo
    return pintar(idioma, el(C))
  },
  espanol: [
    'Descargando 3/10',
    'Fotos filtradas',
    'Página 2',
    'Foto de Reforma 222',
    'Cerrar',
    'Foto siguiente',
    'No se pudo cargar la foto.',
    'Rotar',
    'Descargar',
    'Eliminar',
    '¿Eliminar esta fotografía de Reforma 222?',
    'No se puede deshacer.',
  ],
  ingles: [
    'Downloading 3/10',
    'Filtered photos',
    'Page 2',
    'Photo from Reforma 222',
    'Could not load the photo.',
    'Rotate',
    'Delete this photo from Reforma 222?',
    'This cannot be undone.',
  ],
})

// ═══ Fallas de la flota ═════════════════════════════════════════════════════
const fallas = async () => comp('FallasFlota', 'FallasFlota')
const FALLA_SE = (id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id, device_id: 1, equipo: 'Reforma 222', tipo: 'gabinete_apagado', nombre: 'F-APAGADO', fila: null,
  columna: null, gabinete: null, confianza: 0.8, estado, detectada_en: hace(100 + id), recuperada_en: null,
  cerrada_por: null, nota: null, detalle: null, evidencia: '/e.jpg', evidencia_mini: '/em.jpg',
  evidencia_recuperacion: null, evidencia_recuperacion_mini: null, ...extra,
})
const FALLAS = [
  FALLA_SE(1, 'abierta', { gabinete: 4, fila: 0, columna: 3 }),
  FALLA_SE(2, 'abierta', { detalle: { gabinetes: [4, 9], total: 15 } }),
  FALLA_SE(3, 'recuperada', { tipo: 'camara_movida', recuperada_en: hace(20), cerrada_por: 'usuario', nota: 'se limpió', evidencia_recuperacion: '/r.jpg' }),
  FALLA_SE(4, 'descartada', { tipo: 'sin_imagen', evidencia: null, evidencia_mini: null }),
  FALLA_SE(5, 'abierta', { tipo: 'pantalla_apagada', evidencia_mini: null, detalle: { gabinetes: [2] } }),
]
pantalla({
  nombre: 'fallas · abiertas, historial y descartar',
  pintar: async (idioma) => {
    const C = await fallas()
    forzar(esArregloVacio, FALLAS)
    forzar(esNull, { abierta: 3, recuperada: 1, descartada: 1 })
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222' }])
    forzar(esFalse, true) // listo
    forzar(esFalse, true) // cargado
    forzar(esNull, null) // error
    forzar(esNull, null) // aviso
    forzar(esNull, null) // verFoto
    forzar(esNull, { falla: FALLAS[0], estado: 'descartada' })
    return pintar(idioma, el(C))
  },
  espanol: [
    'Fallas de pantalla',
    'Lo que cada equipo detectó por sí mismo al revisar su pantalla. Se actualiza cada minuto.',
    'Todos los equipos',
    'Abiertas',
    'Recuperadas',
    'No eran falla',
    'Requieren atención · ',
    'Ver la foto de evidencia',
    'Evidencia de la falla',
    'Falla detectada',
    'Equipo',
    'Zona',
    'Gabinete 4 (fila 1, columna 4)',
    'Gabinetes 4, 9 (2 de 15)',
    'Gabinetes 2',
    'Cámara (hay que volver a marcar la pantalla)',
    'Lente tapada, o pantalla apagada de noche',
    'Detectada',
    'Confianza',
    'Ya se arregló',
    'No es falla',
    'Historial',
    'Todas',
    'Abierta',
    'Recuperada',
    'No era falla',
    ' · a mano',
    'Foto al detectar',
    'Foto al recuperar',
    'Falla',
    'Recuperación',
    'Evidencia',
    'al detectar',
    'al recuperar',
    'No es una falla',
    'El equipo no volverá a avisar de esta zona durante 7 días.',
    'Qué se hizo ',
    '(opcional)',
    'Por ejemplo: es un reflejo del sol',
    'Descartar',
  ],
  ingles: [
    'Screen faults',
    'Need attention · ',
    'Fault detected',
    'Cabinet 4 (row 1, column 4)',
    'Cabinets 4, 9 (2 of 15)',
    'Camera (the screen has to be marked again)',
    'It is fixed',
    'Not a fault',
    'Photo when detected',
    'What was done ',
    '(optional)',
  ],
})
pantalla({
  nombre: 'fallas · leyendo',
  pintar: async (idioma) => pintar(idioma, el(await fallas())),
  espanol: ['Leyendo las fallas…'],
  ingles: [],
})
pantalla({
  nombre: 'fallas · filtro vacio, error y marcar arreglada',
  pintar: async (idioma) => {
    const C = await fallas()
    forzar(esArregloVacio, [FALLAS[0]])
    forzar(esNull, null)
    forzar(esArregloVacio, [])
    forzar(esVacio, '') // deviceId
    forzar(esVacio, 'recuperada') // estado
    forzar(esFalse, true)
    forzar(esFalse, true)
    forzar(esFalse, false) // cargando
    forzar(esNull, 'sin red') // error
    forzar(esNull, null) // aviso
    forzar(esNull, '/e.jpg') // verFoto
    forzar(esNull, { falla: FALLAS[0], estado: 'recuperada' })
    return pintar(idioma, el(C))
  },
  espanol: [
    'No se pudieron leer las fallas',
    'Sin fallas con este filtro.',
    'Marcar como arreglada',
    'Se cierra sin esperar a que el equipo lo compruebe en su próxima foto.',
    'Por ejemplo: se cambió la fuente',
    'Marcar arreglada',
  ],
  ingles: [
    'Could not read the faults',
    'No faults with this filter.',
    'Mark as fixed',
    'Mark fixed',
  ],
})

// ═══ Campañas de verificacion ═══════════════════════════════════════════════
const campanas = async () => comp('CampanasEyes', 'CampanasEyes')
const CAMPANAS = [
  { id: 1, name: 'Verano', advertiser: 'Refrescos', start_date: '2026-11-01T00:00:00Z', end_date: '2026-11-30T00:00:00Z', active: 1, verification_enabled: 1, creative_path: 'c.jpg', device_count: 3, photo_count: 1200, origen: 'spaceos:acme' },
  { id: 2, name: 'Invierno', advertiser: null, start_date: null, end_date: null, active: 0, verification_enabled: 1, creative_path: null, device_count: 0, photo_count: 0, origen: null },
  { id: 3, name: 'Otoño', advertiser: 'Banco', start_date: '2026-09-01', end_date: '2026-09-30', active: 1, verification_enabled: 0, creative_path: null, device_count: 1, photo_count: 5, origen: null },
]
pantalla({
  nombre: 'campañas · lista y nueva campaña',
  pintar: async (idioma) => {
    const C = await campanas()
    forzar(esNull, CAMPANAS)
    forzar(esTrue, false)
    forzar(esFalse, true) // mostrarForm
    return pintar(idioma, el(C))
  },
  espanol: [
    'Campañas de verificación',
    'La creatividad de referencia es la imagen contra la que las cámaras comparan lo que aparece en la pantalla.',
    'Nueva campaña',
    'Nombre',
    'Ej. Verano 2026',
    'Anunciante',
    'Ej. Coca-Cola',
    'Fecha inicio',
    'Fecha fin',
    'Equipos donde va esta campaña',
    'No hay equipos',
    '0 seleccionados',
    'Verificar automáticamente las fotos contra la creatividad',
    'Requiere subir la creatividad. Sin ella la verificación no puede hacer nada.',
    'Creatividad de referencia',
    'Sube la imagen del anuncio',
    'JPG o PNG, hasta 20 MB',
    'Elegir imagen',
    'Es la imagen tal como debe verse en la pantalla. Sirve para comprobar que la campaña está al aire y, más adelante, para que el sistema reconozca ese creativo entre los que rotan en el sitio.',
    'Crear campaña',
    'Cancelar',
    'Creatividad de Verano',
    'Sin creatividad de referencia',
    'Activa',
    'Inactiva',
    'Sin anunciante',
    ' · De Operaciones',
    'Equipos',
    'Fotos',
    'Periodo',
    '01/11 – 30/11',
    '— – —',
    'Verificación activa',
    'Verificación sin creatividad',
    'Sin verificación',
    'Se cambia en Operaciones',
    'Llegó de Operaciones: se cambia allá (creativo, pantallas y fechas de sus reservas) y aquí se actualiza solo.',
    'Editar',
  ],
  ingles: [
    'Verification campaigns',
    'New campaign',
    'E.g. Summer 2026',
    'Devices where this campaign runs',
    '0 selected',
    'Reference creative',
    'Create campaign',
    'No advertiser',
    ' · From Operations',
    'Nov 1 – Nov 30',
    'Changed in Operations',
    'Verification without a creative',
  ],
})
const FORM_EDITAR = { id: 3, name: 'Otoño', advertiser: 'Banco', start_date: '2026-09-01', end_date: '2026-09-30', verification_enabled: false, device_ids: [1] }
pantalla({
  nombre: 'campañas · editar con equipos y error',
  pintar: async (idioma) => {
    const C = await campanas()
    forzar(esNull, CAMPANAS)
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222', billboard_code: 'K-01' }, { id: 2, name: 'GL-2', billboard_code: null }])
    forzar(esTrue, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esFalse, true)
    forzar(esIndefinido, FORM_EDITAR)
    forzar(esFalse, false) // guardando
    forzar(esNull, 'ERR-FORM') // errorForm: lo pone el manejador, no el render
    forzar(esFalse, true) // cargandoEquiposAsignados
    forzar(esNull, null) // archivoNuevo
    forzar(esNull, '/c.jpg') // vistaPrevia
    forzar(esNull, 'c.jpg') // creativoActual
    return pintar(idioma, el(C))
  },
  espanol: ['Editar campaña', 'Leyendo equipos asignados…', 'Cambiar imagen', 'Esta campaña ya tiene creatividad guardada.', 'Guardar cambios'],
  ingles: [
    'Edit campaign',
    'Reading assigned devices…',
    'Change image',
    'Save changes',
  ],
})
pantalla({
  nombre: 'campañas · imagen nueva y seleccionados',
  pintar: async (idioma) => {
    const C = await campanas()
    forzar(esNull, [])
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222', billboard_code: 'K-01' }])
    forzar(esTrue, false)
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esFalse, true)
    forzar(esIndefinido, FORM_EDITAR)
    forzar(esFalse, true) // guardando
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esNull, { name: 'nuevo.jpg' })
    return pintar(idioma, el(C))
  },
  espanol: ['1 seleccionados', 'La imagen nueva se sube al guardar.', 'Guardando…', 'No hay campañas creadas', 'Crea una para agrupar las fotos de un cliente y comprobar que su anuncio está al aire.'],
  ingles: [],
})
pantalla({
  nombre: 'campañas · error al cargar',
  pintar: async (idioma) => {
    const C = await campanas()
    forzar(esTrue, false)
    forzar(esNull, 'sin red')
    return pintar(idioma, el(C))
  },
  espanol: ['No se pudieron cargar las campañas'],
  ingles: [],
})

// ═══ Programacion de fotos ══════════════════════════════════════════════════
const programacion = async () => comp('Programacion', 'Programacion')
const PROG = (id: number, extra: Record<string, unknown>) => ({
  id, name: `Prog ${id}`, device_id: null, group_id: null, campaign_id: null, device_name: null, group_name: null,
  campaign_name: null, frequency_type: 'random_windows', interval_minutes: null, cron_expression: null,
  specific_times: null, windows: [{ ini: '08:00', fin: '10:00' }], valid_from: null, valid_until: null,
  next_fire_at: dentro(30), active: 1, fotos: 12, fotos_semana: 3, ...extra,
})
const PROGRAMAS = [
  PROG(1, {}),
  PROG(2, { active: 0, device_name: 'Reforma 222', frequency_type: 'specific_times', specific_times: '["09:00","17:00"]' }),
  PROG(3, { valid_from: '2026-12-01', campaign_name: 'Verano', frequency_type: 'interval', interval_minutes: 120 }),
  PROG(4, { valid_until: '2026-10-01', group_name: 'Norte', frequency_type: 'interval', interval_minutes: 45 }),
  PROG(5, { next_fire_at: dentro(60 * 5), frequency_type: 'cron', cron_expression: '0 9 * * *', fotos_semana: 0 }),
  PROG(6, { next_fire_at: hace(10), windows: [] }),
  PROG(7, { next_fire_at: dentro(60 * 48) }),
  PROG(8, { next_fire_at: null }),
]
pantalla({
  nombre: 'programacion · lista',
  pintar: async (idioma) => {
    const C = await programacion()
    forzar(esNull, PROGRAMAS)
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: [
    'Programación de fotos',
    'Las fotos se toman solas, a una hora impredecible dentro de las franjas que definas.',
    'Nueva programación',
    'Todos los equipos',
    'Campaña: Verano',
    'Grupo: Norte',
    '08:00-10:00 (al azar)',
    'Sin franjas',
    'Cada 2 h',
    'Cada 45 min',
    'Pausada',
    'Empieza el 1 dic 2026',
    'Venció el 1 oct 2026',
    'Activa',
    'No dispara hasta el 1 dic 2026',
    'No dispara: vencida',
    'Sin calcular',
    ' (en 30 min)',
    ' (en 5 h)',
    ' (en cola)',
    'Próxima: ',
    ' fotos ',
    '(3 esta semana)',
    'Editar',
    'Pausar',
    'Activar',
    'Eliminar',
    'Aplica a',
    'Cuándo',
    'Próxima foto',
    'Acciones',
  ],
  ingles: [
    'Photo scheduling',
    'New schedule',
    'Campaign: Verano',
    'Group: Norte',
    '08:00-10:00 (random)',
    'No dayparts',
    'Every 2 h',
    'Every 45 min',
    'Paused',
    'Starts Dec 1, 2026',
    'Expired on Oct 1, 2026',
    'Does not fire: expired',
    ' (in 30 min)',
    '(3 this week)',
    'Next: ',
  ],
})
pantalla({
  nombre: 'programacion · nueva con franjas',
  pintar: async (idioma) => {
    const C = await programacion()
    forzar(esNull, [])
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222' }, { id: 2, name: 'GL-2' }])
    forzar(esTrue, false)
    forzar(esNull, null)
    forzar(esNull, {
      id: null, name: '', destino: 'todos', device_id: null, campaign_id: null, frequency_type: 'random_windows',
      interval_minutes: 60, specific_times: ['12:00'], windows: [{ ini: '08:00', fin: '10:00' }, { ini: '13:00', fin: '15:00' }],
      valid_from: '', valid_until: '',
    })
    return pintar(idioma, el(C))
  },
  espanol: [
    'Nueva programación',
    'Ej. Evidencia diaria de la ruta norte',
    'Aplicar a',
    'Un equipo',
    'Una campaña',
    'Aplica a los 2 equipos de la flota, incluyendo los que se den de alta después.',
    'Desde ',
    'Hasta ',
    '(opcional)',
    'Hora al azar dentro de franjas (recomendado)',
    'Horas exactas',
    'Cada cierto tiempo',
    'Una foto por franja, en un minuto sorteado cada día. La hora no se repite, así que la evidencia no se puede acomodar de antemano.',
    'Franja 1',
    'Inicio de la franja 1',
    'Fin de la franja 2',
    'Quitar la franja 1',
    'Quitar',
    'Agregar franja',
    'Rápido:',
    'Mañana, tarde y noche',
    'Una al día',
    'Consumo estimado por equipo',
    '2 fotos al día',
    '90 MB al mes',
    'A 1.5 MB por foto, que es lo que pesan hoy. Cada equipo gasta ~20 MB al mes sin fotos programadas.',
    'Crear programación',
    'Todavía no hay ninguna programación.',
    'Hoy las fotos solo se toman cuando alguien las pide a mano.',
  ],
  ingles: [
    'Random time within dayparts (recommended)',
    'Daypart 1',
    'Remove daypart 1',
    'Add daypart',
    'Morning, afternoon and evening',
    '2 photos a day',
    '90 MB a month',
    'Estimated usage per device',
  ],
})
pantalla({
  nombre: 'programacion · editar cada cierto tiempo a un equipo',
  pintar: async (idioma) => {
    const C = await programacion()
    forzar(esNull, [])
    forzar(esArregloVacio, [{ id: 1, name: 'Reforma 222', billboard_code: 'K-01' }])
    forzar(esTrue, false)
    forzar(esNull, null)
    forzar(esNull, {
      id: 4, name: 'Cada rato', destino: 'device', device_id: 1, campaign_id: null, frequency_type: 'interval',
      interval_minutes: 1, specific_times: ['12:00'], windows: [], valid_from: '', valid_until: '',
    })
    forzar(esFalse, true) // guardando
    return pintar(idioma, el(C))
  },
  espanol: ['Editar programación', '— Elegir equipo —', 'Cada cuántos minutos', 'Ojo con los datos móviles: a este ritmo son ', '1440 fotos al día', '63.3 GB al mes', 'Guardando…'],
  ingles: [
    'Edit schedule',
    '— Choose device —',
    'Interval in minutes',
    'Watch the mobile data: at this rate that is ',
    '1440 photos a day',
    '63.3 GB a month',
  ],
})
pantalla({
  nombre: 'programacion · horas exactas a una campaña y eliminar',
  pintar: async (idioma) => {
    const C = await programacion()
    forzar(esNull, [PROGRAMAS[0]])
    forzar(esArregloVacio, [])
    forzar(esArregloVacio, [{ id: 1, name: 'Verano', device_count: 3 }])
    forzar(esTrue, false)
    forzar(esNull, null)
    forzar(esNull, {
      id: 4, name: 'Fijas', destino: 'campaign', device_id: null, campaign_id: 1, frequency_type: 'specific_times',
      interval_minutes: 60, specific_times: ['12:00'], windows: [], valid_from: '', valid_until: '',
    })
    forzar(esNull, PROGRAMAS[0]) // aBorrar
    return pintar(idioma, el(C))
  },
  espanol: [
    '— Elegir campaña —',
    'Verano · 3 equipos',
    'Siempre al mismo minuto. Sirve para un reporte fijo, pero como evidencia es débil: una hora predecible se puede preparar.',
    'Hora 1',
    'Quitar la hora 1',
    'Agregar hora',
    '1 foto al día',
    '45 MB al mes',
    'Eliminar programación',
    'Se eliminará «Prog 1».',
    'Las fotos que ya se tomaron se conservan; lo que se pierde es la programación futura.',
    'ELIMINAR',
  ],
  ingles: [
    'Verano · 3 devices',
    'Add time',
    '1 photo a day',
    'Delete schedule',
    '“Prog 1” will be deleted.',
    'DELETE',
  ],
})
pantalla({
  nombre: 'programacion · cron y error',
  pintar: async (idioma) => {
    const C = await programacion()
    forzar(esTrue, false)
    forzar(esNull, 'sin red')
    forzar(esNull, {
      id: 5, name: 'Cron', destino: 'todos', device_id: null, campaign_id: null, frequency_type: 'cron',
      interval_minutes: 60, specific_times: [], windows: [], valid_from: '', valid_until: '',
    })
    return pintar(idioma, el(C))
  },
  espanol: ['No se pudieron cargar las programaciones', 'Expresión cron (no editable aquí)', 'sin fotos'],
  ingles: [],
})

// ═══ Verificacion ═══════════════════════════════════════════════════════════
const verificacion = async () => comp('Verificacion', 'Verificacion')
const VERIFS = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1, device_name: i === 1 ? null : 'Reforma 222', thumbnail_path: i === 2 ? null : 't.jpg', storage_path: i === 2 ? null : 's.jpg',
  ssim_score: '0.812', phash_distance: 6, ocr_match: i % 2, is_correct: i % 2, confidence: '0.93', processed_at: hace(i),
}))
pantalla({
  nombre: 'verificacion · resultados con paginas',
  pintar: async (idioma) => {
    const C = await verificacion()
    forzar(esNull, VERIFS)
    forzar(esUno, 2)
    forzar(esTrue, false)
    return pintar(idioma, el(C))
  },
  espanol: [
    'Verificación',
    'Comparación de cada foto contra la creatividad de su campaña.',
    'Todos los resultados',
    'Correctos',
    'Incorrectos',
    'Ver la foto completa',
    'Foto de Reforma 222',
    'Foto de equipo',
    'Correcto',
    'Incorrecto',
    'Confianza 93%',
    'OCR Sí',
    'OCR No',
    'Foto',
    'Coincidencia OCR',
    'Resultado',
    'Confianza',
    'Fecha',
    'Sí',
    'Página 2',
    'Página anterior',
    'Anterior',
    'Página siguiente',
    'Siguiente',
  ],
  ingles: [
    'Verification',
    'All results',
    'Correct',
    'Incorrect',
    'Confidence 93%',
    'OCR Yes',
    'OCR match',
    'Previous page',
  ],
})
pantalla({
  nombre: 'verificacion · vacia y error',
  pintar: async (idioma) => {
    const C = await verificacion()
    forzar(esNull, [])
    forzar(esTrue, false)
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esTrue, false)
    forzar(esNull, 'sin red')
    return a + pintar(idioma, el(C))
  },
  espanol: ['Sin resultados de verificación', 'No se pudieron cargar las verificaciones'],
  ingles: [],
})

// ═══ Graficas ═══════════════════════════════════════════════════════════════
const graficas = async () => comp('Graficas', 'Graficas')
const DATOS_GRAF = {
  resumen: { cpu_temp_max: 61.2, battery_pct_min: 15, samples: 1200 },
  alertas: [{ level: 'warning', type: 'cpu', message: 'ALERTA-CPU', value: 61 }],
  serie: [{ reported_at: '2026-11-02T10:00:00Z', cpu_temp: 50, battery_temp: 30, battery_pct: 80, signal_dbm: -80, storage_free_mb: 100, ram_free_mb: 50 }],
  umbrales: { cpu_temp_max: 60, battery_temp_max: 45, battery_pct_min: 20, signal_dbm_min: -105, storage_free_min_mb: 200 },
  enLinea: true,
  consumo: { mobile_today: 512, wifi_today: 2048, mobile_week: 3 * 1048576, wifi_week: null, mobile_month: 2 * 1073741824, wifi_month: 0, mobile_total: 5 * 1073741824, wifi_total: 1 },
  granularidad: 'raw',
}
pantalla({
  nombre: 'graficas · con datos y csv fallido',
  pintar: async (idioma) => {
    const C = await graficas()
    forzar(esNull, [{ id: 1, name: 'Reforma 222', online: true, last_seen_at: hace(1) }, { id: 2, name: 'GL-2', online: false, last_seen_at: null }])
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(esVacio, '') // desde
    forzar(esVacio, '') // hasta
    forzar(esNull, DATOS_GRAF)
    forzar(esFalse, false) // cargando
    forzar(esNull, null) // error
    forzar(esFalse, false) // exportando
    forzar(esNull, 'Space Eye respondió 500') // errorCsv
    return pintar(idioma, el(C))
  },
  espanol: [
    'Gráficas',
    'Estadísticas y telemetría de cada equipo: cómo ha estado y cuánto consume.',
    'Actualizar',
    'Exportar CSV',
    'Dispositivo',
    ' · sin conexión',
    'Periodo',
    'Hoy (24 h)',
    'Semana',
    'Mes',
    'Personalizado',
    'Exportación fallida',
    'Estado',
    'En línea',
    'Temp CPU máx',
    '61.2 °C',
    'Batería mín',
    '15 %',
    'Muestras',
    'Consumo de datos (chip / WiFi)',
    'Consumo de datos por periodo',
    'Móvil',
    'Hoy',
    'Total',
    '512 B',
    '2.0 KB',
    '3.0 MB',
    'n/d',
    '2.00 GB',
    'Temperatura (CPU / batería)',
    'Nivel de batería',
    'Intensidad de señal',
    'Almacenamiento y memoria libres',
  ],
  ingles: [
    'Charts',
    'Export CSV',
    ' · offline',
    'Today (24 h)',
    'Export failed',
    'Max CPU temp',
    'Min battery',
    '15%',
    'Data usage (SIM / WiFi)',
    'n/a',
    'Battery level',
  ],
})
pantalla({
  nombre: 'graficas · personalizado sin consumo ni telemetria',
  pintar: async (idioma) => {
    const C = await graficas()
    forzar(esNull, [{ id: 1, name: 'Reforma 222', online: true, last_seen_at: hace(1) }])
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(es('24h'), 'custom')
    forzar(esNull, { ...DATOS_GRAF, resumen: { samples: 0 }, consumo: null, serie: [], alertas: [], enLinea: false })
    return pintar(idioma, el(C))
  },
  espanol: [
    'Desde',
    'Hasta',
    'Aplicar',
    'Sin comunicación',
    'Sin datos de consumo (requiere la app v0.7.0 en el equipo).',
    'Sin telemetría en el periodo seleccionado para este dispositivo.',
  ],
  ingles: [
    'Apply',
    'No usage data (requires app v0.7.0 on the device).',
    'No telemetry in the selected period for this device.',
  ],
})
pantalla({
  nombre: 'graficas · sin equipos, errores',
  pintar: async (idioma) => {
    const C = await graficas()
    forzar(esNull, [])
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    const b = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esNull, [{ id: 1, name: 'Reforma 222', online: true, last_seen_at: hace(1) }])
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(esNull, null) // datos
    forzar(esFalse, false)
    forzar(esNull, 'sin red') // error
    return a + b + pintar(idioma, el(C))
  },
  espanol: ['Todavía no hay equipos Space Eyes dados de alta para esta cuenta.', 'No se pudo consultar Space Eyes', 'No se pudo leer la telemetría'],
  ingles: [],
})

// ═══ Ajustar texto ══════════════════════════════════════════════════════════
const texto_ = async () => comp('AjustarTexto', 'AjustarTexto')
const EQ_TEXTO = [{ id: 1, name: 'Reforma 222', online: 1 }, { id: 2, name: 'GL-2', online: 0 }]
const FOTO_REF = { id: 9, url: '/f.jpg', tomadaEn: hace(5), giro: 0 }
pantalla({
  nombre: 'texto · con foto, capturando y sin guardar',
  pintar: async (idioma) => {
    const { MARCA_POR_OMISION } = await import('../space-eyes-marca-editor')
    const C = await texto_()
    forzar(esNull, EQ_TEXTO)
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(esFalse, false)
    forzar(esObjeto, MARCA_POR_OMISION)
    forzar(esObjeto, { ...MARCA_POR_OMISION, x: 20 })
    forzar(esNull, FOTO_REF)
    forzar(esFalse, true) // capturando
    return pintar(idioma, el(C))
  },
  espanol: [
    'Ajustar texto de las fotos',
    'Toma una fotografía de prueba y acomoda cómo se verá ',
    'nombre · fecha · hora',
    'Se aplica a todas las fotos del equipo.',
    'Equipo',
    ' (sin comunicación)',
    'Capturando…',
    'Esperando la foto del equipo (hasta 30 s)…',
    'Arrastra sobre la foto para mover la marca (o usa las flechas del teclado). Los cambios se ven al momento.',
    'La fecha y la hora de la vista previa son las de esta foto.',
    'Posición de la marca: arrastra o usa las flechas',
    'Foto de referencia del equipo',
    'Mostrar marca',
    'Tamaño',
    'Peso de la fuente',
    'Normal',
    'Negrita',
    'Color del texto',
    'Alineación',
    'Izquierda',
    'Centro',
    'Derecha',
    'Espaciado entre líneas',
    'Espaciado entre letras',
    'Sombra',
    'Fondo semitransparente',
    'sin guardar',
    'Descartar',
    'Guardar configuración',
  ],
  ingles: [
    'Photo label',
    'name · date · time',
    ' (not reporting)',
    'Capturing…',
    'Label position: drag or use the arrow keys',
    'Font weight',
    'Bold',
    'Semi-transparent background',
    'unsaved',
    'Save settings',
  ],
})
pantalla({
  nombre: 'texto · sin foto ni permiso',
  pintar: async (idioma) => {
    sesion.puede = false
    const C = await texto_()
    forzar(esNull, EQ_TEXTO)
    forzar(esNull, null)
    forzar(esVacio, '1')
    return pintar(idioma, el(C))
  },
  espanol: [
    'Tomar fotografía',
    'La cámara solo captura al pulsar el botón.',
    'Solo quien puede editar inventario puede tomar la foto y guardar la marca.',
    'Toma una fotografía para previsualizar',
  ],
  ingles: [
    'Take photo',
    'The camera only captures when you click the button.',
    'Take a photo to preview',
  ],
})
pantalla({
  nombre: 'texto · marca desactivada y cargando',
  pintar: async (idioma) => {
    const { MARCA_POR_OMISION } = await import('../space-eyes-marca-editor')
    const C = await texto_()
    forzar(esNull, EQ_TEXTO)
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(esFalse, false)
    forzar(esObjeto, MARCA_POR_OMISION)
    forzar(esObjeto, { ...MARCA_POR_OMISION, enabled: false })
    forzar(esNull, FOTO_REF)
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esNull, EQ_TEXTO)
    forzar(esNull, null)
    forzar(esVacio, '1')
    forzar(esFalse, true) // cargandoEquipo
    return a + pintar(idioma, el(C))
  },
  espanol: ['Marca desactivada', 'Cargando…'],
  ingles: [],
})
pantalla({
  nombre: 'texto · sin equipos, error y lista cargando',
  pintar: async (idioma) => {
    const C = await texto_()
    forzar(esNull, [])
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esNull, null)
    forzar(esNull, 'sin red')
    const b = pintar(idioma, el(C))
    forzado.cola = []
    return a + b + pintar(idioma, el(C))
  },
  espanol: ['Todavía no hay equipos Space Eyes dados de alta para esta cuenta.', 'No se pudo consultar Space Eyes', 'Cargando…'],
  ingles: [],
})

// ═══ Agregar un dispositivo ═════════════════════════════════════════════════
const alta = async () => comp('AltaDispositivo', 'AltaDispositivo')
const VINC = (codigo: string, extra: Record<string, unknown>) => ({
  codigo, tipo: 'telefono', nota: null, estado: 'vigente', usos: 0, usos_max: 1, equipos: [], creado_por: 'SPACE OS · Ana',
  creado_en: hace(60), expira_en: dentro(60), usado_en: null, equipo: null, ...extra,
})
const VINCULACIONES = [
  VINC('AAA111', {}),
  VINC('BBB222', { estado: 'usado', equipo: { id: 4, nombre: null } }),
  VINC('CCC333', { estado: 'vencido', tipo: 'raspberry', nota: 'Av. Juárez' }),
  VINC('DDD444', { estado: 'cancelado', tipo: 'pc' }),
  VINC('EEE555', { estado: 'usado' }),
  VINC('FFF666', { usos_max: 5, usos: 2, equipos: [{ id: 8, nombre: 'Uno' }, { id: 9, nombre: null }] }),
  VINC('GGG777', { usos_max: 3, usos: 3, estado: 'agotado' }),
  VINC('HHH888', { usos_max: 3, usos: 1, estado: 'cancelado' }),
  VINC('III999', { usos_max: 3, usos: 1, estado: 'vencido' }),
]
const GENERADO = { ...VINC('ZXC123', {}), enlace: 'spaceeye://vincular?c=ZXC123', servidor: 'https://eyes.ejemplo.mx' }
pantalla({
  nombre: 'alta · telefono con codigo y lista',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(esNull, { apk: { url: '/apk', version: '0.16.4' }, agentePc: { url: '/pc', version: '1.3.0' } })
    forzar(esNull, VINCULACIONES)
    forzar(esNull, GENERADO)
    return pintar(idioma, el(C))
  },
  espanol: [
    'Agregar dispositivo',
    'Cada equipo nuevo entra con un código de un solo uso que se genera aquí. Elige qué equipo vas a instalar.',
    'Teléfono Android',
    'Se vincula escaneando un QR',
    'Raspberry Pi',
    'Se instala sola desde la microSD',
    'PC con cámara IP',
    'Con un código en el instalador',
    '¿Cuántos equipos vas a instalar?',
    'Uno solo: el código sirve una vez.',
    'Instala la app ',
    ' en el teléfono',
    'descargar la app 0.16.4',
    'Genera el código y ábrelo junto al teléfono.',
    'En la app, toca ',
    'Vincular',
    ' y escanea el QR. Si la cámara no lo lee, escribe el código.',
    'El teléfono aparece en Equipos en unos segundos. Ahí le pones el nombre del sitio.',
    'Sirve una sola vez',
    ' · vence ',
    'Copiar',
    'Escanéalo desde la app Space Eye',
    'Códigos de vinculación',
    'Los de los últimos 30 días. Uno vigente que ya no vayas a usar, cancélalo.',
    'Código',
    'Equipo',
    'Sitio',
    'Estado',
    'Generó',
    'Teléfono',
    'Raspberry',
    'Vigente hasta ',
    'Usado · equipo 4',
    'Vencido',
    'Cancelado',
    'Usado',
    '2 de 5 equipos',
    ' · vigente hasta ',
    'equipo 9',
    '3 de 3 equipos',
    ' · completo',
    ' · cancelado',
    ' · vencido',
    'Ana',
  ],
  ingles: [
    'Add device',
    'Android phone',
    'Install the ',
    ' app on the phone',
    'download app 0.16.4',
    'In the app, choose ',
    'Pair',
    'Works only once',
    ' · expires ',
    'Pairing codes',
    'Valid until ',
    'Used · device 4',
    '2 of 5 devices',
    ' · full',
    'device 9',
  ],
})
pantalla({
  nombre: 'alta · telefono en lote, sin codigo y error',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(esNull, null)
    forzar(esNull, [])
    forzar(esNull, null)
    forzar(esFalse, false)
    forzar(esUno, 5) // cuantos
    forzar(esUno, 1) // dias
    forzar(esNull, 'ERR-ALTA')
    return pintar(idioma, el(C))
  },
  espanol: [
    'El código dura',
    '1 día',
    '3 días',
    '7 días',
    '14 días',
    'Un solo QR para los 5: cada equipo entra por separado. Al equipo 6 ya no lo deja entrar, y puedes cancelarlo en cualquier momento.',
    'Generar código',
    'Aquí aparecerá el QR',
    'Todavía no se ha generado ninguno.',
  ],
  ingles: [
    'The code lasts',
    '1 day',
    '14 days',
    'One QR for all 5: each device joins separately. Device number 6 is not let in, and you can cancel it at any time.',
    'Generate code',
    'The QR will show up here',
  ],
})
pantalla({
  nombre: 'alta · raspberry sola en lote, archivo listo',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(es('telefono'), 'raspberry')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { ...GENERADO, usos_max: 3 })
    forzar(esFalse, false)
    forzar(esUno, 3)
    forzar(esUno, 14)
    forzar(esNull, null)
    forzar(es('sola'), 'sola')
    forzar(esVacio, '')
    forzar(es('wifi'), 'wifi')
    forzar(esVacio, '')
    forzar(esVacio, '')
    forzar(esFalse, true) // kitListo
    return pintar(idioma, el(C))
  },
  espanol: [
    'Se instala sola (recomendado)',
    'Ya está encendida',
    'Nombre del sitio (opcional)',
    'Déjalo vacío para varias',
    'El mismo archivo va en las 3 microSD. A cada Raspberry le pones el nombre de su sitio en Equipos cuando aparezca.',
    '¿Cómo se conecta a internet en el sitio?',
    'Cable o módem',
    'Nombre de la red',
    'Contraseña',
    'La contraseña solo se guarda dentro del archivo que descargas; no se envía a ningún servidor.',
    'Descargar archivo para la microSD',
    'Listo: se descargó el archivo con el código ZXC123.',
    'Cópialo en las 3 microSD; sirve hasta para 3 Raspberry.',
    ' Vence ',
    'En tu computadora, graba la microSD con ',
    ': Raspberry Pi OS Lite (64-bit). Cuando pregunte si quieres personalizar, elige ',
    'Sin sacar la microSD, ábrela en el explorador (se llama ',
    ') y copia ahí ',
    ' del archivo descargado. Reemplaza los que trae.',
    'Pon la microSD en la Raspberry, conecta la cámara, el cable o módem si se usa, y la fuente de 5V/3A.',
    'En 5 a 15 minutos aparece sola en ',
    '. Nadie tiene que conectarse a ella.',
    'Un solo archivo para los 3',
    'Cargando…',
  ],
  ingles: [
    'Installs itself (recommended)',
    'Cable or modem',
    'Done: the file with code ZXC123 was downloaded.',
    'Copy it to all 3 microSD cards; it works for up to 3 Raspberry devices.',
    'On your computer, flash the microSD with ',
  ],
})
pantalla({
  nombre: 'alta · raspberry sola, un equipo',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(es('telefono'), 'raspberry')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, GENERADO)
    forzar(esFalse, false)
    forzar(esUno, 1)
    forzar(esUno, 14)
    forzar(esNull, null)
    forzar(es('sola'), 'sola')
    forzar(esVacio, '')
    forzar(es('wifi'), 'cable')
    forzar(esVacio, '')
    forzar(esVacio, '')
    forzar(esFalse, true)
    return pintar(idioma, el(C))
  },
  espanol: ['Av. Juárez 120 · Cara A', 'Sirve para una sola Raspberry.'],
  ingles: [],
})
pantalla({
  nombre: 'alta · raspberry encendida con comando',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(es('telefono'), 'raspberry')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { ...GENERADO, usos_max: 4 })
    forzar(esFalse, false)
    forzar(esUno, 4)
    forzar(esUno, 7)
    forzar(esNull, null)
    forzar(es('sola'), 'encendida')
    return pintar(idioma, el(C))
  },
  espanol: [
    'Genera el código.',
    'En la Raspberry (con internet), abre una terminal y pega el comando.',
    'Aparece en Equipos en uno o dos minutos.',
    'Sirve para 4 equipos',
    'Copiar comando',
  ],
  ingles: [],
})
pantalla({
  nombre: 'alta · raspberry encendida sin direccion publica',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(es('telefono'), 'raspberry')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { ...GENERADO, servidor: 'http://127.0.0.1:3000' })
    forzar(esFalse, false)
    forzar(esUno, 1)
    forzar(esUno, 1)
    forzar(esNull, null)
    forzar(es('sola'), 'encendida')
    return pintar(idioma, el(C))
  },
  espanol: [
    'Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): sin ella el comando instalaría la Raspberry contra una dirección que desde el sitio no existe.',
  ],
  ingles: [],
})
pantalla({
  nombre: 'alta · PC con y sin direccion',
  pintar: async (idioma) => {
    const C = await alta()
    forzar(es('telefono'), 'pc')
    forzar(esNull, { apk: null, agentePc: { url: '/pc', version: '1.3.0' } })
    forzar(esNull, null)
    forzar(esNull, GENERADO)
    forzar(esFalse, false)
    forzar(esUno, 2)
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(es('telefono'), 'pc')
    forzar(esNull, null)
    forzar(esNull, null)
    forzar(esNull, { ...GENERADO, servidor: 'http://localhost' })
    return a + pintar(idioma, el(C))
  },
  espanol: [
    'Descarga el instalador en la PC del sitio',
    'SpaceEyeAgente 1.3.0',
    ' y ábrelo.',
    'Genera el código y escríbelo cuando el asistente te lo pida, junto con la cámara IP.',
    'La PC aparece en Equipos al terminar el asistente.',
    'Un solo código para los 2',
    'Dirección del servidor de tu empresa (el asistente la pide): ',
    'Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): pídesela a quien lo administra antes de correr el asistente.',
  ],
  ingles: [
    'Download the installer on the site PC',
    ' and open it.',
    'Your company server address (the wizard asks for it): ',
  ],
})
pantalla({
  nombre: 'alta · sin permiso',
  pintar: async (idioma) => {
    sesion.puede = false
    const C = await alta()
    return pintar(idioma, el(C))
  },
  espanol: ['Para agregar equipos necesitas permiso de edición en Inventario. Pídeselo a un administrador de tu empresa.'],
  ingles: [],
})

// ═══ La demostracion, sin respuesta y solicitudes ═══════════════════════════
const demo = async () => comp('DemoSpaceEyes', 'DemoSpaceEyes')
pantalla({
  nombre: 'demo · la demostracion',
  pintar: async (idioma) => pintar(idioma, el(await demo())),
  espanol: [
    'EJEMPLO',
    'Estás viendo una ',
    'demostración',
    ' con datos de ejemplo. Tu empresa todavía no tiene Space Eyes activado; ninguno de estos equipos es tuyo.',
    'Tus pantallas, vistas desde el sitio, sin ir al sitio',
    'Incidencias reportadas antes de que voltee a ver el sitio.',
    'Campaña programática comprobada en cuanto se reproduce.',
    'Solicitar activación',
    'Ilustración de un espectacular de ejemplo',
    'TU MARCA',
    'AQUÍ',
    'OFERTA',
    'DE TEMPORADA',
    'NUEVO',
    'LANZAMIENTO',
    'Así se ven tus equipos',
    'EN LÍNEA',
    'SIN COMUNICACIÓN',
    'hace 2 min',
    'hace 5 min',
    'hace 2 h',
    'Ciudad de ejemplo',
    'Móvil · buena',
    'WiFi · regular',
    'Móvil · —',
    'Sin comunicación desde hace 2 h. Así se ve cuando un equipo deja de reportar: nunca se da por funcionando solo por estar registrado.',
    'El detalle de un equipo',
    'Captura · 08:12 · con fecha, hora y nombre del sitio',
    'Varios gabinetes apagados · Gabinetes 4, 9 (2 de 15)',
    'Evidencia de una falla, marcada por el propio equipo',
    'Estado del equipo',
    'Conexión',
    'En línea · Móvil, señal buena',
    'Última comunicación',
    'Batería',
    '92 % · cargando',
    'Temperatura',
    'Datos este mes',
    'Vigilancia de la pantalla',
    'Encendida · 15 gabinetes',
    'Historial y alertas de un día',
    'Foto programada tomada',
    'Creativo nuevo detectado en la pantalla: se guardó su foto',
    'Falla: 2 gabinetes apagados (con foto de evidencia)',
    'Falla recuperada: el equipo vio la pantalla completa otra vez',
    'Foto pedida desde la oficina, recibida en 9 segundos',
    'Para qué le sirve a tu operación',
    'Prueba de exhibición',
    'Fotos con fecha, hora y ubicación de cada anuncio al aire, listas para enviar al cliente.',
    'Fallas antes que el cliente',
    'El equipo detecta gabinetes apagados o una pantalla congelada y avisa con la foto del problema.',
    'Menos visitas al sitio',
    'Foto o vista en vivo desde la oficina cuando la necesites, sin mandar a nadie.',
    'Qué estuvo al aire',
    'Cada creativo nuevo que aparece en la pantalla queda registrado con su foto.',
    '¿Lo quieres para tus pantallas?',
    'Al activarlo, esta sección se convierte en la de tus equipos reales. No hay que configurar nada de tu empresa.',
  ],
  ingles: [
    'EXAMPLE',
    'You are viewing a ',
    'demo',
    'Request activation',
    'YOUR BRAND',
    'Sample city',
    'Mobile · good',
    'WiFi · fair',
    'Proof of display',
    'Want it for your screens?',
  ],
})
pantalla({
  nombre: 'demo · solicitud enviada',
  pintar: async (idioma) => {
    const C = await demo()
    forzar(esFalse, false)
    forzar(esNull, 'ok')
    forzar(esNull, 'T-0012')
    return pintar(idioma, el(C))
  },
  espanol: [
    'Solicitud enviada',
    'Listo: recibimos tu solicitud (folio T-0012) y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte.',
  ],
  ingles: [
    'Request sent',
    'Done: we received your request (ticket T-0012) and will get in touch.',
  ],
})
pantalla({
  nombre: 'demo · error y sin permiso',
  pintar: async (idioma) => {
    const C = await demo()
    forzar(esFalse, false)
    forzar(esNull, 'error')
    const a = pintar(idioma, el(C))
    forzado.cola = []
    sesion.puede = false
    forzar(esFalse, false)
    forzar(esNull, 'ok')
    return a + pintar(idioma, el(C))
  },
  espanol: [
    'No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos.',
    'Para activarlo, pide a un administrador de tu empresa que lo solicite desde esta misma pantalla.',
    'Listo: recibimos tu solicitud y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte.',
  ],
  ingles: [],
})
pantalla({
  nombre: 'sin respuesta',
  pintar: async (idioma) => pintar(idioma, el(await comp('SinRespuesta', 'SinRespuesta'))),
  espanol: [
    'El servicio de cámaras no responde en este momento',
    'Tus equipos siguen trabajando en los sitios: lo que tomen mientras tanto aparecerá aquí en cuanto el servicio vuelva. Suele resolverse solo en unos minutos (por ejemplo, durante una actualización).',
    'Volver a intentar',
    'Si sigue así más de una hora, avisa a soporte desde Administración › Configuración › Soporte.',
  ],
  ingles: [
    'The camera service is not responding right now',
    'Try again',
  ],
})
pantalla({
  nombre: 'solicitudes de activacion · con y sin pendientes',
  pintar: async (idioma) => {
    const C = await comp('SolicitudesActivacion', 'SolicitudesActivacion')
    const s = { nombre: 'Acme', dominio: 'acme.space-os.io', folio: 'T-0012', creado_en: hace(60), total: 1, orden: 'activar acme' }
    forzar(esNull, [s, { ...s, nombre: 'Beta', folio: null, creado_en: null, orden: 'activar beta' }])
    forzar(esNull, 'activar acme')
    const a = pintar(idioma, el(C))
    forzado.cola = []
    forzar(esNull, [])
    return a + pintar(idioma, el(C))
  },
  espanol: [
    'Solicitudes de activación de Space Eyes',
    '2 pendiente(s)',
    ' · folio T-0012',
    'Copiada',
    'Copiar orden',
    'La orden se corre en el padre y pide la frase de paso de la llave de licencias. La empresa ve Space Eyes en unos 15 minutos. Después, cierra su ticket en el ',
    'panel de tickets',
    'Ninguna pendiente',
    'Cuando una empresa pida Space Eyes desde su demostración, aparece aquí con la orden para activarlo.',
  ],
  ingles: [
    'Space Eyes activation requests',
    '2 pending',
    ' · ticket T-0012',
    'Copy command',
    'ticket panel',
    'None pending',
  ],
})

// ─── Las pruebas ────────────────────────────────────────────────────────────
// Con `I18N_VOLCAR=<carpeta>`, el HTML espanol de cada estado a disco: es lo
// que se compara antes y despues de tocar los componentes (`diff -rq`).
const VOLCAR = process.env.I18N_VOLCAR
function volcar(nombre: string, html: string) {
  if (process.env.I18N_VOLCAR_EN && nombre.startsWith('en:')) {
    mkdirSync(process.env.I18N_VOLCAR_EN, { recursive: true })
    writeFileSync(join(process.env.I18N_VOLCAR_EN, `${nombre.replace(/[^\w]+/g, '_')}.html`), html)
    return
  }
  if (!VOLCAR) return
  mkdirSync(VOLCAR, { recursive: true })
  writeFileSync(join(VOLCAR, `${nombre.replace(/[^\w]+/g, '_')}.html`), html)
}

describe('lote SPACE EYES · en ESPANOL sale el texto de siempre', () => {
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

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito: datos
// o palabras que el glosario deja sin traducir.
const COMUNES = new Set<string>([
  'Reforma 222 · Cara A',
  'K-01',
  'Telcel ',
  'WiFi ',
  'hace 2 min', // ninguna — la quita el ingles; se deja por si
  'SSIM',
  'pHash',
  'Manual',
  'Normal',
  'Raspberry',
  'Raspberry Pi',
  'Zoom',
  'Total',
  'Ana',
  ' a ',
  '61.2 °C',
  '512 B',
  '2.0 KB',
  '3.0 MB',
  '2.00 GB',
  'Equipo 1',
  ' · ',
  'SpaceEyeAgente 1.3.0',
  'descargar la app 0.16.4',
  'ALERTA-17', // alerta que manda el servidor: dato
  ' / 4 GB',
  '77 min', // un valor guardado fuera de la lista: cifra y unidad
  'Red', // tambien es ingles: el deslizador del color («Red»)
  'Latitud', // esta dentro de «Latitude»
  'Longitud', // esta dentro de «Longitude»
  '— – —', // un periodo sin fechas
  'Activa', // esta dentro de «Activate»
  'OCR No', // «No» tambien es ingles
])

describe('lote SPACE EYES · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudoEn = await p.pintar('en')
      volcar(`en:${p.nombre}`, crudoEn)
      const html = texto(crudoEn)
      const quedan = p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))
      expect(quedan).toEqual([])
      const faltan = p.ingles.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

// Solo lo que se LEE: nodos de texto y los atributos visibles.
async function htmlIngles(): Promise<string> {
  let html = ''
  for (const p of PANTALLAS) {
    forzado.cola = []
    sesion.puede = true
    nav.params = { id: '7' }
    const crudo = await p.pintar('en')
    const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
    html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
  }
  return html
}

describe('lote SPACE EYES · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario del lote aparece en las pantallas en ingles', async () => {
    // La lista de arriba es a mano y se puede quedar corta. Esta usa el
    // diccionario: de cada texto espanol del lote se sacan los trozos fijos
    // (lo que hay entre huecos) y se buscan en el HTML ingles de TODAS las
    // pantallas. Un `t()` olvidado deja su frase espanola a la vista y cae aqui.
    const { ES_SPACEEYES, EN_SPACEEYES } = await import('./textos/spaceeyes')
    const html = await htmlIngles()
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    // Trozos espanoles que tambien son ingles (salen en otra frase inglesa).
    const IGUALES_EN_INGLES = new Set(['Raspberry.'])
    for (const [clave, es] of Object.entries(ES_SPACEEYES)) {
      const en = EN_SPACEEYES[clave as keyof typeof EN_SPACEEYES]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        // Trozos cortos («de», «a») chocan con texto ingles o con datos.
        if (t.length < 5 || en.includes(t) || IGUALES_EN_INGLES.has(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('tampoco queda ninguna de los modulos compartidos ni de las claves comunes', async () => {
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const html = await htmlIngles()
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    const comunes: Record<string, [string, string]> = {
      'comun.cancelar': ['Cancelar', 'Cancel'],
      'comun.guardar': ['Guardar', 'Save'],
      'comun.cerrar': ['Cerrar', 'Close'],
      'comun.cargando': ['Cargando…', 'Loading…'],
    }
    const pares: [string, string, string][] = [
      ...Object.entries(ES_COMPARTIDOS).map(([k, v]) => [k, v, EN_COMPARTIDOS[k as keyof typeof EN_COMPARTIDOS]] as [string, string, string]),
      ...Object.entries(comunes).map(([k, [e, i]]) => [k, e, i] as [string, string, string]),
    ]
    for (const [clave, es, en] of pares) {
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en.includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})
