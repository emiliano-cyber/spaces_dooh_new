import { describe, it, expect } from 'vitest'
import { planearRentaMasiva, type SitioRenta, type ContratoRenta } from './renta-masiva'

// ============================================================================
//  Cambio masivo de renta: de pantallas seleccionadas a contratos a tocar.
//
//  Los dos conjuntos NO coinciden, y ahí está todo el riesgo. Un contrato de
//  predio lo comparten todas sus caras, así que:
//
//   · 5 pantallas de un predio = 1 contrato (no 5).
//   · seleccionar 2 de 5 caras toca igual a las otras 3.
//
//  Ambas cosas son dinero: la primera dispara el importe o miente en el
//  resumen; la segunda cambia lo que se le paga a un propietario sin que nadie
//  lo haya pedido.
// ============================================================================

// Predio P1: tres caras, un solo contrato (C-P1).
// Predio P2: una cara, contrato propio del predio (C-P2).
// S9 y S10: pantallas sueltas, cada una con su contrato.
const TODAS: SitioRenta[] = [
  { id: 'S1', predioId: 'P1' },
  { id: 'S2', predioId: 'P1' },
  { id: 'S3', predioId: 'P1' },
  { id: 'S4', predioId: 'P2' },
  { id: 'S9', predioId: null },
  { id: 'S10', predioId: null },
  { id: 'S11', predioId: null }, // sin contrato
]

const CONTRATOS: Record<string, ContratoRenta> = {
  P1: { contratoId: 'C-P1', renta: 30000, dePredio: true },
  P2: { contratoId: 'C-P2', renta: 10000, dePredio: true },
  S9: { contratoId: 'C-S9', renta: 5000, dePredio: false },
  S10: { contratoId: 'C-S10', renta: 0, dePredio: false }, // INCOMPLETO, sin importe
}

const contratoDe = (s: SitioRenta): ContratoRenta | null =>
  (s.predioId ? CONTRATOS[s.predioId] : CONTRATOS[s.id]) ?? null

const sitios = (...ids: string[]) => TODAS.filter((s) => ids.includes(s.id))
const plan = (ids: string[], modo: 'fijar' | 'ajustar', valor: number) =>
  planearRentaMasiva(sitios(...ids), TODAS, contratoDe, modo, valor)

describe('deduplicación: pantallas del mismo predio son UN contrato', () => {
  it('tres caras de un predio producen un solo cambio', () => {
    // Sin esto se mandarían 3 PATCH al mismo contrato y el resumen diría
    // «3 rentas actualizadas» donde hubo una.
    const p = plan(['S1', 'S2', 'S3'], 'fijar', 45000)
    expect(p.cambios).toEqual([{ contratoId: 'C-P1', montoRenta: 45000 }])
  })

  it('el porcentaje se aplica UNA vez, no una por cara', () => {
    // El fallo caro: 30000 +10% debe dar 33000, nunca 30000×1.1³ = 39930.
    const p = plan(['S1', 'S2', 'S3'], 'ajustar', 10)
    expect(p.cambios).toHaveLength(1)
    expect(p.cambios[0].montoRenta).toBe(33000)
  })

  it('pantallas sueltas sí producen un cambio cada una', () => {
    const p = plan(['S9', 'S1'], 'fijar', 7000)
    expect(p.cambios.map((c) => c.contratoId).sort()).toEqual(['C-P1', 'C-S9'])
  })
})

describe('alcance real: a quién más le cambia la renta', () => {
  it('seleccionar UNA cara de un predio alcanza a sus hermanas', () => {
    // Es el aviso que separa un efecto colateral de una sorpresa: se cambia la
    // renta de S1 y de paso la de S2 y S3, porque el contrato es uno.
    const p = plan(['S1'], 'fijar', 45000)
    expect(p.alcanceExtra).toBe(2)
  })

  it('sin hermanas fuera de la selección, no hay alcance extra', () => {
    const p = plan(['S1', 'S2', 'S3'], 'fijar', 45000)
    expect(p.alcanceExtra).toBe(0)
  })

  it('una pantalla suelta nunca arrastra a nadie', () => {
    const p = plan(['S9'], 'fijar', 7000)
    expect(p.alcanceExtra).toBe(0)
  })

  it('cuenta el alcance de varios predios a la vez', () => {
    // S1 arrastra a S2 y S3; S4 es hijo único de P2.
    const p = plan(['S1', 'S4'], 'fijar', 45000)
    expect(p.cambios).toHaveLength(2)
    expect(p.alcanceExtra).toBe(2)
  })
})

describe('importes que no se pueden aplicar', () => {
  it('un contrato sin importe se omite al ajustar por porcentaje', () => {
    // 0 × 1.1 = 0, y un 0 se leería como «el espacio es gratis». No hay sobre
    // qué aplicar un %: lo correcto es capturar el importe primero.
    const p = plan(['S10'], 'ajustar', 10)
    expect(p.cambios).toHaveLength(0)
    expect(p.omitidosSinImporte).toBe(1)
  })

  it('pero SÍ se le puede fijar un importe', () => {
    // Fijar no depende del valor previo, así que aquí sí tiene sentido.
    const p = plan(['S10'], 'fijar', 8000)
    expect(p.cambios).toEqual([{ contratoId: 'C-S10', montoRenta: 8000 }])
    expect(p.omitidosSinImporte).toBe(0)
  })

  it('un descuento que deja la renta en cero o menos se omite', () => {
    const p = plan(['S9'], 'ajustar', -100)
    expect(p.cambios).toHaveLength(0)
    expect(p.omitidosSinImporte).toBe(1)
  })

  it('una pantalla sin contrato se cuenta aparte, no revienta el plan', () => {
    const p = plan(['S11', 'S9'], 'fijar', 7000)
    expect(p.sinContrato).toBe(1)
    // La que sí tiene contrato se aplica igual.
    expect(p.cambios).toEqual([{ contratoId: 'C-S9', montoRenta: 7000 }])
  })
})

describe('casos borde', () => {
  it('sin selección no hay nada que hacer', () => {
    const p = plan([], 'fijar', 45000)
    expect(p.cambios).toHaveLength(0)
    expect(p.alcanceExtra).toBe(0)
    expect(p.sinContrato).toBe(0)
  })

  it('un ajuste de 0% deja el importe igual y sigue siendo un cambio válido', () => {
    // No se filtra: el usuario pidió 0%, y el resultado es un importe legal.
    const p = plan(['S9'], 'ajustar', 0)
    expect(p.cambios).toEqual([{ contratoId: 'C-S9', montoRenta: 5000 }])
  })

  it('el ajuste redondea a pesos enteros', () => {
    const p = plan(['S9'], 'ajustar', 7.5) // 5000 × 1.075 = 5375
    expect(p.cambios[0].montoRenta).toBe(5375)
  })
})
