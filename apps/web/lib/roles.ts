import type { RolDemo } from './data/types'

// ============================================================================
//  lib/roles.ts — El catálogo de roles, declarado UNA sola vez.
// ----------------------------------------------------------------------------
//  ADR 0040. Hasta hoy la lista de roles vivía en CUATRO sitios sin que nada
//  obligara a que coincidieran:
//
//    · el `z.enum(ROLES)` de `lib/server/usuarios-controller.ts` (qué acepta la
//      API al dar de alta);
//    · el `ROLES` de `components/demo/shell/nav.ts` (qué ofrece el desplegable);
//    · el `ROL_LABEL` de `lib/server/usuarios-repo.ts` (cómo se llama cada
//      columna de la matriz de permisos);
//    · el `switch` de `lib/data/usuarios.ts` (a dónde aterriza cada uno).
//
//  Con cuatro roles nuevos entrando de golpe eso son cuatro oportunidades de
//  que uno se quede fuera, y el síntoma de quedarse fuera no señala la causa:
//  el usuario se crea, entra, y no ve ninguna pantalla. Es la misma lección del
//  mapa `ANTES_DE` duplicado entre el runner y el arnés — lo que impide que dos
//  listas diverjan no es que hoy coincidan, es que solo exista una.
//
//  Vive FUERA de `server-only` a propósito: lo importan el controller (servidor)
//  y el menú (cliente). Es un dato puro, sin dependencias.
// ============================================================================

/**
 * TODO lo que el enum `rol_demo` de Postgres admite, retirados incluidos.
 *
 * No es lo mismo que `ROLES_ASIGNABLES`: 'COMERCIAL' y 'CLIENTE' siguen en el
 * enum de la base —un valor de enum no se puede quitar sin recrear el tipo— y
 * una fila vieja puede traerlos. Dejarlos fuera del tipo obligaría a un `as` en
 * cada sitio que lea un rol de la base, que es como se cuela un valor sin
 * manejar.
 */
export const VALORES_ROL = [
  'DUENO',
  'ADMINISTRADOR',
  'DIRECTOR_COMERCIAL',
  'GERENTE_VENTAS',
  'VENDEDOR',
  'OPERACIONES',
  'IMPRENTA',
  'FINANZAS',
  // ─── Retirados de uso, vivos en el enum ───────────────────────────────────
  // 'COMERCIAL' se retira con el ADR 0040: los tres roles de venta lo cubren, y
  // la migración `20260929_roles_de_venta_matriz.sql` le quita sus filas de
  // `rol_permisos`. 'CLIENTE' se retiró con el ADR 0010 por el mismo motivo.
  // Los dos entran aquí y NO en `ROLES_ASIGNABLES`.
  'COMERCIAL',
  'CLIENTE',
] as const satisfies readonly RolDemo[]

/**
 * Los roles que el producto OFRECE al dar de alta a alguien.
 *
 * El orden es el del organigrama, no el alfabético: quien manda arriba. Es lo
 * que se pinta en el desplegable del alta y en las columnas de la matriz de
 * permisos, así que leerlo de arriba abajo tiene que contar algo.
 */
export const ROLES_ASIGNABLES: { value: RolDemo; label: string }[] = [
  { value: 'DUENO', label: 'Dueño' },
  // ADR 0040 · «el administrador no es el dueño, pero puede hacer las mismas
  // cosas que él». Las mismas filas de `rol_permisos`, y DOS cosas menos que no
  // salen de esa tabla: no cambia de organización y no toca a ningún Dueño.
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'DIRECTOR_COMERCIAL', label: 'Director comercial' },
  { value: 'GERENTE_VENTAS', label: 'Gerente de ventas' },
  { value: 'VENDEDOR', label: 'Vendedor' },
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'IMPRENTA', label: 'Imprenta' },
  { value: 'FINANZAS', label: 'Finanzas' },
  // 'COMERCIAL' salió de esta lista el 2026-09-29 (ADR 0040) y 'CLIENTE' el
  // 2026-08-11 (ADR 0010). Los dos por la misma razón: sin filas en
  // `rol_permisos` y con `tienePermiso` fail-closed, crear uno produce un
  // usuario que entra y recibe 403 en todo. Lo que se cierra es la puerta de
  // creación, no el manejo de lo que ya exista.
]

/** El rol con el que nace quien no eligió ninguno. */
export const ROL_POR_OMISION: RolDemo = 'VENDEDOR'

/**
 * Etiqueta de un rol. Cae al propio valor si no está en la lista, que es el
 * caso de los retirados: una pantalla que pinte un usuario viejo no debe
 * romperse ni enseñar «undefined».
 */
export function rolLabel(rol: RolDemo): string {
  return ROLES_ASIGNABLES.find((r) => r.value === rol)?.label ?? rol
}
