import 'server-only'
import { AppError } from './errores'

// ============================================================================
//  lib/server/geo-buscar.ts — Buscar una dirección y devolver candidatos con
//  coordenadas.  NEG-01.
// ----------------------------------------------------------------------------
//  Sin clave de Google —que es el caso de hoy en toda la flota, y la decisión
//  del dueño fue que cada owner ponga la suya cuando quiera—, se busca en
//  Nominatim, el buscador de OpenStreetMap. Su política de uso pide:
//   · UNA consulta por segundo como máximo, en total;
//   · que la aplicación se identifique (User-Agent);
//   · nada de buscar mientras se teclea.
//  Por eso la búsqueda va por el SERVIDOR y no desde el navegador: el ritmo solo
//  se puede garantizar en un punto. De paso, la CSP no se abre a ningún host.
//
//  Lo que devuelve son CANDIDATOS. La ubicación que se guarda es la que la
//  persona confirma —o arrastra— en el mapa (`negociacion-repo.ts`), no la de
//  aquí. Con OpenStreetMap se podría guardar tal cual (ODbL), pero con Google
//  no, y el contrato tiene que ser el mismo para los dos.
//
//  El estado (memoria, ritmo, tope por persona) es de este proceso: una
//  instancia es UN proceso de Node, igual que `rate-limit.ts`.
// ============================================================================

export interface Candidato {
  nombre: string
  lat: number
  lng: number
}

export interface ResultadoBusqueda {
  proveedor: 'osm'
  resultados: Candidato[]
}

const URL_POR_OMISION = 'https://nominatim.openstreetmap.org/search'
const MIN_ENTRE_CONSULTAS_MS = 1_000
const TOPE_POR_PERSONA = 30
const VENTANA_PERSONA_MS = 10 * 60_000
const MEMORIA_MS = 24 * 60 * 60_000
const MEMORIA_MAX = 500
const TIEMPO_MAXIMO_MS = 6_000

let ultimaConsulta = 0
const memoria = new Map<string, { hasta: number; r: ResultadoBusqueda }>()
const porPersona = new Map<string, { n: number; hasta: number }>()

/** Solo para las pruebas: el estado vive en el módulo. */
export function _reiniciarGeo() {
  ultimaConsulta = 0
  memoria.clear()
  porPersona.clear()
}

const normalizar = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase()

function contarPersona(usuarioId: string) {
  const ahora = Date.now()
  const e = porPersona.get(usuarioId)
  if (!e || e.hasta <= ahora) {
    porPersona.set(usuarioId, { n: 1, hasta: ahora + VENTANA_PERSONA_MS })
    return
  }
  if (e.n >= TOPE_POR_PERSONA) {
    throw new AppError('Llevas muchas búsquedas seguidas: espera unos minutos', 429)
  }
  e.n++
}

export async function buscarDireccion(consulta: string, usuarioId: string): Promise<ResultadoBusqueda> {
  const q = consulta.trim().replace(/\s+/g, ' ')
  if (q.length < 3 || q.length > 200) {
    throw new AppError('Escribe una dirección de entre 3 y 200 letras', 400)
  }
  contarPersona(usuarioId)

  const clave = normalizar(q)
  const guardado = memoria.get(clave)
  if (guardado && guardado.hasta > Date.now()) return guardado.r

  // UNA por segundo en total, de quien sea: es la política del servicio, y si
  // no se respeta bloquean la IP del servidor para toda la organización.
  const ahora = Date.now()
  if (ahora - ultimaConsulta < MIN_ENTRE_CONSULTAS_MS) {
    throw new AppError('El buscador está ocupado: vuelve a intentar en un segundo', 429)
  }
  ultimaConsulta = ahora

  const url = new URL(process.env.GEO_BUSCADOR_URL || URL_POR_OMISION)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', process.env.GEO_BUSCADOR_PAISES || 'mx')
  url.searchParams.set('accept-language', 'es')
  const contacto = process.env.GEO_BUSCADOR_CONTACTO
  if (contacto) url.searchParams.set('email', contacto)

  let filas: unknown
  try {
    const r = await fetch(url.toString(), {
      headers: { 'user-agent': `SPACE-OS/${process.env.SPACE_OS_VERSION || 'dev'}`, accept: 'application/json' },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    filas = await r.json()
  } catch {
    // Un fallo NO se guarda en memoria: la próxima vez se vuelve a preguntar.
    throw new AppError('El buscador de direcciones no respondió. Puedes marcar el punto directamente en el mapa', 502)
  }

  const resultados: Candidato[] = (Array.isArray(filas) ? filas : [])
    .map((f: any) => ({ nombre: String(f?.display_name ?? '').slice(0, 300), lat: Number(f?.lat), lng: Number(f?.lon) }))
    .filter(
      (c) => c.nombre && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180,
    )

  const res: ResultadoBusqueda = { proveedor: 'osm', resultados }
  if (memoria.size >= MEMORIA_MAX) memoria.delete(memoria.keys().next().value as string)
  memoria.set(clave, { hasta: Date.now() + MEMORIA_MS, r: res })
  return res
}
