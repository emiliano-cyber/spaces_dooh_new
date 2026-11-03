import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «ADMINISTRACION, CUENTA Y SHELL» — LA MITAD «CUENTA» Y «SHELL».
// ----------------------------------------------------------------------------
//  El mismo patron que `pantallas-comercial.test.ts`: se monta el componente
//  REAL dentro del proveedor, se rinde con `renderToStaticMarkup` y se mira el
//  texto en los dos sentidos:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda ninguna frase espanola y sale la inglesa.
//
//  Pantallas: codigos de recuperacion, restablecer / elegir la contrasena
//  (`/recuperar/[token]`), la bienvenida y su cuestionario, el portal del
//  cliente (`/portal/[token]`), la propuesta publica (`/p/[id]`), el 404, la
//  pagina de error global, el `_error` del Pages Router, la barra superior, el
//  candado de cambios, la campanita, la banda de la licencia, las novedades de
//  la version, el error de carga del shell, y las piezas compartidas que nadie
//  habia traducido (`ConfirmDialog`, `FotoUploaderMock`, `PipelineView`,
//  `ModuloPlaceholder`, `disponibilidadInventario`).
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//  Sin jsdom no hay clics ni efectos: lo que sale tras un clic o tras un
//  `fetch` se pinta arrancando el estado en ese valor. La cola se consume en
//  orden de render; un `forzar(esX, valorIgual)` es un «dejalo como esta» que
//  sirve para saltar un estado.
//
//  ─── EL ESPANOL IDENTICO ───────────────────────────────────────────────────
//  Con `I18N_VOLCAR=<carpeta>` se escribe el HTML ESPANOL de cada estado. Se
//  volco ANTES de tocar los componentes y DESPUES, y `diff -rq` salio vacio.
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
  usePathname: () => '/inicio',
}))

// El idioma de un Server Component sale de `idiomaDeLaPeticion()`: aqui entra
// por la cookie, como en el piloto.
const cabeceras = vi.hoisted(() => ({ cookie: null as string | null }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (n: string) => (n === 'spaces_idioma' && cabeceras.cookie ? { value: cabeceras.cookie } : undefined),
  }),
  headers: () => ({ get: () => null }),
}))

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'f-inter' }),
  Source_Serif_4: () => ({ variable: 'f-serif' }),
}))
vi.mock('@/lib/server/moneda-instancia', () => ({ monedaDeLaInstancia: async () => 'MXN' }))

// Los cuadros reales van por portales de Radix, que en el servidor no pintan.
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
// Los menus desplegables de la barra superior, abiertos y en linea.
vi.mock('@radix-ui/react-dropdown-menu', () => {
  const pasa = (p: { children?: unknown }) => createElement('div', null, p.children as never)
  return { Root: pasa, Trigger: pasa, Portal: pasa, Content: pasa, Item: pasa }
})
vi.mock('@/components/demo/MapView', () => ({ MapView: () => createElement('div', null, '[mapa]') }))

const datos = vi.hoisted(() => ({
  sesion: null as unknown,
  notificaciones: [] as unknown[],
  campanas: [] as unknown[],
  reservas: [] as unknown[],
  sitios: [] as unknown[],
  pipeline: undefined as unknown,
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({
  useSesionCtx: () => ({ sesion: datos.sesion, refrescar: async () => {} }),
  usePuede: () => true,
}))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useNotificaciones: () => datos.notificaciones,
    useCampanas: () => datos.campanas,
    useReservas: () => datos.reservas,
    useSitios: () => datos.sitios,
    useOrdenesTrabajo: () => [],
    useEvidencias: () => [],
    usePipeline: () => datos.pipeline,
  }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  cabeceras.cookie = null
  datos.sesion = { usuario: { id: 'u1', nombre: 'Ana López', rol: 'DUENO', cargo: null, email: 'ana@medios.mx' } }
  datos.notificaciones = []
  datos.campanas = []
  datos.reservas = []
  datos.sitios = []
  datos.pipeline = undefined
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })
const esFalse = (v: unknown) => v === false
const esTrue = (v: unknown) => v === true
const esNull = (v: unknown) => v === null
const esCero = (v: unknown) => v === 0
const esUndef = (v: unknown) => v === undefined
const es = (x: unknown) => (v: unknown) => v === x

type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
}

// ─── Datos de prueba ────────────────────────────────────────────────────────
const PIPELINE = {
  etapa: 'confirmada',
  index: 1,
  pasos: [
    { key: 'reservada', label: 'Reservada', fecha: '01/11', iso: '2026-11-01T12:00:00' },
    { key: 'confirmada', label: 'Confirmada', fecha: '02/11', iso: '2026-11-02T12:00:00' },
    { key: 'publicada', label: 'Publicada' },
  ],
}
const CAMPANA = {
  id: 'c1', nombre: 'Verano Refrescos', portalToken: 'tok', portalActivo: true,
  fechaInicio: '2026-11-01', fechaFin: '2026-11-30',
}
const SITIO = { id: 's1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL', alcaldia: 'Cuauhtémoc', ciudad: 'CDMX' }

const PUB = {
  orgNombre: 'Medios SA', orgLogoUrl: null, folio: 'P-0042', nombre: 'Propuesta Verano', estatus: 'ENVIADA',
  aceptadoEn: null, aceptadoPor: null, version: 1, clienteNombre: null, agenciaNombre: null,
  comisionPct: 15, descuentoPct: 5, descuentoMonto: 100, descuentoVolumenMonto: 50, descuentoVolumenPct: 2.5,
  codigoTexto: 'VERANO20', codigoDescuentoMonto: 40, codigoDescuentoPct: 20,
  paquete: { nombre: 'Combo', precio: 5000, admiteCodigo: true, aplicadoEn: null, composicion: null, sitios: [], aviso: 'aviso del servidor' },
  divisor: 0.85, bruto: 6000, base: 5000, neto: 4250, iva: 800, total: 5800, itemsAprobados: 2,
  vigenteHasta: '2026-12-01', vencida: false, condiciones: 'Net 30.',
  items: [
    { sitioNombre: 'Pantalla Reforma', alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estado: null, tipoMedio: 'PANTALLA_DIGITAL',
      lat: 19.4, lng: -99.1, direccion: 'Reforma 1', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 1000,
      aprobado: true, franjaId: 'f1', franjaNombre: 'Prime', franjaHorario: '06:00–10:00' },
    { sitioNombre: 'Muro', alcaldia: null, ciudad: null, estado: null, tipoMedio: null, lat: null, lng: null,
      direccion: null, fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 5000, aprobado: true },
  ],
}

const PANTALLAS: Pantalla[] = [
  // ─── SHELL ────────────────────────────────────────────────────────────────
  {
    nombre: 'shell · 404',
    pintar: async (idioma) => {
      cabeceras.cookie = idioma
      const { default: NotFound } = await import('../../app/not-found')
      return pintar(idioma, NotFound() as ReactElement)
    },
    espanol: [
      'Esta página no existe',
      'La dirección es incorrecta o el registro que buscas ya no está disponible.',
      'aria-label="Ir a otra sección"',
      'Ir a otra sección',
      'Volver al inicio',
      '>Inventario<',
      '>Administración<',
    ],
    ingles: [
      'This page doesn’t exist',
      'The address is wrong or the record you’re looking for is no longer available.',
      'Go to another section',
      'Back to home',
      '>Inventory<',
      '>Settings<',
    ],
  },
  {
    nombre: 'shell · error global (sin contexto de idioma)',
    pintar: async (idioma) => {
      // Fuera del proveedor: el idioma lo lee del <html> que ya estaba pintado.
      vi.stubGlobal('document', { documentElement: { lang: idioma } })
      const { default: ErrorGlobal } = await import('../../app/global-error')
      return renderToStaticMarkup(createElement(ErrorGlobal, { error: new Error('x'), reset: () => {} }))
    },
    espanol: [
      '<html lang="es">',
      'El sistema no está disponible en este momento',
      'No pudimos conectar con la base de datos. Tus datos no se han perdido: vuelve a',
      'Intentar de nuevo',
    ],
    ingles: [
      '<html lang="en">',
      'The system is not available right now',
      'We couldn’t connect to the database. Your data has not been lost: please try again in a few minutes.',
      'Try again',
    ],
  },
  {
    nombre: 'shell · _error del Pages Router (404 y 500)',
    pintar: async (idioma) => {
      const { default: Err } = await import('../../pages/_error')
      return (
        renderToStaticMarkup(createElement(Err, { statusCode: 404, idioma })) +
        renderToStaticMarkup(createElement(Err, { statusCode: 500, idioma }))
      )
    },
    espanol: ['Página no encontrada', 'Error del servidor', '← Volver al inicio'],
    ingles: ['Page not found', 'Server error', '← Back to home'],
  },
  {
    nombre: 'shell · barra superior con los menus abiertos y una notificacion',
    pintar: async (idioma) => {
      datos.notificaciones = [{ id: 'n1', titulo: 'Pago registrado', detalle: 'Detalle', nivel: 'ok', link: null, leida: false }]
      const { Topbar } = await import('../../components/demo/shell/Topbar')
      const { MenuMovilProvider } = await import('../../components/demo/shell/MenuMovilContext')
      return pintar(idioma, createElement(MenuMovilProvider, null, createElement(Topbar)))
    },
    espanol: [
      'aria-label="Abrir menú"',
      'Vista de ',
      '>Dueño<',
      'aria-label="Notificaciones"',
      '>Notificaciones<',
      'Borrar todas',
      'aria-label="Borrar la notificación Pago registrado"',
      'title="Borrar esta notificación"',
      'Configuración',
      'Códigos de recuperación',
      'Cerrar sesión',
    ],
    ingles: [
      'aria-label="Open menu"',
      'Viewing as ',
      '>Owner<',
      'aria-label="Notifications"',
      'Clear all',
      'aria-label="Delete the notification Pago registrado"',
      'title="Delete this notification"',
      'Account settings',
      'Recovery codes',
      'Sign out',
    ],
  },
  {
    nombre: 'shell · barra superior sin sesion ni notificaciones',
    pintar: async (idioma) => {
      datos.sesion = null
      const { Topbar } = await import('../../components/demo/shell/Topbar')
      const { MenuMovilProvider } = await import('../../components/demo/shell/MenuMovilContext')
      return pintar(idioma, createElement(MenuMovilProvider, null, createElement(Topbar)))
    },
    espanol: ['Sin notificaciones', '>Cuenta<'],
    ingles: ['No notifications', '>Account<'],
  },
  {
    nombre: 'shell · candado de cambios bloqueado, con el cuadro abierto',
    pintar: async (idioma) => {
      forzar(esFalse, true) // requiere
      forzar(esNull, null) // hasta
      forzar(esFalse, true) // open
      const { DesbloqueoCambios } = await import('../../components/demo/shell/DesbloqueoCambios')
      return pintar(idioma, createElement(DesbloqueoCambios))
    },
    espanol: [
      'title="Los cambios de dinero y catálogo necesitan una contraseña"',
      'Cambios bloqueados',
      'Desbloquear cambios',
      'Tu contraseña, o la del control de cambios',
      'Los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos,',
      'tu propia contraseña de',
      'Contraseña',
      'Cancelar',
      'Desbloquear',
    ],
    ingles: [
      'title="Changes to money and the catalog need a password"',
      'Changes locked',
      'Unlock changes',
      'Your password, or the change-control password',
      'Changes that move money or the catalog (rates, rents, contracts, payments, invoicing and deletions) need a password.',
      'your own sign-in password',
      'Password',
      'Cancel',
      'Unlock',
    ],
  },
  {
    nombre: 'shell · candado de cambios desbloqueado',
    pintar: async (idioma) => {
      forzar(esFalse, true) // requiere
      forzar(esNull, '2026-11-02T12:15:00Z') // hasta: 15 min
      const { DesbloqueoCambios } = await import('../../components/demo/shell/DesbloqueoCambios')
      return pintar(idioma, createElement(DesbloqueoCambios))
    },
    espanol: ['title="Cambios desbloqueados 15 min más · clic para bloquear"', 'Desbloqueado 15 min'],
    ingles: ['title="Changes unlocked for 15 more min · click to lock"', 'Unlocked for 15 min'],
  },
  {
    nombre: 'shell · banda de la licencia (aviso y gracia)',
    pintar: async (idioma) => {
      const { BandaLicencia } = await import('../../components/demo/shell/BandaLicencia')
      return (
        pintar(idioma, createElement(BandaLicencia, { aviso: { tono: 'aviso', vence: '2026-12-01', finGracia: '2026-12-15' }, idioma })) +
        pintar(idioma, createElement(BandaLicencia, { aviso: { tono: 'gracia', vence: '2026-12-01', finGracia: '2026-12-15' }, idioma }))
      )
    },
    espanol: [
      'Tu licencia de SPACE OS vence el 2026-12-01.',
      'Tu licencia de SPACE OS venció el 2026-12-01. El sistema dejará de funcionar el',
      'Para renovarla, contacta con tu proveedor.',
    ],
    ingles: [
      'Your SPACE OS license expires on 2026-12-01.',
      'Your SPACE OS license expired on 2026-12-01. The system will stop working on 2026-12-15.',
      'To renew it, contact your provider.',
    ],
  },
  {
    nombre: 'shell · novedades de la version',
    pintar: async (idioma) => {
      forzar(esNull, { version: 'v0.12.6', fecha: '2026-11-02', items: [] }) // notas
      forzar(esFalse, true) // abierto
      const { NovedadesDeVersion } = await import('../../components/demo/shell/NovedadesDeVersion')
      return pintar(idioma, createElement(NovedadesDeVersion))
    },
    espanol: [
      'Qué hay de nuevo en v0.12.6',
      'Esta instancia se actualizó. Esto es lo que cambió (2026-11-02).',
      'Ver todas las novedades',
      'Entendido',
    ],
    ingles: [
      'What’s new in v0.12.6',
      'This instance was updated. Here’s what changed (2026-11-02).',
      'See all release notes',
      'Got it',
    ],
  },
  {
    nombre: 'shell · error al cargar los datos',
    pintar: async (idioma) => {
      const { ErrorDeCarga } = await import('../../components/demo/shell/AuthGate')
      forzar(esFalse, false)
      const a = pintar(idioma, createElement(ErrorDeCarga))
      forzar(esFalse, true) // reintentando
      return a + pintar(idioma, createElement(ErrorDeCarga))
    },
    espanol: [
      'No se pudieron cargar los datos',
      'La información no llegó del servidor. No es que no existan datos: no se pudieron leer.',
      '>Reintentar<',
      'Reintentando…',
    ],
    ingles: [
      'The data could not be loaded',
      'The information didn’t arrive from the server. It’s not that there is no data: it couldn’t be read.',
      '>Retry<',
      'Retrying…',
    ],
  },
  {
    nombre: 'shell · modulo en construccion',
    pintar: async (idioma) => {
      const { ModuloPlaceholder } = await import('../../components/demo/shell/ModuloPlaceholder')
      const { Box } = await import('lucide-react')
      return pintar(idioma, createElement(ModuloPlaceholder, { titulo: 'T', subtitulo: 'S', icon: Box, fase: 'F9' }))
    },
    espanol: [
      'Módulo en construcción (F9)',
      'Los cimientos y la capa de datos ya están listos; esta pantalla se arma en la fase indicada.',
    ],
    ingles: ['Module under construction (F9)', 'The foundations and the data layer are ready; this screen is built in the phase shown.'],
  },
  {
    nombre: 'compartido · ConfirmDialog con sus rotulos por omision y escribir para confirmar',
    pintar: async (idioma) => {
      const { ConfirmDialog } = await import('../../components/demo/ui/ConfirmDialog')
      const base = { open: true, onOpenChange: () => {}, title: 'T', children: 'C', onConfirm: () => {} }
      return (
        pintar(idioma, createElement(ConfirmDialog, { ...base, confirmarEscribiendo: 'BORRAR' })) +
        pintar(idioma, createElement(ConfirmDialog, { ...base, busy: true }))
      )
    },
    espanol: ['>Cancelar<', '>Confirmar<', 'Escribe ', ' para confirmar', 'Procesando…'],
    ingles: ['>Cancel<', '>Confirm<', 'Type ', ' to confirm', 'Processing…'],
  },
  {
    nombre: 'compartido · FotoUploaderMock con una foto y cargando dos',
    pintar: async (idioma) => {
      const { FotoUploaderMock } = await import('../../components/demo/FotoUploaderMock')
      const fotos = [{ url: 'data:x', tomadaEn: '2026-11-01T10:00:00Z', subidaEn: '2026-11-01T11:00:00Z' }]
      const a = pintar(idioma, createElement(FotoUploaderMock, { fotos, onChange: () => {} }))
      forzar(esCero, 2) // procesando
      const b = pintar(idioma, createElement(FotoUploaderMock, { fotos: [], onChange: () => {} }))
      forzar(esCero, 1)
      return a + b + pintar(idioma, createElement(FotoUploaderMock, { fotos: [], onChange: () => {} }))
    },
    espanol: ['alt="evidencia"', 'aria-label="Quitar foto"', 'Agregar foto', 'Cargando 2 fotos…', 'Cargando foto…'],
    ingles: ['alt="evidence"', 'aria-label="Remove photo"', 'Add photo', 'Loading 2 photos…', 'Loading photo…'],
  },
  {
    nombre: 'compartido · PipelineView',
    pintar: async (idioma) => {
      datos.pipeline = PIPELINE
      const { PipelineView } = await import('../../components/demo/campanas/PipelineView')
      return pintar(idioma, createElement(PipelineView, { campanaId: 'c1' }))
    },
    // Ola 5: la fecha de cada paso salia «03/11» (dd/mm) tambien en ingles,
    // donde se lee 11 de marzo. En ingles va «Nov 1»; en español, la de siempre.
    espanol: ['>Reservada<', '>Confirmada<', '>Publicada<', '>01/11<', '>02/11<'],
    ingles: ['>Booked<', '>Confirmed<', '>Nov 1<', '>Nov 2<'],
  },

  // ─── CUENTA ───────────────────────────────────────────────────────────────
  {
    nombre: 'cuenta · codigos de recuperacion, antes de mostrarlos',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/codigos-recuperacion/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Guarda tus códigos de recuperación',
      'Tu forma de volver a entrar si algún día pierdes el acceso a tu cuenta.',
      'Entras con Google, así que ',
      'no tienes contraseña',
      'Cada uno sirve ',
      'una sola vez',
      'Mostrar mis códigos',
    ],
    ingles: [
      'Save your recovery codes',
      'Your way back in if you ever lose access to your account.',
      'You sign in with Google, so ',
      'you have no password',
      'Each one works ',
      'only once',
      'Show my codes',
    ],
  },
  {
    nombre: 'cuenta · codigos de recuperacion, mostrados',
    pintar: async (idioma) => {
      forzar(esNull, ['AAAA-1111', 'BBBB-2222']) // codigos
      const { default: Pagina } = await import('../../app/(app)/(shell)/codigos-recuperacion/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Se muestran una sola vez.',
      'Cópialos o imprímelos antes de',
      'Tus 2 códigos',
      'Copiar',
      'Ya los guardé en un lugar seguro',
      'Continuar',
    ],
    ingles: [
      'They are shown only once.',
      'Copy or print them before you continue: once you leave this screen they won’t be shown again.',
      'Your 2 codes',
      'Copy',
      'I’ve saved them somewhere safe',
      'Continue',
    ],
  },
  {
    nombre: 'cuenta · codigos de recuperacion, ya guardados',
    pintar: async (idioma) => {
      forzar(esNull, null) // codigos
      forzar(esFalse, false) // guardados
      forzar(esFalse, false) // ocupado
      forzar(esFalse, true) // yaTenia
      const { default: Pagina } = await import('../../app/(app)/(shell)/codigos-recuperacion/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      '>Códigos de recuperación<',
      'Ya tienes tus códigos guardados. Si los perdiste, puedes generar otros: los',
      'Generar códigos nuevos',
      'Volver',
    ],
    ingles: [
      '>Recovery codes<',
      'You already have your codes saved. If you lost them, you can generate new ones: the old ones will stop working.',
      'Generate new codes',
      'Back',
    ],
  },
  {
    nombre: 'cuenta · codigos de recuperacion, pidiendo la contrasena',
    pintar: async (idioma) => {
      forzar(esNull, null)
      forzar(esFalse, false)
      forzar(esFalse, false)
      forzar(esFalse, true) // yaTenia
      forzar(esFalse, true) // pidePassword
      const { default: Pagina } = await import('../../app/(app)/(shell)/codigos-recuperacion/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Teclea tu contraseña para confirmar. Los códigos que tengas guardados',
      ' dejarán de funcionar',
      'en cuanto se generen los nuevos.',
      'Tu contraseña',
      'placeholder="Tu contraseña"',
      'Confirmar y generar',
      'Cancelar',
    ],
    ingles: [
      'Enter your password to confirm. Any codes you have saved',
      ' will stop working',
      'as soon as the new ones are generated.',
      'Your password',
      'placeholder="Your password"',
      'Confirm and generate',
      'Cancel',
    ],
  },
  {
    nombre: 'cuenta · recuperar, verificando el enlace',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/recuperar/[token]/page')
      return pintar(idioma, createElement(Pagina, { params: { token: 't' } }))
    },
    espanol: ['Restablecer contraseña', 'Verificando el enlace…'],
    ingles: ['Reset password', 'Checking the link…'],
  },
  {
    nombre: 'cuenta · recuperar, enlace invalido (restablecer y bienvenida)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/recuperar/[token]/page')
      forzar(es('validando'), 'invalido')
      const a = pintar(idioma, createElement(Pagina, { params: { token: 't' } }))
      forzar(es('validando'), 'invalido')
      return a + pintar(idioma, createElement(Pagina, { params: { token: 't' }, searchParams: { bienvenida: '1' } }))
    },
    espanol: [
      'Enlace inválido o expirado',
      'El enlace ya se usó o venció. Solicita uno nuevo desde el login.',
      'La invitación ya se usó o venció. Pide a quien te dio de alta que te envíe otra.',
      'Ir a iniciar sesión',
      '>Bienvenida<',
    ],
    ingles: [
      'Invalid or expired link',
      'The link was already used or has expired. Request a new one from the sign-in page.',
      'The invitation was already used or has expired. Ask whoever added you to send you another one.',
      'Go to sign in',
      '>Welcome<',
    ],
  },
  {
    nombre: 'cuenta · recuperar, contrasena guardada (restablecer y bienvenida)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/recuperar/[token]/page')
      forzar(es('validando'), 'listo')
      const a = pintar(idioma, createElement(Pagina, { params: { token: 't' } }))
      forzar(es('validando'), 'listo')
      return a + pintar(idioma, createElement(Pagina, { params: { token: 't' }, searchParams: { bienvenida: '1' } }))
    },
    espanol: [
      'Contraseña actualizada',
      'Ya puedes iniciar sesión con tu nueva contraseña.',
      'Contraseña creada',
      'Ya puedes iniciar sesión con tu contraseña.',
      '>Iniciar sesión<',
    ],
    ingles: [
      'Password updated',
      'You can now sign in with your new password.',
      'Password created',
      'You can now sign in with your password.',
      '>Sign in<',
    ],
  },
  {
    nombre: 'cuenta · recuperar, el formulario (restablecer y bienvenida)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/recuperar/[token]/page')
      forzar(es('validando'), 'valido')
      const a = pintar(idioma, createElement(Pagina, { params: { token: 't' } }))
      forzar(es('validando'), 'valido')
      return a + pintar(idioma, createElement(Pagina, { params: { token: 't' }, searchParams: { bienvenida: '1' } }))
    },
    espanol: [
      'Elige una nueva contraseña',
      'Mínimo 8 caracteres, con al menos una letra y un número.',
      'Nueva contraseña',
      'Confirmar contraseña',
      'Restablecer contraseña',
      'Elige tu contraseña',
      'Guardar contraseña',
    ],
    ingles: [
      'Choose a new password',
      'At least 8 characters, with at least one letter and one number.',
      'New password',
      'Confirm password',
      'Reset password',
      'Choose your password',
      'Save password',
    ],
  },
  {
    nombre: 'cuenta · bienvenida, cargando',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Antes de empezar',
      'Tres preguntas sobre las razones sociales de tu empresa. Con ellas el sistema sabe a',
      'Cargando…',
    ],
    ingles: [
      'Before you start',
      'Three questions about your company’s legal entities. With them the system knows who pays each rent and who issues invoices.',
      'Loading…',
    ],
  },
  {
    nombre: 'cuenta · bienvenida, ya contestada (dos y una razon social) y con error',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      forzar(esNull, {
        pendiente: false, totalEntidades: 2, roles: [],
        entidades: [
          { id: 'e1', razonSocial: 'Medios SA', roles: ['OPERACION'], activo: true },
          { id: 'e2', razonSocial: 'Ventas SA', roles: [], activo: false },
        ],
      })
      const a = pintar(idioma, createElement(Pagina))
      forzar(esNull, { pendiente: false, totalEntidades: 1, roles: [], entidades: [] })
      const b = pintar(idioma, createElement(Pagina))
      forzar(esNull, null) // estado
      forzar(esNull, 'falla del servidor') // error
      return a + b + pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Tu empresa ya tiene',
      '2 razones sociales registradas',
      'una razón social registrada',
      ', así que este cuestionario ya se contestó.',
      'sin roles',
      ' (dada de baja)',
      'Para cambiarlas, añadir otra o dar una de baja, ve a',
      'Ir a Razones sociales',
      'Ir al inicio',
    ],
    ingles: [
      'Your company already has 2 legal entities registered, so this questionnaire has already been answered.',
      'Your company already has one legal entity registered, so this questionnaire has already been answered.',
      'no roles',
      ' (deactivated)',
      'To change them, add another one or deactivate one, go to',
      'Go to Legal entities',
      'Go to the home page',
    ],
  },
  {
    nombre: 'cuenta · bienvenida, el cuestionario con una sola razon social',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      forzar(esNull, { pendiente: true, totalEntidades: 0, roles: [{ rol: 'OPERACION', etiqueta: 'Operación' }], entidades: [] })
      forzar(esNull, null) // error
      forzar(esNull, false) // varias
      forzar(esNull, null) // juntas
      forzar(es(''), 'Medios SA') // unica
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      '¿Tu empresa tiene varias razones sociales?',
      'Casi todas las empresas de medios reparten su operación entre varias. Si tienes una sola, con esto te ahorras el resto.',
      '>Sí<',
      '>No<',
      'Indica tu razón social',
      'Se le asignarán todos los roles. Después puedes separarlos en Razones sociales.',
      'Razón social',
      'Se crearán 1 razón social:',
      'Guardar y continuar',
      'Lo hago más tarde',
    ],
    ingles: [
      'Does your company have several legal entities?',
      'Most media companies split their operations across several. If you have only one, this saves you the rest.',
      '>Yes<',
      'Enter your legal entity',
      'It will be given every role. You can split them later in Legal entities.',
      'Legal name',
      '1 legal entity will be created:',
      'Save and continue',
      'I’ll do it later',
    ],
  },
  {
    nombre: 'cuenta · bienvenida, el cuestionario con varias razones sociales',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      forzar(esNull, {
        pendiente: true, totalEntidades: 0, entidades: [],
        roles: [{ rol: 'OPERACION', etiqueta: 'Operación' }, { rol: 'VENTAS', etiqueta: 'Ventas' }],
      })
      forzar(esNull, null) // error
      forzar(esNull, true) // varias
      forzar(esNull, false) // juntas
      forzar(es(''), '') // unica
      forzar((v) => typeof v === 'object' && v !== null && Object.keys(v).length === 0, { OPERACION: 'Uno SA', VENTAS: 'Dos SA' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      '¿La operación está en la misma razón social que comercializa o factura las ventas?',
      'Suelen coincidir, y por eso se pregunta: si es tu caso, el paso siguiente te pide un dato menos.',
      'Indica las razones sociales para cada rol dentro de tu empresa',
      'Una misma razón social puede llevar varios roles: escribe el mismo nombre y se agrupan en una sola. Lo que no sepas todavía, déjalo en blanco.',
      'placeholder="Razón social"',
      'Se crearán 2 razones sociales:',
    ],
    ingles: [
      'Do operations run under the same legal entity that sells or invoices?',
      'They usually match, which is why we ask: if that’s your case, the next step asks you for one thing less.',
      'Enter the legal entity for each role within your company',
      'One legal entity can hold several roles: type the same name and they are grouped into one. Leave blank whatever you don’t know yet.',
      'placeholder="Legal name"',
      '2 legal entities will be created:',
    ],
  },
  {
    nombre: 'cuenta · portal del cliente',
    pintar: async (idioma) => {
      datos.campanas = [CAMPANA]
      datos.reservas = [{ campanaId: 'c1', sitioId: 's1' }]
      datos.sitios = [SITIO]
      datos.pipeline = PIPELINE
      forzar(esTrue, false) // cargando
      forzar(esNull, { orgNombre: 'Medios SA', orgLogoUrl: null }) // org
      const { default: Portal } = await import('../../app/(app)/portal/[token]/page')
      return pintar(idioma, createElement(Portal, { params: { token: 'tok' } }))
    },
    espanol: [
      'Portal del cliente',
      'Seguimiento de campaña',
      '01/11/2026 – 30/11/2026',
      'Avance de tu campaña',
      'Ubicaciones',
      'Pantalla digital · Cuauhtémoc, CDMX',
      'Evidencias de instalación',
      'Medios SA · portal de seguimiento',
      // La etapa actual junto a las fechas (validacion, hallazgo 1): sale de
      // `usePipeline` en espanol y en ingles va por `CLAVE_ETAPA`.
      '<span class="h-1.5 w-1.5 rounded-full bg-accent"></span>Confirmada',
    ],
    ingles: [
      '<span class="h-1.5 w-1.5 rounded-full bg-accent"></span>Confirmed',
      'Client portal',
      'Campaign tracking',
      'Nov 1, 2026 – Nov 30, 2026',
      'Your campaign’s progress',
      'Locations',
      'Installation evidence',
      'Medios SA · tracking portal',
    ],
  },
  {
    nombre: 'cuenta · portal del cliente, enlace que no corresponde',
    pintar: async (idioma) => {
      forzar(esTrue, false)
      const { default: Portal } = await import('../../app/(app)/portal/[token]/page')
      return pintar(idioma, createElement(Portal, { params: { token: 'otro' } }))
    },
    espanol: ['Enlace no válido', 'Este enlace de portal no corresponde a ninguna campaña activa.'],
    ingles: ['Invalid link', 'This portal link doesn’t match any active campaign.'],
  },
  {
    nombre: 'cuenta · propuesta publica, pendiente de aceptar',
    pintar: async (idioma) => {
      forzar(esUndef, PUB)
      const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
      return pintar(idioma, createElement(Pagina, { params: { id: 'p1' } }))
    },
    espanol: [
      'Propuesta comercial',
      'Pendiente de tu aprobación',
      ' · ',
      'válida hasta el 01/12/2026',
      'Fechas',
      'Anunciante',
      'Sin cliente',
      'Agencia',
      'Directa',
      'Comisión',
      'Resumen económico',
      'Total c/IVA',
      'IVA 16%',
      'Sitios',
      'Sitios de la propuesta',
      'Ubicación no capturada',
      'Ubicación de las pantallas',
      '1 de 2 pantallas no tienen',
      'coordenadas registradas; su dirección está en la lista de sitios.',
      'Bruto (tarifa de lista)',
      'Paquete "Combo" — precio del conjunto',
      'Descuento por volumen (2.5%)',
      'Descuento (5%)',
      'Código VERANO20 (20%)',
      'Comisión de agencia (15%)',
      'Neto',
      'Total que paga el cliente',
      'Términos y condiciones',
      '¿Aceptas esta propuesta?',
      'Al aceptar confirmas las 2 pantallas y el',
      'Queda registrada tu aceptación con fecha y hora.',
      'placeholder="Tu nombre y cargo"',
      'Aceptar propuesta',
      'Spaces · propuesta comercial',
      // Ola 5: el tipo de medio va como codigo en español (asi era); en ingles salia «PANTALLA_DIGITAL».
      ' · PANTALLA_DIGITAL',
    ],
    ingles: [
      'Sales proposal',
      'Awaiting your approval',
      'valid until Dec 1, 2026',
      'Dates',
      'Advertiser',
      'No client',
      'Agency',
      'Direct',
      'Commission',
      'Financial summary',
      'Total incl. VAT',
      'VAT 16%',
      'Sites',
      'Sites in the proposal',
      'Location not entered',
      'Screen locations',
      'Screens without coordinates: 1 of 2. Their addresses are in the list of sites.',
      'Gross (list rate)',
      'Volume discount (2.5%)',
      'Discount (5%)',
      'Agency commission (15%)',
      'Net',
      'Total the client pays',
      'Terms and conditions',
      'Do you accept this proposal?',
      'By accepting you confirm the 2 screens and the total of MX$',
      'Your acceptance is recorded with the date and time.',
      'placeholder="Your name and title"',
      'Accept proposal',
      'Spaces · sales proposal',
      ' · Digital screen',
    ],
  },
  {
    nombre: 'cuenta · propuesta publica, aceptada',
    pintar: async (idioma) => {
      forzar(esUndef, { ...PUB, aceptadoEn: '2026-11-02T10:00:00Z', aceptadoPor: 'Ana López', items: [PUB.items[0]] })
      const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
      return pintar(idioma, createElement(Pagina, { params: { id: 'p1' } }))
    },
    espanol: ['</svg> Aceptada<', 'Propuesta aceptada', 'Aceptada por Ana López el', 'El equipo comercial fue notificado.'],
    ingles: ['</svg> Accepted<', 'Proposal accepted', 'Accepted by Ana López on', 'The sales team was notified.'],
  },
  {
    nombre: 'cuenta · propuesta publica, vencida y de solo lectura',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
      forzar(esUndef, { ...PUB, vencida: true, paquete: null, items: [{ ...PUB.items[0], lat: null, lng: null }] })
      const a = pintar(idioma, createElement(Pagina, { params: { id: 'p1' } }))
      forzar(esUndef, { ...PUB, estatus: 'BORRADOR', paquete: null, items: [] })
      return a + pintar(idioma, createElement(Pagina, { params: { id: 'p1' } }))
    },
    espanol: [
      'Propuesta vencida',
      'venció el 01/12/2026',
      'Esta propuesta venció el 01/12/2026 y ya no se puede aceptar desde',
      'Las pantallas de esta propuesta aún no tienen coordenadas registradas. Consulta la',
      'Solo lectura',
      'Esta propuesta no tiene sitios.',
      ' · este enlace es de solo lectura',
    ],
    ingles: [
      'Proposal expired',
      'expired on Dec 1, 2026',
      'This proposal expired on Dec 1, 2026 and can no longer be accepted here. Ask whoever sent it to you for an updated one.',
      'The screens in this proposal don’t have coordinates entered yet. Check the address of each one in the list of sites.',
      'Read only',
      'This proposal has no sites.',
      ' · this link is read-only',
    ],
  },
  {
    nombre: 'cuenta · propuesta publica, enlace que no corresponde',
    pintar: async (idioma) => {
      forzar(esUndef, null)
      const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
      return pintar(idioma, createElement(Pagina, { params: { id: 'p1' } }))
    },
    espanol: ['Enlace no válido', 'Esta liga no corresponde a ninguna propuesta.'],
    ingles: ['Invalid link', 'This link doesn’t match any proposal.'],
  },
  {
    // Ola 5 (recorrido en navegador): el boton que cierra el menu lateral en el
    // movil tenia el aria-label «Cerrar menú» escrito a mano, aunque la clave
    // `shell.topbar.cerrar-menu` ya existia para la barra superior.
    nombre: 'shell · menu lateral (el panel del movil)',
    pintar: async (idioma) => {
      const { Sidebar } = await import('../../components/demo/shell/Sidebar')
      const { MenuMovilProvider } = await import('../../components/demo/shell/MenuMovilContext')
      return pintar(idioma, createElement(MenuMovilProvider, null, createElement(Sidebar)))
    },
    espanol: ['aria-label="Cerrar menú"'],
    ingles: ['aria-label="Close menu"'],
  },
  // ── Ola 6 · se AÑADEN al final: el volcado numera los estados por posicion ──
  {
    // Los cinco papeles fijos en la bienvenida: las etiquetas de cada campo
    // (y la del campo que junta operacion y ventas) y los CODIGOS del plan.
    nombre: 'cuenta · bienvenida, el cuestionario con los cinco papeles (ola 6)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      forzar(esNull, { pendiente: true, totalEntidades: 0, entidades: [], roles: PAPELES })
      forzar(esNull, null) // error
      forzar(esNull, true) // varias
      forzar(esNull, true) // juntas
      forzar(es(''), '') // unica
      forzar((v) => typeof v === 'object' && v !== null && Object.keys(v).length === 0, {
        ARRENDAMIENTOS: 'Rentas SA', ACTIVOS: 'Activos SA', LICENCIAS: 'Rentas SA', 'OPERACION+VENTAS': 'Medios SA',
      })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Paga las rentas a los arrendadores', 'Compra los activos y el equipo', 'Tramites y licencias con gobierno',
      'Operacion y nomina · Vende publicidad', ' — ARRENDAMIENTOS, LICENCIAS', ' — ACTIVOS', ' — OPERACION, VENTAS',
    ],
    ingles: [
      'Pays rent to landlords', 'Buys assets and equipment', 'Government permits and licenses',
      'Operations and payroll · Sells advertising', ' — RENT, PERMITS', ' — ASSETS', ' — OPERATIONS, SALES',
    ],
  },
  {
    nombre: 'cuenta · bienvenida, ya contestada con papeles (ola 6)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/bienvenida/page')
      forzar(esNull, {
        pendiente: false, totalEntidades: 1, roles: PAPELES,
        entidades: [{ id: 'e1', razonSocial: 'Medios SA', roles: ['ACTIVOS', 'VENTAS'], activo: true }],
      })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['— ACTIVOS, VENTAS'],
    ingles: ['— ASSETS, SALES'],
  },
]

// Ola 6 · el catalogo de partida de `catalogo_roles_entidad`, tal cual.
const PAPELES = [
  { rol: 'ARRENDAMIENTOS', etiqueta: 'Paga las rentas a los arrendadores' },
  { rol: 'ACTIVOS', etiqueta: 'Compra los activos y el equipo' },
  { rol: 'LICENCIAS', etiqueta: 'Tramites y licencias con gobierno' },
  { rol: 'OPERACION', etiqueta: 'Operacion y nomina' },
  { rol: 'VENTAS', etiqueta: 'Vende publicidad' },
]

function volcar(i: number, html: string) {
  const dir = process.env.I18N_VOLCAR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), html)
}

// Datos o palabras iguales en los dos idiomas: no cuentan como «espanol que
// quedo».
const COMUNES = new Set<string>([' · ', '>No<', 'Agencia', 'Comisión', 'Sitios', 'Neto', 'Contraseña', 'Desbloquear', 'Volver'])

describe('lote CUENTA Y SHELL · en ESPANOL sale el texto de siempre', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      volcar(i, crudo)
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

describe('lote CUENTA Y SHELL · en INGLES no queda ninguna frase espanola', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote CUENTA Y SHELL · barrido con los diccionarios enteros', () => {
  async function todoIngles(): Promise<string> {
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      cabeceras.cookie = null
      datos.sesion = { usuario: { id: 'u1', nombre: 'Ana López', rol: 'DUENO', cargo: null, email: 'ana@medios.mx' } }
      datos.notificaciones = []
      datos.campanas = []
      datos.pipeline = undefined
      const crudo = await p.pintar('en')
      vi.unstubAllGlobals()
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    return html
  }

  it('ninguna frase espanola de `textos/cuenta.ts` ni de `textos/shell.ts` aparece en ingles', async () => {
    const { ES_CUENTA, EN_CUENTA } = await import('./textos/cuenta')
    const { ES_SHELL, EN_SHELL } = await import('./textos/shell')
    const ES: Record<string, string> = { ...ES_CUENTA, ...ES_SHELL }
    const EN: Record<string, string> = { ...EN_CUENTA, ...EN_SHELL }
    const html = await todoIngles()
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES)) {
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 8 || EN[clave].includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ninguna frase espanola de `textos/compartidos.ts` aparece en ingles', async () => {
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const html = await todoIngles()
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

describe('lote CUENTA Y SHELL · funciones y metadatos que no se rinden', () => {
  it('`disponibilidadInventario` dice lo de siempre en espanol y lo traduce en ingles', async () => {
    const { disponibilidadInventario } = await import('../../components/demo/StatusBadge')
    const dig = { tipoMedio: 'PANTALLA_DIGITAL', estatusComercial: 'DISPONIBLE' as const }
    const casos = [
      { ...dig, totalSpots: null, spotsDisponibles: null },
      { ...dig, totalSpots: 8, spotsDisponibles: 0 },
      { ...dig, totalSpots: 8, spotsDisponibles: 3 },
      { tipoMedio: 'ESPECTACULAR', estatusComercial: 'OCUPADO' as const },
      { tipoMedio: 'ESPECTACULAR', estatusComercial: 'DISPONIBLE' as const },
      { tipoMedio: 'ESPECTACULAR', estatusComercial: 'EN_MANTENIMIENTO' as const },
    ]
    expect(casos.map((c) => disponibilidadInventario(c).texto)).toEqual([
      'Sin slots capturados', 'Sin slots libres', '3 de 8 libres', 'Ocupado', 'Disponible', 'En mantenimiento',
    ])
    expect(casos.map((c) => disponibilidadInventario(c, 'en').texto)).toEqual([
      'No slots entered', 'No free slots', '3 of 8 free', 'Occupied', 'Available', 'Under maintenance',
    ])
  })

  it('la descripcion de la pagina (layouts) sale en el idioma de la peticion', async () => {
    const raiz = await import('../../app/layout')
    const app = await import('../../app/(app)/layout')
    cabeceras.cookie = null
    expect(raiz.generateMetadata().description).toBe('Gestión de espacios publicitarios DOOH')
    expect(app.generateMetadata().description).toBe('Gestión de espacios publicitarios DOOH')
    cabeceras.cookie = 'en'
    expect(raiz.generateMetadata().description).toBe('DOOH advertising space management')
    expect(app.generateMetadata().description).toBe('DOOH advertising space management')
  })

  it('el `_error` decide el idioma con la peticion (cookie), y sin peticion es espanol', async () => {
    const { default: Err } = await import('../../pages/_error')
    const gip = Err.getInitialProps as (c: unknown) => { statusCode: number; idioma: Idioma }
    expect(gip({ res: { statusCode: 404 }, req: { headers: { cookie: 'spaces_idioma=en' } } }).idioma).toBe('en')
    expect(gip({ res: { statusCode: 500 }, req: { headers: {} } }).idioma).toBe('es')
    expect(gip({ err: { statusCode: 500 } }).idioma).toBe('es')
  })
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote CUENTA Y SHELL · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})
