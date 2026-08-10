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
import { esPantallaDigitalSql } from './pantalla-digital-sql'

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
  // Pases diarios pedidos para ESTA pieza en ESTA pantalla (INC-02). Viaja en
  // el resultado porque es la mitad de la trazabilidad: saber que algo se
  // publicó no dice cuánto se publicó, y es lo que se le factura al anunciante.
  cantDia?: number | null
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

  // Preferimos SIEMPRE una imagen sobre HTML: la pantalla de creativos del demo
  // envuelve las imágenes en HTML (imagenAHtml) y DOOHmain no acepta HTML. Si el
  // creativo lleva una imagen embebida (o ES una data:image), subimos la imagen.
  const img = imagenDataUrl(cr)
  if (img) {
    const buf = Buffer.from(img.b64, 'base64')
    const ext = extDeMime(img.mime) ?? 'png'
    const path = join(dir, `${slug(cr.nombre)}.${ext}`)
    await writeFile(path, buf)
    return { path, cleanup }
  }

  // data: que no es imagen (p. ej. data:text/html sin imagen) → archivo tal cual.
  const url: string = cr.archivo_url ?? ''
  const m = url.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i)
  if (m) {
    const mime = m[1].toLowerCase()
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
    const ext = extDeMime(mime) ?? extDeFormato(cr.formato) ?? 'bin'
    const path = join(dir, `${slug(cr.nombre)}.${ext}`)
    await writeFile(path, buf)
    return { path, cleanup }
  }

  // HTML/código inline sin imagen (se sube como .html; DOOHmain puede rechazarlo).
  if (cr.codigo) {
    const path = join(dir, `${slug(cr.nombre)}.html`)
    await writeFile(path, String(cr.codigo), 'utf8')
    return { path, cleanup }
  }

  await cleanup()
  return null
}

// Extrae {mime, b64} de una imagen del creativo, o null. Cubre: (a) archivo_url
// que ES una data:image; (b) imagen embebida en el HTML que genera la UI del demo
// (en `codigo` o en un data:text/html).
function imagenDataUrl(cr: any): { mime: string; b64: string } | null {
  const url: string = cr.archivo_url ?? ''
  const directa = url.match(/^data:(image\/[^;,]+);base64,([\s\S]*)$/i)
  if (directa) return { mime: directa[1].toLowerCase(), b64: directa[2] }

  let html = cr.codigo ? String(cr.codigo) : ''
  if (!html) {
    const mHtml = url.match(/^data:text\/html([^,]*),([\s\S]*)$/i)
    if (mHtml) {
      html = /;base64/i.test(mHtml[1])
        ? Buffer.from(mHtml[2], 'base64').toString('utf8')
        : decodeURIComponent(mHtml[2])
    }
  }
  if (html) {
    const mImg = html.match(/<img[^>]+src="(data:image\/[^";]+;base64,[^"]+)"/i)
    if (mImg) {
      const dm = mImg[1].match(/^data:(image\/[^;]+);base64,([\s\S]+)$/i)
      if (dm) return { mime: dm[1].toLowerCase(), b64: dm[2] }
    }
  }
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
  filepath: string; screen: string; list: string; cantDia?: number | null
}): Promise<any> {
  const cli = [
    '-m', 'doohmain_sdk', 'publish',
    '--version', args.version, '--anunciante', args.anunciante, '--campana', args.campana,
    '--fecha-inicio', args.fi, '--fecha-fin', args.ff,
    '--filepath', args.filepath, '--screen', args.screen, '--list', args.list,
  ]
  // Programación: spots/día → cuota diaria en DOOHmain (solo si el sitio la tiene).
  if (args.cantDia != null && args.cantDia > 0) {
    cli.push('--cant-dia', String(args.cantDia))
  }
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

// ─── Proof of play ──────────────────────────────────────────────────────────
// Pide a DOOHmain las reproducciones y devuelve su payload CRUDO, sin tocarlo.
// A propósito NO se interpreta aquí: al 16-jul-2026 la API siempre responde `[]`
// (nada ha salido al aire todavía), así que no sabemos qué trae un elemento con
// datos. Inventarnos su forma acabaría en números equivocados en la pantalla con
// la que se le cobra al anunciante. Se guarda literal y se modela cuando se vea.
export interface RespuestaPlay {
  ok: boolean
  payload: unknown
  error?: string
}

async function ejecutarSdk(cli: string[]): Promise<any> {
  try {
    const { stdout } = await pexec(PY, cli, { cwd: SDK_DIR, timeout: 120000 })
    return JSON.parse(stdout.trim().split('\n').pop() || '{}')
  } catch (e: any) {
    if (e?.stdout) {
      try {
        return JSON.parse(String(e.stdout).trim().split('\n').pop() || '{}')
      } catch { /* cae abajo */ }
    }
    return { ok: false, error: e?.message ?? 'fallo al invocar el SDK' }
  }
}

// Reproducciones de una o varias campañas (por su `auth` de DOOHmain).
export async function consultarStats(
  auths: string[], desde: string, hasta: string,
): Promise<RespuestaPlay> {
  if (!doohmainHabilitado()) return { ok: false, payload: {}, error: 'La integración con DOOHmain está apagada' }
  if (!auths.length) return { ok: false, payload: {}, error: 'Sin campañas publicadas en DOOHmain' }
  const cli = ['-m', 'doohmain_sdk', 'stats', '--start-date', desde, '--end-date', hasta]
  for (const a of auths) cli.push('--auth', a)
  const r = await ejecutarSdk(cli)
  if (r?.ok === false) return { ok: false, payload: {}, error: r.error ?? 'DOOHmain no respondió' }
  return { ok: true, payload: r?.payload ?? r ?? {} }
}

// Métricas de una o varias pantallas.
export async function consultarMetrics(
  pantallas: string[], desde: string, hasta: string,
): Promise<RespuestaPlay> {
  if (!doohmainHabilitado()) return { ok: false, payload: {}, error: 'La integración con DOOHmain está apagada' }
  if (!pantallas.length) return { ok: false, payload: {}, error: 'Sin pantallas que consultar' }
  const cli = ['-m', 'doohmain_sdk', 'metrics', '--start-date', desde, '--end-date', hasta,
               '--type', 'full', '--zoom', 'days']
  for (const s of pantallas) cli.push('--screen', s)
  const r = await ejecutarSdk(cli)
  if (r?.ok === false) return { ok: false, payload: {}, error: r.error ?? 'DOOHmain no respondió' }
  return { ok: true, payload: r?.payload ?? r ?? {} }
}

// Retira un creativo de DOOHmain (al eliminarlo o antes de reemplazarlo):
// finaliza su campaña (queda fuera del aire) y limpia el tracking. Nunca lanza.
// `version` es el id del creativo (la misma clave con la que se publicó).
export async function retirarCreativoEnDoohmain(
  version: string,
): Promise<{ ok: boolean; estado?: string; error?: string; category?: string }> {
  try {
    const { stdout } = await pexec(PY, ['-m', 'doohmain_sdk', 'retirar', '--version', version], {
      cwd: SDK_DIR,
      timeout: 120000,
    })
    return JSON.parse(stdout.trim().split('\n').pop() || '{}')
  } catch (e: any) {
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

// Publica en DOOHmain LO QUE CADA PANTALLA TIENE ASIGNADO (M14 / INC-02).
//
// Antes mandaba el producto cruzado: cada creativo VALIDADO de la campaña a
// CADA pantalla digital. Dos cosas mal, y las dos importan:
//
//   · No quedaba rastro de qué pieza iba en qué pantalla, porque no había tal
//     cosa: iban todas a todas. El reporte al cliente no podía probar lo que se
//     exhibió, que es justo lo que se le vende.
//   · Sobrevendía el loop. `cantDia` era el total de spots de la pantalla, PARA
//     CADA creativo: dos creativos en una pantalla de 8 pedían 8 pases diarios
//     cada uno, 16 en un loop de 8.
//
// Ahora la unidad es la RESERVA —el slot de esa campaña en esa pantalla— y su
// columna `creativos`, que es `[{creatividadId, veces}]`: exactamente qué sale
// ahí y cuántos pases al día le tocan. `veces` va como `cantDia`, así que el
// reparto que se hizo en la pantalla de Creativos es el que llega al CMS.
//
// Solo pantallas DIGITALES. Los sitios FIJOS (espectaculares, vallas, murales)
// no se suben — misma regla de «digital» que usa el resto del sistema. Una
// campaña OOH no tiene sitios digitales → no publica nada; una HÍBRIDA solo
// publica su segmento digital.
//
// Nunca lanza: devuelve un resultado por (creativo × pantalla) publicado.
export async function publicarCampanaEnDoohmain(campanaId: string): Promise<ResultadoPublicacion[]> {
  const camp = await q1<any>('select id, folio, nombre, cliente_id, fecha_inicio, fecha_fin from campanas where id=$1', [campanaId])
  if (!camp) return []
  const cliente = await q1<any>('select nombre from clientes where id=$1', [camp.cliente_id])
  const anunciante = cliente?.nombre ?? 'Sin cliente'

  // Una fila por (pantalla × creativo asignado). El `join` contra
  // `creatividades` filtra por VALIDADA aquí mismo: un creativo asignado que
  // luego se rechazó no debe salir al aire, y como es un `join` y no un `left
  // join`, esa fila simplemente no aparece — el hueco se detecta abajo.
  //
  // `veces` puede venir como texto dentro del jsonb; se castea explícitamente.
  const asignaciones = await q<any>(
    `select r.id as reserva_id, s.clave_interna, s.nombre as sitio_nombre,
            r.spots_por_dia,
            cr.id as creativo_id, cr.nombre as creativo_nombre,
            cr.archivo_url, cr.codigo, cr.formato,
            (e->>'veces')::int as veces
       from reservas r
       join sitios s on s.id = r.sitio_id
       cross join lateral jsonb_array_elements(
              case when jsonb_typeof(r.creativos) = 'array' then r.creativos
                   else '[]'::jsonb end) e
       join creatividades cr
              on cr.id = (e->>'creatividadId')::uuid
             and cr.campana_id = r.campana_id
             and cr.estatus_validacion = 'VALIDADA'
      where r.campana_id = $1
        and r.estatus <> 'CANCELADA'
        and ${esPantallaDigitalSql('s')}
      order by s.nombre, cr.nombre`,
    [campanaId],
  )

  // Las pantallas digitales que NO tienen ni una pieza publicable: o el slot
  // quedó vacío, o lo único que tenía asignado se rechazó después. Se REPORTAN
  // como fallo en vez de omitirse. Antes esto no podía pasar —iban todos a
  // todas— y saltárselo en silencio dejaría una pantalla contratada sin nada al
  // aire y sin que nadie se enterara.
  const huecos = await q<any>(
    `select s.clave_interna, s.nombre
       from reservas r join sitios s on s.id = r.sitio_id
      where r.campana_id = $1
        and r.estatus <> 'CANCELADA'
        and ${esPantallaDigitalSql('s')}
        and not exists (
          select 1
            from jsonb_array_elements(
                   case when jsonb_typeof(r.creativos) = 'array' then r.creativos
                        else '[]'::jsonb end) e
            join creatividades cr
                   on cr.id = (e->>'creatividadId')::uuid
                  and cr.campana_id = r.campana_id
                  and cr.estatus_validacion = 'VALIDADA')
      order by s.nombre`,
    [campanaId],
  )

  const mapa = screenMap()
  const out: ResultadoPublicacion[] = []

  for (const h of huecos) {
    out.push({
      creativoId: '', creativoNombre: '', sitio: h.clave_interna, screen: null, ok: false,
      error: 'la pantalla no tiene ningún creativo aprobado asignado',
      category: 'validation',
    })
  }

  // Se materializa UNA vez por creativo aunque salga en varias pantallas: es un
  // archivo temporal en disco y bajarlo doce veces para doce pantallas de la
  // misma campaña sería doce veces el mismo trabajo.
  const materiales = new Map<string, Awaited<ReturnType<typeof materializar>>>()
  try {
    for (const a of asignaciones) {
      let mat = materiales.get(a.creativo_id)
      if (mat === undefined) {
        mat = await materializar({
          id: a.creativo_id, nombre: a.creativo_nombre,
          archivo_url: a.archivo_url, codigo: a.codigo, formato: a.formato,
        })
        materiales.set(a.creativo_id, mat)
      }
      if (!mat) {
        out.push({ creativoId: a.creativo_id, creativoNombre: a.creativo_nombre, sitio: a.clave_interna, screen: null, ok: false, error: 'creativo sin contenido subible', category: 'validation' })
        continue
      }
      const screen = mapa[a.clave_interna] ?? DEFAULT_SCREEN
      if (!screen) {
        out.push({ creativoId: a.creativo_id, creativoNombre: a.creativo_nombre, sitio: a.clave_interna, screen: null, ok: false, error: 'sitio sin pantalla DOOHmain mapeada', category: 'validation' })
        continue
      }
      // `veces` manda: es lo que el reparto decidió para ESTA pantalla.
      //
      // Pero SOLO si la reserva tiene programación diaria contratada. Cuando
      // `spots_por_dia` es null no hay cuota pactada —así están hoy todas las
      // reservas de producción—, y ahí la asignación guarda `veces: 1` como
      // simple marca de «esta pieza va aquí». Mandar ese 1 como `--cant-dia`
      // sería IMPONER un pase al día donde antes no se mandaba la bandera y el
      // CMS ponía los que cupieran: pasaríamos de la pauta completa a uno.
      //
      // O sea: sin cuota contratada, no se dicta cuota. Igual que antes.
      const cantDia = a.spots_por_dia == null
        ? null
        : (Number.isFinite(Number(a.veces)) && Number(a.veces) > 0
            ? Number(a.veces)
            : Number(a.spots_por_dia))
      const r = await ejecutarPublish({
        version: a.creativo_id, anunciante, campana: camp.nombre,
        fi: fecha(camp.fecha_inicio), ff: fecha(camp.fecha_fin),
        filepath: mat.path, screen, list: camp.folio,
        cantDia,
      })
      out.push({
        creativoId: a.creativo_id, creativoNombre: a.creativo_nombre, sitio: a.clave_interna, screen, cantDia,
        ok: r.ok === true, auth: r.auth, mediaId: r.media_id, estado: r.estado,
        error: r.ok === true ? undefined : r.error, category: r.category,
      })
    }
  } finally {
    for (const mat of materiales.values()) if (mat) await mat.cleanup()
  }
  return out
}
