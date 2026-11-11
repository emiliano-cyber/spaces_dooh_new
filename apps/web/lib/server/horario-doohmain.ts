import 'server-only'
import { z } from 'zod'
import { q1 } from './db'
import { tenantActual } from './tenant'
import { AppError, validar } from './errores'
import { motivoHorarioInvalido } from '@/lib/doohmain-programacion'
import { franjaDeCampana } from './franja-de-campana'

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
  // Los días se guardan ORDENADOS: el mismo horario marcado en otro orden es el
  // mismo horario, y así se lee igual en la vista previa, en Actividad y en lo
  // que se manda (la e2e lo cazó: guardaba [5,1,3]).
  const h = horario
    ? {
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        dias: horario.dias?.length ? [...horario.dias].sort((a, b) => a - b) : null,
      }
    : null
  if (h) {
    const motivo = motivoHorarioInvalido(h)
    if (motivo) throw new AppError(motivo, 400)
    // Con franja, la campaña ya tiene su horario en DOOHmain: no lleva otro.
    // Quitar (`horario: null`) sí se deja siempre, para que una campaña que ya
    // tenía los dos —de antes de esta regla— pueda quedarse solo con la franja.
    const f = await franjaDeCampana(campanaId, await tenantActual())
    if (f) {
      throw new AppError(
        `Esta campaña ya tiene franja horaria (${f.nombre}, ${f.horaInicio} a ${f.horaFin}): ` +
          'ese es el horario que se manda a DOOHmain y no lleva otro.',
        409,
      )
    }
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
