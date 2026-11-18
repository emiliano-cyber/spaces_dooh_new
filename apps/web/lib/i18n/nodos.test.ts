import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { interpolarNodos } from './nodos'

const pintar = (n: ReturnType<typeof interpolarNodos>) => renderToStaticMarkup(createElement('p', null, n))

describe('interpolarNodos · huecos que son elementos', () => {
  it('pone cada elemento en su hueco y respeta el orden de la frase', () => {
    const b = (t: string) => createElement('b', null, t)
    expect(pintar(interpolarNodos('Neto {neto} de {total}', { neto: b('850'), total: '4,845' }))).toBe(
      '<p>Neto <b>850</b> de 4,845</p>',
    )
    // El MISMO par de valores en otro orden: es la razon de existir de esto.
    expect(pintar(interpolarNodos('{total} total, {neto} net', { neto: b('850'), total: '4,845' }))).toBe(
      '<p>4,845 total, <b>850</b> net</p>',
    )
  })

  it('pinta lo mismo que el texto escrito a mano en JSX', () => {
    // Lo que importa al extraer textos: el espanol tiene que salir IDENTICO.
    const aMano = renderToStaticMarkup(
      createElement('p', null, 'Bruto ', createElement('span', null, '$ 1.00'), ' fin'),
    )
    const extraido = pintar(interpolarNodos('Bruto {monto} fin', { monto: createElement('span', null, '$ 1.00') }))
    expect(extraido).toBe(aMano)
  })

  it('un hueco sin valor se deja tal cual, nunca «undefined»', () => {
    expect(pintar(interpolarNodos('Van {n}', {}))).toBe('<p>Van {n}</p>')
  })

  it('un texto sin huecos sale entero', () => {
    expect(pintar(interpolarNodos('Sin huecos.', {}))).toBe('<p>Sin huecos.</p>')
  })
})
