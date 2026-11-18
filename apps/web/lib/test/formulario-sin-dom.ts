// ============================================================================
//  lib/test/formulario-sin-dom.ts — TECLEAR Y GUARDAR UN FORMULARIO SIN DOM.
// ----------------------------------------------------------------------------
//  Para la captura de cifras por idioma (P-L2-1, 04/11): hace falta probar que
//  un formulario REAL, en italiano, con «12,9» tecleado en el ancho, MANDA
//  12.9 al servidor. Este repo no tiene jsdom (`vitest.config.ts`), así que no
//  hay eventos; pero un formulario de React no necesita el DOM para guardar,
//  necesita tres cosas que aquí se fingen sin tocar el componente:
//
//   1. Que el ESTADO sobreviva entre renders: `useState` se sustituye por uno
//      que guarda cada valor por su posición de llamada (la regla de los hooks
//      garantiza que la posición es estable). `reactConEstado`.
//   2. Que los manejadores se puedan llamar: `react/jsx-runtime` se envuelve y
//      apunta las propiedades de cada `<input>`, `<select>` y `<button>`
//      intrínseco del último render. `jsxQueApunta`.
//   3. Volver a rendir tras cada «tecla», como haría React.
//
//  Lo que NO hace: efectos (`useEffect` no corre en `renderToStaticMarkup`),
//  foco, cursor. Teclear se finge como PEGAR el texto entero
//  (`inputType: 'insertFromPaste'`), que es el camino en el que `CampoCifra`
//  no reformatea y lee lo pegado tal cual.
// ============================================================================

import type * as ReactNS from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

export interface Elemento {
  tipo: string
  props: Record<string, unknown>
}

type Efecto = { k: number; fn: () => unknown; deps?: readonly unknown[] }

export const tienda = {
  valores: new Map<number, unknown>(),
  i: 0,
  elementos: [] as Elemento[],
  /** Solo con `montar(…, { efectos: true })`: si no, `useEffect` no hace nada, como en el servidor. */
  conEfectos: false,
  e: 0,
  efectos: [] as Efecto[],
  depsPrevias: new Map<number, readonly unknown[] | undefined>(),
  cambios: 0,
  /**
   * Solo con `montar(…, { refs: true })`: `useRef` recuerda entre renders,
   * como en el navegador. Sin él es el `useRef` del servidor, que nace en cada
   * render (lo de siempre: así las pruebas de antes no cambian).
   */
  conRefs: false,
  refs: new Map<number, { current: unknown }>(),
  r: 0,
}

export function reiniciarTienda(): void {
  tienda.valores.clear()
  tienda.i = 0
  tienda.elementos = []
  tienda.conEfectos = false
  tienda.e = 0
  tienda.efectos = []
  tienda.depsPrevias.clear()
  tienda.cambios = 0
  tienda.conRefs = false
  tienda.refs.clear()
  tienda.r = 0
}

function correrEfectos(): void {
  const pendientes = tienda.efectos
  tienda.efectos = []
  for (const ef of pendientes) {
    const previas = tienda.depsPrevias.get(ef.k)
    const primera = !tienda.depsPrevias.has(ef.k)
    const cambian =
      primera || !ef.deps || !previas || ef.deps.length !== previas.length || ef.deps.some((d, i) => !Object.is(d, previas[i]))
    tienda.depsPrevias.set(ef.k, ef.deps)
    if (cambian) ef.fn()
  }
}

/** `react` con un `useState` que recuerda entre renders. */
export function reactConEstado(real: typeof ReactNS): typeof ReactNS {
  function useState(inicial?: unknown) {
    const k = tienda.i++
    if (!tienda.valores.has(k)) {
      tienda.valores.set(k, typeof inicial === 'function' ? (inicial as () => unknown)() : inicial)
    }
    const fijar = (v: unknown) => {
      const previo = tienda.valores.get(k)
      const nuevo = typeof v === 'function' ? (v as (p: unknown) => unknown)(previo) : v
      if (!Object.is(nuevo, previo)) tienda.cambios++
      tienda.valores.set(k, nuevo)
    }
    return [tienda.valores.get(k), fijar]
  }
  // En el servidor `useEffect` no hace nada; aquí, con `efectos: true`, se
  // apuntan y corren tras el render, como en el navegador (sin limpiezas).
  function useEffect(fn: () => unknown, deps?: readonly unknown[]) {
    const k = tienda.e++
    if (tienda.conEfectos) tienda.efectos.push({ k, fn, deps })
  }
  function useRef(inicial?: unknown) {
    if (!tienda.conRefs) return real.useRef(inicial)
    const k = tienda.r++
    if (!tienda.refs.has(k)) tienda.refs.set(k, { current: inicial })
    return tienda.refs.get(k)
  }
  const r = { useState, useEffect, useLayoutEffect: useEffect, useRef }
  return { ...real, ...r, default: { ...real, ...r } } as unknown as typeof ReactNS
}

const APUNTADOS = new Set(['input', 'select', 'button', 'textarea'])

/** `react/jsx-runtime` (o el de desarrollo) que apunta los controles. */
export function jsxQueApunta<T extends Record<string, unknown>>(real: T): T {
  const envolver = (fn: unknown) =>
    typeof fn === 'function'
      ? (tipo: unknown, props: Record<string, unknown>, ...resto: unknown[]) => {
          if (typeof tipo === 'string' && APUNTADOS.has(tipo)) tienda.elementos.push({ tipo, props })
          return (fn as (...a: unknown[]) => unknown)(tipo, props, ...resto)
        }
      : fn
  return { ...real, jsx: envolver(real.jsx), jsxs: envolver(real.jsxs), jsxDEV: envolver(real.jsxDEV) }
}

/** El texto plano de unos `children` de React. */
export function textoDe(n: unknown): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textoDe).join('')
  if (typeof n === 'object' && 'props' in (n as object)) return textoDe((n as { props: { children?: unknown } }).props.children)
  return ''
}

/** Un formulario montado: se rinde, se teclea y se pulsa. */
export function montar(elemento: () => ReactElement, opciones: { efectos?: boolean; refs?: boolean } = {}) {
  let html = ''
  tienda.conEfectos = !!opciones.efectos
  tienda.conRefs = !!opciones.refs
  const rendir = () => {
    tienda.i = 0
    tienda.e = 0
    tienda.r = 0
    tienda.elementos = []
    tienda.efectos = []
    html = renderToStaticMarkup(elemento())
    if (tienda.conEfectos) correrEfectos()
    return html
  }
  rendir()
  const buscar = (tipo: string, pred: (p: Record<string, unknown>) => boolean, que: string) => {
    const e = tienda.elementos.filter((x) => x.tipo === tipo && pred(x.props))
    if (e.length !== 1) throw new Error(`${que}: ${e.length} coincidencias en el último render`)
    return e[0]
  }
  return {
    get html() {
      return html
    },
    rendir,
    /** Deja terminar lo asíncrono (cargas de `useEffect`) y vuelve a rendir hasta que nada cambie. */
    async asentar() {
      for (let vuelta = 0; vuelta < 10; vuelta++) {
        const antes = tienda.cambios
        await new Promise((r) => setTimeout(r, 0))
        if (tienda.cambios === antes) break
        rendir()
      }
    },
    /**
     * El `<input>` cuyo placeholder o aria-label contiene `texto` (o ES `texto`,
     * con `exacto`).
     */
    campo(texto: string, exacto = false) {
      const casa = (v: unknown) => (exacto ? String(v ?? '') === texto : String(v ?? '').includes(texto))
      return buscar('input', (p) => casa(p.placeholder) || casa(p['aria-label']), `campo «${texto}»`)
    },
    /** Pega `valor` en el campo (se busca como en `campo`) y vuelve a rendir. */
    teclear(texto: string, valor: string, exacto = false) {
      const e = this.campo(texto, exacto)
      ;(e.props.onChange as (ev: unknown) => void)({
        target: { value: valor, selectionStart: valor.length, checked: false },
        nativeEvent: { inputType: 'insertFromPaste' },
      })
      rendir()
    },
    /**
     * Teclea `valor` TECLA A TECLA al final del campo, como un navegador:
     * cada carácter es un `onChange` con `inputType: 'insertText'` sobre el
     * valor que pintó el render anterior, y se vuelve a rendir. Es el camino
     * en el que `CampoCifra` recoloca los separadores (B77): pegar no lo
     * ejerce.
     */
    teclearTeclaATecla(texto: string, valor: string, exacto = false) {
      for (const ch of valor) {
        const e = this.campo(texto, exacto)
        const actual = String(e.props.value ?? '')
        const nuevo = actual + ch
        ;(e.props.onChange as (ev: unknown) => void)({
          target: { value: nuevo, selectionStart: nuevo.length, checked: false },
          nativeEvent: { inputType: 'insertText' },
        })
        rendir()
      }
    },
    /**
     * Sale del campo (su `onBlur`) y vuelve a rendir. D18: el aviso de una
     * cifra a medias («1,5») sale aquí, no mientras se teclea.
     */
    salir(texto: string, exacto = false) {
      ;(this.campo(texto, exacto).props.onBlur as ((ev: unknown) => void) | undefined)?.({ target: {} })
      rendir()
    },
    /** Pulsa una tecla (`onKeyDown`) en el campo y vuelve a rendir. */
    pulsarTecla(texto: string, tecla: string, exacto = false) {
      ;(this.campo(texto, exacto).props.onKeyDown as ((ev: unknown) => void) | undefined)?.({ key: tecla, preventDefault() {} })
      rendir()
    },
    /** Teclea en el n-ésimo `<input>` sin placeholder ni etiqueta que lo distinga. */
    teclearEn(e: Elemento, valor: string) {
      ;(e.props.onChange as (ev: unknown) => void)({
        target: { value: valor, selectionStart: valor.length, checked: valor === 'true' },
        nativeEvent: { inputType: 'insertFromPaste' },
      })
      rendir()
    },
    elementos: (tipo: string) => tienda.elementos.filter((x) => x.tipo === tipo),
    /** Pulsa el botón cuyo texto contiene `texto`; espera su promesa y vuelve a rendir. */
    async pulsar(texto: string, opciones: { aunqueApagado?: boolean } = {}) {
      const e = buscar('button', (p) => textoDe(p.children).includes(texto), `botón «${texto}»`)
      // `aunqueApagado`: el manejador se llama igual, como lo haría un Enter
      // o un doble clic que se cuela. Es la guardia de dentro, no la del botón.
      if (e.props.disabled && !opciones.aunqueApagado) throw new Error(`el botón «${texto}» está deshabilitado`)
      await (e.props.onClick as (ev: unknown) => unknown)?.({ preventDefault() {} })
      rendir()
    },
    /** Pulsa un botón ya localizado (si no está deshabilitado) y vuelve a rendir. */
    async pulsarBoton(e: Elemento) {
      if (!e.props.disabled) await (e.props.onClick as (ev: unknown) => unknown)?.({ preventDefault() {} })
      rendir()
    },
    botonDeshabilitado(texto: string) {
      return !!buscar('button', (p) => textoDe(p.children).includes(texto), `botón «${texto}»`).props.disabled
    },
  }
}
