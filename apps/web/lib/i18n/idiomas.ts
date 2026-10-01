// ============================================================================
//  lib/i18n/idiomas.ts — QUE IDIOMA SE LE ENSENA A QUIEN ENTRA.
// ----------------------------------------------------------------------------
//  Este archivo es PURO a proposito: entra texto (el valor de una cookie, el
//  contenido de una cabecera `Accept-Language`) y sale un idioma. No importa
//  Next, ni React, ni la peticion. Todo lo que sabe de HTTP vive en
//  `servidor.ts`, que lo unico que hace es leer esos dos textos y llamar aqui.
//
//  El motivo de partirlo asi es que la regla de precedencia es lo unico que de
//  verdad hay que acertar, y una funcion pura se puede probar y mutar sin
//  levantar un servidor.
//
//  ─── POR QUE NO HAY RUTAS `/en/...` NI SE TOCA EL MIDDLEWARE ───────────────
//
//  La forma de libro para i18n en Next seria un segmento de idioma en la ruta
//  (`/es/inicio`, `/en/inicio`). Aqui se descarto, y conviene que quede escrito
//  porque es LA decision de esta tarea:
//
//   · El App Router de Next 14 NO trae i18n de rutas (`i18n` en
//     `next.config.mjs` solo funciona en el Pages Router). Habria que hacerlo a
//     mano moviendo todo `app/(app)/` a `app/(app)/[idioma]/`.
//   · Eso renombra ~40 `page.tsx`, y esta tarea tiene PROHIBIDO renombrar
//     archivos.
//   · Y arrastraria `middleware.ts` —ARCHIVO DE ALTO CONTACTO, donde viven el
//     gate de sesion y el CSRF—, porque compara rutas literales
//     (`normalizedPath === '/login'`, `startsWith('/api/')`, el redirect 308 de
//     `/demo/*`). Con un segmento delante, todas esas comparaciones dejan de
//     casar. Cambiar sesion o tenant es ZONA ROJA.
//   · Ademas hay `basePath: '/spaces-dooh'` y `trailingSlash: true` encima, y
//     `nav.ts` guarda las rutas literales que `AuthGate` empareja por `href`.
//
//  Lo que se hace en su lugar: el idioma se resuelve EN EL SERVIDOR, en el
//  layout raiz, y baja por contexto de React. Ni una ruta cambia, ni una linea
//  del middleware.
//
//  ─── POR QUE NO SE MIRA `navigator.language` ───────────────────────────────
//
//  Porque parpadea. Leer el idioma en el cliente obliga a pintar primero algo
//  —el espanol— y corregirlo despues del primer render: se ve el salto, y en
//  una demostracion se ve fatal. `Accept-Language` la manda el navegador EN LA
//  MISMA peticion que pide la pagina, asi que el HTML sale ya en el idioma
//  correcto y la hidratacion coincide. Es la misma informacion —el navegador
//  deriva la cabecera de la misma preferencia que expone en `navigator`— solo
//  que llega a tiempo.
// ============================================================================

export const IDIOMAS = ['es', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]

// El espanol es el idioma ORIGINAL del producto y el unico que esta completo.
// Es el destino de cualquier duda: ante una senal ilegible o un idioma que no
// hablamos se cae aqui, nunca al ingles.
export const IDIOMA_POR_OMISION: Idioma = 'es'

// Mismo prefijo que `spaces_sesion` y `spaces_csrf`. NO es `httpOnly`: es una
// preferencia de presentacion, no una credencial, y el selector de idioma la
// escribe desde el navegador.
export const COOKIE_IDIOMA = 'spaces_idioma'

function esIdioma(v: string): v is Idioma {
  return (IDIOMAS as readonly string[]).includes(v)
}

/**
 * Convierte una etiqueta de idioma (BCP 47) en uno de los idiomas soportados.
 *
 * Se queda con la SUBETIQUETA primaria —lo anterior al primer guion— en vez de
 * comparar por prefijo de texto. La diferencia importa: con `startsWith('es')`,
 * «esperanto» seria espanol.
 */
export function normalizarIdioma(valor: string | null | undefined): Idioma | null {
  if (typeof valor !== 'string') return null
  const primaria = valor.trim().toLowerCase().split('-')[0]
  return primaria && esIdioma(primaria) ? primaria : null
}

/**
 * El idioma preferido que se puede atender, leido de un `Accept-Language`.
 *
 * Ordena por calidad (`q`) de mayor a menor y, a igualdad, respeta el orden de
 * aparicion — que es lo que dice el RFC 9110 §12.5.4 y lo que espera quien
 * configuro su navegador. Una entrada con `q=0` es un RECHAZO explicito y se
 * descarta; el comodin `*` no es una eleccion y se ignora.
 */
export function idiomaDeCabecera(cabecera: string | null | undefined): Idioma | null {
  if (typeof cabecera !== 'string' || cabecera.trim() === '') return null

  const candidatos = cabecera
    .split(',')
    .map((trozo, orden) => {
      const [etiqueta, ...parametros] = trozo.split(';')
      const q = parametros
        .map((p) => /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p))
        .find(Boolean)
      // Sin `q` valido, la calidad es 1 (el valor por omision del RFC). Una `q`
      // ilegible se trata igual: una cabecera rota es de quien llama, y lo que
      // no puede pasar es que tumbe el render de la pagina.
      const calidad = q ? Number(q[1]) : 1
      return {
        idioma: normalizarIdioma(etiqueta),
        calidad: Number.isFinite(calidad) ? calidad : 1,
        orden,
      }
    })
    .filter((c) => c.idioma !== null && c.calidad > 0)

  candidatos.sort((a, b) => b.calidad - a.calidad || a.orden - b.orden)
  return candidatos[0]?.idioma ?? null
}

/**
 * LA REGLA DE PRECEDENCIA, que es lo unico que hay que recordar de este
 * archivo:
 *
 *     cookie  >  Accept-Language  >  espanol
 *
 * La cookie gana SIEMPRE porque es una persona que eligio a mano en esta
 * pantalla. La cabecera es una preferencia del sistema operativo que esa
 * persona puede no haber configurado nunca —muchas maquinas de oficina vienen
 * en ingles de fabrica—, asi que adivina bien pero no decide.
 *
 * Y una cookie con un valor invalido se comporta como si NO HUBIERA cookie, no
 * como «idioma de omision»: si no, escribir `spaces_idioma=fr` desde la consola
 * del navegador apagaria la deteccion para todo el mundo que la tuviera asi.
 */
export function resolverIdioma(entrada: {
  cookie?: string | null
  cabecera?: string | null
}): Idioma {
  return (
    normalizarIdioma(entrada.cookie) ??
    idiomaDeCabecera(entrada.cabecera) ??
    IDIOMA_POR_OMISION
  )
}

// Un ano. La eleccion de idioma no caduca sola: quien la hizo una vez no
// espera volver a hacerla el mes que viene.
export const COOKIE_IDIOMA_MAX_AGE = 60 * 60 * 24 * 365

/**
 * La cabecera `document.cookie` que guarda la eleccion manual.
 *
 * Vive aqui, separada del componente que la escribe, porque escribir en
 * `document.cookie` es un efecto que no se puede observar sin un DOM — y sin
 * observarlo, una prueba no puede decir si la cookie sale bien formada. Al
 * partirlo, la CADENA es un dato puro que si se comprueba.
 *
 * No es una precaucion teorica: el mutante que borraba esta escritura
 * SOBREVIVIO a la primera medicion de I18N-01, justamente porque no habia nada
 * que la mirara.
 *
 * `Secure` solo sobre HTTPS, y es deliberado: ponerlo siempre haria que el
 * navegador DESCARTARA la cookie en el `localhost` de desarrollo, y el selector
 * pareceria roto sin dar ningun error.
 *
 * `path=/` y no el `basePath`: la cookie tiene que valer para toda la
 * aplicacion, y `basePath` se antepone a las RUTAS, no al ambito de la cookie.
 */
export function cadenaCookieIdioma(idioma: Idioma, seguro: boolean): string {
  return (
    `${COOKIE_IDIOMA}=${idioma}; path=/; max-age=${COOKIE_IDIOMA_MAX_AGE}; SameSite=Lax` +
    (seguro ? '; Secure' : '')
  )
}
