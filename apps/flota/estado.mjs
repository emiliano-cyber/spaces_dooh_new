// ============================================================================
//  estado.mjs — el panel de flota del PADRE.  (F6.2, y el paso 4 de F6.4)
// ----------------------------------------------------------------------------
//  Pregunta `GET /api/version` a cada instancia del inventario, mezcla lo que
//  contestan con lo que ellas mismas hayan reportado (F6.4) y saca una tabla:
//  quién va al día, quién se quedó atrás y quién no contesta.
//
//  Uso:
//    cd apps/flota && node estado.mjs
//    cd apps/flota && npx vitest run estado.test.ts
//
//  ─── Por qué esto NO vive en `apps/web` ───────────────────────────────────
//  El artefacto es idéntico para toda la flota (invariante 3). Si el panel
//  viviera en `apps/web`, la lista de instancias —o sea, la lista de clientes
//  con sus dominios— viajaría dentro de la imagen que corre CADA owner en SU
//  servidor. `Dockerfile` construye con `--filter=web`, así que desde aquí no
//  viaja; ese filtro es lo único que lo garantiza, y por eso este workspace no
//  se mueve de sitio.
//
//  ─── LO QUE EL PANEL NO GUARDA, Y ES LO IMPORTANTE ────────────────────────
//  Nombre, dominio, canal, versión, fecha y estado. Nada más. Ni conteos, ni
//  nombres de organización, ni usuarios. `resumen()` recorta contra la lista
//  blanca `COLUMNAS` en vez de confiar en lo que devuelva la instancia: el día
//  que `/api/version` crezca una clave, aquí no entra sola, y hay una prueba
//  que lo afirma con las claves EXACTAS.
//
//  ─── El inventario: `flota.json`, que NO está en git ──────────────────────
//  El plan pedía versionar `flota.json`. No se hizo, y es a propósito: sería un
//  inventario de clientes con sus dominios dentro del repositorio, y la regla
//  del proyecto es que ningún valor real vive en un archivo versionado. Lo que
//  se versiona es `flota.example.json`, con dominios `.invalid` que no existen
//  ni pueden existir (RFC 2606). Si `flota.json` está, manda él; si no, se usa
//  el de ejemplo y se AVISA por pantalla — así `node estado.mjs` funciona en un
//  clon recién hecho, que es lo que pide la verificación de la tarea, sin que
//  nadie confunda la salida de ejemplo con la de la flota de verdad.
//
//  ─── Los tokens no están en el inventario ─────────────────────────────────
//  Van por entorno, uno por instancia: `FLOTA_TOKEN_<NOMBRE>` (el nombre en
//  mayúsculas, con `-` convertido en `_`). `FLOTA_TOKEN` a secas sirve de
//  respaldo para toda la flota, pero un token compartido convierte a cualquier
//  instancia comprometida en el panel de todas las demás: se usa para probar,
//  no para operar.
//
//  ─── Sale SIEMPRE con 0 ───────────────────────────────────────────────────
//  Un panel que revienta cuando una instancia se cae no sirve para vigilar
//  —justo el día que hace falta es el día que no arranca—. Una instancia
//  inalcanzable es una fila `sin-respuesta`, no un error del programa. Lo único
//  que sale distinto de 0 es no poder leer NINGÚN inventario: sin inventario no
//  hay panel que enseñar.
// ============================================================================

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clasificarFallo, fraseDeActualizacion } from './diagnostico.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))

/** Las claves EXACTAS que `GET /api/version` devuelve con token (F6.1). */
export const CLAVES_VERSION = ['ok', 'version', 'ultimaMigracion', 'base', 'canal', 'uptime']

/**
 * Las del reporte saliente (F6.4): las de F6.1 más `instancia`, que es lo que
 * el padre no puede deducir de una conexión que no abrió él.
 */
export const CLAVES_REPORTE = [...CLAVES_VERSION, 'instancia']

/**
 * Lo que un `update.sh` NUEVO añade, y que uno viejo no manda (fase 2): **el
 * código de salida de su última corrida**, y nada más.
 *
 * **Opcional a propósito.** `validarReporte` exige que estén todas las de
 * `CLAVES_REPORTE`, así que declararlo ahí dejaría sin reportar a toda
 * instancia que no se haya actualizado todavía — y eso es la flota entera el
 * día del despliegue.
 *
 * **Una sola clave, y es un número.** La primera versión mandaba `resultado` y
 * `paso`; las dos sobraban. El código ya dice si fue un fallo (0 y 75 no lo
 * son) y dice bastante más que un nombre de paso: un **2** es «la base pudo
 * cambiar» y un **3** es «no se aplicó nada». Ver `diagnostico.mjs`.
 *
 * Y por eso el orden del despliegue no es negociable: **el PADRE primero**. Ese
 * mismo validador rechaza el reporte ENTERO ante una clave que no conoce, así
 * que soltar `update.sh` antes que el panel deja la flota ciega justo por el
 * cambio que venía a darle vista.
 */
export const CLAVES_REPORTE_OPCIONALES = ['codigo']

/** Las únicas columnas que la TABLA imprime. */
export const COLUMNAS = ['nombre', 'dominio', 'canal', 'version', 'estado', 'fecha', 'origen']

/**
 * Las únicas claves que una fila GUARDA. **Aquí vive la promesa**, y desde el
 * 2026-09-10 ya no coincide con `COLUMNAS`.
 *
 * ─── Por qué se separaron ─────────────────────────────────────────────────
 * `COLUMNAS` hacía dos trabajos a la vez: lo que la fila guarda y lo que la
 * tabla imprime. `motivo` no puede ir en la tabla —`principal()` ya lo imprime
 * DEBAJO, y su comentario explica que en una celda la vuelve ilegible el día
 * que hay tres instancias caídas y hay que leerla deprisa— pero sí tiene que
 * viajar en el JSON, o el panel web no puede pintarlo.
 *
 * ─── Por qué estas dos claves no rompen la promesa ────────────────────────
 * La lista blanca existe para que **datos de negocio de un owner** no entren al
 * plano de control: ni conteos, ni razón social, ni cifras. Estas dos las
 * escribe el PADRE — `motivo` sale de un código de error o de un estado HTTP,
 * `ultimaVezBien` de un reloj— y **ninguna se copia del cuerpo de la
 * respuesta**. Hay una prueba que lo afirma, y ese guard es lo único que impide
 * que este campo se convierta en la puerta de atrás de lo que la lista cerró.
 */
export const CLAVES_FILA = [...COLUMNAS, 'motivo', 'ultimaVezBien']

export const AL_DIA = 'al-dia'
export const REZAGADA = 'rezagada'
export const SIN_RESPUESTA = 'sin-respuesta'

/** Lo que se imprime donde no hay dato. Nunca `null` ni cadena vacía: se lee peor. */
const SIN_DATO = '—'

/** Bajo el `basePath` de Next; es la misma ruta que `SALUD_URL` en `instancia.env`. */
const RUTA_VERSION = '/spaces-dooh/api/version/'

/**
 * `al-dia` solo si corre EXACTAMENTE la versión del canal. Cualquier otra cosa
 * es `rezagada`, incluida una instancia que vaya por delante: no se comparan
 * versiones como números porque eso obliga a inventar un orden (¿`v0.5.0-rc1`
 * va antes o después de `v0.5.0`?) y a mantenerlo. Para lo que el panel decide
 * —a quién hay que empujar— «no corre lo que le toca» es la respuesta correcta,
 * y una instancia adelantada también merece que alguien mire por qué.
 */
export function clasificar(version, versionEstable) {
  if (!version) return SIN_RESPUESTA
  return version === versionEstable ? AL_DIA : REZAGADA
}

/**
 * La versión que le toca a un canal. `versiones` puede ser una cadena (la misma
 * para toda la flota) o un objeto `{ estable, beta }`.
 */
export function versionDelCanal(versiones, canal) {
  if (typeof versiones === 'string' || versiones == null) return versiones ?? null
  return versiones[canal] ?? versiones.estable ?? null
}

/**
 * De lo que sea que devolvieron las instancias, a las filas del panel.
 *
 * Aquí está el recorte: se construye la fila con las claves de `COLUMNAS`, no
 * se copia la respuesta y se le borran cosas. La diferencia importa el día que
 * `/api/version` devuelva una clave nueva — con esta forma no entra sola.
 */
export function resumen(respuestas, versiones) {
  return respuestas.map((r) => {
    const canal = r.canal ?? 'desconocido'
    const version = r.version ?? null
    return {
      nombre: r.nombre,
      dominio: r.dominio,
      canal,
      version: version ?? SIN_DATO,
      estado: clasificar(version, versionDelCanal(versiones, canal)),
      fecha: r.fecha ?? SIN_DATO,
      origen: r.origen ?? 'consulta',
      // El motivo de TRANSPORTE gana: si la instancia no contesta AHORA, eso es
      // más urgente que un update que falló ayer — y además hay que arreglarlo
      // antes de poder mirar lo otro. Si contesta, se enseña el del update, que
      // si no no se vería en ninguna parte.
      //
      // `resultado` y `paso` entran SOLO a través de la frase: ninguno de los
      // dos se copia a la fila, y hay una prueba que lo afirma.
      motivo: r.motivo ?? fraseDeActualizacion(r) ?? null,
      ultimaVezBien: r.ultimaVezBien ?? null,
    }
  })
}

/**
 * Arrastra `ultimaVezBien` de la pasada anterior.
 *
 * El panel era una foto sin memoria, y con eso «no contesta» no distinguía un
 * parpadeo de una avería de tres horas — que es la diferencia entre esperar y
 * levantarse. Un solo campo, ninguna base de datos: si la instancia contesta
 * ahora se pone ahora, y si no, se conserva lo que dijera la pasada anterior.
 *
 * **Sin fecha inventada.** Una instancia caída que nunca se vio bien se queda
 * en `null`. Rellenarla con la hora actual diría exactamente lo contrario de la
 * verdad, y es el tipo de dato falso que no da error nunca.
 *
 * `previas` es el arreglo `instancias` del `estado.json` anterior. Nulo,
 * ausente o vacío significa «sin memoria», no un fallo.
 */
export function arrastrarMemoria(filas, previas = [], ahora = () => new Date().toISOString()) {
  const memoria = new Map((previas ?? []).map((p) => [p.nombre, p.ultimaVezBien ?? null]))
  return filas.map((f) => ({
    ...f,
    ultimaVezBien:
      f.version && f.version !== SIN_DATO ? ahora() : (memoria.get(f.nombre) ?? null),
  }))
}

/** `a` es posterior a `b`. Sin fecha se pierde: un dato sin cuándo no gana nada. */
function masReciente(a, b) {
  if (!a) return false
  if (!b) return true
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta)) return false
  if (Number.isNaN(tb)) return true
  return ta > tb
}

/**
 * Consulta y reporte cuentan lo mismo desde dos sitios: gana el más reciente
 * (F6.4, paso 4). Un reporte viejo NO pisa una consulta de hace un minuto.
 *
 * Un reporte de una instancia que no está en el inventario se ignora: el
 * inventario es la autoridad de quién es flota, y un archivo suelto en
 * `estado/` —una instancia dada de baja, un nombre mal escrito— no puede
 * añadir filas al panel.
 */
export function fusionar(consultas, reportes) {
  const porNombre = new Map(consultas.map((c) => [c.nombre, c]))
  for (const reporte of reportes) {
    const consulta = porNombre.get(reporte.nombre)
    if (!consulta) continue
    if (masReciente(reporte.fecha, consulta.fecha)) porNombre.set(reporte.nombre, reporte)
  }
  return [...porNombre.values()]
}

/**
 * Donde el ejecutor de altas deja lo que produce para el panel.
 * (ADR 0029, punto 6.)
 *
 * ─── Por qué NO es `/etc/space-os/`, que es donde estaba ────────────────────
 *
 * Medido el 2026-09-08, al dar de alta `g500`:
 *
 *   no se pudo inscribir en el panel: EACCES: permission denied,
 *   open '/etc/space-os/flota-instancias.json.837647.cc5a1a33.tmp'
 *
 * La escritura es atómica —temporal al lado y `rename`—, así que necesita
 * permiso sobre el DIRECTORIO, no sobre el archivo. Y `/etc/space-os/` guarda
 * `padre.env`, `demo.env` y `ejecutor.env`: darle escritura ahí al usuario
 * `altas` le permitiría **reemplazar los secretos del PADRE**. No leerlos
 * —siguen en 600— pero sí sustituirlos, que para el caso es peor. Es justo lo
 * que se cerró el 25/08 al sacar al PADRE de root.
 *
 * Así que la instancia nacía bien y **invisible para el panel**, y encima sin su
 * token: el fallo ocurre en el primer archivo y el segundo ya no se escribe.
 * Sin token el panel la ve `sin-respuesta`, indistinguible de una caída — la
 * misma ceguera que se arregló esa mañana por otra puerta (`6ed9b81`).
 *
 * `/var/lib/space-os/` es donde el ejecutor YA escribe, no es código y no son
 * secretos: esto es **estado que escribe `altas` y lee `flota`**. Estaba en
 * `/etc` por inercia.
 *
 * ─── Y es un SUBDIRECTORIO, no el padre ────────────────────────────────────
 *
 * `/var/lib/space-os` es `root:root 755`, medido el 2026-09-08. Poner los
 * archivos ahí sueltos daba **exactamente el mismo EACCES**, porque el temporal
 * se crea en el directorio y `altas` no puede crear ahí. El primer intento de
 * arreglar esto lo hizo, y lo cazó mirar el `ls -ld` antes de darlo por bueno.
 *
 * El patrón correcto ya estaba en la misma máquina: `solicitudes/` es un
 * subdirectorio propiedad de `altas`, y el padre sigue siendo de root. Se copia:
 *
 *     mkdir -p /var/lib/space-os/flota
 *     chown altas:flota /var/lib/space-os/flota
 *     chmod 750 /var/lib/space-os/flota      # altas escribe, flota atraviesa
 *
 * El directorio **tiene que existir antes**: `altas` no puede crearlo, así que
 * no se resuelve en tiempo de ejecución. Va en la tarjeta de despliegue.
 */
const DIR_ESTADO_FLOTA = '/var/lib/space-os/flota'

export const RUTA_TOKENS = `${DIR_ESTADO_FLOTA}/flota-tokens.env`

/**
 * Los tokens de instancia que dejó el ejecutor, o `{}` si no hay archivo.
 *
 * Existe porque el ejecutor corre como `altas` y el panel como `flota`, y son
 * usuarios distintos a propósito (ADR 0027). El archivo va `altas:flota` y modo
 * `640`: escribe uno, lee el otro. Así una instancia nueva aparece en el panel
 * **sin reiniciarlo** y sin que el ejecutor necesite `sudo` — que es lo que
 * haría falta para reiniciar un servicio, y le daría al proceso que tiene los
 * tres tokens la capacidad de tocar unidades del sistema.
 *
 * **Un archivo ausente o ilegible no es un error, es ausencia de tokens.** Misma
 * disciplina que `listar()` con un JSON roto: el panel no se cae porque alguien
 * dejó un archivo a medias.
 */
export async function tokensDeArchivo(ruta = RUTA_TOKENS) {
  let texto
  try {
    texto = await readFile(ruta, 'utf8')
  } catch {
    return {}
  }
  const tokens = {}
  for (const linea of texto.split('\n')) {
    const l = linea.trim()
    if (!l || l.startsWith('#')) continue
    const corte = l.indexOf('=')
    if (corte <= 0) continue
    const clave = l.slice(0, corte).trim()
    const valor = l.slice(corte + 1).trim()
    // SOLO tokens de flota. Este archivo no es un `.env` de propósito general, y
    // la lista blanca es lo que impide que el día que alguien le pegue ahí un
    // `DIGITALOCEAN_ACCESS_TOKEN` «para tenerlo a mano», el panel —que da la cara
    // a internet— acabe leyéndolo.
    if (!/^FLOTA_TOKEN_[A-Z0-9_]+$/.test(clave) || !valor) continue
    tokens[clave] = valor
  }
  return tokens
}

/**
 * `FLOTA_TOKEN_<NOMBRE>`, y si no, el compartido. Ver la cabecera.
 *
 * El orden es: el entorno, luego el archivo, y el compartido al final.
 *
 * **El entorno gana sobre el archivo a propósito**: es lo que permite anular un
 * token equivocado sin editar un archivo que escribe otro proceso. Y un token
 * propio —de donde venga— gana sobre el compartido, porque un token compartido
 * convierte cualquier instancia comprometida en el panel de todas las demás.
 */
export function tokenDe(nombre, entorno = process.env, delArchivo = {}) {
  const clave = 'FLOTA_TOKEN_' + String(nombre).toUpperCase().replace(/-/g, '_')
  return entorno[clave] || delArchivo[clave] || entorno.FLOTA_TOKEN || ''
}

/**
 * Una consulta a una instancia. NUNCA lanza: el fallo es una fila
 * `sin-respuesta` con su motivo, y el motivo se queda en el log —no en la
 * tabla— porque puede traer el mensaje crudo de la red.
 */
export async function consultar(instancia, opciones = {}) {
  const {
    token = '',
    esperaMs = 5000,
    ahora = () => new Date().toISOString(),
    pedir = fetch,
  } = opciones

  const fila = {
    nombre: instancia.nombre,
    dominio: instancia.dominio,
    canal: instancia.canal ?? 'desconocido',
    version: null,
    fecha: null,
    origen: 'consulta',
    motivo: null,
  }

  const url = 'https://' + instancia.dominio + (instancia.ruta ?? RUTA_VERSION)
  try {
    const respuesta = await pedir(url, {
      method: 'GET',
      // Sin token la ruta contesta `{ ok }` y nada más: la fila saldría
      // `sin-respuesta` aunque la instancia esté perfecta. Se avisa distinto.
      headers: token ? { 'x-flota-token': token } : {},
      signal: AbortSignal.timeout(esperaMs),
      redirect: 'manual',
    })
    if (!respuesta.ok) return { ...fila, motivo: clasificarFallo({ status: respuesta.status }) }
    const cuerpo = await respuesta.json()
    if (typeof cuerpo?.version !== 'string') {
      // OJO: al clasificador se le pasa el NOMBRE de la instancia, nunca el
      // cuerpo. Es lo que mantiene la promesa de la lista blanca — hay una
      // prueba que afirma que ningun valor del cuerpo acaba en `motivo`.
      return {
        ...fila,
        motivo: clasificarFallo({ cuerpoSinVersion: true, token, nombre: instancia.nombre }),
      }
    }
    return { ...fila, version: cuerpo.version, fecha: ahora() }
  } catch (error) {
    // `error.message` aqui era **`fetch failed`** para toda averia de red: la
    // causa vive en `error.cause.code`, y el clasificador es quien la lee.
    return { ...fila, motivo: clasificarFallo({ error }) }
  }
}

/**
 * Donde el ejecutor de altas apunta las instancias que crea.
 *
 * **Y no es `flota.json` a propósito.** Ese archivo vive en `/var/www/Spaces`, y
 * dar permiso de escritura ahí al proceso que tiene los tres tokens le daría
 * además la capacidad de **alterar el código de la aplicación**. Mismo
 * razonamiento que el archivo de tokens (ADR 0029 punto 6): `altas` escribe,
 * `flota` lee, y el directorio no es ni código ni secretos — ver
 * `DIR_ESTADO_FLOTA` arriba, y por qué dejó de ser `/etc/space-os/`.
 */
export const RUTA_INSTANCIAS = `${DIR_ESTADO_FLOTA}/flota-instancias.json`

/**
 * Las instancias que dejó el ejecutor, o `[]` si no hay archivo.
 *
 * Un archivo ausente o ilegible es **ausencia de instancias, no un error** —
 * misma disciplina que `listar()` con un JSON roto: el panel no se cae porque
 * alguien dejó un archivo a medias. Y se descarta toda entrada sin `nombre` o
 * sin `dominio`: una fila a medias haría que el panel consultara `undefined`.
 */
export async function instanciasDadasDeAlta(ruta = RUTA_INSTANCIAS) {
  let crudo
  try {
    crudo = await readFile(ruta, 'utf8')
  } catch (error) {
    // `ENOENT` es normal: todavía no se ha dado de alta ninguna instancia.
    //
    // Cualquier otra cosa NO lo es, y sobre todo `EACCES`: el archivo lo escribe
    // `altas` y lo lee `flota`, así que un permiso mal puesto es el fallo más
    // probable de los dos. Sin este aviso los dos casos se ven EXACTAMENTE
    // igual —una tabla vacía— y no hay forma de saber cuál de los dos es.
    if (error?.code && error.code !== 'ENOENT') {
      console.error(
        'AVISO flota: no se pudo leer ' + ruta + ' (' + error.code + '). ' +
          'Las instancias dadas de alta NO van a aparecer en el panel.',
      )
    }
    return []
  }
  try {
    const datos = JSON.parse(crudo)
    const lista = Array.isArray(datos) ? datos : datos?.instancias
    if (!Array.isArray(lista)) return []
    return lista.filter((i) => i && typeof i.nombre === 'string' && typeof i.dominio === 'string')
  } catch {
    return []
  }
}

/**
 * El inventario. `flota.json` si existe; si no, el de ejemplo, avisando.
 * Devuelve también de dónde salió: quien lea la tabla tiene que poder saber si
 * está mirando la flota o tres dominios inventados.
 *
 * Y le suma las instancias que el ejecutor dio de alta (`rutaExtra`), que hasta
 * el 2026-09-07 **no las inscribía nadie**: cada alta quedaba invisible en el
 * panel hasta que una persona se acordara de añadir la fila a mano.
 */
export async function cargarInventario(dir = AQUI, rutaExtra = RUTA_INSTANCIAS) {
  const real = join(dir, 'flota.json')
  const ejemplo = join(dir, 'flota.example.json')
  for (const [archivo, esEjemplo] of [
    [real, false],
    [ejemplo, true],
  ]) {
    let crudo
    try {
      crudo = await readFile(archivo, 'utf8')
    } catch {
      continue
    }
    // El ejemplo solo vale si no hay nada real que enseñar. Se comprueba ANTES
    // de usarlo: con instancias dadas de alta, se sale del bucle y el bloque de
    // abajo devuelve las de verdad.
    if (esEjemplo && (await instanciasDadasDeAlta(rutaExtra)).length) break

    const datos = JSON.parse(crudo)
    const aMano = Array.isArray(datos.instancias) ? datos.instancias : []

    // Con el inventario de EJEMPLO no se mezcla nada, y si hay instancias de
    // verdad NO se usa el ejemplo siquiera (ver el bloque de abajo). El ejemplo
    // es para «aquí todavía no hay nada»; mezclarle una instancia real
    // convertiría en mentira el aviso de que sus dominios son `.invalid`.
    const deAltas = esEjemplo ? [] : await instanciasDadasDeAlta(rutaExtra)

    // El de mano GANA: es lo que permite corregir a mano una fila que el alta
    // escribió mal, sin pelearse con un archivo que escribe otro proceso.
    const porNombre = new Map()
    for (const i of deAltas) porNombre.set(i.nombre, i)
    for (const i of aMano) if (i && i.nombre) porNombre.set(i.nombre, i)

    return {
      archivo,
      esEjemplo,
      canales: datos.canales ?? null,
      instancias: [...porNombre.values()],
    }
  }
  // Sin `flota.json`, pero CON instancias dadas de alta. Es el estado normal de
  // un PADRE que solo ha creado clientes desde el panel: `flota.json` no está
  // versionado y nadie lo escribe a mano.
  //
  // Hasta el 07/09 este caso caía al inventario de EJEMPLO y el panel enseñaba
  // tres dominios `.invalid` mientras las instancias de verdad quedaban
  // invisibles. El aviso que aquello protegía —«esto no es la flota»— acababa
  // diciendo justo lo contrario de la verdad: la flota estaba, y lo que se veía
  // era el invento.
  const soloDeAltas = await instanciasDadasDeAlta(rutaExtra)
  if (soloDeAltas.length) {
    return { archivo: rutaExtra, esEjemplo: false, canales: null, instancias: soloDeAltas }
  }

  throw new Error('no hay inventario: falta ' + real + ' y tambien ' + ejemplo)
}

/**
 * Lo que las instancias reportaron por su cuenta (F6.4). Un archivo ilegible se
 * salta con aviso: el panel no se cae por un JSON a medio escribir.
 */
export async function leerReportes(dirEstado, instancias = []) {
  const porNombre = new Map(instancias.map((i) => [i.nombre, i]))
  let archivos = []
  try {
    archivos = (await readdir(dirEstado)).filter((n) => n.endsWith('.json'))
  } catch {
    return { reportes: [], avisos: [] }
  }

  const reportes = []
  const avisos = []
  for (const archivo of archivos) {
    let datos
    try {
      datos = JSON.parse(await readFile(join(dirEstado, archivo), 'utf8'))
    } catch (error) {
      avisos.push('reporte ilegible ' + archivo + ': ' + String(error?.message ?? error))
      continue
    }
    const instancia = porNombre.get(datos?.instancia)
    if (!instancia) {
      avisos.push('reporte de "' + datos?.instancia + '" ignorado: no esta en el inventario')
      continue
    }
    reportes.push({
      nombre: instancia.nombre,
      dominio: instancia.dominio,
      canal: datos.canal ?? instancia.canal,
      version: typeof datos.version === 'string' ? datos.version : null,
      fecha: datos.recibidoEn ?? null,
      origen: 'reporte',
    })
  }
  return { reportes, avisos }
}

/** Tabla de ancho fijo. Sin dependencias: son diez filas, no diez mil. */
export function tabla(filas, columnas = COLUMNAS) {
  const anchos = columnas.map((c) =>
    Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length), 0),
  )
  const linea = (celdas) => celdas.map((v, i) => String(v ?? '').padEnd(anchos[i])).join('  ')
  return [
    linea(columnas),
    anchos.map((a) => '-'.repeat(a)).join('  '),
    ...filas.map((f) => linea(columnas.map((c) => f[c]))),
  ].join('\n')
}

async function principal() {
  const dirEstado = process.env.FLOTA_DIR_ESTADO ?? join(AQUI, 'estado')
  const dirPublico = process.env.FLOTA_DIR_PUBLICO ?? join(AQUI, 'publico')

  let inventario
  try {
    inventario = await cargarInventario()
  } catch (error) {
    console.error('ERROR panel: ' + String(error?.message ?? error))
    return 1
  }

  if (inventario.esEjemplo) {
    console.error(
      'AVISO: no hay flota.json, se esta usando flota.example.json. Los dominios\n' +
        '       son .invalid (RFC 2606): no existen, asi que ninguna consulta va a\n' +
        '       contestar. Esto NO es la flota de verdad.',
    )
  }

  const versiones = inventario.canales ?? process.env.FLOTA_VERSION_ESTABLE ?? null
  // Se lee UNA vez y se reparte: leer el archivo por instancia serían N
  // lecturas por pasada para un archivo que no cambia entre ellas.
  const tokensExtra = await tokensDeArchivo()
  const consultas = await Promise.all(
    inventario.instancias.map((i) => consultar(i, { token: tokenDe(i.nombre, process.env, tokensExtra) })),
  )
  const { reportes, avisos } = await leerReportes(dirEstado, inventario.instancias)

  // La memoria de la pasada anterior. Un archivo que no existe, o roto, o sin
  // permisos, es «sin memoria» y NO un error: el criterio de la cabecera es que
  // el panel sale siempre con 0, porque el día que hace falta vigilar es el día
  // que algo está mal.
  let previas = []
  try {
    const json = JSON.parse(await readFile(join(dirPublico, 'estado.json'), 'utf8'))
    if (Array.isArray(json?.instancias)) previas = json.instancias
  } catch {
    previas = []
  }

  const filas = arrastrarMemoria(resumen(fusionar(consultas, reportes), versiones), previas)

  console.log(tabla(filas))

  // Los motivos van DEBAJO y no en una columna: son texto crudo de la red, de
  // largo impredecible, y meterlos en la tabla la vuelve ilegible justo el día
  // que hay tres instancias caídas y hay que leerla deprisa.
  for (const c of consultas) {
    if (c.motivo) console.error('  ' + c.nombre + ': ' + c.motivo)
  }
  for (const aviso of avisos) console.error('  ' + aviso)

  // El JSON que sirve nginx en el padre como página estática.
  await mkdir(dirPublico, { recursive: true })
  await writeFile(
    join(dirPublico, 'estado.json'),
    JSON.stringify(
      { generadoEn: new Date().toISOString(), inventario: inventario.archivo, versiones, instancias: filas },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  return 0
}

// Solo cuando se ejecuta, nunca al importarlo desde las pruebas.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal()
    .then((codigo) => process.exit(codigo))
    .catch((error) => {
      // Un fallo no previsto del panel tampoco puede parecer «la flota está mal».
      console.error('ERROR panel (no previsto): ' + String(error?.stack ?? error))
      process.exit(1)
    })
}
