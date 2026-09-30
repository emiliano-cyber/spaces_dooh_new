import { describe, it, expect, vi, beforeEach } from 'vitest'
import { respuestaError, esBaseNoDisponible, AppError } from './errores'

// ============================================================================
//  `respuestaError()` ante una base que NO RESPONDE.
// ----------------------------------------------------------------------------
//  Una base caída no es un error del programa: es una avería pasajera del
//  servicio, y el cliente tiene que poder distinguirla. Por eso 503 y no 500,
//  y por eso un mensaje que dice «vuelve a intentarlo» en vez de «error
//  interno».
//
//  Las formas de error de abajo son las que produce `pg` de verdad: la de
//  `localhost` (un `AggregateError` con el `message` VACÍO) y la de una IP
//  literal se midieron el 2026-09-30 contra un puerto cerrado; los SQLSTATE son
//  los que manda Postgres al apagarse o al no admitir conexiones.
// ============================================================================

const MENSAJE = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'

function conCodigo(code: string, message = ''): Error {
  return Object.assign(new Error(message), { code })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('esBaseNoDisponible', () => {
  it.each([
    ['conexión rechazada (IP literal)', conCodigo('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:5433')],
    [
      'conexión rechazada (localhost: AggregateError con mensaje vacío)',
      Object.assign(new AggregateError([conCodigo('ECONNREFUSED')], ''), { code: 'ECONNREFUSED' }),
    ],
    ['AggregateError sin code propio, solo en los hijos', new AggregateError([conCodigo('ECONNREFUSED')], '')],
    ['host que no resuelve', conCodigo('ENOTFOUND', 'getaddrinfo ENOTFOUND db')],
    ['tiempo agotado de red', conCodigo('ETIMEDOUT')],
    ['conexión cortada por el otro lado', conCodigo('ECONNRESET')],
    ['57P01 · admin_shutdown (reinicio de Postgres)', conCodigo('57P01')],
    ['57P03 · cannot_connect_now (arrancando)', conCodigo('57P03')],
    ['53300 · too_many_connections', conCodigo('53300')],
    ['08006 · connection_failure', conCodigo('08006')],
    ['pool: tiempo agotado al conectar', new Error('timeout exceeded when trying to connect')],
    ['pg: conexión terminada', new Error('Connection terminated unexpectedly')],
    ['pg: conexión terminada por timeout', new Error('Connection terminated due to connection timeout')],
  ])('reconoce: %s', (_n, e) => {
    expect(esBaseNoDisponible(e)).toBe(true)
  })

  it.each([
    ['un Error cualquiera', new Error('se rompió algo')],
    ['23505 · unique_violation', conCodigo('23505')],
    ['42501 · RLS', conCodigo('42501')],
    ['un AppError', new AppError('No encontrado', 404)],
    ['null', null],
    ['un texto', 'ECONNREFUSED'],
  ])('NO confunde con una caída: %s', (_n, e) => {
    expect(esBaseNoDisponible(e)).toBe(false)
  })
})

describe('respuestaError con la base caída', () => {
  it('responde 503 con el mensaje en español y sin filtrar la dirección', async () => {
    const res = respuestaError(conCodigo('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:5433'))
    expect(res.status).toBe(503)
    const texto = await res.text()
    expect(JSON.parse(texto)).toEqual({ error: MENSAJE })
    expect(texto).not.toMatch(/ECONNREFUSED|5433|127\.0\.0\.1/)
  })

  it('y lo demás no cambia: un error inesperado sigue siendo 500 «Error interno»', async () => {
    const res = respuestaError(new Error('se rompió algo'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Error interno' })
  })

  it('y un choque de índice único sigue siendo 409', async () => {
    const res = respuestaError(conCodigo('23505'))
    expect(res.status).toBe(409)
  })
})
