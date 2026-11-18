import { traducir, DICCIONARIOS, type ClaveTexto } from './diccionario'
import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'

// ============================================================================
//  LA LISTA DE COMPROBACION POR OMISION DE UNA OT NUEVA (ola 6 del ingles).
// ----------------------------------------------------------------------------
//  La pantalla de alta (`app/(app)/(shell)/operaciones/page.tsx`) manda tres
//  puntos fijos en espanol y se GUARDAN en la OT. El dato no cambia: guardarlo
//  en el idioma de quien la crea dejaria OTs con listas en dos idiomas, y las
//  que ya existen seguirian en espanol.
//
//  Al PINTARLA, un punto cuyo texto es EXACTAMENTE uno de esos tres sale en el
//  idioma de quien lee. Lo que escribio una persona es dato y se pinta tal
//  cual, aunque se parezca. Y al marcarlo, la ficha sigue mandando el texto
//  guardado (`alternarPunto`), nunca el traducido.
// ============================================================================

const CLAVES: ClaveTexto[] = [
  'operaciones2.checklist.omision.inspeccion',
  'operaciones2.checklist.omision.montaje',
  'operaciones2.checklist.omision.foto',
]

/** Los tres puntos por omision, en espanol y en el orden en que se crean. */
export const CHECKLIST_OT_POR_OMISION: string[] = CLAVES.map((c) => DICCIONARIOS.es[c])

/** El texto de un punto de la lista, en el idioma de quien lee. */
export function etiquetaDePuntoOT(label: string, idioma: Idioma = IDIOMA_POR_OMISION): string {
  if (idioma === IDIOMA_POR_OMISION) return label
  const i = CHECKLIST_OT_POR_OMISION.indexOf(label)
  return i >= 0 ? traducir(idioma, CLAVES[i]) : label
}
