import { emisorPorOmision } from '@/lib/cuestionario-entidades'
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

/** «Sin asignar» es un estado LEGÍTIMO, no un error: todas las filas anteriores
 *  al 2026-09-17 están así porque la columna no existía. */
export function sinAsignar(id: string | null | undefined): boolean {
  return !String(id ?? '').trim()
}

/**
 * El valor con el que abre el selector.
 *
 * Dos reglas, y las dos son negativas:
 *
 * 1. **Lo GUARDADO manda.** Si el documento ya tiene entidad, ésa es la que se
 *    pinta, aunque la derivación propusiera otra y aunque esté dada de baja. La
 *    omisión propone donde nadie decidió; sobrescribir al abrir el formulario
 *    borraría una decisión tomada, y como el formulario guarda lo que tiene en
 *    pantalla, lo haría SIN AVISAR.
 * 2. **Con dos candidatas, ninguna.** Eso lo decide `emisorPorOmision`, que se
 *    REUTILIZA y no se reescribe aquí.
 */
export function entidadPreseleccionada(
  entidades: EntidadUI[] | null | undefined,
  rol: string,
  guardado: string | null | undefined,
): string {
  if (!sinAsignar(guardado)) return String(guardado).trim()
  // `emisorPorOmision` ya descarta las dadas de baja y devuelve null con dos
  // candidatas. No se repite ninguna de las dos reglas: se llama.
  return emisorPorOmision(entidades ?? [], rol)?.id ?? SIN_ASIGNAR
}

/**
 * Las opciones del selector, con «sin asignar» primera.
 *
 * Se ofrecen TODAS las activas y no solo las que tienen el papel: el papel
 * decide la SUGERENCIA, no lo que está permitido. Un owner puede querer que
 * esta renta la pague otra de sus sociedades, y filtrar aquí le obligaría a
 * cambiar los roles para poder asignar — que es otra cosa y con otras
 * consecuencias.
 *
 * La que el documento YA tiene se ofrece aunque esté dada de baja: si no
 * apareciera, el selector pintaría «sin asignar» sobre un documento que sí la
 * tiene, y el primer guardado la borraría sin que nadie lo pidiera.
 */
export function opcionesDeAsignacion(
  entidades: EntidadUI[] | null | undefined,
  rol: string,
  guardado?: string | null,
): OpcionAsignacion[] {
  const lista = (entidades ?? []).filter(Boolean)
  const actual = String(guardado ?? '').trim()
  const recomendada = emisorPorOmision(lista, rol)?.id ?? null

  const visibles = lista
    .filter((e) => e.activo !== false || e.id === actual)
    .sort((a, b) =>
      String(a.razonSocial ?? '').localeCompare(String(b.razonSocial ?? ''), 'es', {
        sensitivity: 'base',
      }),
    )

  return [
    { valor: SIN_ASIGNAR, etiqueta: `${ETIQUETA_SIN_ASIGNAR}…`, recomendada: false },
    ...visibles.map((e) => ({
      valor: e.id,
      etiqueta: e.activo === false ? `${e.razonSocial} (dada de baja)` : e.razonSocial,
      recomendada: e.id === recomendada,
    })),
  ]
}

/**
 * El texto de la fila en un listado. NUNCA esconde el hueco: «sin asignar» se
 * pinta, porque no se sabe de quién son esas filas y esconderlo sería
 * inventárselo.
 *
 * Un id que no está en la lista tampoco se pinta como «sin asignar»: pasa
 * mientras el store no ha hidratado las entidades, y decir «sin asignar» ahí
 * sería afirmar algo falso sobre el documento.
 */
export function etiquetaAsignacion(
  entidades: EntidadUI[] | null | undefined,
  id: string | null | undefined,
): string {
  if (sinAsignar(id)) return ETIQUETA_SIN_ASIGNAR
  const suya = (entidades ?? []).find((e) => e && e.id === String(id).trim())
  if (!suya) return 'Razon social no disponible'
  return suya.activo === false ? `${suya.razonSocial} (dada de baja)` : suya.razonSocial
}
