// ============================================================================
//  lib/envio-creativo-cliente.ts — el creativo que manda el CLIENTE por la liga
// ----------------------------------------------------------------------------
//  ENVIO-CLIENTE (pedido del dueño, 18/11): «de la liga se pueda subir el
//  creativo que veremos desde la pantalla de Campañas, y obvio no se puede
//  aprobar más que por los perfiles seleccionados». Y el mismo día: el archivo
//  NO entra a `creatividades` hasta que lo aprueba un Dueño o Administrador; se
//  queda en `envios_creativo_cliente` (migración `20261118_…`).
//
//  Funciones PURAS: las usan el controller público, la página y las pruebas.
//  La validación de FONDO (bytes reales contra el tipo declarado) es la del
//  creativo normal (`crearSchema` de `creativos-controller.ts`) y la corre el
//  servidor; aquí va lo que se decide antes de tocar la base o de decodificar.
// ============================================================================

import { IMAGEN_CREATIVO_MAX_MB } from './creativo-html'
import { ajusteEnMarco, nombreProporcion, proporcion, proporcionDeResolucion } from './proporcion-pantalla'

/** Los mismos tipos que la imagen de un creativo (`LIMITES.creatividadImagen`). */
export const TIPOS_ENVIO = ['image/jpeg', 'image/png', 'image/webp'] as const
export type TipoEnvio = (typeof TIPOS_ENVIO)[number]

/**
 * El tope de la imagen envuelta del creativo normal: lo que aprueba la ficha
 * pasa después por `crearSchema`, y una imagen más grande ahí se rechazaría
 * DESPUÉS de que alguien la aprobó.
 */
export const ENVIO_MAX_MB = IMAGEN_CREATIVO_MAX_MB

/** Envíos por campaña y día. Un cliente real manda dos o tres; esto corta el abuso. */
export const LIMITE_ENVIOS_POR_DIA = 10

export type EstatusEnvio = 'PENDIENTE' | 'RECHAZADO'

/** Lo que la liga enseña de cada envío: nada interno (ni id, ni IP, ni quién revisó). */
export interface EnvioParaCliente {
  nombre: string
  estatus: EstatusEnvio
  motivo: string | null
  creadoEn: string | null
  sitioNombre: string | null
}

/** Una pantalla de la campaña, para que el cliente elija a cuál va su arte. */
export interface PantallaParaCliente {
  id: string
  nombre: string
  tipoMedio: string | null
  ancho: number | null
  alto: number | null
  resolucionPx: string | null
}

/**
 * La IP SIN el último tramo: basta para ver que veinte envíos vienen del mismo
 * sitio, y no identifica a nadie. `null` si no se reconoce.
 */
export function truncarIp(ip: string | null | undefined): string | null {
  const s = String(ip ?? '').trim()
  if (!s) return null
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/i.exec(s)
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`
  if (/^[0-9a-f:]+$/i.test(s) && s.includes(':')) {
    const grupos = s.split(':').filter(Boolean).slice(0, 3)
    return grupos.length ? `${grupos.join(':')}::` : null
  }
  return null
}

/**
 * El nombre que se ENSEÑA (nunca se usa como ruta: el archivo vive en la base).
 * Sin carpetas, sin comillas ni signos de HTML (va a un `alt=""` al envolverse
 * con `imagenAHtml`), y corto.
 */
export function sanearNombreArchivo(nombre: string | null | undefined): string {
  const base = String(nombre ?? '').split(/[\\/]/).pop() ?? ''
  const limpio = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>"&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim()
  return limpio || 'creativo'
}

export type LecturaImagen =
  | { ok: true; tipo: TipoEnvio; bytes: number }
  | { ok: false; status: 400 | 413; error: string }

/**
 * Primera puerta del archivo: que sea un data URL de imagen de los tipos
 * permitidos (400) y que no pase del tope (413). El tamaño se estima desde la
 * longitud del base64, ANTES de decodificar: un archivo de 50 MB no se
 * materializa en memoria para descubrir que sobra.
 */
export function leerImagenEnvio(dataUrl: unknown): LecturaImagen {
  if (typeof dataUrl !== 'string') return { ok: false, status: 400, error: 'Falta el archivo' }
  const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(dataUrl.trim())
  if (!m) return { ok: false, status: 400, error: 'El archivo debe ser una imagen JPG, PNG o WebP' }
  const tipo = m[1].toLowerCase()
  if (!(TIPOS_ENVIO as readonly string[]).includes(tipo)) {
    return { ok: false, status: 400, error: 'Tipo de archivo no permitido. Se aceptan JPG, PNG y WebP' }
  }
  const b64 = m[2]
  const relleno = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  const bytes = Math.floor((b64.length * 3) / 4) - relleno
  if (bytes <= 0) return { ok: false, status: 400, error: 'El archivo está vacío' }
  if (bytes > ENVIO_MAX_MB * 1024 * 1024) {
    return { ok: false, status: 413, error: `La imagen supera ${ENVIO_MAX_MB} MB` }
  }
  return { ok: true, tipo: tipo as TipoEnvio, bytes }
}

// Medidas como 12.9 × 7.2 m: sin decimales de relleno.
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

/**
 * Lo que se le dice al cliente de una pantalla para que prepare el arte: su
 * proporción («16:9») y su medida. Una pantalla con resolución manda en
 * píxeles; una lona, en metros. `null` si no hay medida capturada.
 */
export function orientacionDePantalla(
  p: Pick<PantallaParaCliente, 'ancho' | 'alto' | 'resolucionPx'>,
): { proporcion: string; medida: string } | null {
  const rPx = proporcionDeResolucion(p.resolucionPx)
  if (rPx != null) {
    const m = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i.exec(String(p.resolucionPx))!
    return { proporcion: nombreProporcion(rPx)!, medida: `${m[1]} × ${m[2]} px` }
  }
  const r = proporcion(p.ancho, p.alto)
  if (r == null) return null
  return { proporcion: nombreProporcion(r)!, medida: `${num(Number(p.ancho))} × ${num(Number(p.alto))} m` }
}

// ─── La medida REAL del archivo (decisión del dueño, 18/11) ─────────────────
// «Sí, rechazar» el envío cuya proporción no coincida con la del sitio. La
// medida no se toma del navegador (se puede mandar cualquier número): se lee
// de la cabecera de la imagen, sin dependencias. Solo los tres tipos que se
// aceptan. `null` si no se puede leer.

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...Array.from(b.subarray(i, i + n)))
const medida = (ancho: number, alto: number) => (ancho > 0 && alto > 0 ? { ancho, alto } : null)

export function dimensionesDeImagen(b: Uint8Array): { ancho: number; alto: number } | null {
  // PNG: firma de 8 bytes y el primer bloque es IHDR con ancho y alto.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return medida(be32(b, 16), be32(b, 20))
  }
  // JPEG: se recorren los segmentos hasta el SOF (C0–CF salvo C4, C8 y CC).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marca = b[i + 1]
      if (marca === 0xff) { i += 1; continue }
      const largo = be16(b, i + 2)
      if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
        return medida(be16(b, i + 7), be16(b, i + 5))
      }
      if (largo < 2) return null
      i += 2 + largo
    }
    return null
  }
  // WebP: RIFF…WEBP y uno de tres formatos.
  if (b.length >= 25 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const tipo = ascii(b, 12, 4)
    if (tipo === 'VP8X' && b.length >= 30) return medida(le24(b, 24) + 1, le24(b, 27) + 1)
    if (tipo === 'VP8L' && b[20] === 0x2f) {
      const v = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
      return medida((v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1)
    }
    if (tipo === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return medida(le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff)
    }
  }
  return null
}

/** La proporción del sitio (la resolución manda sobre los metros), o null si no tiene medida. */
export function proporcionDePantalla(
  p: Pick<PantallaParaCliente, 'ancho' | 'alto' | 'resolucionPx'>,
): number | null {
  return proporcionDeResolucion(p.resolucionPx) ?? proporcion(p.ancho, p.alto)
}

export interface ProporcionRechazada {
  /** La proporción de la imagen («16:9»). */
  arte: string
  /** La del sitio elegido. */
  sitio: string
  /** La medida del sitio tal como se le dice al cliente («12.9 × 7.2 m»). */
  medida: string
  /** Una medida en píxeles que sí cuadra, con el lado largo de su imagen. */
  sugerido: { ancho: number; alto: number }
}

/**
 * ¿Cuadra la imagen con el sitio? `null` = sí (o el sitio no tiene medida y no
 * hay contra qué comparar: no se rechaza a ciegas). La tolerancia es la de la
 * valoración del arte (`TOLERANCIA_AJUSTE`, 3 % de recorte = «verde»): el
 * mismo `ajusteEnMarco` que Imprenta.
 */
export function revisarProporcionEnvio(
  pantalla: Pick<PantallaParaCliente, 'ancho' | 'alto' | 'resolucionPx'> | null | undefined,
  anchoPx: number,
  altoPx: number,
): ProporcionRechazada | null {
  if (!pantalla) return null
  const marco = proporcionDePantalla(pantalla)
  const arte = proporcion(anchoPx, altoPx)
  if (marco == null || arte == null) return null
  if (ajusteEnMarco(marco, arte).tipo === 'ajusta') return null
  const largo = Math.max(anchoPx, altoPx)
  const sugerido =
    marco >= 1
      ? { ancho: largo, alto: Math.round(largo / marco) }
      : { ancho: Math.round(largo * marco), alto: largo }
  return {
    arte: nombreProporcion(arte)!,
    sitio: nombreProporcion(marco)!,
    medida: orientacionDePantalla(pantalla)!.medida,
    sugerido,
  }
}
