import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { vigilarPool } from './pool-e2e'

// ============================================================================
//  El caso real que estas pruebas reproducen (2026-09-01):
//
//    Vitest caught 2 unhandled errors during the test run.
//    Uncaught Exception: error: terminating connection due to administrator
//    command   ·   code: '57P01'
//
//  Con 295 pruebas en verde y la corrida en `exit code 1`. Postgres corta las
//  conexiones cuando una base desechable se borra con `with (force)`, `pg`
//  emite ese error en el POOL —es un cliente ocioso, no una consulta en curso—
//  y un `error` sin oyente en un `EventEmitter` no se ignora: se lanza.
//
//  Se prueba sobre un `EventEmitter`, asi que caza desde Windows un fallo que
//  solo aparece en el CI. Mismo patron que `proceso-e2e.test.ts`.
// ============================================================================

/** El error tal y como lo manda Postgres al terminar un backend. */
function error57P01(base: string) {
  return Object.assign(new Error('terminating connection due to administrator command'), {
    code: '57P01',
    severity: 'FATAL',
    routine: 'ProcessInterrupts',
    base,
  })
}

describe('un pool de pruebas no tumba la corrida', () => {
  it('el 57P01 de una base borrada a proposito NO es una excepcion no capturada', () => {
    const pool = new EventEmitter() as any
    const vistos: string[] = []
    vigilarPool(pool, 'spaces_rezagada_e2e', (m) => vistos.push(m))

    // Sin oyente, esto LANZA. Es la regla de `EventEmitter` para 'error', y es
    // exactamente lo que mato las corridas de v0.0.1-rc2 y v0.1.0.
    expect(() => pool.emit('error', error57P01('spaces_rezagada_e2e'))).not.toThrow()

    expect(vistos).toHaveLength(1)
  })

  it('y deja dicho QUE pool fue, que es lo que faltaba en el log del CI', () => {
    // El log del CI daba un objeto serializado de 4 KB donde el nombre de la
    // base habia que ir a buscarlo. Registrarlo cuesta nada y ahorra el viaje.
    const pool = new EventEmitter() as any
    const vistos: string[] = []
    vigilarPool(pool, 'spaces_grants_e2e', (m) => vistos.push(m))

    pool.emit('error', error57P01('spaces_grants_e2e'))

    expect(vistos[0]).toContain('spaces_grants_e2e')
    expect(vistos[0]).toContain('57P01')
  })

  it('no se come cualquier error: los registra todos, tambien los que no son 57P01', () => {
    // Un manejador que filtrara por codigo volveria a dejar sin oyente a los
    // demas, y el fallo reaparecería con otra cara.
    const pool = new EventEmitter() as any
    const vistos: string[] = []
    vigilarPool(pool, 'spaces_e2e', (m) => vistos.push(m))

    expect(() => pool.emit('error', new Error('ECONNRESET'))).not.toThrow()
    expect(vistos[0]).toContain('ECONNRESET')
  })
})
