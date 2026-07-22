import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import { consultarStats } from './doohmain'

// ============================================================================
//  lib/server/playlogs-repo.ts — Proof of play desde DOOHmain.
//  Guarda la respuesta CRUDA de la API (ver la migración
//  20260716_doohmain_playlogs.sql para el porqué): aún no hemos visto una
//  respuesta con datos, así que no se interpreta nada todavía.
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

export interface ConsultaPlay {
  id: string
  tipo: string
  campanaId: string | null
  auths: string[]
  desde: string
  hasta: string
  payload: unknown
  vacio: boolean
  error: string | null
  consultadoEn: string
}

function rowToConsulta(r: any): ConsultaPlay {
  return {
    id: r.id,
    tipo: r.tipo,
    campanaId: r.campana_id ?? null,
    auths: r.auths ?? [],
    // `desde`/`hasta` son DATE: no tienen hora. Sin el recorte salen como
    // 2026-07-14T06:00:00.000Z (la medianoche de CDMX en UTC), que en pantalla
    // parece "el 14 a las 6am" y no lo es.
    desde: String(iso(r.desde)).slice(0, 10),
    hasta: String(iso(r.hasta)).slice(0, 10),
    payload: r.payload,
    vacio: r.vacio,
    error: r.error ?? null,
    consultadoEn: iso(r.consultado_en),
  }
}

// ¿La respuesta trae reproducciones? Sabemos que la llave es `stats`/`metrics` y
// que es un arreglo (lo confirmamos contra la API real). Lo único que se afirma
// aquí es si viene vacío: NO se interpreta el contenido, porque no lo conocemos.
export function respuestaVacia(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return true
  const p = payload as Record<string, unknown>
  const arr = p.stats ?? p.metrics
  if (Array.isArray(arr)) return arr.length === 0
  // Forma desconocida: se marca como NO vacía para que salte a la vista y la
  // revisemos, en vez de esconderla bajo un "sin datos" tranquilizador.
  return false
}

// Consulta las reproducciones de una campaña y guarda el resultado tal cual.
// `auths` son los ids de campaña de DOOHmain (tabla doohmain_remote_campaigns).
export async function consultarYGuardarPlay(input: {
  campanaId: string | null
  auths: string[]
  desde: string
  hasta: string
  usuarioId?: string | null
}): Promise<ConsultaPlay> {
  const tenantId = await tenantActual()
  const r = await consultarStats(input.auths, input.desde, input.hasta)
  const vacio = r.ok ? respuestaVacia(r.payload) : true
  const rows = await q(
    `insert into doohmain_consultas_play
       (tenant_id, tipo, campana_id, auths, desde, hasta, payload, vacio, error, consultado_por)
     values ($1,'stats',$2,$3,$4::date,$5::date,$6::jsonb,$7,$8,$9) returning *`,
    [
      tenantId, input.campanaId, input.auths, input.desde, input.hasta,
      JSON.stringify(r.ok ? r.payload : {}), vacio, r.ok ? null : (r.error ?? 'error'),
      input.usuarioId ?? null,
    ],
  )
  // Candado de facturación para DIGITALES: el proof-of-play es la evidencia
  // comprobatoria de que la campaña salió al aire (equivale a las fotos testigo
  // de las fijas). Con la publicación ya aprobada (reporte) y la OC, completa el
  // candado → LISTA_FACTURAR. Solo si la consulta trajo respuesta (no un error de
  // conexión); un payload vacío igual cuenta como consulta hecha.
  if (input.campanaId && r.ok) {
    await q(
      `update campanas
          set fotos_comprobatorias = true,
              estado_comercial = case
                when oc_recibida and reporte_publicacion then 'LISTA_FACTURAR'::est_comercial_campana
                else estado_comercial end
        where id = $1`,
      [input.campanaId],
    )
  }
  return rowToConsulta(rows[0])
}

// Últimas consultas de una campaña (la más reciente primero).
export async function listarConsultasDeCampana(campanaId: string, limite = 10): Promise<ConsultaPlay[]> {
  const rows = await q(
    `select * from doohmain_consultas_play
      where tenant_id = $1 and campana_id = $2
      order by consultado_en desc limit $3`,
    [await tenantActual(), campanaId, limite],
  )
  return rows.map(rowToConsulta)
}

// Los `auth` de DOOHmain de los creativos de una campaña. Sin esto no hay a qué
// preguntarle: la campaña de SPACES y la de DOOHmain son entidades distintas.
// El puente es `doohmain_remote_campaigns.version` = id del creativo (así lo
// publica doohmain.ts).
//
// OJO: esa tabla es del SDK y NO tiene RLS, así que el tenant se filtra a mano
// sobre `creatividades`. Sin ese filtro, un tenant podría pedir las
// reproducciones de la campaña de otro.
export async function authsDeCampana(campanaId: string): Promise<string[]> {
  const rows = await q(
    `select distinct rc.auth
       from creatividades c
       join doohmain_remote_campaigns rc on rc.version = c.id::text
      where c.campana_id = $1 and c.tenant_id = $2 and rc.auth is not null`,
    [campanaId, await tenantActual()],
  )
  return rows.map((r: any) => r.auth)
}
