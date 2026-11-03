import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'
import { ESTADO_ALERTAS as ESTADO } from './estado-alertas.fixture'

// ============================================================================
//  I18N · EL DASHBOARD (`/inicio`), RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El diseño del Dashboard lo aprobo el dueño como «perfecto» (26/10): de esta
//  pagina solo se traducen los textos. Por eso esta prueba importa mas que
//  ninguna por su volcado: con `I18N_VOLCAR=<carpeta>` escribe el HTML
//  espanol de cada estado, se corre antes y despues de tocar la pagina y se
//  compara con `diff -rq`. Una clase o un nodo de mas saldrian ahi.
//
//  Mismo arnes que `pantallas-operaciones2.test.ts`: componente REAL,
//  proveedor de idioma y `useState` forzado por valor inicial y por PILA. Cada
//  estado importa la pagina PRIMERO y fuerza DESPUES (leccion del validador de
//  clientes: un estado que agota el tiempo no se come los forzados del
//  siguiente).
//
//  Las alertas salen del `dashboardMetrics` REAL sobre un estado de prueba que
//  dispara todas las ramas de `construirAlertas`, en el idioma de la pantalla.
//
//  LO QUE NO VE: el mapa y la grafica (se sustituyen: `MapView` es del lote de
//  compartidos y `recharts` no pinta sin medidas), el menu de configurar
//  alertas (Radix lo monta en un portal que el servidor no rinde; su clave la
//  fija `textos/inicio.test.ts`) y los nombres de los datos.
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))
const datos = vi.hoisted(() => ({
  m: undefined as unknown,
  estado: null as unknown,
  serie: undefined as unknown,
  sitios: undefined as unknown,
  campanas: [] as unknown[],
  clientes: [] as unknown[],
  reservas: [] as unknown[],
  propuestas: undefined as unknown,
  facturas: [] as unknown[],
  cobranzas: [] as unknown[],
  usuarios: [] as unknown[],
  cfg: null as unknown,
  finanzas: true,
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
  usePathname: () => '/inicio',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never,
      p.accion as never, p.children as never),
}))
vi.mock('@/components/demo/MapView', () => ({ MapView: () => createElement('div', { 'data-mapa': '' }) }))
vi.mock('@/components/demo/charts', () => ({ OcupacionChart: () => createElement('div', { 'data-grafica': '' }) }))
vi.mock('@/components/demo/shell/SesionContext', () => ({
  usePuede: () => datos.finanzas,
  useSesionCtx: () => ({ sesion: { usuario: { id: 'u1', nombre: 'Ana Ventas' } } }),
}))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  const { dashboardMetrics } = await import('@/lib/data/derive')
  return {
    ...real,
    // El idioma lo pasa la pagina desde la traduccion; antes no pasaba nada y
    // `dashboardMetrics` caia al espanol por omision.
    useDashboard: (idioma?: Idioma) =>
      datos.m && { ...(datos.m as object), alertas: datos.estado ? dashboardMetrics(datos.estado as never, new Date(), idioma).alertas : [] },
    useOcupacionSerie: () => datos.serie,
    useSitios: () => datos.sitios,
    useCampanas: () => datos.campanas,
    useClientes: () => datos.clientes,
    useReservas: () => datos.reservas,
    usePropuestas: () => datos.propuestas,
    useFacturas: () => datos.facturas,
    useCobranzas: () => datos.cobranzas,
    useUsuarios: () => datos.usuarios,
    useConfigNegocio: () => datos.cfg,
  }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  Object.assign(datos, {
    m: undefined, estado: null, serie: undefined, sitios: undefined, campanas: [], clientes: [], reservas: [],
    propuestas: undefined, facturas: [], cobranzas: [], usuarios: [], cfg: null, finanzas: true,
  })
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
const esFase = (v: unknown) => !!v && typeof v === 'object' && 'fase' in (v as object)

// ─── Datos de prueba ────────────────────────────────────────────────────────
const M = {
  costoImpresionMes: 1200, costoRentaMes: 0, porCobrar: 0, ocupacionPct: 62.4, sitiosOcupados: 3, sitiosTotales: 5,
  espaciosOcupados: 15, capacidadRed: 24, ocupacionDigitales: { sitios: 2, ocupados: 12, capacidad: 20 },
  ocupacionFijas: { sitios: 3, ocupados: 3, capacidad: 4 }, sinSlotsCapturados: 0, reservasConfirmadas: 2,
  propuestasAbiertas: 2, valorTentativo: 0, valorConfirmado: 0,
}
const SITIOS = [
  { id: 's1', nombre: 'Pantalla Reforma', lat: 19.4, lng: -99.1, tipoMedio: 'PANTALLA_DIGITAL', slots: 8, caras: 1 },
  { id: 's2', nombre: 'Valla Norte', lat: 19.5, lng: -99.2, tipoMedio: 'VALLA', caras: 1 },
]
const CLIENTES = [{ id: 'k1', nombre: 'Cliente Uno' }]
const CAMPANAS = [{ id: 'c1', nombre: 'Verano', clienteId: 'k1' }, { id: 'c2', nombre: 'Otoño', clienteId: null }]
const RESERVAS = [
  { id: 'r1', sitioId: 's1', campanaId: 'c1', estatus: 'CONFIRMADA', fechaInicio: '2026-10-01', fechaFin: '2026-11-02', spotsReservados: 1 },
  { id: 'r2', sitioId: 's2', campanaId: 'c2', estatus: 'CONFIRMADA', fechaInicio: '2026-10-01', fechaFin: '2026-11-20', spotsReservados: null },
]
const propuesta = (id: string, estatus: string, extra: Record<string, unknown> = {}) => ({
  id, estatus, neto: 10000, total: 11600, vendedorId: null, vendedorNombre: null, clienteId: 'k1', items: [], creadoEn: '2026-10-01', ...extra,
})
const PROPUESTAS = [
  propuesta('p1', 'ENVIADA'),
  propuesta('p2', 'BORRADOR'),
  propuesta('p3', 'APROBADA', { aprobadaEn: '2026-11-02T12:00:00', netoAprobado: 20000, vendedorId: 'u1' }),
  propuesta('p4', 'APROBADA', { aprobadaEn: '2026-11-02T12:00:00', netoAprobado: 5000 }),
  propuesta('p5', 'APROBADA', { aprobadaEn: '2026-11-02T12:00:00', netoAprobado: 5000, vendedorId: 'u-borrado' }),
  propuesta('p6', 'RECHAZADA', { rechazadaEn: '2026-10-15' }),
]
const COBRANZAS = [
  { id: 'b1', facturaId: 'f1', estatus: 'PENDIENTE', fechaVencimiento: '2026-12-01', monto: 3000, montoPagado: 0 },
  { id: 'b2', facturaId: 'f1', estatus: 'PENDIENTE', fechaVencimiento: '2026-10-20', monto: 2000, montoPagado: 0 },
  { id: 'b3', facturaId: 'f1', estatus: 'PENDIENTE', fechaVencimiento: '2026-10-25', monto: 2000, montoPagado: 0 },
]
const FACTURAS = [{ id: 'f1', folio: 'A-1', monto: 7000, estatus: 'EMITIDA' }]
const PNL = { fase: 'datos', totales: { ingreso: 80000, costoEspacio: 20000, costoOperacion: 5000, costoEnergia: 1000, costoTotal: 26000, margenBruto: 54000, margenBrutoPct: 67.5 } }

function conTodo() {
  Object.assign(datos, {
    m: M, estado: ESTADO, serie: { diasOcupados: 1234, diasDisponibles: 5678, puntos: [] }, sitios: SITIOS, campanas: CAMPANAS,
    clientes: CLIENTES, reservas: RESERVAS, propuestas: PROPUESTAS, facturas: FACTURAS, cobranzas: COBRANZAS,
    usuarios: [{ id: 'u1', nombre: 'Ana Ventas' }], cfg: { razonSocial: 'Medios SA de CV', nombreComercial: 'Medios' },
  })
}
const inicio = async () => (await import('../../app/(app)/(shell)/inicio/page')).default

type Estado = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[]; dinero?: boolean }

export const ESTADOS: Estado[] = [
  {
    nombre: 'dashboard · cargando',
    pintar: async (idioma) => {
      const Pagina = await inicio()
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Dashboard', 'Indicadores del mes', 'Ocupación', 'Pipeline comercial', 'Propuestas ', 'Alertas', 'Huecos y renovaciones',
      'Por cobrar por antigüedad', 'Finanzas ', 'Tu red en el mapa', 'Ver comercial ', 'Día', 'Semana', '>Mes<',
      'aria-label="Configurar alertas"', 'title="Elegir qué alertas ver"', 'Libre hoy', 'Ocupado hoy', 'En propuesta'],
    ingles: ['Dashboard', 'This month’s indicators', 'Occupancy', 'Sales pipeline', 'Proposals ', 'Alerts', 'Gaps and renewals',
      'Receivables by age', 'Finance ', 'Your network on the map', 'View Sales ', '>Day<', '>Week<', '>Month<',
      'aria-label="Configure alerts"', 'title="Choose which alerts to see"', 'Free today', 'Occupied today', 'In a proposal'],
  },
  {
    nombre: 'dashboard · con datos y todas las alertas a la vista',
    dinero: true,
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      // En el orden de los hooks: `todasLasAlertas` va antes que los dos `useDelMotor`.
      forzar((v, pila) => v === false && pila.includes('DashboardPage') && !pila.includes('useAlertasVisibles'), true) // todasLasAlertas
      forzar(enesimo('useDelMotor', esFase, 1), PNL)
      forzar(enesimo('useDelMotor', esFase, 1), { fase: 'datos', pct: 87, conTarifa: 4, sinTarifa: 2 })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Razón social: Medios SA de CV · Nombre comercial: Medios', 'Ingreso de noviembre',
      'lo que se devenga este mes, prorrateado por días', 'Margen de noviembre', '$ 54,000.00 · costo $ 26,000.00',
      'Ganado en noviembre', '3 propuestas aprobadas', 'Ocupación de la red',
      '15 de 24 espacios · digital 12/20 · fijas 3/4', 'Costos de noviembre', '>Renta<', '>Operación<', '>Luz<', '>Total<',
      'Impresión (aparte)', 'Ver por pantalla', 'Rendimiento', 'Renta / ingreso', 'Tarifa publicada cobrada',
      'de 4 ventas con tarifa publicada · 2 sin tarifa con qué comparar', '1,234 espacios·día ocupados de 5,678 disponibles',
      '>Abierto<', '2 propuestas', '3 aprobadas', 'últimos 90 días', 'Ganado por vendedor', 'Otros vendedores', 'Sin vendedor',
      'Rentas vencidas · ', 'Contratos por vencer · ', 'Facturas (cobranza) · ', 'Sitios bloqueados por incidencia · ',
      'Órdenes de trabajo (SLA) · ', 'Licencias y permisos · ', ' urgentes',
      'Renta vencida', 'Pantalla Reforma — 2 cuotas sin liquidar desde 2026-09-01 ($ 2,000.00)',
      'Pantalla Sur — pago 2026-10-01 sin liquidar ($ 1,000.00)', 'Renta por vencer', 'Valla Centro — vence hoy ($ 1,000.00)',
      'Valla Centro — vence en 1 día ($ 1,000.00)', 'Pantalla Reforma — vence en 4 días ($ 1,000.00)',
      'Contrato incompleto', 'Valla Norte — falta arrendador e importe de renta', 'Contrato por vencer',
      'Valla Centro — vence en 1 días', 'Valla Centro — vence en 20 días', 'Contrato vencido', 'Pantalla Sur — venció hace 1 días',
      'Pantalla Sur — venció hace 13 días', 'Licencia vencida', 'Pantalla Reforma — Licencia municipal LM-1 venció hace 1 días',
      'Valla Norte — Permiso ambiental venció hace 32 días', 'Licencia por vencer', 'Ubicación — Dictamen estructural vence en 1 días',
      'Pantalla Reforma — Permiso X vence en 48 días', 'El contrato no cubre la campaña',
      'Pantalla Reforma — «Verano» va hasta 01/03/2028 y el contrato vence el 31/12/2027',
      'Valla Norte — «campaña» va hasta 01/03/2028 y el contrato no tiene fecha de fin', 'Factura vencida', 'A-101 — $ 5,000.00',
      'Factura por vencer', 'Factura — $ 0.00', 'Pantalla en pausa legal', 'Pantalla Sur — clausura-municipal',
      'Sitio bloqueado por incidencia', 'Pantalla Reforma — vandalismo', 'Sitio — otro', 'OT vencida',
      'OT-1 · Pantalla Reforma — venció hace 1 día(s) · sin asignar', 'OT-2 · sin sitio — venció hace 13 día(s)', 'OT por vencer',
      'OT-3 · Valla Norte — vence en 1 día(s) · sin asignar', 'OT-4 · Valla Norte — vence en 2 día(s)', 'Ver menos',
      'lo que se queda sin campaña en los próximos', 'Sale Cliente Uno · <a class="hover:underline" href="/campanas/c1">Verano</a> · termina 02/11/2026',
      'sin cliente', '>hoy<', 'en 18 d', 'slot', 'cara libre', '>Total<', 'Sin vencer', '1–30 días', '31–60 días', '61–90 días', 'Más de 90',
      'title="Sin vencer: $ 3,000.00 en 1 cuota"', 'title="1–30 días: $ 4,000.00 en 2 cuotas"', 'Vencido: <span class="demo-num text-error">$ 4,000.00</span>',
    ],
    ingles: [
      'Legal name: Medios SA de CV · Trade name: Medios', 'November revenue', 'what is earned this month, prorated by day',
      'November margin', 'MX$ 54,000.00 · cost MX$ 26,000.00', 'Won in November', '3 approved proposals', 'Network occupancy',
      '15 of 24 spaces · digital 12/20 · static 3/4', 'November costs', '>Rent<', '>Operations<', '>Electricity<',
      'Printing (separate)', 'View by screen', 'Performance', 'Rent / revenue', 'Published rate charged',
      'of 4 sales with a published rate · 2 with no rate to compare against', '1,234 space·days occupied out of 5,678 available',
      '>Open<', '2 proposals', '3 approved', 'last 90 days', 'Won by sales rep', 'Other sales reps', 'No sales rep',
      'Overdue rent · ', 'Contracts expiring soon · ', 'Invoices (collections) · ', 'Sites blocked by an incident · ',
      'Work orders (SLA) · ', 'Licenses and permits · ', ' urgent<',
      'Pantalla Reforma — 2 installments unpaid since 2026-09-01 (MX$ 2,000.00)', 'Pantalla Sur — payment 2026-10-01 unpaid (MX$ 1,000.00)',
      'Rent due soon', 'Valla Centro — due today (MX$ 1,000.00)', 'Valla Centro — due in 1 day (MX$ 1,000.00)',
      'Pantalla Reforma — due in 4 days (MX$ 1,000.00)', 'Incomplete contract', 'Valla Norte — landlord and rent amount missing',
      'Contract expiring soon', 'Valla Centro — expires in 1 day<', 'Valla Centro — expires in 20 days', 'Contract expired',
      'Pantalla Sur — expired 1 day ago', 'Pantalla Sur — expired 13 days ago', 'License expired',
      'Pantalla Reforma — Municipal license LM-1 expired 1 day ago', 'Valla Norte — Environmental permit expired 32 days ago',
      'License expiring soon', 'Location — Structural report expires in 1 day<', 'Pantalla Reforma — Permit X expires in 48 days',
      'The contract does not cover the campaign', 'Pantalla Reforma — “Verano” runs until Mar 1, 2028 and the contract expires on Dec 31, 2027',
      'Valla Norte — “campaign” runs until Mar 1, 2028 and the contract has no end date', 'Overdue invoice', 'A-101 — MX$ 5,000.00',
      'Invoice due soon', 'Invoice — MX$ 0.00', 'Screen on legal hold', 'Site blocked by an incident', 'Site — otro',
      'Overdue work order', 'OT-1 · Pantalla Reforma — 1 day overdue · unassigned', 'OT-2 · no site — 13 days overdue<', 'Work order due soon',
      'OT-3 · Valla Norte — due in 1 day · unassigned', 'OT-4 · Valla Norte — due in 2 days<', 'Show less',
      'what is left without a campaign in the next', 'Cliente Uno leaves · <a class="hover:underline" href="/campanas/c1">Verano</a> · ends Nov 2, 2026',
      'no client', '>today<', 'in 18 d', 'free face', 'Not yet due', '1–30 days', 'Over 90',
      'title="Not yet due: MX$ 3,000.00 in 1 installment"', 'title="1–30 days: MX$ 4,000.00 in 2 installments"',
      'Overdue: <span class="demo-num text-error">MX$ 4,000.00</span>',
    ],
  },
  {
    nombre: 'dashboard · un rol de ventas, alertas cortadas y sin huecos',
    dinero: true,
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      datos.finanzas = false
      datos.reservas = []
      datos.propuestas = [propuesta('p1', 'ENVIADA')]
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Pipeline abierto', '1 propuesta · 1 enviada', 'Tasa de cierre', 'aprobadas de las decididas en 90 días',
      '0 propuestas aprobadas', 'Nada aprobado en noviembre todavía.', 'Ver todas (', 'Nada se queda libre en los próximos 30 días.'],
    ingles: ['Open pipeline', '1 proposal · 1 sent', 'Close rate', 'approved out of those decided in 90 days', '0 approved proposals',
      'Nothing approved in November yet.', 'Show all (', 'Nothing becomes free in the next 30 days.'],
  },
  {
    nombre: 'dashboard · el motor sin acceso, sin alertas, sin saldos',
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      datos.estado = null
      datos.cobranzas = []
      forzar(enesimo('useDelMotor', esFase, 1), { fase: 'sin-acceso' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['requiere permiso de Finanzas', 'Sin alertas activas.', 'No hay saldos por cobrar.'],
    ingles: ['requires Finance permission', 'No active alerts.', 'No outstanding balances.'],
  },
  {
    nombre: 'dashboard · el motor con error y la tarifa sin datos',
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      forzar(enesimo('useDelMotor', esFase, 1), { fase: 'error' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['no se pudo calcular'],
    ingles: ['could not be calculated'],
  },
  {
    nombre: 'dashboard · la tarifa sin ventas y con error',
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      forzar(enesimo('useDelMotor', esFase, 1), PNL)
      forzar(enesimo('useDelMotor', esFase, 1), { fase: 'sin-datos' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['sin ventas con tarifa publicada este mes'],
    ingles: ['no sales with a published rate this month'],
  },
  {
    nombre: 'dashboard · un hueco digital con varios slots y en propuesta',
    pintar: async (idioma) => {
      const Pagina = await inicio()
      conTodo()
      datos.reservas = [{ ...RESERVAS[0], spotsReservados: 3 }]
      datos.propuestas = [propuesta('p1', 'ENVIADA', { folio: 'PR-0001', items: [{ sitioId: 's1', fechaInicio: '2026-11-01', fechaFin: '2026-12-31' }] })]
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [' · 3 slots libres', 'En propuesta: PR-0001'],
    ingles: [' · 3 free slots', 'In a proposal: PR-0001'],
  },
]

describe('DASHBOARD · en ESPANOL sale el texto de siempre', () => {
  ESTADOS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `inicio-${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Iguales en ingles a proposito: el nombre de la pagina, la palabra «Total»,
// rangos con cifras y los datos de prueba.
const COMUNES = new Set<string>(['Dashboard', '>Total<', 'Pantalla Sur — clausura-municipal', 'Pantalla Reforma — vandalismo', 'slot'])

describe('DASHBOARD · en INGLES no queda ninguna frase espanola', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('DASHBOARD · el dinero lleva el simbolo de la instancia', () => {
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

describe('DASHBOARD · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario de inicio aparece en las pantallas en ingles', async () => {
    const { ES_INICIO, EN_INICIO } = await import('./textos/inicio')
    let html = ''
    for (const p of ESTADOS) {
      forzado.cola = []
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    const culpables: string[] = []
    for (const [clave, frase] of Object.entries(ES_INICIO)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 5 || EN_INICIO[clave as keyof typeof EN_INICIO].includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})
