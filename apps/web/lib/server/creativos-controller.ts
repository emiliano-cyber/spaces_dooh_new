import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearCreatividad, setCreativosDeReserva, CreatividadError } from './creativos-repo'

// ============================================================================
//  lib/server/creativos-controller.ts — Alta de creativos y asignación a
//  reservas. Valida la entrada (zod) y mapea CreatividadError a HTTP.
// ============================================================================

const crearSchema = z
  .object({
    campanaId: z.string().min(1, 'La campaña es requerida'),
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    archivoUrl: z.string().trim().nullish(),
    codigo: z.string().trim().nullish(),
    formato: z.string().trim().nullish(),
    resolucion: z.string().trim().nullish(),
  })
  .refine((d) => !!(d.archivoUrl || d.codigo), {
    message: 'Falta la imagen o el código del creativo',
    path: ['archivoUrl'],
  })

export async function crearCreatividadCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  try {
    return await crearCreatividad({
      campanaId: d.campanaId,
      nombre: d.nombre,
      archivoUrl: d.archivoUrl ?? null,
      codigo: d.codigo ?? null,
      formato: d.formato ?? null,
      resolucion: d.resolucion ?? null,
    })
  } catch (e) {
    if (e instanceof CreatividadError) throw new AppError(e.message, 409)
    throw e
  }
}

const asignarSchema = z.object({
  creativos: z
    .array(z.object({ creatividadId: z.string().min(1), veces: z.coerce.number().int().min(1).default(1) }))
    .default([]),
})

export async function setCreativosReservaCtrl(reservaId: string, body: unknown) {
  const d = validar(asignarSchema, body ?? {})
  const creativos = (d.creativos ?? []).map((c) => ({ creatividadId: c.creatividadId, veces: c.veces ?? 1 }))
  const res = await setCreativosDeReserva(reservaId, creativos)
  if (!res) throw new AppError('Reserva no encontrada', 404)
  return { creativos: res }
}
