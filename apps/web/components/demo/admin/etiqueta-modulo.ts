import { DICCIONARIOS, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'

// La etiqueta de un modulo de la matriz la manda el servidor EN ESPANOL
// (`MODULO_LABEL`, `lib/server/usuarios-repo.ts`): en espanol se pinta la que
// llega, y en otro idioma la de `admin.modulo.<key>` si la hay.
//
// Recorrido del italiano (18/11): `captacion` e `inventario` no tienen
// `admin.modulo.*` —el servidor tampoco les pone etiqueta y llegan
// capitalizados («Captacion», «Inventario»)—, así que salían en español en los
// otros tres idiomas. Antes de rendirse al `label`, el rótulo del menú con la
// misma clave (`nav.captacion`, `nav.inventario`), como hace `etiquetaArea`.
export function etiquetaModulo(key: string, label: string, idioma: Idioma, t: (k: ClaveTexto) => string): string {
  if (idioma === 'es') return label
  const k = `admin.modulo.${key}` as ClaveTexto
  if (k in DICCIONARIOS.es) return t(k)
  const menu = `nav.${key}` as ClaveTexto
  return menu in DICCIONARIOS.es ? t(menu) : label
}
