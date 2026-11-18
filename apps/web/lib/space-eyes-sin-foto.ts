// ============================================================================
//  lib/space-eyes-sin-foto.ts — Por qué un creativo detectado no trae foto.
// ----------------------------------------------------------------------------
//  El catálogo de creativos y la galería se llenan por caminos DISTINTOS. La
//  huella del creativo viaja siempre —32 bytes pegados al reporte de estado que
//  el equipo manda igual— y la foto solo si el equipo podía tomarla: no durante
//  el aprendizaje, no con el tope del día agotado, y no al momento si el sitio
//  manda sus fotos juntas cada tantas horas.
//
//  Así que un hallazgo sin foto es normal. Lo que no era normal es que la
//  pantalla lo escondiera sin decir nada: quien contaba nueve creativos en el
//  catálogo y veía cinco fotos no tenía cómo saber qué pasó con las otras
//  cuatro. El motivo lo guarda Space Eye desde la migración 028.
//
//  Esto es solo el texto. Un dato puro, para poder probarlo.
//
//  Las frases viven en el diccionario (`spaceeyes.sinfoto.*`, con la cifra
//  como hueco `{n}`) para que la línea salga en el idioma de quien mira; el
//  español es el de la rama que trajo la leyenda, letra por letra. `texto` se
//  deriva de la frase española sin la cifra, que es lo que leen sus pruebas.
// ============================================================================

import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import { numeroEnIdioma } from '@/lib/i18n/formato-idioma'
import type { Idioma } from '@/lib/i18n/idiomas'

const CATALOGO: { clave: string; frase: ClaveTexto }[] = [
  // Primero el que hay que atender; al final los que son de esperarse.
  { clave: 'no_subio', frase: 'spaceeyes.sinfoto.no-subio' },
  { clave: 'tope_del_dia', frase: 'spaceeyes.sinfoto.tope' },
  { clave: 'envio_agrupado', frase: 'spaceeyes.sinfoto.agrupado' },
  { clave: 'aprendizaje', frase: 'spaceeyes.sinfoto.aprendizaje' },
  { clave: 'desconocido', frase: 'spaceeyes.sinfoto.desconocido' },
]

/** Los motivos que guarda Space Eye, en el orden en que conviene leerlos. */
export const MOTIVOS_SIN_FOTO: { clave: string; frase: ClaveTexto; texto: string }[] = CATALOGO.map((m) => ({
  ...m,
  texto: traducir('es', m.frase, { n: '' }).trim(),
}))

const CLAVES = new Set(MOTIVOS_SIN_FOTO.map((m) => m.clave))

// La cifra como la escribe cada idioma (`cifra` de space-eyes/piezas): tal
// cual en español e inglés, con los separadores del italiano.
function cifra(n: number, idioma: Idioma): string {
  if (idioma === 'es' || idioma === 'en') return String(n)
  return numeroEnIdioma(n, idioma, { maximumFractionDigits: 0 })
}

/**
 * Una línea que explique los hallazgos sin foto, o `null` si todos tienen la
 * suya (que es lo normal y no merece ruido en la pantalla).
 *
 * Un motivo que esta versión no conozca se cuenta pero no se nombra: el total
 * sigue cuadrando, que es lo que se mira primero.
 */
export function textoSinFoto(
  cuenta: Record<string, number> | null | undefined,
  idioma: Idioma = 'es',
): string | null {
  if (!cuenta) return null
  let total = 0
  const partes: string[] = []
  for (const { clave, frase } of MOTIVOS_SIN_FOTO) {
    const n = cuenta[clave] ?? 0
    if (n > 0) { total += n; partes.push(traducir(idioma, frase, { n: cifra(n, idioma) })) }
  }
  // Los que no están en la lista suman al total aunque no se nombren.
  for (const [clave, n] of Object.entries(cuenta)) {
    if (!CLAVES.has(clave) && n > 0) total += n
  }
  if (total === 0) return null
  const cabeza =
    total === 1
      ? traducir(idioma, 'spaceeyes.sinfoto.uno')
      : traducir(idioma, 'spaceeyes.sinfoto.otros', { n: cifra(total, idioma) })
  return partes.length ? `${cabeza}: ${partes.join(', ')}` : cabeza
}

/** Una fila del catálogo tal como la entrega Space Eye, en lo que aquí importa. */
export interface FilaCreativo {
  thumbnail_path?: string | null
  storage_path?: string | null
  sin_foto?: string | null
  aprendido?: number | boolean | null
}

/**
 * Los hallazgos que no trajeron foto, agrupados por motivo.
 *
 * Lo cuentan los dos paneles y el servidor de SPACE OS, así que vive aquí: dos
 * cuentas del mismo número acaban discrepando.
 */
export function contarSinFoto(filas: FilaCreativo[] | null | undefined): Record<string, number> {
  const cuenta: Record<string, number> = {}
  for (const c of filas ?? []) {
    if (c.thumbnail_path || c.storage_path) continue
    // Los viejos no traen motivo (la columna es de la migración 028) y los
    // aprendidos nunca se fotografían a propósito: ni unos ni otros son noticia.
    const motivo = c.sin_foto ? String(c.sin_foto) : c.aprendido ? 'aprendizaje' : 'desconocido'
    cuenta[motivo] = (cuenta[motivo] ?? 0) + 1
  }
  return cuenta
}
