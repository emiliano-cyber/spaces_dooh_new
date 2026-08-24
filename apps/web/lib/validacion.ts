// Validación de correo compartida (cliente + servidor). La regla NO se define
// aquí: vive en `validacion-email.mjs` porque `scripts/bootstrap-auth.mjs` la
// necesita y corre con `node` a pelo en el droplet, sin compilar TypeScript.
// Mientras estuvo solo aquí, el alta de una instancia no podía usarla y acabó
// creando al Dueño con un marcador por correo (defecto ⑥ del 2026-08-21).
export { esEmailValido, EMAIL_INVALIDO } from './validacion-email.mjs'

// ─── Teléfono ───────────────────────────────────────────────────────────────
// M1 de la auditoría del 04/08/2026: el alta de cliente aceptaba «abc123xyz»
// como teléfono. Se valida por CANTIDAD DE DÍGITOS y no con una plantilla
// rígida, porque la gente escribe «55 1234 5678», «(55) 1234-5678» y
// «+52 55 1234 5678» y las tres son el mismo número correcto — rechazarlas
// obligaría a limpiar a mano un dato que el sistema puede normalizar solo.
//
// 10 dígitos = número nacional mexicano. Hasta 15 = con lada de país, que es el
// máximo que define el E.164. Menos de 10 no es un teléfono al que se pueda
// llamar, y es justo lo que atrapa a «99» o a un dato pegado a medias.
const TELEFONO_RE = /^[0-9()+\-.\s]+$/

export function esTelefonoValido(telefono: unknown): boolean {
  if (typeof telefono !== 'string') return false
  const s = telefono.trim()
  // Vacío es válido: el teléfono es OPCIONAL en los formularios que lo usan.
  // Significa «no lo capturaron», no «está mal escrito». Quien lo necesite
  // obligatorio comprueba aparte que no esté vacío.
  if (s === '') return true
  if (!TELEFONO_RE.test(s)) return false
  const digitos = s.replace(/\D/g, '').length
  return digitos >= 10 && digitos <= 15
}

export const TELEFONO_INVALIDO = 'Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678)'

// ─── Código postal ──────────────────────────────────────────────────────────
// Cinco dígitos exactos (SAT). Vacío es válido por la misma razón que arriba.
export function esCpValido(cp: unknown): boolean {
  if (typeof cp !== 'string') return false
  const s = cp.trim()
  return s === '' || /^\d{5}$/.test(s)
}

export const CP_INVALIDO = 'Código postal inválido (5 dígitos)'
