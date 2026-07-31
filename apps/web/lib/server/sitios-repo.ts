import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1, fijarTenant } from './db'
import { tenantActual } from './tenant'
import {
  exigirArrendador,
  asignarArrendadorYAbrirContrato,
  resolverPredio,
  ligarSitioAPredio,
  abrirContratoDePredio,
  exigirSitioEnElPredio,
  type PredioDeCarga,
} from './contratos-sitio'
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
    predioId: r.predio_id ?? null,
    arrendadorId: r.arrendador_id ?? null,
    rentaArrendador: n(r.renta_arrendador),
    periodicidadRenta: r.periodicidad_renta ?? null,
    estatusComercial: r.estatus_comercial,
    estatusLegal: r.estatus_legal,
    estatusOperativo: r.estatus_operativo,
    pausaLegal: r.pausa_legal ?? false,
    motivoPausaLegal: r.motivo_pausa_legal ?? null,
    pausaLegalEn: r.pausa_legal_en ? new Date(r.pausa_legal_en).toISOString() : null,
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

// NO incluir aquí pausa_legal / motivo_pausa_legal / pausa_legal_en. Esas tres
// son estado LEGAL, no inventario: las escribe solo arrendadores-repo con UPDATEs
// dirigidos (pausarSitioPorLegal / reanudar). Meterlas en COLS traía dos fallos:
//   1) valoresDe() no emitía sus valores → el insert/update pedía 53 parámetros y
//      recibía 50 ("bind message supplies 50 parameters"), rompiendo el import.
//   2) aun cuadrando el conteo, actualizarSitioCompleto() las sobreescribiría en
//      cada re-importación, LEVANTANDO una pausa legal activa desde un Excel.
// El insert las deja en su default de BD (pausa_legal = false) y el update no las
// toca, que es justo lo que se quiere.

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
    // Regla de negocio (control para DOOHmain): toda pantalla digital nueva tiene
    // SIEMPRE 12 slots (1 slot = 1 campaña), no más. Se fuerza, ignorando el valor
    // de entrada. Las fijas conservan lo que se les pase.
    digital ? 12 : (s.totalSpots ?? null), digital ? 12 : (s.spotsDisponibles ?? null),
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
  const sitios = await q(
    `select s.*,
            (select count(distinct r.campana_id) from reservas r
              where r.sitio_id = s.id and r.estatus <> 'CANCELADA') as campanas_activas
       from sitios s where s.tenant_id = $1 order by s.creado_en asc`,
    [await tenantActual()],
  )
  const mods = await q('select sitio_id, unidad, tarifa_publicada, costo_compra from sitio_modalidades')
  const porSitio = new Map<string, any[]>()
  for (const m of mods) (porSitio.get(m.sitio_id) ?? porSitio.set(m.sitio_id, []).get(m.sitio_id)!).push(m)
  return sitios.map((r) => {
    const base = rowToSitio(r, porSitio.get(r.id) ?? [])
    // Slots de digitales: 1 slot = 1 campaña. Disponibles = total − nº de campañas
    // con reserva activa. Se calcula por conteo (no del contador almacenado, que
    // se desincroniza si una reserva no traía cantidad de spots).
    const digital =
      r.tipo_medio === 'PANTALLA_DIGITAL' || r.es_rotativo || r.exhibicion === 'digital' || r.exhibicion === 'rotativo'
    if (digital && base.totalSpots != null) {
      base.spotsDisponibles = Math.max(0, Number(base.totalSpots) - Number(r.campanas_activas ?? 0))
    }
    return base
  })
}

// Catálogo de RED: todas las pantallas de la plataforma (todos los CRMs). Las
// propias vienen completas; las ajenas marcadas esPropio=false y con los costos
// internos ocultos (costo de compra, impresión, m², tarifa interna, notas). Es
// solo para VER — las operaciones (propuestas/reservas) siguen usando listarSitios
// (solo las propias), así ningún CRM vende pantallas de otro.
export async function listarSitiosRed(): Promise<any[]> {
  const yo = await tenantActual()
  const sitios = await q(
    `select s.*, t.nombre as dueno_tenant, (s.tenant_id = $1) as es_propio
       from sitios s left join tenants t on t.id = s.tenant_id
      order by s.creado_en asc`,
    [yo],
  )
  const mods = await q('select sitio_id, unidad, tarifa_publicada, costo_compra from sitio_modalidades')
  const porSitio = new Map<string, any[]>()
  for (const m of mods) (porSitio.get(m.sitio_id) ?? porSitio.set(m.sitio_id, []).get(m.sitio_id)!).push(m)
  return sitios.map((r) => {
    const propio = !!r.es_propio
    const base = rowToSitio(r, propio ? (porSitio.get(r.id) ?? []) : [])
    if (propio) return { ...base, esPropio: true, duenoTenant: r.dueno_tenant ?? null }
    return {
      ...base,
      esPropio: false,
      duenoTenant: r.dueno_tenant ?? null,
      costoCompra: null,
      tarifaImpresion: null,
      precioM2: null,
      tarifaMensual: null,
      notas: null,
      modalidades: [],
    }
  })
}

export async function getSitio(id: string): Promise<any | null> {
  const r = await q1('select * from sitios where id = $1', [id])
  if (!r) return null
  const mods = await q('select unidad, tarifa_publicada, costo_compra from sitio_modalidades where sitio_id=$1', [id])
  return rowToSitio(r, mods)
}

// ─── Escritura ──────────────────────────────────────────────────────────────
// Exportada para que el alta de "contrato + pantalla" cree el sitio dentro de la
// MISMA transacción del contrato (atómico: o se crean ambos, o ninguno).
export async function insertarSitio(client: PoolClient, s: any): Promise<any> {
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

// Error de negocio al dar de alta un sitio (p. ej. ya es de otro operador).
export class SitioError extends Error {}

// Renta utilizable, o null. Acepta número o cadena numérica (el cuerpo del alta
// no pasa por zod). Descarta 0, negativos, NaN e Infinity: además de violar
// `contrato_monto_ck`, un 0 se leería como «este espacio es gratis» y haría que
// el contrato dejara de aparecer como pendiente con el P&L equivocado.
export function rentaValida(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function crearSitio(s: any): Promise<any> {
  const tenantId = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // ADR 0002: igual que el import, el alta manual exige arrendador y abre su
    // contrato pendiente en la misma transacción.
    const arrendadorId = await exigirArrendador(client, tenantId, s?.arrendadorId)
    const sitio = await insertarSitio(client, s)
    await asignarArrendadorYAbrirContrato(client, {
      tenantId, sitioId: sitio.id, arrendadorId,
      // Renta al arrendador capturada en el alta. Opcional, igual que la columna
      // del import: si no viene, el contrato nace sin importe y queda pendiente.
      // NO se guarda en `sitios.renta_arrendador` —deprecado (M1)— sino en el
      // contrato, que es de donde lo lee todo el mundo.
      //
      // POST /api/sitios NO valida el cuerpo con zod (solo exige `nombre`), así
      // que el valor llega crudo: se coacciona aquí y lo que no sea un número
      // finito y positivo se descarta. `asignarArrendadorYAbrirContrato` lo
      // vuelve a filtrar, y `contrato_monto_ck` es la última red.
      montoRenta: rentaValida(s?.rentaArrendador),
    })
    sitio.arrendadorId = arrendadorId
    await client.query('commit')
    return sitio
  } catch (e: any) {
    await client.query('rollback')
    // 23505 = violación de UNIQUE (codigo_proveedor / clave_interna ya existen).
    // En la red compartida eso significa que la pantalla es de alguien más.
    if (e?.code === '23505') {
      throw new SitioError('Esas pantallas son de alguien más (ese código o clave ya existe en la red).')
    }
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
  tarifaPublicada: 'tarifa_publicada', tarifaMensual: 'tarifa_mensual',
  arrendadorId: 'arrendador_id',
  // `costo_compra` tampoco es editable por esta ruta (ADR 0006). Es el mismo
  // dinero que la renta, y aquí se movía con permiso de Comercial y SIN candado,
  // mientras que cambiar la renta exige el candado ESTRICTO del ADR 0001. Era una
  // puerta lateral para alterar el costo de un espacio. Queda como espejo que
  // solo escriben el alta y la importación; la Fase 2 borra la columna.
  // renta_arrendador / periodicidad_renta NO son editables por esta ruta: están
  // DEPRECADOS (M1) y la fuente de la renta es el contrato del predio. Dejarlos
  // aquí permitía cambiar la renta con permiso de Comercial y sin validación.
  //
  // Sigue siendo así aunque Inventario ya deje editar la renta en línea: esa
  // celda NO pasa por aquí, escribe en el contrato vía PATCH /api/contratos/[id],
  // que exige permiso de `arrendadores` y el guard de cambio sensible. Añadir
  // estas dos columnas de vuelta reabriría el atajo sin ninguna de esas dos
  // comprobaciones.
  precioM2: 'precio_m2', tarifaImpresion: 'tarifa_impresion', resolucionPx: 'resolucion_px',
  tipoContenido: 'tipo_contenido', notas: 'notas', imagenPromocional: 'imagen_promocional',
  fotos: 'fotos',
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

// Empareja imágenes con un sitio por nomenclatura de archivo (sin extensión):
//   • "<codigo>"        → imagen principal
//   • "<codigo>-<N>"    → imagen número N (también acepta "_" o espacio)
// Devuelve las data URLs ordenadas: principal primero, luego por número. Exige
// separador antes del número para no confundir "S-001" con "S-0012".
function imagenesDeSitio(codigo: string, imagenes?: Record<string, string>): string[] {
  const cod = String(codigo || '').trim().toLowerCase()
  if (!cod || !imagenes) return []
  const matches: { n: number; url: string }[] = []
  for (const [key, url] of Object.entries(imagenes)) {
    if (key === cod) { matches.push({ n: 0, url }); continue }
    if (key.startsWith(cod)) {
      const m = key.slice(cod.length).match(/^[-_ ](\d+)$/)
      if (m) matches.push({ n: Number(m[1]), url })
    }
  }
  return matches.sort((a, b) => a.n - b.n).map((x) => x.url)
}

export async function importarSitios(args: {
  filas: any[]
  modoDuplicado: 'ACTUALIZAR' | 'NUEVA_VERSION'
  precioM2: number | null
  // Arrendador dueño de TODAS las pantallas del archivo (ADR 0002). Es de lote y
  // no por fila porque la plantilla no tiene columna de propietario: un Excel se
  // carga por origen, y mezclar propietarios en uno solo no es el caso de uso.
  arrendadorId: string
  // OPCIONAL. Si la carga marca que todas las pantallas están en el mismo predio,
  // se cuelgan de él y comparten UN contrato. Sin predio, cada pantalla es suelta
  // y lleva el suyo.
  predio?: PredioDeCarga | null
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

  const yo = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // Se valida DENTRO de la transacción y con el tenant ya fijado: la RLS
    // fail-closed hace que un arrendador de otra organización sea invisible aquí,
    // así que la comprobación de pertenencia es la propia consulta.
    const arrendadorId = await exigirArrendador(client, yo, args.arrendadorId)
    const predioId = await resolverPredio(client, yo, arrendadorId, args.predio)
    // Pantalla representante del predio: `contratos_arrendamiento.sitio_id` es
    // NOT NULL, así que el contrato del predio guarda una de sus pantallas.
    let primerSitioDelPredio: string | null = null
    // Acumuladores del contrato de predio (ver abrirContratoDePredio más abajo).
    let rentaPredio = 0
    let nuevasEnPredio = 0
    let nuevasSinRenta = 0
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
      const conAdv = rows.some((r: any) => r.status === 'advertencia')
      const existente = p.codigo_proveedor
        ? (await client.query('select id, fotos, imagen_promocional, tenant_id from sitios where codigo_proveedor=$1', [p.codigo_proveedor])).rows[0]
        : null
      // Propiedad: si la pantalla ya existe y es de OTRO operador, no se puede
      // añadir ni sobreescribir — es de alguien más (red compartida con dueño).
      if (existente && existente.tenant_id !== yo) {
        errores++
        detalle.push({
          codigo_proveedor: p.codigo_proveedor,
          status: 'error',
          mensaje: 'Esas pantallas son de alguien más (otro operador ya las registró en la red).',
        })
        continue
      }
      // Imágenes por código (archivo "codigo" o "codigo-N"): van a la galería
      // (fotos) y la 1ª es la principal. Si no llegan imágenes nuevas y el sitio
      // ya existe, se conservan las suyas (no se borran al actualizar).
      const fotosNuevas = imagenesDeSitio(p.codigo_proveedor, imagenes)
      if (fotosNuevas.length) {
        base.fotos = fotosNuevas
        base.imagenPromocional = fotosNuevas[0]
      } else if (existente) {
        base.fotos = existente.fotos ?? []
        base.imagenPromocional = existente.imagen_promocional ?? null
      }
      const conImg = fotosNuevas.length ? ` +${fotosNuevas.length} img` : ''
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
        // ADR 0002: la pantalla nace con su arrendador y su contrato pendiente.
        // Va DENTRO de la misma transacción del import: si el contrato no se
        // puede abrir, la pantalla tampoco entra. Media pantalla —cargada pero
        // sin rastro de a quién se le paga— es justo lo que este cambio evita.
        const nuevo = await insertarSitio(client, { ...base, codigoProveedor: codigo || null })
        if (predioId) {
          // Todas las pantallas del lote van al MISMO predio, así que cada una
          // tiene que estar donde está el predio. Si una viene de otra colonia
          // —un copiar/pegar en el Excel— aborta la carga entera: la
          // transacción revierte y no queda medio lote cargado.
          await exigirSitioEnElPredio(client, {
            tenantId: yo,
            predioId,
            sitio: { lat: p.latitud, lng: p.longitud, direccion: p.direccion, nombre: p.nombre },
          })
          // Un predio, un contrato: aquí solo se cuelga la pantalla. El contrato
          // se abre una vez al terminar el lote.
          await ligarSitioAPredio(client, { tenantId: yo, sitioId: nuevo.id, arrendadorId, predioId })
          primerSitioDelPredio ??= nuevo.id
          // Un predio tiene UN contrato para todas sus caras, así que su renta
          // es la del inmueble entero: se acumula la de cada pantalla del lote.
          // Se lleva también la cuenta de cuántas vinieron SIN importe, porque
          // sumar solo las que sí lo traen daría un total parcial que se leería
          // como el total real y subestimaría el costo (ver abajo).
          if (p.renta_arrendador != null && p.renta_arrendador > 0) rentaPredio += p.renta_arrendador
          else nuevasSinRenta++
          nuevasEnPredio++
        } else {
          await asignarArrendadorYAbrirContrato(client, {
            tenantId: yo, sitioId: nuevo.id, arrendadorId,
            // Columna `renta_arrendador` del Excel. Una pantalla suelta tiene su
            // propio contrato, así que su renta va tal cual, sin ambigüedad.
            montoRenta: p.renta_arrendador ?? null,
          })
        }
        conAdv ? con_advertencias++ : creadas++
        detalle.push({ codigo_proveedor: codigo || '(sin código)', status: conAdv ? 'advertencia' : 'creado', mensaje: `Creado${sufijoMod}${conImg}` })
      }
    }
    // El contrato del predio, UNO para todo el lote. Si el predio ya tenía
    // contrato (lo comprueba abrirContratoDePredio) no se abre otro, y si la
    // carga no creó ninguna pantalla nueva no hay representante que anclar.
    if (predioId && primerSitioDelPredio) {
      await abrirContratoDePredio(client, {
        tenantId: yo, predioId, arrendadorId, sitioId: primerSitioDelPredio,
        // Solo se fija el importe si TODAS las pantallas nuevas del lote lo
        // trajeron. Con una sola sin renta, la suma sería un total parcial —y un
        // total parcial es peor que ninguno: se leería como la renta completa del
        // predio y subestimaría el costo en silencio, que es exactamente el modo
        // de fallo que el ADR 0001 persigue. Si falta alguna, el contrato queda
        // pendiente de captura, como hasta ahora.
        montoRenta: nuevasEnPredio > 0 && nuevasSinRenta === 0 ? rentaPredio : null,
      })
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
