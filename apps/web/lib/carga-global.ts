// ============================================================================
//  lib/carga-global.ts — Cuenta las peticiones a la API en vuelo.
//
//  Hay más de 40 llamadas repartidas por la app (estado-api, auth-real, y las
//  sueltas de configuración/login/integraciones). Instrumentar cada una sería
//  tedioso y se olvidaría alguna en cuanto se añada la 41ª, así que se
//  intercepta `window.fetch` UNA vez.
//
//  Solo cuenta las peticiones a nuestra API: las de Next (navegación RSC,
//  prefetch de chunks) no son espera del usuario y encenderían la barra sin
//  motivo.
// ============================================================================

const PREFIJO_API = '/spaces-dooh/api'

let enVuelo = 0
const oyentes = new Set<(n: number) => void>()

function avisar() {
  for (const f of oyentes) f(enVuelo)
}

export function suscribirCarga(f: (n: number) => void): () => void {
  oyentes.add(f)
  f(enVuelo)
  return () => oyentes.delete(f)
}

export function peticionesEnVuelo(): number {
  return enVuelo
}

function esNuestraApi(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input.url
    // Vale tanto la relativa (`/spaces-dooh/api/...`) como la absoluta.
    return url.includes(PREFIJO_API)
  } catch {
    return false
  }
}

// Marca para no volver a envolver `fetch` si el módulo se recarga (HMR en dev o
// un doble montaje). Envolverlo dos veces contaría cada petición por duplicado y
// el contador nunca volvería a cero.
const MARCA = '__cargaGlobalInstalado'

export function instalarContadorDeCarga() {
  if (typeof window === 'undefined') return
  const w = window as unknown as Record<string, unknown>
  if (w[MARCA]) return
  w[MARCA] = true

  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!esNuestraApi(input)) return original(input, init)
    enVuelo++
    avisar()
    try {
      return await original(input, init)
    } finally {
      // `finally` y no solo el camino feliz: si la petición falla o se aborta,
      // el contador tiene que bajar igual o la barra se queda encendida para
      // siempre.
      enVuelo = Math.max(0, enVuelo - 1)
      avisar()
    }
  }
}
