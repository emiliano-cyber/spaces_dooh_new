import { describe, it, expect } from 'vitest'
import { armarComprobante } from './comprobante'

// ============================================================================
//  El comprobante de pago que se puede ver e imprimir
// ----------------------------------------------------------------------------
//  Hasta hoy una factura emitida no se podía ABRIR: se veía la fila y nada más.
//  Los contratos sí tienen documento, pero ése es un PDF que alguien subió; una
//  factura no tiene ninguno guardado, así que hay que COMPONERLO con lo que se
//  congeló al emitirla.
//
//  Y lo que se compone es un COMPROBANTE DE PAGO, no un CFDI timbrado: el
//  timbrado real llega después por API. El documento tiene que decirlo, o el
//  cliente que lo reciba creerá que tiene en la mano algo que no tiene.
// ============================================================================

const F = (p: Partial<any> = {}): any => ({
  id: 'f1', folio: 'A-001', campanaId: 'c1', clienteId: 'cl1',
  subtotal: 1000, igv: 160, monto: 1160, moneda: 'MXN',
  fechaEmision: '2026-09-29', estatus: 'EMITIDA',
  serie: 'A', folioFiscal: 'UUID-1',
  rfc: 'AME070315J21', razonSocial: 'Cliente SA de CV', usoCfdi: 'G03',
  entidadEmisoraId: 'e1', creadoEn: '2026-09-29', ...p,
})
const CAMPANAS = [{ id: 'c1', nombre: 'Verano 2026' }] as any[]
const ENTIDADES = [{ id: 'e1', razonSocial: 'AS Media Exterior', rfc: 'AME070315J21' }] as any[]

describe('armarComprobante', () => {
  it('separa QUIEN EMITE de QUIEN RECIBE, que son dos razones sociales distintas', () => {
    const c = armarComprobante(F(), CAMPANAS, ENTIDADES)
    expect(c.emisor.razonSocial).toBe('AS Media Exterior')
    expect(c.receptor.razonSocial).toBe('Cliente SA de CV')
    expect(c.receptor.rfc).toBe('AME070315J21')
  })

  // NEGATIVA, y es la que más importa de todas: este documento NO es un CFDI.
  it('DICE que es un comprobante y no un CFDI timbrado', () => {
    expect(armarComprobante(F(), CAMPANAS, ENTIDADES).aviso).toMatch(/no es un cfdi/i)
  })

  it('los importes cuadran: subtotal + IVA = total', () => {
    const c = armarComprobante(F(), CAMPANAS, ENTIDADES)
    expect(c.importes.subtotal + c.importes.iva).toBe(c.importes.total)
  })

  // NEGATIVA: si no cuadran, se DICE. Un comprobante cuyos números no suman y
  // no lo advierte es peor que no tenerlo.
  it('avisa cuando los importes NO cuadran', () => {
    const c = armarComprobante(F({ subtotal: 1000, igv: 160, monto: 9999 }), CAMPANAS, ENTIDADES)
    expect(c.importes.cuadra).toBe(false)
  })

  it('cuando cuadran no avisa de nada', () => {
    expect(armarComprobante(F(), CAMPANAS, ENTIDADES).importes.cuadra).toBe(true)
  })

  // NEGATIVA: lo que falta se dice. Sin emisora asignada no se inventa una.
  it('sin razón social emisora lo dice, no inventa una', () => {
    const c = armarComprobante(F({ entidadEmisoraId: null }), CAMPANAS, ENTIDADES)
    expect(c.emisor.razonSocial).toBe('Sin asignar')
    expect(c.emisor.rfc).toBe('—')
  })

  it('sin folio fiscal pone raya, no una cadena vacía', () => {
    expect(armarComprobante(F({ folioFiscal: null }), CAMPANAS, ENTIDADES).folioFiscal).toBe('—')
  })
})
