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
  // ESPEJO TRANSITORIO de `renta_arrendador` (ADR 0006, Fase 1). Ya no es un dato
  // de entrada: una pantalla tiene UN solo costo, la renta al arrendador, y este
  // campo existe solo para que los lectores que aún leen `sitios.costo_compra` no
  // vean un cero repentino. Se borra en la Fase 2.
  costo_compra: number
  // Renta que se le paga al ARRENDADOR por el espacio: el ÚNICO costo de la
  // pantalla. Lo que entra del cliente es `tarifa_publicada`; no hay un tercer
  // costo de "compra" (ADR 0006).
  //
  // Sigue pudiendo ser `null`: la plantilla vieja no trae la columna y el ADR
  // 0001 admite que el contrato nazca pendiente de captura. `null` = no venía en
  // el archivo, que NO es lo mismo que 0.
  renta_arrendador: number | null
  spots_por_hora: number | null
  duracion_spot_seg: number | null
  horario: string
  notas: string
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

// Valores válidos según el libro "Listas validadas" de la plantilla.
const TIPO_MEDIO_OK = ['espectacular', 'muro', 'valla', 'parabus', 'mupi', 'publitienda', 'puente', 'otro']
const EXHIBICION_OK = ['fijo', 'digital']
const UNIDAD_OK = ['mensual', 'catorcenal', 'semanal', 'diaria', 'spot', 'hora', 'programatico']
// Una pantalla FIJA solo se comercializa por periodo: mensual o catorcenal.
const UNIDAD_FIJO_OK = ['mensual', 'catorcenal']
const SI_NO_OK = ['si', 'sí', 'no']

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

// Elige la hoja de datos: la plantilla tiene Instrucciones / Sitios / Listas
// válidas. Tomamos "Sitios" (la de los datos), no la primera (Instrucciones).
function elegirHojaSitios(wb: XLSX.WorkBook): string {
  const porNombre = wb.SheetNames.find((n) => limpiarHeader(n).includes('sitio'))
  if (porNombre) return porNombre
  // Fallback: la primera hoja cuyos encabezados incluyan codigo_proveedor/nombre.
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: '' })
    if (rows.length) {
      const cols = Object.keys(rows[0]).map(limpiarHeader)
      if (cols.includes('codigo_proveedor') || cols.includes('nombre')) return n
    }
  }
  return wb.SheetNames[0]
}

// Lee el archivo (hoja "Sitios") y devuelve filas con encabezados limpios.
export async function leerArchivo(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[elegirHojaSitios(wb)]
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
  const exhibicionRaw = txt(raw.exhibicion)
  const unidadRaw = txt(raw.unidad)
  const tarifa = num(raw.tarifa_publicada)
  // El costo del espacio es UNO solo (ADR 0006). Se acepta con tres nombres, por
  // orden de preferencia:
  //   · `renta_arrendador` — el de la plantilla nueva.
  //   · `costo_arrendador` — el que escribe quien lo piensa como un costo.
  //   · `costo_compra`     — el de la plantilla VIEJA. Se lee como la renta
  //     porque es el mismo dinero; ignorarlo tiraría a la basura el único costo
  //     que traen los archivos que los clientes ya tienen.
  // Rechazar un archivo por el sinónimo sería fricción sin motivo.
  //
  // Ojo con `??` aquí: `sheet_to_json` usa `defval: ''`, así que una celda vacía
  // llega como cadena vacía y NO como null. Con `??`, un `renta_arrendador`
  // vacío taparía al `costo_compra` que sí trae importe. Por eso se elige el
  // primer valor NO VACÍO, no el primero no nulo.
  const presente = (v: unknown) => txt(v) !== ''
  const rentaRaw = [raw.renta_arrendador, raw.costo_arrendador, raw.costo_compra].find(presente)
  const renta = num(rentaRaw)
  // Se avisa cuando el importe vino de la columna vieja: el usuario capturó algo
  // llamado "costo de compra" y necesita saber que se registró como la renta.
  const vieneDeCostoCompra =
    !presente(raw.renta_arrendador) && !presente(raw.costo_arrendador) && presente(raw.costo_compra)

  // Obligatorios (libro Instrucciones): nombre, exhibicion, unidad,
  // tarifa_publicada. `costo_compra` DEJÓ de ser obligatorio (ADR 0006): ya no es
  // un dato propio, y exigirlo obligaba a inventar un número.
  const faltan: string[] = []
  if (!nombre) faltan.push('nombre')
  if (!exhibicionRaw) faltan.push('exhibicion')
  if (!unidadRaw) faltan.push('unidad')
  if (tarifa == null) faltan.push('tarifa_publicada')
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
  if (tipoMedio && !TIPO_MEDIO_OK.includes(tipoMedio)) advertencias.push(`tipo_medio "${tipoMedio}" no está en la lista validada`)
  const exhibicion = exhibicionRaw.toLowerCase()
  if (!EXHIBICION_OK.includes(exhibicion)) advertencias.push(`exhibicion "${exhibicion}" no está en la lista validada`)
  const unidad = unidadRaw.toLowerCase()
  // Regla estricta: una pantalla FIJA solo admite unidad mensual o catorcenal.
  if (exhibicion === 'fijo' && !UNIDAD_FIJO_OK.includes(unidad)) {
    return {
      codigo_proveedor: codigo || `fila ${idx + 2}`,
      datos: null,
      status: 'error',
      mensaje: `Pantalla fija: la unidad solo puede ser "mensual" o "catorcenal" (recibido "${unidad}")`,
    }
  }
  if (!UNIDAD_OK.includes(unidad)) advertencias.push(`unidad "${unidad}" no está en la lista validada`)
  const esRotTxt = txt(raw.es_rotativo).toLowerCase()
  if (esRotTxt && !SI_NO_OK.includes(esRotTxt)) advertencias.push(`es_rotativo "${esRotTxt}" debe ser si/no`)
  const iluTxt = txt(raw.iluminacion).toLowerCase()
  if (iluTxt && !SI_NO_OK.includes(iluTxt)) advertencias.push(`iluminacion "${iluTxt}" debe ser si/no`)

  // La renta al arrendador es opcional, pero si viene tiene que servir. Un valor
  // basura o un 0 NO se guardan como 0: `contrato_monto_ck` lo rechazaría, y
  // sobre todo un 0 se lee como «el espacio es gratis» —satisface la regla de
  // contrato completo, desaparece de la alerta de incompleto y el P&L reporta
  // margen íntegro—. Es preferible dejarlo pendiente de captura y avisarlo.
  const rentaTxt = txt(rentaRaw)
  if (rentaTxt !== '' && renta == null) {
    advertencias.push(`renta_arrendador "${rentaTxt}" no es un número — se deja pendiente de captura`)
  } else if (renta != null && renta <= 0) {
    advertencias.push('renta_arrendador debe ser mayor que cero — se deja pendiente de captura')
  }
  const rentaFinal = renta != null && renta > 0 ? renta : null
  // Solo se avisa si el importe de la columna vieja SIRVIÓ. Si era basura, el
  // mensaje de arriba ya explica que quedó pendiente; decir además de dónde salió
  // sería ruido.
  if (vieneDeCostoCompra && rentaFinal != null) {
    advertencias.push('costo_compra se registró como la renta al arrendador (es el mismo costo)')
  }

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
    tarifa_publicada: tarifa ?? 0,
    // Espejo de la renta, no un costo propio (ADR 0006). Si la renta quedó
    // pendiente, el espejo es 0: no hay ningún otro número que copiar, y
    // conservar el `costo_compra` del archivo reintroduciría el segundo costo
    // que este cambio elimina.
    costo_compra: rentaFinal ?? 0,
    renta_arrendador: rentaFinal,
    spots_por_hora: num(raw.spots_por_hora),
    duracion_spot_seg: num(raw.duracion_spot_seg),
    horario: txt(raw.horario),
    notas: txt(raw.notas),
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
