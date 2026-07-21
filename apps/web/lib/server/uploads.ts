import 'server-only'
import { z } from 'zod'
import { AppError } from './errores'

// ============================================================================
//  lib/server/uploads.ts — Validación única de subidas (Hardening 1 · Bloque D).
//
//  Hallazgo: 6 de los 7 puntos de subida aceptaban cualquier data URL, de
//  cualquier peso. El límite del navegador se salta con un `curl`, así que la
//  única validación que cuenta es la del servidor.
//
//  Este helper NO confía en el MIME declarado en la cabecera del data URL: lo
//  contrasta contra los MAGIC BYTES reales del contenido decodificado. Renombrar
//  un `.exe` a `.jpg` (o declarar `data:image/png;base64,<un PE>`) se rechaza.
//
//  Todo rechazo es 422 con un mensaje que el usuario pueda entender.
// ============================================================================

export type TipoPermitido =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'text/html'

// Firma binaria de cada tipo. `null` = formato textual, se verifica aparte
// (un SVG o un HTML no tienen magic bytes fijos).
const MAGIC: Record<TipoPermitido, ((b: Buffer) => boolean) | null> = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  // RIFF....WEBP — el tamaño va en los bytes 4-7, por eso se saltan.
  'image/webp': (b) =>
    b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': (b) => b.length > 4 && b.subarray(0, 4).toString('ascii') === '%PDF',
  'image/svg+xml': null,
  'text/html': null,
}

const NOMBRE: Record<TipoPermitido, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'application/pdf': 'PDF',
  'text/html': 'HTML',
}

// Un SVG es XML ejecutable en el navegador: un `<script>` o un `onload=` dentro
// de un logo es XSS almacenado servido desde nuestro propio dominio. Se rechaza
// en vez de sanear: sanear SVG bien es un problema abierto, y un logo no
// necesita scripts.
const SVG_PELIGROSO = [
  /<\s*script/i,
  /<\s*foreignObject/i,
  /\son\w+\s*=/i, // onload=, onerror=, onclick=…
  /javascript\s*:/i,
  /<\s*!ENTITY/i, // XXE / billion laughs
  /<\s*iframe/i,
  /<\s*embed/i,
  /<\s*object/i,
]

export type UploadValidado = {
  mime: TipoPermitido
  bytes: Buffer
  /** El data URL original, ya validado. */
  dataUrl: string
  /** Tamaño real del contenido decodificado. */
  tamanoBytes: number
}

// Cabecera de un data URL base64: data:<mime>;base64,<datos>
const CABECERA = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/\r\n]*={0,2})$/i

/**
 * Valida una subida en data URL base64. Lanza AppError(422) si algo no cuadra.
 *
 * @param base64    data URL completo (`data:<mime>;base64,…`)
 * @param allowlist tipos aceptados en ESTE punto de subida
 * @param maxMB     límite de tamaño del contenido ya decodificado
 * @param campo     nombre del campo, solo para el mensaje de error
 */
export function validarUpload(opts: {
  base64: string
  allowlist: readonly TipoPermitido[]
  maxMB: number
  campo?: string
}): UploadValidado {
  const { allowlist, maxMB } = opts
  const campo = opts.campo ? `${opts.campo}: ` : ''
  const tipos = allowlist.map((t) => NOMBRE[t]).join(', ')

  if (typeof opts.base64 !== 'string' || !opts.base64) {
    throw new AppError(`${campo}No se recibió ningún archivo`, 422)
  }

  const m = CABECERA.exec(opts.base64.trim())
  if (!m) {
    throw new AppError(`${campo}El archivo debe venir como data URL en base64 (${tipos})`, 422)
  }

  const declarado = m[1].toLowerCase() as TipoPermitido
  if (!allowlist.includes(declarado)) {
    throw new AppError(`${campo}Tipo de archivo no permitido aquí. Se aceptan: ${tipos}`, 422)
  }

  // Corta ANTES de decodificar: un base64 de 50 MB no debe materializarse en
  // memoria solo para descubrir que se pasa del límite. 4 chars de base64 = 3
  // bytes, así que el tamaño real se estima desde la longitud de la cadena.
  const b64 = m[2].replace(/[\r\n]/g, '')
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  const estimado = Math.floor((b64.length * 3) / 4) - padding
  const limite = maxMB * 1024 * 1024
  if (estimado > limite) {
    throw new AppError(`${campo}El archivo supera el límite de ${maxMB} MB`, 422)
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(b64, 'base64')
  } catch {
    throw new AppError(`${campo}El archivo está corrupto o mal codificado`, 422)
  }
  if (!bytes.length) throw new AppError(`${campo}El archivo está vacío`, 422)
  if (bytes.length > limite) {
    throw new AppError(`${campo}El archivo supera el límite de ${maxMB} MB`, 422)
  }

  // ─── Contenido real vs. tipo declarado ────────────────────────────────────
  const comprueba = MAGIC[declarado]
  if (comprueba) {
    if (!comprueba(bytes)) {
      throw new AppError(
        `${campo}El contenido del archivo no corresponde a un ${NOMBRE[declarado]} real`,
        422,
      )
    }
  } else {
    // Formatos textuales: deben decodificar como UTF-8 sin bytes nulos (un
    // binario renombrado casi siempre los tiene) y parecerse a lo que dicen ser.
    if (bytes.includes(0x00)) {
      throw new AppError(`${campo}El contenido del archivo no es texto válido`, 422)
    }
    const texto = bytes.toString('utf8')
    if (declarado === 'image/svg+xml') {
      if (!/<\s*svg[\s>]/i.test(texto)) {
        throw new AppError(`${campo}El contenido del archivo no corresponde a un SVG real`, 422)
      }
      const peligro = SVG_PELIGROSO.find((re) => re.test(texto))
      if (peligro) {
        throw new AppError(
          `${campo}El SVG contiene código ejecutable (scripts o manejadores de eventos) y no se puede aceptar`,
          422,
        )
      }
    }
    if (declarado === 'text/html' && !/<[a-z!/]/i.test(texto)) {
      throw new AppError(`${campo}El contenido del archivo no corresponde a un HTML real`, 422)
    }
  }

  return { mime: declarado, bytes, dataUrl: opts.base64.trim(), tamanoBytes: bytes.length }
}

/**
 * Envoltorio zod del mismo helper, para los controllers que ya validan con
 * schemas. Mantiene el mensaje de `validarUpload` y marca el campo como
 * inválido; la ruta lo traduce a 422.
 */
export function uploadZod(allowlist: readonly TipoPermitido[], maxMB: number) {
  return z.string().superRefine((v, ctx) => {
    try {
      validarUpload({ base64: v, allowlist, maxMB })
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof AppError ? e.message : 'Archivo inválido',
        // 422 (no 400): el cuerpo está bien formado, lo inválido es el archivo.
        params: { status: e instanceof AppError ? e.status : 422 },
      })
    }
  })
}

/**
 * Igual que `uploadZod`, pero el campo también admite una URL http(s) a un
 * archivo ya hospedado (o una key de Spaces). Solo valida cuando el valor es un
 * data URL, que es el único caso en que el cliente nos manda bytes.
 */
export function uploadOUrlZod(allowlist: readonly TipoPermitido[], maxMB: number, campo?: string) {
  return z.string().trim().superRefine((v, ctx) => {
    if (!v.startsWith('data:')) return // URL/key existente: nada que validar aquí
    try {
      validarUpload({ base64: v, allowlist, maxMB, campo })
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof AppError ? e.message : 'Archivo inválido',
        params: { status: e instanceof AppError ? e.status : 422 },
      })
    }
  })
}

// Límites por punto de subida, en un solo lugar para que no se dispersen por el
// código. Cada uno viene del cuadro del Bloque D de la auditoría.
export const LIMITES = {
  evidenciaOT: { allowlist: ['image/jpeg', 'image/png', 'image/webp'] as const, maxMB: 8 },
  logoEmpresa: { allowlist: ['image/png', 'image/svg+xml', 'image/webp'] as const, maxMB: 2 },
  creatividadImagen: { allowlist: ['image/jpeg', 'image/png', 'image/webp'] as const, maxMB: 15 },
  creatividadHtml: { allowlist: ['text/html'] as const, maxMB: 2 },
  fotoSitio: { allowlist: ['image/jpeg', 'image/png', 'image/webp'] as const, maxMB: 8 },
  contratoPdf: { allowlist: ['application/pdf'] as const, maxMB: 10 },
  ocCampana: {
    allowlist: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const,
    maxMB: 10,
  },
  adjuntoPago: {
    allowlist: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const,
    maxMB: 5,
  },
} satisfies Record<string, { allowlist: readonly TipoPermitido[]; maxMB: number }>
