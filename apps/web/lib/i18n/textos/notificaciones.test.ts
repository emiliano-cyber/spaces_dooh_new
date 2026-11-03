import { describe, it, expect } from 'vitest'
import { ES_NOTIFICACIONES, EN_NOTIFICACIONES } from './notificaciones'

// ============================================================================
//  EL DICCIONARIO DE LA CAMPANITA, CONGELADO.
// ----------------------------------------------------------------------------
//  Instantanea y las guardias de forma de todos los `textos/`. Que cada
//  plantilla espanola sea el literal del servidor lo ata
//  `lib/i18n/notificaciones.test.ts`.
// ============================================================================

const ES = ES_NOTIFICACIONES as Record<string, string>
const EN = EN_NOTIFICACIONES as Record<string, string>

describe('diccionario de NOTIFICACIONES · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_NOTIFICACIONES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_NOTIFICACIONES).toMatchSnapshot()
  })
})

describe('diccionario de NOTIFICACIONES · el ingles no esta en espanol', () => {
  it('ninguna entrada inglesa es igual a la espanola', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k])).toEqual([])
  })
  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(Object.entries(EN).filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })
  it('todo plural lleva sus dos formas, y su hueco {n}', () => {
    const sueltas = Object.keys(ES).filter(
      (k) => (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) || (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
    expect(Object.keys(ES).filter((k) => /\.(uno|otros)$/.test(k) && !ES[k].includes('{n}'))).toEqual([])
  })
  it('ninguna cifra de dinero ni simbolo de moneda', () => {
    expect(Object.entries({ ...ES, ...EN }).filter(([, v]) => /\$|MXN|USD|\d,\d{3}/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('todas las claves llevan el prefijo del ambito', () => {
    expect(Object.keys(ES).filter((k) => !k.startsWith('notificaciones.'))).toEqual([])
  })
})
