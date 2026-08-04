// ============================================================================
//  lib/tipo-medio.ts — Etiquetas del enum `TipoMedio`.
// ----------------------------------------------------------------------------
//  Fuente ÚNICA de cómo se escribe un tipo de medio en pantalla. Estaba copiada
//  en cinco componentes (Comercial, Inventario, la ficha de sitio, el portal de
//  cliente y el modal de info añadida) y Network no tenía copia: pintaba
//  `{s.tipoMedio}` crudo, así que la tabla de la red mostraba literalmente
//  «PANTALLA_DIGITAL» (M10 de la auditoría del 04/08/2026).
//
//  Las copias YA habían divergido: InfoAnadidaModal decía «Puente» y «Muro»
//  donde el resto decía «Puente peatonal» y «Mural». Nadie lo decidió; se
//  quedaron atrás cuando se corrigieron las demás. Es el mismo problema que
//  documenta lib/renta-periodicidad.ts, con menos consecuencias: aquí solo se
//  ve mal, allá se subestima el margen.
//
//  `etiquetaTipoMedio` acepta string y no `TipoMedio` porque varias vistas
//  reciben el tipo como texto suelto desde la API. Un valor desconocido cae a
//  una forma legible (SNAKE_CASE → «Snake case») en vez de imprimir el enum:
//  si mañana la BD gana un tipo, la UI se ve inacabada, no rota.
// ============================================================================

import type { TipoMedio } from '@/lib/data/types'

export const TIPO_MEDIO_LABEL: Record<TipoMedio, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

export function etiquetaTipoMedio(tipo: string | null | undefined): string {
  if (!tipo) return '—'
  const conocido = TIPO_MEDIO_LABEL[tipo as TipoMedio]
  if (conocido) return conocido
  // Sentence case, como manda el design system: solo la primera en mayúscula.
  const palabras = tipo.toLowerCase().replace(/_/g, ' ')
  return palabras.charAt(0).toUpperCase() + palabras.slice(1)
}
