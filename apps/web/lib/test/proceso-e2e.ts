// ============================================================================
//  lib/test/proceso-e2e.ts — cómo se LANZA y cómo se MATA el `next start` de
//  las pruebas de integración, según la plataforma.
// ----------------------------------------------------------------------------
//  Vive aparte de `servidor-e2e.ts` por una razón práctica: es un dato PURO y
//  se prueba con `npm test`, sin Docker. Importar `servidor-e2e.ts` desde una
//  unitaria arrastraría `db-e2e` (que exige una base cuyo nombre diga que es de
//  pruebas) y el doble de Google. La decisión de plataforma no necesita nada de
//  eso para ser correcta o incorrecta.
// ============================================================================

export interface OpcionesDeProceso {
  /** ¿El hijo lidera su propio grupo de procesos? */
  detached: boolean
  /** ¿Se lanza a través de un shell? */
  shell: boolean
}

export function opcionesDeProceso(
  plataforma: string = process.platform,
): OpcionesDeProceso {
  const esWindows = plataforma === 'win32'
  return {
    // En POSIX `pararServidor()` mata el GRUPO con `process.kill(-pid)`, y solo
    // existe un grupo con ese id si el hijo es su LIDER. Eso es `detached`.
    // Sin el, el hijo hereda el grupo del runner: `kill(-pid)` se va en ESRCH y
    // el `next start` sobrevive con el puerto tomado.
    //
    // En Windows va al reves: no se separa, porque alli el arbol lo baja
    // `taskkill /F /T` y `detached` solo conseguiria abrirle una consola.
    detached: !esWindows,
    // `npx` en Windows es un `.cmd`, y `spawn` sin shell no lo resuelve.
    shell: esWindows,
  }
}
