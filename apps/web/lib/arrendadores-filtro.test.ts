import { describe, it, expect } from 'vitest'
import {
  filtrarArrendadores, filtrarContratos, filtrarPagos,
  hayFiltro, norm, FILTRO_VACIO, type FiltroArrendadores,
} from './arrendadores-filtro'

// ============================================================================
//  Filtro compartido del módulo Arrendadores.
//
//  Las tres listas —arrendadores, contratos y pagos— son la misma realidad, y
//  el filtro es UNO para que no puedan desalinearse. Lo que estas pruebas
//  protegen es justamente esa coherencia: que un pago solo aparezca si su
//  contrato sobrevivió al filtro. Si eso se rompe, la pantalla enseña un pago
//  de un arrendador que dice no estar mostrando, que es peor que no filtrar.
// ============================================================================

const f = (over: Partial<FiltroArrendadores> = {}): FiltroArrendadores => ({ ...FILTRO_VACIO, ...over })

const ARRS = [
  { id: 'A1', nombre: 'Predios del Norte SA', rfc: 'PNO900101AAA', email: 'norte@x.mx' },
  { id: 'A2', nombre: 'Espacios México', rfc: 'EME010101BBB', email: null },
  { id: 'A3', nombre: 'DEMO Arrendador', rfc: null, email: null },
]

const CONTRATOS = [
  { id: 'C1', arrendadorId: 'A1', estatus: 'VIGENTE', sitioNombre: 'Pantalla LED Reforma 222' },
  { id: 'C2', arrendadorId: 'A1', estatus: 'INCOMPLETO', sitioNombre: 'MUPI Copilco' },
  { id: 'C3', arrendadorId: 'A2', estatus: 'VIGENTE', sitioNombre: 'Valla Insurgentes' },
  { id: 'C4', arrendadorId: null, estatus: 'INCOMPLETO', sitioNombre: 'Suelta sin dueño' },
]

const PAGOS = [
  { contratoId: 'C1', estatus: 'PENDIENTE', sitioNombre: 'Pantalla LED Reforma 222' },
  { contratoId: 'C1', estatus: 'VENCIDO', sitioNombre: 'Pantalla LED Reforma 222' },
  { contratoId: 'C3', estatus: 'PAGADO', sitioNombre: 'Valla Insurgentes' },
]

const nombreArr = (id: string) => ARRS.find((a) => a.id === id)?.nombre ?? '—'

describe('sin filtro no se esconde nada', () => {
  it('devuelve todo tal cual', () => {
    expect(hayFiltro(FILTRO_VACIO)).toBe(false)
    expect(filtrarArrendadores(ARRS, FILTRO_VACIO)).toHaveLength(3)
    expect(filtrarContratos(CONTRATOS, FILTRO_VACIO, nombreArr)).toHaveLength(4)
    expect(filtrarPagos(PAGOS, [], FILTRO_VACIO)).toHaveLength(3)
  })

  it('sin filtro los pagos NO se recortan por la lista de contratos', () => {
    // Sutil pero importante: sin filtro, `contratosVisibles` puede llegar vacío
    // mientras el estado carga. Recortar ahí dejaría la tarjeta en blanco por un
    // instante en Finanzas, que ni siquiera tiene barra de filtro.
    expect(filtrarPagos(PAGOS, [], FILTRO_VACIO)).toHaveLength(3)
  })
})

describe('búsqueda por texto', () => {
  it('encuentra al arrendador por nombre, RFC o correo', () => {
    expect(filtrarArrendadores(ARRS, f({ texto: 'norte' })).map((a) => a.id)).toEqual(['A1'])
    expect(filtrarArrendadores(ARRS, f({ texto: 'EME0101' })).map((a) => a.id)).toEqual(['A2'])
    expect(filtrarArrendadores(ARRS, f({ texto: 'norte@x' })).map((a) => a.id)).toEqual(['A1'])
  })

  it('ignora acentos y mayúsculas', () => {
    // Nadie teclea "México" con acento en un buscador.
    expect(filtrarArrendadores(ARRS, f({ texto: 'mexico' })).map((a) => a.id)).toEqual(['A2'])
    expect(filtrarArrendadores(ARRS, f({ texto: 'MÉXICO' })).map((a) => a.id)).toEqual(['A2'])
    expect(norm('  Ñoño ÁÉÍ  ')).toBe('nono aei')
  })

  it('el contrato se encuentra por su arrendador O por su pantalla', () => {
    // Un contrato se identifica por cualquiera de los dos, según lo que uno
    // tenga en la cabeza al buscar.
    expect(filtrarContratos(CONTRATOS, f({ texto: 'reforma' }), nombreArr).map((c) => c.id)).toEqual(['C1'])
    expect(filtrarContratos(CONTRATOS, f({ texto: 'norte' }), nombreArr).map((c) => c.id)).toEqual(['C1', 'C2'])
  })

  it('un texto que no coincide con nada devuelve vacío, no todo', () => {
    expect(filtrarContratos(CONTRATOS, f({ texto: 'zzzz' }), nombreArr)).toHaveLength(0)
  })

  it('espacios en blanco no cuentan como filtro', () => {
    expect(hayFiltro(f({ texto: '   ' }))).toBe(false)
    expect(filtrarContratos(CONTRATOS, f({ texto: '   ' }), nombreArr)).toHaveLength(4)
  })
})

describe('filtro por arrendador', () => {
  it('acota contratos a ese arrendador', () => {
    expect(filtrarContratos(CONTRATOS, f({ arrendadorId: 'A1' }), nombreArr).map((c) => c.id))
      .toEqual(['C1', 'C2'])
  })

  it('acota también la lista de arrendadores', () => {
    // Si estás mirando a uno, la tarjeta de arriba no debe seguir mostrando los
    // otros: sería un filtro que dice aplicarse y no se aplica.
    expect(filtrarArrendadores(ARRS, f({ arrendadorId: 'A2' })).map((a) => a.id)).toEqual(['A2'])
  })

  it('un contrato sin arrendador (INCOMPLETO viejo) no se cuela', () => {
    expect(filtrarContratos(CONTRATOS, f({ arrendadorId: 'A1' }), nombreArr).map((c) => c.id))
      .not.toContain('C4')
  })
})

describe('filtro por estatus del contrato', () => {
  it('deja solo los de ese estatus', () => {
    expect(filtrarContratos(CONTRATOS, f({ estatus: 'INCOMPLETO' }), nombreArr).map((c) => c.id))
      .toEqual(['C2', 'C4'])
  })

  it('se combina con el arrendador', () => {
    const r = filtrarContratos(CONTRATOS, f({ arrendadorId: 'A1', estatus: 'VIGENTE' }), nombreArr)
    expect(r.map((c) => c.id)).toEqual(['C1'])
  })
})

describe('coherencia: los pagos siguen a sus contratos', () => {
  it('solo se ven los pagos de contratos visibles', () => {
    // Es la razón de ser del módulo: si la tabla de contratos dice mostrar solo
    // A1, la de pagos no puede enseñar un pago de A2.
    const visibles = filtrarContratos(CONTRATOS, f({ arrendadorId: 'A1' }), nombreArr)
    const r = filtrarPagos(PAGOS, visibles, f({ arrendadorId: 'A1' }))
    expect(r).toHaveLength(2)
    expect(r.every((p) => p.contratoId === 'C1')).toBe(true)
  })

  it('filtrar por un estatus que ningún contrato tiene deja los pagos vacíos', () => {
    const visibles = filtrarContratos(CONTRATOS, f({ estatus: 'CANCELADO' }), nombreArr)
    expect(visibles).toHaveLength(0)
    expect(filtrarPagos(PAGOS, visibles, f({ estatus: 'CANCELADO' }))).toHaveLength(0)
  })

  it('el estatus del filtro es el del CONTRATO, no el del pago', () => {
    // Filtrar pagos por «VIGENTE» no tendría sentido (un pago es
    // PAGADO/PENDIENTE/VENCIDO). Al pasar por los contratos sale coherente:
    // C1 y C3 son VIGENTE, así que se ven sus pagos, incluido uno PAGADO.
    const visibles = filtrarContratos(CONTRATOS, f({ estatus: 'VIGENTE' }), nombreArr)
    const r = filtrarPagos(PAGOS, visibles, f({ estatus: 'VIGENTE' }))
    expect(r).toHaveLength(3)
  })
})

describe('coherencia entre la lista de arrendadores y la de contratos', () => {
  it('buscar una PANTALLA deja visible a su arrendador', () => {
    // El fallo que esto fija: buscar "reforma" vaciaba la tarjeta de
    // arrendadores —ninguno se llama así— mientras la tabla de contratos seguía
    // mostrando los de su dueño. Dos tarjetas contradiciéndose a la vez.
    const filtro = f({ texto: 'reforma' })
    const visibles = filtrarContratos(CONTRATOS, filtro, nombreArr)
    expect(visibles.map((c) => c.id)).toEqual(['C1'])
    const arrs = filtrarArrendadores(ARRS, filtro, visibles)
    expect(arrs.map((a) => a.id)).toEqual(['A1'])
  })

  it('sin contratos que coincidan, tampoco quedan arrendadores', () => {
    const filtro = f({ texto: 'zzzz' })
    const visibles = filtrarContratos(CONTRATOS, filtro, nombreArr)
    expect(filtrarArrendadores(ARRS, filtro, visibles)).toHaveLength(0)
  })

  it('el selector de arrendador manda sobre el arrastre por contrato', () => {
    // Si se eligió A2 explícitamente, A1 no debe colarse por tener un contrato
    // que coincide con el texto.
    const filtro = f({ arrendadorId: 'A2', texto: 'reforma' })
    const arrs = filtrarArrendadores(ARRS, filtro, CONTRATOS)
    expect(arrs.map((a) => a.id)).toEqual(['A2'])
  })
})
