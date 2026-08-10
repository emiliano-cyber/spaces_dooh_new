// ============================================================================
//  lib/clic-unico.ts — «mientras esto vuela, no lo repitas» (A5 / INC-07)
// ----------------------------------------------------------------------------
//  Vive fuera del componente por dos motivos: se puede probar sin DOM —el repo
//  corre vitest en `node`, sin jsdom ni testing-library— y así lo que se prueba
//  es EXACTAMENTE lo que usa el botón, no una reimplementación parecida.
//
//  Lo que resuelve, dicho con precisión: un `useState` no sirve de guarda,
//  porque `setGuardando(true)` no cambia nada hasta el render siguiente y el
//  manejador del segundo clic todavía lee el valor viejo. Un cierre sobre una
//  variable local sí cambia en el mismo instante, y por eso el segundo clic se
//  lo encuentra ya puesto.
// ============================================================================

export interface GuardaEnVuelo {
  /** ¿Hay algo en vuelo ahora mismo? Síncrono: es lo que cierra la rendija. */
  ocupado(): boolean
  /**
   * Recibe lo que devolvió el manejador. Si es una promesa, marca «en vuelo»
   * hasta que se resuelva o falle. Devuelve si tomó el control.
   */
  seguir(resultado: unknown): boolean
}

const esPromesa = (v: unknown): v is Promise<unknown> =>
  !!v && typeof (v as Promise<unknown>).then === 'function'

export function guardaEnVuelo(alCambiar?: (enCurso: boolean) => void): GuardaEnVuelo {
  let enVuelo = false
  return {
    ocupado: () => enVuelo,
    seguir(resultado) {
      // Un manejador normal —que no devuelve promesa— no se bloquea nunca. Si
      // no, un botón corriente quedaría inservible tras el primer clic.
      if (!esPromesa(resultado)) return false
      enVuelo = true
      alCambiar?.(true)
      const soltar = () => {
        enVuelo = false
        alCambiar?.(false)
      }
      // `then(soltar, soltar)` y NO `finally`: `finally` devuelve una promesa
      // nueva que hereda el rechazo, y como aquí nadie la escucha, un error que
      // el formulario ya captura se convertiría ADEMAS en un «unhandled
      // rejection». Así se suelta igual en los dos casos sin crear ninguno.
      resultado.then(soltar, soltar)
      return true
    },
  }
}
