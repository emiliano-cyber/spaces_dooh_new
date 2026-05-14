import { z } from 'zod'

const EstOTEnum = z.enum(['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'BLOQUEADA', 'EN_REVISION', 'COMPLETADA', 'RECHAZADA', 'CANCELADA'])
const PrioridadEnum = z.enum(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'])

export const CreateOTSchema = z.object({
  tipo: z.string().min(1),
  sitioId: z.string().optional(),
  descripcion: z.string().min(10),
  instrucciones: z.string().optional(),
  checklist: z.array(z.object({ texto: z.string().min(1) })).optional(),
  prioridad: PrioridadEnum.optional(),
  asignadoAUserId: z.string().optional(),
  supervisorUserId: z.string().optional(),
  fechaProgramada: z.string().datetime().optional(),
  campanaId: z.string().optional(),
  requiereRevision: z.boolean().optional(),
})

export const UpdateOTSchema = z.object({
  estatus: EstOTEnum.optional(),
  asignadoAUserId: z.string().optional(),
  prioridad: PrioridadEnum.optional(),
  notas: z.string().optional(),
  fechaProgramada: z.string().datetime().optional(),
})

export const ChecklistItemSchema = z.object({
  itemId: z.string(),
  completado: z.boolean(),
  notaRealizado: z.string().optional(),
  notaPendiente: z.string().optional(),
})

export type CreateOTInput = z.infer<typeof CreateOTSchema>
export type UpdateOTInput = z.infer<typeof UpdateOTSchema>
export type ChecklistItemInput = z.infer<typeof ChecklistItemSchema>
