import { z } from 'zod'

export const CreateClienteSchema = z.object({
  nombre: z.string().min(1),
  rfc: z.string().optional(),
  tipo: z.string().optional(),
  contactoJson: z.record(z.string(), z.unknown()).optional(),
})

export const CreateCampanaSchema = z.object({
  nombre: z.string().min(1),
  clienteId: z.string().min(1),
  agencia: z.string().optional(),
  marca: z.string().optional(),
  tipoCampana: z.enum(['OOH', 'DOOH', 'HIBRIDA']),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
  presupuestoBruto: z.number().positive().optional(),
  presupuestoNeto: z.number().positive().optional(),
  moneda: z.string().optional(),
  notas: z.string().optional(),
})

export const CreateCampaignLineSchema = z.object({
  sitioId: z.string().min(1),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
  tipoVenta: z.enum([
    'SPOT_UNIT', 'DAY_PACK', 'HOUR_PACK', 'SOV', 'TAKEOVER',
    'FIXED_PKG', 'PROG_DIRECT', 'PROG_PMP', 'PROG_OPEN', 'MAKEGOOD', 'HOUSE_AD',
  ]),
  precio: z.number().positive(),
  cantidad: z.number().int().positive().optional(),
  unidad: z.string().optional(),
  duracionSpot: z.number().int().positive().optional(),
  frecuencia: z.number().int().positive().optional(),
  horarioJson: z.object({
    horaInicio: z.string().optional(),
    horaFin: z.string().optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
  }).optional(),
  pantallasIds: z.array(z.string()).optional(),
})

export type CreateClienteInput = z.infer<typeof CreateClienteSchema>
export type CreateCampanaInput = z.infer<typeof CreateCampanaSchema>
export type CreateCampaignLineInput = z.infer<typeof CreateCampaignLineSchema>
