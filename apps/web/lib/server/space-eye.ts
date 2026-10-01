import 'server-only'

// ============================================================================
//  lib/server/space-eye.ts — Cliente de la API de Space Eye (verificación de
//  espectaculares por cámaras Android + IA). REST + JWT.
//
//  Space Eye es la "visión de inteligencia artificial" de las pantallas: cada
//  espectacular tiene un teléfono que captura fotos y las verifica contra la
//  creatividad. Aquí lo consumimos server-to-server para mostrar, en la ficha de
//  la pantalla, la cámara real (foto, estado del dispositivo y dictamen IA) en
//  vez de una imagen de demostración.
//
//  El enlace pantalla↔cámara es por código: sitios.codigo_proveedor == device.
//  billboard_code. Credenciales SOLO por env (nunca al cliente).
// ============================================================================

const BASE = process.env.SPACE_EYE_BASE_URL ?? ''

// Llave de servicio de ESTA instancia. Sustituye al usuario/contraseña con el
// que se entraba antes, y no es un detalle de forma: esa cuenta era la de
// administración de Space Eye y veía la flota COMPLETA, o sea las cámaras de
// todos los clientes. La llave solo alcanza los equipos de su dueño, así que el
// aislamiento entre instancias lo hace el servidor y no la suerte de que los
// códigos de sitio no se repitan.
//
// No caduca, es de solo lectura y se revoca desde Space Eye. Por eso se fue
// tambien todo el manejo de token: no hay login, ni caché, ni reintento por 401.
const KEY = process.env.SPACE_EYE_KEY ?? ''

// La integración está activa solo si hay URL y llave configuradas.
export function spaceEyeHabilitado(): boolean {
  return !!(BASE && KEY)
}

// GET autenticado con la llave de la instancia.
async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`Space Eye: ${path} → ${r.status}`)
  return (await r.json()) as T
}

// ─── Tipos de respuesta que exponemos a la app ──────────────────────────────
export interface VisionDispositivo {
  nombre: string
  online: boolean
  bateriaPct: number | null
  senalDbm: number | null
  ultimaConexion: string | null
  modelo: string | null
  estatus: string | null
}
export interface VisionFoto {
  url: string
  tomadaEn: string | null
  ancho: number | null
  alto: number | null
  verificacionEstatus: string | null // pending | verified | ...
  esCorrecta: boolean | null
  score: number | null
  gps: { lat: number; lng: number } | null
}
export interface VisionSitio {
  disponible: boolean
  // Motivo cuando no hay cámara/datos: 'no_configurado' | 'sin_camara'
  motivo?: string
  dispositivo?: VisionDispositivo
  foto?: VisionFoto | null
}

interface SEDevice {
  id: number
  name: string
  billboard_code: string | null
  online: number | boolean
  battery_pct: number | null
  signal_dbm: number | null
  last_seen_at: string | null
  model: string | null
  status: string | null
}
interface SEPhoto {
  device_id: number
  storage_path: string
  taken_at: string | null
  width: number | null
  height: number | null
  gps_lat: number | null
  gps_lng: number | null
  verification_status: string | null
  is_correct: boolean | null
  verification_score: number | null
}

// Devuelve la visión (cámara + IA) de la pantalla cuyo código de proveedor
// coincide con el billboard_code de un dispositivo Space Eye.
export async function visionDeCodigo(codigoProveedor: string | null | undefined): Promise<VisionSitio> {
  if (!spaceEyeHabilitado()) return { disponible: false, motivo: 'no_configurado' }
  const codigo = (codigoProveedor ?? '').trim().toLowerCase()
  if (!codigo) return { disponible: false, motivo: 'sin_camara' }

  const { devices } = await api<{ devices: SEDevice[] }>('/api/devices')
  const dev = devices.find((d) => (d.billboard_code ?? '').trim().toLowerCase() === codigo)
  if (!dev) return { disponible: false, motivo: 'sin_camara' }

  // Última foto de ese dispositivo (la más reciente). El parámetro es
  // `device_id`: con `device` el backend lo ignoraba y devolvía las fotos de la
  // flota entera, y lo único que salvaba la situación era el filtro de abajo.
  // Se deja el filtro igual, como red.
  let foto: SEPhoto | undefined
  try {
    const { photos } = await api<{ photos: SEPhoto[] }>(`/api/photos?device_id=${dev.id}&limit=5`)
    foto = photos.filter((p) => p.device_id === dev.id)[0]
  } catch {
    /* si falla la foto, igual devolvemos el estado del dispositivo */
  }

  return {
    disponible: true,
    dispositivo: {
      nombre: dev.name,
      online: !!dev.online,
      bateriaPct: dev.battery_pct ?? null,
      senalDbm: dev.signal_dbm ?? null,
      ultimaConexion: dev.last_seen_at ?? null,
      modelo: dev.model ?? null,
      estatus: dev.status ?? null,
    },
    foto: foto
      ? {
          // Por el proxy, igual que el módulo: esta sección ya existía y tenía
          // el mismo fallo esperando en producción —una página HTTPS no carga
          // una imagen HTTP—, solo que nadie lo había visto porque nunca se
          // desplegó.
          url: urlDeFoto(foto.storage_path),
          tomadaEn: foto.taken_at,
          ancho: foto.width,
          alto: foto.height,
          verificacionEstatus: foto.verification_status,
          esCorrecta: foto.is_correct,
          score: foto.verification_score != null ? Number(foto.verification_score) : null,
          gps: foto.gps_lat != null && foto.gps_lng != null ? { lat: foto.gps_lat, lng: foto.gps_lng } : null,
        }
      : null,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  EL MÓDULO Space Eyes — la flota, no una pantalla
// ----------------------------------------------------------------------------
//  Lo de arriba responde una pregunta concreta: «de esta pantalla, ¿qué ve su
//  cámara?». Lo de abajo es el módulo del menú, que empieza por la otra punta:
//  todos los equipos de la instancia, y de ahí a uno.
//
//  Todo sale de la MISMA llave de servicio, así que el alcance no se decide
//  aquí: el servidor de Space Eye solo entrega los equipos de su dueño. Esta
//  parte no puede ampliar lo que se ve, solo presentarlo.
// ════════════════════════════════════════════════════════════════════════════

export interface SEEquipoResumen {
  id: number
  nombre: string
  codigoPantalla: string | null
  empresa: string | null
  modelo: string | null
  online: boolean
  bateriaPct: number | null
  senalDbm: number | null
  redTipo: string | null
  ultimaConexion: string | null
  estatus: string | null
  ultimaFoto: { url: string; tomadaEn: string | null } | null
}

export interface SEEquipoDetalle extends SEEquipoResumen {
  uid: string | null
  versionApp: string | null
  fabricante: string | null
  direccion: string | null
  bateriaTemp: number | null
  equipoTemp: number | null
  redOperador: string | null
  cargando: boolean | null
  almacenamientoLibreMb: number | null
  datos: { movilMes: number | null; wifiMes: number | null } | null
  fotos: SEFotoModulo[]
}

export interface SEFotoModulo {
  url: string
  tomadaEn: string | null
  ancho: number | null
  alto: number | null
  origen: string | null
  verificacionEstatus: string | null
  esCorrecta: boolean | null
  score: number | null
  gps: { lat: number; lng: number } | null
}

interface SEDeviceFila extends SEDevice {
  owner?: string | null
  device_uid?: string | null
  app_version?: string | null
  manufacturer?: string | null
  address?: string | null
  network_type?: string | null
}

// ─── Las fotos se sirven POR NOSOTROS, no por Space Eye ────────────────────
//
// Esta aplicación va por HTTPS y Space Eye puede ir por HTTP: un navegador NO
// carga una imagen http dentro de una página https, la bloquea sin avisar. Así
// que lo que viaja al cliente es SIEMPRE una ruta nuestra, y el proxy
// (`/api/space-eyes/foto`) trae los bytes por detrás. Ver el comentario de esa
// ruta para el porqué completo.
//
// Se guarda solo el camino (`/storage/...` con su firma), nunca la dirección de
// Space Eye: el navegador no tiene por qué aprenderla.
export function urlDeFoto(storagePath: string): string {
  return `/spaces-dooh/api/space-eyes/foto/?p=${encodeURIComponent(storagePath)}`
}

/** La dirección real, que solo se usa del lado del servidor. */
export function urlAbsolutaDeFoto(storagePath: string): string {
  return `${BASE}${storagePath}`
}

function resumen(d: SEDeviceFila, foto?: SEPhoto): SEEquipoResumen {
  return {
    id: d.id,
    nombre: d.name,
    codigoPantalla: d.billboard_code ?? null,
    empresa: d.owner ?? null,
    modelo: d.model ?? null,
    online: !!d.online,
    bateriaPct: d.battery_pct ?? null,
    senalDbm: d.signal_dbm ?? null,
    redTipo: d.network_type ?? null,
    ultimaConexion: d.last_seen_at ?? null,
    estatus: d.status ?? null,
    ultimaFoto: foto ? { url: urlDeFoto(foto.storage_path), tomadaEn: foto.taken_at } : null,
  }
}

/**
 * Los equipos de la instancia, con su última captura.
 *
 * Dos llamadas y no una por equipo: `/api/photos` devuelve las últimas fotos de
 * la flota YA ordenadas, así que se agrupan por equipo y cada uno se queda con
 * la primera. Con una llamada por equipo, veinte cámaras serían veintiún viajes
 * al tercero cada vez que alguien abre el menú.
 */
export async function listarEquipos(): Promise<SEEquipoResumen[]> {
  if (!spaceEyeHabilitado()) return []
  const { devices } = await api<{ devices: SEDeviceFila[] }>('/api/devices')

  // Si falla, la lista se pinta igual: sin miniatura, pero con el estado de cada
  // equipo, que es lo que de verdad se viene a ver.
  let ultimas = new Map<number, SEPhoto>()
  try {
    const { photos } = await api<{ photos: SEPhoto[] }>('/api/photos?limit=60')
    for (const p of photos) if (!ultimas.has(p.device_id)) ultimas.set(p.device_id, p)
  } catch {
    ultimas = new Map()
  }

  return devices.map((d) => resumen(d, ultimas.get(d.id)))
}

/** Un equipo con todo lo que la ficha enseña, incluidas sus últimas fotos. */
export async function equipoDetalle(id: number): Promise<SEEquipoDetalle | null> {
  if (!spaceEyeHabilitado()) return null

  let d: { device: SEDeviceFila; latest_status: any; data_usage: any }
  try {
    d = await api<{ device: SEDeviceFila; latest_status: any; data_usage: any }>(`/api/devices/${id}`)
  } catch {
    // Un equipo de otro dueño contesta 404 igual que uno que no existe, y así se
    // trata aquí: la ficha dice «no encontrado», nunca «no es tuyo».
    return null
  }

  let fotos: SEPhoto[] = []
  try {
    const r = await api<{ photos: SEPhoto[] }>(`/api/photos?device_id=${id}&limit=24`)
    fotos = r.photos.filter((p) => p.device_id === id)
  } catch {
    fotos = []
  }

  const s = d.latest_status ?? {}
  const u = d.data_usage ?? null
  return {
    ...resumen(d.device, fotos[0]),
    // El estado más reciente es más fresco que el resumen de la lista.
    bateriaPct: s.battery_pct ?? d.device.battery_pct ?? null,
    senalDbm: s.signal_dbm ?? d.device.signal_dbm ?? null,
    redTipo: s.network_type ?? d.device.network_type ?? null,
    uid: d.device.device_uid ?? null,
    versionApp: d.device.app_version ?? null,
    fabricante: d.device.manufacturer ?? null,
    direccion: d.device.address ?? null,
    bateriaTemp: s.battery_temp ?? null,
    equipoTemp: s.cpu_temp ?? null,
    redOperador: s.network_operator ?? null,
    cargando: s.battery_charging == null ? null : !!s.battery_charging,
    almacenamientoLibreMb: s.storage_free_mb ?? null,
    datos: u ? { movilMes: u.data_mobile_month ?? null, wifiMes: u.data_wifi_month ?? null } : null,
    fotos: fotos.map((p) => ({
      url: urlDeFoto(p.storage_path),
      tomadaEn: p.taken_at,
      ancho: p.width,
      alto: p.height,
      origen: (p as any).source ?? null,
      verificacionEstatus: p.verification_status,
      esCorrecta: p.is_correct,
      score: p.verification_score != null ? Number(p.verification_score) : null,
      gps: p.gps_lat != null && p.gps_lng != null ? { lat: p.gps_lat, lng: p.gps_lng } : null,
    })),
  }
}

/**
 * Pedirle una foto AHORA a un equipo.
 *
 * Es lo ÚNICO que esta integración escribe, y va por una ruta propia de Space
 * Eye (`/api/eyes/devices/:id/captura`) que solo sabe hacer eso: el tipo de
 * orden no es un parámetro, así que desde aquí no se puede reiniciar un equipo,
 * abrirle la transmisión ni cambiarle la configuración aunque alguien lo
 * intente. La llave necesita la marca de escritura, y esa marca no alcanza
 * ninguna otra ruta.
 *
 * `en_linea: false` no es un error: la orden queda encolada y el equipo la
 * recoge cuando vuelva. La interfaz lo dice en vez de fingir que viene en
 * camino.
 */
export async function pedirCaptura(id: number): Promise<{ orden: number; enLinea: boolean }> {
  if (!spaceEyeHabilitado()) throw new Error('Space Eye no está configurado')
  const r = await fetch(`${BASE}/api/eyes/devices/${id}/captura`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}` },
  })
  if (!r.ok) throw new Error(`Space Eye: no se pudo pedir la foto (${r.status})`)
  const d = (await r.json()) as { orden: number; en_linea: boolean }
  return { orden: d.orden, enLinea: !!d.en_linea }
}

export interface SEPuntoTelemetria {
  bucket: string
  samples: number
  battery_pct: number | null
  signal_dbm: number | null
  battery_temp: number | null
  cpu_temp: number | null
}
export interface SEAlertaTelemetria {
  level: 'critical' | 'warning' | string
  type: string
  message: string
  value: number | null
}
export interface SETelemetria {
  desde: string
  hasta: string
  muestras: number
  bateriaMin: number | null
  senalMin: number | null
  alertas: SEAlertaTelemetria[]
  serie: SEPuntoTelemetria[]
}

/**
 * Histórico del equipo, por hora: batería, señal y temperaturas.
 *
 * Por hora y no crudo a propósito: el equipo reporta cada ~60 s, así que una
 * semana cruda son diez mil puntos para dibujar una línea de 300 píxeles. El
 * servidor ya sabe promediar por hora, y de paso el mínimo de cada hora —que es
 * el dato que importa: una batería que TOCÓ el 8% a las 4 de la mañana no se ve
 * en un promedio.
 */
export async function telemetriaDeEquipo(id: number, horas = 24): Promise<SETelemetria | null> {
  if (!spaceEyeHabilitado()) return null
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  const q = new URLSearchParams({ granularity: 'hour', from: desde })
  try {
    const d = await api<{
      range: { from: string; to: string }
      summary: Record<string, unknown>
      alerts: SEAlertaTelemetria[]
      series: Record<string, unknown>[]
    }>(`/api/devices/${id}/telemetry?${q.toString()}`)

    const num = (v: unknown) => (v == null ? null : Number(v))
    return {
      desde: d.range.from,
      hasta: d.range.to,
      muestras: Number(d.summary?.samples ?? 0),
      // El PEOR valor del rango, no el promedio: es lo que decide si hay que ir
      // al sitio.
      bateriaMin: num(d.summary?.battery_pct_min),
      senalMin: num(d.summary?.signal_dbm_min),
      alertas: d.alerts ?? [],
      serie: (d.series ?? []).map((p) => ({
        bucket: String(p.bucket ?? ''),
        samples: Number(p.samples ?? 0),
        // En las series por hora se toma el MÍNIMO de batería y señal por el
        // mismo motivo, y si el servidor no lo manda se cae al promedio.
        battery_pct: num(p.battery_pct_min ?? p.battery_pct),
        signal_dbm: num(p.signal_dbm_min ?? p.signal_dbm),
        battery_temp: num(p.battery_temp_max ?? p.battery_temp),
        cpu_temp: num(p.cpu_temp_max ?? p.cpu_temp),
      })),
    }
  } catch {
    // El histórico es información secundaria: si no llega, la ficha se pinta
    // igual y la tarjeta lo dice. No puede tumbar la pantalla.
    return null
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ALTA DE UN EQUIPO NUEVO, desde aquí
// ----------------------------------------------------------------------------
//  Un equipo se da de alta SOLO: se instala el agente, arranca, se registra y
//  aparece en la lista. Lo que esta pantalla tiene que resolver son las dos
//  cosas que no se resuelven solas: de dónde se baja el instalador de cada tipo
//  de equipo, y con qué credencial nace asignado a esta empresa.
//
//  EL TESTIGO DE ALTA VIENE DEL ENTORNO, no se pide al vuelo. Es una credencial
//  de despliegue, igual que `SPACE_EYE_KEY`: se crea una vez en Space Eye para
//  esta instancia y se pone aquí. La alternativa —que la instancia pudiera
//  FABRICAR testigos por su cuenta— convertiría una llave de solo lectura en
//  una fábrica de credenciales, que es exactamente lo que la separación entre
//  «llave de lectura» y «testigo de alta» existe para impedir.
//
//  Un testigo NO lee nada: solo sirve para que un equipo nuevo diga de quién es.
// ════════════════════════════════════════════════════════════════════════════

const TESTIGO = process.env.SPACE_EYE_PROVISION_TOKEN ?? ''

export interface SEDescarga {
  url: string
  version: string | null
  bytes: number | null
  publicado: string | null
  sha256: string | null
}
export interface SEInfoAlta {
  // Solo el prefijo del testigo viaja por omisión: es lo que se puede enseñar
  // en pantalla sin repartir la credencial.
  testigo: { hay: boolean; prefijo: string }
  empresa: string | null
  servidor: string
  apk: SEDescarga | null
  agentePc: SEDescarga | null
  agentePi: SEDescarga | null
}

/** Los manifiestos son públicos (los sirve el mismo servidor, sin sesión). */
async function manifiesto(archivo: string, descarga: string): Promise<SEDescarga | null> {
  try {
    const r = await fetch(`${BASE}/${archivo}`, { cache: 'no-store' })
    if (!r.ok) return null
    const d = (await r.json()) as Record<string, unknown>
    return {
      url: `${BASE}/${descarga}`,
      version: d.version != null ? String(d.version) : null,
      bytes: d.bytes != null ? Number(d.bytes) : null,
      publicado: d.publicado != null ? String(d.publicado) : null,
      sha256: d.sha256 != null ? String(d.sha256) : null,
    }
  } catch {
    return null
  }
}

export async function infoDeAlta(): Promise<SEInfoAlta> {
  // De quién son los equipos de esta instancia. Se saca de los que ya hay en
  // vez de escribirlo en otra variable de entorno: una segunda fuente para el
  // mismo dato es una segunda fuente que se puede contradecir.
  let empresa: string | null = null
  try {
    const { devices } = await api<{ devices: { owner?: string | null }[] }>('/api/devices')
    empresa = devices.find((d) => d.owner)?.owner ?? null
  } catch {
    empresa = null
  }

  const [apk, agentePc, agentePi] = await Promise.all([
    manifiesto('space-eye.json', 'space-eye.apk'),
    manifiesto('space-eye-agente.json', 'SpaceEyeAgente.exe'),
    manifiesto('space-eye-pi-agent.json', 'space-eye-pi-agent.tar.gz'),
  ])

  return {
    testigo: { hay: Boolean(TESTIGO), prefijo: TESTIGO ? TESTIGO.slice(0, 15) : '' },
    empresa,
    servidor: BASE,
    apk,
    agentePc,
    agentePi,
  }
}

/** El testigo completo. Se entrega aparte y solo a quien puede dar de alta. */
export function testigoCompleto(): string {
  return TESTIGO
}

// ─── Fallas de pantalla y creativos detectados ──────────────────────────────
//
// Lo que el propio equipo descubre mirando su pantalla (APK 0.15 en adelante):
// gabinetes apagados o congelados, pantalla apagada en horario, camara movida, y
// los anuncios distintos que han pasado por ella. Space Eye comprueba el dueño
// con la llave y contesta 404 por un equipo ajeno; aqui ese 404 es "no hay".

/** Como api(), pero un 404 (equipo ajeno o inexistente) devuelve null. */
async function apiOpcional<T>(path: string): Promise<T | null> {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Space Eye: ${path} → ${r.status}`)
  return (await r.json()) as T
}

export interface SEFalla {
  id: number
  tipo: string
  /** Como la nombra Space Eye: «Gabinete apagado», «Pantalla congelada»... */
  nombre: string
  estado: 'abierta' | 'recuperada' | 'descartada'
  /** Dónde, en palabras: «Gabinete 9 (fila 2, columna 3)», «Gabinetes 2, 5, 8 (3 de 15)», «Toda la pantalla». */
  donde: string
  confianza: number
  detectadaEn: string
  recuperadaEn: string | null
  /** 'equipo' si se cerró sola al recuperarse; 'usuario' si alguien la cerró a mano. */
  cerradaPor: string | null
  nota: string | null
  /** Ya por el proxy de fotos de esta aplicación. */
  evidencia: string | null
  evidenciaMini: string | null
  evidenciaRecuperacion: string | null
}

export interface SEPantallaEquipo {
  /** El equipo vigila su pantalla (el dueño lo enciende en Space Eye). */
  vigilando: boolean
  /** Todavía aprende cómo se ve normalmente: no avisa de fallas. */
  aprendiendo: boolean
  /** Cuántos gabinetes tiene la pantalla marcada, o null si no se ha marcado. */
  gabinetes: number | null
  horario: { inicio: string; fin: string } | null
  /** Cuándo revisó por última vez y qué concluyó. */
  ultimaRevision: { cuando: string; pantalla: string } | null
  fallas: SEFalla[]
}

function dondeDeFalla(f: { fila: number | null; columna: number | null; gabinete: number | null; detalle: any }): string {
  const lista: number[] = Array.isArray(f.detalle?.gabinetes) ? f.detalle.gabinetes : []
  if (lista.length) {
    const total = Number(f.detalle?.total) || null
    const muestra = lista.slice(0, 12).join(', ') + (lista.length > 12 ? '…' : '')
    return `Gabinetes ${muestra}${total ? ` (${lista.length} de ${total})` : ''}`
  }
  if (f.gabinete != null && f.fila != null && f.columna != null) {
    return `Gabinete ${f.gabinete} (fila ${f.fila + 1}, columna ${f.columna + 1})`
  }
  return 'Toda la pantalla'
}

export async function pantallaDeEquipo(id: number): Promise<SEPantallaEquipo | null> {
  if (!spaceEyeHabilitado()) return null
  const d = await apiOpcional<{
    pantalla: { filas: number; columnas: number; horario?: { inicio: string; fin: string } } | null
    salud: { vigilar: boolean; aprendiendo: boolean } | null
    ultimo: { ts?: number; pantalla?: string } | null
    fallas: Record<string, any>[]
  }>(`/api/devices/${id}/pantalla`)
  if (!d) return null
  const foto = (p: unknown) => (typeof p === 'string' && p ? urlDeFoto(p) : null)
  return {
    vigilando: !!d.salud?.vigilar,
    aprendiendo: !!d.salud?.aprendiendo,
    gabinetes: d.pantalla ? d.pantalla.filas * d.pantalla.columnas : null,
    horario: d.pantalla ? { inicio: d.pantalla.horario?.inicio ?? '06:00', fin: d.pantalla.horario?.fin ?? '24:00' } : null,
    ultimaRevision: d.ultimo?.ts ? { cuando: new Date(d.ultimo.ts).toISOString(), pantalla: String(d.ultimo.pantalla ?? '') } : null,
    fallas: (d.fallas ?? []).map((f) => ({
      id: Number(f.id),
      tipo: String(f.tipo),
      nombre: String(f.nombre ?? f.tipo),
      estado: f.estado,
      donde: dondeDeFalla(f as any),
      confianza: Number(f.confianza ?? 0),
      detectadaEn: String(f.detectada_en),
      recuperadaEn: f.recuperada_en ? String(f.recuperada_en) : null,
      cerradaPor: f.cerrada_por ?? null,
      nota: f.nota ?? null,
      evidencia: foto(f.evidencia),
      evidenciaMini: foto(f.evidencia_mini ?? f.evidencia),
      evidenciaRecuperacion: foto(f.evidencia_recuperacion),
    })),
  }
}

export interface SECreativo {
  id: string
  primeraVez: string
  ultimaVez: string
  /** Cuántas veces lo ha reconocido en su pantalla. */
  vistas: number
  foto: string | null
}

export interface SECreativosEquipo {
  vigilando: boolean
  aprendiendo: boolean
  /** Fotos de creativos nuevos subidas hoy, y el tope por día. */
  fotosHoy: number
  maxDia: number
  /** Con foto, del más reciente al más viejo. */
  creativos: SECreativo[]
}

export async function creativosDeEquipo(id: number): Promise<SECreativosEquipo | null> {
  if (!spaceEyeHabilitado()) return null
  const d = await apiOpcional<{
    config: { vigilar: boolean; aprendiendo: boolean; max_dia: number } | null
    fotos_hoy: number
    creativos: Record<string, any>[]
  }>(`/api/devices/${id}/creativos`)
  if (!d) return null
  return {
    vigilando: !!d.config?.vigilar,
    aprendiendo: !!d.config?.aprendiendo,
    fotosHoy: Number(d.fotos_hoy ?? 0),
    maxDia: Number(d.config?.max_dia ?? 0),
    creativos: (d.creativos ?? [])
      .filter((c) => c.thumbnail_path || c.storage_path)
      .map((c) => ({
        id: String(c.id),
        primeraVez: String(c.primera_vez),
        ultimaVez: String(c.ultima_vez),
        vistas: Number(c.vistas ?? 0),
        foto: urlDeFoto(String(c.thumbnail_path || c.storage_path)),
      })),
  }
}

// ─── La puerta del módulo completo (ADR 0041) ───────────────────────────────

/**
 * Reenvía una petición del navegador a Space Eye con la llave de la instancia.
 * Lo usa /api/space-eyes/se/[...ruta], que ya comprobó el permiso y la lista de
 * rutas. Se reenvía el cuerpo tal cual (JSON o un formulario con archivo, como
 * la creatividad de una campaña) y la consulta; se devuelve la respuesta tal
 * cual, incluido un CSV de exportación.
 */
export async function reenviarASpaceEye(req: Request, camino: string): Promise<Response> {
  const url = new URL(req.url)
  const destino = `${BASE}/api/${camino}${url.search}`
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${KEY}` }
  const tipo = req.headers.get('content-type')
  if (tipo) cabeceras['Content-Type'] = tipo
  const conCuerpo = req.method !== 'GET' && req.method !== 'HEAD'
  const r = await fetch(destino, {
    method: req.method,
    headers: cabeceras,
    body: conCuerpo ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  })
  const salida = new Headers()
  for (const h of ['content-type', 'content-disposition']) {
    const v = r.headers.get(h)
    if (v) salida.set(h, v)
  }
  salida.set('Cache-Control', 'no-store')
  return new Response(r.body, { status: r.status, headers: salida })
}
