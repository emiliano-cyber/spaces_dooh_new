import 'server-only'
import { AppError } from './errores'
import { resolverEnlaceCorto } from './geo-enlace'
import { interpretarUbicacion } from '@/lib/interpretar-ubicacion'

// ============================================================================
//  lib/server/geo-buscar.ts — Buscar una dirección y devolver candidatos con
//  coordenadas.  NEG-01, y UBIC-01 (29/10) para coordenadas, enlaces y Google.
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
//  CON clave (`GOOGLE_MAPS_SERVIDOR_KEY` en el `app.env` de la instancia, ADR
//  0041) se pregunta a la Geocoding API de Google, también desde el servidor:
//  la clave NUNCA llega al navegador, y por eso es una clave de SERVIDOR
//  (restringida por IP y por API en Google Cloud), no la «de navegador»
//  restringida por dominio que describe el ADR para el día que haya mapas de
//  Google en pantalla. Se lee en cada búsqueda, no al arrancar: es tiempo de
//  ejecución, y una imagen sirve igual con clave que sin ella.
//
//  Antes de salir a la red se mira qué pegó la persona
//  (`lib/interpretar-ubicacion.ts`): unas coordenadas o un enlace largo de
//  Google Maps se contestan aquí mismo, sin red; un enlace corto se sigue en
//  `geo-enlace.ts`; solo una dirección va al buscador.
//
//  Lo que devuelve son CANDIDATOS. La ubicación que se guarda es la que la
//  persona confirma —o arrastra— en el mapa (`negociacion-repo.ts`), no la de
//  aquí. Con OpenStreetMap se podría guardar tal cual (ODbL), pero con Google
//  no —sus términos solo dejan guardar sin límite el `place_id`; las
//  coordenadas, en caché temporal—, y el contrato tiene que ser el mismo para
//  los dos. Por eso un candidato de Google trae su `placeId`.
//
//  El estado (memoria, ritmo, tope por persona) es de este proceso: una
//  instancia es UN proceso de Node, igual que `rate-limit.ts`.
// ============================================================================

export interface Candidato {
  nombre: string
  lat: number
  lng: number
  /** Solo con Google: lo único que sus términos dejan guardar sin límite. */
  placeId?: string
}

export interface ResultadoBusqueda {
  /** `coordenadas` y `enlace` no salen de un buscador: los pegó la persona. */
  proveedor: 'osm' | 'google' | 'coordenadas' | 'enlace'
  resultados: Candidato[]
}

const URL_POR_OMISION = 'https://nominatim.openstreetmap.org/search'
const URL_GOOGLE = 'https://maps.googleapis.com/maps/api/geocode/json'
const MIN_ENTRE_CONSULTAS_MS = 1_000
const TOPE_POR_PERSONA = 30
const VENTANA_PERSONA_MS = 10 * 60_000
const MEMORIA_MS = 24 * 60 * 60_000
const MEMORIA_MAX = 500
const TIEMPO_MAXIMO_MS = 6_000
// Un enlace largo de Google Maps pasa con facilidad de 200 letras (todo el
// `data=!3m1!4b1…`); una dirección, no.
const MAX_ENLACE = 2_000

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

/** La clave de Google de ESTA instancia, o null. Vacía o con espacios = sin clave. */
function claveGoogle(): string | null {
  const k = process.env.GOOGLE_MAPS_SERVIDOR_KEY?.trim()
  return k ? k : null
}

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

const valido = (c: Candidato) =>
  c.nombre && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180

export async function buscarDireccion(consulta: string, usuarioId: string): Promise<ResultadoBusqueda> {
  const q = (consulta ?? '').trim().replace(/\s+/g, ' ')
  if (q.length > MAX_ENLACE) throw new AppError('Escribe una dirección de entre 3 y 200 letras', 400)

  const i = interpretarUbicacion(consulta ?? '')
  if (i.tipo === 'punto') {
    // Sin red y sin gastar el tope: no sale nada de la organización.
    const nombre = i.fuente === 'enlace' ? 'Punto del enlace de Google Maps' : `Coordenadas ${i.lat}, ${i.lng}`
    return { proveedor: i.fuente, resultados: [{ nombre, lat: i.lat, lng: i.lng }] }
  }
  if (i.tipo === 'invalido' && q.length >= 3) throw new AppError(i.motivo, 400)
  if (i.tipo === 'enlace-corto') {
    contarPersona(usuarioId)
    const p = await resolverEnlaceCorto(i.url)
    return { proveedor: 'enlace', resultados: [{ nombre: 'Punto del enlace de Google Maps', ...p }] }
  }

  if (q.length < 3 || q.length > 200) {
    throw new AppError('Escribe una dirección de entre 3 y 200 letras', 400)
  }
  contarPersona(usuarioId)

  const clave = claveGoogle()
  const proveedor = clave ? 'google' : 'osm'
  // La memoria es POR PROVEEDOR: si el owner pone su clave, no se le sirven
  // los resultados de OpenStreetMap de ayer como si fueran de Google.
  const llave = `${proveedor}:${normalizar(q)}`
  const guardado = memoria.get(llave)
  if (guardado && guardado.hasta > Date.now()) return guardado.r

  const res = clave ? await buscarEnGoogle(q, clave) : await buscarEnNominatim(q)
  if (memoria.size >= MEMORIA_MAX) memoria.delete(memoria.keys().next().value as string)
  memoria.set(llave, { hasta: Date.now() + MEMORIA_MS, r: res })
  return res
}

async function buscarEnNominatim(q: string): Promise<ResultadoBusqueda> {
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
    .filter(valido)

  return { proveedor: 'osm', resultados }
}

async function buscarEnGoogle(q: string, clave: string): Promise<ResultadoBusqueda> {
  // Sin la espera de 1/s: esa es la política de Nominatim. Lo que acota el
  // gasto con Google es el tope por persona, la memoria y el tope de gasto que
  // el owner ponga en su cuenta de Google Cloud.
  const paises = (process.env.GEO_BUSCADOR_PAISES || 'mx').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean)
  const url = new URL(URL_GOOGLE)
  url.searchParams.set('address', q)
  url.searchParams.set('key', clave)
  url.searchParams.set('language', 'es')
  if (paises[0]) url.searchParams.set('region', paises[0])
  // El filtro por país de Google admite UNO; con varios solo se sesga.
  if (paises.length === 1) url.searchParams.set('components', `country:${paises[0].toUpperCase()}`)

  let cuerpo: any
  try {
    const r = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    cuerpo = await r.json()
  } catch {
    throw new AppError('El buscador de Google no respondió. Puedes pegar coordenadas o marcar el punto en el mapa', 502)
  }

  const estado = String(cuerpo?.status ?? '')
  if (estado === 'ZERO_RESULTS') return { proveedor: 'google', resultados: [] }
  if (estado !== 'OK') {
    // REQUEST_DENIED (clave mala o sin la API activada), OVER_QUERY_LIMIT…
    // NO se pasa a OpenStreetMap a escondidas: el owner paga una clave y
    // tiene que enterarse de que no funciona. El mensaje de Google NO se
    // reenvía: puede llevar la clave dentro.
    console.error(`[geo-buscar] Google respondió ${estado.slice(0, 40)}`)
    throw new AppError(
      'El buscador de Google rechazó la búsqueda (revisa la clave de Google de la instancia). Puedes pegar coordenadas o marcar el punto en el mapa',
      502,
    )
  }

  const resultados: Candidato[] = (Array.isArray(cuerpo?.results) ? cuerpo.results : [])
    .slice(0, 5)
    .map((f: any) => {
      const loc = f?.geometry?.location
      // Solo números: `Number(null)` es 0 y dejaría pasar un punto en el mar.
      const c: Candidato = {
        nombre: String(f?.formatted_address ?? '').slice(0, 300),
        lat: typeof loc?.lat === 'number' ? loc.lat : NaN,
        lng: typeof loc?.lng === 'number' ? loc.lng : NaN,
      }
      if (typeof f?.place_id === 'string' && f.place_id) c.placeId = f.place_id.slice(0, 300)
      return c
    })
    .filter(valido)

  return { proveedor: 'google', resultados }
}
