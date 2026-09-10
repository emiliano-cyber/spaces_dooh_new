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
