import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  crearOrdenImpresion,
  avanzarOrdenImpresion,
  aprobarPruebaColor,
  fijarFechaEspecial,
  sitioEsPropio,
  ImpresionError,
} from './impresion-repo'
import { esFechaReal } from '@/lib/pendientes-creativo'
import { comprobarImprentaDeOrden } from './imprentas-controller'

// ============================================================================
//  lib/server/impresion-controller.ts — Órdenes de impresión: alta, avance de
//  proceso y prueba de color. ImpresionError → 409, no encontrada → 404.
// ============================================================================

export async function crearOrdenImpresionCtrl(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (!b.campanaId || typeof b.campanaId !== 'string') {
    throw new AppError('La campaña es requerida', 400)
  }
  // IMP-REQ (18/11) · la imprenta, si viene, tiene que ser de esta organización.
  const imprentaId = await comprobarImprentaDeOrden(b.imprentaId)
  // FLUJO-CREA (20/11) · «Mandar a impresión» manda el sitio del pendiente. El
  // sitio tiene que ser de esta organización: la FK de `sitio_id` es simple y
  // dejaría apuntar a la pantalla de otra. Y la fecha especial, si viene, una
  // fecha que exista.
  if (b.sitioId != null && b.sitioId !== '') {
    if (typeof b.sitioId !== 'string' || !(await sitioEsPropio(b.sitioId))) {
      throw new AppError('Sitio no encontrado', 400)
    }
  }
  const fechaEspecial = leerFechaEspecial(b.fechaEspecial)
  try {
    return await crearOrdenImpresion({
      ...(b as Parameters<typeof crearOrdenImpresion>[0]),
      sitioId: (b.sitioId as string) || null,
      imprentaId,
      fechaEspecial,
    })
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

// FLUJO-CREA (20/11) · la fecha especial: 'YYYY-MM-DD' que exista, o null/''
// para quitarla. Cualquier otra cosa → 400 «Fecha inválida» (el 30 de febrero
// también: Postgres lo rechazaría con un 500).
function leerFechaEspecial(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v !== 'string' || !esFechaReal(v)) throw new AppError('Fecha inválida', 400)
  return v
}

export async function fijarFechaEspecialCtrl(id: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (!('fechaEspecial' in b)) throw new AppError('Fecha inválida', 400)
  const oi = await fijarFechaEspecial(id, leerFechaEspecial(b.fechaEspecial))
  if (!oi) throw new AppError('Orden no encontrada', 404)
  return oi
}
