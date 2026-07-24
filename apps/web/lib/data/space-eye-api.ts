'use client'

// ============================================================================
//  lib/data/space-eye-api.ts — Visión de la pantalla en Space Eye (cámara + IA).
//  Consume el BFF /api/sitios/:id/space-eye; el servidor habla con Space Eye y
//  nunca expone las credenciales al cliente. Ver lib/server/space-eye.ts.
// ============================================================================

const API = '/spaces-dooh/api'

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
  verificacionEstatus: string | null
  esCorrecta: boolean | null
  score: number | null
  gps: { lat: number; lng: number } | null
}
export interface VisionSitio {
  disponible: boolean
  motivo?: string
  dispositivo?: VisionDispositivo
  foto?: VisionFoto | null
}

export async function visionSitioApi(sitioId: string): Promise<VisionSitio> {
  const r = await fetch(`${API}/sitios/${sitioId}/space-eye/`)
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo consultar Space Eye')
  }
  return r.json()
}
