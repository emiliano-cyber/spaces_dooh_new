import { describe, it, expect } from 'vitest'
import { coordenada, puntoUtil } from './coordenadas'

// ============================================================================
//  ¿Esta pantalla sabe dónde está?
//
//  Lo que protege esto es el MAPA, y el fallo que lo motivó no daba ningún
//  error. Una pantalla sin coordenadas sale de la base como NULL, y
//  `rowToSitio` la convertía en 0 (`lib/server/sitios-repo.ts:44-45`). Cero es
//  un número finito, así que pasaba el filtro de MapView y se dibujaba en el
//  (0,0) — mar abierto en el golfo de Guinea. Peor aún: el auto-enfoque busca
//  el cúmulo más denso, lo encontraba ahí y ENCUADRABA EL MAPA EN EL OCÉANO.
//
//  Se veía igual en el PADRE y en toda la flota, porque es el mismo binario, y
//  no se parecía a un dato faltante: se parecía a un mapa roto.
//
//  La regla del (0,0) NO es nueva: `predio-cercania.ts:92-98` ya la aplicaba
//  desde su lado. Vive aquí para que haya UNA sola definición de "esta
//  ubicación sirve" y el mapa no vuelva a quedarse fuera de ella.
// ============================================================================

describe('coordenada', () => {
  it('acepta números y cadenas numéricas (Postgres devuelve numeric como texto)', () => {
    expect(coordenada(19.4326)).toBe(19.4326)
    expect(coordenada('-99.1332')).toBe(-99.1332)
  })

  it('rechaza lo que no es un número utilizable', () => {
    expect(coordenada(null)).toBeNull()
    expect(coordenada(undefined)).toBeNull()
    expect(coordenada('')).toBeNull()
    expect(coordenada('por definir')).toBeNull()
    expect(coordenada(Number.NaN)).toBeNull()
    expect(coordenada(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('puntoUtil', () => {
  it('devuelve el punto cuando las dos coordenadas sirven', () => {
    expect(puntoUtil(19.4326, -99.1332)).toEqual({ lat: 19.4326, lng: -99.1332 })
  })

  // EL CASO QUE MOTIVÓ TODO ESTO.
  it('descarta el (0,0): es el hueco disfrazado de lugar', () => {
    expect(puntoUtil(0, 0)).toBeNull()
    expect(puntoUtil('0', '0')).toBeNull()
  })

  it('descarta el punto si falta CUALQUIERA de las dos', () => {
    expect(puntoUtil(19.4326, null)).toBeNull()
    expect(puntoUtil(null, -99.1332)).toBeNull()
    expect(puntoUtil(null, null)).toBeNull()
  })

  // Un cero SOLO es una coordenada legítima: el ecuador y el meridiano de
  // Greenwich existen. Solo el par completo en cero es el centinela.
  it('NO descarta un cero solo', () => {
    expect(puntoUtil(0, -99.1332)).toEqual({ lat: 0, lng: -99.1332 })
    expect(puntoUtil(19.4326, 0)).toEqual({ lat: 19.4326, lng: 0 })
  })

  it('descarta coordenadas fuera del rango terrestre', () => {
    expect(puntoUtil(91, 0)).toBeNull()
    expect(puntoUtil(-91, 0)).toBeNull()
    expect(puntoUtil(0, 181)).toBeNull()
    expect(puntoUtil(0, -181)).toBeNull()
  })
})
