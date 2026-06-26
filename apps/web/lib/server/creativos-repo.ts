import 'server-only'
import { q, q1 } from './db'

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
    `insert into creatividades (campana_id, nombre, archivo_url, codigo, formato, resolucion, estatus_validacion)
     values ($1,$2,$3,$4,$5,$6,'PENDIENTE') returning *`,
    [
      input.campanaId,
      input.nombre,
      input.archivoUrl ?? null,
      input.codigo ?? null,
      input.formato ?? null,
      input.resolucion ?? null,
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
