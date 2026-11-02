import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'

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
  creativos: [] as unknown[],
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
  CardColapsable: (p: { titulo: string; resumen?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.resumen as never, p.children as never),
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
    useCreativos: () => datos.creativos,
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
  datos.creativos = []
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

const FICHA_CAMPANA = { id: 'c1', nombre: 'Verano', tipoCampana: 'DIGITAL', ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true }
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
    pintar: async (idioma) => pintar(idioma, createElement(await operaciones())),
    espanol: ['Operaciones', 'Tareas de cuadrilla · seguimiento de campo', 'Nueva OT', 'Órdenes de trabajo', 'Todas', 'Pendientes', 'Asignadas', 'En proceso', 'Completadas'],
    ingles: ['Operations', 'Crew tasks · field tracking', 'New work order', 'Work orders', '>All<', '>Pending<', '>Assigned<', '>In progress<', '>Completed<'],
  },
  {
    nombre: 'operaciones · con OT, aviso de SLA y filtros',
    pintar: async (idioma) => {
      datos.ots = OTS
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.usuarios = USUARIOS
      datos.evidencias = EVIDENCIAS
      return pintar(idioma, createElement(await operaciones()))
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
      '>Open<', '1 in progress', '>Overdue<', 'they keep the billing lock closed', 'Due soon', 'due in 2 days or less',
      'Unassigned', 'open with no assignee', '1 overdue work order', '1 due soon',
      '— an open work order past its due date keeps the billing lock closed.', '4 of 4', 'Vinyl installation',
      'Corrective maintenance', 'Electrical', 'Removal', 'Urgent', '>High<', 'title="Due date"', 'title="Open work order"',
      'title="View work order"', ' Overdue</span>', 'title="2 evidence photos"', 'title="1 evidence photo"', 'Oct 20, 2026',
    ],
  },
  {
    nombre: 'operaciones · varias vencidas y lista larga',
    pintar: async (idioma) => {
      datos.ots = [...Array.from({ length: 26 }, (_, i) => ot(`v${i}`, { fechaProgramada: '2026-10-01' }))]
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['26 OT vencidas', 'Ver todas (26)'],
    ingles: ['26 overdue work orders', 'Show all (26)'],
  },
  {
    nombre: 'operaciones · lista larga desplegada',
    pintar: async (idioma) => {
      datos.ots = [...Array.from({ length: 26 }, (_, i) => ot(`v${i}`, { fechaProgramada: '2026-12-01' }))]
      forzar(enesimo('OperacionesPage', esFalse, 2), true) // verTodas
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['Ver menos'],
    ingles: ['Show less'],
  },
  {
    nombre: 'operaciones · sin OT',
    pintar: async (idioma) => {
      datos.ots = []
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['Todavía no hay órdenes de trabajo', 'Crea la primera con «Nueva OT»: se liga a una campaña y a su pantalla.', '0 de 0'],
    ingles: ['No work orders yet', 'Create the first one with “New work order”: it is linked to a campaign and its screen.', '0 of 0'],
  },
  {
    nombre: 'operaciones · filtro sin resultados',
    pintar: async (idioma) => {
      datos.ots = OTS_UNA_VENCIDA
      forzar(enesimo('OperacionesPage', esCadenaVacia), 'COMPLETADA')
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['Ninguna OT en «Completadas»', 'Las demás siguen en «Todas».', 'Ver todas'],
    ingles: ['No work orders in “Completed”', 'The rest are still under “All”.', 'Show all'],
  },
  {
    nombre: 'operaciones · alta de OT con campaña y pantalla',
    pintar: async (idioma) => {
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.usuarios = USUARIOS
      datos.reservas = [{ campanaId: 'c1', sitioId: 's1' }]
      forzar(enesimo('OperacionesPage', esFalse, 1), true) // nuevaOpen
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's1') // sitioId
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 1), 'c1') // campanaId (el contador empieza tras sitioId)
      return pintar(idioma, createElement(await operaciones()))
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
      'Priority', '>Low<', '>High<', 'Urgent', 'Due date', 'Assign to (assignee)', '— Unassigned —',
    ],
  },
  {
    nombre: 'operaciones · alta de OT con pantalla fija y campaña sin sitios',
    pintar: async (idioma) => {
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      datos.reservas = [{ campanaId: 'c9', sitioId: 's2' }]
      forzar(enesimo('OperacionesPage', esFalse, 1), true)
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's2')
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 1), 'c2')
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['Esta campaña no tiene sitios reservados.'],
    ingles: ['This campaign has no booked sites.'],
  },
  {
    nombre: 'operaciones · alta de OT sin campaña, con pantalla fija',
    pintar: async (idioma) => {
      datos.ots = []
      datos.sitios = SITIOS
      datos.campanas = CAMPANAS
      forzar(enesimo('OperacionesPage', esFalse, 1), true)
      forzar(enesimo('NuevaOTModal', esCadenaVacia, 2), 's2')
      forzar(enesimo('NuevaOTModal', esFalse, 1), true) // enviando
      return pintar(idioma, createElement(await operaciones()))
    },
    espanol: ['Valla Sur · Fija', '(opciones de pantalla fija)', 'Montaje de lona', 'Herrería', 'Creando…'],
    ingles: ['Valla Sur · Static', '(options for a static screen)', 'Vinyl installation', 'Metalwork', 'Creating…'],
  },
  // ── La ficha de una OT ──
  {
    nombre: 'ficha · no se pudo cargar',
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), null)
      return pintar(idioma, createElement(await vista(), { id: 'x', embedded: true }))
    },
    espanol: ['No se pudo cargar la orden de trabajo.', 'Inicia sesión para continuar'],
    ingles: ['Could not load the work order.', 'Sign in to continue'],
  },
  {
    nombre: 'ficha · escritorio abierta, solo lectura y error de guardado',
    dinero: true,
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), fichaAbierta({ costoReal: 1500 }))
      forzar(enesimo('OTVista', esVacio), [true, false]) // checks
      forzar(enesimo('OTVista', esGuardado), { estado: 'error', error: 'error-del-servidor', pendientes: 1 })
      return pintar(idioma, createElement(await vista(), { id: '1', embedded: true }))
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
      'Location stamp', 'Capture location', 'Once closed, the cost of MX$ 1,500.00 is final: it can’t be changed.',
      'Close work order', 'Complete the checklist, take a photo and capture the location.', 'Actual cost of this visit',
      'What it really cost. It <strong>replaces</strong> the per-type estimate that the profitability report uses; it is not added to it.',
      'placeholder="Not entered"', 'aria-label="Actual cost of this visit"', 'Save cost', 'Saved: <span class="demo-num">MX$1,500</span>',
    ],
  },
  {
    nombre: 'ficha · escritorio sin costo, guardando y con cero',
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), fichaAbierta({ fechaProgramada: '2026-11-03', prioridad: 'ALTA' }))
      forzar(enesimo('OTVista', esFalse, 1), true) // cerrando
      forzar(enesimo('OTVista', esFalse, 1), true) // guardandoCosto (el contador empieza tras cerrando)
      forzar(enesimo('OTVista', esGuardado), { estado: 'guardando', error: null, pendientes: 1 })
      return pintar(idioma, createElement(await vista(), { id: '1', embedded: true }))
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
      forzar(enesimo('OTVista', esIndefinido), { ...fichaAbierta({ costoReal: 0 }), responsable: 'Luisa Campo', puedeEditar: true })
      forzar(enesimo('OTVista', esGuardado), { estado: 'guardado', error: null, pendientes: 0 })
      return pintar(idioma, createElement(await vista(), { id: '1', embedded: true }))
    },
    espanol: [' — esta visita está capturada como que no costó nada.', ' Guardado</span>', 'Luisa Campo'],
    ingles: [' — this visit is recorded as having cost nothing.', ' Saved</span>'],
  },
  {
    nombre: 'ficha · escritorio cerrada con costo',
    dinero: true,
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), fichaCerrada(2300))
      return pintar(idioma, createElement(await vista(), { id: '1', embedded: true }))
    },
    espanol: [
      'OT cerrada', 'La evidencia se envió al pipeline de la campaña.', 'Cerrada el 05/10/2026', 'Checklist cumplido',
      'Candado de facturación encendido', 'alt="evidencia"', 'Costo real de esta visita',
      'Costo registrado: $ 2,300.00. La OT está cerrada y ya no se puede cambiar.', 'Completada',
    ],
    ingles: [
      'Work order closed', 'The evidence was sent to the campaign pipeline.', 'Closed on Oct 5, 2026', 'Checklist completed',
      'Billing lock open', 'alt="evidence"', 'Actual cost of this visit',
      'Recorded cost: MX$ 2,300.00. The work order is closed and can no longer be changed.', 'Completed',
    ],
  },
  {
    nombre: 'ficha · escritorio cerrada sin costo',
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), fichaCerrada(null))
      return pintar(idioma, createElement(await vista(), { id: '1', embedded: true }))
    },
    espanol: ['Se cerró sin costo capturado: el reporte de rentabilidad usa la estimación por tipo de tarea.'],
    ingles: ['It was closed with no cost entered: the profitability report uses the per-type estimate.'],
  },
  {
    nombre: 'ficha · movil abierta',
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), { ...fichaAbierta(), responsable: 'Luisa Campo' })
      forzar(enesimo('OTVista', esNull, 1), { lat: 19.4, lng: -99.1 }) // geo
      return pintar(idioma, createElement(await vista(), { id: '1' }))
    },
    espanol: ['Campaña: Verano', 'Responsable: <span class="text-ink">Luisa Campo</span>', ' Operaciones</a>', 'Fotografía comprobatoria'],
    ingles: ['Campaign: Verano', 'Assignee: <span class="text-ink">Luisa Campo</span>', ' Operations</a>', 'Proof photo'],
  },
  {
    nombre: 'ficha · movil cerrada',
    pintar: async (idioma) => {
      forzar(enesimo('OTVista', esIndefinido), { ...fichaCerrada(null), responsable: null })
      return pintar(idioma, createElement(await vista(), { id: '1' }))
    },
    espanol: ['OT cerrada', 'Puedes cerrar esta ventana. La evidencia ya quedó registrada.', 'Responsable: <span class="text-ink">Sin asignar</span>'],
    ingles: ['Work order closed', 'You can close this window. The evidence is already recorded.', 'Assignee: <span class="text-ink">Unassigned</span>'],
  },
]

const ESTADOS: Estado[] = [...ESTADOS_OT]

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
  'Inspección de estructura y herrajes', 'Normal', '>Checklist<',
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
    for (const a of ['Inspección de estructura y herrajes', 'Montaje / ejecución', 'Revisar estructura', 'Pantalla Reforma', 'Valla Sur', 'Verano', 'Otoño', 'Luisa Campo', 'error-del-servidor']) {
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
