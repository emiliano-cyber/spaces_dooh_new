// ============================================================================
//  avanzar.mjs — la maquina de estados del alta.  (A2.2 y A2.3, ADR 0029)
// ----------------------------------------------------------------------------
//  Cada llamada es UNA pasada del temporizador, que despierta cada minuto. La
//  funcion no espera nada, no reintenta en bucle y no duerme: mira en que
//  estado esta la solicitud, hace como mucho un paso, y vuelve.
//
//  POR QUE ASI, y no un proceso que espere:
//
//  Un alta puede quedarse DIAS esperando a que el owner apunte su zona. Un
//  proceso que espera horas a un DNS ajeno es un proceso colgado, y la unidad lo
//  mata: `flota-altas.service` lleva `TimeoutStartSec=1800`. Y colgado no da
//  error, que es como se perdio una hora el 2026-09-03 con `needrestart`. El
//  estado en disco es lo que permite esperar sin nada corriendo.
//
//  Todo entra por parametro —el resolutor, el emisor del certificado, el reloj—
//  para poder probar la maquina entera sin DNS, sin certbot y sin esperar una
//  hora de reloj.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

import { ESPERANDO_DNS, EMITIENDO_CERT, LISTA, CERT_AGOTADO } from './ejecutor.mjs'

/**
 * Cuantos certificados se intentan por hora y por dominio.
 *
 * **Tres, y el limite real de Let's Encrypt son cinco.** Los dos de margen no
 * sobran: son los que permiten que una persona lo intente a mano cuando el
 * automatico se rinde. Un automatico que agota la cuota deja a la persona sin
 * poder hacer nada durante una hora, y eso es peor que no automatizarlo.
 */
export const MAX_INTENTOS_CERT = 3

/** La ventana de esa cuota. */
export const VENTANA_CERT_MS = 60 * 60 * 1000

/** Nada que hacer en esta pasada. */
const QUIETO = (motivo) => ({ hecho: false, motivo })

/**
 * Espera a que el DNS apunte a la maquina que acabamos de crear.
 *
 * **Si no resuelve NO SE ESCRIBE NADA**, y es la decision mas importante de este
 * archivo: es el caso mas frecuente con diferencia, y una escritura por minuto
 * durante los dias que tarda un owner llenaria el registro de ruido y taparia
 * lo unico que hay que leer.
 */
async function avanzarDns(solicitud, { resolver, marcar, anotar }) {
  const { dominio, ip } = solicitud
  if (!ip) return QUIETO('sin ip anotada: no se inventa a donde apuntar')

  let direcciones = []
  try {
    direcciones = (await resolver(dominio)) ?? []
  } catch {
    // Un DNS caido, o un nombre que aun no existe, no es un alta fallida.
    return QUIETO('el dominio todavia no resuelve')
  }
  if (direcciones.length === 0) return QUIETO('el dominio todavia no resuelve')

  if (direcciones.includes(ip)) {
    await marcar(EMITIENDO_CERT, { intentos: 0 })
    return { hecho: true, estado: EMITIENDO_CERT }
  }

  // Resuelve, pero a otro sitio. Esto NO se arregla solo: alguien apunto mal, o
  // el nombre es de otra maquina. Y es justo lo que hay que cazar antes de pedir
  // un certificado, porque pedirlo aqui seria pedirlo sobre la maquina de otro.
  //
  // Se anota UNA vez por direccion distinta, no una por minuto: la marca queda
  // en la solicitud y la siguiente pasada la ve.
  const vista = direcciones[0]
  if (solicitud.dnsOtraIp !== vista) {
    await anotar(`el DNS de ${dominio} resuelve a ${vista}, no a ${ip}: no se pide el certificado`)
    await marcar(ESPERANDO_DNS, { dnsOtraIp: vista })
  }
  return QUIETO('el dominio resuelve a otra direccion')
}

/**
 * Pide el certificado, contando los intentos **dentro del estado**.
 *
 * El contador vive en la solicitud y no en memoria porque cada pasada es un
 * proceso nuevo: un limite que se pierde al reiniciar no es un limite.
 */
async function avanzarCert(solicitud, { emitirCert, marcar, anotar, ahora }) {
  const t = ahora()
  let intentos = Number(solicitud.intentos) || 0
  let desde = Number(solicitud.intentosDesde) || t

  // Ventana cumplida: se empieza a contar de nuevo.
  if (t - desde > VENTANA_CERT_MS) {
    intentos = 0
    desde = t
  }

  if (intentos >= MAX_INTENTOS_CERT) {
    await anotar(
      `certificado: ${intentos} intentos en la ultima hora y ninguno salio. Se para aqui ` +
        `para no agotar la cuota de Let's Encrypt (cinco por hora). Lo tiene que mirar una persona.`,
    )
    await marcar(CERT_AGOTADO, { intentos, intentosDesde: desde })
    return QUIETO('cuota de certificados agotada')
  }

  // Se cuenta ANTES de llamar. Misma disciplina que marcar `en-curso` antes de
  // lanzar el alta: si el proceso muere a mitad, el intento ya esta contado y no
  // se repite para siempre.
  await marcar(EMITIENDO_CERT, { intentos: intentos + 1, intentosDesde: desde })

  let ok = false
  try {
    ok = await emitirCert(solicitud.dominio)
  } catch {
    ok = false
  }

  if (!ok) return QUIETO('el certificado no se pudo emitir en este intento')

  await marcar(LISTA, { hasta: new Date(t).toISOString() })
  return { hecho: true, estado: LISTA }
}

/**
 * Da como mucho UN paso a la solicitud.
 *
 * Devuelve `{ hecho, motivo? , estado? }`. `hecho:false` no es un fallo: la
 * mayoria de las pasadas no tienen nada que hacer, y eso es lo normal.
 *
 * Un estado que no sea reanudable **no se toca**. La lista de los que si lo son
 * vive en `cola.mjs` (`REANUDABLES`) y es una lista blanca a proposito.
 */
export async function avanzar(solicitud, opciones = {}) {
  const {
    resolver,
    emitirCert,
    marcar = async () => {},
    anotar = async () => {},
    ahora = () => Date.now(),
  } = opciones

  switch (solicitud?.estado) {
    case ESPERANDO_DNS:
      return avanzarDns(solicitud, { resolver, marcar, anotar })
    case EMITIENDO_CERT:
      return avanzarCert(solicitud, { emitirCert, marcar, anotar, ahora })
    default:
      return QUIETO(`el estado "${solicitud?.estado}" no se avanza solo`)
  }
}
