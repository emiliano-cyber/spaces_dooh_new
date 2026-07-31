import { describe, it, expect } from 'vitest'
import {
  distanciaMetros,
  normalizarDireccion,
  evaluarCercania,
  RADIO_PREDIO_M,
} from './predio-cercania'

// ============================================================================
//  ¿Esta pantalla está de verdad en este predio?
//
//  Lo que protege esta validación es el reparto de la renta. El contrato cuelga
//  del PREDIO y `derive.ts` divide su importe entre las pantallas que le
//  cuelgan. Una pantalla que está en otra colonia —un copiar/pegar en el Excel—
//  no falla en ningún sitio: se cuelga tan campante y a partir de ahí el
//  inmueble se reparte entre una cara de más, así que TODAS sus pantallas salen
//  más baratas de lo que son y su margen sale inflado.
//
//  Las tres decisiones que fijan estas pruebas:
//   · Con coordenadas manda la distancia, que es objetiva y se dice en metros.
//   · Sin coordenadas, la misma dirección escrita cuenta como el mismo sitio.
//   · Sin ninguna de las dos NO se bloquea. Es ausencia de dato, no evidencia
//     de error, y la mayoría de los Excel no traen latitud ni longitud.
// ============================================================================

// Coordenadas reales, para que las distancias signifiquen algo.
const REFORMA_222 = { lat: 19.4283, lng: -99.159 }
const ANGEL_INDEPENDENCIA = { lat: 19.4270, lng: -99.1677 } // ~0.9 km de Reforma 222
const SANTA_FE = { lat: 19.3601, lng: -99.2597 } // ~12 km
const GUADALAJARA = { lat: 20.6597, lng: -103.3496 } // otra ciudad

describe('distanciaMetros', () => {
  it('mide cero contra sí mismo', () => {
    expect(distanciaMetros(19.4283, -99.159, 19.4283, -99.159)).toBe(0)
  })

  it('mide una distancia conocida de la CDMX', () => {
    // Reforma 222 → Ángel de la Independencia: nueve cientos y pico de metros.
    const d = distanciaMetros(REFORMA_222.lat, REFORMA_222.lng, ANGEL_INDEPENDENCIA.lat, ANGEL_INDEPENDENCIA.lng)
    expect(d).toBeGreaterThan(800)
    expect(d).toBeLessThan(1100)
  })

  it('es simétrica', () => {
    const ida = distanciaMetros(REFORMA_222.lat, REFORMA_222.lng, SANTA_FE.lat, SANTA_FE.lng)
    const vuelta = distanciaMetros(SANTA_FE.lat, SANTA_FE.lng, REFORMA_222.lat, REFORMA_222.lng)
    expect(ida).toBe(vuelta)
  })
})

describe('evaluarCercania — con coordenadas', () => {
  it('dos caras del mismo inmueble están CERCA', () => {
    // ~40 m: la otra fachada del mismo edificio.
    const otraCara = { lat: 19.42866, lng: -99.15912 }
    const r = evaluarCercania(REFORMA_222, otraCara)
    expect(r.estado).toBe('CERCA')
    expect(r.metros).toBeLessThan(RADIO_PREDIO_M)
  })

  it('otra colonia está LEJOS y dice cuánto', () => {
    const r = evaluarCercania(REFORMA_222, ANGEL_INDEPENDENCIA)
    expect(r.estado).toBe('LEJOS')
    expect(r.metros).toBeGreaterThan(RADIO_PREDIO_M)
  })

  it('otra ciudad está LEJOS', () => {
    expect(evaluarCercania(REFORMA_222, GUADALAJARA).estado).toBe('LEJOS')
  })

  // El driver de PostgreSQL devuelve los `numeric` como TEXTO. Si el módulo
  // exigiera `number`, toda coordenada leída de la base se trataría como
  // ausente y la validación no comprobaría NADA — pasando todo en verde.
  it('acepta coordenadas en texto, como las devuelve el driver', () => {
    const r = evaluarCercania(
      { lat: '19.4283', lng: '-99.159' },
      { lat: '19.3601', lng: '-99.2597' },
    )
    expect(r.estado).toBe('LEJOS')
    expect(r.metros).toBeGreaterThan(10_000)
  })

  it('(0,0) no es una coordenada: es un campo sin capturar', () => {
    // Sin este descarte, cualquier pantalla sin coordenadas "estaría" en el
    // Golfo de Guinea y se rechazaría por estar a 9 000 km del predio.
    const r = evaluarCercania({ lat: 0, lng: 0 }, REFORMA_222)
    expect(r.estado).toBe('INDETERMINADO')
  })
})

describe('evaluarCercania — sin coordenadas', () => {
  const dir = 'Paseo de la Reforma 222, Juárez, Cuauhtémoc'

  it('la misma dirección escrita distinto cuenta como el mismo sitio', () => {
    const r = evaluarCercania({ direccion: dir }, { direccion: 'PASEO DE LA REFORMA 222, JUAREZ, CUAUHTEMOC' })
    expect(r.estado).toBe('CERCA')
    expect(r.metros).toBeNull()
  })

  it('direcciones distintas quedan INDETERMINADAS, no LEJOS', () => {
    // No se puede afirmar que estén lejos sin coordenadas: "Reforma 222" y
    // "Reforma 220" son vecinas. Bloquear aquí rechazaría cargas correctas.
    const r = evaluarCercania({ direccion: dir }, { direccion: 'Av. Vasco de Quiroga 3800, Santa Fe' })
    expect(r.estado).toBe('INDETERMINADO')
  })

  it('sin dirección ni coordenadas queda INDETERMINADO', () => {
    expect(evaluarCercania({}, {}).estado).toBe('INDETERMINADO')
  })

  it('una con coordenadas y otra sin ellas queda INDETERMINADO', () => {
    expect(evaluarCercania(REFORMA_222, { direccion: dir }).estado).toBe('INDETERMINADO')
  })
})

describe('normalizarDireccion', () => {
  it('quita acentos, puntuación y mayúsculas', () => {
    expect(normalizarDireccion('Av. Vasco de Quiroga #3800, Cuajimalpa'))
      .toBe(normalizarDireccion('AV VASCO DE QUIROGA 3800 CUAJIMALPA'))
  })

  it('colapsa los espacios de más', () => {
    expect(normalizarDireccion('  Reforma   222  ')).toBe('reforma 222')
  })

  it('tolera nulo y vacío', () => {
    expect(normalizarDireccion(null)).toBe('')
    expect(normalizarDireccion(undefined)).toBe('')
    expect(normalizarDireccion('')).toBe('')
  })

  // Dos direcciones distintas NO deben colapsar a la misma cadena, o el
  // respaldo sin coordenadas daría falsos "mismo sitio".
  it('no confunde dos direcciones distintas', () => {
    expect(normalizarDireccion('Reforma 222')).not.toBe(normalizarDireccion('Reforma 220'))
  })
})
