import 'server-only'
import { q1 } from './db'

// ============================================================================
//  lib/server/franja-de-campana.ts — ¿La campaña YA tiene franja horaria?
// ----------------------------------------------------------------------------
//  Regla del dueño (23/10): «si la campaña ya tiene franja de horario no debe
//  de tener la opción de añadir otra opción de horario». La usan el PATCH del
//  horario individual (`horario-doohmain.ts`, que la rechaza) y la vista previa
//  (`doohmain.ts`, que la enseña en vez del cuadro).
//
//  Se mira con la MISMA precedencia que `leerPlan()` en `doohmain.ts` —la
//  programada y, si no hay, la contratada de alguna reserva viva— para que
//  «tiene franja» aquí sea exactamente «viaja una franja» al publicar.
//
//  Va en su propio módulo, con el tenant como parámetro, porque `doohmain.ts`
//  no puede importar `tenant.ts`: arrastra el `cache` de React del servidor y
//  rompe las unitarias que cargan `doohmain.ts` (lo cazó
//  `doohmain.pantalla.test.ts`).
// ============================================================================

export interface FranjaDeCampana {
  nombre: string
  horaInicio: string
  horaFin: string
  /** `programada`: la de la campaña (PROG-01) · `contratada`: la de una pantalla (REJILLA-01). */
  origen: 'programada' | 'contratada'
}

export async function franjaDeCampana(campanaId: string, tenantId: string | null): Promise<FranjaDeCampana | null> {
  return q1<FranjaDeCampana>(
    `select fh.nombre, fh.hora_inicio as "horaInicio", fh.hora_fin as "horaFin",
            case when c.franja_programada_id is not null then 'programada' else 'contratada' end as origen
       from campanas c
       left join reservas r
              on c.franja_programada_id is null
             and r.campana_id = c.id and r.estatus <> 'CANCELADA' and r.franja_id is not null
       join franjas_horarias fh
              on fh.id = coalesce(c.franja_programada_id, r.franja_id) and fh.tenant_id = c.tenant_id
      where c.id = $1 and c.tenant_id = $2
      limit 1`,
    [campanaId, tenantId],
  )
}
