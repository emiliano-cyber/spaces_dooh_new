// ============================================================================
//  lib/rfc.ts — Validación de RFC (mexicano). Puro: sin BD ni `server-only`.
// ----------------------------------------------------------------------------
//  Vive aquí, y no en un controlador, porque lo necesitan los DOS lados:
//  el servidor (que es quien decide y rechaza con 400) y el formulario del
//  cliente (que avisa antes de enviar). Estaba duplicado en
//  arrendadores-controller y clientes-controller; una tercera copia en el
//  navegador garantizaba que tarde o temprano divergieran y el usuario viera
//  «RFC inválido» en un campo que la UI había dado por bueno.
//
//  La validación es de FORMA, no de existencia: que el RFC esté dado de alta
//  ante el SAT no se puede saber desde aquí.
// ============================================================================

// 3 letras (persona moral) o 4 (persona física) + fecha AAMMDD + homoclave.
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i

// El RFC es OPCIONAL en todos los formularios que lo usan, así que vacío es
// válido: significa «no lo capturaron todavía», no «está mal escrito». Quien
// necesite exigirlo comprueba aparte que no esté vacío.
export function esRfcValido(v: string | null | undefined): boolean {
  const s = (v ?? '').trim()
  return s === '' || RFC_RE.test(s)
}
