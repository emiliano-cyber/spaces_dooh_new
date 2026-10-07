import 'server-only'
import { createHash } from 'node:crypto'
import { qConTenant } from './db'
import { tenantActual } from './tenant'
import { estadoDelModulo } from './space-eye'

// ============================================================================
//  Las campañas vendidas, en los equipos de Space Eyes de su pantalla.
// ----------------------------------------------------------------------------
//  Lo que se sube en Operaciones tiene que reconocerse en la pantalla y
//  fotografiarse: el equipo recibe el arte de cada campaña de su pantalla y,
//  cuando lo ve, manda una foto de prueba al día (aparte de lo programático,
//  que es cualquier imagen nueva).
//
//  Aquí solo se LEE: reservas CONFIRMADA de campañas confirmadas o activas,
//  con su creativo VALIDADO asignado y vigentes de hoy en adelante, en pantallas
//  con código. Cada par campaña-creativo es una campaña de Space Eye con los
//  códigos de sus pantallas. Se manda la lista COMPLETA de la empresa: Space
//  Eye apaga lo que ya no viene (cancelada, retirada, vencida).
//
//  El arte viaja solo cuando es nuevo o cambió (Space Eye lo dice por su
//  huella). Los creativos HTML no tienen imagen que reconocer: esos los cubre
//  la vigilancia de lo nuevo.
//
//  Se dispara al cargar el shell (/api/estado, como las demás tareas de
//  mantenimiento) con un respiro de 2 minutos por empresa, y al momento cuando
//  se asigna o valida un creativo o se confirma una reserva (forzar). Corre
//  APARTE de la petición (no le suma espera a nadie): por eso la empresa se
//  resuelve antes y las consultas la llevan explícita (qConTenant), sin
//  depender de la sesión cuando la respuesta ya salió.
// ============================================================================

const BASE = process.env.SPACE_EYE_BASE_URL ?? ''
const KEY = process.env.SPACE_EYE_KEY ?? ''
const RESPIRO_MS = 2 * 60_000

const ultima = new Map<string, number>()
const enCurso = new Map<string, Promise<ResultadoSync | null>>()

export interface CampanaParaEyes {
  origen_id: string
  nombre: string
  anunciante: string | null
  desde: string
  hasta: string
  codigos: string[]
  sha: string
  creatividad_id: string
}

export interface ResultadoSync {
  campanas: number
  arteSubido: number
  apagadas: number
}

type Fila = {
  campana_id: string
  creatividad_id: string
  campana: string
  creativo: string
  marca: string | null
  desde: string
  hasta: string
  codigos: string[]
  sha: string
}

/** Lo vigente para Space Eyes de una empresa (solo lectura). */
export async function campanasParaEyes(tenant: string): Promise<CampanaParaEyes[]> {
  const filas = await qConTenant<Fila>(
    tenant,
    `select c.id as campana_id, cr.id as creatividad_id, c.nombre as campana, cr.nombre as creativo, c.marca,
            to_char(min(r.fecha_inicio), 'YYYY-MM-DD') as desde,
            to_char(max(r.fecha_fin), 'YYYY-MM-DD') as hasta,
            array_agg(distinct lower(trim(s.codigo_proveedor))) as codigos,
            encode(sha256(convert_to(cr.archivo_url, 'UTF8')), 'hex') as sha
       from reservas r
       join campanas c on c.id = r.campana_id
       join sitios s on s.id = r.sitio_id
       cross join lateral jsonb_array_elements(
         case when jsonb_typeof(r.creativos) = 'array' then r.creativos else '[]'::jsonb end) e
       join creatividades cr on cr.id::text = e->>'creatividadId'
      where r.tenant_id = $1
        and r.estatus = 'CONFIRMADA'
        and c.estado_comercial in ('CONFIRMADA', 'ACTIVA')
        and r.fecha_fin >= current_date
        and cr.estatus_validacion = 'VALIDADA'
        and cr.retirado_en is null
        and cr.archivo_url like 'data:image/%'
        and coalesce(trim(s.codigo_proveedor), '') <> ''
      group by c.id, cr.id, c.nombre, cr.nombre, c.marca, cr.archivo_url
      order by c.id, cr.id`,
    [tenant],
  )
  return filas.map((f) => ({
    origen_id: `${f.campana_id}:${f.creatividad_id}`,
    nombre: `${f.campana} · ${f.creativo}`.slice(0, 200),
    anunciante: f.marca ? f.marca.slice(0, 200) : null,
    desde: f.desde,
    hasta: f.hasta,
    codigos: f.codigos.filter(Boolean),
    sha: f.sha,
    creatividad_id: f.creatividad_id,
  }))
}

// El arte, decodificado del data URL en que lo guarda Operaciones.
async function arteDe(tenant: string, creatividadId: string): Promise<{ bytes: Buffer; tipo: string } | null> {
  const f = await qConTenant<{ archivo_url: string | null }>(
    tenant,
    `select archivo_url from creatividades where id = $1 and tenant_id = $2`,
    [creatividadId, tenant],
  )
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(f[0]?.archivo_url ?? '')
  if (!m) return null
  return { tipo: m[1].toLowerCase(), bytes: Buffer.from(m[2], 'base64') }
}

async function hablar(camino: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE}${camino}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
}

async function sincronizarAhora(tenant: string): Promise<ResultadoSync> {
  const campanas = await campanasParaEyes(tenant)
  const r = await hablar('/api/campaigns/sincronizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origen: `spaceos:${tenant}`,
      campanas: campanas.map(({ creatividad_id: _c, ...resto }) => resto),
    }),
  })
  if (!r.ok) throw new Error(`Space Eye: sincronizar campañas → ${r.status}`)
  const d = (await r.json()) as {
    campanas: { origen_id: string; id: number; necesita_creativo: boolean }[]
    apagadas: number
  }

  let arteSubido = 0
  for (const s of d.campanas.filter((x) => x.necesita_creativo)) {
    const c = campanas.find((x) => x.origen_id === s.origen_id)
    const arte = c && (await arteDe(tenant, c.creatividad_id))
    if (!c || !arte) continue
    const fd = new FormData()
    fd.append('creative', new Blob([new Uint8Array(arte.bytes)], { type: arte.tipo }), 'arte')
    fd.append('origen_sha', c.sha)
    const up = await hablar(`/api/campaigns/${s.id}/creative`, { method: 'POST', body: fd })
    if (up.ok) arteSubido++
    else console.error(`[space-eyes] no se pudo subir el arte de ${c.nombre}: ${up.status}`)
  }
  return { campanas: campanas.length, arteSubido, apagadas: d.apagadas }
}

/**
 * Manda a Space Eye las campañas vigentes de una empresa. Nunca lanza: si Space
 * Eyes no está activo o no responde, no pasa nada y se reintenta en la
 * siguiente carga. `forzar` se salta el respiro (tras asignar un creativo).
 * Sin `tenant`, el de la sesión (resuélvelo ANTES si no vas a esperar).
 */
export async function sincronizarCampanasEyes(
  opts: { forzar?: boolean; tenant?: string | null } = {},
): Promise<ResultadoSync | null> {
  try {
    if (!BASE || !KEY) return null
    const tenant = opts.tenant ?? (await tenantActual())
    if (!tenant) return null
    if (!opts.forzar && Date.now() - (ultima.get(tenant) ?? 0) < RESPIRO_MS) return null
    const curso = enCurso.get(tenant)
    if (curso) return await curso
    if ((await estadoDelModulo()) !== 'activo') return null
    ultima.set(tenant, Date.now())
    const p = sincronizarAhora(tenant)
    enCurso.set(tenant, p)
    try {
      return await p
    } finally {
      enCurso.delete(tenant)
    }
  } catch (e) {
    console.error('[space-eyes] sincronizar campañas:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Tras un cambio que mueve lo que sale en una pantalla (asignar, validar,
 * reemplazar o retirar un creativo; confirmar una reserva): que llegue a los
 * equipos ya, sin esperar el respiro. No espera ni lanza: la empresa se
 * resuelve aquí, dentro de la petición, y lo demás corre aparte.
 */
export async function avisarCambioDeCampanas(): Promise<void> {
  try {
    const tenant = await tenantActual()
    if (tenant) void sincronizarCampanasEyes({ forzar: true, tenant })
  } catch {
    /* sin sesión o sin Space Eyes: la carga del shell lo alcanza */
  }
}

/** Huella del arte tal como la calcula Postgres (para pruebas). */
export function huellaDeArte(archivoUrl: string): string {
  return createHash('sha256').update(archivoUrl, 'utf8').digest('hex')
}
