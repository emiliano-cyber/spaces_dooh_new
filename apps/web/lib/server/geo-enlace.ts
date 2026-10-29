import 'server-only'
import { AppError } from './errores'
import { coordenadasDeEnlaceGoogle, esEnlaceCortoDeGoogle, esEnlaceDeGoogleMaps } from '@/lib/interpretar-ubicacion'

// ============================================================================
//  lib/server/geo-enlace.ts — Seguir un enlace corto de Google Maps
//  (maps.app.goo.gl/…, goo.gl/maps/…) hasta sus coordenadas.  UBIC-01.
// ----------------------------------------------------------------------------
//  El enlace que da «Compartir» en el teléfono es corto y NO trae coordenadas:
//  hay que pedirlo y leer a dónde redirige. El navegador no puede (CORS, y la
//  CSP no se abre a goo.gl), así que lo hace el servidor. Y un servidor que
//  pide URLs que le manda un usuario es la receta del SSRF, por eso:
//
//   · solo se PIDE un enlace corto de Google por https (`esEnlaceCortoDeGoogle`,
//     lista cerrada de hosts, sin usuario ni puerto) — nunca lo que diga el
//     cuerpo de la petición;
//   · las redirecciones se siguen A MANO (`redirect: 'manual'`): `fetch` solo
//     las seguiría a cualquier sitio, incluido 127.0.0.1;
//   · cada salto se revisa: si es otro enlace corto se pide, si es Google Maps
//     se LEE de la URL sin pedirla (ahí ya están las coordenadas), y si es
//     cualquier otra cosa se corta;
//   · como mucho cinco saltos y seis segundos por salto;
//   · no se lee el cuerpo de ninguna respuesta, no se mandan cookies.
//
//  Lo que se devuelve es un PUNTO DE PARTIDA: la persona lo ve en el mapa y lo
//  afina arrastrando el pin, igual que con el buscador (`geo-buscar.ts`).
// ============================================================================

const MAX_SALTOS = 5
const TIEMPO_MAXIMO_MS = 6_000

const NO_LLEVA = 'Ese enlace no lleva a un lugar de Google Maps'
const SIN_COORDENADAS =
  'Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí'

export async function resolverEnlaceCorto(enlace: string): Promise<{ lat: number; lng: number }> {
  let actual: URL
  try {
    actual = new URL(enlace)
  } catch {
    throw new AppError(NO_LLEVA, 400)
  }
  if (!esEnlaceCortoDeGoogle(actual)) throw new AppError(NO_LLEVA, 400)

  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    let r: Response
    try {
      r = await fetch(actual.toString(), {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        headers: { 'user-agent': `SPACE-OS/${process.env.SPACE_OS_VERSION || 'dev'}` },
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        cache: 'no-store',
      })
    } catch {
      throw new AppError(
        'No se pudo abrir el enlace de Google Maps. Pega las coordenadas o marca el punto directamente en el mapa',
        502,
      )
    }

    const location = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null
    if (!location) throw new AppError(NO_LLEVA, 400)

    let siguiente: URL
    try {
      siguiente = new URL(location, actual)
    } catch {
      throw new AppError(NO_LLEVA, 400)
    }

    if (esEnlaceDeGoogleMaps(siguiente)) {
      const c = coordenadasDeEnlaceGoogle(siguiente)
      if (!c) throw new AppError(SIN_COORDENADAS, 400)
      if ('error' in c) throw new AppError(c.error, 400)
      return c
    }
    // Otro enlace corto (goo.gl/maps → maps.app.goo.gl): se pide en el
    // siguiente salto. Cualquier otro destino se corta aquí, sin pedirlo.
    if (!esEnlaceCortoDeGoogle(siguiente)) throw new AppError(NO_LLEVA, 400)
    actual = siguiente
  }
  throw new AppError(NO_LLEVA, 400)
}
