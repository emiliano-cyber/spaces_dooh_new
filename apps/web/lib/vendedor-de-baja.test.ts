import { describe, it, expect } from 'vitest'
import { CARGO_DE_BAJA, vendedoresConBajas } from './vendedor-de-baja'

const ANA = { id: 'u-ana', nombre: 'Ana', cargo: 'Vendedora' }

describe('P19 · el vendedor borrado conserva su nombre en el reporte', () => {
  it('el usuario vigente se atribuye como siempre, por su id', () => {
    const r = vendedoresConBajas([ANA], [{ campana_id: 'c1', usuario_id: 'u-ana', vendedor_nombre: 'Ana' }])
    expect(r.vendedorDeCampana).toEqual([{ campanaId: 'c1', usuarioId: 'u-ana' }])
    expect(r.vendedores).toEqual([ANA])
  })

  it('sin usuario pero CON nombre congelado: una fila de baja con su nombre', () => {
    const r = vendedoresConBajas([ANA], [
      { campana_id: 'c1', usuario_id: null, vendedor_nombre: 'Beto' },
      { campana_id: 'c2', usuario_id: null, vendedor_nombre: 'Beto' },
    ])
    expect(r.vendedorDeCampana.map((v) => v.usuarioId)).toEqual(['baja:Beto', 'baja:Beto'])
    expect(r.vendedores).toEqual([ANA, { id: 'baja:Beto', nombre: 'Beto', cargo: CARGO_DE_BAJA }])
  })

  it('sin usuario NI nombre sigue siendo histórica (null), no se inventa', () => {
    const r = vendedoresConBajas([], [
      { campana_id: 'c1', usuario_id: null, vendedor_nombre: null },
      { campana_id: 'c2', usuario_id: null, vendedor_nombre: '   ' },
    ])
    expect(r.vendedorDeCampana.map((v) => v.usuarioId)).toEqual([null, null])
    expect(r.vendedores).toEqual([])
  })

  it('un usuario_id que existe NO se cambia por el nombre aunque lo haya', () => {
    // El nombre de la propuesta puede ser viejo (alguien cambió su nombre):
    // mientras el usuario exista, manda el usuario.
    const r = vendedoresConBajas([ANA], [{ campana_id: 'c1', usuario_id: 'u-ana', vendedor_nombre: 'Ana López' }])
    expect(r.vendedores).toHaveLength(1)
  })
})
