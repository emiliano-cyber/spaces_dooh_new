import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearPropuesta, aprobarItem, PropuestaError, type PropuestaInput } from './propuestas-repo'

// ============================================================================
//  lib/server/propuestas-controller.ts — Alta de propuestas y aprobación de sus
//  sitios. La economía (divisor/snapshot/guard $0) vive en el model; aquí se
//  valida la forma de entrada. PropuestaError → HTTP.
// ============================================================================

const crearSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    clienteId: z.string().nullish(),
    agenciaId: z.string().nullish(),
    comisionPct: z.coerce.number().min(0).max(100).optional(),
    fechaInicio: z.string().min(1, 'Fecha de inicio requerida'),
    fechaFin: z.string().min(1, 'Fecha de fin requerida'),
    items: z
      .array(z.object({ sitioId: z.string().min(1), precio: z.coerce.number().nonnegative() }))
      .min(1, 'Agrega al menos un sitio'),
    notas: z.string().nullish(),
  })
  .refine((d) => new Date(d.fechaFin) >= new Date(d.fechaInicio), {
    message: 'La fecha fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  })

export async function crearPropuestaCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  try {
    return await crearPropuesta(d as PropuestaInput)
  } catch (e) {
    if (e instanceof PropuestaError) throw new AppError(e.message, 400)
    throw e
  }
}

const aprobarSchema = z.object({ aprobado: z.boolean().default(false) })

export async function aprobarItemCtrl(itemId: string, body: unknown) {
  const d = validar(aprobarSchema, body ?? {})
  try {
    const prop = await aprobarItem(itemId, !!d.aprobado)
    if (!prop) throw new AppError('Ítem no encontrado', 404)
    return prop
  } catch (e) {
    if (e instanceof PropuestaError) throw new AppError(e.message, 409)
    throw e
  }
}
