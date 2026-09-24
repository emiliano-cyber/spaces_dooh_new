import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ============================================================================
//  El lenguaje de botones SET · fase 1
// ----------------------------------------------------------------------------
//  Se RINDE el componente de verdad y se lee la clase del <button> que sale.
//  No se leen los mapas `variants`/`sizes`: son privados, y afirmar sobre ellos
//  sería probar una constante, no el botón. Lo que aquí queda fijado es la
//  salida.
//
//  Sin jsdom y sin testing-library: `renderToStaticMarkup` corre en `node` a
//  pelo. Lo que eso NO alcanza está dicho en el §4 de abajo, no disimulado.
// ============================================================================

const VARIANTES = [
  'primary',
  'secondary',
  'tertiary',
  'danger',
  'dangerFill',
  'ghost',
  'icon',
] as const

// La clase que el navegador acabaría viendo, ya pasada por `cn`/tailwind-merge.
// Va TIPADO a proposito: si alguien quita una variante del union, `npm run
// typecheck` cae en `VARIANTES` antes de que corra una sola prueba.
type Props = Partial<import('./Button').ButtonProps>
async function clasesDe(props: Props = {}): Promise<string[]> {
  const { Button } = await import('./Button')
  const html = renderToStaticMarkup(React.createElement(Button, props, 'Etiqueta'))
  const m = html.match(/class="([^"]*)"/)
  if (!m) throw new Error('el boton salio sin atributo class: ' + html)
  return m[1].split(/\s+/).filter(Boolean)
}

describe('1 · las siete variantes existen y rinden lo suyo', () => {
  it('ninguna de las siete rinde vacia ni repite la clase de otra', async () => {
    const vistas = new Map<string, string>()
    for (const v of VARIANTES) {
      const clases = await clasesDe({ variant: v })
      // Una variante que se borrase del mapa no daria error: `variants[v]`
      // seria `undefined`, `cn` lo ignoraria y el boton saldria con las clases
      // base mas las del tamano — distinto de las demas, asi que el control de
      // duplicados de abajo no lo veria. Estas dos lineas son las que lo cazan:
      // ni la base ni los tamanos traen fondo ni borde, solo las variantes.
      expect(clases.some((c) => c.startsWith('bg-')), `${v} no rinde fondo: ¿existe en el mapa?`).toBe(true)
      expect(clases.some((c) => c.startsWith('border')), `${v} no rinde borde: ¿existe en el mapa?`).toBe(true)

      const unidas = clases.join(' ')
      const gemela = [...vistas.entries()].find(([, c]) => c === unidas)
      expect(gemela?.[0], `${v} rinde exactamente lo mismo que ${gemela?.[0]}`).toBeUndefined()
      vistas.set(v, unidas)
    }
    expect(vistas.size).toBe(7)
  })

  it('primario: relleno de accent, con su borde del mismo color', async () => {
    const c = await clasesDe({ variant: 'primary' })
    expect(c).toContain('bg-accent')
    expect(c).toContain('text-accent-fg')
    expect(c).toContain('border-accent')
  })

  // El corazon de la fase 1. El borde del secundario tiene que PEDIR
  // `--border-input` (#94876f, 3.53:1 sobre blanco) y no `--border-strong`
  // (#d9d0c1, 1.53:1), que es lo que pedia antes y no llega al minimo de
  // WCAG 1.4.11 para el contorno de un control.
  it('secundario: pide --border-input, y ya NO border-strong', async () => {
    const c = await clasesDe({ variant: 'secondary' })
    expect(c).toContain('border-[var(--border-input)]')
    expect(c).not.toContain('border-border-strong')
    expect(c).toContain('bg-surface')
    expect(c).toContain('text-accent-hover')
  })

  it('danger es de contorno y dangerFill es de relleno — no son la misma', async () => {
    const contorno = await clasesDe({ variant: 'danger' })
    const relleno = await clasesDe({ variant: 'dangerFill' })
    expect(contorno).toContain('bg-surface')
    expect(contorno).toContain('text-error')
    expect(relleno).toContain('bg-error')
    expect(relleno).toContain('text-white')
  })
})

describe('2 · el deshabilitado es solido, no translucido', () => {
  it('pinta fondo, texto y borde propios', async () => {
    const c = await clasesDe({ disabled: true })
    expect(c).toContain('disabled:bg-surface-2')
    expect(c).toContain('disabled:text-muted')
    expect(c).toContain('disabled:border-border-strong')
  })

  it('ya no baja la opacidad', async () => {
    // `opacity-50` sobre un boton apaga TAMBIEN su texto y su borde a la vez,
    // que es como un deshabilitado acaba por debajo del contraste minimo.
    const c = await clasesDe({ disabled: true })
    expect(c).not.toContain('disabled:opacity-50')
  })

  // La contradiccion del pliego, resuelta y fijada aqui para que no vuelva:
  // `cursor-not-allowed` NO se pone, porque `pointer-events-none` impide que el
  // elemento reciba eventos de puntero y el cursor no se llega a ver nunca.
  // Poner las dos dejaria una mentira en el codigo. Ver el comentario de
  // `Button.tsx`.
  it('no promete un cursor que nadie puede ver', async () => {
    const c = await clasesDe({ disabled: true })
    expect(c).toContain('disabled:pointer-events-none')
    expect(c.join(' ')).not.toContain('cursor-not-allowed')
  })
})

describe('3 · el tamano no se come el relleno de la variante', () => {
  // `cn` es twMerge: en un conflicto gana la ULTIMA clase. Si el tamano se
  // aplicara despues de la variante, el `px-4` de `md` borraria el `px-2.5` de
  // terciario/ghost y el `px-0` de icon, y las tres saldrian con el relleno del
  // boton normal. Esta prueba es la que caza ese orden.
  it('terciario y ghost conservan su px-2.5 en tamano md', async () => {
    for (const v of ['tertiary', 'ghost'] as const) {
      const c = await clasesDe({ variant: v, size: 'md' })
      expect(c, `${v} perdio su relleno`).toContain('px-2.5')
      expect(c, `${v} se quedo con el relleno del tamano`).not.toContain('px-4')
    }
  })

  it('icon conserva px-0 y su ancho fijo', async () => {
    const c = await clasesDe({ variant: 'icon', size: 'md' })
    expect(c).toContain('px-0')
    expect(c).toContain('w-9')
    expect(c).not.toContain('px-4')
  })

  it('los dos tamanos usan alto MINIMO, no alto fijo', async () => {
    // Un `h-10` recorta el boton cuando la etiqueta hace dos renglones.
    expect(await clasesDe({ size: 'sm' })).toContain('min-h-8')
    expect(await clasesDe({ size: 'md' })).toContain('min-h-10')
  })
})

describe('4 · la guarda de doble clic sigue cableada', () => {
  // Proteccion real contra dobles cobros (A5 / INC-07). Aqui se comprueba UNA
  // cosa y se dice cual: que rendir el boton sigue construyendo la guarda de
  // `lib/clic-unico`. El COMPORTAMIENTO de la guarda —que el segundo clic se
  // ignora, que es sincrona— vive probado en `lib/clic-unico.test.ts`, que este
  // cambio no toca.
  //
  // Lo que NO se prueba aqui, y no se finge: disparar un clic de verdad exige
  // un DOM, y este arnes corre en `node`. Si alguien desconectara la guarda del
  // manejador dejando la llamada en pie, esta prueba no lo veria.
  it('rendir un boton construye la guarda', async () => {
    vi.resetModules()
    const espia = vi.fn(() => ({ ocupado: () => false, seguir: () => false }))
    vi.doMock('@/lib/clic-unico', () => ({ guardaEnVuelo: espia }))

    const { Button } = await import('./Button')
    renderToStaticMarkup(React.createElement(Button, { onClick: () => {} }, 'Guardar'))

    expect(espia).toHaveBeenCalled()
    vi.doUnmock('@/lib/clic-unico')
    vi.resetModules()
  })
})
