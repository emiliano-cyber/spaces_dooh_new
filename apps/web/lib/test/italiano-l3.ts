import { DICCIONARIOS, IT_PARCIAL } from '../i18n/diccionario'

// ============================================================================
//  lib/test/italiano-l3.ts — EL BARRIDO ITALIANO DEL LOTE L3 (inventario,
//  arrendadores y operaciones).
// ----------------------------------------------------------------------------
//  Italiano, lote L3 (2026-11-03). Lo usan las pruebas de pantallas del lote
//  (`pantallas-inventario-arrendadores`, `pantallas-operaciones`,
//  `pantallas-operaciones2`) despues de rendir cada estado en `it`.
//
//  La caida al ingles de `DICCIONARIOS.it` (`diccionario.ts`) no da ningun
//  error: una clave sin italiano se pinta en INGLES y la pantalla «funciona».
//  Esto la hace visible. Por cada clave de los ambitos que se le pasan, cada
//  trozo ingles (y cada trozo espanol) que el italiano de esa clave NO dice
//  igual no puede aparecer en el HTML italiano. Antes de traducir, el italiano
//  de la clave no existe y cada trozo ingles que se pinte sale aqui: es el rojo
//  del lote. Despues, solo queda lo que de verdad no se tradujo.
//
//  ─── LO QUE CAE AL INGLES Y NO ES DE ESTE LOTE ─────────────────────────────
//  Las pantallas del lote pintan tambien claves de otros (los estatus de
//  Comercial, los periodos de `compartidos`, los estados de OT de Campanas…).
//  Mientras esos lotes no las traduzcan, su ingles esta en el HTML italiano por
//  diseño, y «Available» de Comercial es la misma palabra que el ingles de una
//  clave de Inventario. Un trozo INGLES que aparece en el ingles de una clave
//  AJENA aun sin italiano no se cuenta: no se puede saber de cual de las dos
//  sale. La lista se calcula sola (`IT_PARCIAL`), asi que se encoge a medida
//  que los otros lotes traducen y la prueba se vuelve mas estricta sin tocarla.
//  Los trozos ESPANOLES no tienen esa excepcion: ninguna clave pinta espanol en
//  italiano.
//
//  Solo mira lo que se LEE: nodos de texto y los atributos visibles (title,
//  aria-label, placeholder, alt), con las entidades ya resueltas.
// ============================================================================

export interface AmbitoItaliano {
  es: Record<string, string>
  en: Record<string, string>
  it: Partial<Record<string, string>>
}

const ENTIDADES: [RegExp, string][] = [
  [/&quot;/g, '"'],
  [/&#x27;/g, "'"],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&nbsp;/g, ' '],
  [/&amp;/g, '&'],
]

/** El texto que se lee de un HTML: nodos y atributos visibles, un trozo por linea. */
export function legible(crudo: string): string {
  const atributos = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
  let t = crudo.replace(/<[^>]*>/g, '\n') + '\n' + atributos.join('\n')
  for (const [re, s] of ENTIDADES) t = t.replace(re, s)
  return t
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const palabra = (t: string) => new RegExp(`(^|[^\\p{L}@._-])${escapar(t)}($|[^\\p{L}@._-])`, 'u')

/** El ingles de las claves de FUERA de estos ambitos que aun caen al ingles. */
export function caidasAjenas(ambitos: AmbitoItaliano[]): string {
  const propias = new Set(ambitos.flatMap((a) => Object.keys(a.es)))
  const en = DICCIONARIOS.en as Record<string, string>
  const it = IT_PARCIAL as Partial<Record<string, string>>
  return Object.keys(en)
    .filter((k) => !propias.has(k) && !it[k])
    .map((k) => en[k])
    .join('\n')
}

export interface OpcionesFugas {
  /** Largo minimo de un trozo para contarlo (los cortos son palabras sueltas que chocan). */
  minimo?: number
  /** Datos de prueba (nombres, folios): se quitan del HTML antes de barrer. */
  datos?: Iterable<string>
}

/**
 * Las claves de los ambitos cuyo ingles (o espanol) aparece en el HTML
 * italiano: `clave · en|es · «trozo»`. Vacio = el italiano no cae a otro
 * idioma en lo que se pinto.
 */
export function fugasEnItaliano(html: string, ambitos: AmbitoItaliano[], opciones: OpcionesFugas = {}): string[] {
  const minimo = opciones.minimo ?? 4
  for (const d of opciones.datos ?? []) html = html.split(d).join('\n')
  const ajenas = caidasAjenas(ambitos)
  const fugas: string[] = []
  for (const { es, en, it } of ambitos) {
    for (const clave of Object.keys(es)) {
      const italiano = it[clave] ?? ''
      for (const [idioma, frase] of [['en', en[clave]], ['es', es[clave]]] as const) {
        for (const trozo of frase.split(/\{\w+\}/)) {
          const t = trozo.trim()
          if (t.length < minimo || italiano.includes(t)) continue
          const re = palabra(t)
          if (!re.test(html)) continue
          if (idioma === 'en' && re.test(ajenas)) continue
          fugas.push(`${clave} · ${idioma} · «${t}»`)
        }
      }
    }
  }
  return [...new Set(fugas)]
}
