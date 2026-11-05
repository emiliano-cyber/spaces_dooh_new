import { describe, it, expect, vi, beforeEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { huellasEnItaliano } from './guardias-italiano'
import { culpablesEnItaliano } from '../test/barrido-italiano'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «ADMINISTRACION» (ambito `admin`), RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Mismo patron que `pantallas-comercial.test.ts`: el componente REAL dentro
//  del proveedor, `renderToStaticMarkup`, y dos comprobaciones por estado:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda ninguna frase espanola de la lista y sale la
//        inglesa.
//
//  Pantallas: Administracion (usuarios, roles y permisos, configuracion,
//  organizaciones, actualizaciones, soporte), Configuracion (Mi cuenta /
//  Empresa), Integraciones, Network, Novedades, Actividad y Razones sociales.
//
//  ─── POR QUE SE FUERZA `useState`, Y POR QUE POR COMPONENTE ───────────────
//  `renderToStaticMarkup` no corre efectos: lo que llega por `fetch` en un
//  `useEffect` (la lista de usuarios, la config, los tickets…) y lo que abre un
//  clic no se pintaria nunca. Se fuerza el valor INICIAL de `useState`. Aqui
//  no vale la cola en orden de render de los otros lotes: la pantalla de
//  Administracion monta una docena de componentes con media docena de
//  `useState(false)` cada uno. Se identifica la llamada por el NOMBRE del
//  componente que la hace (el marco de la pila que llama a `useState`) y por
//  su POSICION dentro de ese componente (0 = el primer `useState`). Un forzado
//  que no se consume hace fallar la prueba: si alguien reordena los estados,
//  se entera aqui y no con un HTML distinto en silencio.
//
//  ─── EL ESPANOL IDENTICO ───────────────────────────────────────────────────
//  Con `I18N_VOLCAR=<carpeta>` la prueba escribe el HTML ESPANOL de cada
//  estado. Se volco ANTES de tocar los componentes y DESPUES, y se comparo con
//  `diff -rq` (ver `docs/i18n/revision-admin.md`).
// ============================================================================

type Forzado = { comp: string; n: number; valor: unknown }
const forzado = vi.hoisted(() => ({
  lista: [] as Array<{ comp: string; n: number; valor: unknown }>,
  cuenta: new Map<string, number>(),
}))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    if (forzado.lista.length > 0) {
      const marco = (new Error().stack ?? '').split('\n')[2] ?? ''
      const comp = /at (?:[\w$]+\.)*([\w$]+) /.exec(marco.trim() + ' ')?.[1] ?? ''
      const n = forzado.cuenta.get(comp) ?? 0
      forzado.cuenta.set(comp, n + 1)
      const i = forzado.lista.findIndex((f) => f.comp === comp && f.n === n)
      if (i >= 0) {
        const [f] = forzado.lista.splice(i, 1)
        return real.useState(f.valor)
      }
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/administracion',
}))

// Los cuadros reales van por portales de Radix, que en el servidor no pintan
// nada; las pestañas solo pintan la activa. Se sustituyen por su contenido en
// linea: lo que se mide es el TEXTO.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement('div', null, createElement('h2', null, p.title), p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
      : null,
}))
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: { open: boolean; title: string; confirmLabel?: string; children: unknown }) =>
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never, createElement('button', null, p.confirmLabel)) : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never, p.accion as never, p.children as never),
}))
vi.mock('@/components/demo/ui/Tabs', () => ({
  Tabs: (p: { tabs: { value: string; label: string }[]; children: unknown }) =>
    createElement('div', null, ...p.tabs.map((t) => createElement('button', { key: t.value }, t.label)), p.children as never),
  TabPanel: (p: { children: unknown }) => createElement('div', null, p.children as never),
}))

const datos = vi.hoisted(() => ({
  sesion: null as unknown,
  sitios: [] as unknown[] | undefined,
  sitiosRed: [] as unknown[] | undefined,
  acciones: [] as unknown[] | undefined,
  config: null as unknown,
  entidades: [] as unknown[] | undefined,
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({
  useSesionCtx: () => ({ sesion: datos.sesion, refrescar: async () => {} }),
  usePuede: () => true,
}))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useSitios: () => datos.sitios,
    useSitiosRed: () => datos.sitiosRed,
    useAcciones: () => datos.acciones,
    useConfigNegocio: () => datos.config,
    useEntidadesFiscales: () => datos.entidades,
    useActualizarConfig: () => () => {},
  }
})

// ─── Datos de prueba ────────────────────────────────────────────────────────
const YO = { id: 'u1', nombre: 'Ana Dueña', email: 'ana@x.com', rol: 'DUENO', activo: true }
const USUARIOS = [
  YO,
  { id: 'u2', nombre: 'Beto Ventas', email: 'beto@x.com', rol: 'VENDEDOR', activo: true },
  { id: 'u3', nombre: 'Caro Ops', email: 'caro@x.com', rol: 'OPERACIONES', activo: false },
]
const SESION = { usuario: { ...YO, metodoSesion: 'password', debeCambiarPassword: false } }

const MATRIZ = {
  modulos: [
    { key: 'comercial', label: 'Comercial' },
    { key: 'precios', label: 'Precios y descuentos' },
    { key: 'administracion', label: 'Administración' },
  ],
  roles: [
    { rol: 'DUENO', label: 'Dueño' },
    { rol: 'VENDEDOR', label: 'Vendedor' },
  ],
  filas: [
    { modulo: 'comercial', rol: 'DUENO', accion: 'ver' },
    { modulo: 'comercial', rol: 'DUENO', accion: 'crear' },
    { modulo: 'comercial', rol: 'VENDEDOR', accion: 'ver' },
    { modulo: 'administracion', rol: 'DUENO', accion: 'costear' },
  ],
}

const CONFIG = {
  topeDescuentoPct: 100, logoUrl: null, nombreTenant: 'Medios Norte', nombreComercial: 'MN',
  entidadPrincipalId: 'e1', rfc: null, razonSocial: 'Medios Norte SA', domicilioFiscal: null,
  representanteLegal: '', datosConstitucion: null, ivaTasas: [8, 16], plazosCobranza: [30, 60],
  maxClientesPantalla: null, loopSeg: 60, spotSeg: 10, costosOt: { DESMONTAJE: 1500 },
  condicionesPropuesta: 'Net 30.', vigenciaPropuestaDias: 30, emailRemitente: null,
}
const CONFIG_LLENA = { ...CONFIG, rfc: 'MNO010101AA1', domicilioFiscal: 'Reforma 1', representanteLegal: 'Ana', emailRemitente: 'avisos@mn.com' }

const ENTIDADES = [
  { id: 'e1', razonSocial: 'Medios Norte SA', rfc: 'MNO010101AA1', regimen: '601', cpFiscal: '03100', serieFolios: 'A', roles: ['VENTAS'], activo: true },
  { id: 'e2', razonSocial: 'Rentas Norte SC', rfc: null, regimen: null, cpFiscal: null, serieFolios: null, roles: ['VENTAS'], activo: true },
  { id: 'e3', razonSocial: 'Vieja SA', rfc: null, regimen: null, cpFiscal: null, serieFolios: null, roles: [], activo: false },
]
const CATALOGO = [
  { rol: 'VENTAS', etiqueta: 'Ventas' },
  { rol: 'RENTAS', etiqueta: 'Rentas' },
]
// Ola 6 · el catalogo de partida, tal cual lo deja la migracion.
const CATALOGO_PAPELES = [
  { rol: 'ARRENDAMIENTOS', etiqueta: 'Paga las rentas a los arrendadores' },
  { rol: 'ACTIVOS', etiqueta: 'Compra los activos y el equipo' },
  { rol: 'LICENCIAS', etiqueta: 'Tramites y licencias con gobierno' },
  { rol: 'OPERACION', etiqueta: 'Operacion y nomina' },
  { rol: 'VENTAS', etiqueta: 'Vende publicidad' },
]
const ENTIDADES_PAPELES = [
  { id: 'e1', razonSocial: 'Medios Norte SA', rfc: null, regimen: null, cpFiscal: null, serieFolios: null, roles: ['VENTAS', 'ACTIVOS'], activo: true },
  { id: 'e2', razonSocial: 'Rentas Norte SC', rfc: null, regimen: null, cpFiscal: null, serieFolios: null, roles: ['VENTAS'], activo: true },
]

const SITIOS = [
  { id: 's1', nombre: 'Pantalla Reforma', codigoProveedor: 'PR-1', tipoMedio: 'PANTALLA_DIGITAL', esRotativo: true, exhibicion: 'digital', totalSpots: 8, enNetwork: true, comercializacion: 'PROGRAMATICO', cms: 'DOOHMAIN', estatusComercial: 'DISPONIBLE' },
  { id: 's2', nombre: 'Muro Sur', codigoProveedor: 'PR-2', tipoMedio: 'ESPECTACULAR', esRotativo: false, exhibicion: 'fija', totalSpots: null, enNetwork: false, comercializacion: 'TRADICIONAL', cms: null, estatusComercial: 'RESERVADO' },
]
const RED = [
  { id: 's1', nombre: 'Pantalla Reforma', codigoProveedor: 'PR-1', esPropio: true, tipoMedio: 'PANTALLA_DIGITAL', alcaldia: 'Cuauhtémoc', tarifaPublicada: 1000 },
  { id: 'x9', nombre: 'Ajena', codigoProveedor: 'AJ-1', esPropio: false, duenoTenant: null, tipoMedio: 'ESPECTACULAR', alcaldia: null, plazaCiudad: null, tarifaPublicada: null },
]

// Reloj fijo (como `pantallas-comercial.test.ts`): «Hoy», «Ayer» y la hora de
// cada accion no deben cambiar entre una corrida y otra, o el volcado no se
// puede comparar.
const hoy = new Date('2026-11-02T12:00:00')
const iso = (d: Date) => d.toISOString()
const ACCIONES = [
  { id: 'a1', usuarioNombre: 'Ana Dueña', accion: 'reservó', entidad: 'Pantalla Reforma', timestamp: iso(hoy) },
  { id: 'a2', usuarioNombre: 'Beto Ventas', accion: 'facturó', entidad: 'F-1', timestamp: iso(new Date(hoy.getTime() - 86_400_000)) },
  { id: 'a3', usuarioNombre: 'Beto Ventas', accion: 'cerró', entidad: 'OT-9', timestamp: '2026-01-05T15:00:00' },
]

const ESTADO_ACT = {
  comprobadoEn: '2026-10-30T10:00:00Z', digestDisponible: 'sha256:b', hayNovedad: true, modo: 'aprobacion',
  versionInstalada: 'v0.12.4', versionDisponible: 'v0.12.5', aprobadoDigest: null, migracionesPendientes: 2,
  notasDisponibles: { version: 'v0.12.5', fecha: '2026-10-29', items: [{ tipo: 'NUEVO', texto: 'Algo nuevo' }, { tipo: 'CORREGIDO', texto: 'Un arreglo' }] },
}

const TICKETS = [
  { id: 't1', folio: 'TK-1', estado: 'ABIERTO', prioridad: 'ALTA', asunto: 'No carga', cuerpo: 'Detalle', creadoEn: '2026-10-30T10:00:00Z', respuesta: null, respondidoEn: null },
  { id: 't2', folio: 'TK-2', estado: 'RESUELTO', prioridad: 'NORMAL', asunto: 'Logo', cuerpo: 'Otro', creadoEn: '2026-10-29T10:00:00Z', respuesta: 'Listo', respondidoEn: '2026-10-29T12:00:00Z' },
]

const NOVEDADES = {
  version: 'v0.12.5',
  notas: { version: 'v0.12.5' },
  novedades: [
    { version: 'v0.12.5', fecha: '2026-10-29', items: [{ tipo: 'NUEVO', texto: 'Algo' }, { tipo: 'AJUSTADO', texto: 'Otro' }, { tipo: 'AJUSTADO', texto: 'Más' }, { tipo: 'CORREGIDO', texto: 'Fix' }] },
    { version: 'v0.12.4', fecha: '2026-10-27', items: [{ tipo: 'NUEVO', texto: 'A' }, { tipo: 'NUEVO', texto: 'B' }] },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(hoy)
  process.env.IDIOMA_INGLES = '1'
  forzado.lista = []
  forzado.cuenta = new Map()
  datos.sesion = SESION
  datos.sitios = SITIOS
  datos.sitiosRed = RED
  datos.acciones = ACCIONES
  datos.config = CONFIG
  datos.entidades = ENTIDADES
})

function pintar(idioma: Idioma, el: ReactElement, forzar: Forzado[] = []): string {
  forzado.lista = forzar.map((f) => ({ ...f }))
  forzado.cuenta = new Map()
  const html = renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
  const sobran = forzado.lista.map((f) => `${f.comp}#${f.n}`)
  forzado.lista = []
  if (sobran.length) throw new Error(`forzados sin consumir: ${sobran.join(', ')}`)
  return html
}

function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const f = (comp: string, n: number, valor: unknown): Forzado => ({ comp, n, valor })

async function admin() {
  return (await import('../../app/(app)/(shell)/administracion/page')).default
}

type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
}

// Forzados comunes de la pantalla de Administracion con todo cargado.
const ADMIN_CARGADA = (extra: Forzado[] = []): Forzado[] => [
  f('Usuarios', 0, USUARIOS),
  f('ControlCambiosPanel', 0, true),
  f('MatrizRoles', 0, MATRIZ),
  f('Configuracion', 0, CONFIG),
  f('OrganizacionesPanel', 0, [{ id: 'o1', nombre: 'Medios Norte', slug: 'mn' }, { id: 'o2', nombre: 'Otra', slug: 'otra' }]),
  f('OrganizacionesPanel', 1, 'o1'),
  f('OrganizacionesPanel', 2, 'ok'),
  f('ActualizacionesPanel', 0, ESTADO_ACT),
  f('ActualizacionesPanel', 1, 'ok'),
  f('TicketsPanel', 0, TICKETS),
  f('TicketsPanel', 1, 'ok'),
  ...extra,
]

const PANTALLAS: Pantalla[] = [
  {
    nombre: 'administracion · todo cargado',
    pintar: async (i) => pintar(i, createElement(await admin()), ADMIN_CARGADA()),
    espanol: [
      'Administración', 'Usuarios, roles y configuración del negocio', 'Roles y permisos', 'Configuración',
      'Equipo', '3 usuarios', '2 activos', '1 inactivo', 'Invitar usuario', 'Usuario', 'Rol', 'Estatus', 'Contraseña',
      'tú', 'Cambiar la mía', 'Cambiar', 'No puedes cambiar tu propio estatus', 'Pulsa para desactivar a Beto Ventas',
      'Pulsa para activar a Caro Ops', 'Rol de Beto Ventas', 'Dueño', 'Vendedor', 'Director comercial', 'Inactivo',
      'Control de cambios', 'Aplica también a ti.', 'Desactivar el control', 'Contraseña del control de cambios',
      'Todavía no se ha asignado ninguna.', 'Asignar contraseña',
      'Activo. Al teclear una contraseña válida, la sesión queda desbloqueada 15 minutos y luego se vuelve a pedir.',
      'Permisos por rol y módulo', 'Módulo · qué abre', 'Precios y descuentos', 'Ver', 'Crear', 'Costear',
      '* el área no tiene API propia: su permiso lo aplica /api/estado', 'Clientes', 'Propuestas',
      'Sin API propia: el permiso lo aplica /api/estado',
      'Secciones de la configuración', 'Empresa', 'Comercial', 'Operación', 'Instancia',
      'Identidad de la empresa', 'Subir logo', 'Nombre de la empresa', 'Es el que aparece en el menú lateral.',
      'Moneda', 'Se eligió al crear la instancia y no se puede cambiar.', 'Razón social', 'Nombre comercial',
      'p. ej. PIXELED', '+ Agregar o editar en Razones sociales', 'Se muestran en el encabezado del Dashboard.',
      'Datos fiscales para contratos', 'parte arrendataria', 'Faltan ', 'RFC, Domicilio fiscal, Representante legal',
      'Sin esto el contrato sale con huecos y no se puede enviar a firma.', 'Representante legal', 'Nombre de quien firma',
      'Calle, número, colonia, CP, ciudad, estado', 'Datos de constitución',
      'El RFC es el de la razón social principal: cambiarlo aquí lo cambia también en «Razones sociales».',
      'Correo de avisos', 'Correo de la organización', 'p. ej. avisos@tuempresa.com',
      'Sin correo configurado, los avisos salen sin dirección de respuesta',
      'IVA(s) con los que trabaja', 'Las tasas disponibles para facturar.', 'Agregar', 'Plazos de cobranza (días)',
      'placeholder="días"', 'Tope de descuento comercial', 'Descuento máximo (%)', 'Guardar tope',
      'no se guarda', 'Cambiarlo pide tu contraseña', 'Cupo de clientes por pantalla', 'Máximo de clientes (default)',
      'Sin límite', 'Cuántos anunciantes distintos pueden compartir una pantalla',
      'Propuestas: vigencia y condiciones', 'Vigencia (días)', 'Plantilla de términos y condiciones',
      'Guardar plantilla', 'Se copia a cada propuesta nueva; las ya creadas conservan las suyas.',
      'Sin condiciones: las propuestas no llevan este bloque.',
      'Reproducción digital (loop)', 'Tamaño del loop (seg)', 'Duración por slot (seg)', 'Slots por loop',
      'referencia', '</b> de 1 pantalla digitales tienen un número propio distinto de 6 (8 slots). Se edita en cada pantalla, desde Inventario.',
      'Tipos de tarea de cuadrilla', 'Montaje de lona', 'Desmontaje', 'solo pantalla fija', 'fija y digital',
      'Costo de mano de obra por tipo de orden de trabajo', 'Usa el respaldo', 'Mantenimiento preventivo',
      'Actualizaciones', 'Hay una versión nueva disponible: v0.12.5. Esperando tu aprobación para instalarla.',
      'Instalada:', 'Disponible:', 'Migraciones:', 'Comprobado:', 'Modo', 'Con aprobación', 'Automática',
      'Qué trae v0.12.5', 'Nuevo', 'Corregido', 'Instalar v0.12.5',
      'Soporte', 'Tienes 1 ticket esperando respuesta.', 'Nuevo ticket', 'Abierto', 'Resuelto', 'Alta',
      'Respuesta de AS OOH · ', 'Esperando respuesta de AS OOH.',
      'Organizaciones (CRMs)', 'Nueva organización', 'Entrar', 'Volver a mi CRM',
    ],
    ingles: [
      'Settings', 'Users, roles and business settings', 'Roles and permissions', 'Business settings', 'Team', '3 users',
      '2 active', '1 inactive', 'Invite user', 'you', 'Change mine', 'You can’t change your own status',
      'Click to deactivate Beto Ventas', 'Beto Ventas’s role', 'Owner', 'Sales rep', 'Sales director',
      'Change control', 'It applies to you too.', 'Turn off change control',
      'On. After a valid password is typed, the session stays unlocked for 15 minutes and then asks again.',
      'Permissions by role and module', 'Pricing and discounts', 'View', 'Create', 'Cost', 'Clients', 'Proposals',
      'Company identity', 'Upload logo', 'Company name', 'Currency', 'Legal name', 'Trade name',
      'Tax details for contracts', 'lessee', 'RFC (tax ID), Tax address, Legal representative</b> are missing.',
      'Notification email', 'VAT rates you work with', 'Payment terms (days)', 'Sales discount cap',
      'is not saved', 'Client cap per screen', 'Proposals: validity and terms', 'Digital playback (loop)',
      '</b> of 1 digital screen has its own number other than 6 (8 slots).',
      'Crew task types', 'Vinyl installation', 'Removal', 'static screen only', 'static and digital',
      'Labor cost by work order type', 'Uses the fallback', 'Preventive maintenance',
      'Updates', 'A new version is available: v0.12.5. Waiting for your approval to install it.',
      'Installed:', 'What’s in v0.12.5', 'New', 'Fixed', 'Install v0.12.5',
      'Support', 'You have 1 ticket waiting for a reply.', 'New ticket', 'Open', 'Resolved', 'High',
      'Reply from AS OOH · ', 'Waiting for a reply from AS OOH.',
      'Platform organizations', 'New organization', 'Switch to', 'Back to my organization',
    ],
  },
  {
    nombre: 'administracion · cargando y sin permisos',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('Configuracion', 0, CONFIG),
        f('OrganizacionesPanel', 2, 'sin-permiso'),
        f('ActualizacionesPanel', 1, 'sin-permiso'),
        f('TicketsPanel', 1, 'error'),
        f('MatrizRoles', 0, null),
        f('Usuarios', 0, []),
      ]),
    espanol: [
      'Sin usuarios.', 'No se pudo cargar la matriz de permisos.', 'Reservado al administrador de la plataforma',
      'Crear organizaciones y cambiar entre ellas está reservado al', ' administrador de la plataforma',
      'Si necesitas una organización nueva, pídesela a quien administre Space OS.',
    ],
    ingles: [
      'No users.', 'The permission matrix could not be loaded.', 'Reserved for the platform administrator',
      'Creating organizations and switching between them is reserved for the', ' platform administrator',
    ],
  },
  {
    nombre: 'administracion · actualizaciones y soporte, sin permiso y vacios',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('Configuracion', 0, CONFIG_LLENA),
        f('ActualizacionesPanel', 1, 'sin-permiso'),
        f('TicketsPanel', 0, []),
        f('TicketsPanel', 1, 'ok'),
        f('ControlCambiosPanel', 0, false),
        f('ControlCambiosPanel', 2, true),
        f('ControlCambiosPanel', 5, true),
      ]),
    espanol: [
      'Ver y decidir la actualización de esta instancia está reservado a quien tenga el',
      'Administración → ver', 'Todavia no has abierto ningun ticket de soporte.',
      'Aquí verás tus tickets en cuanto abras el primero.', 'Activar el control de cambios',
      'Contraseña nueva (mínimo 8, con letra y número)', 'Repetirla', 'Actualizar',
    ],
    ingles: [
      'Viewing and deciding on this instance’s update is reserved for whoever has the', 'Settings → view',
      'You haven’t opened any support tickets yet.', 'Turn on change control', 'Repeat it', 'Update',
    ],
  },
  {
    nombre: 'administracion · soporte con error y ticket nuevo abierto',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('Configuracion', 0, CONFIG),
        f('TicketsPanel', 0, TICKETS.slice(1)),
        f('TicketsPanel', 1, 'ok'),
        f('TicketsPanel', 2, true),
        f('ActualizacionesPanel', 1, 'error'),
        f('ControlCambiosPanel', 0, true),
        f('ControlCambiosPanel', 2, true),
      ]),
    espanol: [
      'Todos tus tickets estan contestados.', 'Asunto', 'Cuéntanos qué pasa', 'Prioridad', 'Baja', 'Urgente',
      'Abrir ticket', 'No se pudo cargar el estado de la actualización.', 'Ya hay una contraseña asignada.', 'Cambiarla',
    ],
    ingles: [
      'All your tickets have been answered.', 'Subject', 'Tell us what’s happening', 'Priority', 'Low', 'Urgent',
      'Open ticket', 'The update status could not be loaded.', 'A password has already been set.', 'Change it',
    ],
  },
  {
    nombre: 'administracion · alta de organizacion con Google',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('OrganizacionesPanel', 0, []),
        f('OrganizacionesPanel', 2, 'ok'),
        f('NuevaOrganizacion', 0, true),
        f('NuevaOrganizacion', 6, true),
      ]),
    espanol: [
      'Sin organizaciones.', 'Nombre de la organización', 'Mi Empresa SA de CV', 'Nombre del Dueño', 'Su correo',
      'El Dueño entra con su cuenta de Google', 'Contraseña del Dueño', 'Crear organización',
    ],
    ingles: [
      'No organizations.', 'Organization name', 'Owner’s name', 'Their email',
      'The Owner signs in with their Google account', 'Owner’s password', 'Create organization',
    ],
  },
  {
    nombre: 'administracion · crear usuario (invitacion, con Google)',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [f('Usuarios', 0, USUARIOS), f('Usuarios', 1, true), f('InvitarModal', 6, true)]),
    espanol: [
      'Crear usuario', 'Recibirá un enlace para elegir su contraseña', 'Nombre', 'Correo', 'correo@empresa.com',
      'Cargo', 'Acceso', 'Enviar invitación', 'Recibe un enlace para elegir su propia contraseña. Nadie más la conoce.',
      'Fijar la contraseña yo', 'Tú la escribes y se la entregas por un medio seguro.', 'Entra con su cuenta de Google',
      'Su correo de Google debe ser el mismo que escribiste arriba.', 'Crear e invitar',
    ],
    ingles: [
      'Create user', 'They’ll get a link to choose their password', 'Name', 'Email', 'Job title', 'Access',
      'Send invitation', 'Set the password myself', 'Signs in with their Google account', 'Create and invite',
    ],
  },
  {
    nombre: 'administracion · crear usuario fijando la contrasena',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [f('Usuarios', 1, true), f('InvitarModal', 5, 'password'), f('InvitarModal', 7, 'Error del servidor')]),
    espanol: ['Define su acceso y contraseña', 'placeholder="mínimo 8, con letra y número"'],
    ingles: ['Set their access and password', 'placeholder="at least 8, with a letter and a number"'],
  },
  {
    nombre: 'administracion · crear usuario, enlace sin correo',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('Usuarios', 1, true),
        f('InvitarModal', 0, 'Dani'),
        f('InvitarModal', 9, { url: 'https://x/i/1', fallo: false }),
      ]),
    espanol: [
      'Comparte el enlace con la persona', 'La cuenta de ', 'Dani',
      ' está creada. Este servidor no tiene correo configurado, así que pásale este enlace por un medio seguro: con él elige su contraseña.',
      'Vence en 72 horas y sirve una sola vez. No se volverá a mostrar.', 'Copiar enlace', 'Listo',
    ],
    ingles: ['Share the link with the person', 'This server has no email configured', 'Copy link', 'Done'],
  },
  {
    nombre: 'administracion · crear usuario, el correo fallo',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [
        f('Usuarios', 1, true),
        f('InvitarModal', 9, { url: 'https://x/i/1', fallo: true }),
        f('InvitarModal', 10, true),
      ]),
    espanol: ['La cuenta se creó, pero el correo no se pudo enviar. Pásale este enlace por otro medio.', 'Copiado'],
    ingles: ['The account was created, but the email could not be sent.', 'Copied'],
  },
  {
    nombre: 'administracion · cambiar mi contrasena',
    pintar: async (i) => pintar(i, createElement(await admin()), [f('Usuarios', 0, USUARIOS), f('Usuarios', 2, YO), f('CambiarPasswordModal', 3, 'x')]),
    espanol: ['Cambiar mi contraseña', 'Confirma con tu contraseña actual', 'Contraseña actual', 'Nueva contraseña', 'Confirmar contraseña', 'Guardar contraseña'],
    ingles: ['Change my password', 'Confirm with your current password', 'Current password', 'New password', 'Confirm password', 'Save password'],
  },
  {
    nombre: 'administracion · restablecer la de otro',
    pintar: async (i) => pintar(i, createElement(await admin()), [f('Usuarios', 2, USUARIOS[1])]),
    espanol: [
      'Restablecer la contraseña de Beto Ventas', 'Se generará una contraseña ', 'temporal',
      ' para Beto Ventas, se cerrarán sus sesiones abiertas y tendrá que cambiarla al entrar.', 'Restablecer contraseña',
    ],
    ingles: ['Reset the password for Beto Ventas', 'A <b>temporary</b> password will be generated for Beto Ventas', 'Reset password'],
  },
  {
    nombre: 'administracion · restablecer, pide tu contrasena',
    pintar: async (i) => pintar(i, createElement(await admin()), [f('Usuarios', 2, USUARIOS[1]), f('CambiarPasswordModal', 6, true)]),
    espanol: [
      'Confirma con ', 'tu', ' contraseña. Vas a cambiar el acceso de Beto Ventas, y la bitácora tiene que poder probar que fuiste tú.',
      'Tu contraseña', 'Confirmar y restablecer',
    ],
    ingles: ['Confirm with <b>your</b> password.', 'Your password', 'Confirm and reset'],
  },
  {
    nombre: 'administracion · contrasena temporal generada',
    pintar: async (i) => pintar(i, createElement(await admin()), [f('Usuarios', 2, USUARIOS[1]), f('CambiarPasswordModal', 5, 'Tmp-1234')]),
    espanol: [
      'Contraseña temporal de ', '. Entrégasela por un medio seguro:',
      'No se puede volver a ver: en la base solo queda su huella. Se cerraron las sesiones abiertas de Beto Ventas',
      'Ya la copié',
    ],
    ingles: ['Temporary password for <b>Beto Ventas</b>. Hand it over through a secure channel:', 'It can’t be shown again', 'I’ve copied it'],
  },
  {
    nombre: 'administracion · correo de avisos, antes de guardar',
    pintar: async (i) =>
      pintar(i, createElement(await admin()), [f('Configuracion', 0, CONFIG_LLENA), f('CorreoDeAvisos', 0, 'nuevo@mn.com'), f('CorreoDeAvisos', 1, true)]),
    espanol: [
      'Antes de guardar este correo', 'Cómo se va a usar la dirección que acabas de escribir', 'Entendido, guardar',
      'Los avisos ', 'no se envían desde', ' esta dirección: salen del servidor de correo de la plataforma, a nombre de ',
      'las respuestas llegan aquí', 'En la bandeja de enviados de esta cuenta no vas a ver nada.',
      'acabaría en spam. <b>Si quieres que salgan desde tu dominio, avísanos y lo configuramos.</b>',
      'Afecta a los avisos de operación', 'Revisa que esté bien escrita',
    ],
    ingles: [
      'Before saving this email', 'Got it, save', 'Notices <b>are not sent from</b> this address',
      'end up in spam. <b>If you want them to go out from your domain', 'It affects operations notices', 'Check that it’s spelled correctly',
    ],
  },
  {
    nombre: 'configuracion · mi cuenta, empresa y contrasena temporal',
    pintar: async (i) => {
      datos.sesion = { usuario: { ...YO, metodoSesion: 'google', debeCambiarPassword: true } }
      datos.config = CONFIG
      const P = (await import('../../app/(app)/(shell)/configuracion/page')).default
      return pintar(i, createElement(P), [f('CuentaCard', 1, 'nueva1234')])
    },
    espanol: [
      'Configuración', 'Nombre de la empresa y datos de tu cuenta.', 'Tu contraseña es temporal.',
      ' Cámbiala aquí abajo para volver a entrar al resto del sistema.', 'Mi cuenta', 'Dueño', 'Entraste con Google',
      'Cambia tu correo y/o contraseña. Solo afecta a tu cuenta.', 'Correo', 'Nueva contraseña',
      'Déjala en blanco para no cambiarla (mín. 8)', 'Entraste con Google y aún no tienes contraseña propia',
      'Guardar cambios', 'Empresa', 'Este nombre aparece en el menú de la izquierda. También se cambia en ',
      'Administración → Configuración', ', junto con el logo y los datos fiscales.', 'Nombre de la empresa',
    ],
    ingles: [
      'Company name and your account details.', 'Your password is temporary.', 'My account', 'Owner',
      'You signed in with Google', 'Save changes', 'Company', 'Settings → Business settings', 'Company name',
    ],
  },
  {
    nombre: 'configuracion · solo mi cuenta, con contrasena actual',
    pintar: async (i) => {
      datos.sesion = { usuario: { ...YO, rol: 'VENDEDOR', metodoSesion: 'password', debeCambiarPassword: false } }
      const P = (await import('../../app/(app)/(shell)/configuracion/page')).default
      return pintar(i, createElement(P), [f('CuentaCard', 1, 'nueva1234')])
    },
    espanol: ['Cambia el correo y la contraseña de tu cuenta.', 'Entraste con contraseña', 'Contraseña actual ', '(para confirmar)', 'Tu contraseña actual', 'Vendedor'],
    ingles: ['Change your account’s email and password.', 'You signed in with a password', 'Current password ', '(to confirm)', 'Your current password', 'Sales rep'],
  },
  {
    nombre: 'integraciones · conectores y metricas',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/integraciones/page')).default
      // Los conectores REALES del servidor (nombre y descripcion en espanol):
      // un dato inventado taparia que se pintan sin traducir (validacion, hallazgo 2).
      const { estadoIntegraciones } = await import('../server/integraciones')
      const reales = estadoIntegraciones().map((c, n) => ({ ...c, configurado: n === 0 }))
      return pintar(i, createElement(P), [
        f('IntegracionesPage', 0, reales),
        f('IntegracionesPage', 2, { vehiculos: 1200, personas: 300, velocidadPromedioKmh: 30, ventana: '1h', simulado: true }),
      ])
    },
    espanol: [
      'Integraciones', 'Conectores externos · listos para enchufar credenciales', 'Hay conectores sin credenciales: devuelven datos ',
      'simulados', 'Conectores', '1 de 3', ' conectado', 'Conteo de audiencia y vehículos por dispositivo de visión.',
      'Facturación fiscal (CFDI / SUNAT)', 'Timbrado fiscal de facturas por país', 'Publicar contenido y traer proof-of-play', ' sin credenciales', 'Conectado', 'Sin credenciales',
      'Credenciales cargadas · responde el proveedor real.', 'Devuelve datos simulados.', 'Probar AdMobilize',
      'Diagnóstico · devuelve datos simulados sin credenciales', 'ID del dispositivo', 'Consultar métricas', 'Vehículos',
      'Personas', 'Vel. prom.', 'Ventana', 'Datos simulados (sin credenciales)', 'Dónde está lo demás',
      'Publicación en DOOHmain', 'Desde la ficha de cada campaña', 'CMS de cada pantalla', 'En Network, pantalla por pantalla',
      'Actualizaciones de SPACE OS', 'En Administración → Configuración → Instancia',
    ],
    ingles: [
      'Integrations', 'Some connectors have no credentials', 'Connectors', '1 of 3', ' connected',
      'Audience and vehicle counts per vision device.', 'Tax invoicing (CFDI / SUNAT)', 'CMS / DOOH players', ' without credentials',
      'No credentials', 'Test AdMobilize', 'Device ID', 'Query metrics', 'Vehicles', 'Where everything else is',
      'Publishing to DOOHmain', 'In Settings → Business settings → Instance',
    ],
  },
  {
    nombre: 'integraciones · sin conectores',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/integraciones/page')).default
      return pintar(i, createElement(P), [f('IntegracionesPage', 0, [])])
    },
    espanol: ['No hay conectores que mostrar', 'Si esperabas verlos, puede que la consulta haya fallado: recarga la página.'],
    ingles: ['There are no connectors to show', 'If you expected to see them'],
  },
  {
    nombre: 'network · inventario y red',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/network/page')).default
      return pintar(i, createElement(P))
    },
    espanol: [
      'Inventario sin vender compartible a la Network · decides qué espacios incluir', 'Indicadores', 'En la Network',
      'de 2 espacios', 'Sin compartir', 'disponibles para la Network', 'Programáticos', 'venta automatizada', 'Tradicionales',
      'venta directa', 'CMS en la Network:', 'Reglas de comercialización por pantalla', 'Todas ', 'Programático ', 'Tradicional',
      'Pantalla', 'Comercialización', 'En Network', 'Compartir Pantalla Reforma a la Network', 'Compartida',
      'Disponible', 'Reservado', 'Red de pantallas · toda la plataforma',
      'Catálogo de todas las pantallas registradas. Solo el operador dueño puede editarlas.', 'Operador', 'Tipo',
      'Ubicación', 'Tarifa', 'Tuya', 'Otro operador', 'Pantalla digital', 'Espectacular',
    ],
    ingles: [
      'Indicators', 'On the Network', 'of 2 spaces', 'Not shared', 'Programmatic', 'Traditional', 'CMS on the Network:',
      'Sales rules by screen', 'All ', 'Screen', 'Sales model', 'Share Pantalla Reforma to the Network', 'Shared',
      'Available', 'Booked', 'Screen network · the whole platform', 'Operator', 'Location', 'Rate', 'Yours', 'Another operator',
      'Digital screen', 'Billboard',
    ],
  },
  {
    nombre: 'network · red solo propia y filtro vacio',
    pintar: async (i) => {
      datos.sitiosRed = [RED[0]]
      datos.sitios = [{ ...SITIOS[1], enNetwork: false }]
      const P = (await import('../../app/(app)/(shell)/network/page')).default
      return pintar(i, createElement(P), [f('NetworkPage', 1, 'si')])
    },
    espanol: ['— ningún espacio digital compartido aún.', 'Ninguna pantalla coincide con el filtro.', 'Todas las pantallas de la red son tuyas (1); aquí aparecerán las de otros operadores.', 'Ver todas (1) →'],
    // Un solo espacio: el singular con su cierre (costura 2, mutante N4). «of 1
    // space» a secas es subcadena de «of 1 spaces» y no mordia.
    ingles: ['— no digital space shared yet.', 'No screens match the filter.', 'All the screens in the network are yours (1)', 'See all (1) →', '>of 1 space<'],
  },
  {
    nombre: 'network · red vacia',
    pintar: async (i) => {
      datos.sitiosRed = []
      const P = (await import('../../app/(app)/(shell)/network/page')).default
      return pintar(i, createElement(P))
    },
    espanol: ['Aún no hay pantallas en la red.'],
    ingles: ['There are no screens in the network yet.'],
  },
  {
    nombre: 'novedades · con versiones',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/novedades/page')).default
      return pintar(i, createElement(P), [f('NovedadesPage', 0, NOVEDADES)])
    },
    espanol: [
      'Novedades', 'Lo que trajo cada versión de SPACE OS, de la más nueva a la más vieja.', 'Versión instalada: ',
      'Instalada', '1 nueva', '2 ajustes', '1 corrección', '2 nuevas', 'Nuevo', 'Ajustado', 'Corregido',
    ],
    ingles: ['What’s new', 'Installed version: ', 'Installed', '1 new', '2 adjustments', '1 fix', 'Adjusted', 'Fixed'],
  },
  {
    nombre: 'novedades · error y vacio',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/novedades/page')).default
      const a = pintar(i, createElement(P), [f('NovedadesPage', 1, true)])
      const b = pintar(i, createElement(P), [f('NovedadesPage', 0, { version: null, notas: null, novedades: [] })])
      return a + b
    },
    espanol: ['No se pudieron cargar las novedades.', 'Todavía no hay notas de versión.'],
    ingles: ['The release notes could not be loaded.', 'There are no release notes yet.'],
  },
  {
    nombre: 'actividad · registro',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/actividad/page')).default
      return pintar(i, createElement(P))
    },
    espanol: [
      'Actividad', 'Bitácora de acciones · quién hizo qué y cuándo', 'Registro de acciones', '3 de 3', 'Fecha', 'Hora',
      'Toda hora', 'Quién', 'Todos', 'Hoy', 'Ayer',
    ],
    ingles: ['Activity log', 'Who did what and when', 'Actions', '3 of 3', 'Date', 'Time', 'Any time', 'Who', 'All', 'Today', 'Yesterday'],
  },
  {
    nombre: 'actividad · sin coincidencias y vacia',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/actividad/page')).default
      const a = pintar(i, createElement(P), [f('ActividadPage', 0, 'Nadie')])
      datos.acciones = []
      const b = pintar(i, createElement(P))
      return a + b
    },
    espanol: ['Ninguna acción coincide con los filtros.', 'Limpiar filtros', 'Limpiar', 'Sin actividad todavía', 'Las acciones (reservar, confirmar, cerrar OT, facturar…) aparecerán aquí con su usuario y fecha.'],
    ingles: ['No actions match the filters.', 'Clear filters', 'Clear', 'No activity yet'],
  },
  {
    nombre: 'razones sociales · lista con avisos',
    pintar: async (i) => {
      const P = (await import('../../app/(app)/(shell)/razones-sociales/page')).default
      return pintar(i, createElement(P), [f('RazonesSocialesPage', 0, { entidades: ENTIDADES, catalogo: CATALOGO })])
    },
    espanol: [
      'Razones sociales', 'Las de tu empresa · con cuál pagas las rentas, compras los activos, tramitas licencias y vendes',
      'Ninguna razón social activa tiene ', 'Los documentos de ese tipo van a nacer sin razón social hasta que se lo asignes a alguna.',
      ' lo tienen dos o más. Cuando hay varias con el mismo papel', '2 activas', ' de baja', '2 avisos', 'Nueva razón social',
      'Principal', 'Sale en contratos y en el Dashboard · se cambia en Administración → Configuración', 'Dada de baja', 'sin RFC',
      ' · CP 03100', ' · serie A', 'Sin papel asignado', 'Editar', 'Reactivar', 'Dar de baja',
    ],
    ingles: [
      'Legal entities', 'No active legal entity has ', 'Held by two or more legal entities: ', '2 active', ' deactivated', '2 warnings',
      'New legal entity', 'Main', 'Deactivated', 'no RFC', ' · Postal code 03100', ' · series A', 'No role assigned', 'Edit', 'Reactivate', 'Deactivate',
    ],
  },
  {
    nombre: 'razones sociales · alta con un duplicado',
    pintar: async (i) => {
      const { GestionEntidadesFiscales } = await import('../../components/demo/razones-sociales/GestionEntidadesFiscales')
      return pintar(
        i,
        createElement(GestionEntidadesFiscales, { entidades: ENTIDADES, catalogo: CATALOGO, puedeEditar: true, alCambiar: () => {} }),
        [f('GestionEntidadesFiscales', 1, true), f('GestionEntidadesFiscales', 2, { razonSocial: 'medios norte sa', rfc: '', regimen: '', cpFiscal: '', serieFolios: '', roles: [] })],
      )
    },
    espanol: [
      'Razón social', 'Denominación fiscal, como aparece en la constancia', 'Régimen fiscal', 'CP fiscal', 'Serie de folios',
      'Qué papel juega esta razón social', 'Sin ningún papel también se guarda: cuál juega se puede decidir después.',
      'Ya tienes «Medios Norte SA», que es la misma razon social escrita de otra forma.',
    ],
    ingles: [
      'Legal name', 'Registered name, as it appears on the tax certificate', 'Tax regime', 'Tax postal code', 'Invoice series',
      'What role this legal entity plays', 'You already have “Medios Norte SA”, which is the same legal entity written differently.',
    ],
  },
  {
    nombre: 'razones sociales · vacia y con error',
    pintar: async (i) => {
      const { GestionEntidadesFiscales } = await import('../../components/demo/razones-sociales/GestionEntidadesFiscales')
      const P = (await import('../../app/(app)/(shell)/razones-sociales/page')).default
      const a = pintar(i, createElement(GestionEntidadesFiscales, { entidades: [], catalogo: CATALOGO, puedeEditar: true, alCambiar: () => {} }))
      const b = pintar(i, createElement(P), [f('RazonesSocialesPage', 1, 'Fallo del servidor')])
      return a + b
    },
    espanol: [
      'Todavía no hay ninguna razón social registrada.', 'Es la identidad fiscal del negocio',
      'Si prefieres capturarlas contestando tres preguntas, el ', 'cuestionario de bienvenida', ' las crea de una vez con sus papeles.',
    ],
    ingles: ['No legal entity has been registered yet.', 'welcome questionnaire'],
  },
  {
    // Ola 6 · los cinco papeles FIJOS del catalogo, con su etiqueta de partida:
    // en ingles salen en ingles (botones, chips de cada razon social y los dos
    // avisos de papeles sin dueno y compartidos).
    nombre: 'razones sociales · los cinco papeles del catalogo (ola 6)',
    pintar: async (i) => {
      const { GestionEntidadesFiscales } = await import('../../components/demo/razones-sociales/GestionEntidadesFiscales')
      return pintar(
        i,
        createElement(GestionEntidadesFiscales, { entidades: ENTIDADES_PAPELES, catalogo: CATALOGO_PAPELES, puedeEditar: true, alCambiar: () => {} }),
        [f('GestionEntidadesFiscales', 1, true), f('GestionEntidadesFiscales', 2, { razonSocial: 'Nueva SA', rfc: '', regimen: '', cpFiscal: '', serieFolios: '', roles: ['ACTIVOS'] })],
      )
    },
    espanol: [
      'Paga las rentas a los arrendadores', 'Compra los activos y el equipo', 'Tramites y licencias con gobierno',
      'Operacion y nomina', 'Vende publicidad',
    ],
    ingles: [
      'Pays rent to landlords', 'Buys assets and equipment', 'Government permits and licenses', 'Operations and payroll',
      'Sells advertising',
    ],
  },
]

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito.
const COMUNES = new Set<string>([
  'Rol', // esta dentro de «Role»
  'Dani', // dato
  'Pantalla', // dentro del dato «Pantalla Reforma»
])

const dirVolcado = process.env.I18N_VOLCAR
function volcar(nombre: string, html: string) {
  if (!dirVolcado) return
  mkdirSync(dirVolcado, { recursive: true })
  writeFileSync(join(dirVolcado, `${nombre.replace(/[^\w]+/g, '_')}.html`), html)
}

describe('lote ADMIN · en ESPANOL sale el texto de siempre', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      volcar(p.nombre, crudo)
      const html = texto(crudo)
      expect(p.espanol.filter((x) => !html.includes(x))).toEqual([])
    })
  }
})

describe('lote ADMIN · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((x) => html.includes(x) && !COMUNES.has(x))).toEqual([])
      expect(p.ingles.filter((x) => !html.includes(x))).toEqual([])
    })
  }
})

describe('lote ADMIN · barrido con el diccionario entero', () => {
  async function htmlIngles(): Promise<string> {
    let html = ''
    for (const p of PANTALLAS) {
      datos.sesion = SESION
      datos.sitios = SITIOS
      datos.sitiosRed = RED
      datos.acciones = ACCIONES
      datos.config = CONFIG
      datos.entidades = ENTIDADES
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Datos de prueba y el ejemplo del catalogo del SAT (un nombre oficial, en
    // espanol en los dos idiomas): no son texto del lote.
    for (const dato of ['Pantalla Reforma', '601 - General de Ley Personas Morales']) html = html.split(dato).join('')
    return html
  }

  it('ninguna frase espanola de `textos/admin.ts` aparece en las pantallas en ingles', async () => {
    const { ES_ADMIN, EN_ADMIN } = await import('./textos/admin')
    const html = await htmlIngles()
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_ADMIN)) {
      const en = EN_ADMIN[clave as keyof typeof EN_ADMIN]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 8 || en.includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ni de `textos/compartidos.ts` (Campo, candado, periodos)', async () => {
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const html = await htmlIngles()
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

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote ADMIN · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})

// ============================================================================
//  LOTE L5 DEL ITALIANO (2026-11-03) · las mismas pantallas, en italiano.
//  Por pantalla: ninguna frase espanola ni inglesa de admin, compartidos,
//  shell ni la base (`culpablesEnItaliano`: una inglesa es una clave que cae
//  al ingles porque nadie la tradujo) y ningun formato ajeno.
// ============================================================================
describe('lote L5 · ADMIN en ITALIANO', () => {
  async function diccionarios() {
    const { ES_ADMIN, EN_ADMIN, IT_ADMIN } = await import('./textos/admin')
    const { ES_COMPARTIDOS, EN_COMPARTIDOS, IT_COMPARTIDOS } = await import('./textos/compartidos')
    const { ES_SHELL, EN_SHELL, IT_SHELL } = await import('./textos/shell')
    const { DICCIONARIOS, IT_PARCIAL } = await import('./diccionario')
    const { clavesBase } = await import('./cobertura-italiano')
    const base = (d: Record<string, string>) => Object.fromEntries(clavesBase().map((k) => [k, d[k]]))
    return {
      es: { ...ES_ADMIN, ...ES_COMPARTIDOS, ...ES_SHELL, ...base(DICCIONARIOS.es) },
      en: { ...EN_ADMIN, ...EN_COMPARTIDOS, ...EN_SHELL, ...base(DICCIONARIOS.en) },
      it: { ...IT_ADMIN, ...IT_COMPARTIDOS, ...IT_SHELL, ...base(IT_PARCIAL as Record<string, string>) } as Partial<
        Record<string, string>
      >,
    }
  }
  // Datos de prueba y el nombre oficial del catalogo del SAT (como en ingles).
  // «Error del servidor» es el estado forzado de InvitarModal: el mensaje que
  // llegaria del servidor, ya en el idioma de la peticion.
  const DATOS = ['Pantalla Reforma', '601 - General de Ley Personas Morales', 'Error del servidor']

  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('it')
      expect(culpablesEnItaliano(crudo, await diccionarios(), { ignorar: DATOS })).toEqual([])
      expect(huellasEnItaliano(crudo)).toEqual([])
    })
  }
})
