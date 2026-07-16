import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/creativos-repo.ts — Creativos (imágenes) por campaña: alta,
//  aprobación/rechazo y asignación a un spot reservado.
// ============================================================================

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

// Error de regla de negocio (transición inválida) → el route lo mapea a 409.
export class CreatividadError extends Error {}

function rowToCreatividad(r: any) {
  return {
    id: r.id,
    campanaId: r.campana_id,
    nombre: r.nombre,
    archivoUrl: r.archivo_url,
    codigo: r.codigo ?? null,
    formato: r.formato,
    resolucion: r.resolucion,
    estatusValidacion: r.estatus_validacion,
    rechazadoMotivo: r.rechazado_motivo,
    retiradoEn: r.retirado_en ? iso(r.retirado_en) : null,
    creadoEn: iso(r.creado_en),
  }
}

// Alta de un creativo: imagen (data URL) o código (HTML/UTF). Uno de los dos.
export async function crearCreatividad(input: {
  campanaId: string
  nombre: string
  archivoUrl?: string | null
  codigo?: string | null
  formato?: string | null
  resolucion?: string | null
}) {
  // Máquina de estados (server-side, inverso al guard de imprenta): una campaña
  // FIJA (OOH) no recibe creatividad — su producción es por imprenta. Digital
  // (DOOH) e híbrida sí. La UI ya lo refleja; esto lo enforza también vía API.
  const camp = await q1<any>('select tipo_campana from campanas where id=$1', [input.campanaId])
  if (!camp) throw new CreatividadError('Campaña no encontrada')
  if (camp.tipo_campana === 'OOH') {
    throw new CreatividadError('Una campaña fija (OOH) no recibe creatividad; su producción es por imprenta')
  }
  const rows = await q(
    `insert into creatividades (campana_id, nombre, archivo_url, codigo, formato, resolucion, estatus_validacion, tenant_id)
     values ($1,$2,$3,$4,$5,$6,'PENDIENTE',$7) returning *`,
    [
      input.campanaId,
      input.nombre,
      input.archivoUrl ?? null,
      input.codigo ?? null,
      input.formato ?? null,
      input.resolucion ?? null,
      await tenantActual(),
    ],
  )
  return rowToCreatividad(rows[0])
}

// Aprueba o rechaza un creativo. Al rechazar se guarda el motivo; al aprobar se
// limpia. Si se rechaza, se desasigna de cualquier spot que lo tuviera.
export async function validarCreatividad(id: string, aprobar: boolean, motivo?: string | null) {
  const estatus = aprobar ? 'VALIDADA' : 'RECHAZADA'
  const rows = await q(
    `update creatividades set estatus_validacion=$2, rechazado_motivo=$3 where id=$1 returning *`,
    [id, estatus, aprobar ? null : (motivo ?? null)],
  )
  if (!rows[0]) return null
  if (!aprobar) {
    // Al rechazar, se quita de cualquier spot que lo tuviera asignado.
    await q(
      `update reservas set creativos = coalesce(
         (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
         '[]'::jsonb)`,
      [id],
    )
  }
  return rowToCreatividad(rows[0])
}

// Elimina un creativo: lo desasigna de cualquier spot y lo borra. Devuelve el
// creativo eliminado (para que el llamador lo retire también de DOOHmain).
export async function eliminarCreatividad(id: string) {
  const rows = await q(`delete from creatividades where id=$1 returning *`, [id])
  if (!rows[0]) return null
  await q(
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)`,
    [id],
  )
  return rowToCreatividad(rows[0])
}

// Retiro "honesto": el creativo se dio de baja pero su arte SIGUE en DOOHmain
// (su API no permite quitarlo). No se borra; se marca retirado_en y se desasigna
// de spots, para que el sistema muestre que queda pendiente de quitar en DOOHmain.
export async function retirarCreatividadSoft(id: string) {
  const rows = await q(`update creatividades set retirado_en = now() where id=$1 returning *`, [id])
  if (!rows[0]) return null
  await q(
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)`,
    [id],
  )
  return rowToCreatividad(rows[0])
}

// Reemplaza el arte de un creativo: actualiza su contenido, lo regresa a
// PENDIENTE (debe re-validarse) y lo desasigna de spots. Devuelve el creativo.
export async function reemplazarCreatividad(
  id: string,
  input: {
    nombre?: string | null
    archivoUrl?: string | null
    codigo?: string | null
    formato?: string | null
  },
) {
  const rows = await q(
    `update creatividades set
        nombre = coalesce($2, nombre),
        archivo_url = $3,
        codigo = $4,
        formato = $5,
        estatus_validacion = 'PENDIENTE',
        rechazado_motivo = null
      where id=$1 returning *`,
    [id, input.nombre ?? null, input.archivoUrl ?? null, input.codigo ?? null, input.formato ?? null],
  )
  if (!rows[0]) return null
  await q(
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)`,
    [id],
  )
  return rowToCreatividad(rows[0])
}

// Define los creativos exhibidos en un spot reservado, con cuántas veces cada
// uno. Solo se aceptan creativos VALIDADOS de la misma campaña y con veces > 0.
export async function setCreativosDeReserva(
  reservaId: string,
  creativos: { creatividadId: string; veces: number }[],
) {
  const r = await q1<any>('select campana_id from reservas where id=$1', [reservaId])
  if (!r) return null
  const validos: { creatividadId: string; veces: number }[] = []
  for (const c of creativos ?? []) {
    const veces = Math.round(Number(c?.veces))
    if (!c?.creatividadId || !(veces > 0)) continue
    const ok = await q1<any>(
      `select id from creatividades where id=$1 and campana_id=$2 and estatus_validacion='VALIDADA'`,
      [c.creatividadId, r.campana_id],
    )
    if (ok) validos.push({ creatividadId: c.creatividadId, veces })
  }
  await q(`update reservas set creativos=$2::jsonb where id=$1`, [reservaId, JSON.stringify(validos)])
  return validos
}
