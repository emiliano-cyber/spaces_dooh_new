import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { LIMITES, uploadOUrlZod } from './uploads'
import {
  confirmarReserva,
  validarPublicacion,
  enviarADominio,
  extenderCampana,
  ValidacionError,
} from './campanas-repo'
import { marcarOCRecibida } from './impresion-repo'

// ============================================================================
//  lib/server/campanas-controller.ts — Acciones de campaña (confirmar, enviar a
//  dominio, validar publicación, extender, OC). Valida entradas y mapea
//  ValidacionError → 409, no encontrada → 404.
// ============================================================================

export async function confirmarReservaCtrl(id: string) {
  const c = await confirmarReserva(id)
  if (!c) throw new AppError('Campaña no encontrada', 404)
  return c
}

const validarSchema = z.object({ aprobar: z.boolean(), motivo: z.string().trim().nullish() })

export async function validarPublicacionCtrl(id: string, usuarioNombre: string, body: unknown) {
  const d = validar(validarSchema, body ?? {})
  try {
    const c = await validarPublicacion(id, d.aprobar, d.motivo ?? null, usuarioNombre || 'Sistema')
    if (!c) throw new AppError('Campaña no encontrada', 404)
    return c
  } catch (e) {
    if (e instanceof ValidacionError) throw new AppError(e.message, 409)
    throw e
  }
}

export async function enviarADominioCtrl(id: string) {
  try {
    const c = await enviarADominio(id)
    if (!c) throw new AppError('Campaña no encontrada', 404)
    return c
  } catch (e) {
    if (e instanceof ValidacionError) throw new AppError(e.message, 409)
    throw e
  }
}

const extenderSchema = z.object({ fechaFin: z.string().min(1, 'Falta la fecha fin') })

export async function extenderCampanaCtrl(id: string, body: unknown) {
  const d = validar(extenderSchema, body ?? {})
  const c = await extenderCampana(id, d.fechaFin)
  if (!c) throw new AppError('Campaña no encontrada', 404)
  return c
}

// La OC del cliente llega como PDF o imagen en base64 (o como URL ya hospedada).
// Bloque D: 10 MB, tipo real verificado por magic bytes.
const ocSchema = z.object({
  ocUrl: uploadOUrlZod(LIMITES.ocCampana.allowlist, LIMITES.ocCampana.maxMB, 'ocUrl').nullish(),
})

export async function marcarOCCtrl(id: string, body: unknown) {
  const d = validar(ocSchema, body ?? {})
  const camp = await marcarOCRecibida(id, d.ocUrl ?? null)
  if (!camp) throw new AppError('Campaña no encontrada', 404)
  return camp
}
