import type { Idioma } from './idiomas'

// B70 · ROJO: lo de hoy. Ninguna libreria recibe sus textos; pintan su ingles.
export const CLAVES_MAPA: Record<string, string> = {}

export function localeMapa(_idioma: Idioma): Record<string, string> {
  return {}
}

export function propsAvisos(_idioma: Idioma): {
  containerAriaLabel?: string
  toastOptions: { closeButtonAriaLabel?: string }
} {
  return { toastOptions: {} }
}
