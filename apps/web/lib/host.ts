// Lectura del encabezado `Host`. Módulo PURO (sin `server-only`, mismo patrón que
// `lib/validacion.ts`) para poder probarlo sin levantar el middleware.
//
// > Alcance deliberado: esto NO resuelve marcas ni organizaciones, y el host NO
// > entra en la cadena de datos. Lo único que decide es si el rewrite a `/portal`
// > (`middleware.ts`, `moduleMap`) debe dispararse. Sigue siendo la única función
// > del sistema que mira el host, y no concede acceso a nada. El modelo de
// > subdominios por tenant está MUERTO: si algo necesita el host para resolver
// > quién es quién, está mal planteado.
//
// Por qué existe: la versión anterior contaba puntos (`parts.length >= 3`), así
// que al entrar por la IP desnuda del droplet —`209.97.146.136`— creía ver el
// subdominio «209» y reescribía la ruta. Hoy no rompe nada solo porque «209» no
// está en el `moduleMap`; el día que un módulo se llame como el primer octeto de
// una IP, la app cambia de ruta sola y sin avisar.

// Un segmento hecho solo de dígitos no es un subdominio nuestro: es el primer
// octeto de una IPv4 (o un host numérico raro). Con esto cae `209.97.146.136` y
// también `127.0.0.1`.
const SOLO_DIGITOS = /^\d+$/

export function etiquetaDeHost(host: string): string | null {
  if (typeof host !== 'string') return null

  // El `Host` puede llegar con mayúsculas: los nombres DNS no distinguen caja,
  // pero las claves del `moduleMap` sí, así que se normaliza aquí.
  const bruto = host.trim().toLowerCase()
  if (bruto === '') return null

  // IPv6 literal: en el encabezado `Host` va entre corchetes (`[::1]:3000`).
  // No tiene etiquetas que mirar.
  if (bruto.startsWith('[')) return null

  // Se quita el puerto. Si quedan más `:`, es una IPv6 sin corchetes: fuera.
  const partesPuerto = bruto.split(':')
  if (partesPuerto.length > 2) return null
  const nombre = partesPuerto[0]

  const etiquetas = nombre.split('.')

  // Hacen falta al menos tres etiquetas (`algo.dominio.tld`) y ninguna vacía:
  // «space-os.io» y «localhost» no tienen subdominio, y «...» es basura.
  if (etiquetas.length < 3) return null
  if (etiquetas.some((e) => e === '')) return null

  const primera = etiquetas[0]
  if (SOLO_DIGITOS.test(primera)) return null

  return primera
}
