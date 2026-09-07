// ============================================================================
//  altas.mjs — una pasada del ejecutor de altas.  (ADR 0027)
// ----------------------------------------------------------------------------
//  Lo despierta el temporizador. Corre como el usuario `altas` y es el ÚNICO
//  proceso del PADRE con el token de DigitalOcean y el de Cloudflare. No escucha
//  en ningún puerto.
//
//  Alcance de esta pasada: **aprovisionar y, si el dominio es nuestro, poner el
//  registro A**. Ahí se para, igual que el guion manual: el certificado y la
//  primera organización siguen siendo pasos aparte, porque dependen de que el
//  DNS haya propagado y eso no se sabe en el mismo minuto.
//
//  Toda la decisión vive en `cola.mjs`, `ejecutor.mjs` y `dns.mjs`, que se
//  prueban sin crear una máquina. Aquí solo se conectan las piezas de verdad.
// ============================================================================

import { spawn } from 'node:child_process'
import { siguientePendiente, marcar, anotarEn, esperarEscrituras } from './cola.mjs'
import { ejecutarAlta, ESPERANDO_DNS } from './ejecutor.mjs'
import { crearRegistroA, esDeNuestraZona } from './dns.mjs'
import { comprobar, veredicto } from './comprobaciones.mjs'

const DIR = process.env.DIR_SOLICITUDES
if (!DIR) {
  console.error('altas: falta DIR_SOLICITUDES en el entorno.')
  process.exit(2)
}

/** `{"space-os.io": "id-de-zona"}`. Sin esto, ningún dominio es nuestro. */
function zonasDeEntorno() {
  try {
    return JSON.parse(process.env.CLOUDFLARE_ZONAS ?? '{}')
  } catch {
    console.error('altas: CLOUDFLARE_ZONAS no es un JSON valido; se trata como vacio.')
    return {}
  }
}

/**
 * Lanza el guion SIN shell y va pasando sus líneas al registro de la solicitud.
 *
 * `spawn` con lista de argumentos: un valor raro es un valor raro y no un
 * comando. Es la razón de que la solicitud pueda venir de una página web.
 */
function lanzarGuion({ guion, argumentos, entorno, onLinea }) {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(guion, argumentos, {
      // El entorno se construye a mano: solo lo que el alta necesita. Así un
      // secreto del ejecutor que no venga al caso no viaja al guion.
      env: { ...process.env, ...entorno },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let resto = ''
    const trocear = (trozo) => {
      resto += trozo
      const lineas = resto.split('\n')
      resto = lineas.pop() ?? ''
      for (const l of lineas) if (l.trim()) onLinea(l.trimEnd())
    }
    hijo.stdout.on('data', trocear)
    hijo.stderr.on('data', trocear)
    hijo.on('error', rechazar)
    hijo.on('close', (codigo) => {
      if (resto.trim()) onLinea(resto.trimEnd())
      resolver({ codigo })
    })
  })
}

/** La IP que imprime el guion: `  droplet creado: 1.2.3.4`. */
function ipDelRegistro(lineas) {
  for (const l of lineas) {
    const m = /droplet creado:\s*((?:\d{1,3}\.){3}\d{1,3})/.exec(l)
    if (m) return m[1]
  }
  return null
}

const solicitud = await siguientePendiente(DIR)
if (!solicitud) {
  // Ni una pendiente, o hay una en curso. Las dos son «no hay nada que hacer».
  process.exit(0)
}

const lineas = []
const anotar = async (linea) => {
  lineas.push(linea)
  try {
    await anotarEn(DIR, solicitud.id, linea)
  } catch {
    /* que el registro falle no puede tumbar un alta a medias */
  }
}

const r = await ejecutarAlta(solicitud, {
  entorno: process.env,
  lanzar: lanzarGuion,
  marcar: (id, estado, extra) => marcar(DIR, id, estado, extra),
  anotar,
})

if (!r.ok) {
  // `process.exit()` corta lo que esté a medio escribir, y `anotar()` no se
  // espera a propósito. Sin este drenaje se pierde la última línea del
  // registro — que en un alta fallida es la que dice POR QUÉ falló. Pasó el
  // 2026-09-07: el guion avisó de que le faltaba `doctl` y ese aviso no llegó
  // a la solicitud, así que el panel solo enseñaba «Creando el droplet».
  await esperarEscrituras()
  console.log(JSON.stringify({ evento: 'altas', id: solicitud.id, ok: false, motivo: r.motivo }))
  process.exit(1)
}

// ─── El DNS, solo si la zona es nuestra ─────────────────────────────────────
const zonas = zonasDeEntorno()
const ip = ipDelRegistro(lineas)

if (!esDeNuestraZona(solicitud.dominio, zonas)) {
  await anotar(`el dominio ${solicitud.dominio} no es de una zona nuestra: lo apunta el owner`)
  await marcar(DIR, solicitud.id, ESPERANDO_DNS, { ip })
} else if (!ip) {
  // El guion cambió de mensaje, o no llegó a crear el droplet. No se inventa
  // una IP: se para y que lo mire una persona.
  await anotar('no se pudo leer la IP del registro del alta; el DNS queda a mano')
  await marcar(DIR, solicitud.id, ESPERANDO_DNS, { ip: null })
} else {
  try {
    await crearRegistroA(solicitud.dominio, ip, {
      zonas,
      token: process.env.CLOUDFLARE_TOKEN ?? '',
    })
    await anotar(`registro A creado: ${solicitud.dominio} → ${ip} (sin proxy)`)
    await marcar(DIR, solicitud.id, ESPERANDO_DNS, { ip, dns: 'creado' })
  } catch (e) {
    await anotar(`el registro A no se pudo crear: ${e.message}`)
    await marcar(DIR, solicitud.id, ESPERANDO_DNS, { ip, dns: 'fallido' })
  }
}

// ─── Las tres comprobaciones, y quedan DENTRO de la solicitud ───────────────
//
// Sobre `http://` y no `https://`: aquí todavía no hay certificado, así que
// pedirlas por https daría un fallo de red y no diría nada de la aplicación.
// Ver la cabecera de `comprobaciones.mjs`.
//
// Y si el dominio es del owner y aún no lo ha apuntado, los tres saldrán `0`.
// **Eso no es un fallo del alta**: es la foto de este momento, y por eso se
// guarda con su hora. Cuando el DNS resuelva, se vuelven a tomar.
//
// Se marca otra vez el MISMO estado a propósito: el historial acumula, y así
// queda con hora cuándo se comprobó, que es lo que hace auditable un alta de
// hace tres semanas.
const codigos = await comprobar(`http://${solicitud.dominio}`)
const v = veredicto(codigos)
await anotar(
  v.ok
    ? 'comprobaciones: login 200 · signup 503 · login-post 401, las tres como debe'
    : `comprobaciones: REVISAR ${v.raras.join(', ')} -> ${JSON.stringify(codigos)}`,
)
await marcar(DIR, solicitud.id, ESPERANDO_DNS, { ip, comprobaciones: codigos, comprobacionesOk: v.ok })
await esperarEscrituras()

console.log(JSON.stringify({ evento: 'altas', id: solicitud.id, ok: true, ip, comprobaciones: codigos }))
