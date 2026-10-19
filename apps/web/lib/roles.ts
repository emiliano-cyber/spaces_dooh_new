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

/**
 * Quién ve el panel del control de cambios (Administración → Roles y permisos).
 *
 * El Dueño y el ADMINISTRADOR. Decidido por el dueño el 2026-09-29, y cierra
 * una incoherencia que ya existía: la ruta que enciende y apaga el candado
 * exige `administracion.aprobar` (`app/api/cambios/route.ts:32`), permiso que
 * el administrador YA tiene con el ADR 0040. O sea que por API podía apagarlo
 * mientras la pantalla se lo escondía — y un permiso que el servidor concede y
 * la interfaz niega no es una regla, es un botón escondido.
 *
 * Vive aquí y NO dentro de `ControlCambiosPanel.tsx` porque una condición
 * escrita dentro de un `.tsx` no la comprueba nada: el arnés no monta DOM. Esta
 * semana tres mutantes que borraban avisos del reporte sobrevivieron por
 * exactamente eso.
 *
 * Ojo con lo que este panel hace, que es lo que lo pone en el límite de las dos
 * excepciones del administrador: APAGA la segunda barrera sobre el dinero. No
 * se amplía a más roles sin decidirlo a propósito.
 */
export function puedeVerControlCambios(rol: RolDemo | null | undefined): boolean {
  return rol === 'DUENO' || rol === 'ADMINISTRADOR'
}

/**
 * Quién puede mover lo que la cámara de un equipo de Space Eyes VE: el lente,
 * el zoom, el recorte, el color, el enfoque, la orientación fija y las cuatro
 * esquinas con las que se marca la pantalla.
 *
 * SOLO EL DUEÑO. Decidido el 2026-10-19, después de encontrar el encuadre
 * torcido en tres pantallas de G500: varias personas con acceso movieron el
 * zoom desde el visor del vivo porque «se veía mejor así».
 *
 * No es un ajuste de vista que se deshaga mirando. El catálogo de creativos que
 * cada equipo aprende vale para UN encuadre (`Reconocedor.kt` de Space Eye): al
 * cambiar el lente, el zoom o las esquinas se tira entero, y el sitio pasa un
 * día sin reconocer nada mientras vuelve a aprender. Y si el encuadre nuevo
 * deja la pantalla más chica o más borrosa dentro de la foto, deja de reconocer
 * PARA SIEMPRE — medido el 19-oct en AUTOPISTA (la pantalla le quedó en el 14 %
 * de la foto, con 4.3x de zoom digital: reconoce uno de dieciséis vistazos).
 *
 * El ADMINISTRADOR se queda fuera a propósito, y es la diferencia con
 * `puedeVerControlCambios`: aquí no se trata de confianza sino de cuántas manos
 * tocan un ajuste que cuesta un día de vigilancia. Quien instala el equipo
 * encuadra una vez; después nadie tiene por qué volver a moverlo.
 *
 * Lo que los demás SIGUEN pudiendo: mirar el vivo, pedir fotos, cambiar
 * frecuencias y umbrales de la vigilancia, y cerrar fallas. Nada de eso cambia
 * lo que la cámara ve.
 *
 * Vive aquí y no dentro de un `.tsx` por lo mismo que la de arriba: una
 * condición escrita en el JSX no la comprueba nadie. La puerta de verdad está
 * en `app/api/space-eyes/se/[...ruta]/route.ts`, que usa ESTA función.
 *
 * Toma `string` y no `RolDemo` a propósito: el rol de la sesión
 * (`UsuarioSesion.rol`) viaja como texto plano desde la base, y una guarda que
 * exige un `as` para poder llamarse es una guarda que alguien acabará
 * rodeando. Cualquier texto que no sea 'DUENO' da false, que es el lado seguro.
 */
export function puedeEncuadrar(rol: string | null | undefined): boolean {
  return rol === 'DUENO'
}
