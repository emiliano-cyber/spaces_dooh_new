import { traducir, DICCIONARIOS, type ClaveTexto } from './diccionario'
import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'

// ============================================================================
//  LOS CINCO PAPELES DE UNA RAZON SOCIAL, AL PINTARLOS (ola 6 del ingles).
// ----------------------------------------------------------------------------
//  Viven en `catalogo_roles_entidad`, con su etiqueta en espanol, y son FIJOS
//  para toda la flota (decision de Jochelo del 2026-09-18). El dato no cambia:
//  la pantalla los traduce al pintarlos.
//
//  · La ETIQUETA se traduce solo si es EXACTAMENTE la de la migracion. Una
//    instancia puede renombrarla con un `update`, y entonces su texto es dato:
//    pintar encima la traduccion del texto de partida le ocultaria el cambio a
//    quien lo hizo.
//  · El CODIGO (ACTIVOS…), que la bienvenida pinta tal cual, lleva un nombre
//    ingles corto. Un codigo que no sea de los cinco se pinta como esta.
//
//  En espanol las dos funciones devuelven su entrada, sin tocarla.
// ============================================================================

/** Los cinco codigos de partida, en el orden del catalogo. */
export const PAPELES_FIJOS = ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS']

const ES = DICCIONARIOS.es as Record<string, string>

const claveEtiqueta = (rol: string) => `admin.papel.${rol.toLowerCase()}` as ClaveTexto
const claveCodigo = (rol: string) => `admin.papel.codigo.${rol.toLowerCase()}` as ClaveTexto

// La base guarda las etiquetas CON acentos desde
// `20260921_corrige_acentos_catalogo_roles_entidad.sql` («Trámites…»,
// «Operación y nómina»), y el diccionario espanol las tiene sin ellos: la
// comparacion exacta fallaba con LICENCIAS y OPERACION, que salian en espanol
// (recorrido del italiano, 04/11). Para el italiano se compara sin acentos; el
// ingles se deja como estaba, por la regla de esta pasada (anotado en
// docs/i18n/revision-italiano-recorrido.md).
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** La etiqueta de un papel en el idioma de quien lee. */
export function etiquetaDePapel(etiqueta: string, idioma: Idioma = IDIOMA_POR_OMISION): string {
  if (idioma === IDIOMA_POR_OMISION) return etiqueta
  const igual = (a: string, b: string) => (idioma === 'it' ? sinAcentos(a) === sinAcentos(b) : a === b)
  const rol = PAPELES_FIJOS.find((r) => igual(ES[claveEtiqueta(r)], etiqueta))
  return rol ? traducir(idioma, claveEtiqueta(rol)) : etiqueta
}

/** El codigo de un papel en el idioma de quien lee. */
export function codigoDePapel(rol: string, idioma: Idioma = IDIOMA_POR_OMISION): string {
  if (idioma === IDIOMA_POR_OMISION || !PAPELES_FIJOS.includes(rol)) return rol
  return traducir(idioma, claveCodigo(rol))
}
