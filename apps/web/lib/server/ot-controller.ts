import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { crearOT } from './ot-repo'

// ============================================================================
//  lib/server/ot-controller.ts — Alta de órdenes de trabajo.
//  Valida tipo/descripción y exige fecha compromiso (S1-5); prioridad acotada.
// ============================================================================

const PRIORIDAD = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const

const crearSchema = z.object({
  tipo: z.string().trim().min(1, 'El tipo es requerido'),
  descripcion: z.string().trim().min(1, 'La descripción es requerida'),
  // S1-5: sin fecha compromiso la alerta de OT vencida no puede operar.
  fechaProgramada: z.string().trim().min(1, 'La fecha compromiso es obligatoria'),
  sitioId: z.string().nullish(),
  campanaId: z.string().nullish(),
  instrucciones: z.string().trim().optional(),
  prioridad: z.enum(PRIORIDAD).optional(),
  asignadoA: z.string().nullish(),
  checklist: z.array(z.any()).optional(),
})

export async function crearOTCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  return crearOT({
    tipo: d.tipo,
    descripcion: d.descripcion,
    fechaProgramada: d.fechaProgramada,
    sitioId: d.sitioId ?? null,
    campanaId: d.campanaId ?? null,
    instrucciones: d.instrucciones,
    prioridad: d.prioridad,
    asignadoA: d.asignadoA ?? null,
    checklist: d.checklist,
  })
}
