import { describe, it, expect } from 'vitest'
import { opcionesDeProceso } from './proceso-e2e'

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
