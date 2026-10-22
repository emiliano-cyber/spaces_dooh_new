import 'server-only'
import { z } from 'zod'
import { q1 } from './db'
import { tenantActual } from './tenant'
import { AppError, validar } from './errores'
import { motivoHorarioInvalido } from '@/lib/doohmain-programacion'

// ============================================================================
//  lib/server/horario-doohmain.ts — El horario INDIVIDUAL de una campaña en
//  DOOHmain (22/10, noche).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «que en campaña se pueda poner una franja de tiempo
//  individual que se mande a DOOHmain». Hora de inicio, de fin y, opcional, los
//  días de la semana. Gana sobre la franja programada y la contratada
//  (`franjaQueViaja`, `lib/doohmain-programacion.ts`). Columnas de
//  `20261022_campana_horario_doohmain.sql`.
//
//  Es controller y repo en uno porque es UNA escritura de tres columnas; la
//  regla vive en `motivoHorarioInvalido` (la usa también la pantalla) y la base
//  la vuelve a exigir con CHECK.
// ============================================================================

const horarioSchema = z
  .object({
    horaInicio: z.string().trim(),
    horaFin: z.string().trim(),
    // Ausente o null = todos los días.
    dias: z.array(z.number().int()).max(7).nullish(),
  })
  .strict()

// `null` en el cuerpo entero = quitar el horario individual.
const cuerpoSchema = z.object({ horario: horarioSchema.nullable() }).strict()

export interface HorarioDoohmain {
  horaInicio: string
  horaFin: string
  dias: number[] | null
}

export async function fijarHorarioDoohmainCtrl(
  campanaId: string,
  body: unknown,
): Promise<{ horario: HorarioDoohmain | null; campana: string }> {
  const { horario } = validar(cuerpoSchema, body) as z.output<typeof cuerpoSchema>
  const h = horario ? { horaInicio: horario.horaInicio, horaFin: horario.horaFin, dias: horario.dias?.length ? horario.dias : null } : null
  if (h) {
    const motivo = motivoHorarioInvalido(h)
    if (motivo) throw new AppError(motivo, 400)
  }
  const r = await q1<{ nombre: string }>(
    `update campanas
        set doohmain_hora_inicio = $3, doohmain_hora_fin = $4, doohmain_dias = $5::smallint[]
      where id = $1 and tenant_id = $2
      returning nombre`,
    [campanaId, await tenantActual(), h?.horaInicio ?? null, h?.horaFin ?? null, h?.dias ?? null],
  )
  if (!r) throw new AppError('Esa campaña no existe', 404)
  return { horario: h, campana: r.nombre }
}
