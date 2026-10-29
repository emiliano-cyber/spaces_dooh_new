import 'server-only'
import { pool, q, q1, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { esPantallaDigitalSql } from './pantalla-digital-sql'
import { asignacionDePantalla, autollenadoDeSpot } from '@/lib/reparto-creativos'

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
// limpia. Si se rechaza, se desasigna de cualquier spot que lo tuviera; si se
// aprueba, entra en la rotación de los spots digitales (`autoasignarRotacion`).
export async function validarCreatividad(id: string, aprobar: boolean, motivo?: string | null) {
  const estatus = aprobar ? 'VALIDADA' : 'RECHAZADA'
  // v0.12.3 · si YA estaba aprobado, volver a aprobarlo no añade nada nuevo a la
  // rotación: los «aprobados de antes» lo incluyen.
  const previo = await q1<{ estatus_validacion: string }>('select estatus_validacion from creatividades where id=$1', [id])
  const rows = await q(
    `update creatividades set estatus_validacion=$2, rechazado_motivo=$3 where id=$1 returning *`,
    [id, estatus, aprobar ? null : (motivo ?? null)],
  )
  if (!rows[0]) return null
  const campanaId: string = rows[0].campana_id

  if (!aprobar) {
    // Al rechazar, se quita de cualquier spot que lo tuviera asignado.
    //
    // ACOTADO A SU CAMPAÑA. Este `update` iba sin `where` ninguno: reescribía
    // la columna `creativos` de TODAS las reservas del tenant en cada rechazo.
    // El resultado salía igual —el filtro del `jsonb_agg` no encuentra el id en
    // las demás y las deja como estaban—, así que no corrompía nada, pero era
    // una escritura masiva sobre filas que no tienen nada que ver, en cada
    // clic de «rechazar». Un creativo solo puede estar asignado a reservas de
    // su propia campaña, así que ése es el alcance real.
    await q(
      `update reservas set creativos = coalesce(
         (select jsonb_agg(e) from jsonb_array_elements(creativos) e
           where e->>'creatividadId' <> $1),
         '[]'::jsonb)
        where campana_id = $2
          and creativos @> jsonb_build_array(jsonb_build_object('creatividadId', $1::text))`,
      [id, campanaId],
    )
    return rowToCreatividad(rows[0])
  }

  const autoasignadas = await autoasignarRotacion(campanaId, id, previo?.estatus_validacion === 'VALIDADA')
  // `autoasignadas` viaja aparte del creativo para que la ruta pueda dejarlo en
  // bitácora A NOMBRE DE QUIEN APROBÓ. La asignación la calcula el sistema,
  // pero la provoca una persona con un clic, y en un historial que se usa como
  // prueba eso no es lo mismo que «Sistema».
  return Object.assign(rowToCreatividad(rows[0]), { autoasignadas })
}

// ─── Autoasignación: los creativos aprobados ROTAN en cada spot ─────────────
//
// M14 / INC-02 (hasta el 22/10): con EXACTAMENTE UN creativo aprobado, ése iba
// solo a todas las pantallas; con dos o más no se hacía nada, porque qué pieza
// en qué pantalla «era una decisión de negocio». La decisión la tomó el dueño el
// 2026-10-22 (v0.12.3): «debe de ser autoseleccionable ya que pueden ser varios
// creativos» — TODOS los aprobados rotan en partes iguales.
//
// La regla de cada spot está en `autollenadoDeSpot` (`lib/reparto-creativos.ts`,
// con prueba): uno VACÍO recibe todos; uno con la rotación automática de antes
// suma al nuevo; uno ajustado a mano no se toca. Solo reservas DIGITALES: una
// lona no rota. El total que se reparte es `spots_por_dia` (sin pauta, una
// marca de 1 por creativo), el mismo que el reparto de antes.
async function autoasignarRotacion(campanaId: string, id: string, yaEstabaAprobado: boolean): Promise<number> {
  const aprobados = (
    await q<{ id: string }>(
      `select id from creatividades
        where campana_id = $1 and estatus_validacion = 'VALIDADA' and retirado_en is null
        order by creado_en, id`,
      [campanaId],
    )
  ).map((r) => String(r.id))
  if (aprobados.length === 0) return 0
  const antes = yaEstabaAprobado ? aprobados : aprobados.filter((x) => x !== id)

  const reservas = await q<{ id: string; creativos: unknown; spots_por_dia: number | null }>(
    `select r.id, r.creativos, r.spots_por_dia
       from reservas r join sitios s on s.id = r.sitio_id
      where r.campana_id = $1 and r.estatus <> 'CANCELADA' and ${esPantallaDigitalSql('s')}`,
    [campanaId],
  )
  let asignadas = 0
  for (const r of reservas) {
    const actual = (Array.isArray(r.creativos) ? r.creativos : []).map((c: any) => ({
      creatividadId: String(c?.creatividadId ?? ''),
      veces: Number(c?.veces ?? 0),
    }))
    const nuevo = autollenadoDeSpot({
      actual,
      aprobadosAntes: antes,
      aprobadosAhora: aprobados,
      spots: r.spots_por_dia != null ? Number(r.spots_por_dia) : null,
    })
    if (!nuevo) continue
    await q(`update reservas set creativos = $2::jsonb where id = $1`, [r.id, JSON.stringify(nuevo)])
    asignadas++
  }
  return asignadas
}

/**
 * ¿El creativo existe en ESTA organización? La RLS acota `creatividades`, y el
 * `tenant_id` va además como segunda capa. Un id que no es uuid no llega a la
 * base. Lo usan las rutas de borrar y reemplazar ANTES de tocar DOOHmain
 * (v0.12.3): antes se retiraba en DOOHmain con cualquier id que llegara.
 */
export async function esCreativoPropio(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false
  return !!(await q1('select 1 from creatividades where id = $1 and tenant_id = $2', [id, await tenantActual()]))
}

// Igual que `esCreativoPropio`, pero devuelve el nombre (o null si no es de
// esta organización) para el renglón de Actividad: un uuid ahí no dice nada.
export async function nombreDeCreativoPropio(id: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
  const r = await q1<{ nombre: string }>(
    'select nombre from creatividades where id = $1 and tenant_id = $2',
    [id, await tenantActual()],
  )
  return r ? r.nombre : null
}

// Elimina un creativo: lo desasigna de cualquier spot y lo borra. Devuelve el
// creativo eliminado (para que el llamador lo retire también de DOOHmain).
export async function eliminarCreatividad(id: string) {
  const rows = await q(`delete from creatividades where id=$1 returning *`, [id])
  if (!rows[0]) return null
  await q(
    // Acotado a las reservas que DE VERDAD lo tienen (ver la nota en
    // `validarCreatividad`): sin el `where`, esto reescribía la columna de
    // todas las reservas del tenant en cada baja.
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)
      where creativos @> jsonb_build_array(jsonb_build_object('creatividadId', $1::text))`,
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
    // Acotado a las reservas que DE VERDAD lo tienen (ver la nota en
    // `validarCreatividad`): sin el `where`, esto reescribía la columna de
    // todas las reservas del tenant en cada baja.
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)
      where creativos @> jsonb_build_array(jsonb_build_object('creatividadId', $1::text))`,
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
    // Acotado a las reservas que DE VERDAD lo tienen (ver la nota en
    // `validarCreatividad`): sin el `where`, esto reescribía la columna de
    // todas las reservas del tenant en cada baja.
    `update reservas set creativos = coalesce(
       (select jsonb_agg(e) from jsonb_array_elements(creativos) e where e->>'creatividadId' <> $1),
       '[]'::jsonb)
      where creativos @> jsonb_build_array(jsonb_build_object('creatividadId', $1::text))`,
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

// ─── Reparto masivo: asignar de golpe a todas las pantallas de la campaña ────
//
// Asignar era pantalla por pantalla, y una campaña de doce pantallas con dos
// creativos son veinticuatro campos a mano. De ahí salían las campañas
// Publicadas con todos los slots «Sin asignar» de la auditoría (M14): no porque
// a nadie le diera igual, sino porque hacerlo bien costaba media tarde. El
// guard de `enviarADominio` impide publicar así; esto es la otra mitad.
//
// TODO EN UNA TRANSACCIÓN, y no doce llamadas desde el navegador: con llamadas
// sueltas, un fallo a mitad deja la campaña con seis pantallas asignadas y seis
// no, que es el peor estado posible — parece hecho y el guard la sigue
// bloqueando nombrando solo algunas.
//
// `soloVacias` existe para el caso real de retomar una campaña a medias: ya
// ajustaste tres pantallas a mano y no quieres que el reparto te las pise.
export interface ResultadoReparto {
  asignadas: number
  omitidasPorTenerYa: number
  sinSlots: string[]
}

export async function repartirCreativosEnCampana(
  campanaId: string,
  creatividadIds: string[],
  soloVacias: boolean,
): Promise<ResultadoReparto | null> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    const camp = await client.query('select id from campanas where id=$1', [campanaId])
    if (camp.rowCount === 0) {
      await client.query('rollback')
      return null
    }

    // Solo creativos de ESTA campaña y APROBADOS — la misma regla que
    // `setCreativosDeReserva` aplica de a uno. Se filtra contra la base y no
    // contra lo que mande el cliente: el id llega del navegador.
    //
    // Se conserva el ORDEN en que los eligió el usuario, porque el reparto da
    // el resto a los primeros: poner un creativo delante es cómo se decide
    // cuál sale más veces cuando los spots no dividen exacto.
    const ids = (creatividadIds ?? []).filter(Boolean)
    const aprobados = await client.query<{ id: string }>(
      `select id from creatividades
        where campana_id = $1 and estatus_validacion = 'VALIDADA'
          and retirado_en is null
          and id = any($2::uuid[])`,
      [campanaId, ids],
    )
    const validos = new Set(aprobados.rows.map((r) => r.id))
    const elegidos = ids.filter((id) => validos.has(id))
    if (elegidos.length === 0) {
      // El `catch` de abajo hace el rollback; lanzar aquí y deshacer allí evita
      // dos caminos de rollback que haya que mantener sincronizados.
      throw new CreatividadError(
        'Ninguno de los creativos elegidos está aprobado en esta campaña.',
      )
    }

    // Las pantallas que el guard de M14 va a EXIGIR. Mismo predicado, de
    // `pantalla-digital-sql`, para que no pueda quedar una fuera del reparto y
    // dentro del guard — eso sería un bloqueo sin salida para el usuario.
    const reservas = await client.query<{
      id: string
      spots_reservados: number | null
      nombre: string
      tiene: number
    }>(
      `select r.id, r.spots_reservados, s.nombre,
              jsonb_array_length(
                case when jsonb_typeof(r.creativos) = 'array' then r.creativos
                     else '[]'::jsonb end
              ) as tiene
         from reservas r
         join sitios s on s.id = r.sitio_id
        where r.campana_id = $1
          and r.estatus <> 'CANCELADA'
          and ${esPantallaDigitalSql('s')}
        order by s.nombre`,
      [campanaId],
    )

    let asignadas = 0
    let omitidasPorTenerYa = 0
    const sinSlots: string[] = []

    for (const r of reservas.rows) {
      if (soloVacias && r.tiene > 0) {
        omitidasPorTenerYa++
        continue
      }
      const asignacion = asignacionDePantalla(elegidos, r.spots_reservados)
      if (asignacion.length === 0) {
        // Digital con 0 slots capturados: no se le inventan repeticiones que no
        // caben en ningún loop. Se NOMBRA para que se pueda corregir, porque el
        // guard sí se la va a exigir después y si no, el usuario no sabría cuál.
        sinSlots.push(r.nombre)
        continue
      }
      await client.query(`update reservas set creativos = $2::jsonb where id = $1`, [
        r.id,
        JSON.stringify(asignacion),
      ])
      asignadas++
    }

    await client.query('commit')
    return { asignadas, omitidasPorTenerYa, sinSlots }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
