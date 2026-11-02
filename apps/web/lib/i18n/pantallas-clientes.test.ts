import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { DICCIONARIOS } from './diccionario'
import { ES_CLIENTES, EN_CLIENTES } from './textos/clientes'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'

// ============================================================================
//  I18N · LOTE «CLIENTES, COMISIONES Y CAPTACION», RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El mismo patron que `pantallas-campanas-finanzas.test.ts`: se monta el
//  componente REAL dentro del proveedor, se rinde con `renderToStaticMarkup` y
//  se comprueba el texto:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda ninguna frase espanola del lote, y sale la inglesa;
//    (c) y un barrido: ningun texto espanol del diccionario del lote aparece en
//        el HTML ingles de ninguna pantalla.
//
//  Sin DOM no hay clics ni efectos: lo que sale tras un clic (un dialogo, la
//  ficha de un cliente) o tras un `fetch` en un efecto (la lista de
//  prospectos) se pinta FORZANDO el valor inicial de `useState`. Cada entrada
//  de la cola lleva un predicado sobre el valor inicial y sobre la PILA (el
//  nombre del componente que llama), y se consume en orden.
//
//  Con `I18N_VOLCAR=<carpeta>` vuelca el HTML espanol de cada estado: se corre
//  antes y despues de tocar los componentes y se compara con `diff -r`.
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    const cabeza = forzado.cola[0]
    if (cabeza && cabeza.si(valorInicial, new Error().stack ?? '')) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/clientes',
}))
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

// El modal y la hoja reales van por un portal de Radix, que en el servidor no pinta nada.
const panel = (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
  p.open
    ? createElement('div', null, createElement('h2', null, p.title),
        p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
    : null
vi.mock('@/components/demo/ui/Modal', () => ({ Modal: panel }))
vi.mock('@/components/demo/ui/Sheet', () => ({ Sheet: panel }))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.resumen as never,
      p.accion as never, p.children as never),
}))

const datos = vi.hoisted(() => ({
  clientes: null as unknown,
  propuestas: [] as unknown[],
  resumen: [] as unknown[],
  puede: true,
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => datos.puede }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useClientes: () => datos.clientes,
    usePropuestas: () => datos.propuestas,
    useCampanasResumen: () => datos.resumen,
    useConfigNegocio: () => ({ ivaTasas: [16, 8] }),
  }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.clientes = CLIENTES
  datos.propuestas = PROPUESTAS
  datos.resumen = RESUMEN
  datos.puede = true
})

// ─── Datos de prueba ────────────────────────────────────────────────────────
const AGENCIA = {
  id: 'ag1', nombre: 'Andina Media', tipo: 'AGENCIA', rfc: 'AND010101AB1', razonSocial: 'Andina Media SA',
  comisionAgenciaPct: 15, tieneNegociacion: true, negociacionValidada: false, negociacionNota: null,
  contacto: { email: 'cuentas@andina.mx', telefono: '5512345678' }, ivaPct: 16,
}
const AGENCIA_OK = { ...AGENCIA, id: 'ag2', nombre: 'Lumen', negociacionValidada: true, contacto: {} }
const AGENCIA_SIN = { ...AGENCIA, id: 'ag3', nombre: 'Norte', tieneNegociacion: false, contacto: {} }
const DIRECTO = {
  id: 'cl1', nombre: 'Refresco Azul', tipo: 'DIRECTO', rfc: null, razonSocial: null, agenciaId: 'ag1',
  comisionAgenciaPct: 0, tieneNegociacion: false, negociacionValidada: false, contacto: {}, ivaPct: 16,
}
const DIRECTO_SOLO = { ...DIRECTO, id: 'cl2', nombre: 'Panaderia Sol', agenciaId: null }
const CLIENTES = [AGENCIA, AGENCIA_OK, AGENCIA_SIN, DIRECTO, DIRECTO_SOLO]

const prop = (id: string, estatus: string, total: number) => ({ id, clienteId: 'cl1', agenciaId: null, estatus, total })
const PROPUESTAS = [prop('p1', 'BORRADOR', 1000), prop('p2', 'ENVIADA', 2000), prop('p3', 'RECHAZADA', 500), prop('p4', 'APROBADA', 900)]
const camp = (id: string, estadoComercial: string, presupuestoBruto: number | null) => ({
  id, folio: 'CA-0' + id, nombre: 'Verano ' + id, clienteId: 'cl1', propuestaId: null, estadoComercial,
  presupuestoBruto, fechaInicio: '2026-01-01', fechaFin: '2026-03-31',
})
const RESUMEN = [
  { campana: camp('1', 'ACTIVA', 11600), etapa: 'publicada' },
  { campana: camp('2', 'CANCELADA', 3000), etapa: 'reservada' },
  { campana: camp('3', 'ACTIVA', null), etapa: 'confirmada' },
  { campana: camp('4', 'COMPLETADA', null), etapa: 'facturada' },
]

const PROSPECTO = {
  id: 'pr1', tipo: 'CLIENTE', nombre: 'Cafe Luna', etapa: 'CONTACTADO', contacto: { nombre: 'Ana', telefono: '', email: '' },
  direccion: null, datos: { giro: 'Cafeteria', presupuesto: 5000 }, siguientePaso: 'Llamar', siguientePasoFecha: '2020-01-01',
  vendedorNombre: 'Luis', actualizadoEn: '2026-01-02T10:00:00Z', creadoEn: '2026-01-01T10:00:00Z',
  motivoRechazo: null, decididoPorNombre: null,
}
const PAGINA = {
  prospectos: [PROSPECTO, { ...PROSPECTO, id: 'pr2', tipo: 'PREDIO', nombre: 'Azotea Reforma', etapa: 'VISITA', siguientePaso: null, siguientePasoFecha: null }],
  porEtapa: { PROSPECTO: 1, CONTACTADO: 3, VISITA: 1, NEGOCIACION: 0, EN_REVISION: 2, APROBADO: 4, RECHAZADO: 1, PERDIDO: 0 },
  total: 60, porPagina: 25, puedeAprobar: true,
}
const avance = (id: string, etapaAnterior: string | null, etapaNueva: string, nota: string) => ({
  id, creadoEn: '2026-01-02T10:00:00Z', usuarioNombre: id === 'a2' ? null : 'Luis', etapaAnterior, etapaNueva, nota,
})
const DETALLE = {
  ...PROSPECTO, id: 'pr3', tipo: 'PREDIO', nombre: 'Azotea Reforma', etapa: 'VISITA', direccion: null,
  datos: { m2: 120, notas: 'Tiene vista' }, siguientePasoFecha: '2026-02-01',
  avances: [avance('a1', null, 'PROSPECTO', 'Alta'), avance('a2', 'PROSPECTO', 'VISITA', 'Fuimos'), avance('a3', 'VISITA', 'VISITA', 'Nota')],
}

// ─── El arnes ───────────────────────────────────────────────────────────────
function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** El n-esimo `useState` (desde 1) cuyo valor inicial cumple `pred` y que sale de `componente`. */
function enesimo(componente: string, pred: (v: unknown) => boolean, n = 1) {
  let vistos = 0
  return (v: unknown, pila: string) => {
    if (!pila.includes(componente) || !pred(v)) return false
    vistos += 1
    return vistos === n
  }
}
const forzar = (si: Forzado['si'], valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esFalse = (v: unknown) => v === false

const clientesPagina = async () => (await import('../../app/(app)/(shell)/clientes/page')).default
const comisionesPagina = async () => (await import('../../app/(app)/(shell)/comisiones/page')).default
const captacionPagina = async () => (await import('../../app/(app)/(shell)/captacion/page')).default

type Estado = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[] }

const ESTADOS: Estado[] = [
  {
    nombre: 'clientes · la lista',
    pintar: async (idioma) => pintar(idioma, createElement(await clientesPagina())),
    espanol: [
      'Catálogo de clientes y sus datos fiscales', 'Nuevo cliente', 'Lista de clientes', '5 clientes',
      'placeholder="Nombre, RFC o razón social…"', 'aria-label="Buscar cliente"', 'Directos y agencias', 'Solo agencias',
      'Razón social', 'En pipeline', 'Campañas en curso', 'Negociación sin validar', 'Negociación validada',
      'Sin contacto', 'title="Ver pipeline y campañas"', 'title="Borrador + enviadas, con IVA"',
      'aria-label="Editar Andina Media"', 'title="Borrar cliente"', '>Agencia<', '>Directo<',
    ],
    ingles: [
      'Client catalog and tax details', 'New client', 'Client list', '5 clients', 'Legal name', 'In pipeline',
      'Active campaigns', 'Negotiation not validated', 'Negotiation validated', 'No contact', 'Edit Andina Media',
      'Agency', 'Direct',
    ],
  },
  {
    nombre: 'clientes · vacia',
    pintar: async (idioma) => {
      datos.clientes = []
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: ['Aún no hay clientes. Da de alta el primero con «Nuevo cliente».'],
    ingles: ['No clients yet. Add the first one with “New client”.'],
  },
  {
    nombre: 'clientes · un filtro sin resultados',
    pintar: async (idioma) => {
      forzar(enesimo('ClientesPage', (v) => v === ''), 'zzz')
      forzar(enesimo('ClientesPage', (v) => v === ''), 'AGENCIA')
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: ['0 de 5', 'Ningún cliente coincide con «zzz» entre las agencias. Quita el filtro para ver los 5.'],
    ingles: ['0 of 5', 'No client matches “zzz” among agencies. Clear the filter to see all 5.'],
  },
  {
    nombre: 'clientes · alta de una agencia con negociacion',
    pintar: async (idioma) => {
      forzar(enesimo('ClientesPage', esFalse), true) // nuevoOpen
      forzar(enesimo('ClienteDialog', (v) => v === 'DIRECTO'), 'AGENCIA')
      forzar(enesimo('ClienteDialog', esFalse), true) // tieneNegociacion
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: [
      'Datos generales y fiscales (para facturar)', 'Nombre del cliente', 'Correo de contacto', 'Teléfono',
      'Comisión de la agencia (%)', 'IVA (%)',
      'Se elige del catálogo de IVAs (Administración → Configuración). Se aplica al facturar y al presupuesto de sus campañas.',
      'Negociación con la agencia', '¿Hay negociación con la agencia?', 'Términos de la negociación',
      'placeholder="p. ej. comisión especial 18%, condiciones de pago a 60 días…"',
      'Mientras no esté validada, no se pueden crear ni aprobar propuestas con esta agencia.',
      'Datos fiscales', 'C.P. fiscal', 'Régimen fiscal', 'Uso de CFDI', '— Selecciona —', 'Cancelar', 'Guardar',
    ],
    ingles: [
      'General and tax details (for invoicing)', 'Client name', 'Contact email', 'Phone', 'Agency commission (%)',
      'VAT (%)', 'Negotiation with the agency', 'Is there a negotiation with the agency?', 'Negotiation terms',
      'Tax details', 'Tax ZIP code', 'Tax regime', 'CFDI use', '— Select —', 'Cancel', 'Save',
    ],
  },
  {
    nombre: 'clientes · borrar, con la contrasena',
    pintar: async (idioma) => {
      forzar(enesimo('ClientesPage', esNull, 2), AGENCIA) // borrar
      forzar(enesimo('BorrarClienteDialog', esFalse), true) // reautenticando
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: ['Borrar Andina Media', 'Esta acción no se puede deshacer', 'Borrar un cliente es irreversible, así que hace falta tu contraseña.', 'Tu contraseña', 'Confirmar y borrar'],
    ingles: ['Delete Andina Media', 'This action can’t be undone', 'Deleting a client is irreversible, so your password is required.', 'Your password', 'Confirm and delete'],
  },
  {
    nombre: 'clientes · borrar, el primer paso',
    pintar: async (idioma) => {
      forzar(enesimo('ClientesPage', esNull, 2), AGENCIA)
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: ['Se borrará <span class="text-ink">Andina Media</span> (<span class="demo-num">AND010101AB1</span>).', '>Borrar<'],
    ingles: ['<span class="text-ink">Andina Media</span> (<span class="demo-num">AND010101AB1</span>) will be deleted.', '>Delete<'],
  },
  {
    nombre: 'clientes · la ficha con pipeline y campanas',
    pintar: async (idioma) => {
      forzar(enesimo('ClientesPage', esNull, 3), DIRECTO) // ver
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: [
      'Directo · pipeline y campañas', 'Montos con IVA · en pipeline', 'tasa de cierre histórica', 'Campaña en curso',
      'Terminada', 'Fuera del embudo:', '1 propuesta rechazada', '1 campaña cancelada', '—, sin monto',
      'title="monto sin capturar"', 'Sin presupuesto', '01/01/2026–31/03/2026',
    ],
    ingles: [
      'Direct · pipeline and campaigns', 'Amounts incl. VAT · in pipeline', 'historical close rate', 'Active campaign',
      'Finished', 'Outside the funnel:', '1 rejected proposal', '1 cancelled campaign', '—, no amount', 'No budget',
      'Jan 1, 2026–Mar 31, 2026',
    ],
  },
  {
    nombre: 'clientes · un cliente sin campanas',
    pintar: async (idioma) => {
      datos.resumen = []
      forzar(enesimo('ClientesPage', esNull, 3), DIRECTO_SOLO)
      return pintar(idioma, createElement(await clientesPagina()))
    },
    espanol: ['Este cliente aún no tiene campañas.'],
    ingles: ['This client has no campaigns yet.'],
  },
  {
    nombre: 'comisiones · agencias y clientes',
    pintar: async (idioma) => pintar(idioma, createElement(await comisionesPagina())),
    espanol: [
      'Ajusta la comisión por agencia y la agencia asignada a cada cliente.', 'Agencias', 'Clientes sin agencia',
      'Sin validar, no se pueden crear ni aprobar propuestas con esa agencia', 'Agencias y su comisión', 'Nueva agencia',
      'Comisión aplicada', 'Sin negociación', 'Validada', 'Quitar', 'Sin validar', 'Validar', '— Selecciona agencia —',
      'Clientes y su agencia', 'aria-label="Comisión de Andina Media (%)"',
    ],
    ingles: [
      'Set the commission for each agency and the agency assigned to each client.', 'Agencies', 'Clients without an agency',
      'Agencies and their commission', 'New agency', 'Applied commission', 'No negotiation', 'Validated', 'Remove',
      'Not validated', 'Validate', '— Select agency —', 'Clients and their agency', 'Andina Media commission (%)',
    ],
  },
  {
    nombre: 'comisiones · sin permiso de editar',
    pintar: async (idioma) => {
      datos.puede = false
      return pintar(idioma, createElement(await comisionesPagina()))
    },
    espanol: ['Directo · sin comisión', 'title="Cliente sin agencia asignada"'],
    ingles: ['Direct · no commission', 'Client with no agency assigned'],
  },
  {
    nombre: 'comisiones · sin agencias ni directos',
    pintar: async (idioma) => {
      datos.clientes = []
      return pintar(idioma, createElement(await comisionesPagina()))
    },
    espanol: ['Aún no hay agencias', 'Usa «Nueva agencia» para crear una.', 'No hay clientes directos'],
    ingles: ['No agencies yet', 'Use “New agency” to create one.', 'No direct clients'],
  },
  {
    nombre: 'comisiones · sin agencias, sin permiso',
    pintar: async (idioma) => {
      datos.clientes = []
      datos.puede = false
      return pintar(idioma, createElement(await comisionesPagina()))
    },
    espanol: ['Cuando se dé de alta una agencia aparecerá aquí.'],
    ingles: ['Once an agency is added, it will show up here.'],
  },
  {
    nombre: 'comisiones · alta de una agencia',
    pintar: async (idioma) => {
      forzar(enesimo('ComisionesPage', esFalse), true)
      forzar(enesimo('NuevaAgenciaDialog', esFalse), true) // tieneNeg
      return pintar(idioma, createElement(await comisionesPagina()))
    },
    espanol: [
      'Alta de cliente tipo Agencia con su comisión', 'Crear agencia', 'Nombre de la agencia', 'placeholder="p. ej. Andina Media"',
      'placeholder="Términos negociados (comisión especial, condiciones de pago…)"',
      'Sin validar, no se pueden crear ni aprobar propuestas con esta agencia.',
    ],
    ingles: ['Add an agency-type client with its commission', 'Create agency', 'Agency name', 'e.g. Andina Media', 'Negotiated terms (special commission, payment terms…)'],
  },
  {
    nombre: 'captacion · la lista, con paginas',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: [
      'Clientes, arrendadores, predios y pantallas que se están trabajando, con la bitácora de cada uno. Cuando uno está listo se envía a revisión, y al aprobarlo se da de alta.',
      'En curso', 'Por aprobar', 'Cerrados', 'Todos los tipos', 'Nuevo prospecto', 'Prospectos', 'Siguiente paso',
      'Actualizado', 'Contactado', 'Visita', 'Predio', 'vencido hace', 'Anterior', 'Página 1 de 3 · 60 prospectos',
    ],
    ingles: [
      'Clients, landlords, properties and screens being worked on, each with its log. When one is ready it is sent for review, and once approved it is added.',
      'In progress', 'Pending approval', 'Closed', 'All types', 'New prospect', 'Prospects', 'Next step', 'Updated',
      'Contacted', 'Visit', 'Property', 'overdue by', 'Previous', 'Page 1 of 3 · 60 prospects',
    ],
  },
  {
    nombre: 'captacion · por aprobar, sin permiso y vacia',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', (v) => v === 'curso'), 'revision')
      forzar(enesimo('Captacion', esNull), { ...PAGINA, prospectos: [], puedeAprobar: false })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Estos esperan a que un gerente, director o administrador los revise.', 'Nada espera aprobación.'],
    ingles: ['These are waiting for a manager, director or admin to review them.', 'Nothing is waiting for approval.'],
  },
  {
    nombre: 'captacion · en curso vacia',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), { ...PAGINA, prospectos: [] })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['No hay prospectos en curso. Da de alta el primero con «Nuevo prospecto».'],
    ingles: ['No prospects in progress. Add the first one with “New prospect”.'],
  },
  {
    nombre: 'captacion · alta de un predio',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull, 4), { valor: { tipo: 'PREDIO', nombre: '', contacto: {}, direccion: '', datos: {}, siguientePaso: '', siguientePasoFecha: '', nota: '' } })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: [
      'Captura lo que tengas; lo mínimo para enviarlo a revisión se pide al enviarlo.', '¿Qué estás captando?',
      'Dueño del terreno (se dará de alta como arrendador al aprobar)', 'aria-label="Nombre del contacto"', 'Dirección',
      'Tipo de ubicación (azotea, terreno…)', 'Metros cuadrados', 'Renta que piden (MXN / mes)', 'Notas',
      'placeholder="Ej. llamar para agendar visita"', '¿Para cuándo?', 'Primera nota de la bitácora',
      'placeholder="Cómo surgió este prospecto"', 'Arrendador', 'Pantalla',
    ],
    ingles: [
      'Enter what you have; the minimum needed for review is asked for when you send it.', 'What are you prospecting?',
      'Land owner (added as a landlord on approval)', 'Contact name', 'Address', 'Location type (rooftop, lot…)',
      'Square meters', 'Asking rent (MXN / month)', 'Notes', 'E.g. call to schedule a visit', 'By when?',
      'First log note', 'How this prospect came up', 'Landlord', 'Screen',
    ],
  },
  {
    nombre: 'captacion · editar una pantalla',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull, 4), { id: 'x', valor: { tipo: 'PANTALLA', nombre: 'Sitio', contacto: {}, direccion: '', datos: {}, siguientePaso: '', siguientePasoFecha: '' } })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Editar prospecto', 'El tipo no se cambia: decide qué registro se crea al aprobar.', 'placeholder="Nombre de la ubicación"', 'Ancho (m)', 'Alto (m)', 'Caras', 'Estática'],
    ingles: ['Edit prospect', 'The type can’t be changed: it decides which record is created on approval.', 'Location name', 'Width (m)', 'Height (m)', 'Faces', 'Static'],
  },
  {
    nombre: 'captacion · un prospecto abierto, pidiendo revision',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), DETALLE) // abierto
      forzar(enesimo('Detalle', (v) => v === 'VISITA'), 'EN_REVISION')
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: [
      'Etapa', 'Vendedor', 'Contacto', ' · para el 01/02/2026', 'Editar datos', 'Registrar avance', 'Qué pasó',
      'aria-label="Fecha del siguiente paso"', 'Para enviarlo a revisión falta: la dirección, el dueño: un arrendador existente o el nombre y teléfono del contacto.',
      'Guardar avance', 'Bitácora', 'Usuario eliminado', 'Visita (solo una nota)', 'Tiene vista',
    ],
    ingles: [
      'Stage', 'Sales rep', 'Contact', ' · by Feb 1, 2026', 'Edit details', 'Record update', 'What happened',
      'Next step date', 'To send it for review, it still needs: the address, the owner: an existing landlord or the contact’s name and phone.',
      'Save update', 'Log', 'Deleted user', 'Visit (note only)', 'Tiene vista',
    ],
  },
  {
    nombre: 'captacion · en revision, para quien aprueba',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, tipo: 'CLIENTE', etapa: 'EN_REVISION' })
      forzar(enesimo('Detalle', esFalse), true) // duplicado
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Revisión', 'Al aprobar se da de alta el cliente.', 'Aprobar', 'Es otro distinto: aprobar de todos modos', 'placeholder="Motivo del rechazo (lo lee el vendedor)"', 'Rechazar'],
    ingles: ['Review', 'Approving adds the client.', 'Approve', 'It’s a different one: approve anyway', 'Reason for rejection (the sales rep reads it)', 'Reject'],
  },
  {
    nombre: 'captacion · un predio en revision',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, etapa: 'EN_REVISION' })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Al aprobar se da de alta el predio (y su arrendador, si es nuevo).'],
    ingles: ['Approving adds the property (and its landlord, if new).'],
  },
  {
    nombre: 'captacion · una pantalla en revision',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, tipo: 'PANTALLA', etapa: 'EN_REVISION' })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Al aprobar se da de alta nada todavía: la pantalla se completa en Inventario.'],
    ingles: ['Approving doesn’t add anything yet: the screen is completed in Inventory.'],
  },
  {
    nombre: 'captacion · rechazado',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, etapa: 'RECHAZADO', motivoRechazo: 'Caro', decididoPorNombre: 'Eva' })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Rechazado por Eva:'],
    ingles: ['Rejected by Eva:'],
  },
  {
    nombre: 'captacion · aprobados',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, tipo: 'ARRENDADOR', etapa: 'APROBADO', decididoPorNombre: 'Eva' })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Aprobado por Eva.', 'El arrendador ya existe en el sistema.'],
    ingles: ['Approved by Eva.', 'The landlord already exists in the system.'],
  },
  {
    nombre: 'captacion · una pantalla aprobada',
    pintar: async (idioma) => {
      forzar(enesimo('Captacion', esNull), PAGINA)
      forzar(enesimo('Captacion', esNull, 2), { ...DETALLE, tipo: 'PANTALLA', etapa: 'APROBADO' })
      return pintar(idioma, createElement(await captacionPagina()))
    },
    espanol: ['Falta darla de alta en Inventario con sus medidas y tarifas.'],
    ingles: ['It still has to be added in Inventory with its dimensions and rates.'],
  },
]

const htmlIngles: string[] = []

describe('lote CLIENTES · en ESPANOL sale el texto de siempre', () => {
  ESTADOS.forEach((e, i) => {
    it(e.nombre, async () => {
      const crudo = await e.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(e.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

describe('lote CLIENTES · en INGLES no queda ninguna frase espanola', () => {
  for (const e of ESTADOS) {
    it(e.nombre, async () => {
      const html = texto(await e.pintar('en'))
      htmlIngles.push(html)
      // Las frases que son iguales en los dos idiomas no cuentan como espanol.
      const soloEspanol = e.espanol.filter((f) => !e.ingles.includes(f))
      expect(soloEspanol.filter((f) => html.includes(f))).toEqual([])
      expect(e.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote CLIENTES · barrido del diccionario contra el HTML ingles', () => {
  it('ningun texto espanol del lote (de 4 letras o mas) aparece en ingles', () => {
    expect(htmlIngles.length).toBe(ESTADOS.length)
    const todo = htmlIngles.join('\n')
    const es = ES_CLIENTES as Record<string, string>
    const en = EN_CLIENTES as Record<string, string>
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fugas = Object.keys(es).filter((k) => {
      const frase = es[k].replace(/\{\w+\}/g, '').trim()
      if (frase.length < 4 || frase === en[k]) return false
      // Cada trozo entre huecos, como palabra completa.
      return es[k].split(/\{\w+\}/).map((t) => t.trim()).filter((t) => t.length >= 4)
        .some((t) => new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(todo))
    })
    expect(fugas).toEqual([])
  })

  it('el diccionario del lote esta en el diccionario de la aplicacion', () => {
    for (const k of Object.keys(ES_CLIENTES)) expect((DICCIONARIOS.en as Record<string, string>)[k]).toBeTypeOf('string')
  })
})

describe('costura · los MODULOS COMPARTIDOS y los espejos de Campañas en Clientes', () => {
  it('ninguna frase espanola de compartidos ni de las etiquetas de campaña que se reusan aparece en ingles', async () => {
    // La ficha del cliente pinta estatus y etapas de campaña con las claves de
    // Campañas (`CLAVE_ESTADO_CAMPANA`, `CLAVE_ETAPA`) y el borrado usa la
    // contrasena de compartidos. Una llamada sin `t` dejaria su espanol a la
    // vista sin que lo viera el barrido del lote. Umbral de 4 letras y palabra
    // entera, como en `pantallas-comercial.test.ts`.
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const { ES_CAMPANAS, EN_CAMPANAS } = await import('./textos/campanas')
    const es: Record<string, string> = { ...ES_COMPARTIDOS }
    const en: Record<string, string> = { ...EN_COMPARTIDOS }
    for (const k of Object.keys(ES_CAMPANAS)) {
      if (k.startsWith('campanas.estado.') || k.startsWith('campanas.etapa.')) {
        es[k] = (ES_CAMPANAS as Record<string, string>)[k]
        en[k] = (EN_CAMPANAS as Record<string, string>)[k]
      }
    }
    const todo = htmlIngles.join('\n')
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    for (const [clave, frase] of Object.entries(es)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en[clave].includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(todo)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})

// ─── El dinero: el simbolo de la moneda de la INSTANCIA (dueno, 2026-11-02) ──
// Mismo arnes que `pantallas-comercial.test.ts`: con las DOS monedas y en los
// DOS idiomas, cada importe pintado lleva el simbolo de la tabla de
// `lib/i18n/dinero.ts` (en ingles, una instancia MXN escribe `MX$`).
describe('lote CLIENTES · cada importe lleva el simbolo de la moneda de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  const vistos: Record<string, number> = {}
  for (const moneda of MONEDAS) {
    for (const idioma of ['es', 'en'] as const) {
      ESTADOS.forEach((e) => {
        it(`${moneda} · ${idioma} · ${e.nombre}`, async () => {
          fijarMonedaInstancia(moneda)
          const { importes, ajenos } = leerDinero(texto(await e.pintar(idioma)), idioma, moneda)
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
