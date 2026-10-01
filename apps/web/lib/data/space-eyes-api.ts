'use client'

// ============================================================================
//  lib/data/space-eyes-api.ts — El módulo Space Eyes: la flota y su ficha.
//
//  Consume el BFF /api/space-eyes; el servidor habla con Space Eye y la llave
//  nunca sale de ahí. Su hermano `space-eye-api.ts` responde otra pregunta —la
//  cámara de UNA pantalla, dentro de la ficha comercial— y se conserva tal cual:
//  las dos pantallas leen lo mismo por caminos distintos y ninguna sustituye a
//  la otra.
//
//  Las rutas llevan barra final: basePath /spaces-dooh + trailingSlash.
// ============================================================================

const API = '/spaces-dooh/api/space-eyes'

export interface EquipoResumen {
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
  pantalla: { id: string; nombre: string } | null
}

export interface FotoEquipo {
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

export interface EquipoDetalle extends Omit<EquipoResumen, 'pantalla'> {
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
  fotos: FotoEquipo[]
}

export interface FichaEquipoDatos {
  equipo: EquipoDetalle
  pantalla: { id: string; nombre: string; fotoCliente: string | null } | null
}

async function leer<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo hablar con Space Eyes')
  }
  return r.json() as Promise<T>
}

export function listarEquiposApi(): Promise<{ disponible: boolean; motivo?: string; equipos: EquipoResumen[] }> {
  return leer(`${API}/`, { cache: 'no-store' })
}

export function equipoApi(id: number): Promise<FichaEquipoDatos> {
  return leer(`${API}/${id}/`, { cache: 'no-store' })
}

/** Pide una foto AHORA. `enLinea: false` no es un fallo: la orden queda encolada. */
export function pedirCapturaApi(id: number): Promise<{ orden: number; enLinea: boolean; mensaje: string }> {
  return leer(`${API}/${id}/captura/`, { method: 'POST' })
}

export interface PuntoTelemetria {
  bucket: string
  samples: number
  battery_pct: number | null
  signal_dbm: number | null
  battery_temp: number | null
  cpu_temp: number | null
}
export interface AlertaTelemetria {
  level: string
  type: string
  message: string
  value: number | null
}
export interface Telemetria {
  disponible: boolean
  horas: number
  muestras?: number
  bateriaMin?: number | null
  senalMin?: number | null
  alertas?: AlertaTelemetria[]
  serie?: PuntoTelemetria[]
}

/** Histórico por hora. Se pide solo al abrir la tarjeta, no al pintar la ficha. */
export function telemetriaApi(id: number, horas: 24 | 168 | 720 = 24): Promise<Telemetria> {
  return leer(`${API}/${id}/telemetria/?horas=${horas}`, { cache: 'no-store' })
}

export interface Descarga {
  url: string
  version: string | null
  bytes: number | null
  publicado: string | null
  sha256: string | null
}
export interface InfoAlta {
  testigo: { hay: boolean; prefijo: string }
  empresa: string | null
  servidor: string
  apk: Descarga | null
  agentePc: Descarga | null
  agentePi: Descarga | null
  testigoCompleto?: string
}

/** Lo que hace falta para dar de alta un equipo: instaladores y testigo. */
export function infoAltaApi(): Promise<InfoAlta> {
  return leer(`${API}/alta/`, { cache: 'no-store' })
}

/**
 * El testigo COMPLETO. Va en una llamada aparte y con un clic de por medio: si
 * viajara al cargar la pantalla quedaría en el historial, en cualquier captura
 * y en la consola de red de quien pase por ahí.
 */
export function testigoDeAltaApi(): Promise<InfoAlta> {
  return leer(`${API}/alta/?testigo=1`, { cache: 'no-store' })
}

// ─── Fallas de pantalla y creativos detectados ──────────────────────────────

export interface Falla {
  id: number
  tipo: string
  nombre: string
  estado: 'abierta' | 'recuperada' | 'descartada'
  donde: string
  confianza: number
  detectadaEn: string
  recuperadaEn: string | null
  cerradaPor: string | null
  nota: string | null
  evidencia: string | null
  evidenciaMini: string | null
  evidenciaRecuperacion: string | null
}

export interface PantallaEquipo {
  disponible: boolean
  vigilando?: boolean
  aprendiendo?: boolean
  gabinetes?: number | null
  horario?: { inicio: string; fin: string } | null
  ultimaRevision?: { cuando: string; pantalla: string } | null
  fallas?: Falla[]
}

export interface Creativo {
  id: string
  primeraVez: string
  ultimaVez: string
  vistas: number
  foto: string | null
}

export interface CreativosEquipo {
  disponible: boolean
  vigilando?: boolean
  aprendiendo?: boolean
  fotosHoy?: number
  maxDia?: number
  creativos?: Creativo[]
}

/** Lo que el equipo detecto mal en su pantalla, y su historial. */
export function fallasApi(id: number): Promise<PantallaEquipo> {
  return leer(`${API}/${id}/fallas/`, { cache: 'no-store' })
}

/** Los anuncios distintos que han pasado por la pantalla del equipo. */
export function creativosApi(id: number): Promise<CreativosEquipo> {
  return leer(`${API}/${id}/creativos/`, { cache: 'no-store' })
}
