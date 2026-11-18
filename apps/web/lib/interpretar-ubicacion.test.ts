import { describe, it, expect } from 'vitest'
import { interpretarUbicacion, esEnlaceCortoDeGoogle, esEnlaceDeGoogleMaps } from './interpretar-ubicacion'
import { CATALOGO_ERRORES } from './i18n/errores-servidor'

// ============================================================================
//  UBIC-01 · Lo que la persona pega en el buscador de la ubicación.
// ----------------------------------------------------------------------------
//  Decisión del dueño (29/10/2026): en Comercial negociación la ubicación se
//  pone por COORDENADAS o por CALLE, sin clave y gratis. Este interpretador es
//  lo que decide, sin red, si el texto es un punto (coordenadas o un enlace
//  largo de Google Maps), un enlace corto que hay que seguir en el servidor, una
//  dirección que hay que buscar, o algo que no sirve y se dice por qué.
//
//  Los casos negativos importan tanto como los positivos: un «5, 123» de una
//  dirección NO puede acabar como un pin en el Índico, y un enlace de otro
//  dominio NO puede hacer que el servidor vaya a buscarlo.
// ============================================================================

const punto = (lat: number, lng: number) => expect.objectContaining({ tipo: 'punto', lat, lng })
const cerca = (r: ReturnType<typeof interpretarUbicacion>, lat: number, lng: number) => {
  expect(r.tipo).toBe('punto')
  if (r.tipo !== 'punto') return
  expect(r.lat).toBeCloseTo(lat, 4)
  expect(r.lng).toBeCloseTo(lng, 4)
}

describe('coordenadas decimales', () => {
  it.each([
    ['19.4326, -99.1332'],
    ['19.4326,-99.1332'],
    ['19.4326 -99.1332'],
    ['  19.4326 ,  -99.1332  '],
    ['(19.4326, -99.1332)'],
    ['19.4326; -99.1332'],
    ['+19.4326, -99.1332'],
  ])('«%s» es un punto', (texto) => {
    expect(interpretarUbicacion(texto)).toEqual(punto(19.4326, -99.1332))
  })

  it('con coma decimal, separadas por punto y coma (como las copia una hoja en español)', () => {
    expect(interpretarUbicacion('19,4326; -99,1332')).toEqual(punto(19.4326, -99.1332))
  })

  it('con la letra del hemisferio, en inglés o en español (O de Oeste)', () => {
    expect(interpretarUbicacion('19.4326 N, 99.1332 W')).toEqual(punto(19.4326, -99.1332))
    expect(interpretarUbicacion('19.4326°N 99.1332°O')).toEqual(punto(19.4326, -99.1332))
    expect(interpretarUbicacion('33.8688 S, 151.2093 E')).toEqual(punto(-33.8688, 151.2093))
  })

  it('dice de dónde salió: coordenadas', () => {
    expect(interpretarUbicacion('19.4326, -99.1332')).toMatchObject({ fuente: 'coordenadas' })
  })

  it('los extremos válidos se aceptan', () => {
    expect(interpretarUbicacion('90.0, 180.0')).toEqual(punto(90, 180))
    expect(interpretarUbicacion('-90.0, -180.0')).toEqual(punto(-90, -180))
  })
})

describe('grados, minutos y segundos', () => {
  it('el formato que copia Google Maps: 19°25\'57.4"N 99°07\'59.5"W', () => {
    cerca(interpretarUbicacion(`19°25'57.4"N 99°07'59.5"W`), 19.432611, -99.133194)
  })

  it('con espacios, comas y la O de Oeste', () => {
    cerca(interpretarUbicacion(`19° 25' 57.4" N, 99° 7' 59.5" O`), 19.432611, -99.133194)
  })

  it('con los signos tipográficos ′ y ″', () => {
    cerca(interpretarUbicacion('19°25′57.4″N 99°07′59.5″W'), 19.432611, -99.133194)
  })

  it('grados y minutos decimales, sin segundos', () => {
    cerca(interpretarUbicacion(`19°25.956'N 99°7.992'W`), 19.4326, -99.1332)
  })

  it('el sur y el este dan el signo correcto', () => {
    cerca(interpretarUbicacion(`33°52'7.7"S 151°12'33.5"E`), -33.868806, 151.209306)
  })

  it('minutos o segundos de 60 o más no son un ángulo: inválido', () => {
    expect(interpretarUbicacion(`19°61'00"N 99°07'59.5"W`).tipo).toBe('invalido')
    expect(interpretarUbicacion(`19°25'60"N 99°07'59.5"W`).tipo).toBe('invalido')
  })

  it('latitud con letra de longitud (E/W) en el primer lugar: inválido, no se adivina', () => {
    expect(interpretarUbicacion(`99°07'59.5"W 19°25'57.4"N`).tipo).toBe('invalido')
  })
})

describe('coordenadas fuera de rango', () => {
  it('una latitud fuera de ±90 es inválida, con motivo', () => {
    const r = interpretarUbicacion('91.5, -99.1332')
    expect(r).toMatchObject({ tipo: 'invalido' })
    if (r.tipo === 'invalido') expect(r.motivo).toMatch(/latitud/i)
    expect(interpretarUbicacion('-90.0001, 10.5').tipo).toBe('invalido')
  })

  it('una longitud fuera de ±180 es inválida, con motivo', () => {
    const r = interpretarUbicacion('19.4326, -181.25')
    expect(r).toMatchObject({ tipo: 'invalido' })
    if (r.tipo === 'invalido') expect(r.motivo).toMatch(/longitud/i)
    expect(interpretarUbicacion('19.4326, 180.0001').tipo).toBe('invalido')
  })

  it('el (0, 0) no es un lugar: es como llega «sin capturar» (lib/coordenadas.ts)', () => {
    expect(interpretarUbicacion('0.0, 0.0').tipo).toBe('invalido')
  })

  it('al revés (lng, lat) en México sale fuera de rango y se dice, no se voltea en silencio', () => {
    const r = interpretarUbicacion('-99.1332, 19.4326')
    expect(r.tipo).toBe('invalido')
  })
})

describe('lo que NO son coordenadas (y va al buscador de calles)', () => {
  it.each([
    ['Insurgentes Sur 1420, Del Valle'],
    ['Calle 5, 123'], // dos enteros: parece un par, pero es una dirección
    ['Av. 16 de Septiembre 45'],
    ['5 de Mayo 32, Centro, CDMX'],
  ])('«%s» es una dirección', (texto) => {
    expect(interpretarUbicacion(texto)).toEqual({ tipo: 'direccion', texto: texto.trim() })
  })

  it('dos enteros solos tampoco se toman por coordenadas', () => {
    expect(interpretarUbicacion('19, -99').tipo).toBe('direccion')
  })
})

describe('texto basura', () => {
  it.each([[''], ['   '], ['ab']])('«%s» es inválido (vacío o demasiado corto)', (texto) => {
    expect(interpretarUbicacion(texto).tipo).toBe('invalido')
  })

  it('solo signos, sin letras ni números, es inválido', () => {
    expect(interpretarUbicacion('!!!???,,,').tipo).toBe('invalido')
  })

  it('tres números no son un par de coordenadas', () => {
    expect(interpretarUbicacion('19.4326, -99.1332, 16.5').tipo).not.toBe('punto')
  })
})

describe('enlaces largos de Google Maps', () => {
  it('/maps/@lat,lng,zoom', () => {
    const r = interpretarUbicacion('https://www.google.com/maps/@19.4326077,-99.133208,17z')
    cerca(r, 19.4326077, -99.133208)
    expect(r).toMatchObject({ fuente: 'enlace' })
  })

  it('/maps/place/<nombre>/@lat,lng,…', () => {
    cerca(
      interpretarUbicacion('https://www.google.com/maps/place/Z%C3%B3calo/@19.4326077,-99.133208,17z/'),
      19.4326077,
      -99.133208,
    )
  })

  it('si trae !3d…!4d…, manda ESE (el lugar), no el @ (el centro de la vista)', () => {
    const url =
      'https://www.google.com/maps/place/Palacio+de+Bellas+Artes/@19.4352,-99.1412,17z/data=!3m1!4b1!4m6!3m5!1s0x85d1f92b75aaaaab:0x1!8m2!3d19.4352025!4d-99.1412256!16s'
    cerca(interpretarUbicacion(url), 19.4352025, -99.1412256)
  })

  it('?q=lat,lng', () => {
    cerca(interpretarUbicacion('https://maps.google.com/?q=19.4326,-99.1332'), 19.4326, -99.1332)
    cerca(interpretarUbicacion('https://www.google.com/maps?q=19.4326%2C-99.1332'), 19.4326, -99.1332)
  })

  it('?query=lat,lng (los enlaces api=1) y ?ll=', () => {
    cerca(
      interpretarUbicacion('https://www.google.com/maps/search/?api=1&query=19.4326,-99.1332'),
      19.4326,
      -99.1332,
    )
    cerca(interpretarUbicacion('https://maps.google.com/maps?ll=19.4326,-99.1332&z=16'), 19.4326, -99.1332)
  })

  it('/maps/search/lat,+lng', () => {
    cerca(interpretarUbicacion('https://www.google.com/maps/search/19.4326,+-99.1332'), 19.4326, -99.1332)
  })

  it('/maps/place/ con grados, minutos y segundos codificados', () => {
    cerca(
      interpretarUbicacion("https://www.google.com/maps/place/19%C2%B025'57.4%22N+99%C2%B007'59.5%22W/@19.43261,-99.13319,17z"),
      19.432611,
      -99.133194,
    )
  })

  it('los dominios de país (.com.mx) también son de Google', () => {
    cerca(interpretarUbicacion('https://www.google.com.mx/maps/@19.4326,-99.1332,15z'), 19.4326, -99.1332)
  })

  it('sin https:// delante también se reconoce', () => {
    cerca(interpretarUbicacion('www.google.com/maps/@19.4326,-99.1332,15z'), 19.4326, -99.1332)
  })

  it('pegado dentro de un texto (lo que da «Compartir» en el teléfono)', () => {
    cerca(
      interpretarUbicacion('Zócalo\nhttps://www.google.com/maps/@19.4326,-99.1332,15z'),
      19.4326,
      -99.1332,
    )
  })

  it('un enlace de Google Maps SIN coordenadas es inválido, con motivo que lo explica', () => {
    const r = interpretarUbicacion('https://www.google.com/maps/place/Z%C3%B3calo/')
    expect(r.tipo).toBe('invalido')
    if (r.tipo === 'invalido') expect(r.motivo).toMatch(/coordenadas/i)
  })

  it('un enlace de Google Maps con coordenadas fuera de rango es inválido', () => {
    expect(interpretarUbicacion('https://www.google.com/maps/@95.1,-99.1,15z').tipo).toBe('invalido')
  })
})

describe('enlaces cortos (se siguen en el servidor)', () => {
  it.each([
    ['https://maps.app.goo.gl/AbCdEf123'],
    ['maps.app.goo.gl/AbCdEf123'],
    ['https://goo.gl/maps/AbCdEf123'],
  ])('«%s» es un enlace corto', (texto) => {
    const r = interpretarUbicacion(texto)
    expect(r.tipo).toBe('enlace-corto')
    if (r.tipo === 'enlace-corto') expect(r.url).toMatch(/^https:\/\//)
  })

  it('goo.gl SIN /maps no es de Maps: inválido', () => {
    expect(interpretarUbicacion('https://goo.gl/AbCdEf123').tipo).toBe('invalido')
  })

  it('un enlace corto sin código es inválido', () => {
    expect(interpretarUbicacion('https://maps.app.goo.gl/').tipo).toBe('invalido')
  })
})

describe('enlaces de otros dominios', () => {
  it.each([
    ['https://evil.example.com/maps/@19.4326,-99.1332,15z'],
    ['https://google.com.evil.example/maps/@19.4326,-99.1332,15z'],
    ['https://www.google.com@evil.example/maps/@19.4326,-99.1332,15z'],
    ['https://evilgoogle.com/maps/@19.4326,-99.1332,15z'],
    ['https://maps.app.goo.gl.evil.example/AbC'],
    ['https://bit.ly/3abcde'],
    ['https://www.openstreetmap.org/#map=17/19.4326/-99.1332'],
    ['ftp://www.google.com/maps/@19.4326,-99.1332,15z'],
    ['javascript:alert(1)//www.google.com/maps/@19.4,-99.1'],
  ])('«%s» es inválido', (texto) => {
    const r = interpretarUbicacion(texto)
    expect(r.tipo).toBe('invalido')
  })

  it('un enlace de Google que no es de Maps (búsqueda, Drive) es inválido', () => {
    expect(interpretarUbicacion('https://www.google.com/search?q=19.4326,-99.1332').tipo).toBe('invalido')
    expect(interpretarUbicacion('https://drive.google.com/file/d/abc').tipo).toBe('invalido')
  })
})

describe('los motivos llegan traducidos al inglés', () => {
  it('cada motivo de rechazo está en el catálogo de errores del servidor', () => {
    // El servidor los lanza por variable (`AppError(i.motivo)`), y la GUARDIA
    // de `errores-servidor.test.ts` solo ve literales: sin esto, reescribir un
    // motivo lo dejaría en español para quien lee en inglés sin avisar.
    const casos = [
      '',
      '91.5, -99.1',
      '19.5, -181.5',
      '0.0, 0.0',
      `19°61'00"N 99°07'59.5"W`,
      `99°07'59.5"W 19°25'57.4"N`,
      'https://evil.example/maps/@1.5,2.5,3z',
      'https://maps.app.goo.gl/',
      'https://www.google.com/maps/place/Z%C3%B3calo/',
    ]
    const motivos = new Set<string>()
    for (const c of casos) {
      const r = interpretarUbicacion(c)
      expect(r.tipo, c).toBe('invalido')
      if (r.tipo === 'invalido') motivos.add(r.motivo)
    }
    expect(motivos.size).toBe(casos.length)
    for (const m of motivos) expect(CATALOGO_ERRORES[m], m).toBeTruthy()
  })
})

describe('las dos preguntas sueltas que usa el servidor al seguir redirecciones', () => {
  it('esEnlaceCortoDeGoogle', () => {
    expect(esEnlaceCortoDeGoogle(new URL('https://maps.app.goo.gl/abc'))).toBe(true)
    expect(esEnlaceCortoDeGoogle(new URL('https://goo.gl/maps/abc'))).toBe(true)
    expect(esEnlaceCortoDeGoogle(new URL('https://goo.gl/abc'))).toBe(false)
    expect(esEnlaceCortoDeGoogle(new URL('http://maps.app.goo.gl/abc'))).toBe(false)
    expect(esEnlaceCortoDeGoogle(new URL('https://maps.app.goo.gl.evil.example/abc'))).toBe(false)
  })

  it('esEnlaceDeGoogleMaps', () => {
    expect(esEnlaceDeGoogleMaps(new URL('https://www.google.com/maps/@1.5,2.5,3z'))).toBe(true)
    expect(esEnlaceDeGoogleMaps(new URL('https://maps.google.com/?q=1.5,2.5'))).toBe(true)
    expect(esEnlaceDeGoogleMaps(new URL('https://www.google.com.mx/maps/place/x'))).toBe(true)
    expect(esEnlaceDeGoogleMaps(new URL('https://www.google.com/search?q=x'))).toBe(false)
    expect(esEnlaceDeGoogleMaps(new URL('https://evil.example/maps/@1,2'))).toBe(false)
  })
})
