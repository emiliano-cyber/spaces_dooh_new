#!/usr/bin/env node
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

const AQUI = dirname(fileURLToPath(import.meta.url))

/** Las claves EXACTAS que `GET /api/version` devuelve con token (F6.1). */
export const CLAVES_VERSION = ['ok', 'version', 'ultimaMigracion', 'base', 'canal', 'uptime']

/**
 * Las del reporte saliente (F6.4): las de F6.1 más `instancia`, que es lo que
 * el padre no puede deducir de una conexión que no abrió él.
 */
export const CLAVES_REPORTE = [...CLAVES_VERSION, 'instancia']

/** Las únicas columnas que el panel guarda de un owner. La lista es la promesa. */
export const COLUMNAS = ['nombre', 'dominio', 'canal', 'version', 'estado', 'fecha', 'origen']

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
    }
  })
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

/** `FLOTA_TOKEN_<NOMBRE>`, y si no, el compartido. Ver la cabecera. */
export function tokenDe(nombre, entorno = process.env) {
  const clave = 'FLOTA_TOKEN_' + String(nombre).toUpperCase().replace(/-/g, '_')
  return entorno[clave] || entorno.FLOTA_TOKEN || ''
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
    if (!respuesta.ok) return { ...fila, motivo: 'HTTP ' + respuesta.status }
    const cuerpo = await respuesta.json()
    if (typeof cuerpo?.version !== 'string') {
      return {
        ...fila,
        motivo: token
          ? 'contesto sin version: el token no lo reconoce como panel'
          : 'no hay token para esta instancia (FLOTA_TOKEN_' +
            String(instancia.nombre).toUpperCase().replace(/-/g, '_') +
            ')',
      }
    }
    return { ...fila, version: cuerpo.version, fecha: ahora() }
  } catch (error) {
    return { ...fila, motivo: String(error?.message ?? error) }
  }
}

/**
 * El inventario. `flota.json` si existe; si no, el de ejemplo, avisando.
 * Devuelve también de dónde salió: quien lea la tabla tiene que poder saber si
 * está mirando la flota o tres dominios inventados.
 */
export async function cargarInventario(dir = AQUI) {
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
    const datos = JSON.parse(crudo)
    return {
      archivo,
      esEjemplo,
      canales: datos.canales ?? null,
      instancias: Array.isArray(datos.instancias) ? datos.instancias : [],
    }
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
  const consultas = await Promise.all(
    inventario.instancias.map((i) => consultar(i, { token: tokenDe(i.nombre) })),
  )
  const { reportes, avisos } = await leerReportes(dirEstado, inventario.instancias)
  const filas = resumen(fusionar(consultas, reportes), versiones)

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
