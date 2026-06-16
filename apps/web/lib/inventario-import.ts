// ============================================================================
//  lib/inventario-import.ts — Parseo y validación de inventario (Excel/CSV)
// ----------------------------------------------------------------------------
//  Lee .xlsx/.csv con SheetJS, limpia encabezados (espacios/acentos/especiales),
//  mapea las 24 columnas, valida según las reglas de negocio y devuelve filas
//  validadas listas para que el adapter las cree/actualice. Sin estado: puro.
// ============================================================================

import * as XLSX from 'xlsx'

// Datos crudos mapeados de una fila (antes de convertir a Sitio).
export interface SitioImport {
  codigo_proveedor: string
  nombre: string
  tipo_medio: string
  exhibicion: string
  unidad: string
  es_rotativo: boolean
  plaza_ciudad: string
  direccion: string
  latitud: number
  longitud: number
  ancho_m: number
  alto_m: number
  caras: number
  iluminacion: boolean
  tipo_estructura: string
  vista: string
  tramo: string
  tarifa_publicada: number
  costo_compra: number
  spots_por_hora: number | null
  duracion_spot_seg: number | null
  horario: string
  notas: string
  imagen_promocional: string
  pendienteVerificacion: boolean
}

export interface FilaValidada {
  codigo_proveedor: string
  datos: SitioImport | null // null si la fila es error
  status: 'ok' | 'error' | 'advertencia'
  mensaje: string
}

const LAT_DEFAULT = 19.4326
const LNG_DEFAULT = -99.1332

const TIPO_MEDIO_OK = ['espectacular', 'muro', 'valla']
const EXHIBICION_OK = ['fijo', 'digital']
const UNIDAD_OK = ['mensual', 'catorcenal', 'semanal']

// Limpia un encabezado: minúsculas, sin acentos, espacios/especiales → '_'.
export function limpiarHeader(h: string): string {
  return String(h)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // espacios y especiales
    .replace(/^_+|_+$/g, '')
}

// Lee el archivo y devuelve filas como objetos con encabezados limpios.
export async function leerArchivo(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return filas.map((fila) => {
    const limpia: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fila)) limpia[limpiarHeader(k)] = v
    return limpia
  })
}

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim()
}
function num(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function siNo(v: unknown): boolean {
  return /^s[ií]$/i.test(txt(v))
}

// Valida y mapea una fila cruda. idx para mensajes.
export function validarFila(raw: Record<string, unknown>, idx: number): FilaValidada {
  const codigo = txt(raw.codigo_proveedor)
  const nombre = txt(raw.nombre)
  const tipoMedio = txt(raw.tipo_medio).toLowerCase()
  const plaza = txt(raw.plaza_ciudad)
  const lat = num(raw.latitud)
  const lng = num(raw.longitud)

  // Obligatorios
  const faltan: string[] = []
  if (!codigo) faltan.push('codigo_proveedor')
  if (!nombre) faltan.push('nombre')
  if (!tipoMedio) faltan.push('tipo_medio')
  if (!plaza) faltan.push('plaza_ciudad')
  if (lat == null && txt(raw.latitud) !== '') faltan.push('latitud (no numérica)')
  if (lng == null && txt(raw.longitud) !== '') faltan.push('longitud (no numérica)')
  if (faltan.length) {
    return {
      codigo_proveedor: codigo || `fila ${idx + 2}`,
      datos: null,
      status: 'error',
      mensaje: `Faltan campos obligatorios: ${faltan.join(', ')}`,
    }
  }

  const advertencias: string[] = []
  if (!TIPO_MEDIO_OK.includes(tipoMedio)) advertencias.push(`tipo_medio "${tipoMedio}" no estándar`)
  const exhibicion = txt(raw.exhibicion).toLowerCase()
  if (exhibicion && !EXHIBICION_OK.includes(exhibicion)) advertencias.push(`exhibicion "${exhibicion}" no estándar`)
  const unidad = txt(raw.unidad).toLowerCase()
  if (unidad && !UNIDAD_OK.includes(unidad)) advertencias.push(`unidad "${unidad}" no estándar`)

  // Coords default si vacías
  let pendiente = false
  let latFinal = lat
  let lngFinal = lng
  if (latFinal == null || lngFinal == null) {
    latFinal = LAT_DEFAULT
    lngFinal = LNG_DEFAULT
    pendiente = true
    advertencias.push('coordenadas por default — pendiente de verificación')
  }

  const datos: SitioImport = {
    codigo_proveedor: codigo,
    nombre,
    tipo_medio: tipoMedio,
    exhibicion: exhibicion || 'fijo',
    unidad: unidad || 'mensual',
    es_rotativo: siNo(raw.es_rotativo),
    plaza_ciudad: plaza,
    direccion: txt(raw.direccion),
    latitud: latFinal,
    longitud: lngFinal,
    ancho_m: num(raw.ancho_m) ?? 0,
    alto_m: num(raw.alto_m) ?? 0,
    caras: Math.round(num(raw.caras) ?? 1),
    iluminacion: siNo(raw.iluminacion),
    tipo_estructura: txt(raw.tipo_estructura),
    vista: txt(raw.vista),
    tramo: txt(raw.tramo),
    tarifa_publicada: num(raw.tarifa_publicada) ?? 0,
    costo_compra: num(raw.costo_compra) ?? 0,
    spots_por_hora: num(raw.spots_por_hora),
    duracion_spot_seg: num(raw.duracion_spot_seg),
    horario: txt(raw.horario),
    notas: txt(raw.notas),
    imagen_promocional: txt(raw.imagen_promocional),
    pendienteVerificacion: pendiente,
  }

  return {
    codigo_proveedor: codigo,
    datos,
    status: advertencias.length ? 'advertencia' : 'ok',
    mensaje: advertencias.length ? advertencias.join(' · ') : 'Fila válida',
  }
}

// Parsea + valida un archivo completo.
export async function validarArchivo(file: File): Promise<FilaValidada[]> {
  const filas = await leerArchivo(file)
  return filas.map((f, i) => validarFila(f, i))
}
