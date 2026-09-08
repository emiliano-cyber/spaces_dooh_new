// ============================================================================
//  La decisión de la compuerta, sin React.
// ----------------------------------------------------------------------------
//  `AuthGate.tsx` decide DOS cosas a la vez y con dos mecanismos distintos:
//
//    · adónde MANDA al usuario   → `router.replace()` en un efecto
//    · qué PINTA mientras tanto  → la escalera de `if` del render
//
//  Cuando esas dos decisiones se escriben por separado, divergen. Ya divergió
//  dos veces, y las dos con el mismo modo de fallo: el servidor exige algo, el
//  efecto manda a la pantalla que lo resuelve, y el render pinta un error
//  ENCIMA de esa pantalla. El usuario acaba encerrado mirando «No se pudieron
//  cargar los datos» con un botón de reintentar que no puede funcionar nunca,
//  porque el 403 no se va a mover hasta que use la pantalla que no le dejan ver.
//
//  Este módulo existe para que las dos salgan de la MISMA declaración, y va en
//  `.ts` a propósito: `vitest.config.ts` no monta jsdom —y no se va a montar
//  por la puerta de atrás—, así que una decisión que vive dentro del `.tsx` no
//  la prueba nadie. Es lo mismo que se hizo con `debeGuardarCodigos()` en
//  `lib/server/auth.ts`: la regla se declara una vez y la usan los dos lados.
// ============================================================================

// El tipo se IMPORTA del store en vez de copiarse: `import type` desaparece al
// compilar, así que esto no arrastra zustand a una prueba de `node`, y una
// segunda copia del tipo podría divergir del semáforo que sí manda.
import type { EstadoCarga } from '@/lib/data/store'

// Lo que la compuerta puede pintar. `contenido` = renderiza la página pedida.
export type Pantalla = 'cargando' | 'contenido' | 'error-de-carga'

export type SituacionUsuario = {
  // ADR 0028 · B2 — entró con Google y todavía no ha guardado sus códigos.
  debeGuardarCodigos: boolean
  // ADR 0009 — tiene una contraseña temporal puesta por un administrador.
  debeCambiarPassword: boolean
  // Ruta ya normalizada: sin `basePath` y sin barra final.
  ruta: string
  // El rol no alcanza el módulo de la ruta actual.
  noAutorizado: boolean
  estadoCarga: EstadoCarga
}

/**
 * ¿Está la aplicación CERRADA para este usuario, y por dónde sale?
 *
 * Devuelve la ruta de la única pantalla que puede usar, o `null` si no está
 * bloqueado. Es la lista completa de estados en los que `exigir()` responde 403
 * a todo (`lib/server/auth.ts:203-238`), y el orden importa:
 *
 * Los códigos van ANTES que la contraseña temporal porque quien entró con
 * Google no tiene contraseña que cambiar — mandarlo a Configuración lo dejaría
 * dando vueltas en una pantalla que no le sirve.
 *
 * > Al añadir aquí un estado bloqueante quedan cubiertos LOS DOS lados de la
 * > compuerta: la redirección y la exención de render. Eso es el punto de que
 * > exista esta función — el ADR 0028 añadió el estado tocando solo el efecto, y
 * > el resultado fue dejar la aplicación inaccesible en el PADRE.
 */
export function salidaObligatoria(u: {
  debeGuardarCodigos: boolean
  debeCambiarPassword: boolean
}): string | null {
  if (u.debeGuardarCodigos) return '/codigos-recuperacion'
  if (u.debeCambiarPassword) return '/configuracion'
  return null
}

export function decidirPantalla(s: SituacionUsuario): Pantalla {
  // Estando bloqueado, su pantalla de salida se RENDERIZA aunque el store no
  // haya cargado: mientras el estado siga puesto, `/api/estado` responde 403,
  // así que esperar a que cargue sería esperar para siempre. Y fuera de esa
  // pantalla no se pinta el error, porque hay una redirección en vuelo: el
  // error sería ruido sobre algo que ya se está resolviendo.
  const salida = salidaObligatoria(s)
  if (salida) return s.ruta === salida ? 'contenido' : 'cargando'

  if (s.noAutorizado) return 'cargando'
  if (s.estadoCarga === 'pendiente') return 'cargando'
  if (s.estadoCarga === 'error') return 'error-de-carga'
  return 'contenido'
}
