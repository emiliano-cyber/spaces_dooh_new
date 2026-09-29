// ============================================================================
//  lib/guardas-usuarios.ts — Los DOS guards que protegen al Dueño (ADR 0040).
// ----------------------------------------------------------------------------
//  Aquí vive la DECISIÓN y nada más. Esta función no consulta nada: recibe el
//  rol de quien actúa, la fila del afectado y CUÁNTOS Dueños activos hay, y
//  contesta con la frase del rechazo o con `null`.
//
//  ─── Por qué el conteo entra como PARÁMETRO y no se consulta aquí ──────────
//
//  Porque si lo consultara, la carrera sería inevitable. Dos peticiones
//  simultáneas desactivando a los dos últimos Dueños leerían las dos «hay 2»,
//  las dos concluirían que pueden, y la organización se quedaría con CERO.
//
//  Quien alimenta este número es `usuarios-repo.ts`, y lo hace con las filas de
//  los Dueños activos **BLOQUEADAS** (`select … for update`) ANTES de contarlas.
//  El orden es el mecanismo: contar antes de bloquear sería el mismo `select`
//  sin lock con un `for update` decorativo detrás. Es la misma forma con la que
//  la Fase 3 del ADR 0039 resolvió la carrera del último uso de un cupón.
//
//  ─── Las dos reglas, dictadas el 2026-09-29 ────────────────────────────────
//
//   1. Un ADMINISTRADOR no puede desactivar, degradar ni eliminar a NINGÚN
//      usuario con rol DUENO.
//   2. NADIE puede dejar la organización sin ningún Dueño activo. Aplica a
//      todos, incluido un Dueño tocando a otro.
//
//  La segunda no se pidió, y es la que evita que dos Dueños se desactiven
//  mutuamente y dejen la empresa sin quien reparta permisos ni cambie la
//  configuración — un estado del que no se sale desde la aplicación.
//
//  Y van EN EL SERVIDOR, no en la pantalla: esconder el botón no es una regla,
//  porque un `curl` se lo salta.
// ============================================================================

export const ROL_DUENO = 'DUENO'
export const ROL_ADMINISTRADOR = 'ADMINISTRADOR'

/** La fila del usuario afectado, tal como está ANTES del cambio. */
export interface UsuarioAfectado {
  rol: string
  activo: boolean
}

/** Lo que la petición quiere hacerle. `borrado` es el DELETE. */
export interface CambioPedido {
  rol?: string
  activo?: boolean
  borrado?: boolean
}

export interface EntradaGuarda {
  /** Rol de quien ejecuta la acción (de la SESIÓN, nunca del cuerpo). */
  actorRol: string
  objetivo: UsuarioAfectado
  cambio: CambioPedido
  /**
   * Dueños ACTIVOS de la organización, contados con sus filas bloqueadas y
   * INCLUYENDO al objetivo si lo es.
   */
  duenosActivos: number
}

/**
 * ¿Deja este cambio a alguien sin su rol de Dueño?
 *
 * Las tres formas de quitárselo son equivalentes en consecuencia y por eso van
 * juntas: desactivarlo, cambiarle el rol a otro, y borrarlo. Si el borrado se
 * quedara fuera, el guard sería decorativo — el mismo actor conseguiría el
 * mismo resultado con DELETE en vez de PATCH.
 */
function dejaDeSerDueno(objetivo: UsuarioAfectado, cambio: CambioPedido): boolean {
  if (objetivo.rol !== ROL_DUENO) return false
  if (cambio.borrado) return true
  if (cambio.activo === false) return true
  return cambio.rol !== undefined && cambio.rol !== ROL_DUENO
}

/**
 * El rechazo, o `null` si el cambio se permite.
 *
 * Devuelve el MOTIVO y no un booleano a propósito: quien recibe el error tiene
 * que saber si es que eso no es cosa suya (guard 1) o si es que no queda otro
 * Dueño (guard 2). Con un booleano, la interfaz tendría que inventarse el
 * mensaje y acabaría diciendo «no tienes permiso» a un Dueño que sí lo tiene.
 *
 * Y lleva `status` porque los dos casos NO son el mismo error:
 *
 *   · 403 · el guard del administrador es una cuestión de permiso: esa acción no
 *     es suya, y no lo será nunca por muchos Dueños que haya.
 *   · 409 · quedarse sin Dueño NO es falta de permiso —el Dueño que lo intenta
 *     tiene todos— sino un CONFLICTO con el estado de la organización. Con un
 *     403, la interfaz le diría a un Dueño que no tiene permiso para algo que sí
 *     puede hacer en cuanto nombre a otro, y eso manda a buscar el problema al
 *     sitio equivocado.
 */
export function rechazoDelCambio(e: EntradaGuarda): { status: number; mensaje: string } | null {
  const pierdeElRol = dejaDeSerDueno(e.objetivo, e.cambio)
  if (!pierdeElRol) return null

  // GUARD 1 · va PRIMERO aunque el 2 también aplicara. Al administrador hay que
  // decirle que eso no es cosa suya, no que «falta otro Dueño»: lo segundo le
  // haría creer que con dos Dueños sí podría, y no puede.
  if (e.actorRol === ROL_ADMINISTRADOR) {
    return {
      status: 403,
      mensaje: 'Un administrador no puede desactivar, cambiar de rol ni eliminar a un Dueño.',
    }
  }

  // GUARD 2 · solo cuenta si el objetivo ESTÁ activo: quitarle el rol a un
  // Dueño que ya estaba desactivado no reduce el número de Dueños activos, y
  // prohibirlo sería cerrar la puerta de la limpieza.
  if (e.objetivo.activo && e.duenosActivos <= 1) {
    return {
      status: 409,
      mensaje:
        'La organización se quedaría sin ningún Dueño activo. ' +
        'Nombra antes a otro Dueño: sin ninguno no hay quien reparta permisos ' +
        'ni cambie la configuración de la empresa.',
    }
  }

  return null
}
