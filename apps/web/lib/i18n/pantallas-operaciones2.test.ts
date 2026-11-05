import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'
import { ES_OPERACIONES2, EN_OPERACIONES2, IT_OPERACIONES2, PT_OPERACIONES2 } from './textos/operaciones2'
import { huellasEnPortugues } from './guardias-portugues'
import { culpablesEnItaliano } from '../test/barrido-italiano'
import { huellasEnItaliano } from './guardias-italiano'
import { legible, fugasEnItaliano } from '../test/italiano-l3'

// ============================================================================
//  I18N · LOTE «OPERACIONES (parte 2)», RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  La lista de ordenes de trabajo (`/operaciones`), el alta de una OT, la ficha
//  de una OT (`OTVista`, embebida y movil) y Creativos. El mismo patron que
//  `pantallas-catalogos.test.ts`: el componente REAL dentro del proveedor,
//  `renderToStaticMarkup`, y
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Sin DOM no corren los `useEffect` (la ficha pide la OT en uno), asi que se
//  FUERZA el valor inicial de `useState`. Cada entrada de la cola es un
//  predicado sobre el valor inicial y sobre la PILA (el nombre del componente
//  que llama), y se consume en orden.
//
//  Cada estado importa su pagina PRIMERO y fuerza DESPUES, justo antes de
//  rendir (leccion del validador de clientes): la cola es una sola para todo
//  el archivo, y si los forzados entran antes del `await import(...)`, un
//  estado que agota el tiempo deja un render vivo que se come los forzados del
//  siguiente — fallos que salen solo a veces.
//
//  Con `I18N_VOLCAR=<carpeta>` vuelca el HTML espanol de cada estado: se corre
//  antes y despues de tocar los componentes y se compara con `diff -rq`.
//
//  LO QUE NO VE: el error del autoguardado del checklist (lo manda el
//  servidor), los nombres de las cuadrillas de la demo y los puntos del
//  checklist (son datos), `FotoUploaderMock` (compartido, de otro lote) y los
//  mensajes del servidor (I18N-05).
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))
const datos = vi.hoisted(() => ({
  ots: undefined as unknown,
  sitios: [] as unknown[],
  campanas: [] as unknown[],
  evidencias: [] as unknown[],
  reservas: [] as unknown[],
  usuarios: [] as unknown[],
  creativos: undefined as unknown,
  clientes: [] as unknown[],
  puede: true,
}))

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
  usePathname: () => '/operaciones',
  useSearchParams: () => new URLSearchParams(''),
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
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never,
      createElement('button', null, p.confirmLabel ?? 'Confirmar')) : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never,
      p.accion as never, p.children as never),
}))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => datos.puede }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useOrdenesTrabajo: () => datos.ots,
    useSitios: () => datos.sitios,
    useCampanas: () => datos.campanas,
    useEvidencias: () => datos.evidencias,
    useReservas: () => datos.reservas,
    useUsuarios: () => datos.usuarios,
    useCreatividades: () => datos.creativos,
    useClientes: () => datos.clientes,
  }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.ots = undefined
  datos.sitios = []
  datos.campanas = []
  datos.evidencias = []
  datos.reservas = []
  datos.usuarios = []
  datos.creativos = undefined
  datos.clientes = []
  datos.puede = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 2, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
function enesimo(componente: string, pred: (v: unknown) => boolean, n = 1) {
  let vistos = 0
  return (v: unknown, pila: string) => {
    if (!pila.includes(componente) || !pred(v)) return false
    vistos += 1
    return vistos === n
  }
}
const forzar = (si: Forzado['si'], valor: unknown) => forzado.cola.push({ si, valor })
const esFalse = (v: unknown) => v === false
const esIndefinido = (v: unknown) => v === undefined
const esVacio = (v: unknown) => Array.isArray(v) && v.length === 0
const esNull = (v: unknown) => v === null
const esCadenaVacia = (v: unknown) => v === ''
const esGuardado = (v: unknown) => !!v && typeof v === 'object' && 'pendientes' in (v as object)

// ─── Datos de prueba ────────────────────────────────────────────────────────
const ot = (id: string, extra: Record<string, unknown> = {}) => ({
  id, folio: `OT-${id}`, tipo: 'INSPECCION', sitioId: 's1', descripcion: `Revisar estructura ${id}`, instrucciones: null,
  checklist: [], prioridad: 'NORMAL', asignadoAUserId: null, supervisorUserId: null, fechaProgramada: '2026-11-20',
  fechaInicio: null, fechaCompletada: null, campanaId: 'c1', estatus: 'PENDIENTE', requiereRevision: false, notas: null,
  creadoEn: '2026-10-01', costoReal: null, ...extra,
})
const OTS = [
  ot('1', { prioridad: 'URGENTE', fechaProgramada: '2026-10-20', tipo: 'MONTAJE_LONA' }),
  ot('2', { fechaProgramada: '2026-11-03', asignadoAUserId: 'u1', estatus: 'ASIGNADA', tipo: 'MANTENIMIENTO_CORRECTIVO' }),
  ot('3', { prioridad: 'ALTA', estatus: 'EN_PROCESO', tipo: 'ELECTRICO' }),
  ot('4', { estatus: 'COMPLETADA', fechaCompletada: '2026-10-05T10:00:00Z', tipo: 'DESMONTAJE' }),
]
const OTS_UNA_VENCIDA = [ot('1', { fechaProgramada: '2026-10-20' })]
const SITIOS = [
  { id: 's1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL' },
  { id: 's2', nombre: 'Valla Sur', tipoMedio: 'VALLA' },
]
const CAMPANAS = [{ id: 'c1', nombre: 'Verano' }, { id: 'c2', nombre: 'Otoño' }]
const USUARIOS = [{ id: 'u1', nombre: 'Luisa Campo', activo: true, rol: 'OPERACIONES' }]
const EVIDENCIAS = [{ id: 'e1', otId: '1' }, { id: 'e2', otId: '1' }, { id: 'e3', otId: '2' }]

const FICHA_CAMPANA = { id: 'c1', nombre: 'Verano', tipoCampana: 'DOOH', ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true }
const FICHA_SITIO = { id: 's1', nombre: 'Pantalla Reforma', direccion: 'Av. Reforma 1', lat: 19.4, lng: -99.1 }
const CHECKLIST = [{ label: 'Inspección de estructura y herrajes', hecho: true }, { label: 'Montaje / ejecución', hecho: false }]
const fichaAbierta = (extra: Record<string, unknown> = {}) => ({
  ot: ot('1', { checklist: CHECKLIST, prioridad: 'URGENTE', fechaProgramada: '2026-10-20', ...extra }),
  sitio: FICHA_SITIO, campana: FICHA_CAMPANA, evidencias: [], responsable: null, puedeEditar: false,
})
const fichaCerrada = (costoReal: number | null) => ({
  ot: ot('1', { checklist: CHECKLIST, estatus: 'COMPLETADA', fechaCompletada: '2026-10-05T16:30:00Z', costoReal }),
  sitio: FICHA_SITIO, campana: FICHA_CAMPANA, evidencias: [{ fotoUrl: 'data:image/png;base64,AAA' }], responsable: 'Luisa Campo',
})

const operaciones = async () => (await import('../../app/(app)/(shell)/operaciones/page')).default
const vista = async () => (await import('../../components/operaciones/OTVista')).OTVista

type Estado = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[]; dinero?: boolean }

export const ESTADOS_OT: Estado[] = [
  {
    nombre: 'operaciones · cargando',
    pintar: async (idioma) => {
      const Pagina = await operaciones()
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Operaciones', 'Tareas de cuadrilla · seguimiento de campo', 'Nueva OT', 'Órdenes de trabajo', 'Todas', 'Pendientes', 'Asignadas', 'En proceso', 'Completadas'],
    ingles: ['Operations', 'Crew tasks · field tracking', 'New work order', 'Work orders', '>All<', '>Pending<', '>Assigned<', '>In progress<', '>Completed<'],
  },
  {
    nombre: 'operaciones · con OT, aviso de SLA y filtros',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = OTS
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.usuarios = USUARIOS
      datos.evidencias = EVIDENCIAS
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Abiertas', '1 en proceso', 'Vencidas', 'frenan el candado de facturación', 'Por vencer',
      'compromiso en 2 días o menos', 'Sin asignar', 'abiertas sin responsable',
      '1 OT vencida', '1 por vencer', '— una OT abierta que pasó su fecha compromiso frena el candado de facturación.',
      '4 de 4', 'Montaje de lona', 'Mantenimiento correctivo', 'Eléctrico', 'Desmontaje',
      'Urgente', 'Alta', 'title="Fecha compromiso"', 'title="Abrir OT"', 'title="Ver OT"', ' Vencida</span>',
      'title="2 evidencias"', 'title="1 evidencia"', 'Pendiente', 'Asignada', 'En proceso', 'Completada',
      'Luisa Campo', '20/10/2026',
    ],
    ingles: [
      '>Open<', '1 in progress', '>Overdue<', 'keeping the billing lock closed', 'Due soon', 'due in 2 days or less',
      'Unassigned', 'open with no assignee', '1 overdue work order', '1 due soon',
      '— an open work order past its due date keeps the billing lock closed.', '4 of 4', 'Vinyl installation',
      'Corrective maintenance', 'Electrical', 'Removal', 'Urgent', '>High<', 'title="Due date"', 'title="Open work order"',
      'title="View work order"', ' Overdue</span>', 'title="2 evidence photos"', 'title="1 evidence photo"', 'Oct 20, 2026',
    ],
  },
  {
    nombre: 'operaciones · varias vencidas y lista larga',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = [...Array.from({ length: 26 }, (_, i) => ot(`v${i}`, { fechaProgramada: '2026-10-01' }))]
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['26 OT vencidas', 'Ver todas (26)'],
    ingles: ['26 overdue work orders', 'Show all (26)'],
  },
  {
    nombre: 'operaciones · lista larga desplegada',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = [...Array.from({ length: 26 }, (_, i) => ot(`v${i}`, { fechaProgramada: '2026-12-01' }))]
      forzar(enesimo('OperacionesPage', esFalse, 2), true) // verTodas
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ver menos'],
    ingles: ['Show less'],
  },
  {
    nombre: 'operaciones · sin OT',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Todavía no hay órdenes de trabajo', 'Crea la primera con «Nueva OT»: se liga a una campaña y a su pantalla.', '0 de 0'],
    ingles: ['No work orders yet', 'Create the first one with “New work order”: it is linked to a campaign and its screen.', '0 of 0'],
  },
  {
    nombre: 'operaciones · filtro sin resultados',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = OTS_UNA_VENCIDA
      forzar(enesimo('OperacionesPage', esCadenaVacia), 'COMPLETADA')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ninguna OT en «Completadas»', 'Las demás siguen en «Todas».', 'Ver todas'],
    ingles: ['No work orders in “Completed”', 'The rest are still under “All”.', 'Show all'],
  },
  {
    nombre: 'operaciones · alta de OT con campaña y pantalla',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.usuarios = USUARIOS
      datos.reservas = [{ campanaId: 'c1', sitioId: 's1' }]
      forzar(enesimo('OperacionesPage', esFalse, 1), true) // nuevaOpen
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's1') // sitioId
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 1), 'c1') // campanaId (el contador empieza tras sitioId)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Nueva orden de trabajo', 'Asigna una tarea a cuadrilla', 'Cancelar', 'Crear OT', 'Campaña', '— Sin campaña —',
      'Pantalla<span', '(auto por campaña)', '— Sin pantalla —', 'Pantalla Reforma · Digital', 'Tipo de tarea',
      '(opciones de pantalla digital)', 'Inspección', 'Mantenimiento preventivo', 'Descripción',
      'placeholder="p. ej. Montaje de lona en espectacular…"', 'Prioridad', 'Baja', 'Normal', 'Alta', 'Urgente',
      'Fecha compromiso', 'Asignar a (responsable)', '— Sin asignar —', 'Luisa Campo',
    ],
    ingles: [
      'New work order', 'Assign a task to a crew', 'Cancel', 'Create work order', 'Campaign', '— No campaign —', 'Screen',
      '(set by the campaign)', '— No screen —', 'Pantalla Reforma · Digital', 'Task type', '(options for a digital screen)',
      'Inspection', 'Preventive maintenance', 'Description', 'placeholder="e.g. Vinyl installation on a billboard…"',
      'Priority', '>Low<', '>High<', 'Urgent', 'Due date', '>Assign to<', '— Unassigned —',
    ],
  },
  {
    nombre: 'operaciones · alta de OT con pantalla fija y campaña sin sitios',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.reservas = [{ campanaId: 'c9', sitioId: 's2' }]
      forzar(enesimo('OperacionesPage', esFalse, 1), true)
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's2')
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 1), 'c2')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Esta campaña no tiene sitios reservados.'],
    ingles: ['This campaign has no booked sites.'],
  },
  {
    nombre: 'operaciones · alta de OT sin campaña, con pantalla fija',
    pintar: async (idioma) => {
      const Pagina = await operaciones() // primero la pagina, despues los forzados
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      forzar(enesimo('OperacionesPage', esFalse, 1), true)
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's2')
      forzar(enesimo('NuevaOTModal', esFalse, 1), true) // enviando
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Valla Sur · Fija', '(opciones de pantalla fija)', 'Montaje de lona', 'Herrería', 'Creando…'],
    ingles: ['Valla Sur · Static', '(options for a static screen)', 'Vinyl installation', 'Metalwork', 'Creating…'],
  },
  // ── La ficha de una OT ──
  {
    nombre: 'ficha · no se pudo cargar',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), null)
      return pintar(idioma, createElement(Pagina, { id: 'x', embedded: true }))
    },
    espanol: ['No se pudo cargar la orden de trabajo.', 'Inicia sesión para continuar'],
    ingles: ['Could not load the work order.', 'Sign in to continue'],
  },
  {
    nombre: 'ficha · escritorio abierta, solo lectura y error de guardado',
    dinero: true,
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), fichaAbierta({ costoReal: 1500 }))
      forzar(enesimo('OTVista', esVacio), [true, false]) // checks
      forzar(enesimo('OTVista', esGuardado), { estado: 'error', error: 'error-del-servidor', pendientes: 1 })
      return pintar(idioma, createElement(Pagina, { id: '1', embedded: true }))
    },
    espanol: [
      ' Operaciones</a>', 'Revisar estructura 1', 'OT-1 · Pantalla Reforma', 'Av. Reforma 1', 'Pendiente', '>Tipo<',
      '>Inspección<', '>Prioridad<', 'Urgente', '>Compromiso<', '20/10/2026', '>Vencida<', '>Responsable<',
      '>Sin asignar<', '>Campaña<', 'Verano', '>Checklist<',
      'Error al guardar: error-del-servidor. Lo tachado se ve aquí pero aún NO está guardado.', 'Reintentar',
      'Solo lectura: tu rol puede ver esta orden de trabajo, pero no marcar su checklist.',
      'Inspección de estructura y herrajes', 'Fotografía comprobatoria', 'Tomar foto', 'Sello de ubicación',
      'Capturar ubicación', 'Al cerrarla, el costo de $ 1,500.00 queda fijo: ya no se podrá cambiar.', 'Cerrar OT',
      'Completa el checklist, toma una foto y captura la ubicación.', 'Costo real de esta visita',
      'Lo que de verdad costó. <strong>Sustituye</strong> a la estimación por tipo de tarea que usa el reporte de rentabilidad, no se suma a ella. Déjalo vacío si no lo sabes: entonces el reporte sigue usando la estimación y te lo dice.',
      'placeholder="Sin capturar"', 'aria-label="Costo real de esta visita"', 'Guardar costo', 'Guardado: <span class="demo-num">$1,500</span>',
    ],
    ingles: [
      ' Operations</a>', '>Inspection<', '>Type<', '>Priority<', 'Urgent', '>Due date<', 'Oct 20, 2026', '>Overdue<',
      '>Assignee<', '>Unassigned<', '>Campaign<', '>Checklist<',
      'Error while saving: error-del-servidor. What you checked off shows here but is NOT saved yet.', 'Retry',
      'Read only: your role can see this work order but cannot check off its checklist.', 'Proof photo', 'Take photo',
      // Ola 6 · los puntos de la lista POR OMISION de una OT nueva (dato guardado
      // en espanol) se pintan en ingles; lo que escribe el usuario, no.
      'Structure and hardware inspection', 'Installation / execution',
      'Location stamp', 'Capture location', 'Once closed, the cost of MX$ 1,500.00 is final: it can’t be changed.',
      'Close work order', 'Complete the checklist, take a photo and capture the location.', 'Actual cost of this visit',
      'What it really cost. It <strong>replaces</strong> the per-type estimate that the profitability report uses; it is not added to it.',
      'placeholder="Not entered"', 'aria-label="Actual cost of this visit"', 'Save cost', 'Saved: <span class="demo-num">MX$1,500</span>',
    ],
  },
  {
    nombre: 'ficha · escritorio sin costo, guardando y con cero',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), fichaAbierta({ fechaProgramada: '2026-11-03', prioridad: 'ALTA' }))
      forzar(enesimo('OTVista', esFalse, 1), true) // cerrando
      forzar(enesimo('OTVista', esFalse, 1), true) // guardandoCosto (el contador empieza tras cerrando)
      forzar(enesimo('OTVista', esGuardado), { estado: 'guardando', error: null, pendientes: 1 })
      return pintar(idioma, createElement(Pagina, { id: '1', embedded: true }))
    },
    espanol: [
      'Alta', '>Por vencer<', 'Guardando…', 'Cerrando…',
      'Esta OT no tiene costo capturado. Si la cierras, ya no podrás registrarlo después: el reporte de rentabilidad usará la estimación por tipo de tarea.',
      'Sin capturar: el reporte usa la estimación por tipo de tarea.',
    ],
    ingles: [
      '>High<', '>Due soon<', 'Saving…', 'Closing…',
      'This work order has no cost entered. If you close it, you won’t be able to record it later: the profitability report will use the per-type estimate.',
      'Not entered: the report uses the per-type estimate.',
    ],
  },
  {
    nombre: 'ficha · escritorio con costo cero y guardado',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), { ...fichaAbierta({ costoReal: 0 }), responsable: 'Luisa Campo', puedeEditar: true })
      forzar(enesimo('OTVista', esGuardado), { estado: 'guardado', error: null, pendientes: 0 })
      return pintar(idioma, createElement(Pagina, { id: '1', embedded: true }))
    },
    espanol: [' — esta visita está capturada como que no costó nada.', ' Guardado</span>', 'Luisa Campo'],
    ingles: [' — this visit is recorded as having cost nothing.', ' Saved</span>'],
  },
  {
    nombre: 'ficha · escritorio cerrada con costo',
    dinero: true,
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), fichaCerrada(2300))
      return pintar(idioma, createElement(Pagina, { id: '1', embedded: true }))
    },
    espanol: [
      'OT cerrada', 'La evidencia se envió al pipeline de la campaña.', 'Cerrada el 05/10/2026', 'Checklist cumplido',
      'Candado de facturación encendido', 'alt="evidencia"', 'Costo real de esta visita',
      'Costo registrado: $ 2,300.00. La OT está cerrada y ya no se puede cambiar.', 'Completada',
      'Inspección de estructura y herrajes', 'Montaje / ejecución',
    ],
    ingles: [
      'Work order closed', 'The evidence was sent to the campaign pipeline.', 'Closed on Oct 5, 2026', 'Checklist completed',
      'Billing lock open', 'alt="evidence"', 'Actual cost of this visit',
      'Recorded cost: MX$ 2,300.00. The work order is closed and can no longer be changed.', 'Completed',
      'Structure and hardware inspection', 'Installation / execution',
    ],
  },
  {
    nombre: 'ficha · escritorio cerrada sin costo',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), fichaCerrada(null))
      return pintar(idioma, createElement(Pagina, { id: '1', embedded: true }))
    },
    espanol: ['Se cerró sin costo capturado: el reporte de rentabilidad usa la estimación por tipo de tarea.'],
    ingles: ['It was closed with no cost entered: the profitability report uses the per-type estimate.'],
  },
  {
    nombre: 'ficha · movil abierta',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), { ...fichaAbierta(), responsable: 'Luisa Campo' })
      forzar(enesimo('OTVista', esNull, 1), { lat: 19.4, lng: -99.1 }) // geo
      return pintar(idioma, createElement(Pagina, { id: '1' }))
    },
    espanol: ['Campaña: Verano', 'Responsable: <span class="text-ink">Luisa Campo</span>', ' Operaciones</a>', 'Fotografía comprobatoria'],
    ingles: ['Campaign: Verano', 'Assignee: <span class="text-ink">Luisa Campo</span>', ' Operations</a>', 'Proof photo'],
  },
  {
    nombre: 'ficha · movil cerrada',
    pintar: async (idioma) => {
      const Pagina = await vista() // primero la pagina, despues los forzados
      forzar(enesimo('OTVista', esIndefinido), { ...fichaCerrada(null), responsable: null })
      return pintar(idioma, createElement(Pagina, { id: '1' }))
    },
    espanol: ['OT cerrada', 'Puedes cerrar esta ventana. La evidencia ya quedó registrada.', 'Responsable: <span class="text-ink">Sin asignar</span>'],
    ingles: ['Work order closed', 'You can close this window. The evidence is already recorded.', 'Assignee: <span class="text-ink">Unassigned</span>'],
  },
]

// ─── Creativos ──────────────────────────────────────────────────────────────
const SITIOS_CREA = [
  { id: 'd1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL' },
  { id: 'd2', nombre: 'Pantalla Sur', tipoMedio: 'PANTALLA_DIGITAL' },
  { id: 'f1', nombre: 'Valla Norte', tipoMedio: 'VALLA' },
]
const camp = (id: string, nombre: string) => ({ id, nombre, folio: `CA-${id}`, tipoCampana: 'HIBRIDA', // un valor valido del enum (OOH/DOOH/HIBRIDA)
  clienteId: 'k1', creadoEn: `2026-10-0${id.length}` })
const reserva = (id: string, campanaId: string, sitioId: string, extra: Record<string, unknown> = {}) => ({
  id, campanaId, sitioId, spotsReservados: 2, spotsPorDia: 100, creativos: [], ...extra,
})
const crea = (id: string, campanaId: string, extra: Record<string, unknown> = {}) => ({
  id, campanaId, nombre: `arte-${id}.png`, estatusValidacion: 'PENDIENTE', retiradoEn: null, rechazadoMotivo: null,
  formato: 'image/png', archivoUrl: `/arte/${id}`, esImagen: true, codigo: null, ...extra,
})
const CAMPANAS_CREA = [camp('c1', 'Verano'), camp('c22', 'Otoño'), camp('c333', 'Invierno')]
const RESERVAS_CREA = [
  reserva('r1', 'c1', 'd1', { creativos: [{ creatividadId: 'k2', veces: 50 }, { creatividadId: 'k5', veces: 50 }] }),
  reserva('r2', 'c1', 'd2', { spotsReservados: null }),
  reserva('r3', 'c1', 'd1'),
  reserva('r4', 'c22', 'd2'),
]
const CREAS = [
  crea('k1', 'c1', { formato: 'text/html', esImagen: false }),
  crea('k2', 'c1', { estatusValidacion: 'VALIDADA' }),
  crea('k3', 'c1', { estatusValidacion: 'RECHAZADA', rechazadoMotivo: 'motivo-del-cliente' }),
  crea('k4', 'c1', { estatusValidacion: 'VALIDADA', retiradoEn: '2026-10-10' }),
  crea('k5', 'c1', { estatusValidacion: 'VALIDADA' }),
  crea('k6', 'c333', { estatusValidacion: 'VALIDADA' }),
]
const creativos = async () => (await import('../../app/(app)/(shell)/creativos/page')).default
const conCreativos = () => {
  datos.campanas = CAMPANAS_CREA
  datos.reservas = RESERVAS_CREA
  datos.sitios = SITIOS_CREA
  datos.creativos = CREAS
  datos.clientes = [{ id: 'k1', nombre: 'Cliente Uno' }]
}

export const ESTADOS_CREATIVOS: Estado[] = [
  {
    nombre: 'creativos · con campañas, alta por código abierta',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      forzar(enesimo('CampanaCard', esFalse, 2), true) // codeOpen (la primera tarjeta)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Creativos', 'Sube y aprueba las imágenes de cada campaña, y asigna cuál va en cada slot reservado.',
      'Por aprobar', 'frenan la publicación', 'Aprobados', 'listos para asignar', 'Rechazados', 'hay que reemplazarlos',
      'Spots sin creativo', 'de 4 spots reservados', 'CA-c1 · HIBRIDA', 'placeholder="Buscar por campaña, folio, cliente o nombre del creativo…"',
      'Todos los creativos', 'Con pendientes de aprobar', 'Con aprobados', 'Con rechazados', 'Sin creativos todavía', '3 de 3',
      '1 por aprobar', '1/3 spots con creativo', ' Imagen</button>', ' Código</button>', 'Nombre del creativo',
      'placeholder="Pega aquí el código del creativo (HTML/UTF)…"', 'Cancelar', 'Guardar código', 'Creativos (5)',
      ' código</span>', 'title="Retirado del sistema; su arte sigue en DOOHmain (quítalo en su panel)"',
      'Retirado · pendiente en DOOHmain', ' Ver HTML</button>',
      'title="El creativo ya fue aprobado — reemplázalo o elimínalo para cambiarlo"', ' Aprobar</button>', ' Rechazar</button>',
      'aria-label="Reemplazar el arte de arte-k1.png"', 'title="Reemplazar el arte"', 'aria-label="Eliminar arte-k1.png"',
      'title="Eliminar"', '>Pendiente<', '>Aprobado<', '>Rechazado<', 'motivo-del-cliente', 'Slots reservados (3)',
      '2 creativos rotan', 'Sin creativo', 'Creativo del sitio', '>Sin asignar<', 'Sin creativos. Sube una imagen para aprobarla.',
      'Aprueba un creativo para asignarlo aquí.', 'Aprueba al menos un creativo para poder asignarlo a los slots.',
      'Creativos (1)', 'Slots reservados (0)', 'Sin slots reservados todavía.',
    ],
    ingles: [
      'Creatives', 'Upload and approve each campaign’s images, and assign which one goes in each booked slot.',
      'Pending approval', 'holding back publishing', '>Approved<', 'ready to assign', '>Rejected<', 'they need to be replaced',
      'Slots with no creative', 'of 4 booked slots', 'CA-c1 · Hybrid', 'placeholder="Search by campaign, internal ref., client or creative name…"',
      'All creatives', 'With creatives pending approval', 'No creatives yet', '3 of 3', '1 pending approval',
      '1/3 slots with a creative', ' Image</button>', ' Code</button>', 'Creative name', 'Save code', 'Creatives (5)',
      ' code</span>', 'Withdrawn · pending in DOOHmain', ' View HTML</button>', ' Approve</button>', ' Reject</button>',
      'aria-label="Replace the artwork of arte-k1.png"', 'aria-label="Delete arte-k1.png"', 'title="Delete"', '>Pending<',
      'Booked slots (3)', '2 creatives rotate', 'No creative', 'Site creative', '>Unassigned<',
      'No creatives. Upload an image to approve it.', 'Approve a creative to assign it here.',
      'Approve at least one creative to be able to assign it to the slots.', 'No booked slots yet.',
    ],
  },
  {
    nombre: 'creativos · guardando, un spot con un creativo y la fuente cargando',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      datos.reservas = [reserva('r1', 'c1', 'd1', { creativos: [{ creatividadId: 'k2', veces: 1 }] })]
      datos.campanas = [camp('c1', 'Verano')]
      forzar(enesimo('CampanaCard', esFalse, 1), true) // subiendo
      forzar(enesimo('CampanaCard', esFalse, 1), true) // codeOpen
      forzar(enesimo('CampanaCard', esNull, 1), CREAS[0]) // verFuente (busy va antes que codeOpen)
      forzar(enesimo('CampanaCard', esFalse, 1), true) // cargandoFuente (intento va antes que verFuente)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Guardando…', '1 creativo', 'text/html · cargando…', 'Cargando la fuente…', ' Descargar .html</button>', 'Cerrar'],
    ingles: ['Saving…', '1 creative', 'text/html · loading…', 'Loading the source…', ' Download .html</button>', 'Close'],
  },
  {
    nombre: 'creativos · la fuente no se pudo cargar y los dos diálogos',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      datos.campanas = [camp('c1', 'Verano')]
      forzar(enesimo('CampanaCard', esNull, 2), { ...CREAS[0], formato: null }) // verFuente
      forzar(enesimo('CampanaCard', esNull, 3), CREAS[0]) // confirmarEliminar (tras fuente y reemplazarId)
      forzar(enesimo('CampanaCard', esNull, 1), CREAS[1]) // confirmarReemplazo
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'HTML · 0 caracteres', 'No se pudo cargar la fuente de este creativo.', 'Eliminar creativo', 'Sí, eliminar',
      '¿Seguro que quieres bajar <span class="font-medium text-ink">“arte-k1.png”</span>? Si ya está publicado, su campaña se finaliza, pero <span class="text-ink">el arte no se puede quitar de DOOHmain</span> (su API no lo permite): quedará marcado como “pendiente en DOOHmain” para que lo quites en su panel.',
      'Reemplazar el arte', 'Elegir el arte nuevo',
      'Si <span class="font-medium text-ink">“arte-k2.png”</span> ya está publicado, al reemplazarlo <span class="text-ink">se manda a DOOHmain la orden de bajar el arte anterior</span>: deja de reproducirse en todas sus pantallas. El nuevo queda pendiente hasta que lo apruebes.',
      '<span class="font-medium">Recordatorio:</span> después entra al panel de DOOHmain y <span class="font-medium">elimina la campaña anterior</span>. DOOHmain no deja borrarla desde aquí, y la nueva lleva el mismo nombre: la anterior es la que aparece como finalizada.',
    ],
    ingles: [
      'HTML · 0 characters', 'Could not load this creative’s source.', 'Delete creative', 'Yes, delete',
      'Are you sure you want to take down <span class="font-medium text-ink">“arte-k1.png”</span>?',
      '<span class="text-ink">the artwork cannot be removed from DOOHmain</span>', 'Replace the artwork', 'Choose the new artwork',
      'replacing it <span class="text-ink">sends DOOHmain the order to take down the previous artwork</span>: it stops playing',
      '<span class="font-medium">Reminder:</span> afterwards, go to the DOOHmain panel and <span class="font-medium">delete the previous campaign</span>.',
    ],
  },
  {
    nombre: 'creativos · ninguna coincide',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      forzar(enesimo('CreativosPage', esCadenaVacia, 1), 'zzz') // q: una busqueda que no encuentra nada
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ninguna campaña coincide', 'Prueba con otro texto de búsqueda o quita el filtro de estado.', 'Limpiar filtros', '0 de 3'],
    ingles: ['No campaign matches', 'Try a different search or remove the status filter.', 'Clear filters', '0 of 3'],
  },
  {
    nombre: 'creativos · sin campañas',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      datos.campanas = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Sin campañas con slots o creativos', 'Reserva sitios en Comercial o sube un creativo para gestionarlos aquí.'],
    ingles: ['No campaigns with slots or creatives', 'Book sites in Sales or upload a creative to manage them here.'],
  },
  {
    nombre: 'creativos · una campaña solo de medios fijos',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      datos.campanas = [camp('c1', 'Verano')]
      datos.reservas = [reserva('r1', 'c1', 'f1')]
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Ninguna campaña tiene pantallas digitales',
      'Aquí solo se gestionan los creativos de pantallas digitales. Tus 1 campaña son de medios fijos: su arte se lleva en Imprenta.',
      'Ir a Imprenta',
    ],
    ingles: [
      'No campaign has digital screens',
      'Only creatives for digital screens are managed here. You have 1 campaign and it is on static media: its artwork is handled in Printing.',
      'Go to Printing',
    ],
  },
  {
    nombre: 'creativos · dos campañas solo de medios fijos',
    pintar: async (idioma) => {
      const Pagina = await creativos() // primero la pagina, despues los forzados
      conCreativos()
      datos.campanas = [camp('c1', 'Verano'), camp('c22', 'Otoño')]
      datos.reservas = [reserva('r1', 'c1', 'f1'), reserva('r2', 'c22', 'f1')]
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Tus 2 campañas son de medios fijos: su arte se lleva en Imprenta.'],
    ingles: ['Your 2 campaigns are on static media: their artwork is handled in Printing.'],
  },
]

const ESTADOS: Estado[] = [...ESTADOS_OT, ...ESTADOS_CREATIVOS]

describe('lote OPERACIONES (parte 2) · en ESPANOL sale el texto de siempre', () => {
  ESTADOS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `op2-${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito: datos
// de prueba, el nombre de una persona, lo que manda el servidor.
const COMUNES = new Set<string>([
  'Luisa Campo', 'Revisar estructura 1', 'OT-1 · Pantalla Reforma', 'Av. Reforma 1', 'Verano', 'Pantalla Reforma · Digital',
  'Normal', '>Checklist<',
  'motivo-del-cliente',
])

describe('lote OPERACIONES (parte 2) · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote OPERACIONES (parte 2) · el dinero lleva el simbolo de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const p of ESTADOS.filter((e) => e.dinero)) {
      for (const idioma of ['es', 'en'] as const) {
        it(`${p.nombre} · ${moneda} · ${idioma}`, async () => {
          fijarMonedaInstancia(moneda)
          const { importes, ajenos } = leerDinero(texto(await p.pintar(idioma)), idioma, moneda)
          expect(importes).toBeGreaterThan(0)
          expect(ajenos).toEqual([])
        })
      }
    }
  }
})

describe('lote OPERACIONES (parte 2) · barrido con el diccionario entero', () => {
  async function htmlIngles(): Promise<string> {
    let html = ''
    for (const p of ESTADOS) {
      forzado.cola = []
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Los datos de prueba y los puntos del checklist (son datos) no son texto de la interfaz.
    for (const a of ['Inspección de estructura y herrajes', 'Montaje / ejecución', 'Revisar estructura', 'Pantalla Reforma', 'Pantalla Sur', 'Valla Sur', 'Valla Norte', 'Verano', 'Otoño', 'Invierno', 'Luisa Campo', 'error-del-servidor', 'motivo-del-cliente', 'Cliente Uno']) {
      html = html.split(a).join('\n')
    }
    return html
  }

  it('ninguna frase espanola del diccionario del lote aparece en las pantallas en ingles', async () => {
    const { ES_OPERACIONES2, EN_OPERACIONES2 } = await import('./textos/operaciones2')
    const html = await htmlIngles()
    const culpables: string[] = []
    for (const [clave, frase] of Object.entries(ES_OPERACIONES2)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 6 || EN_OPERACIONES2[clave as keyof typeof EN_OPERACIONES2].includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ni de los modulos compartidos', async () => {
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

// ─── ITALIANO · lote L3 (2026-11-03) ────────────────────────────────────────
// Los mismos estados, rendidos en `it`: ninguna huella de formato espanol o
// ingles, las frases italianas de los estados con lista, y el barrido del
// diccionario del lote contra el HTML italiano (la caida al ingles de una
// clave sin italiano no da error: solo se ve aqui).
const ITALIANO: Record<string, string[]> = {
  'operaciones · cargando': ['Attività delle squadre · monitoraggio sul campo', 'Nuovo OdL', 'Ordini di lavoro', '>Tutti<', '>Assegnati<', '>Completati<'],
  'operaciones · con OT, aviso de SLA y filtros': [
    '>Aperti<', '1 in corso', '>In ritardo<', 'tengono bloccata la fatturazione', 'In scadenza',
    'in scadenza entro 2 giorni', 'Non assegnato', 'aperti senza responsabile', '1 OdL in ritardo', '1 in scadenza',
    '— un OdL aperto oltre la data di scadenza tiene bloccata la fatturazione.', '4 di 4', 'Montaggio telo',
    'Manutenzione correttiva', 'Elettrico', 'Smontaggio', 'Urgente', '>Alta<', 'title="Data prevista"', 'title="Apri OdL"',
    'title="Vedi OdL"', 'title="2 prove"', 'title="1 prova"', '20 ott 2026',
  ],
  'operaciones · varias vencidas y lista larga': ['26 OdL in ritardo', 'Mostra tutti (26)'],
  'operaciones · lista larga desplegada': ['Mostra meno'],
  'operaciones · sin OT': ['Non ci sono ancora ordini di lavoro', 'Crea il primo con «Nuovo OdL»: si collega a una campagna e al suo impianto.', '0 di 0'],
  'operaciones · filtro sin resultados': ['Nessun OdL in «Completati»', 'Gli altri restano in «Tutti».', 'Mostra tutti'],
  'operaciones · alta de OT con campaña y pantalla': [
    'Nuovo ordine di lavoro', 'Assegna un’attività a una squadra', 'Crea OdL', 'Campagna', '— Nessuna campagna —',
    '(automatico dalla campagna)', '— Nessun impianto —', 'Pantalla Reforma · Digitale', 'Tipo di attività',
    '(opzioni per schermo digitale)', 'Ispezione', 'Manutenzione preventiva', 'Descrizione',
    'placeholder="es. Montaggio telo su cartellone…"', 'Priorità', '>Bassa<', '>Normale<', 'Data prevista',
    'Assegna a (responsabile)', '— Non assegnato —',
  ],
  'operaciones · alta de OT con pantalla fija y campaña sin sitios': ['Questa campagna non ha siti prenotati.'],
  'operaciones · alta de OT sin campaña, con pantalla fija': ['Valla Sur · Fisso', '(opzioni per impianto fisso)', 'Carpenteria metallica', 'Creazione…'],
  'ficha · no se pudo cargar': ['Impossibile caricare l’ordine di lavoro.', 'Accedi per continuare'],
  'ficha · escritorio abierta, solo lectura y error de guardado': [
    '>Tipo<', '>Priorità<', '>Scadenza<', '20 ott 2026', '>In ritardo<', '>Responsabile<', '>Non assegnato<', '>Campagna<',
    'Errore durante il salvataggio: error-del-servidor. Le voci spuntate si vedono qui ma NON sono ancora salvate.', 'Riprova',
    'Sola lettura: il tuo ruolo può vedere questo ordine di lavoro, ma non spuntarne la checklist.', 'Foto di verifica',
    'Scatta foto', 'Ispezione della struttura e della ferramenta', 'Montaggio / esecuzione', 'Timbro di posizione',
    'Rileva posizione', 'Alla chiusura, il costo di MX$ 1.500,00 resta fisso: non si potrà più modificare.', 'Chiudi OdL',
    'Completa la checklist, scatta una foto e rileva la posizione.', 'Costo effettivo di questa visita',
    'Quanto è costata davvero. <strong>Sostituisce</strong> la stima per tipo di attività usata dal report di redditività',
    'placeholder="Non inserito"', 'Salva costo', 'Salvato: <span class="demo-num">MX$ 1.500</span>',
  ],
  'ficha · escritorio sin costo, guardando y con cero': [
    '>Alta<', '>In scadenza<', 'Salvataggio…', 'Chiusura…',
    'Questo OdL non ha un costo inserito. Se lo chiudi, non potrai più registrarlo: il report di redditività userà la stima per tipo di attività.',
    'Non inserito: il report usa la stima per tipo di attività.',
  ],
  'ficha · escritorio con costo cero y guardado': [
    'Salvato: <span class="demo-num">MX$ 0</span> — questa visita risulta registrata come senza alcun costo.', ' Salvato</span>',
  ],
  'ficha · escritorio cerrada con costo': [
    'OdL chiuso', 'La prova è stata inviata alla pipeline della campagna.', 'Chiuso in data 5 ott 2026', 'Checklist completata',
    'Fatturazione sbloccata', 'alt="prova"', 'Costo registrato: MX$ 2.300,00. L’OdL è chiuso e non si può più modificare.',
  ],
  'ficha · escritorio cerrada sin costo': ['Chiuso senza costo inserito: il report di redditività usa la stima per tipo di attività.'],
  'ficha · movil abierta': ['Campagna: Verano', 'Responsabile: <span class="text-ink">Luisa Campo</span>', 'Foto di verifica'],
  'ficha · movil cerrada': ['OdL chiuso', 'Puoi chiudere questa finestra. La prova è già stata registrata.', 'Responsabile: <span class="text-ink">Non assegnato</span>'],
  'creativos · guardando, un spot con un creativo y la fuente cargando': [
    'Salvataggio…', '1 creatività', 'text/html · caricamento…', 'Caricamento del sorgente…', ' Scarica .html</button>',
  ],
  'creativos · ninguna coincide': ['Nessuna campagna corrisponde', 'Prova con un altro testo di ricerca o togli il filtro di stato.', 'Cancella i filtri', '0 di 3'],
  'creativos · sin campañas': ['Nessuna campagna con slot o creatività', 'Prenota siti in Vendite o carica una creatività per gestirli qui.'],
  'creativos · una campaña solo de medios fijos': ['Hai 1 campagna, su mezzi statici: la sua grafica si gestisce in Stampa.', 'Vai a Stampa'],
  'creativos · dos campañas solo de medios fijos': ['Hai 2 campagne, tutte su mezzi statici: la loro grafica si gestisce in Stampa.'],
}

describe('lote OPERACIONES (parte 2) · en ITALIANO, sin formatos ajenos y con su texto', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('it')
      expect(huellasEnItaliano(crudo)).toEqual([])
      const html = texto(crudo)
      expect((ITALIANO[p.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote OPERACIONES (parte 2) · el dinero en italiano lleva el simbolo de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const p of ESTADOS.filter((e) => e.dinero)) {
      it(`${p.nombre} · ${moneda} · it`, async () => {
        fijarMonedaInstancia(moneda)
        const { importes, ajenos } = leerDinero(texto(await p.pintar('it')), 'it', moneda)
        expect(importes).toBeGreaterThan(0)
        expect(ajenos).toEqual([])
      })
    }
  }
})

describe('lote OPERACIONES (parte 2) · barrido del diccionario contra el HTML italiano', () => {
  it('ningun texto ingles ni espanol del lote aparece en italiano', async () => {
    let html = ''
    for (const p of ESTADOS) {
      forzado.cola = []
      datos.ots = undefined
      datos.sitios = []
      datos.campanas = []
      datos.evidencias = []
      datos.reservas = []
      datos.usuarios = []
      datos.creativos = undefined
      datos.clientes = []
      datos.puede = true
      html += legible(await p.pintar('it'))
    }
    // Los datos de prueba no son texto de la interfaz («Pantalla Reforma» no es
    // la palabra «Pantalla» del diccionario).
    for (const d of ['Verano', 'Otoño', 'Invierno', 'Luisa Campo', 'Pantalla Reforma', 'Pantalla Sur', 'Valla Sur', 'Valla Norte', 'Cliente Uno', 'Revisar estructura']) {
      html = html.split(d).join('\n')
    }
    expect(fugasEnItaliano(html, [{ es: ES_OPERACIONES2, en: EN_OPERACIONES2, it: IT_OPERACIONES2 }])).toEqual([])
  })
})

// ─── PORTUGUES · lote L3 (2026-11-05) ───────────────────────────────────────
// Los mismos estados, rendidos en `pt`: ninguna huella de formato espanol o
// ingles, ninguna frase espanola ni inglesa del lote (lo que falta del
// portugues cae al ESPANOL y no da error: solo se ve aqui), las frases
// portuguesas de los estados con lista y el dinero con «MX$ » delante.
const DATOS_PT = ['Verano', 'Otoño', 'Invierno', 'Luisa Campo', 'Pantalla Reforma', 'Pantalla Sur', 'Valla Sur', 'Valla Norte', 'Cliente Uno', 'Revisar estructura']
const PORTUGUES: Record<string, string[]> = {
  'operaciones · cargando': ['Tarefas da equipe de campo · acompanhamento em campo', 'Nova OS', 'Ordens de serviço', '>Atribuídas<', '>Em andamento<', '>Concluídas<'],
  'operaciones · con OT, aviso de SLA y filtros': [
    '>Abertas<', '1 em andamento', '>Atrasadas<', 'mantêm o faturamento bloqueado', 'prazo em 2 dias ou menos',
    'abertas sem responsável', '1 OS atrasada', '1 a vencer', '— uma OS aberta que passou do prazo mantém o faturamento bloqueado.',
    'Instalação de lona', 'Manutenção corretiva', 'Elétrica', 'Desinstalação', 'title="Prazo"', 'title="Abrir OS"', 'title="Ver OS"',
    'title="2 comprovações"', 'title="1 comprovação"', '20 de out. de 2026',
  ],
  'operaciones · varias vencidas y lista larga': ['26 OS atrasadas', 'Ver todas (26)'],
  'operaciones · sin OT': ['Ainda não há ordens de serviço', 'Crie a primeira com “Nova OS”: ela fica ligada a uma campanha e ao seu ponto.'],
  'operaciones · filtro sin resultados': ['Nenhuma OS em “Concluídas”', 'As demais continuam em “Todas”.'],
  'operaciones · alta de OT con campaña y pantalla': [
    'Nova ordem de serviço', 'Atribua uma tarefa à equipe de campo', 'Criar OS', '— Sem campanha —', '(automático pela campanha)',
    '— Sem ponto —', 'Pantalla Reforma · Digital', 'Tipo de tarefa', '(opções de tela digital)', 'Inspeção', 'Manutenção preventiva',
    'placeholder="ex.: Instalação de lona no painel…"', 'Prioridade', '>Baixa<', 'Atribuir a (responsável)', '— Sem responsável —',
  ],
  'operaciones · alta de OT con pantalla fija y campaña sin sitios': ['Esta campanha não tem pontos reservados.'],
  'operaciones · alta de OT sin campaña, con pantalla fija': ['Valla Sur · Fixo', '(opções de ponto fixo)', 'Serralheria', 'Criando…'],
  'ficha · no se pudo cargar': ['Não foi possível carregar a ordem de serviço.', 'Entre para continuar'],
  'ficha · escritorio abierta, solo lectura y error de guardado': [
    '>Prazo<', '>Responsável<', '>Sem responsável<', 'Erro ao salvar: error-del-servidor. O que foi marcado aparece aqui, mas ainda NÃO está salvo.',
    'Somente leitura: seu perfil pode ver esta ordem de serviço, mas não marcar o checklist.', 'Foto de comprovação', 'Tirar foto',
    'Inspeção da estrutura e das ferragens', 'Instalação / execução', 'Carimbo de localização', 'Registrar localização',
    'Ao encerrá-la, o custo de MX$ 1.500,00 fica fixo: não poderá mais ser alterado.', 'Encerrar OS', 'Custo real desta visita',
    'O que de fato custou. <strong>Substitui</strong> a estimativa por tipo de tarefa', 'placeholder="Não informado"', 'Salvar custo',
  ],
  'ficha · escritorio sin costo, guardando y con cero': [
    'Salvando…', 'Encerrando…',
    'Esta OS não tem custo informado. Se você encerrá-la, não poderá mais registrá-lo depois: o relatório de rentabilidade usará a estimativa por tipo de tarefa.',
    'Não informado: o relatório usa a estimativa por tipo de tarefa.',
  ],
  'ficha · escritorio con costo cero y guardado': [' — esta visita está registrada como sem custo.'],
  'ficha · escritorio cerrada con costo': [
    'OS encerrada', 'A comprovação foi enviada ao pipeline da campanha.', 'Encerrada: 5 de out. de 2026', 'Checklist concluído',
    'alt="comprovação"', 'Custo registrado: MX$ 2.300,00. A OS está encerrada e não pode mais ser alterada.',
    // Validacion H1: el candado ABIERTO al cerrar la OS (`LockOpen`), no «bloqueio ativado».
    'Faturamento liberado',
  ],
  'ficha · escritorio cerrada sin costo': ['Foi encerrada sem custo informado: o relatório de rentabilidade usa a estimativa por tipo de tarefa.'],
  'ficha · movil cerrada': ['Você pode fechar esta janela. A comprovação já ficou registrada.'],
  'creativos · guardando, un spot con un creativo y la fuente cargando': ['1 criativo', 'text/html · carregando…', 'Carregando o código-fonte…'],
  'creativos · ninguna coincide': ['Nenhuma campanha coincide', 'Tente outro texto de busca ou remova o filtro de status.', 'Limpar filtros'],
  'creativos · sin campañas': ['Nenhuma campanha com slots ou criativos', 'Reserve pontos no Comercial ou envie um criativo para gerenciá-los aqui.'],
  'creativos · una campaña solo de medios fijos': ['Você tem 1 campanha, de mídia fixa: a arte dela é acompanhada na Gráfica.', 'Ir para a Gráfica'],
  'creativos · dos campañas solo de medios fijos': ['Você tem 2 campanhas, todas de mídia fixa: a arte delas é acompanhada na Gráfica.'],
}

describe('lote OPERACIONES (parte 2) · en PORTUGUES, sin formatos ajenos, sin espanol del lote y con su texto', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('pt')
      expect(huellasEnPortugues(crudo)).toEqual([])
      const dic = { es: ES_OPERACIONES2, en: EN_OPERACIONES2, it: PT_OPERACIONES2 }
      expect(culpablesEnItaliano(crudo, dic, { ignorar: [...DATOS_PT] })).toEqual([])
      const html = texto(crudo)
      expect((PORTUGUES[p.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote OPERACIONES (parte 2) · el dinero en portugues lleva el simbolo de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const p of ESTADOS.filter((e) => e.dinero)) {
      it(`${p.nombre} · ${moneda} · pt`, async () => {
        fijarMonedaInstancia(moneda)
        const { importes, ajenos } = leerDinero(texto(await p.pintar('pt')), 'pt', moneda)
        expect(importes).toBeGreaterThan(0)
        expect(ajenos).toEqual([])
      })
    }
  }
})
