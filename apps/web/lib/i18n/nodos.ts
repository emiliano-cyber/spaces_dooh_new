import { createElement, Fragment, type ReactNode } from 'react'

// ============================================================================
//  lib/i18n/nodos.ts — HUECOS QUE SON ELEMENTOS, NO TEXTO.
// ----------------------------------------------------------------------------
//  `interpolar()` (`diccionario.ts`) rellena `{nombre}` con una CADENA. Pero
//  muchas frases de la interfaz llevan dentro un trozo con formato:
//
//      Neto aprobado <b>$ 850.00</b> de $ 4,845.00 · Total <b>$ 1,160.00</b>
//
//  La tentacion es partir la frase en tres claves y pegarlas alrededor del
//  `<b>`. Eso es justo lo que NO se puede hacer: congela el ORDEN de la frase
//  espanola, y el ingles —o cualquier otro idioma— no siempre pone las piezas
//  en el mismo sitio. La frase va ENTERA en el diccionario, con sus huecos, y
//  esta funcion pone en cada hueco el elemento que toque.
//
//  Mismas reglas que `interpolar()`, a proposito:
//    · un hueco sin valor se deja TAL CUAL (`{n}` a la vista se arregla; un
//      «undefined» manda a alguien a depurar donde no hay nada);
//    · los nombres de hueco son los mismos en los dos idiomas, y eso lo vigila
//      `diccionario.test.ts`.
//
//  Devuelve un FRAGMENTO de React y no un arreglo para no obligar a quien lo
//  usa a poner `key`: el resultado se pinta igual que el texto plano de antes
//  (`renderToStaticMarkup` no mete separadores entre nodos de texto vecinos).
// ============================================================================

export function interpolarNodos(texto: string, valores: Record<string, ReactNode>): ReactNode {
  const partes: ReactNode[] = []
  let ultimo = 0
  for (const m of texto.matchAll(/\{(\w+)\}/g)) {
    const inicio = m.index ?? 0
    if (inicio > ultimo) partes.push(texto.slice(ultimo, inicio))
    const nombre = m[1]
    partes.push(nombre in valores ? valores[nombre] : m[0])
    ultimo = inicio + m[0].length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return createElement(Fragment, null, ...partes.map((p, i) => createElement(Fragment, { key: i }, p)))
}
