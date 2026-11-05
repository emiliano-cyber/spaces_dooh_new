import { CLAVES, DICCIONARIOS, PT_PARCIAL } from '../i18n/diccionario'

// ============================================================================
//  lib/test/barrido-portugues.ts — LO QUE TODAVIA CAE AL ESPANOL, A PROPOSITO.
// ----------------------------------------------------------------------------
//  Lote L5 del portugues (2026-11-05). El barrido del italiano
//  (`culpablesEnItaliano`, `barrido-italiano.ts`) sirve tal cual para el
//  portugues: busca en el HTML cada trozo espanol o ingles de los
//  diccionarios del lote. Pero en portugues lo que falta cae al ESPANOL, y una
//  pantalla del lote puede llevar texto de OTRO lote que aun no se tradujo
//  («Ubicación de las pantallas», de propuestas, dentro de la liga publica).
//  Ese texto contiene palabras sueltas del lote («Ubicación», «Pantalla») y el
//  barrido las cazaria sin ser culpa del lote.
//
//  Esto devuelve el espanol de las claves que TODAVIA no tienen portugues,
//  troceado por sus huecos y solo los trozos largos (`minimo`), para pasarlo
//  como `ignorar`. Se encoge solo a medida que los lotes traducen: con todo
//  traducido, devuelve []. Los trozos cortos no se ignoran, porque esconderian
//  una palabra suelta del lote que de verdad se quedo en espanol.
// ============================================================================

//  Y un trozo que TAMBIEN es el espanol de una clave ya traducida («No se pudo
//  leer el archivo» lo dicen admin y otro lote) no se ignora: si saliera, no
//  se sabria de cual de las dos es, y esconderlo podria tapar la del lote.
export function espanolPendienteDeOtrosLotes(minimo = 12): string[] {
  const es = DICCIONARIOS.es as Record<string, string>
  const pt = PT_PARCIAL as Partial<Record<string, string>>
  const trocear = (k: string) => es[k].split(/\{\w+\}/).map((t) => t.trim())
  const traducidos = new Set(CLAVES.filter((k) => pt[k]).flatMap(trocear))
  const trozos = CLAVES.filter((k) => !pt[k])
    .flatMap(trocear)
    .filter((t) => t.length >= minimo && !traducidos.has(t))
  // Los largos primero: si uno contiene a otro, se quita entero.
  return [...new Set(trozos)].sort((a, b) => b.length - a.length)
}
