import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { Modal } from './Modal'
import { Sheet } from './Sheet'

// ============================================================================
//  B71 (05/11) · LOS BOTONES DE SOLO ICONO TIENEN NOMBRE PARA EL LECTOR DE PANTALLA.
// ----------------------------------------------------------------------------
//  La X de `Modal` y de `Sheet` era un `Dialog.Close` con un icono dentro y
//  nada mas: el lector de pantalla anunciaba «botón», sin decir que cierra.
//  Ahora lleva `aria-label` y `title` con la clave comun `comun.cerrar`.
//
//  Radix pinta el cuadro en un portal, que en el servidor no pinta nada: aqui
//  el portal se sustituye por sus hijos para ver el HTML del boton real. El
//  `Dialog.Close` de verdad se conserva (es el que recibe las props).
// ============================================================================

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))

vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const real = await importOriginal<typeof import('@radix-ui/react-dialog')>()
  const { createElement: ce, Fragment } = await import('react')
  return {
    ...real,
    Portal: (p: { children?: unknown }) => ce(Fragment, null, p.children as never),
  }
})

const CERRAR: Record<Idioma, string> = { es: 'Cerrar', en: 'Close', it: 'Chiudi' }

function pinta(idioma: Idioma, Componente: typeof Modal | typeof Sheet): string {
  return renderToStaticMarkup(
    createElement(
      ProveedorIdioma,
      { idioma } as never,
      createElement(Componente, { open: true, onOpenChange: () => {}, title: 'Título', children: 'cuerpo' }),
    ),
  )
}

/** El boton que contiene el icono X de lucide (`lucide-x`). */
function botonCerrar(html: string): string {
  const botones = html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*lucide-x(?:(?!<\/button>)[\s\S])*<\/button>/g) ?? []
  expect(botones.length, html).toBe(1)
  return botones[0] ?? ''
}

describe('B71 · la X de Modal y de Sheet dice que cierra', () => {
  for (const [nombre, C] of [['Modal', Modal], ['Sheet', Sheet]] as const) {
    for (const idioma of ['es', 'en', 'it'] as const) {
      it(`${nombre} en ${idioma}: aria-label y title «${CERRAR[idioma]}»`, () => {
        const b = botonCerrar(pinta(idioma, C))
        expect(b).toContain(`aria-label="${CERRAR[idioma]}"`)
        expect(b).toContain(`title="${CERRAR[idioma]}"`)
      })
    }
  }

  it('NEGATIVO · el ingles y el italiano no se cuelan en la X espanola', () => {
    const b = botonCerrar(pinta('es', Modal))
    expect(b).not.toContain('Close')
    expect(b).not.toContain('Chiudi')
  })
})

// ── La guardia: ningun boton de solo icono sin nombre ───────────────────────
//
// Un boton cuyo UNICO hijo es un icono (`<button …><X … /></button>`) no tiene
// texto que el lector de pantalla pueda leer. Tiene que llevar `aria-label`,
// `aria-labelledby` o `title`. Mira `components/` y `app/`.

const raiz = join(__dirname, '..', '..', '..')

function* tsx(dir: string): Generator<string> {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (n === 'node_modules' || n === '.next') continue
    if (statSync(p).isDirectory()) yield* tsx(p)
    else if (p.endsWith('.tsx') && !p.includes('.test.')) yield p
  }
}

function botonesDeSoloIconoSinNombre(src: string): number[] {
  const lineas: number[] = []
  const re = />\s*<([A-Z]\w*)\b[^<>]*\/>\s*<\/(button|Dialog\.Close|Button)>/g
  for (const m of src.matchAll(re)) {
    const abre = src.slice(src.lastIndexOf(`<${m[2]}`, m.index), m.index + 1)
    if (!/aria-label|aria-labelledby|title=/.test(abre)) lineas.push(src.slice(0, m.index).split('\n').length)
  }
  return lineas
}

describe('B71 · la guardia de botones de solo icono', () => {
  it('sus reglas: muerde sin nombre, calla con aria-label o title, y con texto', () => {
    expect(botonesDeSoloIconoSinNombre('<button type="button" onClick={f}><X className="h-3" /></button>')).toEqual([1])
    expect(botonesDeSoloIconoSinNombre('<Dialog.Close className="a">\n  <X className="h-4" />\n</Dialog.Close>')).toEqual([1])
    expect(botonesDeSoloIconoSinNombre('<button aria-label={t("x")}><X /></button>')).toEqual([])
    expect(botonesDeSoloIconoSinNombre('<button title={t("x")}><X /></button>')).toEqual([])
    expect(botonesDeSoloIconoSinNombre('<Button><X className="h-3" /> {t("comun.cancelar")}</Button>')).toEqual([])
  })

  it('NEGATIVO · ningun boton de solo icono de la aplicacion se queda sin nombre', () => {
    const hallazgos: string[] = []
    for (const carpeta of ['components', 'app']) {
      for (const f of tsx(join(raiz, carpeta))) {
        for (const l of botonesDeSoloIconoSinNombre(readFileSync(f, 'utf8'))) {
          hallazgos.push(`${relative(raiz, f).replace(/\\/g, '/')}:${l}`)
        }
      }
    }
    expect(hallazgos).toEqual([])
  })
})
