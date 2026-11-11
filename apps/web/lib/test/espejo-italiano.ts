import { cloneElement, isValidElement, type ReactElement } from 'react'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import { huellasEnItaliano } from '@/lib/i18n/guardias-italiano'
import { monedaInstancia } from '@/lib/i18n/dinero'

// ============================================================================
//  lib/test/espejo-italiano.ts — EL MISMO ESTADO, RENDIDO EN ITALIANO.
// ----------------------------------------------------------------------------
//  Lo llama `volcado-html.ts` (solo con `I18N_VOLCAR_IT=<carpeta>`) por cada
//  `renderToStaticMarkup` de las pruebas. Si el arbol es un `ProveedorIdioma`
//  en INGLES —la forma en que TODAS las pruebas de pantallas rinden su lado
//  ingles—, se rinde una copia con `idioma: 'it'` y se pasa por la guardia de
//  formatos italiana. Cualquier otro arbol (el espanol, un componente suelto)
//  devuelve `null`: no hay nada que espejar.
//
//  Es la forma de que los lotes de traduccion revisen en italiano TODOS los
//  estados que las pruebas del ingles ya construyen, sin escribir un dato de
//  prueba mas. Lo que caiga al ingles (texto sin traducir) no es una huella;
//  lo es un formato espanol o ingles (una fecha, una cifra, un simbolo).
// ============================================================================

// Muchas pruebas pasan el idioma DOS veces: al proveedor y como propiedad del
// componente (`createElement(Comp, { idioma })`, los Server Components). Se
// cambia en todo el arbol que la prueba construyo —no en lo que el componente
// rinde, que eso lo decide el codigo—; si no, el espejo pintaria ingles por la
// propiedad y la guardia lo apuntaria como un fallo que no existe.
function aItaliano(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(aItaliano)
  if (!isValidElement(nodo)) return nodo
  const props = nodo.props as Record<string, unknown>
  const cambios: Record<string, unknown> = {}
  if (props.idioma === 'en') cambios.idioma = 'it'
  if (props.children !== undefined) cambios.children = aItaliano(props.children)
  return cloneElement(nodo, cambios)
}

export function espejoItaliano(
  el: unknown,
  rendir: (el: ReactElement) => string,
): { html: string; hallazgos: string[] } | null {
  if (!isValidElement(el) || el.type !== ProveedorIdioma) return null
  const props = el.props as { idioma?: string }
  if (props.idioma !== 'en') return null
  let html: string
  try {
    html = rendir(aItaliano(el) as ReactElement)
  } catch (e) {
    // Un espejo que revienta no puede tumbar la prueba original, que ya paso:
    // se anota y se sigue.
    return { html: '', hallazgos: [`el espejo italiano lanzo: ${(e as Error)?.message ?? String(e)}`] }
  }
  // La moneda con la que se rindio (algunas pruebas fijan una instancia USD).
  return { html, hallazgos: huellasEnItaliano(html, { moneda: monedaInstancia() }) }
}
