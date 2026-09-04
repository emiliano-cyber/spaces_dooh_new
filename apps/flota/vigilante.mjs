// ============================================================================
//  vigilante.mjs — avisa cuando una instancia deja de responder.  (ADR 0026)
// ----------------------------------------------------------------------------
//  Lo corre el cron del PADRE. Recorre la flota, la compara con lo que vio la
//  vez anterior, y avisa POR CAMBIO DE ESTADO.
//
//  Por qué por cambio y no por pasada: una instancia caída generaría un correo
//  cada vez que corre el cron, y a la tercera nadie los lee.
//
//  Por qué fuera del panel: se decidió el 2026-09-04. Una instancia se puede
//  caer un viernes por la noche, y si el aviso colgara de la vista nadie se
//  enteraría hasta que alguien abriera la página el lunes.
//
//  Sin dependencias: el correo se manda con `fetch`, igual que hace
//  `apps/web/lib/server/email.ts`.
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const CAIDA = 'caida'
export const RECUPERADA = 'recuperada'

/** El único estado que cuenta como «no responde». */
const SIN_RESPUESTA = 'sin-respuesta'

/**
 * Qué avisos toca mandar, comparando lo de antes con lo de ahora.
 *
 * `previo` es `{ nombre: estado }`; `filas` es lo que devuelve `resumen()`.
 *
 * Decisiones que hay dentro, y las tres importan:
 *
 *  · `rezagada` NO es una caída. Es una instancia que contesta y corre una
 *    versión anterior; eso no despierta a nadie de madrugada.
 *  · En la PRIMERA pasada (sin estado previo) una instancia caída SÍ avisa. Un
 *    vigilante que se calla porque «es la primera vez» es peor que uno que
 *    manda un correo de más, y solo pasa una vez.
 *  · Una instancia que desaparece del inventario no avisa: se dio de baja a
 *    propósito, no se cayó.
 */
export function decidirAvisos(previo, filas) {
  const avisos = []
  for (const fila of filas) {
    const ahora = fila.estado
    const antes = previo?.[fila.nombre]
    const caidaAhora = ahora === SIN_RESPUESTA
    // Sin dato previo se asume que respondía: así la primera pasada avisa de lo
    // que ya está mal en vez de tragárselo.
    const caidaAntes = antes === SIN_RESPUESTA

    if (caidaAhora && !caidaAntes) avisos.push({ nombre: fila.nombre, dominio: fila.dominio, tipo: CAIDA })
    else if (!caidaAhora && caidaAntes) avisos.push({ nombre: fila.nombre, dominio: fila.dominio, tipo: RECUPERADA })
  }
  return avisos
}

/** El estado que se guarda para la próxima pasada: solo `nombre → estado`. */
export function estadoDe(filas) {
  return Object.fromEntries(filas.map((f) => [f.nombre, f.estado]))
}

/** Asunto y texto. Todos los cambios de una pasada van en UN correo. */
export function redactar(avisos) {
  const caidas = avisos.filter((a) => a.tipo === CAIDA)
  const vueltas = avisos.filter((a) => a.tipo === RECUPERADA)

  const asunto =
    caidas.length && vueltas.length
      ? `Flota: ${caidas.length} no responde(n), ${vueltas.length} recuperada(s)`
      : caidas.length
        ? caidas.length === 1
          ? `Flota: ${caidas[0].nombre} no responde`
          : `Flota: ${caidas.length} instancias no responden`
        : vueltas.length === 1
          ? `Flota: ${vueltas[0].nombre} volvio`
          : `Flota: ${vueltas.length} instancias recuperadas`

  const linea = (a) =>
    `  · ${a.nombre} (${a.dominio}) — ${a.tipo === CAIDA ? 'NO RESPONDE' : 'vuelve a responder'}`

  const texto = [
    caidas.length ? 'Dejaron de responder:' : null,
    ...caidas.map(linea),
    vueltas.length ? 'Volvieron:' : null,
    ...vueltas.map(linea),
    '',
    'Esto lo manda el vigilante de la flota del PADRE, por CAMBIO de estado.',
    'Mientras siga caida no se repite el aviso: se manda otro cuando vuelva.',
  ]
    .filter((l) => l !== null)
    .join('\n')

  return { asunto, texto }
}

/**
 * La configuración es obligatoria y se comprueba ANTES de consultar nada.
 *
 * Nada de valores por omisión: un vigilante que arranca a medias no avisa, y no
 * avisar no da error — parece que todo va bien. Es el mismo criterio que
 * `CERTBOT_EMAIL` en el alta.
 */
export function exigirConfig(entorno = process.env) {
  const faltan = ['AVISOS_PARA', 'RESEND_API_KEY', 'EMAIL_FROM'].filter((k) => !entorno[k])
  if (faltan.length) {
    throw new Error(
      `vigilante: falta ${faltan.join(', ')} en el entorno. ` +
        'AVISOS_PARA es la direccion que recibe los avisos; las otras dos, la cuenta que los manda.',
    )
  }
  return { para: entorno.AVISOS_PARA, clave: entorno.RESEND_API_KEY, desde: entorno.EMAIL_FROM }
}

/** El envío, con `fetch` y sin dependencia. */
export async function enviarPorResend({ para, desde, clave, asunto, texto }, pedir = globalThis.fetch) {
  const r = await pedir('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: desde, to: [para], subject: asunto, text: texto }),
  })
  if (!r.ok) throw new Error(`Resend respondio ${r.status}`)
}

export async function leerPrevioDe(archivo) {
  try {
    return JSON.parse(await readFile(archivo, 'utf8'))
  } catch {
    // No existir es lo normal la primera vez. Cualquier otro problema tambien
    // acaba aqui, y el efecto es el mismo: se trata como primera pasada.
    return {}
  }
}

export async function guardarEn(archivo, estado) {
  await mkdir(dirname(archivo), { recursive: true })
  await writeFile(archivo, JSON.stringify(estado, null, 2) + '\n', 'utf8')
}

/**
 * Una pasada completa.
 *
 * **Si el correo no sale, el estado NO avanza.** Es lo que separa un vigilante
 * de un adorno: si se guardara igualmente, en la pasada siguiente ya no habría
 * cambio que detectar y el aviso se perdería PARA SIEMPRE, con la instancia
 * todavía caída. Falla ruidoso y lo reintenta la próxima vez.
 */
export async function vigilar(deps) {
  const { config, obtenerFilas, leerPrevio, guardar, enviar } = deps

  let cfg
  try {
    cfg = exigirConfig(config)
  } catch (e) {
    return { ok: false, motivo: e.message, avisos: [] }
  }

  const filas = await obtenerFilas()
  const previo = await leerPrevio()
  const avisos = decidirAvisos(previo, filas)

  if (avisos.length) {
    const { asunto, texto } = redactar(avisos)
    try {
      await enviar({ ...cfg, asunto, texto })
    } catch (e) {
      return { ok: false, motivo: `no se pudo avisar: ${e.message}`, avisos }
    }
  }

  await guardar(estadoDe(filas))
  return { ok: true, avisos }
}
