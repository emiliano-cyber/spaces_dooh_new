// ============================================================================
//  lib/data-url.ts — Decodificar el `data:` URL en el que se guardan las
//  imágenes de la app (logo de la organización, creativos).
//
//  Existe porque el logo hay que SERVIRLO como imagen para que salga en los
//  correos: los clientes de correo descartan las imágenes embebidas en base64,
//  así que `/api/logo/<token>` tiene que devolver los bytes de verdad con su
//  `Content-Type`. El almacenamiento no cambia; esto solo lo traduce.
// ============================================================================

// Solo mapas de bits e SVG. La lista es la MISMA que acepta el formulario de
// subida (`LOGO_TIPOS` en Administración): si alguien consigue meter otro tipo
// en la base, aquí no se sirve. Es la segunda capa — la primera es el `accept`
// del input, que solo es una sugerencia para el navegador.
const TIPOS_SERVIBLES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
])

// El documento de un contrato es un PDF (o una imagen escaneada). NO se añade a
// `TIPOS_SERVIBLES`: esa lista gobierna el logo y el arte, que se pintan con un
// `<img>`, y meterle un PDF ahí ampliaría en silencio lo que aceptan esas dos
// rutas. Cada llamador declara lo que sabe servir.
export const TIPOS_DOCUMENTO = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

export interface ImagenDecodificada {
  bytes: Buffer
  tipo: string
}

// Devuelve null —y no lanza— para cualquier entrada que no sea una imagen
// servible: un `data:` mal formado, un tipo fuera de la lista, base64 corrupto
// o una URL http (que en su día pudo guardarse en `logo_url`, porque la columna
// es un `text` sin restricción). El llamador responde 404 y ya: un logo que no
// se puede decodificar no es un error del servidor, es que no hay logo.
export function decodificarDataUrl(
  dataUrl: string | null | undefined,
  // Qué tipos sabe servir QUIEN LLAMA. Por omisión, imágenes: es lo que
  // necesitan el logo y el arte, y así ninguna ruta existente cambia de
  // comportamiento por añadir un llamador nuevo.
  tiposPermitidos: Set<string> = TIPOS_SERVIBLES,
): ImagenDecodificada | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null

  // `[\s\S]` y no `.` con la bandera `s`: el objetivo de compilación es
  // anterior a es2018 y ahí `dotAll` no existe. Hace falta cruzar saltos de
  // línea porque un base64 generado por otra herramienta puede venir troceado
  // en líneas, y `Buffer.from` los ignora sin quejarse.
  const m = /^data:([a-z0-9.+/-]+);base64,([\s\S]*)$/i.exec(dataUrl.trim())
  if (!m) return null

  const tipo = m[1].toLowerCase()
  if (!tiposPermitidos.has(tipo)) return null

  // `Buffer.from(..., 'base64')` no falla con basura: ignora lo que no es
  // base64 y devuelve lo que pudo decodificar, así que una cadena inválida da
  // un buffer corto en vez de un error. Por eso se comprueba el resultado y no
  // se confía en que no lance.
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length === 0) return null

  return { bytes, tipo }
}
