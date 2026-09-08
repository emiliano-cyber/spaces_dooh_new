// ============================================================================
//  altas.mjs — una pasada del ejecutor de altas.  (ADR 0027)
// ----------------------------------------------------------------------------
//  Lo despierta el temporizador. Corre como el usuario `altas` y es el ÚNICO
//  proceso del PADRE con el token de DigitalOcean y el de Cloudflare. No escucha
//  en ningún puerto.
//
//  Una pasada hace **como mucho una cosa**, y en este orden:
//
//   1. Si hay una solicitud PENDIENTE, la aprovisiona entera y —si el dominio es
//      de una zona nuestra— pone su registro A.
//   2. Si no, mira si hay alguna A MEDIAS y le da un paso: comprobar el DNS, o
//      pedir el certificado. (ADR 0029.)
//
//  El paso 2 nació el 2026-09-07. Hasta ese día `esperando-dns` era un estado
//  TERMINAL: el temporizador ya despertaba cada minuto y el estado ya existía,
//  pero `siguientePendiente()` devolvía solo las `pendiente`, así que una
//  solicitud que llegaba ahí no la volvía a mirar nadie jamás.
//
//  **Lo que NO hace, y no es un olvido:** crear la primera organización. Eso
//  produce la contraseña del Dueño, y esa contraseña tiene que llegarle a él —
//  ver §5 del ADR 0029. Con el ADR 0028 construido el paso desaparece, porque el
//  Dueño entra con Google y no hay contraseña que entregar.
//
//  Toda la decisión vive en `cola.mjs`, `ejecutor.mjs`, `dns.mjs` y
//  `avanzar.mjs`, que se prueban sin crear una máquina, sin DNS y sin certbot.
//  Aquí solo se conectan las piezas de verdad.
// ============================================================================

import { spawn } from 'node:child_process'
import { siguientePendiente, siguienteQueAvanza, marcar, anotarEn, esperarEscrituras } from './cola.mjs'
import { ejecutarAlta, ESPERANDO_DNS, PENDIENTE, GUION } from './ejecutor.mjs'
import { crearRegistroA, esDeNuestraZona, zonaQueLoContiene } from './dns.mjs'
import { comprobar, veredicto } from './comprobaciones.mjs'
import { avanzar } from './avanzar.mjs'
import { inscribir } from './inscribir.mjs'
import { resolve4, resolveSoa } from 'node:dns/promises'

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
  // No hay ninguna que EMPEZAR. Pero puede haber alguna a medio camino —
  // esperando el DNS del owner, o con el certificado a medias— y hasta el
  // 2026-09-07 esas no las retomaba nadie jamas: `esperando-dns` era terminal.
  // (ADR 0029, A2.1.)
  const aMedias = await siguienteQueAvanza(DIR)
  if (!aMedias) {
    // Ahora si: ni una pendiente, ni una que avanzar, o hay una en curso.
    process.exit(0)
  }

  const anotarEnEsa = async (linea) => {
    try {
      await anotarEn(DIR, aMedias.id, linea)
    } catch {
      /* que el registro falle no puede tumbar un alta a medias */
    }
  }

  const paso = await avanzar(aMedias, {
    // El resolutor de verdad. Se le pregunta al DNS publico, que es lo que va a
    // usar Let's Encrypt: comprobarlo contra otra cosa no comprobaria nada.
    resolver: (dominio) => resolve4(dominio),
    // Y el certificado lo emite el guion de siempre, en su modo suelto. Esto es
    // una capa ENCIMA de `provision-instancia.sh`, no un sustituto: el mismo
    // comando que correria una persona.
    emitirCert: async (dominio) => {
      await anotarEnEsa(`pidiendo el certificado de ${dominio}`)
      const { codigo } = await lanzarGuion({
        guion: GUION,
        argumentos: ['--host', String(aMedias.ip), '--dominio', String(dominio), '--emitir-certificado', '--confirmar'],
        entorno: process.env,
        onLinea: (l) => anotarEnEsa(l),
      })
      // El CODIGO viaja, no solo el si/no: `avanzar.mjs` distingue «me falta
      // configuracion» (EX_USO, y no llego a certbot) de «Let's Encrypt dijo
      // no», y solo el segundo gasta cuota y cuenta como intento.
      return { ok: codigo === 0, codigo }
    },
    marcar: (estado, extra) => marcar(DIR, aMedias.id, estado, extra),
    anotar: anotarEnEsa,
  })

  await esperarEscrituras()
  console.log(
    JSON.stringify({ evento: 'altas', id: aMedias.id, avance: paso.hecho, estado: paso.estado ?? aMedias.estado, motivo: paso.motivo }),
  )
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

// ─── Antes de gastar una maquina: ¿puede existir ese nombre?  (defecto 39) ──
//
//  El 2026-09-08 se dio de alta `g500-space-os.com`, que NO esta registrado. El
//  alta creo el droplet, lo configuro entero, y se quedo en `esperando-dns` —
//  correctamente, porque nadie puede inventarse una delegacion. Pero para
//  siempre, y con la maquina cobrandose.
//
//  `validarSolicitud()` comprueba la FORMA del dominio, y la forma era
//  impecable. Esto comprueba que exista una zona por encima, que es lo unico que
//  distingue «el owner todavia no lo ha apuntado» —normal, y se espera— de «no
//  puede apuntarlo nunca».
//
//  Se queda en `pendiente`, NO en `fallida`: `fallida` es terminal y obligaria a
//  pedir el alta otra vez, cuando lo que falta puede aparecer en diez minutos —
//  el dominio se registra y ya esta. Asi se reintenta sola.
//
//  Y se anota UNA vez por dominio, no una por minuto: mismo patron que
//  `dnsOtraIp` en `avanzar.mjs`, y por la misma razon.
const zonaArriba = await zonaQueLoContiene(solicitud.dominio, (n) => resolveSoa(n))
if (!zonaArriba) {
  if (solicitud.sinZona !== solicitud.dominio) {
    await anotar(
      `NO se crea la maquina todavia: ningun servidor DNS reconoce una zona para ` +
        `${solicitud.dominio}. O el dominio no esta registrado, o sus nameservers no ` +
        `estan puestos en el registrador. Registralo y apuntalo; esto se reintenta solo.`,
    )
    await marcar(DIR, solicitud.id, PENDIENTE, { sinZona: solicitud.dominio })
  }
  await esperarEscrituras()
  console.log(
    JSON.stringify({
      evento: 'altas',
      id: solicitud.id,
      ok: false,
      motivo: 'sin zona dns: no se crea la maquina',
    }),
  )
  process.exit(0)
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

// ─── Inscribir la instancia, para que el panel la vea ──────────────────────
//
// Hasta el 2026-09-07 esto no lo hacia nadie: el ejecutor creaba la maquina y
// la instancia quedaba INVISIBLE en el panel hasta que una persona anadiera su
// fila y su token a mano. El dia que se olvidara, quedaba funcionando y sin que
// nadie supiera si esta al dia -- justo lo que el panel existe para evitar.
//
// El token lo escribio el aprovisionamiento dentro de la maquina
// (`provision-instancia.sh:597`), asi que se lee de ahi.
//
// Y si esto falla NO se aborta: la maquina ya existe y esta servida. Quedar
// fuera del panel se arregla en un minuto; tumbar un alta buena por un archivo
// del panel seria cambiar un problema pequeno por uno grande.
if (ip) {
  const tokenFlota = (
    await new Promise((res) => {
      const trozos = []
      const hijo = spawn('ssh', ['-o', 'StrictHostKeyChecking=accept-new', `root@${ip}`,
        "sed -n 's/^FLOTA_TOKEN=//p' /etc/space-os/app.env"], { shell: false, stdio: ['ignore', 'pipe', 'ignore'] })
      hijo.stdout.on('data', (d) => trozos.push(d))
      hijo.on('error', () => res(''))
      hijo.on('close', () => res(Buffer.concat(trozos).toString('utf8').trim()))
    })
  )
  const inscrita = await inscribir({ nombre: solicitud.instancia, dominio: solicitud.dominio, token: tokenFlota })
  await anotar(
    inscrita.ok
      ? 'inscrita en el panel de flota'
      : `no se pudo inscribir en el panel: ${inscrita.motivo}. La instancia esta bien; hay que anadirla a mano`,
  )
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
