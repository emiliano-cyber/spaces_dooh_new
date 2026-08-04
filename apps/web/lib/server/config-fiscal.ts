import { z } from 'zod'

// ============================================================================
//  lib/server/config-fiscal.ts — Validación de los datos fiscales del tenant
//  (parte ARRENDATARIA). Vive fuera de app/api/config/route.ts porque un fichero
//  `route.ts` del App Router solo admite exports de handler: no se puede exportar
//  el schema desde ahí, y sin export no hay test. Estos campos son los que el
//  contrato recita en sus declaraciones, así que su normalización merece prueba.
// ============================================================================

// Campo de texto opcional del tenant: se recorta y el vacío se guarda como NULL,
// no como ''. Importa porque el generador del contrato distingue "sin capturar"
// (marca el hueco y bloquea la firma) de "capturado"; una cadena vacía pasaría
// por capturada y sacaría el documento con la declaración en blanco sin avisar.
export const textoTenant = (max: number) =>
  z.string().trim().max(max).nullable().transform((s) => (s ? s : null))

// Persona moral: 3 letras + 6 dígitos de fecha + 3 de homoclave (12).
// Persona física: 4 letras + 6 + 3 (13). La Ñ y el & son válidos en la raíz.
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

// El RFC se guarda normalizado (mayúsculas, sin espacios ni guiones): es lo que
// se imprime en la declaración fiscal y lo que se compara contra el CSF. Sin
// normalizar, el mismo RFC tecleado de dos formas produce dos contratos que no
// concuerdan entre sí.
export const rfcTenant = z
  .string()
  .trim()
  // Holgado a propósito: el `.max()` corre ANTES del transform, y quien teclea
  // «RGB 140101 AB1» con separadores pasaría de 13 y se le rechazaría por largo
  // en vez de normalizarle los espacios. El formato lo decide el refine de abajo.
  .max(30)
  .nullable()
  .transform((s) => (s ? s.toUpperCase().replace(/[\s-]+/g, '') : null))
  .refine(
    (s) => s == null || RFC_RE.test(s),
    'RFC inválido: debe tener 12 caracteres (persona moral) o 13 (persona física)',
  )
