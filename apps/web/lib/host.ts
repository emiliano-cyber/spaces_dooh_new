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

// ─── El origen público de la instancia, para las redirecciones ──────────────
//
// Existe por el 500 del 2026-09-17, y conviene leer los dos fallos juntos
// porque el segundo nació del arreglo del primero:
//
//   09/09 · `NextResponse.redirect(request.nextUrl.clone())` mandaba a
//           `https://localhost:3000/…`. `nextUrl` toma su origen de donde
//           ESCUCHA el servidor (`Dockerfile:72-73`), no de la petición.
//   17/09 · se cambió por una `Location` RELATIVA, y toda ruta protegida sin
//           sesión pasó a devolver 500. El adaptador de middleware de Next
//           parsea SIEMPRE esa cabecera —`adapter.js:242-248`, `new NextURL()`
//           sobre `new URL()` sin base—, así que una relativa no es una opción
//           en Next 14.2.29: es un `ERR_INVALID_URL`.
//
// Quedan descartadas las tres salidas evidentes, y por eso volvemos al `Host`:
// `process.env` se hornea en el build del middleware (sería el error de
// `NEXT_PUBLIC_AUTOREGISTRO` otra vez, un valor por instancia congelado en el
// artefacto de la flota) y la relativa es imposible.
//
// > [!important] Lo que esta función NO concede
// > Decide el ORIGEN de una redirección cuyo destino es SIEMPRE una ruta interna
// > fija. El `Host` no elige a dónde va el usuario, no entra en la cadena de
// > datos y no resuelve tenant ni organización — eso sigue prohibido, igual que
// > en `etiquetaDeHost`.
//
// El riesgo que motivó descartar el `Host` en su día —un open redirect— se acota
// en dos capas: nginx ya filtra por `server_name`, y aquí sólo se admite lo que
// tiene forma de nombre de máquina. Cualquier otra cosa devuelve `null` y quien
// llama cae a su origen interno: se rompe la redirección, que es visible, en vez
// de mandar a alguien al dominio de un tercero, que no lo es.
const NOMBRE_DE_MAQUINA = /^[a-z0-9.-]+(:\d{1,5})?$/

export function origenPublico(host: string | null, protoDeclarado: string | null): string | null {
  if (typeof host !== 'string') return null

  const nombre = host.trim().toLowerCase()
  if (nombre === '') return null

  // Todo lo que no sea un nombre de máquina: `@` (userinfo), `/` y `\` (que
  // algunos parsers leen como separador de autoridad), `?`, `#`, espacios, y la
  // IPv6 entre corchetes, que aquí no hace falta y sólo añade formas de error.
  if (!NOMBRE_DE_MAQUINA.test(nombre)) return null

  // El esquema lo anuncia el proxy. Sin él se asume `https`, que es lo que
  // sirven todas las instancias; un `http` sólo se toma si lo pide de verdad.
  const proto = (protoDeclarado ?? '').split(',')[0].trim().toLowerCase()
  const esquema = proto === 'http' ? 'http' : 'https'

  return `${esquema}://${nombre}`
}
