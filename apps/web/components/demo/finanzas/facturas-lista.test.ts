import { describe, it, expect } from 'vitest'
import { armarListaFacturas, cuentaPorEstatus } from './facturas-lista'

// ============================================================================
//  El apartado de Facturas de la pantalla de Finanzas
// ----------------------------------------------------------------------------
//  Hasta hoy, una factura emitida solo se veía dentro de la tarjeta «Cobranza»,
//  que se lee como cuentas por cobrar. Quien acababa de emitir una y buscaba
//  «Facturas» no encontraba nada, y concluía que no se habían guardado.
//
//  Este módulo es solo el ARMADO de la lista —unir cada factura con el nombre
//  de su cliente, su campaña y la razón social que la emitió— para poder
//  probarlo sin DOM.
// ============================================================================

const F = (p: Partial<any> = {}): any => ({
  id: 'f1', folio: 'A-001', campanaId: 'c1', clienteId: 'cl1',
  subtotal: 1000, igv: 160, monto: 1160, moneda: 'MXN',
  fechaEmision: '2026-09-01', estatus: 'EMITIDA',
  serie: 'A', folioFiscal: 'UUID-1', rfc: 'AME070315J21', razonSocial: 'Cliente SA',
  usoCfdi: 'G03', entidadEmisoraId: 'e1', creadoEn: '2026-09-01', ...p,
})

const CLIENTES = [{ id: 'cl1', nombre: 'Coca-Cola' }] as any[]
const CAMPANAS = [{ id: 'c1', nombre: 'Verano 2026' }] as any[]
const ENTIDADES = [{ id: 'e1', nombre: 'AS Media Exterior' }] as any[]

describe('armarListaFacturas', () => {
  it('une cada factura con su cliente, su campaña y quién la emitió', () => {
    const [f] = armarListaFacturas([F()], CLIENTES, CAMPANAS, ENTIDADES)
    expect(f.cliente).toBe('Coca-Cola')
    expect(f.campana).toBe('Verano 2026')
    expect(f.emisora).toBe('AS Media Exterior')
    expect(f.folio).toBe('A-001')
  })

  // NEGATIVA. Este repositorio ya pagó caro inventar un dato ausente: el `?? 0`
  // del mapa convertía «no sé dónde está» en un punto del océano.
  it('lo que falta se DICE, no se inventa', () => {
    const [f] = armarListaFacturas(
      [F({ clienteId: 'zzz', campanaId: 'zzz', entidadEmisoraId: null, folioFiscal: null })],
      CLIENTES, CAMPANAS, ENTIDADES,
    )
    expect(f.cliente).toBe('—')
    expect(f.campana).toBe('—')
    expect(f.emisora).toBe('Sin asignar')
    expect(f.folioFiscal).toBe('—')
  })

  it('la más reciente va primero', () => {
    const l = armarListaFacturas(
      [F({ id: 'v', fechaEmision: '2026-01-05' }), F({ id: 'n', fechaEmision: '2026-09-20' })],
      CLIENTES, CAMPANAS, ENTIDADES,
    )
    expect(l.map((x) => x.id)).toEqual(['n', 'v'])
  })

  // NEGATIVA: sin facturas no se revienta ni se inventan filas.
  it('sin facturas devuelve vacío', () => {
    expect(armarListaFacturas([], CLIENTES, CAMPANAS, ENTIDADES)).toEqual([])
    expect(armarListaFacturas(undefined, CLIENTES, CAMPANAS, ENTIDADES)).toEqual([])
  })
})

describe('cuentaPorEstatus', () => {
  it('cuenta las tres, y las que no hay salen en cero', () => {
    const c = cuentaPorEstatus([F(), F({ id: 'b', estatus: 'PAGADA' }), F({ id: 'c', estatus: 'PAGADA' })])
    expect(c).toEqual({ EMITIDA: 1, PAGADA: 2, ANULADA: 0 })
  })

  // NEGATIVA: una anulada NO se cuenta como emitida. Sumarlas daría una
  // facturación mayor que la real.
  it('una ANULADA no engorda las emitidas', () => {
    const c = cuentaPorEstatus([F({ estatus: 'ANULADA' })])
    expect(c.EMITIDA).toBe(0)
    expect(c.ANULADA).toBe(1)
  })
})
