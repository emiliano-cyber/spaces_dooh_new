import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearOrdenImpresion, avanzarOrdenImpresion, aprobarPruebaColor, ImpresionError } from './impresion-repo'

// ============================================================================
//  lib/server/impresion-controller.ts — Órdenes de impresión: alta, avance de
//  proceso y prueba de color. ImpresionError → 409, no encontrada → 404.
// ============================================================================

export async function crearOrdenImpresionCtrl(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (!b.campanaId || typeof b.campanaId !== 'string') {
    throw new AppError('La campaña es requerida', 400)
  }
  try {
    return await crearOrdenImpresion(b as Parameters<typeof crearOrdenImpresion>[0])
  } catch (e) {
    if (e instanceof ImpresionError) throw new AppError(e.message, 409)
    throw e
  }
}

export async function avanzarOrdenCtrl(id: string) {
  const oi = await avanzarOrdenImpresion(id)
  if (!oi) throw new AppError('Orden no encontrada', 404)
  return oi
}

const pruebaSchema = z.object({ aprobada: z.boolean().default(false), url: z.string().trim().nullish() })

export async function aprobarPruebaColorCtrl(id: string, body: unknown) {
  const d = validar(pruebaSchema, body ?? {})
  const oi = await aprobarPruebaColor(id, !!d.aprobada, d.url ?? null)
  if (!oi) throw new AppError('Orden no encontrada', 404)
  return oi
}
