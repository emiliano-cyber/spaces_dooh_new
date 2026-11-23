import 'server-only'
import { AppError } from './errores'
import { leerSitioDePropuestaPorToken } from './fotos-sitio-publico-repo'
import { fotosMostrables } from '@/lib/fotos-sitio'
import { puntoUtil } from '@/lib/coordenadas'

// ============================================================================
//  lib/server/fotos-sitio-publico-controller.ts — CONTROLLER de «Ver fotos y
//  ubicación» en la liga pública. Valida token y sitio, pide la fila al model
//  y arma la respuesta con LISTA BLANCA: solo ubicación y fotos. Un campo que
//  se colara en la fila (un `select` ampliado mañana) no llega al JSON.
// ============================================================================

// Misma forma que `seguimiento-publico-controller.ts`: no es la defensa (la
// defensa es que el token sea aleatorio), es no gastar una conexión en basura.
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{16,128}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FotosSitioPublico {
  nombre: string
  tipoMedio: string | null
  direccion: string | null
  alcaldia: string | null
  ciudad: string | null
  estado: string | null
  lat: number | null
  lng: number | null
  fotos: string[]
}

export async function fotosSitioPublicoCtrl(token: string, sitioId: string): Promise<FotosSitioPublico> {
  const tok = (token ?? '').trim()
  const sid = (sitioId ?? '').trim()
  if (!TOKEN_VALIDO.test(tok) || !UUID.test(sid)) throw new AppError('Propuesta no encontrada', 404)

  const s = await leerSitioDePropuestaPorToken(tok, sid)
  // El mismo 404 para «token falso» y «sitio fuera de la propuesta»: distinguirlos
  // le diría a quien prueba ids cuál de los dos acertó.
  if (!s) throw new AppError('Propuesta no encontrada', 404)

  const punto = puntoUtil(s.lat as any, s.lng as any)
  return {
    nombre: s.nombre,
    tipoMedio: s.tipoMedio ?? null,
    direccion: s.direccion ?? null,
    alcaldia: s.alcaldia ?? null,
    ciudad: s.ciudad ?? null,
    estado: s.estado ?? null,
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    fotos: fotosMostrables(s.fotos),
  }
}
