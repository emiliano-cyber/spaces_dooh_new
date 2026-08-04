import { describe, it, expect } from 'vitest'
import { rfcTenant, textoTenant } from './config-fiscal'

// Estos campos alimentan las DECLARACIONES de la parte arrendataria del contrato
// (lib/contrato-documento.ts). Lo que se prueba aquí es la frontera que decide si
// un contrato sale completo o con huecos: la distinción entre NULL («sin
// capturar», bloquea la firma) y una cadena, y la normalización del RFC.

describe('rfcTenant', () => {
  it('normaliza a mayúsculas y quita separadores', () => {
    expect(rfcTenant.parse('rca 210315 j38')).toBe('RCA210315J38')
    expect(rfcTenant.parse('  rca-210315-j38  ')).toBe('RCA210315J38')
  })

  it('acepta persona moral (12) y persona física (13)', () => {
    expect(rfcTenant.parse('RCA210315J38')).toBe('RCA210315J38')
    expect(rfcTenant.parse('LOHJ850312AB1')).toBe('LOHJ850312AB1')
  })

  it('acepta Ñ y & en la raíz, que el SAT sí emite', () => {
    expect(rfcTenant.parse('MU&850312AB1')).toBe('MU&850312AB1')
    expect(rfcTenant.parse('ÑOL850312AB1')).toBe('ÑOL850312AB1')
  })

  it('deja pasar el vacío como NULL, no como cadena vacía', () => {
    // Es la diferencia entre «aún no lo capturo» y «lo capturé en blanco». El
    // generador solo marca hueco y bloquea la firma con NULL.
    expect(rfcTenant.parse(null)).toBeNull()
    expect(rfcTenant.parse('')).toBeNull()
    expect(rfcTenant.parse('   ')).toBeNull()
  })

  it('rechaza lo que no tiene forma de RFC', () => {
    expect(() => rfcTenant.parse('ABC12')).toThrow()          // corto
    expect(() => rfcTenant.parse('RCA21031J38')).toThrow()    // 11
    expect(() => rfcTenant.parse('RCAA210315J38X')).toThrow() // 14
    expect(() => rfcTenant.parse('RC1210315J38')).toThrow()   // dígito en la raíz
  })

  it('normaliza antes de medir el largo, no después', () => {
    // Con separadores son 14 caracteres. Si el `.max()` se aplicara al valor
    // crudo con un tope de 13, este RFC válido se rechazaría por largo.
    expect(rfcTenant.parse('rca-210315-j38')).toBe('RCA210315J38')
  })
})

describe('textoTenant', () => {
  const domicilio = textoTenant(300)

  it('recorta y convierte el vacío en NULL', () => {
    expect(domicilio.parse('  Av. Reforma 505  ')).toBe('Av. Reforma 505')
    expect(domicilio.parse('')).toBeNull()
    expect(domicilio.parse('    ')).toBeNull()
    expect(domicilio.parse(null)).toBeNull()
  })

  it('rechaza lo que excede el largo de la columna', () => {
    expect(() => domicilio.parse('x'.repeat(301))).toThrow()
    expect(domicilio.parse('x'.repeat(300))).toHaveLength(300)
  })
})
