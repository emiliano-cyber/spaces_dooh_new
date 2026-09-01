import { describe, it, expect } from 'vitest'
import { pool } from './db'

// ============================================================================
//  El pool de la aplicación no puede tumbar el proceso.
// ----------------------------------------------------------------------------
//  Encontrado el 2026-09-01 en una corrida de `release.yml`: un "unhandled
//  error" con `code: '57P01'` — «terminating connection due to administrator
//  command» — que venía de este pool, importado por
//  `permisos-semilla.e2e.test.ts:280`.
//
//  El síntoma era de pruebas. El defecto es de PRODUCCIÓN: `pg` emite los
//  errores de clientes OCIOSOS en el pool, no en la consulta, así que ningún
//  `await` los recoge. Y un `error` sin oyente en un `EventEmitter` se lanza.
//  Resultado: **un reinicio de Postgres mataba el proceso de la aplicación.**
//
//  `pg` reconecta solo en la siguiente consulta, así que caerse era la peor de
//  las respuestas posibles.
// ============================================================================

describe('el pool de la aplicación', () => {
  it('tiene oyente de `error`, o un reinicio de Postgres tumba el proceso', () => {
    expect(pool.listenerCount('error')).toBeGreaterThan(0)
  })

  it('y emitir un error NO lanza', () => {
    const e = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    })
    expect(() => pool.emit('error', e, undefined as never)).not.toThrow()
  })
})
