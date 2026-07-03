import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1 } from './db'
import { tenantActual } from './tenant'
import type { PoolClient } from 'pg'

// ============================================================================
//  lib/server/sitios-repo.ts — Persistencia de sitios + modalidades.
//  Mapea filas de Postgres al tipo `Sitio` del front (camelCase). pg devuelve
//  numeric como string, así que se castea con Number().
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))

export function rowToSitio(r: any, modalidades: any[] = []): any {
  return {
    id: r.id,
    claveInterna: r.clave_interna,
    codigoProveedor: r.codigo_proveedor,
    nombre: r.nombre,
    tipoMedio: r.tipo_medio,
    lat: n(r.lat) ?? 0,
    lng: n(r.lng) ?? 0,
    direccion: r.direccion ?? '',
    direccionPredio: r.direccion_predio ?? '',
    direccionComercial: r.direccion_comercial ?? '',
    alcaldia: r.alcaldia,
    plazaCiudad: r.plaza_ciudad ?? '',
    ciudad: r.ciudad ?? '',
    estado: r.estado ?? '',
    pais: r.pais ?? 'PE',
    alto: n(r.alto),
    ancho: n(r.ancho),
    caras: r.caras ?? 1,
    iluminado: !!r.iluminado,
    orientacion: r.orientacion,
    tipoEstructura: r.tipo_estructura ?? '',
    vista: r.vista ?? '',
    tramo: r.tramo ?? '',
    exhibicion: r.exhibicion ?? 'fijo',
    esRotativo: !!r.es_rotativo,
    unidad: r.unidad ?? 'mensual',
    resolucionPx: r.resolucion_px,
    tipoContenido: r.tipo_contenido,
    spotsPorHora: n(r.spots_por_hora),
    duracionSpotSeg: n(r.duracion_spot_seg),
    totalSpots: n(r.total_spots),
    spotsDisponibles: n(r.spots_disponibles),
    horario: r.horario,
    computerVision: !!r.computer_vision,
    admobilizeId: r.admobilize_id,
    tarifaMensual: n(r.tarifa_mensual) ?? 0,
    tarifaPublicada: n(r.tarifa_publicada) ?? 0,
    costoCompra: n(r.costo_compra) ?? 0,
    precioM2: n(r.precio_m2),
    tarifaImpresion: n(r.tarifa_impresion),
    comercializacion: r.comercializacion,
    enNetwork: !!r.en_network,
    cms: r.cms,
    estatusComercial: r.estatus_comercial,
    estatusLegal: r.estatus_legal,
    estatusOperativo: r.estatus_operativo,
    fotos: r.fotos ?? [],
    imagenPromocional: r.imagen_promocional,
    notas: r.notas,
    modalidades: modalidades.map((m) => m.unidad),
    modalidadesDetalle: modalidades.map((m) => ({
      unidad: m.unidad,
      tarifaPublicada: n(m.tarifa_publicada) ?? 0,
      costoCompra: n(m.costo_compra) ?? 0,
    })),
    creadoEn: r.creado_en,
  }
}

// Columnas insertables (orden fijo). Devuelve [cols, placeholders, values].
const COLS = [
  'codigo_proveedor', 'clave_interna', 'nombre', 'tipo_medio', 'exhibicion', 'unidad', 'es_rotativo',
  'plaza_ciudad', 'ciudad', 'estado', 'pais', 'alcaldia', 'direccion', 'direccion_predio', 'direccion_comercial',
  'lat', 'lng', 'pendiente_verificacion', 'ancho', 'alto', 'caras', 'iluminado', 'orientacion',
  'tipo_estructura', 'vista', 'tramo', 'resolucion_px', 'tipo_contenido', 'spots_por_hora', 'duracion_spot_seg',
  'total_spots', 'spots_disponibles', 'horario', 'computer_vision', 'admobilize_id',
  'tarifa_mensual', 'tarifa_publicada', 'costo_compra', 'precio_m2', 'tarifa_impresion',
  'comercializacion', 'en_network', 'cms', 'estatus_comercial', 'estatus_legal', 'estatus_operativo',
  'fotos', 'imagen_promocional', 'notas',
] as const

function valoresDe(s: any): unknown[] {
  const digital = s.tipoMedio === 'PANTALLA_DIGITAL' || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
  return [
    s.codigoProveedor ?? null, s.claveInterna ?? null, s.nombre, s.tipoMedio ?? 'OTRO',
    digital ? 'rotativo' : (s.exhibicion ?? 'fijo'), s.unidad ?? (digital ? 'mensual' : 'catorcenal'),
    s.esRotativo ?? digital, s.plazaCiudad ?? s.distrito ?? null, s.ciudad ?? 'Lima', s.estado ?? 'Lima',
    s.pais ?? 'PE', s.alcaldia ?? s.distrito ?? null, s.direccionComercial ?? s.direccion ?? null,
    s.direccionPredio ?? s.direccion ?? null, s.direccionComercial ?? s.direccion ?? null,
    s.lat ?? null, s.lng ?? null, s.pendienteVerificacion ?? false, s.ancho ?? null, s.alto ?? null,
    s.caras ?? 1, s.iluminado ?? false, s.orientacion ?? null, s.tipoEstructura ?? null,
    s.vista ?? null, s.tramo ?? null, s.resolucionPx ?? null, s.tipoContenido ?? null,
    s.spotsPorHora ?? (digital ? 6 : null), s.duracionSpotSeg ?? (digital ? 20 : null),
    s.totalSpots ?? (digital ? 12 : null), s.spotsDisponibles ?? (digital ? 12 : null),
    s.horario ?? (digital ? '06:00-24:00' : null), s.computerVision ?? false, s.admobilizeId ?? null,
    s.tarifaPublicada ?? 0, s.tarifaPublicada ?? 0, s.costoCompra ?? 0, s.precioM2 ?? null,
    s.tarifaImpresion ?? null, s.comercializacion ?? 'TRADICIONAL', s.enNetwork ?? false, s.cms ?? null,
    s.estatusComercial ?? 'DISPONIBLE', 'EN_ORDEN', 'ACTIVO',
    s.fotos ?? [], s.imagenPromocional ?? null, s.notas ?? null,
  ]
}

// Convierte una hora suelta a número de horas (0–24). Acepta "06:00", "24:00",
// "6:00 am", "12:00 pm", "6", etc.
function parseHora(s: string): number | null {
  const ap = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i)
  const simple = s.match(/(\d{1,2})(?::(\d{2}))?/)
  const m = ap ?? simple
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) / 60 : 0
  const meridiano = ap?.[3]?.toLowerCase()
  if (meridiano === 'p' && h < 12) h += 12
  if (meridiano === 'a' && h === 12) h = 0
  return h + min
}

// Horas de operación a partir del campo `horario`. Acepta rangos como
// "06:00-24:00", "6:00 am a 12:00 pm", "6 a 24". Si no se puede parsear, asume
// 18 h (jornada DOOH típica 6am–medianoche).
function horasOperacion(horario?: string | null): number {
  if (!horario) return 18
  const partes = String(horario).split(/\s+a\s+|\s*[-–—]\s*/i).filter((x) => /\d/.test(x))
  if (partes.length >= 2) {
    const start = parseHora(partes[0])
    const fin = parseHora(partes[1])
    if (start != null && fin != null) {
      let end = fin
      if (end <= start) end += 24 // cruza medianoche
      const h = end - start
      if (h > 0 && h <= 24) return h
    }
  }
  return 18
}

// ─── Lectura ────────────────────────────────────────────────────────────────
export async function listarSitios(): Promise<any[]> {
  const sitios = await q('select * from sitios where tenant_id = $1 order by creado_en asc', [await tenantActual()])
  const mods = await q('select sitio_id, unidad, tarifa_publicada, costo_compra from sitio_modalidades')
  const porSitio = new Map<string, any[]>()
  for (const m of mods) (porSitio.get(m.sitio_id) ?? porSitio.set(m.sitio_id, []).get(m.sitio_id)!).push(m)
  return sitios.map((r) => rowToSitio(r, porSitio.get(r.id) ?? []))
}

export async function getSitio(id: string): Promise<any | null> {
  const r = await q1('select * from sitios where id = $1', [id])
  if (!r) return null
  const mods = await q('select unidad, tarifa_publicada, costo_compra from sitio_modalidades where sitio_id=$1', [id])
  return rowToSitio(r, mods)
}

// ─── Escritura ──────────────────────────────────────────────────────────────
async function insertarSitio(client: PoolClient, s: any): Promise<any> {
  // Autogenera código de proveedor si no viene (alta manual no lo pide).
  if (!s.codigoProveedor) s.codigoProveedor = 'S-' + randomBytes(3).toString('hex').toUpperCase()
  const cols = [...COLS, 'tenant_id'].join(', ')
  const ph = [...COLS, 'tenant_id'].map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await client.query(`insert into sitios (${cols}) values (${ph}) returning *`, [...valoresDe(s), s.tenantId ?? (await tenantActual())])
  const row = rows[0]
  const mods: any[] = s.modalidadesDetalle ?? []
  for (const m of mods) {
    await client.query(
      `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra) values ($1,$2,$3,$4)
       on conflict (sitio_id, unidad) do update set tarifa_publicada=excluded.tarifa_publicada, costo_compra=excluded.costo_compra`,
      [row.id, m.unidad, m.tarifaPublicada ?? 0, m.costoCompra ?? 0],
    )
  }
  // Reconstruye desde la fila insertada (misma conexión); no leer del pool
  // porque la fila aún no es visible fuera de la transacción.
  return rowToSitio(
    row,
    mods.map((m) => ({ unidad: m.unidad, tarifa_publicada: m.tarifaPublicada ?? 0, costo_compra: m.costoCompra ?? 0 })),
  )
}

// Actualiza TODAS las columnas de un sitio existente (re-importación), en lugar
// de borrar+recrear. Borrar fallaba cuando el sitio ya tenía reservas (FK
// reservas_sitio_id_fkey ON DELETE RESTRICT). El UPDATE conserva esas reservas.
async function actualizarSitioCompleto(client: PoolClient, id: string, s: any): Promise<void> {
  const set = COLS.map((c, i) => `${c} = $${i + 1}`).join(', ')
  await client.query(`update sitios set ${set} where id = $${COLS.length + 1}`, [...valoresDe(s), id])
  // Reemplaza las modalidades por las del archivo.
  await client.query('delete from sitio_modalidades where sitio_id = $1', [id])
  for (const m of (s.modalidadesDetalle ?? [])) {
    await client.query(
      `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra) values ($1,$2,$3,$4)
       on conflict (sitio_id, unidad) do update set tarifa_publicada=excluded.tarifa_publicada, costo_compra=excluded.costo_compra`,
      [id, m.unidad, m.tarifaPublicada ?? 0, m.costoCompra ?? 0],
    )
  }
}

export async function crearSitio(s: any): Promise<any> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const sitio = await insertarSitio(client, s)
    await client.query('commit')
    return sitio
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Actualización parcial: solo columnas presentes en `cambios` (camelCase → snake).
const CAMPO_COL: Record<string, string> = {
  nombre: 'nombre', tipoMedio: 'tipo_medio', estatusComercial: 'estatus_comercial',
  estatusLegal: 'estatus_legal', estatusOperativo: 'estatus_operativo', enNetwork: 'en_network',
  comercializacion: 'comercializacion', cms: 'cms', direccion: 'direccion',
  direccionPredio: 'direccion_predio', direccionComercial: 'direccion_comercial',
  alcaldia: 'alcaldia', plazaCiudad: 'plaza_ciudad', lat: 'lat', lng: 'lng',
  ancho: 'ancho', alto: 'alto', caras: 'caras', iluminado: 'iluminado',
  tarifaPublicada: 'tarifa_publicada', tarifaMensual: 'tarifa_mensual', costoCompra: 'costo_compra',
  precioM2: 'precio_m2', tarifaImpresion: 'tarifa_impresion', resolucionPx: 'resolucion_px',
  tipoContenido: 'tipo_contenido', notas: 'notas', imagenPromocional: 'imagen_promocional',
  vista: 'vista', tramo: 'tramo', tipoEstructura: 'tipo_estructura', horario: 'horario',
  totalSpots: 'total_spots', spotsDisponibles: 'spots_disponibles',
  duracionSpotSeg: 'duracion_spot_seg', spotsPorHora: 'spots_por_hora',
}
export async function actualizarSitio(id: string, cambios: Record<string, unknown>): Promise<any | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(cambios)) {
    const col = CAMPO_COL[k]
    if (!col) continue
    vals.push(v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (!sets.length) return getSitio(id)
  vals.push(id)
  await q(`update sitios set ${sets.join(', ')} where id = $${vals.length}`, vals)
  return getSitio(id)
}

export async function borrarSitio(id: string): Promise<void> {
  await q('delete from sitios where id = $1', [id])
}

export async function toggleNetwork(id: string): Promise<any | null> {
  await q('update sitios set en_network = not en_network where id = $1', [id])
  return getSitio(id)
}

// ─── Importación masiva (agrupa por codigo_proveedor) ───────────────────────
const MAPEO_TIPO: Record<string, string> = {
  espectacular: 'ESPECTACULAR', muro: 'MURAL', valla: 'VALLA',
  parabus: 'MOBILIARIO_URBANO', mupi: 'MOBILIARIO_URBANO', publitienda: 'MOBILIARIO_URBANO',
  puente: 'PUENTE_PEATONAL', otro: 'OTRO',
}

export async function importarSitios(args: {
  filas: any[]
  modoDuplicado: 'ACTUALIZAR' | 'NUEVA_VERSION'
  precioM2: number | null
  // Imágenes por pantalla: clave = nombre de archivo SIN extensión en minúsculas
  // (= código de proveedor), valor = data URL base64.
  imagenes?: Record<string, string>
}): Promise<any> {
  const { filas, modoDuplicado, precioM2, imagenes } = args
  const detalle: any[] = []
  let creadas = 0, actualizadas = 0, con_advertencias = 0, errores = 0

  // agrupar por codigo
  const grupos = new Map<string, any[]>()
  let sinCod = 0
  for (const f of filas) {
    if (f.status === 'error' || !f.datos) {
      errores++
      detalle.push({ codigo_proveedor: f.codigo_proveedor, status: 'error', mensaje: f.mensaje })
      continue
    }
    const clave = f.datos.codigo_proveedor || `__s${++sinCod}`
    ;(grupos.get(clave) ?? grupos.set(clave, []).get(clave)!).push(f)
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const [, rows] of grupos) {
      const p = rows[0].datos
      const digital = p.exhibicion === 'digital'
      const esEstatica = !digital
      // Slots por pantalla (DOOH): por default 12 por pantalla digital.
      // Inventario nuevo → disponibles = total (todo libre al darlo de alta).
      const totalSpots = digital ? 12 : null
      const modalidadesDetalle = rows.map((r: any) => ({
        unidad: r.datos.unidad, tarifaPublicada: r.datos.tarifa_publicada, costoCompra: r.datos.costo_compra,
      }))
      const tarifaImpresion = esEstatica && precioM2 ? Math.round((p.ancho_m || 0) * (p.alto_m || 0) * precioM2) : null
      const base: any = {
        nombre: p.nombre, tipoMedio: MAPEO_TIPO[p.tipo_medio] ?? 'OTRO',
        direccion: p.direccion, direccionPredio: p.direccion, direccionComercial: p.direccion,
        plazaCiudad: p.plaza_ciudad, alcaldia: p.plaza_ciudad, ciudad: p.plaza_ciudad,
        lat: p.latitud, lng: p.longitud, ancho: p.ancho_m, alto: p.alto_m, caras: p.caras,
        iluminado: p.iluminacion, exhibicion: p.exhibicion, esRotativo: p.es_rotativo,
        unidad: p.unidad, tipoEstructura: p.tipo_estructura, vista: p.vista, tramo: p.tramo,
        tarifaPublicada: p.tarifa_publicada, costoCompra: p.costo_compra, precioM2, tarifaImpresion,
        spotsPorHora: p.spots_por_hora, duracionSpotSeg: p.duracion_spot_seg ?? (digital ? 20 : null), horario: p.horario,
        totalSpots, spotsDisponibles: totalSpots,
        comercializacion: digital ? 'PROGRAMATICO' : 'TRADICIONAL',
        tipoContenido: digital ? 'VIDEO' : null, notas: p.notas, pendienteVerificacion: p.pendienteVerificacion,
        codigoProveedor: p.codigo_proveedor, modalidadesDetalle,
      }
      // Imagen por código: archivo (sin extensión) = código de proveedor. Solo se
      // asigna si hay match (no borra la imagen existente al actualizar).
      const img = imagenes?.[String(p.codigo_proveedor || '').trim().toLowerCase()]
      if (img) base.imagenPromocional = img
      const conImg = img ? ' +imagen' : ''
      const conAdv = rows.some((r: any) => r.status === 'advertencia')
      const existente = p.codigo_proveedor
        ? (await client.query('select id from sitios where codigo_proveedor=$1', [p.codigo_proveedor])).rows[0]
        : null
      const sufijoMod = rows.length > 1 ? ` (${rows.length} modalidades)` : ''

      if (existente && modoDuplicado === 'ACTUALIZAR') {
        await actualizarSitioCompleto(client, existente.id, base) // UPDATE en sitio (conserva reservas)
        conAdv ? con_advertencias++ : actualizadas++
        detalle.push({ codigo_proveedor: p.codigo_proveedor, status: conAdv ? 'advertencia' : 'actualizado', mensaje: `Actualizado${sufijoMod}${conImg}` })
      } else {
        let codigo = p.codigo_proveedor
        if (existente && modoDuplicado === 'NUEVA_VERSION') {
          let v = 2
          while ((await client.query('select 1 from sitios where codigo_proveedor=$1', [`${p.codigo_proveedor}-v${v}`])).rowCount) v++
          codigo = `${p.codigo_proveedor}-v${v}`
        }
        await insertarSitio(client, { ...base, codigoProveedor: codigo || null })
        conAdv ? con_advertencias++ : creadas++
        detalle.push({ codigo_proveedor: codigo || '(sin código)', status: conAdv ? 'advertencia' : 'creado', mensaje: `Creado${sufijoMod}${conImg}` })
      }
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }

  return { total_filas: filas.length, creadas, actualizadas, con_advertencias, errores, detalle }
}
