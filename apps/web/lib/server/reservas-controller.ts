import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { reservar } from './campanas-repo'

// ============================================================================
//  lib/server/reservas-controller.ts — Reserva tentativa de pantallas.
//  Valida pantallas y rango de fechas (zod); el model aplica el guard de
//  colisión por tipo de medio (S0-3). Colisión/regla de negocio → 409.
// ============================================================================

const reservarSchema = z
  .object({
    sitioIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos una pantalla'),
    fechaInicio: z.string().min(1, 'Fecha de inicio requerida'),
    fechaFin: z.string().min(1, 'Fecha de fin requerida'),
    campanaId: z.string().nullish(),
    clienteNombre: z.string().nullish(),
    nombreCampana: z.string().nullish(),
    tipoCampana: z.string().nullish(),
    spotsPorSitio: z.record(z.string(), z.coerce.number()).nullish(),
  })
  .refine((d) => new Date(d.fechaFin) >= new Date(d.fechaInicio), {
    message: 'La fecha fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  })

export async function reservarCtrl(body: unknown) {
  const d = validar(reservarSchema, body)
  try {
    return await reservar({
      sitioIds: d.sitioIds,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      campanaId: d.campanaId ?? undefined,
      clienteNombre: d.clienteNombre ?? undefined,
      nombreCampana: d.nombreCampana ?? undefined,
      tipoCampana: (d.tipoCampana ?? undefined) as never,
      spotsPorSitio: (d.spotsPorSitio ?? undefined) as Record<string, number> | undefined,
    })
  } catch (e) {
    // Colisión de fechas / regla de negocio → 409 con el mensaje al usuario.
    throw new AppError(e instanceof Error ? e.message : 'No se pudo reservar', 409)
  }
}
