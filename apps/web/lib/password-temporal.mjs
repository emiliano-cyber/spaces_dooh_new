// ============================================================================
//  La contraseña temporal, en UN solo sitio.
// ----------------------------------------------------------------------------
//  Vivía dentro de `lib/server/usuarios-controller.ts`, sin exportar, y el alta
//  de una instancia (`apps/web/scripts/bootstrap-auth.mjs`) no podía usarla: es
//  un script suelto que no importa nada de la aplicación. Por eso el alta
//  sembraba `spaces123` en toda la flota — ROJO-1 del re-ensayo de la Fase 4.
//
//  Se EXTRAE en vez de reimplementarla, y la decisión no es de estilo: este
//  repositorio ya tiene la lección escrita más de una vez —el mapa `ANTES_DE`
//  duplicado entre el runner y el arnés, y las dos matrices de permisos que
//  cerró ROJO-2—. Dos generadores pueden divergir, y la divergencia de un
//  generador de contraseñas no da error: da contraseñas peores en el sitio que
//  nadie volvió a mirar.
//
//  Es `.mjs` y NO `.ts` por una razón concreta: sus dos consumidores son un
//  módulo de la aplicación y un script de node lanzado a pelo. El `.mjs` los
//  sirve a los dos sin build de por medio, que es el mismo camino que ya usa
//  `scripts/migrar.mjs` con `apps/web/lib/test/db-e2e.ts`. NO lleva
//  `import 'server-only'` por eso mismo: el script no pasa por webpack.
// ============================================================================
import { randomInt } from 'node:crypto'

// Sin los pares que se confunden al dictar por teléfono: 0/O y 1/l/I. 31
// caracteres, 16 posiciones — 31^16 ≈ 2^79 combinaciones, de sobra para algo
// que solo vive hasta el primer login, y mucho mejor que dejar a un
// administrador inventarse "Temporal123".
export const ALFABETO_TEMPORAL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Contraseña temporal legible pero no adivinable, en cuatro grupos de cuatro.
 *
 * `randomInt` del módulo `crypto`, no `Math.random`: el segundo es predecible
 * desde otras salidas del mismo generador, y aquí lo que está en juego es una
 * cuenta — en el alta, la de máximo privilegio de una instancia entera.
 *
 * @returns {string} p. ej. `H7K2-9QRT-MW4X-YZ38`
 */
export function generarPasswordTemporal() {
  const grupo = () =>
    Array.from({ length: 4 }, () => ALFABETO_TEMPORAL[randomInt(ALFABETO_TEMPORAL.length)]).join('')
  return Array.from({ length: 4 }, grupo).join('-')
}
