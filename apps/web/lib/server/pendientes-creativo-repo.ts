import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import { esPantallaDigitalSql } from './pantalla-digital-sql'
import type { DatosPendientes } from '@/lib/pendientes-creativo'

// ============================================================================
//  lib/server/pendientes-creativo-repo.ts — Las filas con las que se DERIVA la
//  «tarea 1» del flujo del creativo (FLUJO-CREA, 20/11). La regla vive en
//  `lib/pendientes-creativo.ts`; aquí solo se lee, con sesión.
// ----------------------------------------------------------------------------
//  Todo con `q` (RLS del tenant de la sesión) y, además, `tenant_id = $1` en
//  cada tabla: un pendiente de otra organización no aparece ni aunque la RLS
//  fallara. Solo campañas CONFIRMADA/ACTIVA, que son las únicas que la regla
//  mira; así la lectura no crece con el histórico. `campanaId` acota a una
//  campaña (para el aviso al aprobar).
//
//  EL ORIGEN DEL CREATIVO. `creatividades` no guarda quién lo subió, y el envío
//  del cliente se BORRA al aprobarlo (`tomarEnvioPendiente`). Lo que sí queda
//  es la bitácora: la ruta de aprobación anota «Aprobó creativo enviado por el
//  cliente» con el NOMBRE del creativo en el mismo instante en que lo crea.
//  Se toma como CLIENTE el creativo que tiene esa acción, con su nombre, en la
//  misma organización y dentro de los 10 minutos siguientes a su alta. Es una
//  deducción, no un dato: dos creativos con el mismo nombre subidos en esos 10
//  minutos se confundirían. La forma exacta es una columna de origen en
//  `creatividades` (migración aparte, pendiente de decisión del dueño).
// ============================================================================

export const ACCION_APROBO_ENVIO_CLIENTE = 'Aprobó creativo enviado por el cliente'

export async function leerDatosPendientes(campanaId?: string | null): Promise<DatosPendientes> {
  const t = await tenantActual()
  const soloUna = campanaId ?? null
  const campanas = await q<any>(
    `select id, nombre, folio, tipo_campana, estado_comercial, fecha_inicio::text as inicio, enviada_dominio
       from campanas
      where tenant_id = $1 and estado_comercial in ('CONFIRMADA','ACTIVA')
        and ($2::uuid is null or id = $2::uuid)`,
    [t, soloUna],
  )
  const ids = campanas.map((c) => String(c.id))
  if (ids.length === 0) return { campanas: [], reservas: [], creativos: [], envios: [], ordenes: [] }

  const [reservas, creativos, envios, ordenes] = await Promise.all([
    q<any>(
      `select r.campana_id, r.sitio_id, s.nombre as sitio_nombre, s.ancho, s.alto, r.creativos,
              ${esPantallaDigitalSql('s')} as digital
         from reservas r
         join sitios s on s.id = r.sitio_id and s.tenant_id = r.tenant_id
        where r.tenant_id = $1 and r.campana_id = any($2::uuid[]) and r.estatus <> 'CANCELADA'
        order by s.nombre`,
      [t, ids],
    ),
    q<any>(
      `select cr.id, cr.campana_id, cr.nombre, cr.estatus_validacion, cr.retirado_en is not null as retirado,
              exists (
                select 1 from acciones a
                 where a.tenant_id = cr.tenant_id
                   and a.accion = $3
                   and a.entidad = cr.nombre
                   and a.timestamp >= cr.creado_en - interval '1 minute'
                   and a.timestamp <= cr.creado_en + interval '10 minutes'
              ) as del_cliente
         from creatividades cr
        where cr.tenant_id = $1 and cr.campana_id = any($2::uuid[])
        order by cr.creado_en asc`,
      [t, ids, ACCION_APROBO_ENVIO_CLIENTE],
    ),
    q<any>(
      `select e.id, e.campana_id, e.sitio_id, s.nombre as sitio_nombre, e.nombre_archivo
         from envios_creativo_cliente e
         left join sitios s on s.id = e.sitio_id and s.tenant_id = e.tenant_id
        where e.tenant_id = $1 and e.campana_id = any($2::uuid[]) and e.estatus = 'PENDIENTE'
        order by e.creado_en asc`,
      [t, ids],
    ),
    q<any>(
      `select campana_id, sitio_id from ordenes_impresion
        where tenant_id = $1 and campana_id = any($2::uuid[])`,
      [t, ids],
    ),
  ])

  const num = (v: unknown) => (v == null ? null : Number(v))
  return {
    campanas: campanas.map((c) => ({
      id: String(c.id),
      nombre: c.nombre,
      folio: c.folio ?? null,
      tipo: c.tipo_campana ?? 'OOH',
      estado: c.estado_comercial,
      inicio: c.inicio ?? null,
      enviadaDominio: c.enviada_dominio === true,
    })),
    reservas: reservas.map((r) => ({
      campanaId: String(r.campana_id),
      sitioId: String(r.sitio_id),
      sitioNombre: r.sitio_nombre ?? null,
      digital: r.digital === true,
      ancho: num(r.ancho),
      alto: num(r.alto),
      creativos: (Array.isArray(r.creativos) ? r.creativos : [])
        .map((x: any) => String(x?.creatividadId ?? ''))
        .filter(Boolean),
    })),
    creativos: creativos.map((c) => ({
      id: String(c.id),
      campanaId: String(c.campana_id),
      nombre: c.nombre,
      estatus: c.estatus_validacion,
      origen: c.del_cliente ? ('CLIENTE' as const) : ('INTERNO' as const),
      retirado: c.retirado === true,
    })),
    envios: envios.map((e) => ({
      id: String(e.id),
      campanaId: String(e.campana_id),
      sitioId: e.sitio_id ?? null,
      sitioNombre: e.sitio_nombre ?? null,
      nombreArchivo: e.nombre_archivo,
    })),
    ordenes: ordenes.map((o) => ({ campanaId: String(o.campana_id), sitioId: o.sitio_id ?? null })),
  }
}
