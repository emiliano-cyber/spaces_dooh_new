import 'server-only'
import { q, withTenantTx } from './db'
import { tenantActual } from './tenant'
import type { FranjaContratada } from '@/lib/franja-programada'

// ============================================================================
//  lib/server/programacion-repo.ts — en qué franja SE TRANSMITE cada campaña.
//  PROG-01 · decisión del dueño del 2026-09-30.
// ----------------------------------------------------------------------------
//  ESTE ARCHIVO NO ESCRIBE NADA MÁS QUE `campanas.franja_programada_id`. Ni
//  `reservas.franja_id` (lo contratado, heredado de la propuesta), ni precios,
//  ni `propuestas.snapshot_economico`. «El precio ya debe de estar en la campaña
//  después de la propuesta»: programar es una instrucción de operación, no una
//  venta. Si algún día hace falta tocar lo contratado desde aquí, esa tarea está
//  mal planteada.
//
//  R2. Todo va con `q`/`withTenantTx` —GUC fijado— y ADEMÁS con
//  `and tenant_id = $n`. El modo de fallo de un olvido aquí no da error: la
//  campaña de otra organización simplemente «no aparece», o peor, aparece.
// ============================================================================

export type FranjaCatalogo = {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  activo: boolean
}

export type CampanaProgramacion = {
  id: string
  folio: string | null
  nombre: string
  estadoComercial: string
  fechaInicio: string
  fechaFin: string
  franjaProgramadaId: string | null
  contratadas: FranjaContratada[]
}

export type ResultadoAsignacion =
  | {
      ok: true
      franja: { id: string; nombre: string; horaInicio: string; horaFin: string } | null
      campanas: { id: string; folio: string | null; nombre: string }[]
    }
  | { ok: false; motivo: 'franja' | 'campanas'; faltan: string[] }

/**
 * Lo que necesitan las dos pantallas: el catálogo de franjas (incluidas las
 * dadas de baja, para poder NOMBRAR la que una campaña tenía programada antes
 * de que la apagaran) y las campañas con su programada y sus contratadas.
 *
 * Las contratadas se leen AGREGADAS por franja y sin las reservas CANCELADAS:
 * una reserva cancelada no se transmite, así que no puede contradecir nada.
 */
export async function listarProgramacion(op?: { campanaId?: string }): Promise<{
  franjas: FranjaCatalogo[]
  campanas: CampanaProgramacion[]
}> {
  const t = await tenantActual()
  const porId = op?.campanaId ? ' and c.id = $2' : ''
  const params = op?.campanaId ? [t, op.campanaId] : [t]

  const [franjas, campanas, contratadas] = await Promise.all([
    q<any>(
      `select id, nombre, hora_inicio, hora_fin, activo
         from franjas_horarias where tenant_id = $1
        order by orden asc, nombre asc`,
      [t],
    ),
    q<any>(
      `select c.id, c.folio, c.nombre, c.estado_comercial,
              to_char(c.fecha_inicio,'YYYY-MM-DD') as fecha_inicio,
              to_char(c.fecha_fin,'YYYY-MM-DD')    as fecha_fin,
              c.franja_programada_id
         from campanas c
        where c.tenant_id = $1${porId}
        order by c.fecha_inicio desc, c.nombre asc`,
      params,
    ),
    // `left join` con `and f.tenant_id = r.tenant_id`: la FK compuesta ya lo
    // garantiza, y la RLS otra vez; es la tercera capa, la barata.
    q<any>(
      `select r.campana_id, r.franja_id, f.nombre as franja_nombre, count(*)::int as pantallas
         from reservas r
         join campanas c on c.id = r.campana_id and c.tenant_id = r.tenant_id
         left join franjas_horarias f on f.id = r.franja_id and f.tenant_id = r.tenant_id
        where r.tenant_id = $1 and r.estatus <> 'CANCELADA'${porId}
        group by r.campana_id, r.franja_id, f.nombre`,
      params,
    ),
  ])

  const porCampana = new Map<string, FranjaContratada[]>()
  for (const r of contratadas) {
    const lista = porCampana.get(r.campana_id) ?? []
    lista.push({
      franjaId: r.franja_id ?? null,
      franjaNombre: r.franja_nombre ?? null,
      pantallas: Number(r.pantallas),
    })
    porCampana.set(r.campana_id, lista)
  }

  return {
    franjas: franjas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      horaInicio: f.hora_inicio,
      horaFin: f.hora_fin,
      activo: !!f.activo,
    })),
    campanas: campanas.map((c) => ({
      id: c.id,
      folio: c.folio ?? null,
      nombre: c.nombre,
      estadoComercial: c.estado_comercial,
      fechaInicio: c.fecha_inicio,
      fechaFin: c.fecha_fin,
      franjaProgramadaId: c.franja_programada_id ?? null,
      contratadas: porCampana.get(c.id) ?? [],
    })),
  }
}

/** Se lanza DENTRO de la transacción para forzar el rollback. */
class LoteIncompleto extends Error {}

/**
 * Programa (o quita, con `null`) UNA franja en VARIAS campañas, TODO O NADA.
 *
 * ─── POR QUÉ ATÓMICO ───────────────────────────────────────────────────────
 * Un lote aplicado a medias deja unas campañas en Prime y otras no, y quien lo
 * pidió no tiene forma de saber cuáles: la pantalla diría «error» y la base
 * diría «la mitad». Aquí se comprueba el lote ENTERO antes de escribir, bajo la
 * misma transacción y con `for update`, y si falta una sola campaña no se
 * escribe ninguna.
 *
 * ─── POR QUÉ LA FRANJA SE VALIDA AQUÍ Y NO SOLO CON LA FK ──────────────────
 * La FK compuesta `(franja_programada_id, tenant_id)` ya impide colgar una
 * campaña de una franja ajena, y es la que cierra de verdad el agujero R2 —una
 * validación es algo que la siguiente ruta puede olvidar—. Pero la FK deja
 * pasar una franja DADA DE BAJA, y una franja apagada no se programa: se apagó
 * para que dejara de usarse. Y un error de restricción no se lee; un 404 sí.
 *
 * El `tenant_id` sale de la sesión, nunca del cuerpo.
 */
export async function asignarFranjaProgramada(
  campanaIds: string[],
  franjaId: string | null,
): Promise<ResultadoAsignacion> {
  const t = await tenantActual()
  try {
    return await withTenantTx(async (cliente): Promise<ResultadoAsignacion> => {
      let franja: { id: string; nombre: string; horaInicio: string; horaFin: string } | null = null
      if (franjaId) {
        const f = await cliente.query(
          `select id, nombre, hora_inicio, hora_fin from franjas_horarias
            where id = $1 and tenant_id = $2 and activo = true`,
          [franjaId, t],
        )
        if (!f.rows[0]) return { ok: false, motivo: 'franja', faltan: [] }
        const r = f.rows[0]
        franja = { id: r.id, nombre: r.nombre, horaInicio: r.hora_inicio, horaFin: r.hora_fin }
      }

      const vistas = await cliente.query(
        `select id from campanas where id = any($1::uuid[]) and tenant_id = $2 for update`,
        [campanaIds, t],
      )
      const encontradas = new Set(vistas.rows.map((r: { id: string }) => r.id))
      const faltan = campanaIds.filter((id) => !encontradas.has(id))
      if (faltan.length) return { ok: false, motivo: 'campanas', faltan }

      const upd = await cliente.query(
        `update campanas set franja_programada_id = $1
          where id = any($2::uuid[]) and tenant_id = $3
          returning id, folio, nombre`,
        [franjaId, campanaIds, t],
      )
      // Con el `for update` de arriba esto no debería pasar nunca. Si pasa, no
      // se deja el lote a medias: se deshace entero.
      if (upd.rowCount !== campanaIds.length) throw new LoteIncompleto()
      return {
        ok: true,
        franja,
        campanas: upd.rows.map((r: any) => ({ id: r.id, folio: r.folio ?? null, nombre: r.nombre })),
      }
    })
  } catch (e) {
    if (e instanceof LoteIncompleto) return { ok: false, motivo: 'campanas', faltan: [] }
    throw e
  }
}
