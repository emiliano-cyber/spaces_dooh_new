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

import { readdir, readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { validarSolicitud, CAMPOS } from './solicitudes.mjs'
import { PENDIENTE, EN_CURSO } from './ejecutor.mjs'

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
  // Se escribe aparte y se renombra: un corte a mitad deja un `.tmp`, no una
  // solicitud a medias que el ejecutor pueda leer.
  const tmp = rutaDe(dir, id) + '.tmp'
  await writeFile(tmp, JSON.stringify(solicitud, null, 2) + '\n', 'utf8')
  await rename(tmp, rutaDe(dir, id))
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

/** Cambia el estado y añade lo que se sepa. No borra nada de lo anterior. */
export async function marcar(dir, id, estado, extra = {}) {
  const ruta = rutaDe(dir, id)
  const solicitud = JSON.parse(await readFile(ruta, 'utf8'))
  const actualizada = {
    ...solicitud,
    estado,
    // El historial se acumula: qué pasó y cuándo. Es lo que el panel enseña y
    // lo que queda para saber por qué falló un alta de hace tres semanas.
    historial: [...(solicitud.historial ?? []), { estado, cuando: new Date().toISOString(), ...extra }],
  }
  const tmp = ruta + '.tmp'
  await writeFile(tmp, JSON.stringify(actualizada, null, 2) + '\n', 'utf8')
  await rename(tmp, ruta)
  return actualizada
}

/** Añade una línea al registro de una solicitud, para que el panel la enseñe. */
export async function anotarEn(dir, id, linea) {
  const ruta = rutaDe(dir, id)
  const solicitud = JSON.parse(await readFile(ruta, 'utf8'))
  solicitud.registro = [...(solicitud.registro ?? []), linea]
  const tmp = ruta + '.tmp'
  await writeFile(tmp, JSON.stringify(solicitud, null, 2) + '\n', 'utf8')
  await rename(tmp, ruta)
}
