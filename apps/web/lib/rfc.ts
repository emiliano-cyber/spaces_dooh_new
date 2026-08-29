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
//
// Se capturan el mes y el día porque el `\d{6}` NO basta: acepta el 13 como mes
// y el 32 como día. La auditoría del 2026-08-26 dio de alta un cliente con
// `XAXX021301000` —mes 13— y la API respondió 201. Ese dato acaba en un CFDI:
// el SAT no timbra un RFC con una fecha que no existe, y el fallo aparece
// semanas después, al facturar, cuando ya nadie recuerda de dónde salió.
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{2}(\d{2})(\d{2})[A-Z0-9]{3}$/i

// Días por mes, indexado 1–12. Febrero lleva 29 A PROPÓSITO: el año del RFC son
// dos dígitos y no dice el siglo —«00» puede ser 1900 (común) o 2000
// (bisiesto)—, así que decidir si el 29 de febrero existe exigiría adivinar.
// Entre frenar un alta correcta y dejar pasar un caso de cada mil, se elige lo
// segundo: el objetivo es atrapar el mes 13, no auditar el registro civil.
const DIAS_POR_MES = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// El RFC es OPCIONAL en todos los formularios que lo usan, así que vacío es
// válido: significa «no lo capturaron todavía», no «está mal escrito». Quien
// necesite exigirlo comprueba aparte que no esté vacío.
export function esRfcValido(v: string | null | undefined): boolean {
  const s = (v ?? '').trim()
  if (s === '') return true
  const m = RFC_RE.exec(s)
  if (!m) return false
  const mes = Number(m[1])
  const dia = Number(m[2])
  // Los dos RFC genéricos del SAT —XAXX010101000 (público en general) y
  // XEXX010101000 (residentes en el extranjero)— pasan por aquí sin excepción
  // especial: su fecha es 01/01/01. Si algún día hiciera falta exceptuarlos,
  // sería señal de que esta regla está mal.
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_POR_MES[mes]
}
