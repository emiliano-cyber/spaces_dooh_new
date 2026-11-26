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

import { traducir } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { seApi } from '@/lib/data/space-eyes-se'

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
  ultimaFoto: { url: string; miniatura: string; tomadaEn: string | null; giro: number } | null
  pantalla: { id: string; nombre: string } | null
  /** Si se actualiza sin que nadie toque el equipo (lib/space-eyes-actualizacion). */
  actualizacion?: { sola: boolean; texto: string; tono: 'ok' | 'aviso' | 'visita' }
  /**
   * La falla ABIERTA mas antigua del equipo, o null. Se queda a la vista hasta
   * que la falla se recupera: el correo avisa UNA vez -y de madrugada no lo lee
   * nadie-, asi que sin esto una pantalla podia pasar la noche caida y la lista
   * seguia enseñandola igual que a las demas.
   */
  falla?: { id: number; nombre: string; donde: string; desde: string; cuantas: number } | null
}

export interface FotoEquipo {
  url: string
  tomadaEn: string | null
  ancho: number | null
  alto: number | null
  origen: string | null
  /** El nombre de la campaña cuando `origen` es 'campana'; si no, null. */
  campana: string | null
  verificacionEstatus: string | null
  esCorrecta: boolean | null
  score: number | null
  gps: { lat: number; lng: number } | null
  /** Grados (0/90/180/270) para verla derecha. */
  giro: number
  /** La miniatura de 400 px: lo que se pinta primero y en las tiras de recientes. */
  miniatura: string
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

// El error que manda el servidor es un dato y va tal cual; el respaldo, cuando
// no manda ninguno, se dice en `idioma`. `'es'` por omision, como
// `textoDeError` de `space-eyes-se.ts` (validacion de Space Eyes, costura 2).
async function leer<T>(url: string, init: RequestInit | undefined, idioma: Idioma): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? traducir(idioma, 'spaceeyes.comun.sin-hablar'))
  }
  return r.json() as Promise<T>
}

export function listarEquiposApi(idioma: Idioma = 'es'): Promise<{ disponible: boolean; motivo?: string; equipos: EquipoResumen[] }> {
  return leer(`${API}/`, { cache: 'no-store' }, idioma)
}

export function equipoApi(id: number, idioma: Idioma = 'es'): Promise<FichaEquipoDatos> {
  return leer(`${API}/${id}/`, { cache: 'no-store' }, idioma)
}

/** Pide una foto AHORA. `enLinea: false` no es un fallo: la orden queda encolada. */
export function pedirCapturaApi(id: number, idioma: Idioma = 'es'): Promise<{ orden: number; enLinea: boolean; mensaje: string }> {
  return leer(`${API}/${id}/captura/`, { method: 'POST' }, idioma)
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
export function telemetriaApi(id: number, horas: 24 | 168 | 720 = 24, idioma: Idioma = 'es'): Promise<Telemetria> {
  return leer(`${API}/${id}/telemetria/?horas=${horas}`, { cache: 'no-store' }, idioma)
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
export function infoAltaApi(idioma: Idioma = 'es'): Promise<InfoAlta> {
  return leer(`${API}/alta/`, { cache: 'no-store' }, idioma)
}

/**
 * El testigo COMPLETO. Va en una llamada aparte y con un clic de por medio: si
 * viajara al cargar la pantalla quedaría en el historial, en cualquier captura
 * y en la consola de red de quien pase por ahí.
 */
export function testigoDeAltaApi(idioma: Idioma = 'es'): Promise<InfoAlta> {
  return leer(`${API}/alta/?testigo=1`, { cache: 'no-store' }, idioma)
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
  /** La del hallazgo. */
  foto: string | null
  /** La segunda toma, si ya la hay: el mismo anuncio hoy (Space Eye 029). */
  fotoHoy?: string | null
  fotoHoyEn?: string | null
}

export interface CreativosEquipo {
  disponible: boolean
  vigilando?: boolean
  aprendiendo?: boolean
  fotosHoy?: number
  maxDia?: number
  creativos?: Creativo[]
  /** Los detectados que no trajeron foto, por motivo (ver space-eyes-sin-foto). */
  sinFoto?: Record<string, number>
}

/** Lo que el equipo detecto mal en su pantalla, y su historial. */
export function fallasApi(id: number, idioma: Idioma = 'es'): Promise<PantallaEquipo> {
  return leer(`${API}/${id}/fallas/`, { cache: 'no-store' }, idioma)
}

/** Los anuncios distintos que han pasado por la pantalla del equipo. */
export function creativosApi(id: number, idioma: Idioma = 'es'): Promise<CreativosEquipo> {
  return leer(`${API}/${id}/creativos/`, { cache: 'no-store' }, idioma)
}

// ─── La bitácora: qué salió, cuándo y cuánto (Space Eye 036) ────────────────
//
// Los nombres llegan tal cual de Space Eye, sin traducir a camelCase: son el
// vocabulario de la auditoría y cambiarlos aquí obligaría a traducirlos de
// vuelta en cada sitio. `medida` y `zona` no son adorno: sin ellas los números
// de abajo no se pueden leer, y la pantalla tiene que decirlo.

/** Con qué vara se midió: cada mirada, o solo el recorrido en que salió. */
export type Medida = 'vistazo' | 'vuelta'

export interface DiaAuditado {
  dia: string
  vistazos: number
  vueltas: number
  primera: string | null
  ultima: string | null
  medida: Medida
  /** De dónde salió la hora: del equipo, o supuesta por el servidor. */
  zona: 'equipo' | 'servidor'
  /** Miradas que el equipo contó y nunca llegaron (red caída, reinicio). */
  perdidos: number
  cerrado: boolean
}

export interface CreativoAuditado {
  phash: string
  nombre: string | null
  descartado: boolean
  campaign_id: number | null
  campana_nombre: string | null
  campana_anunciante: string | null
  campana_bits: number | null
  /** Miradas en las que estaba. NO son reproducciones: ver `medida`. */
  pasadas: number
  /** Recorridos en los que salió (lo único que mandan los teléfonos). */
  apariciones: number
  revisiones: number
  dias: number
  primer_dia: string | null
  ultimo_dia: string | null
  medida: Medida
  /** Días con una vara y días con la otra: el total mezcla dos cosas. */
  mezclada: boolean
  horas: { hora: number; pasadas: number; primera: string | null; ultima: string | null }[]
}

export interface AuditoriaEquipo {
  desde: string
  hasta: string
  vistazos: number
  vueltas: number
  perdidos: number
  dias_medidos: number
  dias_cerrados: number
  medida: Medida
  zona: 'equipo' | 'servidor'
  dias: DiaAuditado[]
  horas_vistazos: Record<string, number>
  creativos: CreativoAuditado[]
}

export interface AuditoriaCampana {
  desde: string
  hasta: string
  vistazos: number
  perdidos: number
  dias_medidos: number
  dias_cerrados: number
  pasadas: number
  pantallas: number
  medida: Medida
  equipos: {
    device_id: number
    equipo: string
    pasadas: number
    apariciones: number
    revisiones: number
    dias: number
    primer_dia: string | null
    ultimo_dia: string | null
    medida: Medida
  }[]
  por_dia: { dia: string; pasadas: number; pantallas: number }[]
  por_hora: { hora: number; pasadas: number }[]
}

function periodo(desde?: string, hasta?: string): string {
  const p = new URLSearchParams()
  if (desde) p.set('desde', desde)
  if (hasta) p.set('hasta', hasta)
  const q = p.toString()
  return q ? `?${q}` : ''
}

// Van por `seApi` y no por `leer` como sus vecinas de arriba: la puerta del
// modulo (ADR 0045) ya trae el corte por tiempo que hace falta cuando el Space
// Eye de la instancia es mas viejo que esta interfaz y la ruta no existe. Sin
// el, la promesa no se resuelve nunca y la pantalla espera en silencio para
// siempre, que es lo que paso en g500 el 9-nov.

/** La bitacora de una pantalla en un periodo. */
export function auditoriaApi(id: number, desde?: string, hasta?: string): Promise<AuditoriaEquipo> {
  return seApi<AuditoriaEquipo>(`devices/${id}/auditoria${periodo(desde, hasta)}`, { esperaMax: 20000 })
}

/** La misma bitacora, cruzando las pantallas de una campana. */
export function auditoriaCampanaApi(id: number, desde?: string, hasta?: string): Promise<AuditoriaCampana> {
  return seApi<AuditoriaCampana>(`campaigns/${id}/auditoria${periodo(desde, hasta)}`, { esperaMax: 20000 })
}
