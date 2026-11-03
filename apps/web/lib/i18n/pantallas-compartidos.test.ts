import { describe, it, expect, vi, beforeEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  I18N · LOTE «COMPARTIDOS», LAS PIEZAS RENDIDAS EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Las pantallas de Propuestas se rinden en `pantallas-propuestas.test.ts`,
//  pero alli `MapView` va sustituido (MapLibre no existe en node) y el cuadro
//  de la contrasena no sale en ninguna. Aqui se montan las piezas compartidas
//  SUELTAS, cada una dentro del proveedor, con el mismo truco de `useState`
//  forzado para pintar lo que solo aparece tras un clic (la barra de dibujo
//  con la zona a medias o cerrada).
//
//  Dos cosas por pieza, como en el piloto:
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda ninguna frase espanola y sale la inglesa.
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
  usePathname: () => '/propuestas',
}))

// MapLibre necesita un navegador; el texto de la barra de dibujo no.
vi.mock('maplibre-gl', () => ({ default: {} }))

// El modal real va por un portal de Radix, que en el servidor no pinta nada.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; children: unknown; footer?: unknown }) =>
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never, p.footer as never) : null,
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
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
const esVacio = (v: unknown) => Array.isArray(v) && v.length === 0

type Pieza = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
}

const PUNTOS = [
  { id: 'a', lat: 19.4, lng: -99.1, label: 'A', tono: 'verde' as const },
  { id: 'b', lat: 0, lng: 0, label: 'B', tono: 'verde' as const },
  { id: 'c', lat: Number.NaN, lng: Number.NaN, label: 'C', tono: 'verde' as const },
]

const CANDADO_ABIERTO = {
  reautenticando: true, pass: '', setPass: () => {}, error: null, enviando: false,
  ejecutar: async () => null, reintentar: async () => null, olvidar: () => {},
}

const PIEZAS: Pieza[] = [
  {
    nombre: 'mapa · dibujando una zona, con pantallas sin ubicacion',
    pintar: async (idioma) => {
      const { MapView } = await import('../../components/demo/MapView')
      forzar(esFalse, true) // dibujando
      forzar(esVacio, [[1, 1], [2, 2], [3, 3]]) // vertices
      return pintar(idioma, createElement(MapView, { points: PUNTOS, permitirDibujo: true }))
    },
    espanol: [
      'Cerrar zona (3)',
      'Cancelar',
      'Toca el mapa para marcar la zona (mín. 3 puntos)',
      'pantallas sin ubicación capturada',
    ],
    ingles: ['Close area (3)', 'Cancel', 'Click the map to mark the area (at least 3 points)', 'screens with no location entered'],
  },
  {
    nombre: 'mapa · zona cerrada, una pantalla sin ubicacion',
    pintar: async (idioma) => {
      const { MapView } = await import('../../components/demo/MapView')
      forzar(esFalse, false) // dibujando
      forzar(esVacio, [[1, 1], [2, 2], [3, 3]]) // vertices
      forzar(esFalse, true) // zonaCerrada
      return pintar(idioma, createElement(MapView, { points: PUNTOS.slice(0, 2), permitirDibujo: true }))
    },
    espanol: ['Limpiar zona', '1 pantalla sin ubicación capturada'],
    ingles: ['Clear area', '1 screen with no location entered'],
  },
  {
    nombre: 'campo obligatorio que falta',
    pintar: async (idioma) => {
      const { Campo } = await import('../../components/demo/ui/Campo')
      // `children` va en las props a proposito: el tipo de `Campo` lo exige ahi,
      // y pasarlo como tercer argumento de createElement no tipa. Sin este
      // permiso `next build` (que corre ESLint sobre todo el arbol) no compila.
      // eslint-disable-next-line react/no-children-prop
      return pintar(idioma, createElement(Campo, { label: 'X', obligatorio: true, falta: true, children: createElement('input') }))
    },
    espanol: [' (obligatorio)', 'Falta este dato'],
    ingles: [' (required)', 'This field is required'],
  },
  {
    nombre: 'migas de pan',
    pintar: async (idioma) => {
      const { Breadcrumbs } = await import('../../components/demo/ui/Breadcrumbs')
      return pintar(idioma, createElement(Breadcrumbs, { items: [{ label: 'A', href: '/a' }, { label: 'B' }] }))
    },
    espanol: ['aria-label="Ruta de navegación"'],
    ingles: ['aria-label="Breadcrumb"'],
  },
  {
    nombre: 'cuadro de la contrasena (candado)',
    pintar: async (idioma) => {
      const { DialogoCandado } = await import('../../components/demo/ui/candado')
      return pintar(idioma, createElement(DialogoCandado, { candado: CANDADO_ABIERTO as never, titulo: 'T' }))
    },
    espanol: [
      'Tu organización pide la contraseña para confirmar los cambios sensibles.',
      'Tu contraseña',
      'Cancelar',
      'Confirmar',
    ],
    ingles: ['Your organization requires your password to confirm sensitive changes.', 'Your password', 'Cancel', 'Confirm'],
  },
  {
    nombre: 'aviso de la franja',
    pintar: async (idioma) => {
      const { AvisoFranjaCMS } = await import('../../components/demo/rejilla/AvisoFranjaCMS')
      return pintar(idioma, createElement(AvisoFranjaCMS, { compacto: true }))
    },
    espanol: ['La franja horaria es un compromiso comercial: se cotiza y se cobra.'],
    ingles: ['The daypart is a commercial commitment: it is quoted and billed.'],
  },
  // Ola 5 (recorrido en navegador): el boton del galon de TODAS las tarjetas
  // plegables decia «Minimizar Cobranza» en ingles. Es un `aria-label`, asi
  // que no se ve, pero el lector de pantalla lo lee en cada tarjeta de la app.
  {
    nombre: 'tarjeta plegable abierta',
    pintar: async (idioma) => {
      const { CardColapsable } = await import('../../components/demo/ui/CardColapsable')
      // eslint-disable-next-line react/no-children-prop -- el tipo de CardColapsable exige children en las props (como Campo, arriba)
      return pintar(idioma, createElement(CardColapsable, { titulo: 'Cobranza', children: 'x' }))
    },
    espanol: ['aria-label="Minimizar Cobranza"'],
    ingles: ['aria-label="Collapse Cobranza"'],
  },
  {
    nombre: 'tarjeta plegable cerrada',
    pintar: async (idioma) => {
      const { CardColapsable } = await import('../../components/demo/ui/CardColapsable')
      // eslint-disable-next-line react/no-children-prop -- el tipo de CardColapsable exige children en las props (como Campo, arriba)
      return pintar(idioma, createElement(CardColapsable, { titulo: 'Cobranza', defaultAbierto: false, children: 'x' }))
    },
    espanol: ['aria-label="Expandir Cobranza"'],
    ingles: ['aria-label="Expand Cobranza"'],
  },
]

describe('lote COMPARTIDOS · en ESPANOL sale el texto de siempre', () => {
  PIEZAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      // Con `I18N_VOLCAR=<carpeta>` el HTML espanol de cada pieza va a disco.
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

describe('lote COMPARTIDOS · en INGLES no queda ninguna frase espanola', () => {
  for (const p of PIEZAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote COMPARTIDOS · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PIEZAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})
