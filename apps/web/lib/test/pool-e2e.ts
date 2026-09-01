// ============================================================================
//  lib/test/pool-e2e.ts — que un pool de Postgres no tumbe la corrida entera.
// ----------------------------------------------------------------------------
//  El fallo que lo motiva (2026-09-01, corrida de `v0.1.0` en `release.yml`):
//
//    Vitest caught 2 unhandled errors during the test run.
//    Uncaught Exception: error: terminating connection due to administrator
//    command   ·   code: '57P01'
//    bases: spaces_rezagada_e2e y spaces_grants_e2e
//
//  Las **295 pruebas en verde** y la corrida en `exit code 1`.
//
//  El mecanismo, de punta a punta:
//
//   1. Varios archivos montan su escenario en una base DESECHABLE y la tiran al
//      terminar con `drop database ... with (force)`. Ese `with (force)` existe
//      desde Postgres 13 y hace exactamente lo que dice: **termina las
//      conexiones abiertas** contra esa base.
//   2. Al terminarlas, el servidor manda `57P01` a cada cliente vivo.
//   3. `pg` emite ese error en el **pool**, no en la consulta: es un error de
//      cliente OCIOSO, no de una llamada en curso, asi que no hay `await` que lo
//      recoja.
//   4. Un `error` sin oyente en un `EventEmitter` **no se ignora: se lanza**. Y
//      una excepcion no capturada tumba la corrida aunque no falle una sola
//      prueba.
//
//  Es intermitente porque es una carrera: solo revienta si al `drop` le quedaba
//  algun cliente por cerrar. Por eso salio rojo dos veces de tres.
//
//  ─── Por que un manejador y no "cerrar mejor" ──────────────────────────────
//  Cerrar el pool antes del `drop` ya se hace (`if (pool) await pool.end()`), y
//  aun asi ocurre: `end()` es asincrono y el `with (force)` puede llegar antes
//  de que el ultimo cliente termine. Un manejador **no tapa el error**: lo
//  convierte en ruido registrado en vez de en una muerte de la corrida, que es
//  el trato correcto para un error de una base que estamos borrando a proposito.
// ============================================================================

/** Lo minimo que este modulo necesita de un pool. */
export interface PoolObservable {
  on(evento: string, oyente: (...args: any[]) => void): unknown
}

export function vigilarPool(
  pool: PoolObservable,
  nombre = 'pool',
  registrar: (mensaje: string) => void = (m) => console.error(m),
): void {
  // SIN filtrar por codigo, y es deliberado: un manejador que solo atendiera el
  // 57P01 volveria a dejar sin oyente a los demas, y el fallo reaparecería con
  // otra cara. Aqui se atiende TODO y se registra TODO.
  pool.on('error', (e: any) => {
    const codigo = e?.code ? ` [${e.code}]` : ''
    registrar(`pool-e2e: error en el pool de «${nombre}»${codigo}: ${e?.message ?? e}`)
  })
}
