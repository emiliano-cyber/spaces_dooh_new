// ============================================================================
//  inscribir.mjs — apuntar una instancia recién creada.  (ADR 0029, punto 6)
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-07 el ejecutor creaba la máquina y **no la apuntaba en
//  ningún sitio**. El panel lee un inventario a mano (`flota.json`), así que
//  cada alta quedaba INVISIBLE hasta que una persona añadiera su fila y su
//  token — y el día que se olvidara, la instancia quedaba funcionando pero sin
//  que nadie supiera si está al día. Que es justo lo que el panel existe para
//  evitar.
//
//  ─── Por qué se escribe en `/etc/space-os/` y NO en `flota.json` ───────────
//  `flota.json` vive en `/var/www/Spaces`. Dar permiso de escritura ahí al
//  proceso que tiene los tres tokens le daría además la capacidad de **alterar
//  el código de la aplicación**. El ejecutor escribe en su propio sitio, con
//  dueño `altas` y grupo `flota`, y el panel lo lee y lo mezcla.
//
//  ─── Y por qué esto NUNCA lanza ───────────────────────────────────────────
//  Cuando se llega aquí la máquina YA EXISTE y ya está servida. Quedar fuera
//  del panel es molesto y se arregla en un minuto; abortar un alta buena porque
//  no se pudo escribir un archivo del panel sería cambiar un problema pequeño
//  por uno grande. Devuelve `{ok:false, motivo}` y quien llame lo anota.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// Las DOS rutas se importan de `estado.mjs`, que es quien las declara.
//
// `RUTA_TOKENS` vivía aquí como una segunda copia del mismo literal —una en el
// que ESCRIBE y otra en el que LEE—, mientras `RUTA_INSTANCIAS` ya se importaba.
// Dos literales que tienen que coincidir y que nadie compara: cambiar uno dejaba
// al ejecutor escribiendo donde el panel no mira, **sin que nada diera error**.
// Es la misma forma del defecto de `marcar()`/`avanzar()` del 2026-09-08, y se
// vio al mover las rutas fuera de `/etc/space-os/`: había que cambiarla dos
// veces.
//
// Se re-exporta para no romper a quien la importe de aquí.
import { RUTA_INSTANCIAS, RUTA_TOKENS } from './estado.mjs'

export { RUTA_TOKENS }

/**
 * `ensayo4` → `FLOTA_TOKEN_ENSAYO4`.
 *
 * Es el contrato con `estado.mjs`: si esto no coincide con lo que busca
 * `tokenDe()`, el panel dice «no hay token para esta instancia» y nadie sabe por
 * qué. Por eso tiene su propia prueba.
 */
export function claveDeToken(nombre) {
  return 'FLOTA_TOKEN_' + String(nombre).toUpperCase().replace(/-/g, '_')
}

/** Escritura de una pieza: temporal propio y `rename`. Igual que `cola.mjs`. */
async function escribirAtomico(ruta, texto) {
  const tmp = `${ruta}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  try {
    await writeFile(tmp, texto, 'utf8')
    await rename(tmp, ruta)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {})
    throw e
  }
}

/**
 * Añade la instancia al inventario del ejecutor.
 *
 * **Idempotente**: si ya está, se reemplaza en su sitio en vez de duplicarse. El
 * ejecutor puede pasar dos veces —un reintento, otra pasada del temporizador— y
 * dos filas iguales harían que el panel consultara la misma máquina dos veces.
 */
async function apuntarInstancia(ruta, fila) {
  let previas = []
  try {
    const crudo = await readFile(ruta, 'utf8')
    const datos = JSON.parse(crudo)
    const lista = Array.isArray(datos) ? datos : datos?.instancias
    previas = Array.isArray(lista) ? lista : []
  } catch (e) {
    // Que NO exista es normal: la primera vez. Que exista y no se pueda leer es
    // otra cosa, y ahí se para: sobrescribirlo sería perder el inventario
    // entero por un JSON a medio escribir.
    if (e && e.code !== 'ENOENT') throw e
  }

  const otras = previas.filter((i) => i && i.nombre !== fila.nombre)
  await escribirAtomico(ruta, JSON.stringify({ instancias: [...otras, fila] }, null, 2) + '\n')
}

/**
 * Deja el token de la instancia donde el panel lo lee.
 *
 * Formato de `EnvironmentFile` de systemd: `CLAVE=valor`, sin comillas. Un token
 * nuevo **reemplaza** al viejo en vez de acumularse: si se acumularan,
 * `tokensDeArchivo()` se quedaría con el último y nadie sabría cuál está usando
 * el panel.
 */
async function apuntarToken(ruta, clave, valor) {
  let lineas = []
  try {
    lineas = (await readFile(ruta, 'utf8')).split('\n')
  } catch (e) {
    if (e && e.code !== 'ENOENT') throw e
  }
  const otras = lineas.filter((l) => l.trim() !== '' && !l.startsWith(`${clave}=`))
  await escribirAtomico(ruta, [...otras, `${clave}=${valor}`, ''].join('\n'))
}

/**
 * Inscribe la instancia: su fila en el inventario y su token para el panel.
 *
 * `{ ok }` o `{ ok:false, motivo }`. **No lanza nunca.**
 */
export async function inscribir(datos = {}, opciones = {}) {
  const { rutaInstancias = RUTA_INSTANCIAS, rutaTokens = RUTA_TOKENS } = opciones
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
  const dominio = typeof datos.dominio === 'string' ? datos.dominio.trim() : ''
  const token = typeof datos.token === 'string' ? datos.token.trim() : ''

  if (!nombre || !dominio || !token) {
    return { ok: false, motivo: 'faltan nombre, dominio o token: no se apunta nada' }
  }

  try {
    // El canal NO lo decide quien llama, ni la solicitud. Un canal por instancia
    // es como se salta el invariante 13 sin darse cuenta — misma regla que en el
    // alta, donde el canal no se pasa nunca.
    await apuntarInstancia(rutaInstancias, { nombre, dominio, canal: 'estable' })
    await apuntarToken(rutaTokens, claveDeToken(nombre), token)
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: String(e?.message ?? e) }
  }
}
