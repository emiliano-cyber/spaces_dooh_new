import 'server-only'
import { AppError } from './errores'
import { leerSeguimientoPorToken } from './seguimiento-publico-repo'
import { armarSeguimiento, type Seguimiento } from '@/lib/seguimiento-campana'
import { hoyEnMexico } from '@/lib/doohmain-estado'

// ============================================================================
//  lib/server/seguimiento-publico-controller.ts — CONTROLLER del seguimiento
//  de campaña en la liga pública. Valida el token, pide los datos al model
//  (`seguimiento-publico-repo.ts`) y aplica la regla (`lib/seguimiento-campana`).
//  La ruta queda delgada: límite de peticiones + mapeo de error.
// ============================================================================

// Los tokens públicos son hex/base64url de longitud fija; cualquier otra cosa
// no llega a la base. No es la defensa (la defensa es que el token sea
// aleatorio): es no gastar una conexión en basura.
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{16,128}$/

export type RespuestaSeguimiento = { hayCampana: false } | { hayCampana: true; seguimiento: Seguimiento }

export async function seguimientoPublicoCtrl(
  token: string,
  ahora: Date = new Date(),
): Promise<RespuestaSeguimiento> {
  const tok = (token ?? '').trim()
  if (!TOKEN_VALIDO.test(tok)) throw new AppError('Propuesta no encontrada', 404)

  const leido = await leerSeguimientoPorToken(tok)
  if (!leido) throw new AppError('Propuesta no encontrada', 404)

  // Una propuesta que aún no es campaña no tiene seguimiento: la página sigue
  // enseñando la propuesta como siempre, sin tarjeta vacía.
  if (!leido.datos) return { hayCampana: false }

  // «Hoy» en la hora de México, la misma que usa la publicación en DOOHmain:
  // con UTC, a las 18:00 de la víspera la campaña ya saldría «al aire».
  return { hayCampana: true, seguimiento: armarSeguimiento(leido.datos, hoyEnMexico(ahora)) }
}
