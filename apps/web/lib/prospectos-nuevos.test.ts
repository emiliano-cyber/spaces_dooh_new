import { describe, expect, it } from 'vitest'
import { DIAS_NUEVO, MAX_NUEVOS, diasDesde, prospectosNuevos, type FilaProspectoNuevo } from './prospectos-nuevos'

// 19/11 · «Prospectos nuevos» en el Resumen de Propuestas: los dados de alta
// en los últimos DIAS_NUEVO días, más recientes primero, hasta MAX_NUEVOS.

const AHORA = new Date('2026-11-19T18:00:00Z')
const haceDias = (d: number, h = 0) => new Date(AHORA.getTime() - (d * 24 + h) * 3_600_000).toISOString()

const fila = (f: Partial<FilaProspectoNuevo>): FilaProspectoNuevo => ({
  id: 'p1',
  nombre: 'Panadería Sol',
  etapa: 'PROSPECTO',
  vendedor: 'Ana',
  creadoEn: haceDias(1),
  contactoNombre: null,
  telefono: null,
  email: null,
  razonSocial: null,
  ...f,
})

describe('diasDesde', () => {
  it('cuenta días completos y nunca da negativo', () => {
    expect(diasDesde(haceDias(0, 3), AHORA)).toBe(0)
    expect(diasDesde(haceDias(2, 5), AHORA)).toBe(2)
    // Un reloj del servidor un poco atrasado respecto a la base no da «hace -1 días».
    expect(diasDesde(new Date(AHORA.getTime() + 60_000).toISOString(), AHORA)).toBe(0)
  })
})

describe('prospectosNuevos', () => {
  it('la ventana es de 7 días y caben 6', () => {
    expect(DIAS_NUEVO).toBe(7)
    expect(MAX_NUEVOS).toBe(6)
  })

  it('los más recientes primero, con los días desde el alta', () => {
    const r = prospectosNuevos(
      [fila({ id: 'viejo', creadoEn: haceDias(5) }), fila({ id: 'hoy', creadoEn: haceDias(0, 2) }), fila({ id: 'ayer', creadoEn: haceDias(1) })],
      AHORA,
    )
    expect(r.lista.map((p) => [p.id, p.dias])).toEqual([
      ['hoy', 0],
      ['ayer', 1],
      ['viejo', 5],
    ])
    expect(r.total).toBe(3)
    expect(r.dias).toBe(7)
  })

  it('deja fuera lo de hace más de 7 días', () => {
    const r = prospectosNuevos([fila({ id: 'dentro', creadoEn: haceDias(6, 23) }), fila({ id: 'fuera', creadoEn: haceDias(7, 1) })], AHORA)
    expect(r.lista.map((p) => p.id)).toEqual(['dentro'])
    expect(r.total).toBe(1)
  })

  it('deja fuera los perdidos y los rechazados: ya no hay nada que trabajar', () => {
    const r = prospectosNuevos(
      [fila({ id: 'a', etapa: 'CONTACTADO' }), fila({ id: 'b', etapa: 'PERDIDO' }), fila({ id: 'c', etapa: 'RECHAZADO' })],
      AHORA,
    )
    expect(r.lista.map((p) => p.id)).toEqual(['a'])
  })

  it('corta en 6, pero el total dice cuántos hay', () => {
    const filas = Array.from({ length: 9 }, (_, i) => fila({ id: `p${i}`, creadoEn: haceDias(0, i) }))
    const r = prospectosNuevos(filas, AHORA)
    expect(r.lista).toHaveLength(6)
    expect(r.lista[0].id).toBe('p0')
    expect(r.total).toBe(9)
  })

  it('sin ninguno, lista vacía y total cero', () => {
    expect(prospectosNuevos([], AHORA)).toEqual({ dias: 7, total: 0, lista: [] })
  })
})
