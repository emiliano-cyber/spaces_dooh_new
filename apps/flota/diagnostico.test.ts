import { describe, expect, it } from 'vitest'

import { clasificarFallo } from './diagnostico.mjs'

// ============================================================================
//  Pruebas del clasificador de fallos (fase 1 de
//  `docs/Plan_Panel_Flota_Diagnostico.md`).
// ----------------------------------------------------------------------------
//  Todo aquí es PURO: ni red, ni disco, ni reloj. Es lo que permite tener la
//  tabla entera cubierta sin levantar una instancia, y por eso el clasificador
//  se separó de `consultar()` en vez de vivir dentro.
//
//  Lo que se vigila no es que las frases suenen bien: es que un código que
//  nadie previó NO desaparezca detrás de un «error desconocido», y que el
//  código que se imprime sea el que llegó y no el representante de su fila.
// ============================================================================

/** Un error de `fetch` de Node: el mensaje es inútil, la causa es el dato. */
function errorDeRed(code: string) {
  const e = new Error('fetch failed') as Error & { cause?: { code: string } }
  e.cause = { code }
  return e
}

describe('clasificarFallo · red', () => {
  it('ENOTFOUND dice que el dominio no resuelve, Y trae el codigo', () => {
    expect(clasificarFallo({ error: errorDeRed('ENOTFOUND') })).toBe(
      'el dominio no resuelve (ENOTFOUND)',
    )
  })

  it('ECONNREFUSED dice que nadie escucha', () => {
    expect(clasificarFallo({ error: errorDeRed('ECONNREFUSED') })).toBe(
      'nadie escucha en el 443 (ECONNREFUSED)',
    )
  })

  it('CERT_HAS_EXPIRED dice que el certificado caduco', () => {
    expect(clasificarFallo({ error: errorDeRed('CERT_HAS_EXPIRED') })).toBe(
      'el certificado caduco (CERT_HAS_EXPIRED)',
    )
  })

  // El codigo impreso es EL QUE LLEGO, no el representante de su grupo:
  // EAI_AGAIN comparte frase con ENOTFOUND y tiene que salir con SU nombre. Si
  // saliera el del grupo, el panel diria un codigo que nadie vio.
  it('EAI_AGAIN comparte frase pero imprime SU propio codigo', () => {
    expect(clasificarFallo({ error: errorDeRed('EAI_AGAIN') })).toBe(
      'el dominio no resuelve (EAI_AGAIN)',
    )
  })

  it('un codigo que no esta en la tabla sale TAL CUAL, no como desconocido', () => {
    expect(clasificarFallo({ error: errorDeRed('EPROTO') })).toBe('EPROTO')
  })

  it('sin code se cae al mensaje', () => {
    expect(clasificarFallo({ error: new Error('algo raro') })).toBe('algo raro')
  })
})

describe('clasificarFallo · HTTP', () => {
  it('502 separa nginx de la aplicacion, con el codigo', () => {
    expect(clasificarFallo({ status: 502 })).toBe(
      'nginx contesta pero la aplicacion no (HTTP 502)',
    )
  })

  it('503 comparte frase con 502 pero imprime SU codigo', () => {
    expect(clasificarFallo({ status: 503 })).toBe(
      'nginx contesta pero la aplicacion no (HTTP 503)',
    )
  })

  it('404 dice que esa instancia es anterior a F6.1', () => {
    expect(clasificarFallo({ status: 404 })).toBe(
      'no existe /api/version: corre una version anterior a F6.1 (HTTP 404)',
    )
  })

  it('403 dice que el token no vale', () => {
    expect(clasificarFallo({ status: 403 })).toBe('el token no vale (HTTP 403)')
  })

  it('un estado sin traduccion conserva el formato de hoy', () => {
    expect(clasificarFallo({ status: 418 })).toBe('HTTP 418')
  })
})

describe('clasificarFallo · token', () => {
  it('con token, un cuerpo sin version es un token que no reconoce', () => {
    expect(clasificarFallo({ cuerpoSinVersion: true, token: 'x', nombre: 'g500' })).toBe(
      'el token no lo reconoce como panel',
    )
  })

  it('sin token, nombra la variable que falta', () => {
    expect(clasificarFallo({ cuerpoSinVersion: true, token: '', nombre: 'mi-cliente' })).toBe(
      'falta FLOTA_TOKEN_MI_CLIENTE en el panel',
    )
  })
})
