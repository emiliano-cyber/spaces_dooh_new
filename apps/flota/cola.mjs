// ============================================================================
//  cola.mjs — las solicitudes de alta, en disco.  (ADR 0027)
// ----------------------------------------------------------------------------
//  Es lo ÚNICO que comparten el panel (que escribe) y el ejecutor (que lee).
//
//  Sin base de datos a propósito: son unas pocas altas al mes, y una base sería
//  una dependencia más y —lo que importa— una credencial más dentro del proceso
//  que da la cara a internet. Un directorio con JSON lo hace igual de bien y
//  deja el panel sin nada que robar.
//
//  Permisos: el panel escribe, el ejecutor lee y marca. En el PADRE eso es un
//  directorio del grupo compartido; los dos usuarios siguen siendo distintos.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

import { readdir, readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { validarSolicitud, CAMPOS } from './solicitudes.mjs'
import { PENDIENTE, EN_CURSO, ESPERANDO_DNS, EMITIENDO_CERT } from './ejecutor.mjs'

// ─── Escribir sin pisarse ───────────────────────────────────────────────────
//
//  El 2026-09-07, el primer alta pedida desde el panel murió con
//  `ENOENT: rename '<id>.json.tmp' -> '<id>.json'` — y con ella se perdió la
//  línea que decía POR QUÉ había fallado el alta, que era la única prueba de la
//  causa real. Eran DOS cosas a la vez:
//
//   · el ejecutor llama a `anotar()` SIN esperarlo (`ejecutor.mjs:64`, `:88` y
//     el `onLinea` de `:78`), y eso es deliberado —que el registro falle no
//     puede tumbar un alta a medias—, así que varias lecturas-modificación-
//     escritura quedan en vuelo al mismo tiempo;
//   · y el temporal se derivaba solo del id, así que TODAS compartían el mismo
//     `<id>.json.tmp`: la primera lo renombraba y la siguiente ya no lo
//     encontraba.
//
//  Se arreglan las dos, porque cada una tapa un fallo distinto. El nombre único
//  evita el choque —también entre procesos, que es el caso real del panel y el
//  ejecutor, que son usuarios distintos—. La cadena por archivo evita lo que el
//  nombre único NO ve: dos lecturas del mismo estado que al escribir se pisan, y
//  la segunda borra la línea de la primera sin dar ningún error.

/** Una cadena de promesas por archivo. Solo sirve dentro de este proceso. */
const cadenas = new Map()

/** Encola `fn` para que dos escrituras del mismo archivo no se solapen. */
function enSerie(ruta, fn) {
  const anterior = cadenas.get(ruta) ?? Promise.resolve()
  // Se sigue tanto si la anterior fue bien como si falló: un error no puede
  // dejar la cadena de ese archivo envenenada para el resto del alta.
  const actual = anterior.then(fn, fn)
  cadenas.set(
    ruta,
    actual.then(
      () => {},
      () => {},
    ),
  )
  return actual
}

/**
 * El JSON entero, de una pieza: temporal **propio** y luego `rename`.
 *
 * Un corte a mitad deja un `.tmp` huérfano, nunca una solicitud a medias que el
 * ejecutor pueda leer.
 */
async function escribirAtomico(ruta, objeto) {
  const tmp = `${ruta}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(objeto, null, 2) + '\n', 'utf8')
    await rename(tmp, ruta)
  } catch (e) {
    // Si no se pudo renombrar, el temporal se retira: uno olvidado confunde a
    // quien mire el directorio después, y `listar()` solo filtra `.json`.
    await rm(tmp, { force: true }).catch(() => {})
    throw e
  }
}

/**
 * Espera a que no quede ninguna escritura en vuelo.
 *
 * Hace falta porque `altas.mjs` termina con `process.exit()`, y eso **corta las
 * escrituras pendientes sin avisar**: sin esto, las últimas líneas del registro
 * —justamente las que dicen cómo acabó el alta— se perderían.
 */
export async function esperarEscrituras() {
  await Promise.allSettled([...cadenas.values()])
}

/** Un id nuestro, con la fecha delante para que el orden sea el de llegada. */
function nuevoId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`
}

/**
 * Un id que de verdad sea un id.
 *
 * Aunque los generemos aquí, esto se comprueba igual: el id llega a formar parte
 * de una ruta, y `../` o `/` dentro escribirían fuera del directorio. Es la
 * misma idea que validar la solicitud dos veces.
 */
function rutaDe(dir, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`id de solicitud invalido: ${JSON.stringify(id)}`)
  }
  return join(dir, `${id}.json`)
}

/**
 * Anota una solicitud. Valida ANTES de escribir: una solicitud inválida no
 * llega a la cola, así no hay que limpiarla después.
 *
 * `id` y `estado` los pone el servidor **aunque vengan en `datos`**:
 *  · un id de fuera podría pisar una solicitud ya aprobada, o salirse del
 *    directorio;
 *  · un `estado: en-curso` de fuera bloquearía la cola entera.
 */
export async function crearSolicitud(dir, datos, pedidaPor) {
  const v = validarSolicitud(datos)
  if (!v.ok) throw new Error(`solicitud invalida: ${v.errores.join('; ')}`)

  const id = nuevoId()
  // Se copian SOLO los campos conocidos. Lo que venga de más no se guarda.
  const limpia = Object.fromEntries(CAMPOS.map((c) => [c, datos[c]]))
  const solicitud = {
    id,
    estado: PENDIENTE,
    ...limpia,
    pedidaPor: typeof pedidaPor === 'string' ? pedidaPor : null,
    cuando: new Date().toISOString(),
    registro: [],
  }

  await mkdir(dir, { recursive: true })
  const ruta = rutaDe(dir, id)
  await enSerie(ruta, () => escribirAtomico(ruta, solicitud))
  return id
}

/** Todas las solicitudes legibles, más nuevas al final. Las rotas se saltan. */
export async function listar(dir) {
  let archivos
  try {
    archivos = (await readdir(dir)).filter((n) => n.endsWith('.json'))
  } catch {
    // Que no exista el directorio es una cola vacía, no un error: el primer
    // arranque es así.
    return []
  }

  const solicitudes = []
  for (const archivo of archivos.sort()) {
    try {
      solicitudes.push(JSON.parse(await readFile(join(dir, archivo), 'utf8')))
    } catch {
      // Un JSON a medio escribir no puede dejar el alta sin funcionar.
      continue
    }
  }
  return solicitudes
}

/**
 * La siguiente a ejecutar, o `null`.
 *
 * **UNA A LA VEZ.** Si hay alguna en curso no se devuelve ninguna: dos altas en
 * paralelo competirían por el mismo `doctl`, la misma clave y —si alguien repite
 * el nombre— el mismo droplet. Es la regla que impide que dos pasadas del
 * temporizador se pisen.
 */
export async function siguientePendiente(dir) {
  const todas = await listar(dir)
  if (todas.some((s) => s.estado === EN_CURSO)) return null
  return todas.find((s) => s.estado === PENDIENTE) ?? null
}

/**
 * Los estados desde los que una solicitud puede **avanzar sola**.
 *
 * Es una lista blanca, no una lista negra, y eso importa: con una lista negra,
 * un estado nuevo entraria aqui por omision y el ejecutor empezaria a tocar
 * solicitudes que nadie penso que fuera a tocar.
 *
 * `fallida`, `lista` y `cert-agotado` NO estan y no deben estar: las dos
 * primeras terminaron, y la tercera espera a una persona a proposito.
 */
export const REANUDABLES = [ESPERANDO_DNS, EMITIENDO_CERT]

/**
 * La siguiente que el ejecutor puede avanzar, o `null`.  (A2.1, ADR 0029)
 *
 * Hermana de `siguientePendiente()` y **con la misma regla de UNA A LA VEZ**:
 * si hay alguna `en-curso` no se devuelve ninguna. Dos altas en paralelo
 * competirian por el mismo `doctl` y la misma clave, y eso no cambia porque
 * ahora haya mas estados.
 *
 * Son dos funciones y no una con un parametro a proposito: si las dos
 * devolvieran lo mismo, el ejecutor podria empezar un alta creyendo que
 * continua otra.
 */
export async function siguienteQueAvanza(dir) {
  const todas = await listar(dir)
  if (todas.some((s) => s.estado === EN_CURSO)) return null
  return todas.find((s) => REANUDABLES.includes(s.estado)) ?? null
}

/** Cambia el estado y añade lo que se sepa. No borra nada de lo anterior. */
export async function marcar(dir, id, estado, extra = {}) {
  const ruta = rutaDe(dir, id)
  // La lectura va DENTRO de la cadena: leer fuera es lo que hacía que dos
  // escrituras partieran del mismo estado y una perdiera lo de la otra.
  return enSerie(ruta, async () => {
    const solicitud = JSON.parse(await readFile(ruta, 'utf8'))
    const actualizada = {
      ...solicitud,
      estado,
      // El historial se acumula: qué pasó y cuándo. Es lo que el panel enseña y
      // lo que queda para saber por qué falló un alta de hace tres semanas.
      historial: [...(solicitud.historial ?? []), { estado, cuando: new Date().toISOString(), ...extra }],
    }
    await escribirAtomico(ruta, actualizada)
    return actualizada
  })
}

/** Añade una línea al registro de una solicitud, para que el panel la enseñe. */
export async function anotarEn(dir, id, linea) {
  const ruta = rutaDe(dir, id)
  return enSerie(ruta, async () => {
    const solicitud = JSON.parse(await readFile(ruta, 'utf8'))
    solicitud.registro = [...(solicitud.registro ?? []), linea]
    await escribirAtomico(ruta, solicitud)
  })
}
