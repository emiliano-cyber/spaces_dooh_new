import { z } from 'zod'

const TipoOTEnum = z.enum([
  'MONTAJE_LONA',
  'MONTAJE_DIGITAL',
  'DESMONTAJE',
  'MANTENIMIENTO_PREVENTIVO',
  'MANTENIMIENTO_CORRECTIVO',
  'HERRERIA',
  'ELECTRICO',
  'INSPECCION',
  'OTRO',
])

const EstOTEnum = z.enum(['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'])

const PrioridadEnum = z.enum(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'])

export const CreateOTSchema = z.object({
  tipo: TipoOTEnum,
  sitioId: z.string().optional(),
  descripcion: z.string().min(10),
  instrucciones: z.string().optional(),
  checklist: z.array(z.object({ texto: z.string().min(1) })).optional(),
  prioridad: PrioridadEnum.optional(),
  asignadoAUserId: z.string().optional(),
  fechaProgramada: z.string().datetime().optional(),
  campanaId: z.string().optional(),
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
})

export type CreateOTInput = z.infer<typeof CreateOTSchema>
export type UpdateOTInput = z.infer<typeof UpdateOTSchema>
export type ChecklistItemInput = z.infer<typeof ChecklistItemSchema>
