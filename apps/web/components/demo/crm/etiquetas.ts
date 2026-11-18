import type { EtapaOportunidad } from '@/lib/crm'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { ES_CRM } from '@/lib/i18n/textos/crm'
import { EST, CLAVE_ESTATUS } from '@/components/demo/propuestas/estatus'
import type { EstPropuesta } from '@/lib/data/client'
import type { Idioma } from '@/lib/i18n/idiomas'
import { numeroEnIdioma } from '@/lib/i18n/formato-idioma'
import { formatFecha } from '@/lib/data/derive'

// ============================================================================
//  components/demo/crm/etiquetas.ts — De los valores del CRM a sus claves de
//  texto y a su color.  ADR 0051, Fase 4.
// ----------------------------------------------------------------------------
//  Las claves del diccionario van en minúsculas y con guiones
//  (`crm.etapa.contacto`), y los valores de la base en mayúsculas con guion
//  bajo (`AGREGAR_SITIO`): esta es la única traducción entre los dos.
// ============================================================================

const aClave = (v: string) => v.toLowerCase().replace(/_/g, '-')

// El `as` es seguro porque los valores salen de las listas de `lib/crm.ts`, y
// `pantallas-crm.test.ts` rinde la pantalla en los cuatro idiomas: una clave
// que no exista saldría en crudo y esa prueba la vería.
export const claveEtapa = (e: EtapaOportunidad | string) => `crm.etapa.${aClave(e)}` as ClaveTexto
export const claveActividad = (t: string) => `crm.actividad.${aClave(t)}` as ClaveTexto
export const claveAccion = (a: string) => `crm.accion.${aClave(a)}` as ClaveTexto
export const claveMedio = (m: string) => `comercial.tipo-medio.${aClave(m)}` as ClaveTexto

/**
 * El rótulo de una columna en la línea de tiempo («el descuento»), o null si
 * no tiene: el trigger registra TODAS las columnas, también las que se agreguen
 * mañana, y una sin rótulo se enseña con su nombre en crudo antes que callarla.
 */
export function claveCampo(campo: string): ClaveTexto | null {
  const k = `crm.campo.${campo.toLowerCase().replace(/_/g, '-')}`
  return k in ES_CRM ? (k as ClaveTexto) : null
}

/**
 * El color de cada etapa, con el MISMO dibujo que el estatus de una propuesta
 * (`propuestas/estatus.ts`: borde y texto, sin relleno) desde el 18/11, cuando
 * el dueño pidió que esto se pareciera a Propuestas. Ganada es una aprobada,
 * perdida una rechazada y cotizando una enviada: las tres se leen igual en las
 * dos listas.
 */
export const COLOR_ETAPA: Record<EtapaOportunidad, string> = {
  CONTACTO: 'border-border text-muted',
  NECESIDAD: 'border-border text-ink',
  COTIZANDO: EST.ENVIADA.cls,
  NEGOCIANDO: 'border-accent text-info',
  GANADA: EST.APROBADA.cls,
  PERDIDA: EST.RECHAZADA.cls,
}

/**
 * Un valor de la línea de tiempo de una propuesta («antes → después»), para
 * quien lee. Recorrido del italiano (18/11): el trigger guarda lo que hay en la
 * columna, y la ficha lo pintaba tal cual — «BORRADOR → ENVIADA» y
 * «— → 2026-12-18» salían así con la interfaz en italiano. Fuera del español se
 * traduce el estatus, se escribe la fecha y la cifra a la manera del idioma.
 * En español sale lo de siempre, carácter por carácter (lo fija
 * `recorrido-italiano-18-11.test.ts`): la regla de los idiomas es que el
 * español no cambie al arreglar los otros.
 */
export function valorDeCambio(
  v: unknown,
  campo: string | null,
  idioma: Idioma,
  t: (k: ClaveTexto) => string,
): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    if (idioma === 'es') return String(v)
    if (campo === 'estatus' && typeof v === 'string' && v in CLAVE_ESTATUS) return t(CLAVE_ESTATUS[v as EstPropuesta])
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) return formatFecha(v.slice(0, 10), idioma)
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null
    if (n != null) return numeroEnIdioma(n, idioma, { maximumFractionDigits: 2 })
    return String(v)
  }
  return JSON.stringify(v).slice(0, 80)
}
