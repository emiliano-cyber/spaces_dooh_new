import { describe, it, expect } from 'vitest'
import { planoDesdeLiga, type PlanoVallasLiga } from './plano-publico'

// ============================================================================
//  LIGA DEL CLIENTE (dueño, 20/11) · lo que manda el servidor en la liga
//  (`planoVallas`) se convierte en el plano de siempre, sin ocupación: el
//  cliente no ve lo libre ni lo ocupado de nadie, solo SUS vallas.
// ============================================================================

const LIGA: PlanoVallasLiga = {
  sitios: [
    { id: 'S1', nombre: 'Periférico Sur 4500' },
    { id: 'S2', nombre: 'Avenida Central' },
  ],
  vallas: [
    { id: 'v1', sitioId: 'S1', numero: 'V-001', cara: 1, ancho: 6, alto: 3, grupoId: 'g1', posicion: 1, dobla: 'derecha' },
    { id: 'v2', sitioId: 'S1', numero: 'V-002', cara: 1, ancho: 6, alto: 3, grupoId: 'g1', posicion: 2, dobla: null },
    { id: 'v3', sitioId: 'S2', numero: 'V-003', cara: null, ancho: 12, alto: 3, grupoId: null, posicion: null, dobla: null },
  ],
  grupos: [{ id: 'g1', numero: 'G-001', nombre: null, modo: 'una_imagen', sigueFuera: true }],
}

describe('planoDesdeLiga', () => {
  it('un dibujo por sitio, en orden de nombre, con todos los cuadros', () => {
    const p = planoDesdeLiga(LIGA)
    expect(p.map((s) => s.nombre)).toEqual(['Avenida Central', 'Periférico Sur 4500'])
    const numeros = p.flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.cuadros.map((c) => c.numero))))
    expect(numeros.sort()).toEqual(['V-001', 'V-002', 'V-003'])
  })

  it('sin ocupación: ningún cuadro lleva ocupantes', () => {
    const cuadros = planoDesdeLiga(LIGA).flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.cuadros)))
    expect(cuadros.every((c) => c.ocupantes.length === 0)).toBe(true)
  })

  it('el grupo que sigue fuera de la propuesta lo dice; la esquina se conserva', () => {
    const s1 = planoDesdeLiga(LIGA).find((s) => s.sitioId === 'S1')!
    expect(s1.filas[0].bloques[0].grupo).toMatchObject({ numero: 'G-001', cruzaSitio: true })
    expect(s1.filas[0].tramos).toHaveLength(2)
    expect(s1.filas[0].tramos[1].gira).toBe('derecha')
  })
})

describe('mostrarPlanoEnLiga', () => {
  it('solo con más de una valla', async () => {
    const { mostrarPlanoEnLiga } = await import('./plano-publico')
    expect(mostrarPlanoEnLiga(null)).toBe(false)
    expect(mostrarPlanoEnLiga(undefined)).toBe(false)
    expect(mostrarPlanoEnLiga({ ...LIGA, vallas: LIGA.vallas.slice(0, 1) })).toBe(false)
    expect(mostrarPlanoEnLiga({ ...LIGA, vallas: LIGA.vallas.slice(0, 2) })).toBe(true)
  })
})
