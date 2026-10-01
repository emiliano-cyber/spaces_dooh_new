// ============================================================================
//  Space Eyes — la marca de las fotos (nombre · fecha · hora) y el álbum .zip.
// ----------------------------------------------------------------------------
//  Port fiel de `frontend/src/js/photo-utils.js` de Space Eye. Las fotos de las
//  APK desde la 0.8.0 llegan LIMPIAS (`watermark_baked = 0`) y la marca se dibuja
//  aquí, en el navegador, con la posición y el estilo que el equipo tenga
//  configurados. Lo que se ve en el visor y lo que se descarga salen del MISMO
//  dibujo, para que la evidencia que se manda sea la que se miró.
//
//  El archivo guardado en Space Eye NUNCA se toca: el giro y la marca se aplican
//  solo al mostrar y al descargar, para no recomprimir la evidencia.
//
//  Todo lo de este archivo es puro salvo `renderizarFoto` y `cargarImagen`, que
//  necesitan el DOM y solo se llaman desde el navegador.
// ============================================================================

/** Los campos de una foto de `GET /api/photos` que usa la marca. */
export interface FotoConMarca {
  id: number
  storage_path: string
  taken_at: string | null
  device_name?: string | null
  watermark_baked?: number | boolean | null
  display_rotation?: number | string | null
  overlay_x?: number | string | null
  overlay_y?: number | string | null
  overlay_enabled?: number | boolean | null
  overlay_style?: string | EstiloMarca | null
}

export interface EstiloMarca {
  size?: number | string
  weight?: 'normal' | 'bold' | string
  color?: string
  align?: 'left' | 'center' | 'right' | string
  lineSpacing?: number | string
  letterSpacing?: number | string
  bg?: boolean
  shadow?: boolean
}

export interface PosMarca {
  x: number
  y: number
}

export interface Marca {
  lineas: string[]
  pos: PosMarca
  estilo: EstiloMarca | null
}

/** Lo mínimo del contexto 2D que usa el dibujo (deja probarlo sin navegador). */
export type Contexto2D = Pick<
  CanvasRenderingContext2D,
  | 'font'
  | 'textBaseline'
  | 'textAlign'
  | 'fillStyle'
  | 'shadowColor'
  | 'shadowBlur'
  | 'measureText'
  | 'beginPath'
  | 'moveTo'
  | 'arcTo'
  | 'closePath'
  | 'fill'
  | 'fillText'
> & { letterSpacing?: string }

export function parsearEstilo(s: FotoConMarca['overlay_style']): EstiloMarca | null {
  if (s == null) return null
  if (typeof s === 'string') {
    try {
      const v = JSON.parse(s)
      return v && typeof v === 'object' ? (v as EstiloMarca) : null
    } catch {
      return null
    }
  }
  return s
}

/** Nombre · fecha · hora, con la fecha de CAPTURA (taken_at), no la de descarga. */
export function lineasMarca(foto: Pick<FotoConMarca, 'taken_at' | 'device_name'>, nombre?: string | null): string[] {
  const n = nombre || foto.device_name || 'SPACE EYE'
  const d = foto.taken_at ? new Date(foto.taken_at) : null
  const valida = d && !Number.isNaN(d.getTime())
  const fecha = valida ? d!.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const hora = valida ? d!.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
  return [n, fecha, hora].filter(Boolean)
}

/**
 * La marca a dibujar en una foto, o `null` si la foto ya trae la marca quemada
 * (APK vieja) o el equipo tiene la marca desactivada.
 */
export function marcaDeFoto(foto: FotoConMarca): Marca | null {
  const limpia = foto.watermark_baked === 0 || foto.watermark_baked === false
  const activa = foto.overlay_enabled !== 0 && foto.overlay_enabled !== false
  if (!limpia || !activa) return null
  return {
    lineas: lineasMarca(foto, foto.device_name),
    pos: {
      x: Number(foto.overlay_x != null ? foto.overlay_x : 50),
      y: Number(foto.overlay_y != null ? foto.overlay_y : 92),
    },
    estilo: parsearEstilo(foto.overlay_style),
  }
}

/** Cuánto hay que girar ESTA foto para verla derecha (lo decide Space Eye). */
export function giroDeFoto(foto: Pick<FotoConMarca, 'display_rotation'> | null | undefined): number {
  const g = Number(foto?.display_rotation) || 0
  return g === 90 || g === 180 || g === 270 ? g : 0
}

export function normalizarGiro(g: number): number {
  return ((Math.round(Number(g) || 0) % 360) + 360) % 360
}

/** Tamaño del lienzo final de una imagen girada. */
export function lienzoGirado(ancho: number, alto: number, giro: number): { ancho: number; alto: number } {
  const r = normalizarGiro(giro)
  return r === 90 || r === 270 ? { ancho: alto, alto: ancho } : { ancho, alto }
}

/** Las medidas del texto de la marca para un lienzo de `ancho` px. */
export function medidasMarca(ancho: number, estilo: EstiloMarca | null) {
  const st = estilo || {}
  const fs = Math.max(12, Math.round((ancho / 42) * (Number(st.size) || 1.2)))
  return {
    fs,
    lh: Math.round(fs * (Number(st.lineSpacing) || 1.3)),
    padX: Math.round(fs * 0.9),
    padY: Math.round(fs * 0.6),
    radio: Math.round(fs * 0.4),
    negrita: st.weight !== 'normal',
    color: st.color || '#ffffff',
    alinear: (st.align === 'center' || st.align === 'right' ? st.align : 'left') as 'left' | 'center' | 'right',
    espaciado: Number(st.letterSpacing) || 0,
    fondo: st.bg !== false,
    sombra: st.shadow !== false,
  }
}

/**
 * Dónde cae la caja de la marca: centrada en `pos` (% del lienzo) y acotada a
 * 6 px de los bordes, para que nunca se salga de la foto.
 */
export function cajaMarca(
  W: number,
  H: number,
  cajaAncho: number,
  cajaAlto: number,
  pos: PosMarca | null,
): { x: number; y: number } {
  const cx = ((pos && pos.x != null && Number.isFinite(pos.x) ? pos.x : 50) / 100) * W
  const cy = ((pos && pos.y != null && Number.isFinite(pos.y) ? pos.y : 92) / 100) * H
  return {
    x: Math.min(Math.max(cx - cajaAncho / 2, 6), Math.max(6, W - cajaAncho - 6)),
    y: Math.min(Math.max(cy - cajaAlto / 2, 6), Math.max(6, H - cajaAlto - 6)),
  }
}

/**
 * Dibuja la marca en un lienzo de W×H. Fondo semitransparente y sombra = legible
 * sobre cualquier foto. Mismo algoritmo que `_drawOverlay` de Space Eye.
 */
export function dibujarMarca(
  ctx: Contexto2D,
  W: number,
  H: number,
  lineasEntrada: (string | null | undefined)[] | null,
  pos: PosMarca | null,
  estilo: EstiloMarca | null,
): void {
  const lineas = (lineasEntrada || []).filter((l): l is string => !!l)
  if (!lineas.length) return
  const m = medidasMarca(W, estilo)

  ctx.font = `${m.negrita ? 'bold ' : ''}${m.fs}px Arial, Helvetica, sans-serif`
  ctx.textBaseline = 'top'
  try { ctx.letterSpacing = `${m.espaciado * m.fs}px` } catch { /* navegador sin letterSpacing */ }

  let textoAncho = 0
  for (const l of lineas) textoAncho = Math.max(textoAncho, ctx.measureText(l).width)
  const boxW = textoAncho + m.padX * 2
  const boxH = lineas.length * m.lh + m.padY * 2
  const { x: bx, y: by } = cajaMarca(W, H, boxW, boxH, pos)

  if (m.fondo) {
    const r = m.radio
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.moveTo(bx + r, by)
    ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r)
    ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r)
    ctx.arcTo(bx, by + boxH, bx, by, r)
    ctx.arcTo(bx, by, bx + boxW, by, r)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = m.color
  if (m.sombra) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4 }
  ctx.textAlign = m.alinear
  const tx = m.alinear === 'center' ? bx + boxW / 2 : m.alinear === 'right' ? bx + boxW - m.padX : bx + m.padX
  let ty = by + m.padY
  for (const l of lineas) { ctx.fillText(l, tx, ty); ty += m.lh }
  ctx.shadowBlur = 0
  ctx.textAlign = 'left'
  try { ctx.letterSpacing = '0px' } catch { /* idem */ }
}

// ─── Nombres de archivo ─────────────────────────────────────────────────────

/** `Nombre_del_equipo_2026-10-01T12-30-00.jpg` (la descarga de una foto). */
export function nombreDescarga(foto: Pick<FotoConMarca, 'taken_at' | 'device_name'>): string {
  const d = foto.taken_at ? new Date(foto.taken_at) : null
  const ts = d && !Number.isNaN(d.getTime()) ? d.toISOString().replace(/[:.]/g, '-').slice(0, 19) : 'sin-fecha'
  const base = (foto.device_name || 'foto').replace(/\s+/g, '_')
  return `${base}_${ts}.jpg`
}

/**
 * El nombre dentro del .zip. Se corta la consulta: desde que /storage exige
 * firma, la ruta trae `?exp=...&sig=...`, y `?` y `&` no valen en un nombre de
 * archivo de Windows.
 */
export function nombreEnZip(foto: Pick<FotoConMarca, 'id' | 'storage_path'>): string {
  const base = (foto.storage_path || '').split('?')[0].split('/').pop()
  return base || `photo_${foto.id}.jpg`
}

// ─── ZIP sin compresión ─────────────────────────────────────────────────────
// Space Eye usa JSZip; aquí no hace falta la dependencia: las fotos ya son JPEG
// y comprimirlas otra vez no ahorra nada. Formato «stored» (método 0).

let TABLA_CRC: Uint32Array | null = null
export function crc32(datos: Uint8Array): number {
  if (!TABLA_CRC) {
    TABLA_CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      TABLA_CRC[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < datos.length; i++) crc = TABLA_CRC[(crc ^ datos[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Si dos fotos se llamaran igual, la segunda sería `x (2).jpg` en vez de pisar a la primera. */
export function nombresUnicos(nombres: string[]): string[] {
  const vistos = new Map<string, number>()
  return nombres.map((n) => {
    const k = n.toLowerCase()
    const veces = (vistos.get(k) ?? 0) + 1
    vistos.set(k, veces)
    if (veces === 1) return n
    const punto = n.lastIndexOf('.')
    return punto > 0 ? `${n.slice(0, punto)} (${veces})${n.slice(punto)}` : `${n} (${veces})`
  })
}

export function crearZip(entradas: { nombre: string; datos: Uint8Array }[], fecha = new Date()): Uint8Array {
  const enc = new TextEncoder()
  const nombres = nombresUnicos(entradas.map((e) => e.nombre))
  const dosHora = ((fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1)) & 0xffff
  const dosFecha = (((Math.max(1980, fecha.getFullYear()) - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()) & 0xffff

  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let desplazamiento = 0

  entradas.forEach((e, i) => {
    const nombre = enc.encode(nombres[i])
    const crc = crc32(e.datos)
    const tam = e.datos.length

    const local = new Uint8Array(30 + nombre.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // nombres en UTF-8
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosHora, true)
    lv.setUint16(12, dosFecha, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, tam, true)
    lv.setUint32(22, tam, true)
    lv.setUint16(26, nombre.length, true)
    lv.setUint16(28, 0, true)
    local.set(nombre, 30)
    locales.push(local, e.datos)

    const central = new Uint8Array(46 + nombre.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosHora, true)
    cv.setUint16(14, dosFecha, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, tam, true)
    cv.setUint32(24, tam, true)
    cv.setUint16(28, nombre.length, true)
    cv.setUint32(42, desplazamiento, true)
    central.set(nombre, 46)
    centrales.push(central)

    desplazamiento += local.length + tam
  })

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0)
  const fin = new Uint8Array(22)
  const fv = new DataView(fin.buffer)
  fv.setUint32(0, 0x06054b50, true)
  fv.setUint16(8, entradas.length, true)
  fv.setUint16(10, entradas.length, true)
  fv.setUint32(12, tamCentral, true)
  fv.setUint32(16, desplazamiento, true)

  const partes = [...locales, ...centrales, fin]
  const total = partes.reduce((s, p) => s + p.length, 0)
  const salida = new Uint8Array(total)
  let o = 0
  for (const p of partes) { salida.set(p, o); o += p.length }
  return salida
}

// ─── Navegador ──────────────────────────────────────────────────────────────

export function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la foto'))
    img.src = url // mismo origen (la puerta de SPACE OS) → el lienzo no se «tiñe»
  })
}

/** La foto girada `giro` grados y con la marca dibujada, como JPEG. */
export async function renderizarFoto(url: string, giro: number, marca: Marca | null): Promise<Blob> {
  const img = await cargarImagen(url)
  const r = normalizarGiro(giro)
  const { ancho, alto } = lienzoGirado(img.naturalWidth, img.naturalHeight, r)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no puede dibujar la foto')
  ctx.translate(ancho / 2, alto / 2)
  ctx.rotate((r * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (marca) dibujarMarca(ctx, ancho, alto, marca.lineas, marca.pos, marca.estilo)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
  if (!blob) throw new Error('No se pudo generar la imagen')
  return blob
}

export function descargarBlob(blob: Blob, nombre: string, msRevocar = 8000): void {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), msRevocar)
}
