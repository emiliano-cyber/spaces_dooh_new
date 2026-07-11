// Cableado con el SDK de DOOHmain (doohmain_sdk/). Al aprobar la publicación de
// una campaña, se publica cada creativo validado en cada pantalla, invocando el
// SDK Python por SUBPROCESO (mismo contrato JSON del CLI). La idempotencia la
// resuelve el SDK contra sus tablas (misma Postgres 5433 que este backend).
//
// Está detrás de un flag (DOOHMAIN_PUBLISH_ENABLED=1): si no, no hace nada.
//
// Config por entorno:
//   DOOHMAIN_PUBLISH_ENABLED   '1' para activar
//   DOOHMAIN_PY                ruta del python del venv del SDK
//   DOOHMAIN_SDK_DIR           carpeta que contiene doohmain_sdk/ (raíz del repo)
//   DOOHMAIN_SCREEN_MAP        JSON { "<clave_interna sitio>": "<nombre pantalla DOOHmain>" }
//   DOOHMAIN_DEFAULT_SCREEN    pantalla por defecto si el sitio no está en el mapa
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { q, q1 } from './db'

const pexec = promisify(execFile)

const PY = process.env.DOOHMAIN_PY || 'python'
const SDK_DIR = process.env.DOOHMAIN_SDK_DIR || process.cwd()
const DEFAULT_SCREEN = process.env.DOOHMAIN_DEFAULT_SCREEN || null

function screenMap(): Record<string, string> {
  try {
    return JSON.parse(process.env.DOOHMAIN_SCREEN_MAP || '{}')
  } catch {
    return {}
  }
}

export function doohmainHabilitado(): boolean {
  return process.env.DOOHMAIN_PUBLISH_ENABLED === '1'
}

export interface ResultadoPublicacion {
  creativoId: string
  creativoNombre: string
  sitio: string
  screen: string | null
  ok: boolean
  auth?: string
  mediaId?: number
  estado?: string
  error?: string
  category?: string
}

// Escribe el creativo (data URL o HTML inline) a un archivo temporal para que el
// SDK pueda subirlo. Devuelve la ruta y su función de limpieza, o null si no hay
// contenido materializable.
async function materializar(cr: any): Promise<{ path: string; cleanup: () => Promise<void> } | null> {
  const dir = await mkdtemp(join(tmpdir(), 'doohmain-'))
  const cleanup = () => rm(dir, { recursive: true, force: true })

  const url: string = cr.archivo_url ?? ''
  const m = url.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i)
  if (m) {
    const mime = m[1].toLowerCase()
    const isB64 = !!m[2]
    const buf = isB64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
    const ext = extDeMime(mime) ?? extDeFormato(cr.formato) ?? 'bin'
    const path = join(dir, `${slug(cr.nombre)}.${ext}`)
    await writeFile(path, buf)
    return { path, cleanup }
  }
  if (cr.codigo) {
    const path = join(dir, `${slug(cr.nombre)}.html`)
    await writeFile(path, String(cr.codigo), 'utf8')
    return { path, cleanup }
  }
  await cleanup()
  return null
}

function extDeMime(mime: string): string | null {
  const map: Record<string, string> = {
    'text/html': 'html', 'image/png': 'png', 'image/jpeg': 'jpg',
    'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4',
  }
  return map[mime] ?? null
}
function extDeFormato(formato?: string | null): string | null {
  if (!formato) return null
  const f = formato.toLowerCase()
  if (f.includes('html')) return 'html'
  if (f.includes('png')) return 'png'
  if (f.includes('jpg') || f.includes('jpeg')) return 'jpg'
  if (f.includes('mp4')) return 'mp4'
  return null
}
function slug(s?: string | null): string {
  return (s || 'creativo').replace(/[^\w.-]+/g, '_').slice(0, 40)
}
function fecha(v: any): string {
  return new Date(v).toISOString().slice(0, 10)
}

// Ejecuta el CLI del SDK y devuelve su JSON (éxito o error, mismo contrato).
async function ejecutarPublish(args: {
  version: string; anunciante: string; campana: string; fi: string; ff: string
  filepath: string; screen: string; list: string
}): Promise<any> {
  const cli = [
    '-m', 'doohmain_sdk', 'publish',
    '--version', args.version, '--anunciante', args.anunciante, '--campana', args.campana,
    '--fecha-inicio', args.fi, '--fecha-fin', args.ff,
    '--filepath', args.filepath, '--screen', args.screen, '--list', args.list,
  ]
  try {
    const { stdout } = await pexec(PY, cli, { cwd: SDK_DIR, timeout: 120000 })
    return JSON.parse(stdout.trim().split('\n').pop() || '{}')
  } catch (e: any) {
    // El CLI imprime JSON aun al fallar (exit 1); execFile lo trae en e.stdout.
    if (e?.stdout) {
      try {
        return JSON.parse(String(e.stdout).trim().split('\n').pop() || '{}')
      } catch {
        /* cae abajo */
      }
    }
    return { ok: false, error: e?.message ?? 'fallo al invocar el SDK', category: 'network' }
  }
}

// Publica todos los creativos VALIDADOS de la campaña en las pantallas de sus
// sitios. Nunca lanza: devuelve un resultado por (creativo × pantalla).
export async function publicarCampanaEnDoohmain(campanaId: string): Promise<ResultadoPublicacion[]> {
  const camp = await q1<any>('select id, folio, nombre, cliente_id, fecha_inicio, fecha_fin from campanas where id=$1', [campanaId])
  if (!camp) return []
  const cliente = await q1<any>('select nombre from clientes where id=$1', [camp.cliente_id])
  const anunciante = cliente?.nombre ?? 'Sin cliente'

  const creativos = await q<any>(
    "select id, nombre, archivo_url, codigo, formato from creatividades where campana_id=$1 and estatus_validacion='VALIDADA'",
    [campanaId],
  )
  const sitios = await q<any>(
    'select distinct s.id, s.clave_interna, s.nombre from reservas r join sitios s on s.id = r.sitio_id where r.campana_id=$1',
    [campanaId],
  )

  const mapa = screenMap()
  const out: ResultadoPublicacion[] = []

  for (const cr of creativos) {
    const mat = await materializar(cr)
    if (!mat) {
      out.push({ creativoId: cr.id, creativoNombre: cr.nombre, sitio: '', screen: null, ok: false, error: 'creativo sin contenido subible', category: 'validation' })
      continue
    }
    try {
      for (const s of sitios) {
        const screen = mapa[s.clave_interna] ?? DEFAULT_SCREEN
        if (!screen) {
          out.push({ creativoId: cr.id, creativoNombre: cr.nombre, sitio: s.clave_interna, screen: null, ok: false, error: 'sitio sin pantalla DOOHmain mapeada', category: 'validation' })
          continue
        }
        const r = await ejecutarPublish({
          version: cr.id, anunciante, campana: camp.nombre,
          fi: fecha(camp.fecha_inicio), ff: fecha(camp.fecha_fin),
          filepath: mat.path, screen, list: camp.folio,
        })
        out.push({
          creativoId: cr.id, creativoNombre: cr.nombre, sitio: s.clave_interna, screen,
          ok: r.ok === true, auth: r.auth, mediaId: r.media_id, estado: r.estado,
          error: r.ok === true ? undefined : r.error, category: r.category,
        })
      }
    } finally {
      await mat.cleanup()
    }
  }
  return out
}
