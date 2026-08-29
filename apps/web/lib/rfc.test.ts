import { describe, it, expect } from 'vitest'
import { esRfcValido } from './rfc'

// ============================================================================
//  VAL-01 · el RFC valida FORMA pero no CALENDARIO.
// ----------------------------------------------------------------------------
//  La auditoría de caja negra del 2026-08-26 dio de alta un cliente con RFC
//  `XAXX021301000` y la API respondió 201. El `\d{6}` de la expresión aceptaba
//  cualquier cifra de seis dígitos, así que el MES 13 pasaba — y con él el día
//  32, el mes 00 y el día 00.
//
//  Importa porque ese dato acaba en un CFDI: un RFC con fecha imposible no lo
//  timbra el SAT, y el fallo aparece semanas después, al facturar, cuando ya
//  nadie recuerda de dónde salió.
//
//  Lo que NO se puede romper: `XAXX010101000` (público en general) y
//  `XEXX010101000` (residentes en el extranjero) son los dos RFC genéricos
//  válidos del SAT y están sembrados por todo el repositorio. Su fecha es
//  01/01/01, así que la regla del calendario los deja pasar sin excepción
//  especial: si alguna vez hiciera falta una excepción, sería señal de que la
//  regla está mal.
// ============================================================================

describe('esRfcValido — lo que ya valía tiene que seguir valiendo', () => {
  it('acepta los dos RFC genéricos del SAT', () => {
    expect(esRfcValido('XAXX010101000')).toBe(true)
    expect(esRfcValido('XEXX010101000')).toBe(true)
  })

  it('acepta persona moral (3 letras) y persona física (4)', () => {
    expect(esRfcValido('AGI990422EL7')).toBe(true)
    expect(esRfcValido('RUOY030311T87')).toBe(true)
  })

  it('acepta minúsculas y sigue aceptando el vacío (el RFC es opcional)', () => {
    expect(esRfcValido('agi990422el7')).toBe(true)
    expect(esRfcValido('')).toBe(true)
    expect(esRfcValido('   ')).toBe(true)
    expect(esRfcValido(null)).toBe(true)
    expect(esRfcValido(undefined)).toBe(true)
  })

  it('sigue rechazando lo que ya rechazaba por forma', () => {
    expect(esRfcValido('NO-ES-UN-RFC')).toBe(false)
    expect(esRfcValido('AG990422EL7')).toBe(false)   // 2 letras
    expect(esRfcValido('AGI99042EL7')).toBe(false)   // 5 dígitos de fecha
    expect(esRfcValido('AGI990422EL')).toBe(false)   // homoclave de 2
  })
})

describe('esRfcValido — la fecha tiene que existir en un calendario', () => {
  it('rechaza el RFC exacto que reportó la auditoría (mes 13)', () => {
    expect(esRfcValido('XAXX021301000')).toBe(false)
  })

  it('rechaza el mes 00 y cualquier mes por encima del 12', () => {
    expect(esRfcValido('AGI990022EL7')).toBe(false)
    expect(esRfcValido('AGI991322EL7')).toBe(false)
    expect(esRfcValido('AGI999922EL7')).toBe(false)
  })

  it('rechaza el día 00 y el día 32', () => {
    expect(esRfcValido('AGI990400EL7')).toBe(false)
    expect(esRfcValido('AGI990432EL7')).toBe(false)
  })

  it('rechaza el 31 en un mes de 30 días', () => {
    // Abril, junio, septiembre y noviembre. Un 31 de abril no es un descuido de
    // formato: es una fecha que no existe.
    expect(esRfcValido('AGI990431EL7')).toBe(false)
    expect(esRfcValido('AGI990631EL7')).toBe(false)
    expect(esRfcValido('AGI990931EL7')).toBe(false)
    expect(esRfcValido('AGI991131EL7')).toBe(false)
  })

  it('rechaza el 30 y el 31 de febrero, y admite el 29', () => {
    // El 29 se admite SIEMPRE. El año del RFC son dos dígitos y no dice el
    // siglo: «00» puede ser 1900 (no bisiesto) o 2000 (bisiesto), así que
    // decidir el año bisiesto exigiría adivinar. Rechazar un 29 de febrero
    // legítimo frenaría un alta correcta; admitir uno inexistente solo deja
    // pasar un caso de cada mil.
    expect(esRfcValido('AGI990229EL7')).toBe(true)
    expect(esRfcValido('AGI990230EL7')).toBe(false)
    expect(esRfcValido('AGI990231EL7')).toBe(false)
  })

  it('sigue aceptando los últimos días válidos de cada tipo de mes', () => {
    expect(esRfcValido('AGI990131EL7')).toBe(true)  // enero, 31
    expect(esRfcValido('AGI990430EL7')).toBe(true)  // abril, 30
    expect(esRfcValido('AGI991231EL7')).toBe(true)  // diciembre, 31
    expect(esRfcValido('AGI990101EL7')).toBe(true)  // primero de enero
  })
})
