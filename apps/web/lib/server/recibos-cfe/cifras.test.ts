import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cifraDeRecibo } from './cifras'

// ============================================================================
//  R4 · Ni kWh ni importe se guardan en CERO o en negativo.
// ----------------------------------------------------------------------------
//  Regla del dueño, 2026-09-29. Dos mitades, y las dos estan aqui:
//
//   1. La regla en si —`cifraDeRecibo`—, que se prueba sola.
//   2. Un guard que LEE `energia-controller.ts` y comprueba que la usa. Sin el,
//      alguien vuelve a escribir `.min(0)` a mano dentro del schema del
//      controller y las pruebas de arriba siguen en verde probando un modulo
//      que ya no protege nada. Es exactamente lo que pasa cuando una regla vive
//      en un sitio y la puerta en otro.
// ============================================================================

const cifra = cifraDeRecibo('Captura los kWh del recibo')

describe('cifraDeRecibo', () => {
  it('acepta un numero positivo', () => {
    expect(cifra.safeParse(1500).success).toBe(true)
  })

  it('acepta un decimal positivo, que es lo que trae un importe', () => {
    expect(cifra.safeParse(7940.44).success).toBe(true)
  })

  it('acepta el numero escrito como TEXTO, que es lo que manda un formulario', () => {
    const r = cifra.safeParse('3000')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe(3000)
  })

  it('RECHAZA el cero', () => {
    expect(cifra.safeParse(0).success).toBe(false)
  })

  it('RECHAZA el cero escrito como texto', () => {
    // Sin esto, un `'0'` del formulario pasa la coercion y entra como cero.
    expect(cifra.safeParse('0').success).toBe(false)
    expect(cifra.safeParse('0.00').success).toBe(false)
  })

  it('RECHAZA un negativo', () => {
    // En un recibo eso es una nota de credito: sumado como consumo RESTARIA
    // costo y mejoraria el margen sin que nada lo dijera.
    expect(cifra.safeParse(-1).success).toBe(false)
    expect(cifra.safeParse('-500').success).toBe(false)
  })

  it('RECHAZA lo que no es un numero, y lo dice con el mensaje del recibo', () => {
    const r = cifra.safeParse('tres mil')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Captura los kWh del recibo')
  })

  it('RECHAZA infinito y NaN', () => {
    expect(cifra.safeParse(Infinity).success).toBe(false)
    expect(cifra.safeParse(NaN).success).toBe(false)
  })

  it('el mensaje del cero dice QUE pasa, no que regla de tipos fallo', () => {
    const r = cifra.safeParse(0)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/mayor que cero/i)
  })
})

describe('energia-controller USA esta regla', () => {
  const FUENTE = readFileSync(join(__dirname, '..', 'energia-controller.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

  it('importa `cifraDeRecibo` en vez de escribir su propia regla', () => {
    expect(FUENTE).toMatch(/import \{ cifraDeRecibo \} from '\.\/recibos-cfe\/cifras'/)
    expect(FUENTE).toMatch(/cifraDeRecibo\(/)
  })

  it('NO deja un `.min(0)` suelto, que es la regla vieja que admitia el cero', () => {
    expect(FUENTE, 'vuelve a admitir el cero').not.toMatch(/\.min\(\s*0\s*[,)]/)
  })
})
