import 'server-only'
import { AppError } from './errores'
import { leerAvisosPropios, guardarAvisosPropios } from './avisos-repo'
import { CANALES_QUE_SE_GUARDAN, estadoCanales } from './avisos-canales'
import { TIPOS_AVISO, validarPreferencias, type PreferenciaAviso, type TipoAviso } from '@/lib/avisos'

// ============================================================================
//  lib/server/avisos-controller.ts — Configuración → Avisos (AVISOS-CANAL, 12/11).
// ----------------------------------------------------------------------------
//  Solo la propia cuenta: el id sale de la SESIÓN, nunca del cuerpo, y el repo
//  filtra además por el tenant de la sesión. Como el idioma, es una
//  preferencia de cada quien, no algo que un administrador decida por nadie.
// ============================================================================

export interface RespuestaAvisos {
  tipos: readonly TipoAviso[]
  activos: PreferenciaAviso[]
  telefono: string | null
  canales: ReturnType<typeof estadoCanales>
}

export async function leerAvisosCtrl(usuarioId: string): Promise<RespuestaAvisos> {
  const propios = await leerAvisosPropios(usuarioId)
  if (!propios) throw new AppError('No encontrado', 404)
  return { tipos: TIPOS_AVISO, ...propios, canales: estadoCanales() }
}

export async function guardarAvisosCtrl(usuarioId: string, body: unknown): Promise<RespuestaAvisos> {
  const v = validarPreferencias(body, CANALES_QUE_SE_GUARDAN)
  // El mensaje sale de `MSG_AVISO` (`lib/avisos.ts`), que comparte la pantalla;
  // sus traducciones están en `errores-servidor.ts`.
  if (!v.ok) throw new AppError(v.error, 400)
  const hubo = await guardarAvisosPropios(usuarioId, v.activos, v.telefono)
  // La fila es la de la sesión: si no se tocó, la cuenta dejó de existir (o de
  // ser de este tenant) entre la sesión y aquí.
  if (!hubo) throw new AppError('No encontrado', 404)
  return leerAvisosCtrl(usuarioId)
}
