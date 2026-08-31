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

// ============================================================================
//  El cierre del proceso. Extraido aqui por lo mismo que las opciones: es
//  logica pura sobre un emisor de eventos, y asi se prueba con `npm test`.
// ----------------------------------------------------------------------------
//  El fallo que lo motiva (2026-08-31, corridas de v0.0.1-rc2 y v0.1.0): el paso
//  de e2e termina con `exit code 1` teniendo las 295 pruebas EN VERDE, y a la
//  corrida siguiente sale limpio sin tocar nada. Intermitente, o sea que cada
//  release es una moneda al aire.
// ============================================================================

/** Lo minimo que este modulo necesita de un proceso hijo. */
export interface ProcesoObservable {
  on(evento: string, oyente: (...args: any[]) => void): unknown
  once(evento: string, oyente: (...args: any[]) => void): unknown
  exitCode?: number | null
  signalCode?: string | null
}

export function vigilarErrores(
  proceso: ProcesoObservable,
  registrar: (mensaje: string) => void = (m) => console.error(m),
): void {
  // En Node, un evento `error` SIN manejador no se ignora: se convierte en
  // excepcion no capturada. Vitest la cuenta como fallo de la corrida aunque
  // ninguna prueba haya fallado -- que es como se ve un `exit code 1` con todo
  // en verde. El manejador no arregla el error: lo hace VISIBLE en vez de
  // letal, que es lo que hace falta cuando el hijo es un servidor auxiliar.
  proceso.on('error', (e: any) => {
    registrar(`servidor-e2e: el proceso del servidor fallo: ${e?.message ?? e}`)
  })
}

export function esperarMuerte(
  proceso: ProcesoObservable,
  msLimite = 5_000,
): Promise<'salio' | 'ya-estaba' | 'timeout'> {
  // Mandar la senal no es lo mismo que estar muerto. Con `detached` el hijo
  // sobrevive al padre POR DISEÑO, asi que si tarda en morir el runner cierra
  // con el todavia vivo -- y ahi es donde aparece el `exit code 1` de una
  // corrida en verde.
  if (proceso.exitCode != null || proceso.signalCode != null) {
    return Promise.resolve('ya-estaba')
  }
  return new Promise((resolver) => {
    // CON limite, y no es un detalle: un `await` sin techo cambiaria un fallo
    // intermitente por un CUELGUE, que es peor. Al menos un rojo se ve.
    const reloj = setTimeout(() => resolver('timeout'), msLimite)
    proceso.once('exit', () => {
      clearTimeout(reloj)
      resolver('salio')
    })
  })
}
