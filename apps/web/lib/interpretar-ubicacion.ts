// ============================================================================
//  lib/interpretar-ubicacion.ts — ¿Qué pegó la persona en el buscador de la
//  ubicación?  UBIC-01.
// ----------------------------------------------------------------------------
//  Decisión del dueño (29/10/2026): en Comercial negociación la ubicación de un
//  espacio se pone por COORDENADAS o por CALLE, «con Google Maps o mínimo para
//  poner la ubicación correcta», y la parte de las coordenadas tenía que ser
//  YA, sin clave y gratis. Lo que la gente tiene a mano en la calle es eso: unas
//  coordenadas copiadas de Google Maps o el enlace que da «Compartir».
//
//  Este módulo decide, SIN RED, qué es el texto:
//   · `punto`        — coordenadas (decimales o grados/minutos/segundos) o un
//                      enlace LARGO de Google Maps que ya las trae dentro;
//   · `enlace-corto` — maps.app.goo.gl/… o goo.gl/maps/…: no traen coordenadas,
//                      hay que seguir la redirección, y eso lo hace el SERVIDOR
//                      (`lib/server/geo-enlace.ts`);
//   · `direccion`    — lo demás con letras o números: va al buscador de calles;
//   · `invalido`     — con un motivo que se le puede enseñar a la persona.
//
//  Es puro y lo usan los dos lados: el navegador, para poner el pin al instante
//  sin preguntarle a nadie, y el servidor, que NO se fía de lo que el navegador
//  ya decidió y lo vuelve a interpretar antes de salir a la red.
//
//  Dos reglas que vienen de fallos que sería fácil volver a meter:
//   · Unas coordenadas tienen que llevar DECIMALES (o la letra del hemisferio).
//     Con dos enteros, «Calle 5, 123» se convertía en un pin en el océano
//     Índico. Nadie copia coordenadas útiles sin decimales.
//   · Fuera de rango se DICE, no se corrige. Lo más común es pegarlas al revés
//     (longitud primero): en México eso da una latitud de -99, y voltearlas en
//     silencio dejaría pasar un error de verdad en otra parte del mundo.
// ============================================================================

export type Interpretacion =
  | { tipo: 'punto'; lat: number; lng: number; fuente: 'coordenadas' | 'enlace' }
  | { tipo: 'enlace-corto'; url: string }
  | { tipo: 'direccion'; texto: string }
  | { tipo: 'invalido'; motivo: string }

type Coordenadas = { lat: number; lng: number } | { error: string } | null

const MOTIVO_VACIO = 'Escribe una dirección, pega unas coordenadas (19.4326, -99.1332) o un enlace de Google Maps'
const MOTIVO_OTRO_DOMINIO = 'Solo se aceptan enlaces de Google Maps (google.com/maps o maps.app.goo.gl)'
const MOTIVO_SIN_COORDENADAS =
  'Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí'

// ─── Dominios ───────────────────────────────────────────────────────────────
// La lista es CERRADA y se compara el host entero, no «contiene google»: así
// `google.com.evil.example` y `evilgoogle.com` se quedan fuera. Los dominios de
// país (google.com.mx, google.co.uk, google.de) son el mismo Google.
const HOST_GOOGLE = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|com?\.[a-z]{2})$/

export function esEnlaceDeGoogleMaps(u: URL): boolean {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  if (u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  if (!HOST_GOOGLE.test(host)) return false
  return host.startsWith('maps.') || u.pathname === '/maps' || u.pathname.startsWith('/maps/')
}

/** Lo único que el servidor acepta PEDIR por red: un enlace corto de Maps, por https. */
export function esEnlaceCortoDeGoogle(u: URL): boolean {
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false
  const host = u.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl') return /^\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  if (host === 'goo.gl') return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  return false
}

// ─── Coordenadas en texto ───────────────────────────────────────────────────

function enRango(lat: number, lng: number): Coordenadas {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: MOTIVO_VACIO }
  if (lat < -90 || lat > 90) {
    return { error: 'La latitud va de -90 a 90. ¿Están al revés? Primero va la latitud (en México, alrededor de 14 a 33)' }
  }
  if (lng < -180 || lng > 180) return { error: 'La longitud va de -180 a 180' }
  // El (0,0) es como llega «sin capturar» (lib/coordenadas.ts), no un lugar.
  if (lat === 0 && lng === 0) return { error: 'El punto (0, 0) está en el mar: no es una ubicación' }
  return { lat, lng }
}

const num = (s: string) => Number(s.replace(',', '.'))

// Un ángulo con la letra del hemisferio: 19°25'57.4"N, 19°25.956'N, 19.4326 N.
// La «O» es «Oeste»: así lo escribe Google Maps en español.
const ANGULO = String.raw`(\d{1,3}(?:\.\d+)?)\s*°?\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′’]\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|”|'')\s*)?([NSEWOnsewo])`
const PAR_ANGULOS = new RegExp(`^${ANGULO}\\s*[,;]?\\s*${ANGULO}$`)
// Decimales con punto, separados por coma, punto y coma o espacio.
const PAR_DECIMAL = /^([+-]?\d{1,3}\.\d+)\s*(?:[,;]\s*|\s+)([+-]?\d{1,3}\.\d+)$/
// Decimales con COMA (así las copia una hoja de cálculo en español): entonces
// el separador tiene que ser punto y coma, o no habría forma de partirlas.
const PAR_DECIMAL_COMA = /^([+-]?\d{1,3},\d+)\s*;\s*([+-]?\d{1,3},\d+)$/

function angulo(g: string, m: string | undefined, s: string | undefined): number | { error: string } {
  const grados = num(g)
  const minutos = m ? num(m) : 0
  const segundos = s ? num(s) : 0
  if (minutos >= 60 || segundos >= 60) return { error: 'Los minutos y los segundos van de 0 a 59' }
  return grados + minutos / 60 + segundos / 3600
}

function parsearCoordenadas(texto: string): Coordenadas {
  const t = texto.trim().replace(/^\((.*)\)$/, '$1').trim()

  let m = PAR_DECIMAL.exec(t) ?? PAR_DECIMAL_COMA.exec(t)
  if (m) return enRango(num(m[1]), num(m[2]))

  m = PAR_ANGULOS.exec(t)
  if (m) {
    const h1 = m[4].toUpperCase()
    const h2 = m[8].toUpperCase()
    if (!'NS'.includes(h1) || !'EWO'.includes(h2)) {
      return { error: 'Primero va la latitud (N o S) y después la longitud (E u O)' }
    }
    const a = angulo(m[1], m[2], m[3])
    const b = angulo(m[5], m[6], m[7])
    if (typeof a !== 'number') return a
    if (typeof b !== 'number') return b
    return enRango(h1 === 'S' ? -a : a, h2 === 'E' ? b : -b)
  }
  return null
}

// ─── Enlaces ────────────────────────────────────────────────────────────────

const PARAMS_CON_COORDENADAS = ['q', 'query', 'll', 'center', 'destination', 'daddr', 'sll']

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Las coordenadas de un enlace LARGO de Google Maps, o null si no las trae. */
export function coordenadasDeEnlaceGoogle(u: URL): Coordenadas {
  const href = decodificar(u.href)
  // `!3d…!4d…` es el LUGAR que se compartió; el `@lat,lng` de la ruta es el
  // centro de la VISTA, que puede estar corrido. Si están los dos, manda el
  // lugar.
  const lugar = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(href)
  if (lugar) return enRango(Number(lugar[1]), Number(lugar[2]))

  // /maps/place/<coordenadas>/… y /maps/search/<coordenadas> — Google pone
  // ahí las coordenadas tal cual las tecleó alguien, a veces en grados.
  const ruta = /^\/maps\/(?:place|search)\/([^/]+)/.exec(u.pathname)
  if (ruta) {
    const c = parsearCoordenadas(decodificar(ruta[1]).replace(/\+/g, ' '))
    if (c) return c
  }

  const vista = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decodificar(u.pathname))
  if (vista) return enRango(Number(vista[1]), Number(vista[2]))

  for (const p of PARAMS_CON_COORDENADAS) {
    const v = u.searchParams.get(p)
    if (!v) continue
    const c = parsearCoordenadas(v)
    if (c) return c
  }
  return null
}

const ESQUEMA_PELIGROSO = /^(?:javascript|data|vbscript|file):/i
const PARECE_ENLACE = /:\/\/|^(?:www\.|maps\.|goo\.gl\/|maps\.app\.goo\.gl\/|google\.)/i

function interpretarEnlace(token: string): Interpretacion {
  if (ESQUEMA_PELIGROSO.test(token)) return { tipo: 'invalido', motivo: MOTIVO_OTRO_DOMINIO }
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(token) ? token : `https://${token}`)
  } catch {
    return { tipo: 'invalido', motivo: MOTIVO_OTRO_DOMINIO }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { tipo: 'invalido', motivo: MOTIVO_OTRO_DOMINIO }

  const host = u.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
    // Un enlace corto copiado con http se pide igual por https: es el mismo
    // servicio, y el servidor solo sale por https.
    if (u.protocol === 'http:') u.protocol = 'https:'
    if (esEnlaceCortoDeGoogle(u)) return { tipo: 'enlace-corto', url: u.toString() }
    return { tipo: 'invalido', motivo: 'Ese enlace corto no es de Google Maps, o le falta el final' }
  }

  if (!esEnlaceDeGoogleMaps(u)) return { tipo: 'invalido', motivo: MOTIVO_OTRO_DOMINIO }
  const c = coordenadasDeEnlaceGoogle(u)
  if (!c) return { tipo: 'invalido', motivo: MOTIVO_SIN_COORDENADAS }
  if ('error' in c) return { tipo: 'invalido', motivo: c.error }
  return { tipo: 'punto', lat: c.lat, lng: c.lng, fuente: 'enlace' }
}

// ─── La entrada ─────────────────────────────────────────────────────────────

export function interpretarUbicacion(texto: string): Interpretacion {
  const t = (texto ?? '').trim()

  // Un enlace puede venir dentro de un texto: «Compartir» en el teléfono pega
  // el nombre del lugar, la dirección y el enlace en líneas separadas.
  const enlace = t.split(/\s+/).find((p) => PARECE_ENLACE.test(p) || ESQUEMA_PELIGROSO.test(p))
  if (enlace) return interpretarEnlace(enlace)

  if (t.length < 3) return { tipo: 'invalido', motivo: MOTIVO_VACIO }

  const c = parsearCoordenadas(t)
  if (c) {
    if ('error' in c) return { tipo: 'invalido', motivo: c.error }
    return { tipo: 'punto', lat: c.lat, lng: c.lng, fuente: 'coordenadas' }
  }

  if (!/[\p{L}\p{N}]/u.test(t)) return { tipo: 'invalido', motivo: MOTIVO_VACIO }
  return { tipo: 'direccion', texto: t }
}
