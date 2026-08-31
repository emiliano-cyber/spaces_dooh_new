import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { opcionesDeProceso, vigilarErrores, esperarMuerte } from './proceso-e2e'

// ============================================================================
//  El fallo que motiva estas pruebas (2026-08-31, PRIMERA corrida de
//  `release.yml`, o sea la primera vez que las e2e corrieron en Linux):
//  11 de 295 en rojo, y ninguno de los mensajes hablaba de esto.
//
//  `pararServidor()` mata el GRUPO de procesos con `process.kill(-pid)`
//  (`servidor-e2e.ts`). Para que exista un grupo cuyo id sea el pid del hijo,
//  el hijo tiene que ser su LÍDER — y un hijo solo lidera su grupo si se lanzó
//  con `detached`. Sin eso hereda el grupo del runner de pruebas, `kill(-pid)`
//  se va en ESRCH, el `catch` cae a matar únicamente a `npx` y el `next start`
//  de dentro SOBREVIVE, quedándose con el puerto 3311.
//
//  Lo que se veía después no señalaba nada de esto, y es lo que hace la prueba
//  necesaria: los 29 archivos e2e acababan hablando con el servidor que arrancó
//  el PRIMERO de ellos, así que
//
//   (a) las variables que cada archivo pone ANTES del spawn no llegaban nunca
//       —`ORG_NOMBRE`, `BOOTSTRAP_TOKEN`, `FLOTA_TOKEN`—, y sus casos fallaban
//       con el valor por omisión: 'SPACE OS' en vez de la marca, 404 en vez de
//       201, y
//   (b) el limitador de intentos (`lib/server/rate-limit.ts:13`, un `Map` en
//       memoria del proceso) acumulaba los cubos de TODOS los archivos, así que
//       los tardíos empezaban a recibir 429 «Demasiados intentos» en un login
//       que debía dar 401.
//
//  En Windows no ocurre, y por eso pasó siete semanas sin verse: allí se mata
//  con `taskkill /F /T`, que baja el árbol entero. El comentario de
//  `pararServidor()` ya describía este fallo exacto — pero atribuido solo a
//  Windows.
// ============================================================================

describe('el proceso del servidor de pruebas se puede matar en su plataforma', () => {
  it('en Linux el hijo lidera su grupo, o `kill(-pid)` no tiene a quién matar', () => {
    expect(opcionesDeProceso('linux').detached).toBe(true)
  })

  it('en macOS lo mismo: `pararServidor` usa la misma rama POSIX', () => {
    expect(opcionesDeProceso('darwin').detached).toBe(true)
  })

  it('en Windows NO se separa: allí el árbol lo baja `taskkill /F /T`', () => {
    // Y separarlo ahí sería peor que inútil: `detached` en Windows abre una
    // consola nueva para el hijo.
    expect(opcionesDeProceso('win32').detached).toBe(false)
  })

  it('el shell solo en Windows, que es donde `npx` es un .cmd', () => {
    expect(opcionesDeProceso('win32').shell).toBe(true)
    expect(opcionesDeProceso('linux').shell).toBe(false)
  })
})

// ============================================================================
//  El cierre limpio.  (2026-08-31)
// ----------------------------------------------------------------------------
//  Dos corridas de `release.yml` terminaron con `exit code 1` y las 295 e2e EN
//  VERDE. Un rojo asi no habla del codigo: habla de que el proceso de pruebas no
//  cierra limpio. Y es peor que el defecto original, porque convierte cada
//  release en una moneda al aire.
//
//  Las dos causas que se corrigen aqui, y las dos se prueban sin Linux:
//
//   (a) `spawn` no tenia manejador de `error`. En Node, un evento `error` sin
//       manejador NO se ignora: se convierte en excepcion no capturada. Vitest
//       la cuenta como fallo de la corrida aunque ninguna prueba falle.
//   (b) `pararServidor()` mandaba la senal y seguia. Con `detached` el hijo
//       SOBREVIVE al padre por diseño, asi que si tarda en morir el runner
//       cierra con el todavia vivo.
// ============================================================================

describe('el servidor de pruebas cierra limpio', () => {
  it('un `error` del proceso NO tumba la corrida entera', () => {
    const falso = new EventEmitter() as any
    const vistos: string[] = []
    vigilarErrores(falso, (m) => vistos.push(m))

    // Sin manejador, esto LANZA: es la regla de `EventEmitter` para 'error'.
    expect(() => falso.emit('error', new Error('spawn ENOENT'))).not.toThrow()
    expect(vistos).toHaveLength(1)
    expect(vistos[0]).toMatch(/ENOENT/)
  })

  it('parar ESPERA a que el proceso muera, no solo manda la senal', async () => {
    const falso = new EventEmitter() as any
    falso.exitCode = null
    falso.signalCode = null

    let resuelto = false
    const espera = esperarMuerte(falso, 1_000).then((r) => { resuelto = true; return r })
    await new Promise((r) => setImmediate(r))

    expect(resuelto, 'no puede darse por muerto antes de que salga').toBe(false)

    falso.emit('exit', 0, null)
    await expect(espera).resolves.toBe('salio')
  })

  it('y no se cuelga para siempre si el proceso no muere', async () => {
    // Un `await` sin limite seria cambiar un fallo intermitente por un cuelgue,
    // que es peor: al menos el rojo se ve.
    const falso = new EventEmitter() as any
    falso.exitCode = null
    falso.signalCode = null
    await expect(esperarMuerte(falso, 20)).resolves.toBe('timeout')
  })

  it('si ya estaba muerto, no espera nada', async () => {
    const falso = new EventEmitter() as any
    falso.exitCode = 0
    falso.signalCode = null
    await expect(esperarMuerte(falso, 1_000)).resolves.toBe('ya-estaba')
  })
})
