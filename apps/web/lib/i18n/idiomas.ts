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

// El italiano entra el 2026-11-03 (ola 0 del italiano, pedido del dueno:
// «ahora version en italiano»). Va TERCERO a proposito: el orden de esta lista
// es el del selector, y los dos que ya existian no se mueven.
export const IDIOMAS = ['es', 'en', 'it'] as const
export type Idioma = (typeof IDIOMAS)[number]

// El espanol es el idioma ORIGINAL del producto y el unico que esta completo.
// Es el destino de cualquier duda: ante una senal ilegible o un idioma que no
// hablamos se cae aqui, nunca al ingles.
export const IDIOMA_POR_OMISION: Idioma = 'es'

/**
 * ¿Está ENCENDIDO el inglés? APAGADO por omisión desde el 2026-09-30.
 *
 * Pedido del dueño ese día: «se está mezclando y está en ambos idiomas,
 * cámbialo para que solo por ahora esté en español». La causa: de las ~1300
 * cadenas de la interfaz solo estaban traducidas la pantalla de entrar, el menú
 * lateral y los errores del servidor (`vault/03-Frontend/idiomas-es-en.md` §9).
 * Con el inglés elegido —por la cookie o por un navegador en inglés— esas
 * partes salían en inglés y todo lo demás en español.
 *
 * Apagado, `idiomaDeLaPeticion()` devuelve SIEMPRE español (ignora la cookie y
 * el `Accept-Language`) y el selector no se pinta. Nada de la traducción se
 * borra: se enciende con `IDIOMA_INGLES=1` en el entorno del proceso cuando
 * esté completa. Solo el valor exacto `1`: un `true` o un `si` mal escrito deja
 * el producto como está, que es lo seguro.
 *
 * Recibe el entorno como parámetro para poder probarse sin tocar
 * `process.env`. En el navegador no se llama: allí el servidor ya decidió.
 */
export function inglesActivo(
  entorno: Record<string, string | undefined> = process.env,
): boolean {
  return entorno.IDIOMA_INGLES === '1'
}

/**
 * ¿Está ENCENDIDO el italiano? APAGADO por omisión (2026-11-03), con la MISMA
 * regla que el inglés y por el mismo motivo: hasta que los lotes de traducción
 * terminen, encenderlo enseñaría una aplicación a medias (lo que falta cae al
 * inglés, ver `diccionario.ts`). Apagado, nadie ve italiano aunque su cookie o
 * su navegador lo pidan. Solo el valor exacto `1` lo enciende.
 *
 * Es SU interruptor y no uno compartido: encender el italiano no enciende el
 * inglés, ni al revés. Cada idioma se publica cuando está listo.
 */
export function italianoActivo(
  entorno: Record<string, string | undefined> = process.env,
): boolean {
  return entorno.IDIOMA_ITALIANO === '1'
}

/**
 * Los idiomas que ESTA instancia ofrece, en el orden del selector. El español
 * siempre, y cada uno de los otros si su interruptor está encendido. Es lo
 * único que mira el resto del código (el layout raíz, `servidor.ts`,
 * `pages/_error.tsx`): un cuarto idioma se añade aquí y en `IDIOMAS`.
 */
export function idiomasActivos(
  entorno: Record<string, string | undefined> = process.env,
): Idioma[] {
  const encendido: Record<Idioma, boolean> = {
    es: true,
    en: inglesActivo(entorno),
    it: italianoActivo(entorno),
  }
  return IDIOMAS.filter((i) => encendido[i])
}

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
export function normalizarIdioma(
  valor: string | null | undefined,
  // Los idiomas que se aceptan. Por omision todos los del catalogo; quien
  // decide de verdad (`resolverIdioma`) pasa solo los ENCENDIDOS, y asi un
  // idioma apagado se comporta exactamente como uno que no hablamos.
  permitidos: readonly Idioma[] = IDIOMAS,
): Idioma | null {
  if (typeof valor !== 'string') return null
  const primaria = valor.trim().toLowerCase().split('-')[0]
  return primaria && esIdioma(primaria) && permitidos.includes(primaria) ? primaria : null
}

/**
 * El idioma preferido que se puede atender, leido de un `Accept-Language`.
 *
 * Ordena por calidad (`q`) de mayor a menor y, a igualdad, respeta el orden de
 * aparicion — que es lo que dice el RFC 9110 §12.5.4 y lo que espera quien
 * configuro su navegador. Una entrada con `q=0` es un RECHAZO explicito y se
 * descarta; el comodin `*` no es una eleccion y se ignora.
 */
export function idiomaDeCabecera(
  cabecera: string | null | undefined,
  permitidos: readonly Idioma[] = IDIOMAS,
): Idioma | null {
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
        idioma: normalizarIdioma(etiqueta, permitidos),
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
 *     cuenta  >  cookie  >  Accept-Language  >  espanol
 *
 * La CUENTA entra el 2026-11-03 (IDIOMA-USUARIO). Decision del dueno: «el
 * idioma de lo demas se debe poder configurar por usuario y navegador». Es lo
 * que la persona eligio en «Mi cuenta» y la sigue a cualquier dispositivo; solo
 * llega aqui si hay sesion (`servidor.ts` la descarta si la cookie que la lleva
 * no es de la sesion de ESTA peticion). Sin preferencia —`null`, el valor de
 * todas las cuentas que no la tocan— la regla es exactamente la de antes, y
 * `idioma-cuenta.test.ts` lo recorre combinacion por combinacion.
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
  /**
   * La preferencia guardada en la cuenta (`usuarios.idioma_preferido`), ya
   * desatada de su cookie. Un idioma apagado o un valor ilegible se ignoran
   * SIN error y se pasa a la cookie: si el idioma se vuelve a encender, la
   * persona lo recupera sin tocar nada.
   */
  cuenta?: string | null
  cookie?: string | null
  cabecera?: string | null
  /**
   * Los idiomas ENCENDIDOS (`idiomasActivos()`). Un idioma fuera de esta lista
   * se trata como uno que no hablamos: una cookie que lo pide es basura y se
   * cae a la cabecera. El español no se puede apagar: es el destino final.
   */
  permitidos?: readonly Idioma[]
}): Idioma {
  const permitidos = entrada.permitidos ?? IDIOMAS
  return (
    normalizarIdioma(entrada.cuenta, permitidos) ??
    normalizarIdioma(entrada.cookie, permitidos) ??
    idiomaDeCabecera(entrada.cabecera, permitidos) ??
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

// ─── LA PREFERENCIA DE LA CUENTA (IDIOMA-USUARIO, 2026-11-03) ───────────────
//
//  La preferencia vive en `usuarios.idioma_preferido`, pero leerla de la base
//  en CADA peticion costaria una consulta en el layout raiz y —peor— no llegaria
//  a quien decide el idioma sin poder esperar: `idiomaDeLaPeticion()` es
//  SINCRONA y la llaman `respuestaError()` (el `catch` de cada ruta) y media
//  docena de Server Components. Volverla asincrona tocaba cientos de llamadas.
//
//  Asi que la preferencia VIAJA CON LA SESION en una cookie aparte, que pone el
//  SERVIDOR al abrir sesion (login, Google, codigo de recuperacion) y al
//  guardarla en «Mi cuenta», y que borra el logout:
//
//      spaces_idioma_cuenta = <idioma>.<huella de la sesion>
//
//  La huella (`lib/server/idioma-cuenta.ts`) es un resumen del token de
//  `spaces_sesion`. Atarla a la sesion es lo que impide que, en un navegador
//  compartido, la preferencia de una persona se le aplique a la siguiente: al
//  cambiar la sesion la huella deja de casar y la cookie se ignora, aunque nadie
//  la haya borrado. Sin sesion (login, paginas publicas) tampoco casa con nada,
//  y manda el navegador.
//
//  No es una credencial: falsificarla solo cambia el idioma de quien la
//  falsifica. Va `httpOnly` porque nadie en el navegador necesita leerla.
//
//  Lo que cuesta, y se acepta: si la persona cambia su preferencia desde OTRO
//  dispositivo, este no se entera hasta su siguiente inicio de sesion (o hasta
//  que la vuelva a guardar aqui). Ver `vault/03-Frontend/idiomas-es-en.md`.

export const COOKIE_IDIOMA_CUENTA = 'spaces_idioma_cuenta'

/** El valor de la cookie de la cuenta: `<idioma>.<huella>`. */
export function valorCookieIdiomaCuenta(idioma: Idioma, huella: string): string {
  return `${idioma}.${huella}`
}

/**
 * El idioma que lleva la cookie de la cuenta, SOLO si es de la sesion de esta
 * peticion. Cualquier otra cosa —sin sesion, otra sesion, mal formada, un
 * idioma que no existe— da `null`, y entonces manda el navegador.
 */
export function idiomaDeCookieCuenta(
  valor: string | null | undefined,
  huella: string | null | undefined,
): Idioma | null {
  if (typeof valor !== 'string' || typeof huella !== 'string' || huella === '') return null
  const punto = valor.indexOf('.')
  if (punto < 0) return null
  const idioma = valor.slice(0, punto)
  if (valor.slice(punto + 1) !== huella) return null
  return esIdioma(idioma) ? idioma : null
}

/**
 * Lo que «Mi cuenta» acepta guardar. `null` o `'navegador'` = no elegir (seguir
 * al navegador). Un idioma solo si esta ENCENDIDO: la pantalla no ofrece los
 * apagados, y guardar algo que no se va a aplicar seria mentirle a quien lo
 * elige. Sin normalizar a proposito —ni regiones ni mayusculas—: quien llama es
 * nuestra pantalla, y un valor raro es un error, no una preferencia.
 */
export function preferenciaDeIdioma(
  valor: unknown,
  permitidos: readonly Idioma[],
): { ok: true; idioma: Idioma | null } | { ok: false } {
  if (valor === null || valor === 'navegador') return { ok: true, idioma: null }
  if (typeof valor === 'string' && esIdioma(valor) && permitidos.includes(valor)) {
    return { ok: true, idioma: valor }
  }
  return { ok: false }
}

/**
 * ¿La pantalla de entrar tiene que hacer una carga COMPLETA tras el login?
 * Solo si la cuenta trae un idioma encendido distinto del que se está viendo:
 * `router.push` no vuelve a pintar el layout raíz, que es quien lleva el
 * idioma. Sin preferencia, la navegación suave de siempre.
 */
export function cambiaIdiomaAlEntrar(
  idiomaCuenta: string | null | undefined,
  actual: Idioma,
  disponibles: readonly Idioma[],
): boolean {
  const deCuenta = normalizarIdioma(idiomaCuenta, disponibles)
  return deCuenta !== null && deCuenta !== actual
}
