import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

// ============================================================================
//  lib/cambios-candado.ts — El paso de la contraseña en un cambio sensible.
//  Módulo PURO: no hace `fetch`, no toca React. Recibe las dos acciones y
//  decide el orden. Por eso se puede probar sin DOM y sin servidor.
// ----------------------------------------------------------------------------
//  OJO, lo primero: esto NO protege nada. Quien decide si un cambio pasa es el
//  servidor (`lib/server/cambios.ts`, `exigirCambioSensible`). Aquí solo vive la
//  UX de pedir la contraseña y reintentar — o sea, que el camino EXISTA.
//
//  ─── Por qué existe ───────────────────────────────────────────────────────
//  El mismo bailoteo estaba copiado a mano en tres pantallas —baja de
//  propietario, borrado de cliente, administración—: un estado `reautenticando`,
//  otro `pass`, un `catch` que mira `esErrorDeDesbloqueo` y un reintento que
//  llama primero a `desbloquearApi`. La cuarta copia salió mal: el cuadro «Con
//  cuál de tus razones sociales se paga» (`ContratoSheet.tsx`) pedía la
//  contraseña y NO pintaba dónde escribirla, así que el camino directo estaba
//  muerto y solo quedaba el rodeo por «Cambios bloqueados». Cada copia a mano es
//  otra ocasión de olvidarse de una pieza; ésta se escribe una vez y se prueba.
//
//  ─── El orden NO es un detalle ────────────────────────────────────────────
//  Primero `desbloquear`, después `guardar`. Al revés el guardado volvería a
//  chocar con el candado y el usuario vería el cuadro dos veces con la
//  contraseña ya tecleada. Y si el desbloqueo falla, CORTA: no se guarda nada,
//  que es justo lo que hay que demostrar.
// ============================================================================

/**
 * Reconoce el «falta desbloquear» del servidor.
 *
 * Se compara por TEXTO y no por una marca estructurada porque los clientes de
 * `estado-api` lanzan `Error(d.error)` y por el camino se pierde
 * `requiereDesbloqueo`; lo único que sobrevive es el mensaje. La constante es
 * compartida con el servidor (`@/lib/cambios-mensajes`) para que no puedan
 * divergir — cuando estaban duplicadas, cambiar el texto de un lado dejaba al
 * usuario con un error rojo en vez del cuadro, sin forma de continuar.
 */
export function esErrorDeDesbloqueo(e: unknown): boolean {
  return e instanceof Error && e.message === MENSAJE_DESBLOQUEO
}

export type ResultadoCandado =
  /** Guardado. */
  | { estado: 'hecho' }
  /** Se pidió la contraseña y vino en blanco: no se intentó NADA. */
  | { estado: 'falta-contrasena' }
  /** Hay que pedirla (o volver a pedirla). `error` es null la primera vez. */
  | { estado: 'pedir-contrasena'; error: string | null }
  /** Falló por otra cosa. No se pide contraseña: tecleatla no arreglaría nada. */
  | { estado: 'error'; error: string }

function mensaje(e: unknown, siFalla: string): string {
  return e instanceof Error && e.message ? e.message : siFalla
}

/**
 * Ejecuta un cambio sensible resolviendo el candado por el camino.
 *
 * `reautenticando` es si la contraseña YA se pidió (o sea, si estamos en el
 * reintento). La primera vez es `false`: se intenta guardar y se deja que sea el
 * servidor quien diga si hace falta — el candado está apagado por defecto en los
 * tenants, así que preguntar siempre sería fricción inventada.
 */
export async function confirmarConCandado(opciones: {
  reautenticando: boolean
  contrasena: string
  desbloquear: (password: string) => Promise<unknown>
  guardar: () => Promise<unknown>
  mensajeSiFalla?: string
}): Promise<ResultadoCandado> {
  const { reautenticando, contrasena, desbloquear, guardar } = opciones
  const siFalla = opciones.mensajeSiFalla ?? 'No se pudo guardar'

  if (reautenticando) {
    // Sin recortar espacios: una contraseña puede empezar o acabar en uno, y un
    // `.trim()` de conveniencia la convertiría en otra distinta.
    if (!contrasena) return { estado: 'falta-contrasena' }
    try {
      await desbloquear(contrasena)
    } catch (e) {
      // Se sigue en el paso de la contraseña con el error puesto, y NO se
      // guarda. Volver a la primera pantalla haría perder lo ya elegido.
      return { estado: 'pedir-contrasena', error: mensaje(e, 'No se pudo desbloquear') }
    }
  }

  try {
    await guardar()
    return { estado: 'hecho' }
  } catch (e) {
    if (esErrorDeDesbloqueo(e)) return { estado: 'pedir-contrasena', error: null }
    return { estado: 'error', error: mensaje(e, siFalla) }
  }
}
