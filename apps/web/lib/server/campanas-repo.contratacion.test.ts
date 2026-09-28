import { describe, it, expect, vi } from 'vitest'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const { rowToReserva } = await import('./campanas-repo')

// ============================================================================
//  La reserva tiene que poder CONTAR cómo se contrató, no solo cuánto costó.
// ----------------------------------------------------------------------------
//  `reservas` guarda `unidad`, `cantidad`, `tarifa_unitaria` y `spots_por_dia`
//  desde la migración `20260721_propuesta_unidad_spots.sql`, y la campaña los
//  hereda de la propuesta (`campanas-repo.ts`, inserción desde propuesta). Pero
//  `rowToReserva` no los exponía, así que ninguna pantalla podía enseñarlos:
//  se vendían 50 spots y el 50 moría en la base.
//
//  Lo que estas pruebas anclan es el BORDE: los cuatro campos salen, con el tipo
//  correcto, y `cantidad` y `spotsPorDia` salen por separado. Un mapeo que los
//  fundiera reviviría DATA-02 sin dar ningún error.
// ============================================================================

const fila = (over: Record<string, unknown> = {}) => ({
  id: 'R1',
  campana_id: 'C1',
  sitio_id: 'S1',
  fecha_inicio: '2026-02-01',
  fecha_fin: '2026-02-28',
  precio: '60000.00',
  tipo_venta: 'FIXED_PKG',
  estatus: 'CONFIRMADA',
  spots_reservados: 3,
  expira_en: null,
  creativos: [],
  creado_en: '2026-02-01T00:00:00.000Z',
  unidad: 'spot',
  cantidad: '50',
  tarifa_unitaria: '1200.00',
  spots_por_dia: 12,
  ...over,
})

describe('rowToReserva — la contratación viaja hasta la pantalla', () => {
  it('expone unidad, cantidad y tarifa unitaria, ya como números', () => {
    // `numeric` llega del driver como TEXTO. Sin el `Number()`, «50» × 1200
    // funciona por coerción pero «50» + 1 da «501», y la fila diría «501 spots».
    const r = rowToReserva(fila())
    expect(r.unidad).toBe('spot')
    expect(r.cantidad).toBe(50)
    expect(r.tarifaUnitaria).toBe(1200)
    expect(r.spotsPorDia).toBe(12)
  })

  it('NEGATIVA · `cantidad` y `spotsPorDia` son DOS campos distintos', () => {
    // DATA-02: los 50 son el precio y los 12 la programación. Un mapeo que
    // copiara uno en el otro pasaría todas las demás pruebas.
    const r = rowToReserva(fila({ cantidad: '50', spots_por_dia: 12 }))
    expect(r.cantidad).not.toBe(r.spotsPorDia)
    expect(r.cantidad).toBe(50)
    expect(r.spotsPorDia).toBe(12)
  })

  it('NEGATIVA · sin programación capturada `spotsPorDia` es null, no 0', () => {
    // Está en NULL en toda la producción de hoy. Un 0 afirmaría «no sale nunca».
    expect(rowToReserva(fila({ spots_por_dia: null })).spotsPorDia).toBeNull()
  })

  it('una reserva anterior a la migración se lee como mensual × 1', () => {
    // El default de la migración, y el respaldo del mapeo: las filas viejas no
    // pueden salir con la unidad vacía.
    const r = rowToReserva(fila({ unidad: null, cantidad: null, tarifa_unitaria: null }))
    expect(r.unidad).toBe('mensual')
    expect(r.cantidad).toBe(1)
    expect(r.tarifaUnitaria).toBeNull()
  })

  it('no se pierde nada de lo que ya exponía', () => {
    const r = rowToReserva(fila())
    expect(r.precio).toBe(60000)
    expect(r.spotsReservados).toBe(3)
    expect(r.estatus).toBe('CONFIRMADA')
  })
})
