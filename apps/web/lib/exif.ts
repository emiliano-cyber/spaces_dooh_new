// ============================================================================
//  lib/exif.ts — Fecha de creación de una imagen (best-effort, sin dependencias)
// ----------------------------------------------------------------------------
//  Intenta leer la fecha en que se TOMÓ la foto desde el EXIF (DateTimeOriginal
//  / DateTime de un JPEG). Si la imagen no trae EXIF (capturas, PNG, descargas)
//  cae al `lastModified` del archivo. Nunca lanza: ante cualquier problema
//  devuelve el lastModified. Devuelve ISO string.
// ============================================================================

export async function leerFechaCreacion(file: File): Promise<string> {
  const fallback = new Date(file.lastModified || Date.now()).toISOString()
  try {
    if (!/jpe?g/i.test(file.type)) return fallback
    // Solo necesitamos la cabecera para el EXIF; 256 KB es de sobra.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer()
    const fecha = parseExifFecha(new DataView(buf))
    return fecha ?? fallback
  } catch {
    return fallback
  }
}

// Recorre los marcadores JPEG hasta el APP1 (Exif) y extrae DateTimeOriginal
// (0x9003) o, en su defecto, DateTime (0x0132). Devuelve ISO o null.
function parseExifFecha(view: DataView): string | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null // SOI

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if ((marker & 0xff00) !== 0xff00) break
    const size = view.getUint16(offset + 2)
    if (marker === 0xffe1) {
      // APP1: "Exif\0\0" + TIFF
      const exifStart = offset + 4
      if (view.getUint32(exifStart) === 0x45786966) {
        return parseTiff(view, exifStart + 6)
      }
    }
    offset += 2 + size
  }
  return null
}

function parseTiff(view: DataView, tiff: number): string | null {
  const le = view.getUint16(tiff) === 0x4949 // II = little-endian
  const u16 = (o: number) => view.getUint16(o, le)
  const u32 = (o: number) => view.getUint32(o, le)

  if (u16(tiff + 2) !== 0x002a) return null
  const ifd0 = tiff + u32(tiff + 4)

  const readDir = (dir: number, tag: number): number | null => {
    if (dir + 2 > view.byteLength) return null
    const n = u16(dir)
    for (let i = 0; i < n; i++) {
      const entry = dir + 2 + i * 12
      if (u16(entry) === tag) return entry
    }
    return null
  }

  const readAscii = (entry: number): string | null => {
    const count = u32(entry + 4)
    const valOff = count > 4 ? tiff + u32(entry + 8) : entry + 8
    let s = ''
    for (let i = 0; i < count - 1 && valOff + i < view.byteLength; i++) {
      s += String.fromCharCode(view.getUint8(valOff + i))
    }
    return s || null
  }

  // ExifIFD (0x8769) → DateTimeOriginal (0x9003)
  const exifPtr = readDir(ifd0, 0x8769)
  if (exifPtr) {
    const exifIfd = tiff + u32(exifPtr + 8)
    const dto = readDir(exifIfd, 0x9003)
    if (dto) {
      const iso = exifAFecha(readAscii(dto))
      if (iso) return iso
    }
  }
  // Fallback: DateTime (0x0132) en IFD0
  const dt = readDir(ifd0, 0x0132)
  if (dt) return exifAFecha(readAscii(dt))
  return null
}

// EXIF: "YYYY:MM:DD HH:MM:SS" → ISO. null si no parsea.
function exifAFecha(s: string | null): string | null {
  if (!s) return null
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, se] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))
  return isNaN(date.getTime()) ? null : date.toISOString()
}
