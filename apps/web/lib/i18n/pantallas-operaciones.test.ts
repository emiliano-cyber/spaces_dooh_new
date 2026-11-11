import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { DICCIONARIOS } from './diccionario'
import { ES_OPERACIONES, EN_OPERACIONES, IT_OPERACIONES, PT_OPERACIONES } from './textos/operaciones'
import { huellasEnPortugues } from './guardias-portugues'
import { culpablesEnItaliano } from '../test/barrido-italiano'
import { huellasEnItaliano } from './guardias-italiano'
import { legible, fugasEnItaliano } from '../test/italiano-l3'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'

// ============================================================================
//  I18N · LOTE «OPERACIONES» (disponibilidad, almacen, imprenta y las piezas
//  compartidas SlotsBadge, ClientesBadge y CalendarioDisponibilidad), RENDIDO
//  EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Mismo arnes que `pantallas-clientes.test.ts`: componente REAL dentro del
//  proveedor, `renderToStaticMarkup`, y lo que sale tras un clic se pinta
//  FORZANDO el valor inicial de `useState` (por valor inicial y por el nombre
//  del componente que lo llama, que se lee de la pila). Se comprueba:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda ninguna frase espanola del lote, y sale la inglesa;
//    (c) un barrido: ningun texto espanol del diccionario del lote aparece en
//        el HTML ingles de ninguna pantalla;
//    (d) cada importe lleva el simbolo de la moneda de la instancia.
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
  usePathname: () => '/disponibilidad',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const panel = (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
  p.open
    ? createElement('div', null, createElement('h2', null, p.title),
        p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
    : null
vi.mock('@/components/demo/ui/Modal', () => ({ Modal: panel }))
vi.mock('@/components/demo/ui/Sheet', () => ({ Sheet: panel }))
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: { open: boolean; title: string; confirmLabel?: string; children: unknown }) =>
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never,
      createElement('button', null, p.confirmLabel)) : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never,
      p.accion as never, p.children as never),
}))

const datos = vi.hoisted(() => ({ disponibilidad: undefined as unknown, puede: true, sitios: [] as unknown[], ois: undefined as unknown, campanas: [] as unknown[] }))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => datos.puede }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return { ...real, useDisponibilidad: () => datos.disponibilidad, useSitios: () => datos.sitios, useOrdenesImpresion: () => datos.ois, useCampanas: () => datos.campanas }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.disponibilidad = DISPONIBILIDAD
  datos.puede = true
  datos.sitios = [{ id: 's1', nombre: 'Muro Reforma' }]
  datos.ois = OIS
  datos.campanas = [{ id: 'c1', nombre: 'Verano', tipoCampana: 'OOH' }, { id: 'c2', nombre: 'Red', tipoCampana: 'DOOH' }]
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 1, 15, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

// ─── Datos: disponibilidad ──────────────────────────────────────────────────
const celda = (estado: string, extra: Record<string, unknown> = {}) => ({
  estado, ocupantes: [], spotsUsados: 0, spotsTotal: null, spotsLibres: null, enPropuesta: [], ...extra,
})
const EN_PROP = { propuestaId: 'p1', folio: 'PR-0001', clienteNombre: 'Refresco Azul', fechaInicio: '2026-03-01', fechaFin: '2026-03-14', spots: 2 }
const DISPONIBILIDAD = {
  totalSitios: 3,
  periodos: [
    { clave: 'c-2026-03-01', label: '1/3–14/3', inicio: '2026-03-01', fin: '2026-03-14' },
    { clave: 'c-2026-03-15', label: '15/3–28/3', inicio: '2026-03-15', fin: '2026-03-28' },
  ],
  filas: [
    {
      sitioId: 's1', nombre: 'Muro Reforma', clave: 'K-01', tipoMedio: 'ESPECTACULAR', digital: false, totalSpots: null,
      libres: 1, conHueco: 1,
      celdas: [celda('LIBRE', { enPropuesta: [EN_PROP] }), celda('OCUPADO', { ocupantes: [{ campana: 'Verano', estatus: 'CONFIRMADA', spots: null }] })],
    },
    {
      sitioId: 's2', nombre: 'LED Insurgentes', clave: 'K-02', tipoMedio: 'PANTALLA_DIGITAL', digital: true, totalSpots: 6,
      libres: 0, conHueco: 1,
      celdas: [
        celda('PARCIAL', { ocupantes: [{ campana: 'Otoño', estatus: 'CONFIRMADA', spots: 5 }], spotsUsados: 5, spotsTotal: 6, spotsLibres: 1 }),
        celda('OCUPADO', { ocupantes: [{ campana: 'Otoño', estatus: 'CONFIRMADA', spots: 6 }], spotsUsados: 6, spotsTotal: 6, spotsLibres: 0 }),
      ],
    },
    {
      sitioId: 's3', nombre: 'LED Sur', clave: 'K-03', tipoMedio: 'PANTALLA_DIGITAL', digital: true, totalSpots: null,
      libres: 1, conHueco: 1,
      celdas: [celda('LIBRE'), celda('OCUPADO', { spotsUsados: 2 })],
    },
  ],
}

// ─── Datos: almacen ─────────────────────────────────────────────────────────
const activo = (id: string, extra: Record<string, unknown>) => ({
  id, etiqueta: 'INV-' + id, descripcion: 'Articulo ' + id, tipoActivo: 'PANTALLA', estado: 'EN_ALMACEN', sitioId: null,
  ubicacion: 'Norte', marca: null, modelo: null, numeroSerie: null, placas: null, notas: null, ...extra,
})
const ACTIVOS = [
  activo('1', { tipoActivo: 'VEHICULO', estado: 'INSTALADO', sitioId: 's1', marca: 'Nissan', modelo: 'NP300', numeroSerie: 'VIN9', placas: 'ABC-1' }),
  activo('2', {}),
  activo('3', { tipoActivo: 'Grua', estado: 'BAJA' }),
  activo('4', { tipoActivo: null, estado: 'EN_TRASLADO' }),
]

// ─── Datos: imprenta ────────────────────────────────────────────────────────
const oi = (id: string, extra: Record<string, unknown>) => ({
  id, folio: 'OI-' + id, campanaId: 'c1', sitioId: 's1', material: 'Frontlit 13 oz', alto: 3, ancho: 6, estatus: 'EN_PRODUCCION',
  proveedor: 'Grafica Sur', pruebaColorUrl: null, pruebaColorAprobada: false, creadoEn: '2026-01-01', ...extra,
})
const OIS = [
  oi('1', {}),
  oi('2', { estatus: 'LISTO_MONTAJE', pruebaColorAprobada: true, material: '', alto: 0, ancho: 0, campanaId: 'zz', proveedor: null }),
]

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
// ORDEN (validacion, segunda pasada): cada estado importa su pagina PRIMERO
// y fuerza DESPUES. La cola es una sola para el archivo; si un estado metia sus
// forzados antes del import dinamico de la pagina y agotaba el tiempo, su render seguia
// vivo y, al terminar el import, se comia los forzados del estado siguiente,
// que rendia sin forzar y fallaba una asercion (sobre todo en captacion, cuyo
// import arrastra ComercialOpex). Con el import antes, el render es sincrono y
// consume solo lo suyo.
const forzar = (si: Forzado['si'], valor: unknown) => forzado.cola.push({ si, valor })

const imprenta = async () => (await import('../../app/(app)/(shell)/imprenta/page')).default
const almacen = async () => (await import('../../app/(app)/(shell)/almacen/page')).default
const disponibilidad = async () => (await import('../../app/(app)/(shell)/disponibilidad/page')).default

type Estado = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[] }

const ESTADOS: Estado[] = [
  {
    nombre: 'piezas · slots, cupo de clientes y calendario',
    pintar: async (idioma) => {
      const { SlotsBadge } = await import('../../components/demo/SlotsBadge')
      const { ClientesBadge } = await import('../../components/demo/ClientesBadge')
      const { CalendarioDisponibilidad } = await import('../../components/demo/CalendarioDisponibilidad')
      return pintar(idioma, createElement('div', null,
        createElement(SlotsBadge, { disponibles: 2, total: 6 }),
        createElement(SlotsBadge, { total: 8 }),
        createElement(ClientesBadge, { ocupados: 1, cupo: 3 }),
        createElement(ClientesBadge, { ocupados: 3, cupo: 3 }),
        createElement(CalendarioDisponibilidad, {
          rangos: [{ fechaInicio: '2026-02-02', fechaFin: '2026-02-05', estatus: 'CONFIRMADA' }],
        }),
      ))
    },
    espanol: [
      'title="2 de 6 slots libres"', 'title="8 slots"', '</svg><span class="demo-num">2/6</span>slots</span>',
      'title="2 de 3 lugares de cliente libres"', 'title="Cupo lleno: 3 clientes. Solo admite campañas de los que ya están."',
      'clientes</span>', 'aria-label="Mes anterior"', 'aria-label="Mes siguiente"', 'febrero 2026',
      '>L</div>', '>J</div>', '> confirmada</span>', '> en propuesta</span>',
    ],
    ingles: [
      'title="2 of 6 slots free"', 'title="8 slots"', '</svg><span class="demo-num">2/6</span>slots</span>', 'title="2 of 3 client openings left"',
      'Client cap reached: 3 clients.', 'clients</span>', 'aria-label="Previous month"', 'aria-label="Next month"',
      'February 2026', '>T</div>', '>W</div>', '> confirmed</span>', '> in a proposal</span>',
    ],
  },
  {
    nombre: 'disponibilidad · la rejilla por catorcena',
    pintar: async (idioma) => pintar(idioma, createElement(await disponibilidad())),
    espanol: [
      'Disponibilidad', 'Ocupación futura por catorcena o mes: cruza las reservas confirmadas contra el inventario para ver qué tienes libre más adelante, y avisa qué está en una propuesta abierta.',
      'Estáticas libres', '1 de 2', 'en 1/3–14/3', 'Digitales con lugar', 'no llenas en 1/3–14/3', 'Slots libres',
      'sumando las digitales con lugar', 'En propuesta', 'pantallas que piden 1 propuesta abierta · no bloquean',
      'aria-label="Desde"', 'aria-label="Vista"', '>Catorcena<', '>Mes<', 'title="Periodos a mostrar"', '8 periodos',
      'placeholder="Buscar pantalla: nombre o clave…"', 'Solo con hueco libre', 'Calendario por pantalla',
      'Cada celda dice su estado; pasa el cursor para ver qué campaña la ocupa.', '>1/3–14/3<', '1 de 2 libres',
      '>digital<', 'Verano (confirmada)', 'Otoño (confirmada, 5 slots)\nQuedan 1 de 6 slots',
      'En propuesta PR-0001 · Refresco Azul (01/03/2026 a 14/03/2026, 2 spots)', '>1 libre<', '>Lleno<', '>Ocupada<',
      '>2 usados<', '>Libre<', 'En propuesta (libre, pero una propuesta abierta la pide)',
      'Parcial (digital: el número son los slots que quedan libres)',
    ],
    ingles: [
      'Availability', 'Free static screens', '1 of 2', 'in 3/1–3/14', 'not full in 3/1–3/14', 'Digital screens with room',
      'Free slots', 'across the digital screens with room', 'screens requested by 1 open proposal · not blocking',
      '>digital<', 'aria-label="From"', 'aria-label="View"', '>Two-week period<', '>Month<', '8 periods', 'Only with availability',
      'Calendar by screen', '>3/1–3/14<', '1 of 2 free', 'Verano (confirmed)', 'Otoño (confirmed, 5 slots)\n1 of 6 slots left',
      'In proposal PR-0001 · Refresco Azul (Mar 1, 2026 to Mar 14, 2026, 2 spots)', '>1 free<', '>Full<', '>Occupied<',
      '>2 used<', '>Free<', 'In a proposal (free, but an open proposal requests it)',
      'Partial (digital: the number is the slots still free)',
    ],
  },
  {
    nombre: 'disponibilidad · por mes, sin digitales con lugar',
    pintar: async (idioma) => {
      const C_disponibilidad = await disponibilidad() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('DisponibilidadPage', (v) => v === 'catorcena'), 'mes')
      datos.disponibilidad = {
        ...DISPONIBILIDAD,
        periodos: [{ clave: '2026-03', label: 'mar 26', inicio: '2026-03-01', fin: '2026-03-31' }],
        filas: [{ ...DISPONIBILIDAD.filas[0], celdas: [celda('LIBRE')] }],
      }
      return pintar(idioma, createElement(C_disponibilidad))
    },
    espanol: ['en mar 26', '>mar 26<', 'ninguna digital con lugar en el periodo', 'ninguna propuesta abierta las pide'],
    ingles: ['in Mar 2026', '>Mar 2026<', 'no digital screen has room in the period', 'no open proposal requests them'],
  },
  {
    nombre: 'disponibilidad · cargando',
    pintar: async (idioma) => {
      const C_disponibilidad = await disponibilidad() // la pagina PRIMERO, los forzados despues
      datos.disponibilidad = undefined
      return pintar(idioma, createElement(C_disponibilidad))
    },
    espanol: ['Cargando disponibilidad…'],
    ingles: ['Loading availability…'],
  },
  {
    nombre: 'disponibilidad · una busqueda sin resultados',
    pintar: async (idioma) => {
      const C_disponibilidad = await disponibilidad() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('DisponibilidadPage', (v) => v === ''), '')
      forzar(enesimo('DisponibilidadPage', (v) => v === ''), 'zzz')
      return pintar(idioma, createElement(C_disponibilidad))
    },
    espanol: ['Sin pantallas que coincidan.'],
    ingles: ['No matching screens.'],
  },
  {
    nombre: 'almacen · la lista con los cuatro estados',
    pintar: async (idioma) => {
      const C_almacen = await almacen() // la pagina PRIMERO, los forzados despues
      // Los articulos llegan por un `fetch` en un efecto: se fuerza el estado.
      forzar(enesimo('AlmacenPage', (v) => v === null), ACTIVOS)
      return pintar(idioma, createElement(C_almacen))
    },
    espanol: [
      'Almacén', 'Vehículos, herramientas, pantallas, cámaras y demás artículos, y sus traslados.', 'Registrar artículo',
      'Indicadores', 'Artículos', '1 dado de baja', 'Instalados', 'en una pantalla', 'En almacén', 'guardados en bodega',
      'En traslado', 'en camino', 'aria-label="Filtrar por tipo"', 'Todos <span class="demo-num">(4)</span>',
      'Vehículo / camioneta <span', 'Pantalla <span', 'Otro <span', 'Etiqueta', 'Descripción', 'Datos', 'Estado',
      'Ubicación', '>Vehículo / camioneta<', '>Grua<', '>Otro<', 'Nissan NP300 · S/N VIN9 · Placas ABC-1', '>Instalado<',
      '>Baja<', 'En pantalla: ', 'Bodega: ', '> Mover<',
    ],
    ingles: [
      'Warehouse', 'Vehicles, tools, screens, cameras and other items, and their transfers.', 'Register item',
      'Indicators', 'Items', '1 decommissioned', 'on a screen', 'In warehouse', 'stored in a depot', 'In transit', 'on the way',
      'aria-label="Filter by type"', 'All <span class="demo-num">(4)</span>', 'Vehicle / van <span', 'Screen <span',
      'Other <span', 'Tag', 'Description', 'Details', 'Status', 'Location', '>Grua<', 'Nissan NP300 · S/N VIN9 · Plate ABC-1',
      '>Installed<', '>Decommissioned<', 'On screen: ', 'Depot: ', '> Move<',
    ],
  },
  {
    nombre: 'almacen · vacio, con permiso y sin el',
    pintar: async (idioma) => {
      const C_almacen = await almacen() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('AlmacenPage', (v) => v === null), [])
      const con = pintar(idioma, createElement(C_almacen))
      datos.puede = false
      forzar(enesimo('AlmacenPage', (v) => v === null), [])
      return con + pintar(idioma, createElement(C_almacen))
    },
    espanol: [
      'Aún no hay artículos. Registra vehículos, herramientas, pantallas o cámaras para seguir dónde está cada uno.',
      'ninguno dado de baja', 'Pide a Operaciones que los registre.',
    ],
    ingles: ['No items yet. Register vehicles, tools, screens or cameras to track where each one is.', 'none decommissioned', 'Ask Operations to register them.'],
  },
  {
    nombre: 'almacen · fallo de carga',
    pintar: async (idioma) => {
      const C_almacen = await almacen() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('AlmacenPage', (v) => v === null), [])
      forzar(enesimo('AlmacenPage', (v) => v === null, 3), 'red caida') // falloCarga, tras mover y filtroTipo
      return pintar(idioma, createElement(C_almacen))
    },
    espanol: ['No se pudo cargar el almacén — red caida', 'Reintentar'],
    ingles: ['The warehouse could not be loaded — red caida', 'Retry'],
  },
  {
    nombre: 'almacen · registrar un vehiculo',
    pintar: async (idioma) => {
      const C_almacen = await almacen() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('AlmacenPage', (v) => v === null), ACTIVOS)
      forzar(enesimo('AlmacenPage', (v) => v === false), true) // altaOpen
      forzar(enesimo('AltaActivoModal', (v) => v === 'PANTALLA'), 'VEHICULO')
      return pintar(idioma, createElement(C_almacen))
    },
    espanol: [
      'Entra al almacén', 'Etiqueta / número de inventario', 'placeholder="Ej. INV-0231"',
      'placeholder="Ej. Camioneta Nissan NP300 / Pantalla LED 4x3 m"', 'Equipo electrónico', 'Marca', 'Modelo',
      'Número de serie (VIN)', 'Placas', 'placeholder="Ej. Nissan / Hikvision"', 'placeholder="Ej. ABC-1234"',
      'Dónde se guarda', 'placeholder="Ej. Bodega norte, anaquel 3"', 'Notas', '>Registrar<', 'Cancelar',
    ],
    ingles: [
      'It goes into the warehouse', 'Tag / inventory number', 'placeholder="E.g. INV-0231"',
      'placeholder="E.g. Nissan NP300 van / 4x3 m LED screen"', 'Electronic equipment', 'Brand', 'Model',
      'Serial number (VIN)', 'License plate', 'placeholder="E.g. Nissan / Hikvision"', 'placeholder="E.g. ABC-1234"',
      'Where it is stored', 'placeholder="E.g. North depot, shelf 3"', 'Notes', '>Register<', 'Cancel',
    ],
  },
  {
    nombre: 'almacen · mover un articulo a una pantalla',
    pintar: async (idioma) => {
      const C_almacen = await almacen() // la pagina PRIMERO, los forzados despues
      forzar(enesimo('AlmacenPage', (v) => v === null), ACTIVOS)
      forzar(enesimo('AlmacenPage', (v) => v === null), ACTIVOS[1]) // mover
      return pintar(idioma, createElement(C_almacen))
    },
    espanol: [
      'Mover activo', 'INV-2 · Articulo 2', 'Movimiento', 'Instalar en pantalla', 'Marcar en traslado', 'Dar de baja',
      'Pantalla destino', '— Elige —', 'Motivo / nota', 'placeholder="Ej. Retiro por fin de contrato"', 'Registrar movimiento',
    ],
    ingles: [
      'Move item', 'INV-2 · Articulo 2', 'Movement', 'Install on a screen', 'Mark in transit', 'Decommission',
      'Destination screen', '— Choose —', 'Reason / note', 'placeholder="E.g. Removed at the end of the contract"', 'Record movement',
    ],
  },
  {
    nombre: 'imprenta · dos ordenes, una lista para montaje',
    pintar: async (idioma) => pintar(idioma, createElement(await imprenta())),
    espanol: [
      'Imprenta', 'Órdenes de impresión · del arte al montaje', 'Nueva orden', 'En proceso', 'aún no están listas para montaje',
      'Prueba de color pendiente', 'sin aprobar', 'En producción', 'en producción o ya impresas', 'Listas para montaje',
      'pasan a una OT', 'Arte recibido <span', 'Órdenes de impresión', '2 ordenes', 'Campaña: Verano', 'Sin campaña',
      'Sin material', 'Contenido digital', 'Paso 3 de 5', 'Paso 5 de 5',
      'title="Arte recibido → Validado → En producción → Impreso → Listo para montaje"', 'Prueba de color: Pendiente',
      'Prueba de color: Aprobada', 'Aprobar prueba', 'Avanzar',
    ],
    ingles: [
      'Printing', 'Print orders · from artwork to installation', 'New order', 'In progress', 'not ready to install yet',
      'Color proof pending', 'not approved', 'In production', 'in production or already printed', 'Ready to install',
      'they move on to a work order', 'Artwork received <span', 'Print orders', '2 orders', 'Campaign: Verano', 'No campaign',
      'No material', 'Digital content', 'Step 3 of 5', 'Step 5 of 5',
      'title="Artwork received → Approved → In production → Printed → Ready to install"', 'Color proof: Pending',
      'Color proof: Approved', 'Approve proof', 'Advance',
    ],
  },
  {
    nombre: 'imprenta · sin ordenes, con el alta abierta',
    pintar: async (idioma) => {
      const C_imprenta = await imprenta() // la pagina PRIMERO, los forzados despues
      datos.ois = [OIS[0]]
      datos.campanas = [{ id: 'c1', nombre: 'Verano', tipoCampana: 'DOOH' }]
      forzar(enesimo('ImprentaPage', (v) => v === false), true) // nueva
      return pintar(idioma, createElement(C_imprenta))
    },
    espanol: [
      'Sin órdenes de impresión', 'Crea una orden ligada a una campaña fija (OOH/híbrida) para llevar el proceso del arte al montaje.',
      'Nueva orden de impresión', 'Selecciona una campaña…', 'Sitio', 'Material', 'placeholder="Lona front, vinil, contenido digital…"',
      'Ancho (m)', 'Alto (m)', 'Proveedor', 'placeholder="Imprenta proveedora"', 'Deja ancho y alto en 0 para contenido digital.',
      'Crear orden', '0 ordenes',
    ],
    ingles: [
      'No print orders', 'Create an order linked to a fixed campaign (OOH/hybrid) to track the process from artwork to installation.',
      'New print order', 'Select a campaign…', 'Site', 'Material', 'placeholder="Front-lit vinyl, vinyl, digital content…"',
      'Width (m)', 'Height (m)', 'Supplier', 'placeholder="Print shop"', 'Leave width and height at 0 for digital content.',
      'Create order', '0 orders',
    ],
  },
]

const htmlIngles: string[] = []

describe('lote OPERACIONES · en ESPANOL sale el texto de siempre', () => {
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

describe('lote OPERACIONES · en INGLES no queda ninguna frase espanola', () => {
  for (const e of ESTADOS) {
    it(e.nombre, async () => {
      const html = texto(await e.pintar('en'))
      htmlIngles.push(html)
      const soloEspanol = e.espanol.filter((f) => !e.ingles.includes(f))
      expect(soloEspanol.filter((f) => html.includes(f))).toEqual([])
      expect(e.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote OPERACIONES · barrido del diccionario contra el HTML ingles', () => {
  it('ningun texto espanol del lote ni de compartidos (de 4 letras o mas) aparece en ingles', async () => {
    expect(htmlIngles.length).toBe(ESTADOS.length)
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const es: Record<string, string> = { ...ES_OPERACIONES, ...ES_COMPARTIDOS }
    const en: Record<string, string> = { ...EN_OPERACIONES, ...EN_COMPARTIDOS }
    // Solo lo que se LEE: nodos de texto y los atributos visibles.
    const todo = htmlIngles
      .map((h) => h.replace(/<[^>]*>/g, '\n') + '\n' + [...h.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]).join('\n'))
      .join('\n')
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fugas: string[] = []
    for (const [clave, frase] of Object.entries(es)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en[clave].includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(todo)) fugas.push(`${clave} · «${t}»`)
      }
    }
    expect(fugas).toEqual([])
  })

  it('el diccionario del lote esta en el diccionario de la aplicacion', () => {
    for (const k of Object.keys(ES_OPERACIONES)) expect((DICCIONARIOS.en as Record<string, string>)[k]).toBeTypeOf('string')
  })
})

describe('lote OPERACIONES · cada importe lleva el simbolo de la moneda de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const idioma of ['es', 'en', 'it'] as const) {
      ESTADOS.forEach((e) => {
        it(`${moneda} · ${idioma} · ${e.nombre}`, async () => {
          fijarMonedaInstancia(moneda)
          const { ajenos } = leerDinero(texto(await e.pintar(idioma)), idioma, moneda)
          expect(ajenos).toEqual([])
        })
      })
    }
  }
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote OPERACIONES · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})

// ─── ITALIANO · lote L3 (2026-11-03) ────────────────────────────────────────
// Los mismos estados, rendidos en `it`. Se comprueba:
//   (e) ninguna huella de formato espanol o ingles (`guardias-italiano.ts`);
//   (f) las frases italianas de cada estado (las que tienen lista);
//   (g) el barrido: ningun texto ingles ni espanol del lote aparece en el HTML
//       italiano —la caida al ingles de una clave sin italiano no da error,
//       solo se ve aqui—.
const ITALIANO: Record<string, string[]> = {
  'piezas · slots, cupo de clientes y calendario': [
    'title="2 di 6 slot liberi"', 'title="8 slot"', 'title="2 di 3 posti cliente liberi"',
    'Limite clienti raggiunto: 3 clienti.', 'clienti</span>', 'aria-label="Mese precedente"', 'febbraio 2026',
    '>G</div>', '> confermata</span>', '> in proposta</span>',
  ],
  'disponibilidad · la rejilla por catorcena': [
    'Disponibilità', 'Impianti statici liberi', '1 di 2', 'Digitali con spazio', 'non pieni in', 'Slot liberi',
    'impianti richiesti da 1 proposta aperta · non bloccano', '>Quindicina<', '8 periodi', 'Solo con spazio libero',
    'Calendario per impianto', '1 di 2 liberi', '>digitale<', 'Verano (confermata)', 'Otoño (confermata, 5 slot)\nRestano 1 di 6 slot',
    'In proposta PR-0001 · Refresco Azul (1 mar 2026 – 14 mar 2026, 2 spot)', '>1 libero<', '>Pieno<', '>Occupato<', '>2 usati<',
    'In proposta (libero, ma una proposta aperta lo richiede)',
  ],
  'disponibilidad · por mes, sin digitales con lugar': ['nessun digitale con spazio nel periodo', 'nessuna proposta aperta li richiede'],
  'disponibilidad · cargando': ['Caricamento della disponibilità…'],
  'disponibilidad · una busqueda sin resultados': ['Nessun impianto corrispondente.'],
  'almacen · la lista con los cuatro estados': [
    'Magazzino', 'Registra articolo', 'Indicatori', '1 dismesso', 'su un impianto', 'custoditi in deposito', 'in viaggio',
    'aria-label="Filtra per tipo"', 'Veicolo / furgone <span', 'Schermo <span', 'Altro <span', 'Etichetta', 'Posizione',
    'Nissan NP300 · S/N VIN9 · Targa ABC-1', '>Installato<', '>Dismesso<', 'Su impianto: ', 'Deposito: ', '> Sposta<',
  ],
  'almacen · vacio, con permiso y sin el': ['nessuno dismesso', 'Chiedi a Operazioni di registrarli.'],
  'almacen · fallo de carga': ['Impossibile caricare il magazzino — red caida', 'Riprova'],
  'almacen · registrar un vehiculo': [
    'Entra in magazzino', 'Etichetta / numero di inventario', 'placeholder="Es. INV-0231"', 'Apparecchiatura elettronica',
    'Numero di serie (VIN)', 'Targa', 'Dove è custodito', 'placeholder="Es. Deposito nord, scaffale 3"', '>Registra<',
  ],
  'almacen · mover un articulo a una pantalla': [
    'Sposta articolo', 'Installa su un impianto', 'Segna in trasferimento', 'Dismetti', 'Impianto di destinazione', '— Scegli —',
    'Registra movimento',
  ],
  'imprenta · dos ordenes, una lista para montaje': [
    'Stampa', 'Ordini di stampa · dalla grafica al montaggio', 'Nuovo ordine', 'Prova colore in sospeso', 'Pronti per il montaggio',
    'passano a un OdL', '2 ordini', 'Campagna: Verano', 'Nessuna campagna', 'Nessun materiale', 'Contenuto digitale', 'Passo 3 di 5',
    'Prova colore: in sospeso', 'Prova colore: approvata', 'Approva prova', 'Avanza',
  ],
  'imprenta · sin ordenes, con el alta abierta': [
    'Nessun ordine di stampa', 'Nuovo ordine di stampa', 'Seleziona una campagna…', 'Larghezza (m)', 'Altezza (m)', 'Fornitore',
    'Lascia larghezza e altezza a 0 per i contenuti digitali.', 'Crea ordine', '0 ordini',
  ],
}

describe('lote OPERACIONES · en ITALIANO, sin formatos ajenos y con su texto', () => {
  for (const e of ESTADOS) {
    it(e.nombre, async () => {
      const crudo = await e.pintar('it')
      expect(huellasEnItaliano(crudo)).toEqual([])
      const html = texto(crudo)
      expect((ITALIANO[e.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote OPERACIONES · barrido del diccionario contra el HTML italiano', () => {
  it('ningun texto ingles ni espanol del lote aparece en italiano', async () => {
    let html = ''
    for (const e of ESTADOS) {
      forzado.cola = []
      datos.disponibilidad = DISPONIBILIDAD
      datos.puede = true
      datos.sitios = [{ id: 's1', nombre: 'Muro Reforma' }]
      datos.ois = OIS
      datos.campanas = [{ id: 'c1', nombre: 'Verano', tipoCampana: 'OOH' }, { id: 'c2', nombre: 'Red', tipoCampana: 'DOOH' }]
      html +=legible(await e.pintar('it'))
    }
    expect(fugasEnItaliano(html, [{ es: ES_OPERACIONES, en: EN_OPERACIONES, it: IT_OPERACIONES }], {
      // Datos de prueba, no texto de la interfaz.
      datos: ['Verano', 'Otoño', 'Muro Reforma', 'LED Insurgentes', 'LED Sur', 'Grafica Sur', 'Frontlit 13 oz', 'Refresco Azul', 'Norte'],
    })).toEqual([])
  })
})

// ─── PORTUGUES · lote L3 (2026-11-05) ───────────────────────────────────────
// Los mismos estados, rendidos en `pt`. Se comprueba:
//   (h) ninguna huella de formato espanol o ingles (`guardias-portugues.ts`);
//   (i) ninguna frase espanola ni inglesa del lote (`culpablesEnItaliano` con
//       el portugues en su sitio). En portugues la espanola es la que mas
//       importa: lo que falta cae al ESPANOL y la pantalla no lo delata;
//   (j) las frases portuguesas de los estados con lista.
const DATOS_PT = ['Verano', 'Otoño', 'Muro Reforma', 'LED Insurgentes', 'LED Sur', 'Grafica Sur', 'Frontlit 13 oz', 'Refresco Azul', 'Norte']
const PORTUGUES: Record<string, string[]> = {
  'piezas · slots, cupo de clientes y calendario': [
    'title="2 de 6 slots livres"', 'title="2 de 3 vagas de cliente livres"', 'Limite atingido: 3 clientes.',
    'aria-label="Mês anterior"', '> confirmada</span>', '> em proposta</span>',
  ],
  'disponibilidad · la rejilla por catorcena': [
    'Disponibilidade', 'Estáticos livres', 'Digitais com vaga', 'pontos pedidos por 1 proposta aberta · não bloqueiam',
    '>Bissemana<', '8 períodos', 'Só com vaga livre', 'Calendário por ponto', 'Verano (confirmada)', '>Lotado<', '>Ocupado<',
    'Em proposta (livre, mas uma proposta aberta o pede)',
  ],
  'disponibilidad · cargando': ['Carregando disponibilidade…'],
  'disponibilidad · una busqueda sin resultados': ['Nenhum ponto coincide.'],
  'almacen · la lista con los cuatro estados': [
    'Almoxarifado', 'Cadastrar item', '1 baixado', 'em um ponto', 'guardados no depósito', 'a caminho', 'Plaqueta', 'Localização',
    'No ponto: ', 'Depósito: ', '>Instalado<', '>Baixado<',
  ],
  'almacen · vacio, con permiso y sin el': ['nenhum baixado', 'Peça a Operações que os cadastre.'],
  'almacen · fallo de carga': ['Não foi possível carregar o almoxarifado — red caida', 'Tentar de novo'],
  'almacen · registrar un vehiculo': ['Entra no almoxarifado', 'Plaqueta / número de patrimônio', 'Número do chassi (VIN)', 'Onde fica guardado'],
  'almacen · mover un articulo a una pantalla': ['Movimentar item', 'Instalar em um ponto', 'Marcar em transferência', 'Dar baixa', 'Ponto de destino'],
  'imprenta · dos ordenes, una lista para montaje': [
    'Gráfica', 'Ordens de impressão · da arte à instalação', 'Nova ordem', 'Prova de cor pendente', 'Prontas para instalação',
    'viram uma OS', 'Em produção', '2 ordens', 'Campanha: Verano', 'Sem campanha', 'Etapa 3 de 5', 'Aprovar prova', 'Avançar',
  ],
  'imprenta · sin ordenes, con el alta abierta': [
    'Nenhuma ordem de impressão', 'Nova ordem de impressão', 'Selecione uma campanha…', 'Largura (m)', 'Altura (m)', 'Fornecedor',
    'Deixe largura e altura em 0 para conteúdo digital.', 'Criar ordem', '0 ordens',
  ],
}

describe('lote OPERACIONES · en PORTUGUES, sin formatos ajenos, sin espanol del lote y con su texto', () => {
  for (const e of ESTADOS) {
    it(e.nombre, async () => {
      const crudo = await e.pintar('pt')
      expect(huellasEnPortugues(crudo)).toEqual([])
      const dic = { es: ES_OPERACIONES, en: EN_OPERACIONES, it: PT_OPERACIONES }
      expect(culpablesEnItaliano(crudo, dic, { ignorar: [...DATOS_PT] })).toEqual([])
      const html = texto(crudo)
      expect((PORTUGUES[e.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }
})
