import { describe, expect, it } from 'vitest'
import { conteoPorDia, diasEntre, ventanaDeDias, type FilaConteo } from './propuestas-por-dia'

// CONTEO-DIA (17/11) · cuántas campañas creó y cuántas le aprobaron a cada
// vendedor, día por día. Ver `docs/Plan_Conteo_Campanas_Por_Dia.md`.

const fila = (f: Partial<FilaConteo>): FilaConteo => ({
  creada: '2026-11-10',
  aprobada: null,
  estatus: 'BORRADOR',
  vendedorId: 'ana',
  vendedor: 'Ana',
  ...f,
})

describe('diasEntre', () => {
  it('incluye los dos extremos', () => {
    expect(diasEntre('2026-11-09', '2026-11-11')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
  })
  it('cruza el fin de mes', () => {
    expect(diasEntre('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('un rango al revés no tiene días', () => {
    expect(diasEntre('2026-11-02', '2026-11-01')).toEqual([])
  })
})

describe('ventanaDeDias', () => {
  it('los últimos N días terminan en hoy', () => {
    expect(ventanaDeDias('2026-11-17', 3)).toEqual({ desde: '2026-11-15', hasta: '2026-11-17' })
  })
})

describe('conteoPorDia', () => {
  it('los días sin movimiento salen en 0, no desaparecen', () => {
    const c = conteoPorDia([fila({ creada: '2026-11-10' })], '2026-11-09', '2026-11-11')
    expect(c.dias).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
    expect(c.total.creadas).toEqual([0, 1, 0])
    expect(c.total.aprobadas).toEqual([0, 0, 0])
  })

  it('creada un día y aprobada otro: suma en los dos días, cada una en su serie', () => {
    const c = conteoPorDia(
      [fila({ creada: '2026-11-09', aprobada: '2026-11-11', estatus: 'APROBADA' })],
      '2026-11-09',
      '2026-11-11',
    )
    expect(c.total.creadas).toEqual([1, 0, 0])
    expect(c.total.aprobadas).toEqual([0, 0, 1])
  })

  it('creada y aprobada el mismo día cuenta una vez en cada serie', () => {
    const c = conteoPorDia([fila({ creada: '2026-11-10', aprobada: '2026-11-10', estatus: 'APROBADA' })], '2026-11-10', '2026-11-10')
    expect(c.total).toMatchObject({ creadas: [1], aprobadas: [1], totalCreadas: 1, totalAprobadas: 1 })
  })

  it('una aprobada que después se rechazó ya no cuenta como aprobada (regla de PROP-PER)', () => {
    const c = conteoPorDia([fila({ aprobada: '2026-11-10', estatus: 'RECHAZADA' })], '2026-11-10', '2026-11-10')
    expect(c.total.aprobadas).toEqual([0])
    expect(c.total.creadas).toEqual([1])
  })

  it('lo que cae fuera del rango no cuenta', () => {
    const c = conteoPorDia(
      [fila({ creada: '2026-11-01', aprobada: '2026-11-20', estatus: 'APROBADA' })],
      '2026-11-09',
      '2026-11-11',
    )
    expect(c.total.totalCreadas).toBe(0)
    expect(c.total.totalAprobadas).toBe(0)
    expect(c.porVendedor).toEqual([])
  })

  it('separa por vendedor, y «sin vendedor» va aparte y al final', () => {
    const c = conteoPorDia(
      [
        fila({ vendedorId: null, vendedor: null }),
        fila({ vendedorId: 'ana', vendedor: 'Ana' }),
        fila({ vendedorId: 'beto', vendedor: 'Beto', aprobada: '2026-11-10', estatus: 'APROBADA' }),
        fila({ vendedorId: 'beto', vendedor: 'Beto' }),
      ],
      '2026-11-10',
      '2026-11-10',
    )
    expect(c.porVendedor.map((v) => v.id)).toEqual(['beto', 'ana', null])
    expect(c.porVendedor[0]).toMatchObject({ nombre: 'Beto', creadas: [2], aprobadas: [1], totalCreadas: 2, totalAprobadas: 1 })
    expect(c.porVendedor[2]).toMatchObject({ nombre: null, totalCreadas: 1 })
  })

  it('un vendedor dado de baja conserva su nombre congelado y no se revuelve con «sin vendedor»', () => {
    const c = conteoPorDia(
      [fila({ vendedorId: 'baja:Carla', vendedor: 'Carla' }), fila({ vendedorId: null, vendedor: null })],
      '2026-11-10',
      '2026-11-10',
    )
    expect(c.porVendedor.map((v) => [v.id, v.nombre])).toEqual([
      ['baja:Carla', 'Carla'],
      [null, null],
    ])
  })

  it('el total cuadra con la suma de los vendedores, día por día', () => {
    const filas = [
      fila({ vendedorId: 'ana', creada: '2026-11-09' }),
      fila({ vendedorId: 'beto', vendedor: 'Beto', creada: '2026-11-09', aprobada: '2026-11-11', estatus: 'APROBADA' }),
      fila({ vendedorId: null, vendedor: null, creada: '2026-11-11' }),
    ]
    const c = conteoPorDia(filas, '2026-11-09', '2026-11-11')
    const suma = (k: 'creadas' | 'aprobadas') =>
      c.dias.map((_, i) => c.porVendedor.reduce((s, v) => s + v[k][i]!, 0))
    expect(c.total.creadas).toEqual(suma('creadas'))
    expect(c.total.aprobadas).toEqual(suma('aprobadas'))
  })
})
