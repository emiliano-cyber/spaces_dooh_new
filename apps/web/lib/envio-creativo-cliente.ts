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
import { nombreProporcion, proporcion, proporcionDeResolucion } from './proporcion-pantalla'

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
