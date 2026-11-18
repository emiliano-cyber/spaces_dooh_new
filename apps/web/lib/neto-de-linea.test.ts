import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { netosDelSnapshot } from './neto-de-linea'

// ============================================================================
//  B56 · cada reserva hereda el neto de SU línea, no el de la última.
// ----------------------------------------------------------------------------
//  `generarCampanaDesdePropuesta` (`lib/server/campanas-repo.ts`) armaba
//  `netoDeSnap` como un Map POR PANTALLA: con la misma pantalla dos veces en la
//  propuesta —el prime y la madrugada, o dos periodos— el Map se quedaba con la
//  ÚLTIMA entrada y las DOS reservas se guardaban con ese neto. Lo que se
//  factura no era lo cotizado, y nada daba error: el importe es plausible.
//
//  Cifras de las pruebas, a mano (sin descuento, comisión 10 % → × 0.9):
//    prime     30 000 → neto 27 000
//    madrugada  8 000 → neto  7 200
//  Con el defecto, las dos reservas salían a 7 200: se cobraban 14 400 de
//  34 200 cotizados.
// ============================================================================

const S1 = 'S1'
const PRIME = { id: 'I1', sitio_id: S1, franja_id: 'F-PRIME', precio: 30_000 }
const MADRUGADA = { id: 'I2', sitio_id: S1, franja_id: 'F-MADRUGADA', precio: 8_000 }

describe('1 · snapshot NUEVO (lleva `itemId`): se empareja por la línea misma', () => {
  it('dos FRANJAS de la misma pantalla: cada una con su neto', () => {
    const porSitio = [
      { itemId: 'I1', sitioId: S1, lista: 30_000, neto: 27_000, franja: { id: 'F-PRIME' } },
      { itemId: 'I2', sitioId: S1, lista: 8_000, neto: 7_200, franja: { id: 'F-MADRUGADA' } },
    ]
    expect(netosDelSnapshot([PRIME, MADRUGADA], porSitio)).toEqual([27_000, 7_200])
  })

  it('dos PERIODOS de la misma pantalla y la misma franja, incluso al mismo precio de lista', () => {
    // El volumen puede ser distinto por línea, y entonces el neto también: solo
    // la identidad de la línea lo distingue.
    const a = { id: 'I1', sitio_id: S1, franja_id: null, precio: 20_000 }
    const b = { id: 'I2', sitio_id: S1, franja_id: null, precio: 20_000 }
    const porSitio = [
      { itemId: 'I1', sitioId: S1, lista: 20_000, neto: 18_000, franja: null },
      { itemId: 'I2', sitioId: S1, lista: 20_000, neto: 16_200, franja: null },
    ]
    expect(netosDelSnapshot([a, b], porSitio)).toEqual([18_000, 16_200])
  })

  it('NEGATIVO · un ítem que no está en el snapshot NO toma el neto de otro → respaldo (null)', () => {
    const porSitio = [{ itemId: 'I1', sitioId: S1, lista: 30_000, neto: 27_000, franja: { id: 'F-PRIME' } }]
    expect(netosDelSnapshot([PRIME, MADRUGADA], porSitio)).toEqual([27_000, null])
  })
})

describe('2 · snapshot VIEJO (sin `itemId`): solo lo que el snapshot ya guarda', () => {
  it('una línea por pantalla: exactamente como antes', () => {
    const porSitio = [
      { sitioId: 'S1', lista: 30_000, neto: 27_000 },
      { sitioId: 'S2', lista: 8_000, neto: 7_200 },
    ]
    const items = [PRIME, { ...MADRUGADA, sitio_id: 'S2' }]
    expect(netosDelSnapshot(items, porSitio)).toEqual([27_000, 7_200])
  })

  it('dos FRANJAS: se desempata por la franja congelada', () => {
    const porSitio = [
      { sitioId: S1, lista: 30_000, neto: 27_000, franja: { id: 'F-PRIME' } },
      { sitioId: S1, lista: 8_000, neto: 7_200, franja: { id: 'F-MADRUGADA' } },
    ]
    expect(netosDelSnapshot([PRIME, MADRUGADA], porSitio)).toEqual([27_000, 7_200])
  })

  it('dos PERIODOS con distinta lista: se desempata por la lista (el precio de la línea)', () => {
    const a = { id: 'I1', sitio_id: S1, franja_id: null, precio: 30_000 }
    const b = { id: 'I2', sitio_id: S1, franja_id: null, precio: 8_000 }
    const porSitio = [
      { sitioId: S1, lista: 30_000, neto: 27_000 },
      { sitioId: S1, lista: 8_000, neto: 7_200 },
    ]
    expect(netosDelSnapshot([a, b], porSitio)).toEqual([27_000, 7_200])
  })

  it('dos líneas IDÉNTICAS con el mismo neto: ese neto (no hay nada que desempatar)', () => {
    const a = { id: 'I1', sitio_id: S1, franja_id: null, precio: 20_000 }
    const b = { id: 'I2', sitio_id: S1, franja_id: null, precio: 20_000 }
    const porSitio = [
      { sitioId: S1, lista: 20_000, neto: 18_000 },
      { sitioId: S1, lista: 20_000, neto: 18_000 },
    ]
    expect(netosDelSnapshot([a, b], porSitio)).toEqual([18_000, 18_000])
  })

  it('NEGATIVO · misma lista y netos DISTINTOS, sin forma de saber cuál es cuál → respaldo (null), nunca el de otra línea', () => {
    const a = { id: 'I1', sitio_id: S1, franja_id: null, precio: 20_000 }
    const b = { id: 'I2', sitio_id: S1, franja_id: null, precio: 20_000 }
    const porSitio = [
      { sitioId: S1, lista: 20_000, neto: 18_000 },
      { sitioId: S1, lista: 20_000, neto: 16_200 },
    ]
    expect(netosDelSnapshot([a, b], porSitio)).toEqual([null, null])
  })

  it('una pantalla que no está en el snapshot → respaldo (null), como antes', () => {
    expect(netosDelSnapshot([PRIME], [])).toEqual([null])
  })
})

describe('3 · el fuente: la campaña usa esto y el snapshot nuevo guarda la línea', () => {
  const RAIZ = join(__dirname)
  const sinComentarios = (f: string) =>
    f
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n')

  it('`campanas-repo` ya NO indexa el neto solo por pantalla', () => {
    const f = sinComentarios(readFileSync(join(RAIZ, 'server/campanas-repo.ts'), 'utf8'))
    expect(f).toMatch(/netosDelSnapshot\(/)
    expect(f).not.toMatch(/netoDeSnap\.get\(it\.sitio_id\)/)
  })

  it('`congelarSnapshotEconomico` guarda `itemId` en cada línea de `porSitio`', () => {
    const f = sinComentarios(readFileSync(join(RAIZ, 'server/propuestas-repo.ts'), 'utf8'))
    expect(f).toMatch(/itemId:\s*it\.id/)
  })
})
