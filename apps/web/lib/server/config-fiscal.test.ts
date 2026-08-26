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

  // VAL-04 · el RFC DEL EMISOR no pasaba por el calendario.
  //
  // `config-fiscal.ts` tenía su propia copia de la expresión, con el `\d{6}`
  // que el 26/08 se corrigió en `@/lib/rfc`. La copia se quedó atrás, así que el
  // mes 13 seguía entrando — y aquí no es el RFC de un cliente: es el de la
  // propia organización, el que va como EMISOR en cada CFDI y el que el
  // generador de contratos recita en las declaraciones de la arrendataria. Un
  // cliente con el RFC mal no se puede facturar; el emisor con el RFC mal no
  // deja facturar a NADIE.
  it('rechaza una fecha que no existe en el calendario', () => {
    expect(() => rfcTenant.parse('XAXX021301000')).toThrow()  // mes 13
    expect(() => rfcTenant.parse('RCA219915J38')).toThrow()   // mes 99
    expect(() => rfcTenant.parse('RCA210015J38')).toThrow()   // mes 00
    expect(() => rfcTenant.parse('RCA210332J38')).toThrow()   // día 32
    expect(() => rfcTenant.parse('RCA210400J38')).toThrow()   // día 00
    expect(() => rfcTenant.parse('RCA210431J38')).toThrow()   // 31 de abril
    expect(() => rfcTenant.parse('RCA210230J38')).toThrow()   // 30 de febrero
  })

  it('sigue aceptando los genéricos del SAT y los bordes de mes', () => {
    // Si estos cayeran, la regla estaría mal: son los RFC que una organización
    // usa de verdad para facturar a público en general.
    expect(rfcTenant.parse('XAXX010101000')).toBe('XAXX010101000')
    expect(rfcTenant.parse('XEXX010101000')).toBe('XEXX010101000')
    expect(rfcTenant.parse('RCA210229J38')).toBe('RCA210229J38')  // 29 de febrero
    expect(rfcTenant.parse('RCA210131J38')).toBe('RCA210131J38')  // 31 de enero
    expect(rfcTenant.parse('RCA211231J38')).toBe('RCA211231J38')  // 31 de diciembre
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
