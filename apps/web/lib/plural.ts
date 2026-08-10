// ============================================================================
//  lib/plural.ts — Concordancia de número en los contadores de la interfaz.
//
//  Nace de INC-09.4: se leía «1 resultados» en Comercial, y el mismo patrón
//  estaba repetido en ocho sitios con «sitios», «pantallas» y «campañas».
//
//  La forma plural se puede PASAR, y no es adorno: el arreglo de M10 (04/08)
//  ya se quemó con la regla ingenua de añadir una «s» —«mes» + «s» = «mess»— y
//  la lección quedó escrita en `unidadCorta()`. Aquí el `+s` es solo el valor
//  por omisión, correcto para los sustantivos que se usan hoy (todos acaban en
//  vocal), y el segundo argumento existe para el día que aparezca uno que no.
// ============================================================================

export function plural(n: number, singular: string, formaPlural?: string): string {
  // `Math.abs` porque 0 y los negativos van en plural: «0 resultados» es lo que
  // se dice en voz alta, y «-1 resultado» no debería ocurrir pero tampoco debe
  // romperse.
  return Math.abs(n) === 1 ? singular : (formaPlural ?? `${singular}s`)
}

// El caso de uso real: número y sustantivo concordados de una vez.
export function conteo(n: number, singular: string, formaPlural?: string): string {
  return `${n} ${plural(n, singular, formaPlural)}`
}
