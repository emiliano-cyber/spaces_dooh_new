// ============================================================================
//  ejecutor.mjs — el que sí tiene las llaves.  (ADR 0027)
// ----------------------------------------------------------------------------
//  Corre como el usuario `altas`, NO escucha en ningún puerto, y es el único
//  proceso del PADRE con el token de DigitalOcean y el de Cloudflare. Lo
//  despierta un temporizador; lee la solicitud que dejó el panel y aprovisiona.
//
//  Tres cosas que están aquí por lo que costarían, no por gusto:
//
//   1. Se VALIDA otra vez. El panel no tiene credenciales, así que lo único que
//      puede hacer comprometido es escribir una solicitud: es la entrada no
//      confiable, y quien la ejecuta no puede fiarse de quién la escribió.
//   2. Se marca EN CURSO **antes** de lanzar. Si se marcara después y el proceso
//      muriera a mitad, la pasada siguiente vería PENDIENTE y crearía un SEGUNDO
//      droplet — con el primero ya creado y cobrándose. Un alta interrumpida se
//      queda parada esperando a una persona, que es lo correcto.
//   3. NO hay reintento automático. Reintentar un alta a medias es la forma de
//      duplicar máquinas sin enterarse.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

import { argumentosDeAlta, validarSolicitud } from './solicitudes.mjs'

export const PENDIENTE = 'pendiente'
export const EN_CURSO = 'en-curso'
export const TERMINADA = 'terminada'
export const FALLIDA = 'fallida'

/** Aprovisionada, pero el certificado espera a que el DNS resuelva (ADR 0027). */
export const ESPERANDO_DNS = 'esperando-dns'

/** El guion de siempre. Esto es una capa ENCIMA, no un sustituto. */
export const GUION = '/var/www/Spaces/infra/scripts/provision-instancia.sh'

/**
 * Ejecuta UNA solicitud.
 *
 * `deps`: `{ entorno, lanzar, marcar, anotar }` — entran por parámetro para
 * poder probar esto sin crear una máquina ni gastar un céntimo.
 */
export async function ejecutarAlta(solicitud, deps) {
  const { entorno = {}, lanzar, marcar, anotar = () => {} } = deps
  const id = solicitud?.id

  // Solo se toma lo que está pendiente. Lo demás ya lo tocó alguien, y volver a
  // tocarlo es exactamente lo que no puede pasar.
  if (solicitud?.estado !== PENDIENTE) {
    anotar(`solicitud ${id}: estado "${solicitud?.estado}", no se toca`)
    return { ok: false, motivo: 'no esta pendiente' }
  }

  const v = validarSolicitud(solicitud)
  if (!v.ok) {
    // Se anota el motivo para que se pueda arreglar, y se marca FALLIDA: una
    // solicitud invalida no se queda dando vueltas en la cola.
    anotar(`solicitud ${id}: INVALIDA — ${v.errores.join('; ')}`)
    await marcar(id, FALLIDA, { errores: v.errores })
    return { ok: false, motivo: v.errores.join('; ') }
  }

  // ── ANTES de lanzar. Ver el punto 2 de la cabecera. ───────────────────────
  await marcar(id, EN_CURSO, { desde: new Date().toISOString() })
  anotar(`solicitud ${id}: alta de "${solicitud.instancia}" en ${solicitud.dominio}`)

  const { argumentos, entorno: entornoAlta } = argumentosDeAlta(solicitud, entorno)

  let codigo
  try {
    const r = await lanzar({
      guion: GUION,
      argumentos,
      entorno: entornoAlta,
      // Explícito y comprobado por una prueba: JAMÁS por un shell. Con lista de
      // argumentos un valor raro es un valor raro; en una cadena, es un comando
      // — y correría en el PADRE, la máquina con los tokens de toda la flota.
      shell: false,
      onLinea: (linea) => anotar(linea),
    })
    codigo = r?.codigo
  } catch (e) {
    // Ni siquiera arrancó. FALLIDA igual: lo que no puede quedar es PENDIENTE.
    anotar(`solicitud ${id}: no se pudo lanzar el alta — ${e.message}`)
    await marcar(id, FALLIDA, { error: e.message })
    return { ok: false, motivo: e.message }
  }

  if (codigo !== 0) {
    anotar(`solicitud ${id}: el alta termino con codigo ${codigo}`)
    await marcar(id, FALLIDA, { codigo })
    return { ok: false, motivo: `codigo ${codigo}` }
  }

  anotar(`solicitud ${id}: alta terminada`)
  await marcar(id, TERMINADA, { hasta: new Date().toISOString() })
  return { ok: true }
}
