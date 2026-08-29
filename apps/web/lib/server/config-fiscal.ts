import { z } from 'zod'
import { esRfcValido } from '@/lib/rfc'

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

// La regla del RFC NO se define aquí. Este archivo tenía su propia copia de la
// expresión —persona moral 3 letras + 6 dígitos + 3 de homoclave; física, 4—, y
// el 26/08 se corrigió la de `@/lib/rfc` para exigir que la fecha exista en un
// calendario (el `\d{6}` aceptaba el mes 13) sin que esta copia se enterara.
//
// Aquí duele más que en clientes: éste es el RFC del EMISOR, el de la propia
// organización. Va en cada CFDI y lo recita el generador de contratos en las
// declaraciones de la parte arrendataria. Un cliente con el RFC mal frena una
// factura; el emisor con el RFC mal las frena todas.

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
    // `esRfcValido` da por bueno el vacío (el RFC es opcional), pero aquí no
    // llega vacío nunca: el transform de arriba ya lo convirtió en null.
    (s) => s == null || esRfcValido(s),
    'RFC inválido: 12 caracteres (persona moral) o 13 (persona física), y la fecha tiene que existir',
  )
