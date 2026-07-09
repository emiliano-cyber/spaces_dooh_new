import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { reportarIncidencia } from './arrendadores-repo'

// ============================================================================
//  lib/server/incidencias-controller.ts — Reporte de incidencias de sitio.
// ============================================================================

const schema = z.object({
  sitioId: z.string().min(1, 'La pantalla es requerida'),
  tipo: z.string().trim().min(1, 'El tipo es requerido'),
  descripcion: z.string().trim().min(1, 'La descripción es requerida'),
})

export async function reportarIncidenciaCtrl(usuarioId: string, body: unknown) {
  const d = validar(schema, body)
  return reportarIncidencia({ sitioId: d.sitioId, tipo: d.tipo, descripcion: d.descripcion }, usuarioId)
}
