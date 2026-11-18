import { textoLegible } from '../i18n/guardias-ingles'

// ============================================================================
//  lib/test/barrido-italiano.ts — LO QUE NO DEBE QUEDAR EN UNA PANTALLA ITALIANA.
// ----------------------------------------------------------------------------
//  Lote L5 del italiano (2026-11-03). El barrido de los lotes del ingles,
//  generalizado a DOS idiomas ajenos: en un HTML italiano no puede quedar
//
//    · una frase ESPANOLA de los diccionarios del ambito (el componente pinta
//      su literal sin pasar por `t()`), ni
//    · una frase INGLESA (la caida de `diccionario.ts`: una clave del ambito
//      que nadie tradujo al italiano).
//
//  Se parte cada texto por sus huecos `{x}` y se busca cada trozo de al menos
//  `minimo` letras. Un trozo que tambien esta en el italiano (o en el otro
//  idioma) de la MISMA clave no cuenta: «Dashboard», «Space Eyes» o «CPM» se
//  dicen igual. Lo que una prueba sabe que es dato («Pantalla Reforma») va en
//  `ignorar`.
// ============================================================================

export interface DiccionariosAmbito {
  es: Record<string, string>
  en: Record<string, string>
  it: Partial<Record<string, string>>
}

const trozos = (s: string) => s.split(/\{\w+\}/).map((t) => t.trim())

export function culpablesEnItaliano(
  html: string,
  dic: DiccionariosAmbito,
  opciones: { minimo?: number; ignorar?: readonly string[] } = {},
): string[] {
  const minimo = opciones.minimo ?? 8
  let legible = textoLegible(html)
  for (const dato of opciones.ignorar ?? []) legible = legible.split(dato).join('')
  // Un trozo que el italiano tambien usa en OTRA clave («Password» del
  // glosario) no prueba nada: se descuenta.
  const todoItaliano = Object.values(dic.it).join('\n')
  const culpables: string[] = []
  for (const clave of Object.keys(dic.es)) {
    const it = dic.it[clave] ?? ''
    for (const [idioma, texto, otro] of [
      ['es', dic.es[clave], dic.en[clave]],
      ['en', dic.en[clave], dic.es[clave]],
    ] as const) {
      for (const t of trozos(texto ?? '')) {
        if (t.length < minimo || it.includes(t) || todoItaliano.includes(t) || (otro ?? '').includes(t)) continue
        if (legible.includes(t)) culpables.push(`${idioma} · ${clave} · «${t}»`)
      }
    }
  }
  return culpables
}
