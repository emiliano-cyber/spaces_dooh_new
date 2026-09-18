import type { EntidadUI } from './gestion'

// ============================================================================
//  A qué razón social se asigna un contrato y un comprobante.
// ----------------------------------------------------------------------------
//  Las columnas `contratos_arrendamiento.entidad_id` y
//  `facturas.entidad_emisora_id` existen desde el 17/09 y hasta hoy NINGÚN
//  endpoint las escribía. Esto es la lógica de los dos selectores que las
//  ponen en uso, sacada del `.tsx` por el mismo motivo que `gestion.ts`: son
//  decisiones de identidad fiscal y un `.tsx` no se prueba aquí.
//
//  ─── Los defaults se DERIVAN de los roles, y NO se guardan ────────────────
//  Ya lo decidió el cuestionario de bienvenida y no se rehace: si una sola
//  sociedad tiene el papel, es ésa; si lo tienen dos, NINGUNA. La derivación
//  vive en `emisorPorOmision` (`lib/cuestionario-entidades.ts`) y aquí se
//  REUTILIZA en vez de reescribirse — dos copias de una regla divergen, y la
//  divergencia aquí es un comprobante a nombre de la sociedad equivocada.
//
//  No hay columna de configuración que añadir: adivinar con dos candidatas
//  sería inventarse la identidad fiscal del negocio, y con una sola se
//  autocorrige al alta de la segunda.
// ============================================================================

/** El rol que PAGA la renta de un contrato. */
export const ROL_CONTRATO = 'ARRENDAMIENTOS'
/** El rol que EMITE un comprobante. */
export const ROL_COMPROBANTE = 'VENTAS'

/** Valor del selector cuando no hay entidad. Cadena vacía: es lo que un
 *  `<option value="">` devuelve, y convertirlo a `null` es del llamador. */
export const SIN_ASIGNAR = ''

/** El texto que se PINTA cuando falta. No se esconde el hueco: las filas
 *  anteriores al 17/09 están así y no se sabe de quién son. */
export const ETIQUETA_SIN_ASIGNAR = 'Sin asignar'

export interface OpcionAsignacion {
  valor: string
  etiqueta: string
  /** La que la derivación propone. Se marca para poder decirlo en pantalla. */
  recomendada: boolean
}

export function sinAsignar(_id: string | null | undefined): boolean {
  return false
}

export function entidadPreseleccionada(
  _entidades: EntidadUI[] | null | undefined,
  _rol: string,
  _guardado: string | null | undefined,
): string {
  return SIN_ASIGNAR
}

export function opcionesDeAsignacion(
  _entidades: EntidadUI[] | null | undefined,
  _rol: string,
  _guardado?: string | null,
): OpcionAsignacion[] {
  return []
}

export function etiquetaAsignacion(
  _entidades: EntidadUI[] | null | undefined,
  _id: string | null | undefined,
): string {
  return ETIQUETA_SIN_ASIGNAR
}
