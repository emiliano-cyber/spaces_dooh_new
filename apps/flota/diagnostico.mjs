// ============================================================================
//  diagnostico.mjs — de un fallo a una frase que dice QUE ARREGLAR.
// ----------------------------------------------------------------------------
//  El panel clasificaba toda instancia que no contesta como `sin-respuesta`, y
//  detras de ese cajon caben seis averias con seis arreglos distintos. El dato
//  para distinguirlas ya llegaba y se perdia por dos motivos:
//
//   1. `consultar()` calculaba un `motivo` y `resumen()` lo descartaba;
//   2. y en los fallos de RED ese motivo era `error.message`, que en Node es
//      **`fetch failed`** para todo. La causa vive en `error.cause.code`.
//
//  Medido el 2026-09-10, la misma noche que esto se escribio:
//  `prueba.space-os.io` daba `000` sin decir que era DNS, y
//  `demo.space-os.io` un 404 que significaba «esa maquina corre codigo
//  anterior a F6.1». Media hora de comandos a mano cada uno.
//
//  PURO a proposito: sin red, sin disco y sin dependencias, como
//  `comprobaciones.mjs` y `dns.mjs`. Es lo que permite probar la tabla entera
//  sin levantar nada.
// ============================================================================

/** Codigos de `error.cause.code` que sabemos traducir. */
const RED = {
  ENOTFOUND: 'el dominio no resuelve',
  EAI_AGAIN: 'el dominio no resuelve',
  ECONNREFUSED: 'nadie escucha en el 443',
  EHOSTUNREACH: 'la maquina no responde',
  ENETUNREACH: 'la maquina no responde',
  ETIMEDOUT: 'no contesto en 5 s',
  CERT_HAS_EXPIRED: 'el certificado caduco',
  ERR_TLS_CERT_ALTNAME_INVALID: 'el certificado no cubre este dominio',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'el certificado no se puede verificar',
  SELF_SIGNED_CERT_IN_CHAIN: 'el certificado no se puede verificar',
}

/** Estados HTTP que dicen algo mas que su numero. */
const HTTP = {
  401: 'el token no vale',
  403: 'el token no vale',
  404: 'no existe /api/version: corre una version anterior a F6.1',
  502: 'nginx contesta pero la aplicacion no',
  503: 'nginx contesta pero la aplicacion no',
  504: 'nginx contesta pero la aplicacion no',
}

/**
 * La frase para un fallo. Se evalua en orden: red, HTTP, token.
 *
 * >>> LA FRASE LLEVA EL CODIGO ENTRE PARENTESIS, y las dos partes hacen
 * >>> trabajos distintos: la frase se lee deprisa a las tres de la manana, el
 * >>> codigo se pega en un buscador o en un mensaje. Pedido por Emiliano en la
 * >>> retro del 2026-09-10, y no se elige entre uno y otro.
 * >>>
 * >>> Y el codigo que se imprime es EL QUE LLEGO, no el representante de su
 * >>> grupo: `EAI_AGAIN` comparte frase con `ENOTFOUND` y sale con su propio
 * >>> nombre. Imprimir el del grupo diria un codigo que nadie vio, que es peor
 * >>> que no decir ninguno.
 *
 * >>> Y lo que NO esta en las tablas sale TAL CUAL, sin frase. Un clasificador
 * >>> que se traga lo que no reconoce convierte una averia nueva en «error
 * >>> desconocido», que es volver al punto de partida. Feo y util le gana a
 * >>> bonito y ciego.
 */
export function clasificarFallo({ error, status, cuerpoSinVersion, token, nombre } = {}) {
  if (error) {
    const code = error?.cause?.code
    if (code) {
      const frase = RED[code]
      return frase ? frase + ' (' + code + ')' : String(code)
    }
    return String(error?.message ?? error)
  }

  if (typeof status === 'number') {
    const frase = HTTP[status]
    return frase ? frase + ' (HTTP ' + status + ')' : 'HTTP ' + status
  }

  if (cuerpoSinVersion) {
    if (token) return 'el token no lo reconoce como panel'
    return 'falta FLOTA_TOKEN_' + String(nombre).toUpperCase().replace(/-/g, '_') + ' en el panel'
  }

  return ''
}

// ─── Fase 2 · si una actualizacion fallo, y en que paso ─────────────────────
//
//  Hoy `update.sh` reporta al terminar. Si la actualizacion FALLA, lo que llega
//  es la version ANTERIOR --la que sigue corriendo-- asi que el panel pinta esa
//  instancia como `rezagada`: identica a una que nadie ha actualizado todavia.
//  Y son cosas distintas: una se resuelve esperando al cron, la otra no se
//  resuelve sola.
//
//  ─── La frontera aqui va AL REVES, y por eso no viaja texto ───────────────
//  Lo que sostiene `motivo` arriba es que lo escribe el PADRE. Un campo `error`
//  que mande la instancia rompe ese argumento: es texto libre cruzando hacia el
//  plano de control, y ahi puede venir cualquier cosa -- incluido un fragmento
//  de log con datos de un cliente.
//
//  Asi que la instancia manda DOS VALORES DE LISTAS CERRADAS y el padre pone
//  las palabras. Lo que se pierde, dicho claro: el mensaje de error concreto no
//  llega al panel. Para eso esta el log de la instancia, y sacarlo de la maquina
//  es la deuda de SPACES_KEY/LOGS_BUCKET. El panel dice DONDE murio, no QUE
//  dijo -- y con el paso ya se sabe si entrar o esperar.

/**
 * Lo que dice cada codigo de salida de `update.sh`, en una frase.
 *
 * ─── Por que el CODIGO y no un «paso» ────────────────────────────────────
 * La primera version de esto mandaba un nombre de paso --`migraciones`,
 * `salud`-- y aplanaba justo lo que `update.sh` se esfuerza en distinguir. Su
 * propia cabecera lo advierte: «un `set -e` que los aplanara todos en fallo
 * seria justamente el error que este script no puede cometer».
 *
 * `paso: migraciones` no dice si la base cambio. El codigo si: un **2** es
 * «fallaron a medias y LA BASE PUDO CAMBIAR», un **3** es «no se aplico nada».
 * Son dos situaciones con dos urgencias distintas, y la diferencia se pierde al
 * traducirlas al mismo nombre.
 *
 * Y estos codigos ya existen, ya estan documentados y son los que el script
 * conoce de verdad: no hay que inventar un vocabulario nuevo ni mantenerlo en
 * dos sitios.
 */
const CODIGO_UPDATE = {
  1: 'la actualizacion no pudo ni empezar: no se toco nada',
  2: 'las migraciones fallaron a medias y LA BASE PUDO CAMBIAR: sigue sirviendo la version anterior, y hay que mirarlo',
  3: 'la imagen y el registro de la base no cuentan la misma historia: no se aplico nada',
  4: 'el arranque fallo y la vuelta atras salio bien: sirve la version anterior',
  5: 'el arranque fallo y la vuelta atras NO se pudo completar: la instancia puede estar caida',
  6: 'la vuelta atras devolvio el servicio, pero la base no volvio a la huella que tenia antes de migrar',
  7: 'LA BASE QUEDO VACIA: hay que restaurarla ANTES de levantar el contenedor',
  8: 'la licencia vencio y la instancia esta apagada a proposito: no es una averia',
  9: 'no se pudo verificar la licencia: la instancia sigue sirviendo, pero hay un problema de herramienta',
}

/** Los codigos que NO son un fallo. El 75 es «ya habia otro update en marcha». */
const CODIGOS_SANOS = [0, 75]

/** Los codigos que una instancia puede reportar. Lista cerrada. */
export const CODIGOS_UPDATE = [...CODIGOS_SANOS, ...Object.keys(CODIGO_UPDATE).map(Number)].sort(
  (a, b) => a - b,
)

/**
 * La frase de la ultima actualizacion, o `null` si no hay nada que decir.
 *
 * >>> Devuelve `null` en TRES casos que no hay que confundir, y los tres callan
 * >>> con razon: la actualizacion fue bien (0), habia otra en marcha (75), y la
 * >>> instancia no lo dice porque su `update.sh` es anterior a este cambio.
 * >>> Ninguno es un fallo.
 *
 * >>> Un codigo que este panel no conoce se NOMBRA en vez de callarse, por lo
 * >>> mismo que un codigo de red desconocido sale tal cual: una averia nueva
 * >>> tiene que verse, aunque sea con un numero.
 */
export function fraseDeActualizacion({ codigo } = {}) {
  if (codigo === undefined || codigo === null) return null
  const n = Number(codigo)
  if (CODIGOS_SANOS.includes(n)) return null
  return (
    CODIGO_UPDATE[n] ?? 'la actualizacion salio con el codigo ' + String(codigo) + ', que este panel no conoce'
  )
}
