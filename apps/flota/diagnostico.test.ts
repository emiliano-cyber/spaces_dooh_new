import { describe, expect, it } from 'vitest'

import { clasificarFallo, fraseDeActualizacion, CODIGOS_UPDATE } from './diagnostico.mjs'

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

// ============================================================================
//  Fase 2: la instancia cuenta si su actualizacion fallo, y en que paso.
// ----------------------------------------------------------------------------
//  Aqui la frontera va AL REVES que en el resto de este archivo: el dato viene
//  DE la instancia hacia el plano de control. Por eso lo que cruza son dos
//  valores de listas cerradas y NUNCA texto libre -- un mensaje de error puede
//  arrastrar un fragmento de log con datos de un cliente.
//
//  Las palabras las escribe el PADRE, que es el mismo principio que sostiene
//  `motivo` en la fase 1.

// ============================================================================
//  Fase 2: la instancia cuenta con QUE CODIGO salio su ultima actualizacion.
// ----------------------------------------------------------------------------
//  Aqui la frontera va AL REVES que arriba: el dato viene DE la instancia hacia
//  el plano de control. Por eso lo que cruza es UN NUMERO de una lista cerrada
//  y nunca texto libre -- un mensaje de error puede arrastrar un fragmento de
//  log con datos de un cliente. Las palabras las escribe el PADRE.
//
//  Y es el codigo de salida de `update.sh`, no un «paso» inventado: esos
//  codigos ya existen, ya estan documentados, y distinguen cosas que un nombre
//  de paso aplana -- un 2 es «la base pudo cambiar», un 3 es «no se aplico
//  nada», y su cabecera advierte de que aplanarlos seria el error que ese
//  script no puede cometer.
// ============================================================================
describe('fraseDeActualizacion', () => {
  it('el 0 no dice nada: el silencio es la señal', () => {
    expect(fraseDeActualizacion({ codigo: 0 })).toBeNull()
  })

  it('el 75 tampoco: habia otro update en marcha, y eso no es un fallo', () => {
    expect(fraseDeActualizacion({ codigo: 75 })).toBeNull()
  })

  // Una instancia con el `update.sh` viejo no manda la clave. NO es un fallo.
  it('sin codigo no dice nada, y NO es un fallo', () => {
    expect(fraseDeActualizacion({})).toBeNull()
    expect(fraseDeActualizacion()).toBeNull()
    expect(fraseDeActualizacion({ codigo: null })).toBeNull()
  })

  // Los dos que un «paso» habria aplanado, y son la razon de usar el codigo.
  it('el 2 avisa de que LA BASE PUDO CAMBIAR', () => {
    expect(fraseDeActualizacion({ codigo: 2 })).toContain('LA BASE PUDO CAMBIAR')
  })

  it('el 3 dice lo contrario: no se aplico nada', () => {
    expect(fraseDeActualizacion({ codigo: 3 })).toContain('no se aplico nada')
  })

  it('el 4 se lee como lo que es: el mecanismo funcionando', () => {
    expect(fraseDeActualizacion({ codigo: 4 })).toContain('la vuelta atras salio bien')
  })

  it('el 5 dice que la instancia puede estar caida', () => {
    expect(fraseDeActualizacion({ codigo: 5 })).toContain('puede estar caida')
  })

  it('el 7 grita, porque es el peor estado que ese guion puede producir', () => {
    expect(fraseDeActualizacion({ codigo: 7 })).toContain('LA BASE QUEDO VACIA')
  })

  it('un codigo que este panel no conoce se NOMBRA en vez de callarse', () => {
    expect(fraseDeActualizacion({ codigo: 42 })).toContain('42')
  })

  it('un codigo que llega como texto se entiende igual', () => {
    expect(fraseDeActualizacion({ codigo: '2' })).toContain('LA BASE PUDO CAMBIAR')
  })

  it('los codigos son una lista cerrada', () => {
    expect(CODIGOS_UPDATE).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 75])
  })
})
