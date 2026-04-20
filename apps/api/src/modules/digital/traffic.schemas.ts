import { z } from 'zod'

export const UpdateTrafficEstadoSchema = z.object({
  estadoTecnico: z.enum([
    'PENDIENTE',
    'EN_TRAFICO',
    'ACTIVA',
    'PAUSADA',
    'FINALIZADA',
    'CANCELADA',
  ]),
  nota: z.string().optional(),
})

export const TrafficOrderQuerySchema = z.object({
  campanaId: z.string().optional(),
  estadoTecnico: z.string().optional(),
})

export type UpdateTrafficEstadoInput = z.infer<typeof UpdateTrafficEstadoSchema>
export type TrafficOrderQuery = z.infer<typeof TrafficOrderQuerySchema>
