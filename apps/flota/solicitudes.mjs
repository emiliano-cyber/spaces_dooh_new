// ============================================================================
//  solicitudes.mjs — la entrada NO CONFIABLE del alta.  (ADR 0027)
// ----------------------------------------------------------------------------
//  El panel no tiene credenciales: lo unico que puede hacer un panel
//  comprometido es escribir una solicitud. El ejecutor la lee y aprovisiona una
//  maquina con ella.
//
//  O sea que **la solicitud es la superficie real del diseño entero**, y aqui se
//  valida OTRA VEZ -- no porque el panel valide mal, sino porque el ejecutor no
//  puede saber si quien escribio ese archivo fue el panel.
//
//  Dos reglas, y las dos son la misma idea:
//
//   1. Lista blanca de forma. Se acepta lo que ENCAJA, no se rechaza lo que
//      parece peligroso. Una lista negra siempre se queda corta.
//   2. Los argumentos salen como LISTA, para `spawn` SIN shell. Con una lista,
//      un valor raro es un valor raro; en una cadena, es un comando.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

/** Lo unico que una solicitud puede traer. Todo lo demas se ignora. */
export const CAMPOS = ['instancia', 'dominio', 'email']

// Nombre de instancia: minusculas, digitos y guion interior. Empieza y acaba en
// alfanumerico -- si empezara por guion, el guion se leeria como bandera.
// Tampoco `/`, `\` ni puntos: acaba siendo parte de un nombre de archivo.
const RE_INSTANCIA = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/

// Dominio: etiquetas alfanumericas separadas por punto, con TLD de letras. No
// admite espacios, comillas, `$`, backticks, `;`, `|`, `&` ni saltos de linea
// porque simplemente NO ENCAJAN, no porque se busquen.
const RE_DOMINIO = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/

// Correo: deliberadamente estrecho. Aqui no se trata de aceptar todo lo que la
// RFC permite, sino de no dejar pasar nada que un shell pueda leer.
const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,63}$/

/** `{ ok, errores }`. Nunca lanza: quien llama decide qué hacer con el fallo. */
export function validarSolicitud(datos) {
  const errores = []
  const d = datos && typeof datos === 'object' ? datos : {}

  for (const campo of CAMPOS) {
    if (typeof d[campo] !== 'string' || d[campo].length === 0) {
      errores.push(`falta ${campo}`)
    }
  }
  if (errores.length) return { ok: false, errores }

  // Se comparan con el valor TAL CUAL, sin `trim()`: un valor con espacios
  // alrededor es un valor mal escrito, y recortarlo en silencio es como se
  // cuelan las cosas. Que falle y se vea.
  if (!RE_INSTANCIA.test(d.instancia)) {
    errores.push('instancia: solo minusculas, digitos y guion interior (max 32)')
  }
  if (!RE_DOMINIO.test(d.dominio)) {
    errores.push('dominio: no parece un nombre de dominio')
  }
  if (!RE_EMAIL.test(d.email)) {
    errores.push('email: no parece un correo')
  }

  return errores.length ? { ok: false, errores } : { ok: true, errores: [] }
}

/**
 * Los argumentos del alta, para `spawn(guion, argumentos, {env})` SIN shell.
 *
 * Lo que la solicitud NO decide, y por eso no se lee de ella:
 *
 *  · `DO_REGION` y `DO_TAMANO` salen del entorno del ejecutor. Una region
 *    elegida desde fuera es una factura elegida desde fuera.
 *  · El CANAL no se pasa nunca. `provision-instancia.sh:82` usa `estable` por
 *    omision, y el invariante 13 dice que nada llega a un owner sin pasar por
 *    el banco de pruebas. Un campo `canal` en un formulario es la forma de
 *    saltarselo sin darse cuenta.
 */
export function argumentosDeAlta(solicitud, entornoEjecutor = {}) {
  const v = validarSolicitud(solicitud)
  if (!v.ok) throw new Error(`solicitud invalida: ${v.errores.join('; ')}`)

  return {
    argumentos: [
      '--crear-droplet',
      '--dominio',
      solicitud.dominio,
      '--instancia',
      solicitud.instancia,
      '--confirmar',
    ],
    entorno: {
      DO_REGION: entornoEjecutor.DO_REGION,
      DO_TAMANO: entornoEjecutor.DO_TAMANO,
      DO_SSH_KEYS: entornoEjecutor.DO_SSH_KEYS,
      REGISTRY: entornoEjecutor.REGISTRY,
      REGISTRY_TOKEN: entornoEjecutor.REGISTRY_TOKEN,
    },
  }
}
