#!/usr/bin/env node
// ============================================================================
//  reporte.mjs — el receptor de reportes del PADRE.  (F6.4)
// ----------------------------------------------------------------------------
//  F6.2 resuelve la visibilidad con el padre CONSULTANDO `GET /api/version` de
//  cada instancia. Funciona mientras el owner exponga esa ruta. El día que la
//  cierre —y está en su derecho: es su servidor, y en el modelo de instancias
//  soberanas esa es la respuesta correcta— el padre se queda ciego.
//
//  Este archivo es la otra dirección: la instancia decide qué cuenta y cuándo,
//  igual que decide cuándo jala una versión. El padre no abre ni una conexión
//  hacia la instancia por causa de esto.
//
//  Uso:
//    cd apps/flota && node reporte.mjs          # escucha en 127.0.0.1:8787
//    FLOTA_PUERTO=9000 node reporte.mjs
//
//  Detrás de nginx en el padre, SIEMPRE por TLS: el token viaja en la cabecera.
//
//  ─── Archivos, no base de datos ───────────────────────────────────────────
//  Un `estado/<instancia>.json` por instancia. Son diez instancias, no diez
//  mil, y una base nueva en el padre es un servicio más que respaldar, migrar y
//  vigilar por cero beneficio. El día que sean cien se cambia el almacén sin
//  tocar nada más: todo lo que escribe está en `guardarReporte`.
//
//  ─── Un reporte con claves de más se rechaza ENTERO ───────────────────────
//  No se guarda «lo que se entienda». El contrato es el de F6.1 más
//  `instancia`, y se comprueba por igualdad de conjuntos, no por presencia de
//  las que interesan. El motivo no es purismo: una clave que nadie pidió es la
//  puerta por la que un conteo del negocio del owner acaba en el disco del
//  padre, y ahí ya no hay quien lo quite. Falla ruidoso y se arregla; se guarda
//  a medias y no se entera nadie.
//
//  ─── El token dice QUIÉN, y el cuerpo también: tienen que coincidir ───────
//  El token identifica a la instancia contra el inventario del padre. El cuerpo
//  trae `instancia`. Si no son la misma, se rechaza: si no, una instancia con
//  su token legítimo podría sobrescribir el estado de otra.
// ============================================================================

import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CLAVES_REPORTE, cargarInventario, tokenDe } from './estado.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))

/** Un nombre de instancia es un identificador, no texto libre: es un nombre de archivo. */
const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9-]{0,39}$/

/** 8 KB es de sobra para siete claves. Lo que pase de ahí no es un reporte. */
const CUERPO_MAXIMO = 8 * 1024

function esObjetoLlano(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * El contrato, comprobado por igualdad de conjuntos de claves y por tipos.
 * Devuelve `{ ok: true, reporte }` o `{ ok: false, motivo }`; nunca lanza.
 */
export function validarReporte(cuerpo) {
  if (!esObjetoLlano(cuerpo)) return { ok: false, motivo: 'el cuerpo no es un objeto JSON' }

  const claves = Object.keys(cuerpo)
  const deMas = claves.filter((c) => !CLAVES_REPORTE.includes(c))
  const faltan = CLAVES_REPORTE.filter((c) => !claves.includes(c))
  if (deMas.length) {
    return {
      ok: false,
      motivo:
        'claves de mas, se rechaza el reporte entero: ' +
        deMas.join(', ') +
        '. El contrato es exactamente ' +
        CLAVES_REPORTE.join(', '),
    }
  }
  if (faltan.length) return { ok: false, motivo: 'faltan claves: ' + faltan.join(', ') }

  const { ok, version, ultimaMigracion, base, canal, uptime, instancia } = cuerpo
  if (typeof ok !== 'boolean') return { ok: false, motivo: '`ok` no es booleano' }
  if (typeof version !== 'string' || !version) return { ok: false, motivo: '`version` vacia o no es texto' }
  if (ultimaMigracion !== null && typeof ultimaMigracion !== 'string') {
    return { ok: false, motivo: '`ultimaMigracion` no es texto ni null' }
  }
  if (base !== 'ok' && base !== 'error') return { ok: false, motivo: '`base` no es "ok" ni "error"' }
  if (typeof canal !== 'string' || !canal) return { ok: false, motivo: '`canal` vacio o no es texto' }
  if (typeof uptime !== 'number' || !Number.isFinite(uptime) || uptime < 0) {
    return { ok: false, motivo: '`uptime` no es un numero de segundos' }
  }
  if (typeof instancia !== 'string' || !NOMBRE_VALIDO.test(instancia)) {
    return {
      ok: false,
      motivo: '`instancia` no es un nombre valido (minusculas, digitos y guiones)',
    }
  }

  // Se reconstruye clave a clave y en el orden del contrato. Copiar `cuerpo`
  // con un `spread` guardaría lo que hubiera llegado de más si algún día esta
  // validación se relajara; así, lo que se guarda es lo que se validó.
  return {
    ok: true,
    reporte: { ok, version, ultimaMigracion, base, canal, uptime, instancia },
  }
}

/**
 * Escribe `estado/<instancia>.json` — y SOLO ese. Si el cuerpo no valida no se
 * toca el disco: ni el archivo de esa instancia, ni el de ninguna otra.
 *
 * `nombreEsperado` es quién dice el TOKEN que está hablando.
 */
export async function guardarReporte(cuerpo, opciones) {
  const { dirEstado, nombreEsperado, ahora = new Date().toISOString() } = opciones

  const revision = validarReporte(cuerpo)
  if (!revision.ok) return revision

  const { reporte } = revision
  if (nombreEsperado && reporte.instancia !== nombreEsperado) {
    return {
      ok: false,
      motivo:
        'el token es de "' +
        nombreEsperado +
        '" y el reporte dice ser de "' +
        reporte.instancia +
        '": una instancia no reporta por otra',
    }
  }

  await mkdir(dirEstado, { recursive: true })
  const destino = join(dirEstado, reporte.instancia + '.json')
  // Se escribe al lado y se renombra: un `writeFile` interrumpido a la mitad
  // deja un JSON truncado, y el panel se lo encuentra la próxima vez que corra.
  const temporal = destino + '.parcial'
  await writeFile(temporal, JSON.stringify({ ...reporte, recibidoEn: ahora }, null, 2) + '\n', 'utf8')
  await rename(temporal, destino)
  return { ok: true, archivo: destino, reporte }
}

/** SHA-256 antes de comparar, para que los buffers midan siempre lo mismo. Igual que la ruta. */
function tokenCoincide(recibido, esperado) {
  const a = createHash('sha256').update(recibido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

/**
 * De un token a un nombre de instancia, recorriendo el inventario. Sin token
 * configurado para una instancia, esa instancia NO puede reportar: ausente =
 * cerrado, igual que en `/api/version` y que el autoregistro.
 */
export function instanciaDelToken(recibido, instancias, entorno = process.env) {
  if (!recibido) return null
  for (const instancia of instancias) {
    const esperado = tokenDe(instancia.nombre, entorno)
    if (esperado && tokenCoincide(recibido, esperado)) return instancia.nombre
  }
  return null
}

async function leerCuerpo(peticion) {
  let bytes = 0
  const trozos = []
  for await (const trozo of peticion) {
    bytes += trozo.length
    if (bytes > CUERPO_MAXIMO) throw new Error('cuerpo demasiado grande')
    trozos.push(trozo)
  }
  return Buffer.concat(trozos).toString('utf8')
}

export function crearServidor({ instancias, dirEstado, ruta = '/flota/reporte' }) {
  return createServer(async (peticion, respuesta) => {
    const responder = (codigo, datos) => {
      respuesta.writeHead(codigo, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      respuesta.end(JSON.stringify(datos))
    }

    if (peticion.method !== 'POST' || (peticion.url ?? '').split('?')[0] !== ruta) {
      return responder(404, { ok: false })
    }

    const nombre = instanciaDelToken(peticion.headers['x-flota-token'], instancias)
    if (!nombre) {
      // Sin decir por qué: un token equivocado y un nombre que no existe se
      // contestan igual, o el mensaje enseña quién está en el inventario.
      return responder(401, { ok: false })
    }

    let cuerpo
    try {
      cuerpo = JSON.parse(await leerCuerpo(peticion))
    } catch (error) {
      return responder(400, { ok: false, motivo: String(error?.message ?? error) })
    }

    const resultado = await guardarReporte(cuerpo, { dirEstado, nombreEsperado: nombre })
    if (!resultado.ok) {
      // El motivo SÍ se devuelve aquí: quien manda ya sabe lo que mandó, y sin
      // el motivo un emisor mal configurado reintenta la misma basura cada
      // noche sin que nadie sepa qué le pasa.
      console.error('reporte rechazado de ' + nombre + ': ' + resultado.motivo)
      return responder(422, { ok: false, motivo: resultado.motivo })
    }
    console.log('reporte de ' + nombre + ' -> ' + resultado.archivo)
    return responder(200, { ok: true })
  })
}

async function principal() {
  const dirEstado = process.env.FLOTA_DIR_ESTADO ?? join(AQUI, 'estado')
  const puerto = Number(process.env.FLOTA_PUERTO ?? 8787)
  // 127.0.0.1 y no 0.0.0.0: quien termina TLS y mira el `Host` es nginx. Este
  // proceso no debe ser alcanzable desde fuera del padre ni por accidente.
  const interfaz = process.env.FLOTA_INTERFAZ ?? '127.0.0.1'

  const inventario = await cargarInventario()
  if (inventario.esEjemplo) {
    console.error('AVISO: no hay flota.json; el receptor arranca con el inventario de EJEMPLO.')
  }
  await mkdir(dirEstado, { recursive: true })

  crearServidor({ instancias: inventario.instancias, dirEstado }).listen(puerto, interfaz, () => {
    console.log('receptor de flota en http://' + interfaz + ':' + puerto + '/flota/reporte')
    console.log('estado en ' + dirEstado)
  })
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal().catch((error) => {
    console.error('ERROR receptor: ' + String(error?.stack ?? error))
    process.exit(1)
  })
}
