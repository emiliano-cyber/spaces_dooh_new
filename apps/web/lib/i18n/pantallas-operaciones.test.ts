import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { DICCIONARIOS } from './diccionario'
import { ES_OPERACIONES, EN_OPERACIONES } from './textos/operaciones'
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

const datos = vi.hoisted(() => ({ disponibilidad: undefined as unknown, puede: true }))
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => datos.puede }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return { ...real, useDisponibilidad: () => datos.disponibilidad }
})

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.disponibilidad = DISPONIBILIDAD
  datos.puede = true
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
      'title="2 of 6 slots free"', 'title="8 slots"', '</svg><span class="demo-num">2/6</span>slots</span>', 'title="2 of 3 client places open"',
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
      'Availability', 'Free static sites', '1 of 2', 'in 3/1–3/14', 'not full in 3/1–3/14', 'Digital screens with room',
      'Free slots', 'across the digital screens with room', 'screens requested by 1 open proposal · they don’t block',
      '>digital<', 'aria-label="From"', 'aria-label="View"', '>Two-week period<', '>Month<', '8 periods', 'Only with free space',
      'Calendar by screen', '>3/1–3/14<', '1 of 2 free', 'Verano (confirmed)', 'Otoño (confirmed, 5 slots)\n1 of 6 slots left',
      'In proposal PR-0001 · Refresco Azul (Mar 1, 2026 to Mar 14, 2026, 2 spots)', '>1 free<', '>Full<', '>Occupied<',
      '>2 used<', '>Free<', 'In a proposal (free, but an open proposal requests it)',
      'Partial (digital: the number is the slots still free)',
    ],
  },
  {
    nombre: 'disponibilidad · por mes, sin digitales con lugar',
    pintar: async (idioma) => {
      forzar(enesimo('DisponibilidadPage', (v) => v === 'catorcena'), 'mes')
      datos.disponibilidad = {
        ...DISPONIBILIDAD,
        periodos: [{ clave: '2026-03', label: 'mar 26', inicio: '2026-03-01', fin: '2026-03-31' }],
        filas: [{ ...DISPONIBILIDAD.filas[0], celdas: [celda('LIBRE')] }],
      }
      return pintar(idioma, createElement(await disponibilidad()))
    },
    espanol: ['en mar 26', '>mar 26<', 'ninguna digital con lugar en el periodo', 'ninguna propuesta abierta las pide'],
    ingles: ['in Mar 26', '>Mar 26<', 'no digital screen has room in the period', 'no open proposal requests them'],
  },
  {
    nombre: 'disponibilidad · cargando',
    pintar: async (idioma) => {
      datos.disponibilidad = undefined
      return pintar(idioma, createElement(await disponibilidad()))
    },
    espanol: ['Cargando disponibilidad…'],
    ingles: ['Loading availability…'],
  },
  {
    nombre: 'disponibilidad · una busqueda sin resultados',
    pintar: async (idioma) => {
      forzar(enesimo('DisponibilidadPage', (v) => v === ''), '')
      forzar(enesimo('DisponibilidadPage', (v) => v === ''), 'zzz')
      return pintar(idioma, createElement(await disponibilidad()))
    },
    espanol: ['Sin pantallas que coincidan.'],
    ingles: ['No matching screens.'],
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
    for (const idioma of ['es', 'en'] as const) {
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
