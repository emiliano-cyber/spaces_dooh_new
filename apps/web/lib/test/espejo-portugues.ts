import { cloneElement, isValidElement, type ReactElement } from 'react'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import { huellasEnPortugues } from '@/lib/i18n/guardias-portugues'
import { monedaInstancia } from '@/lib/i18n/dinero'

// ============================================================================
//  lib/test/espejo-portugues.ts — EL MISMO ESTADO, RENDIDO EN PORTUGUES.
// ----------------------------------------------------------------------------
//  Ola 0 del portugues (2026-11-05). El hermano de `espejo-italiano.ts`: lo
//  llama `volcado-html.ts` (solo con `I18N_VOLCAR_PT=<carpeta>`) por cada
//  `renderToStaticMarkup` de las pruebas. Si el arbol es un `ProveedorIdioma`
//  en INGLES —la forma en que las pruebas de pantallas rinden su lado no
//  espanol—, se rinde una copia con `idioma: 'pt'` y se pasa por la guardia de
//  formatos pt-BR. Cualquier otro arbol devuelve `null`.
//
//  Se parte del arbol INGLES y no del espanol a proposito: es el que ejerce
//  las ramas «no espanol» del codigo (`idioma === 'es' ? literal : t(…)`), que
//  son las que el portugues recorre. El texto que falta cae al espanol y no es
//  una huella; lo es un formato espanol o ingles (fecha, cifra, simbolo).
// ============================================================================

// Como en el italiano: el idioma se cambia en TODO el arbol que la prueba
// construyo (el proveedor y la propiedad `idioma` de los Server Components),
// no en lo que el componente rinde.
function aPortugues(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(aPortugues)
  if (!isValidElement(nodo)) return nodo
  const props = nodo.props as Record<string, unknown>
  const cambios: Record<string, unknown> = {}
  if (props.idioma === 'en') cambios.idioma = 'pt'
  if (props.children !== undefined) cambios.children = aPortugues(props.children)
  return cloneElement(nodo, cambios)
}

export function espejoPortugues(
  el: unknown,
  rendir: (el: ReactElement) => string,
): { html: string; hallazgos: string[] } | null {
  if (!isValidElement(el) || el.type !== ProveedorIdioma) return null
  const props = el.props as { idioma?: string }
  if (props.idioma !== 'en') return null
  let html: string
  try {
    html = rendir(aPortugues(el) as ReactElement)
  } catch (e) {
    // Un espejo que revienta no puede tumbar la prueba original, que ya paso.
    return { html: '', hallazgos: [`el espejo portugues lanzo: ${(e as Error)?.message ?? String(e)}`] }
  }
  return { html, hallazgos: huellasEnPortugues(html, { moneda: monedaInstancia() }) }
}
