// ============================================================================
//  licencia.mjs — el PADRE firma; cualquiera puede verificar.
// ----------------------------------------------------------------------------
//  Ed25519, que es lo que `openssl pkeyutl -verify -rawin` sabe comprobar en el
//  droplet sin instalar nada. Esa restriccion es la que eligio el algoritmo: la
//  otra punta de esto es bash.
//
//  ─── Esto NO viaja en la imagen, y no es casualidad ───────────────────────
//  Vive en `apps/flota` porque el `Dockerfile` construye con `--filter=web`.
//  Firmar licencias es del PADRE; si este archivo acabara en el droplet de un
//  cliente, la mitad del mecanismo estaria en la maquina de quien tiene interes
//  en saltarselo. La llave privada nunca sale del PADRE de todos modos, pero la
//  frontera se pone donde se puede comprobar.
//
//  ─── Los bytes firmados son EXACTAMENTE los del archivo ───────────────────
//  No se firma un objeto: se firma la cadena que se escribe en disco. Firmar una
//  representacion y guardar otra es como se rompen estas cosas en silencio -- un
//  reordenamiento de claves o un espacio de mas y la firma deja de validar sin
//  que nadie haya tocado nada.
// ============================================================================

import { sign, verify } from 'node:crypto'

/** Un nombre de instancia es un identificador, no texto libre. El mismo que usa
 *  el receptor de reportes (`reporte.mjs`), porque nombran la misma cosa. */
export const NOMBRE_VALIDO_INSTANCIA = /^[a-z0-9][a-z0-9-]{0,39}$/

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

function exigirFecha(nombre, valor) {
  if (typeof valor !== 'string' || !FECHA_VALIDA.test(valor)) {
    throw new Error(`\`${nombre}\` no es una fecha YYYY-MM-DD: ${String(valor)}`)
  }
  const t = Date.parse(`${valor}T00:00:00Z`)
  if (Number.isNaN(t)) {
    throw new Error(`\`${nombre}\` tiene forma de fecha pero no existe: ${valor}`)
  }
  // La ida y vuelta, y no basta con que `Date.parse` no diga NaN: JavaScript
  // DESBORDA las fechas imposibles en vez de rechazarlas -- `2027-02-30` se
  // convierte en `2027-03-02` sin protestar. Sin esta comprobacion, un dedazo
  // al teclear el vencimiento se firma tal cual, y la instancia del cliente lo
  // lee con `date -u -d`, que SI lo rechaza: se apagaria una instancia al
  // corriente de pago. La divergencia entre las dos implementaciones se corta
  // aqui, en el unico sitio que fabrica licencias.
  if (new Date(t).toISOString().slice(0, 10) !== valor) {
    throw new Error(`\`${nombre}\` no existe en el calendario: ${valor}`)
  }
}

function exigirDias(nombre, valor) {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`\`${nombre}\` no es un numero entero de dias: ${String(valor)}`)
  }
}

/**
 * El JSON exacto que se firma y se escribe. El orden de las claves es fijo y la
 * indentacion tambien: son los bytes que cubre la firma.
 */
export function construirLicencia({ instancia, dominio, vence, avisoDias, graciaDias, emitida }) {
  if (typeof instancia !== 'string' || !NOMBRE_VALIDO_INSTANCIA.test(instancia)) {
    throw new Error(`\`instancia\` no es un nombre valido (minusculas, digitos y guiones): ${String(instancia)}`)
  }
  if (typeof dominio !== 'string' || !dominio.includes('.') || /\s/.test(dominio)) {
    throw new Error(`\`dominio\` no parece un dominio: ${String(dominio)}`)
  }
  exigirFecha('emitida', emitida)
  exigirFecha('vence', vence)
  exigirDias('aviso_dias', avisoDias)
  exigirDias('gracia_dias', graciaDias)

  const cuerpo = {
    instancia,
    dominio,
    emitida,
    vence,
    aviso_dias: avisoDias,
    gracia_dias: graciaDias,
  }
  // El salto final es a proposito: un archivo de texto sin el ultimo salto es
  // el que rompe `cat`, los editores y los diffs.
  return JSON.stringify(cuerpo, null, 2) + '\n'
}

/** Ed25519 no lleva funcion de resumen aparte: por eso el algoritmo va en `null`. */
export function firmar(json, llavePrivada) {
  return sign(null, Buffer.from(json, 'utf8'), llavePrivada)
}

/** Nunca lanza: una firma corrupta es un `false`, no una excepcion que alguien
 *  pueda dejarse sin capturar en la ruta que decide si una instancia arranca. */
export function verificar(json, firma, llavePublica) {
  try {
    return verify(null, Buffer.from(json, 'utf8'), llavePublica, firma)
  } catch {
    return false
  }
}
