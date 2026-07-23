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
const USER = process.env.SPACE_EYE_USER ?? ''
const PASS = process.env.SPACE_EYE_PASS ?? ''

// La integración está activa solo si hay URL y credenciales configuradas.
export function spaceEyeHabilitado(): boolean {
  return !!(BASE && USER && PASS)
}

// El access token de Space Eye dura 15 min; lo cacheamos en memoria del proceso
// con un margen para renovarlo antes de que expire.
let tokenCache: { access: string; expira: number } | null = null

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER, password: PASS }),
  })
  if (!r.ok) throw new Error(`Space Eye: login falló (${r.status})`)
  const d = (await r.json()) as { access_token?: string }
  if (!d.access_token) throw new Error('Space Eye: login sin token')
  tokenCache = { access: d.access_token, expira: Date.now() + 12 * 60_000 }
  return d.access_token
}

async function token(): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now()) return tokenCache.access
  return login()
}

// GET autenticado. Si el token caducó (401), reintenta una vez tras re-login.
async function api<T>(path: string): Promise<T> {
  let t = await token()
  let r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${t}` } })
  if (r.status === 401) {
    tokenCache = null
    t = await login()
    r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${t}` } })
  }
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

  // Última foto de ese dispositivo (la más reciente). Filtramos por device por si
  // el backend ignora el query param.
  let foto: SEPhoto | undefined
  try {
    const { photos } = await api<{ photos: SEPhoto[] }>(`/api/photos?device=${dev.id}&limit=5`)
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
          url: `${BASE}${foto.storage_path}`,
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
