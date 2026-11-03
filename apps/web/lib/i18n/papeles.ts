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

/** La etiqueta de un papel en el idioma de quien lee. */
export function etiquetaDePapel(etiqueta: string, idioma: Idioma = IDIOMA_POR_OMISION): string {
  if (idioma === IDIOMA_POR_OMISION) return etiqueta
  const rol = PAPELES_FIJOS.find((r) => ES[claveEtiqueta(r)] === etiqueta)
  return rol ? traducir(idioma, claveEtiqueta(rol)) : etiqueta
}

/** El codigo de un papel en el idioma de quien lee. */
export function codigoDePapel(rol: string, idioma: Idioma = IDIOMA_POR_OMISION): string {
  if (idioma === IDIOMA_POR_OMISION || !PAPELES_FIJOS.includes(rol)) return rol
  return traducir(idioma, claveCodigo(rol))
}
