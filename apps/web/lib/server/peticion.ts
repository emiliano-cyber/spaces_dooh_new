import 'server-only'

// ============================================================================
//  lib/server/peticion.ts — Datos de la petición que forman parte del
//  expediente de evidencia de una firma electrónica.
//
//  Ni la IP ni el user-agent prueban por sí solos quién firmó: ambos los
//  controla el cliente y son falsificables. Su valor es acumulativo —forman
//  parte del conjunto de indicios— y por eso se guardan literales, sin
//  "limpiarlos": alterarlos destruiría justo lo que se quiere conservar.
// ============================================================================

// Detrás del proxy de DigitalOcean la IP real viene en X-Forwarded-For, cuyo
// primer elemento es el cliente original. Se recorta la lista porque los proxies
// intermedios van añadiendo saltos.
export function ipDeRequest(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const primera = xff.split(',')[0]?.trim()
    if (primera) return primera.slice(0, 100)
  }
  return req.headers.get('x-real-ip')?.slice(0, 100) ?? null
}

export function uaDeRequest(req: Request): string | null {
  // Se acota porque el user-agent lo fija el cliente y no debe poder inflar una
  // fila de la bitácora sin límite.
  return req.headers.get('user-agent')?.slice(0, 500) ?? null
}
