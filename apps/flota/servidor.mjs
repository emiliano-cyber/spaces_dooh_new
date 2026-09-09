// ============================================================================
//  servidor.mjs — el panel de flota, con pantalla.  (ADR 0026)
// ----------------------------------------------------------------------------
//  Escucha en 127.0.0.1 y lo publica nginx en `space-os.io/flota/`. NO escucha
//  en la interfaz pública: solo nginx llega hasta aquí.
//
//  `manejar()` decide la petición entera y devuelve `{status, cabeceras,
//  cuerpo}` en vez de escribir en el socket. El servidor de abajo solo traduce
//  eso a HTTP. Así la parte que decide quién ve la lista de clientes se prueba
//  sin levantar nada ni abrir un puerto.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { verificarAcceso } from './acceso.mjs'
import { validarSolicitud, CAMPOS, dominioDeAlta, zonaPorOmision } from './solicitudes.mjs'
import { crearSolicitud as crearEnCola, listar as listarCola } from './cola.mjs'
import { cargarInventario, consultar, leerReportes, fusionar, resumen, tokenDe, tokensDeArchivo, COLUMNAS } from './estado.mjs'

/**
 * Las zonas que gestionamos, para SUGERIR un dominio cuando se deja en blanco.
 *
 * El panel corre como `flota` y no tiene el entorno del ejecutor, así que puede
 * no conocerlas: **sin la variable, todo se comporta como antes** y el dominio
 * pasa a ser obligatorio de hecho, porque `validarSolicitud()` lo exige.
 *
 * Y si el valor divergiera del que tiene el ejecutor, la única consecuencia es
 * una sugerencia equivocada en el formulario — **nunca una acción equivocada**:
 * quien decide si el registro A se crea es el ejecutor con SU copia
 * (`esDeNuestraZona`), y quien decide si la máquina se crea es el guard de la
 * zona DNS (`altas.mjs`). Por eso esta lectura puede permitirse ser la segunda
 * copia, y es la única del proyecto que puede.
 */
function zonasDelEntorno() {
  try {
    return JSON.parse(process.env.CLOUDFLARE_ZONAS ?? '{}')
  } catch {
    return {}
  }
}

/** nginx puede pasar el prefijo o recortarlo según lleve barra el `proxy_pass`. */
export const RUTAS = ['/flota/', '/flota', '/']

/** La pantalla de altas (ADR 0027), con las mismas variantes de prefijo. */
export const RUTAS_ALTAS = ['/flota/altas/', '/flota/altas', '/altas/', '/altas']

/**
 * El panel pone SU PROPIA cookie CSRF.
 *
 * Antes leia `spaces_csrf`, la de la aplicacion. Eso era una dependencia que no
 * debia existir: esa cookie la crea el front del PADRE al montar, asi que entrar
 * directo a `/flota/altas/` sin haber abierto antes la aplicacion dejaba el campo
 * del formulario vacio y TODO POST daba 403. Medido el 2026-09-05.
 *
 * Es su formulario; trae su propio token.
 */
export const COOKIE_CSRF = 'flota_csrf'

/**
 * Escapa para HTML. Cinco caracteres, y `&` PRIMERO o se escaparían dos veces
 * los que se escriben con él.
 */
export function escapar(v) {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ESTILO = `
  :root { color-scheme: light dark }
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; }
  h1 { font-size: 1.1rem; margin: 0 0 .25rem }
  p.sub { color: #666; margin: 0 0 1.5rem; font-size: 12px }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .45rem .7rem; border-bottom: 1px solid #8883; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #666 }
  td.sin-respuesta { color: #b00; font-weight: 600 }
  td.rezagada { color: #b60 }
  td.al-dia { color: #070 }
  footer { margin-top: 2rem; color: #666; font-size: 12px }
`

/** La página. Todo lo que viene de una instancia pasa por `escapar()`. */
export function pagina(filas, usuario) {
  const encabezados = COLUMNAS.map((c) => `<th>${escapar(c)}</th>`).join('')
  const cuerpo = filas
    .map((f) => {
      const celdas = COLUMNAS.map((c) => {
        // La clase sale del estado, que es un valor NUESTRO (`clasificar()`),
        // no del texto que mande la instancia.
        const clase = c === 'estado' ? ` class="${escapar(f.estado)}"` : ''
        return `<td${clase}>${escapar(f[c])}</td>`
      }).join('')
      return `<tr>${celdas}</tr>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Flota — SPACE OS</title>
<meta name="robots" content="noindex,nofollow">
<style>${ESTILO}</style></head>
<body>
<h1>Flota</h1>
<p class="sub">${escapar(filas.length)} instancia(s) · consultado ahora · ${escapar(usuario?.email ?? '')}</p>
<table><thead><tr>${encabezados}</tr></thead>
<tbody>
${cuerpo}
</tbody></table>
<footer>Se consulta a cada instancia al cargar la página. Una instancia que no
responde sale como <b>sin-respuesta</b> y no rompe la tabla.</footer>
</body></html>`
}

const SIN_CACHE = {
  'content-type': 'text/html; charset=utf-8',
  // Un panel de estado cacheado dice que todo va bien cuando ya no va bien.
  'cache-control': 'no-store, no-cache, must-revalidate',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
}

/** Respuesta única para todo lo que no entra. Sin motivo dentro: ver abajo. */
function noAutorizado() {
  return {
    status: 401,
    cabeceras: SIN_CACHE,
    // El motivo NO se le cuenta al visitante: distinguir «sin sesión» de «sin
    // permiso» le confirma a quien prueba si acertó con la cookie. Al registro
    // sí va, que es donde sirve.
    cuerpo: '<!doctype html><meta charset="utf-8"><title>401</title><p>No autorizado.',
  }
}

/**
 * Decide una petición entera.
 *
 * `peticion`: `{ metodo, ruta, cookie }`.
 * `deps`: `{ verificar, obtenerFilas, registrar }` — entran por parámetro para
 * poder probar esto sin red, sin puerto y sin PADRE.
 */
export async function manejar(peticion, deps) {
  const { metodo = 'GET', ruta = '/', cookie, origen, csrf, cuerpo } = peticion
  const { verificar, obtenerFilas, registrar = () => {}, listarSolicitudes, crearSolicitud, origenEsperado } = deps

  const esFlota = RUTAS.includes(ruta)
  const esAltas = RUTAS_ALTAS.includes(ruta)
  if (!esFlota && !esAltas) {
    return { status: 404, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>404</title><p>No existe.' }
  }
  const esAltaNueva = esAltas && metodo === 'POST'
  if (metodo !== 'GET' && !esAltaNueva) {
    return { status: 405, cabeceras: { ...SIN_CACHE, allow: 'GET' }, cuerpo: '<!doctype html><meta charset="utf-8"><title>405</title><p>Solo GET.' }
  }

  const acceso = await verificar(cookie)
  registrar({
    cuando: new Date().toISOString(),
    permitido: !!acceso.permitido,
    usuario: acceso.usuario?.email ?? null,
    motivo: acceso.motivo ?? null,
    ruta,
    metodo,
  })

  // Se deniega ANTES de consultar: no hay por que ir a tocar los servidores de
  // los clientes para acabar contestando 401.
  if (!acceso.permitido) return noAutorizado()

  if (esAltaNueva) return await pedirAlta({ origen, csrf, cookie, cuerpo }, { crearSolicitud, origenEsperado, acceso, registrar })

  if (esAltas) {
    const solicitudes = (await listarSolicitudes?.()) ?? []
    // Se reutiliza el que ya tenga; si no, se crea y se manda con la respuesta.
    const token = tokenDeCookie(cookie, COOKIE_CSRF) || randomUUID()
    const cabeceras = {
      ...SIN_CACHE,
      'set-cookie': `${COOKIE_CSRF}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    }
    return { status: 200, cabeceras, cuerpo: paginaAltas(solicitudes, acceso.usuario, token, zonasDelEntorno()) }
  }

  const filas = await obtenerFilas()
  return { status: 200, cabeceras: SIN_CACHE, cuerpo: pagina(filas, acceso.usuario) }
}

/** El valor de una cookie por nombre exacto. Mismo criterio que `acceso.mjs`. */
export function tokenDeCookie(cabecera, nombre) {
  if (!cabecera) return ''
  for (const parte of String(cabecera).split(';')) {
    const t = parte.trim()
    const i = t.indexOf('=')
    if (i > 0 && t.slice(0, i).trim() === nombre) return t.slice(i + 1).trim()
  }
  return ''
}

/**
 * Un POST aqui CREA UNA MAQUINA y empieza a cobrarse. Tres cerrojos, y hacen
 * falta los tres:
 *
 *  1. Sesion con permiso -- ya comprobado arriba.
 *  2. `Origin` del propio sitio. Corta el caso en que otra pagina manda el
 *     formulario con tu sesion puesta.
 *  3. El token del formulario coincide con la cookie `spaces_csrf` (doble
 *     envio). La cookie de sesion es `sameSite: lax`, asi que un POST cruzado ya
 *     no la llevaria: esto es la segunda cerradura, no la unica.
 */
async function pedirAlta(entrada, ctx) {
  const { origen, csrf, cookie, cuerpo } = entrada
  const { crearSolicitud, origenEsperado, acceso, registrar } = ctx

  // «Si VIENE y no coincide, rechaza» -- no «si no coincide». Una cabecera
  // ausente no es prueba de nada, y en un envio de formulario del MISMO sitio
  // varios navegadores NO mandan `Origin`. Rechazar por su ausencia rompia el
  // caso legitimo: medido el 2026-09-05 con el panel ya desplegado, y el propio
  // registro lo dijo -- `origen ajeno: null`.
  // `Origin: null` es un valor REAL que manda el navegador cuando el origen es
  // «opaco», y es una cadena: existe. Vale como ausente, porque no dice de donde
  // viene nada. Medido el 2026-09-05, al tercer intento con este mismo cerrojo.
  const origenDice = origen && origen !== 'null' ? origen : null
  if (origenEsperado && origenDice && origenDice !== origenEsperado) {
    registrar({ cuando: new Date().toISOString(), permitido: false, motivo: `origen ajeno: ${origenDice}`, ruta: '/flota/altas/' })
    return { status: 403, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>403</title><p>Peticion rechazada.' }
  }

  const esperado = tokenDeCookie(cookie, COOKIE_CSRF)
  if (!csrf || !esperado || csrf !== esperado) {
    registrar({ cuando: new Date().toISOString(), permitido: false, motivo: 'csrf', ruta: '/flota/altas/' })
    return { status: 403, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>403</title><p>Peticion rechazada.' }
  }

  const datos = Object.fromEntries(CAMPOS.map((c) => [c, cuerpo?.[c]]))
  // El dominio en blanco se rellena con `<instancia>.<zona por omision>`, para
  // que crear un hijo «como ensayo4» sea un solo campo y el registro A lo ponga
  // el ejecutor solo. Un dominio escrito se respeta TAL CUAL: puede ser el del
  // owner, que es el caso normal del modelo. Ver `dominioDeAlta()`.
  datos.dominio = dominioDeAlta(datos, zonasDelEntorno())
  const v = validarSolicitud(datos)
  if (!v.ok) {
    return {
      status: 400,
      cabeceras: SIN_CACHE,
      cuerpo: `<!doctype html><meta charset="utf-8"><title>400</title><h1>No se pidio el alta</h1><ul>${v.errores
        .map((e) => `<li>${escapar(e)}</li>`)
        .join('')}</ul><p><a href="/flota/altas/">Volver</a>`,
    }
  }

  await crearSolicitud(datos, acceso.usuario?.email ?? null)
  // 303 y no 200: recargar la pagina despues de un POST no puede pedir OTRA
  // maquina.
  return { status: 303, cabeceras: { ...SIN_CACHE, location: '/flota/altas/' }, cuerpo: '' }
}

/**
 * Que le pasa a esta alta, en una linea y en cristiano.  (A2.4, ADR 0029)
 *
 * Con la maquina de estados hay CINCO sitios donde pararse en vez de dos, y esa
 * es la consecuencia negativa que el ADR declara y que se paga aqui: **el nombre
 * del estado no le dice a nadie que hacer**. «esperando-dns» no distingue entre
 * «el owner todavia no lo ha apuntado» —normal, hay que esperar— y «lo apunto a
 * otra maquina» —no se arregla solo y va a esperar para siempre—.
 *
 * Nunca lanza y siempre devuelve texto: esto se pinta en una pantalla, y una
 * solicitud rara no puede dejarla en blanco.
 */
export function resumenDeAlta(s = {}) {
  const partes = []
  const intentos = Number(s.intentos) || 0

  switch (s.estado) {
    case 'pendiente':
      partes.push('en la cola; el ejecutor la toma en la siguiente pasada')
      break
    case 'en-curso':
      partes.push('creando la maquina e instalando; tarda unos seis minutos')
      break
    case 'esperando-dns':
      if (s.dnsOtraIp) {
        partes.push(
          `el DNS resuelve a ${s.dnsOtraIp}, que es OTRA maquina, y no a ${s.ip ?? 'la suya'}. ` +
            'Esto no se arregla solo: hay que corregir el registro',
        )
      } else {
        partes.push(
          `esperando el DNS: el owner tiene que apuntar ${s.dominio ?? 'su dominio'} a ${s.ip ?? 'la IP'}`,
        )
      }
      break
    case 'emitiendo-cert':
      partes.push(`pidiendo el certificado (intento ${Math.max(intentos, 1)} de 3 en esta hora)`)
      break
    case 'cert-agotado':
      partes.push(
        `se agotaron los ${intentos || 3} intentos de certificado de esta hora. ` +
          'NO se reintenta solo: lo tiene que mirar una persona',
      )
      break
    case 'lista':
      partes.push('sirviendo con certificado — TODAVIA le falta la primera empresa, que es un paso a mano')
      break
    case 'fallida': {
      const ultimo = (s.historial ?? []).filter((h) => h.estado === 'fallida').pop()
      const motivo = ultimo?.error ?? (ultimo?.codigo !== undefined ? `codigo ${ultimo.codigo}` : null)
      partes.push(motivo ? `fallo: ${motivo}` : 'fallo; el motivo esta en el registro de abajo')
      break
    }
    default:
      partes.push('')
  }

  // Y si alguna comprobacion salio rara, va detras del estado sea cual sea: una
  // instancia puede estar «lista» y tener el autoregistro abierto.
  const c = s.comprobaciones
  if (c && typeof c === 'object') {
    const esperado = { login: 200, signup: 503, 'login-post': 401 }
    const raras = Object.keys(esperado).filter((k) => c[k] !== undefined && c[k] !== esperado[k])
    if (raras.length) partes.push(`comprobaciones a revisar: ${raras.join(', ')}`)
  }

  return partes.filter(Boolean).join(' · ')
}

/** La pantalla de altas: el formulario y lo que ya se pidio. */
export function paginaAltas(solicitudes, usuario, csrf, zonas = {}) {
  // El sufijo que se sugiere. Sin zona unica no se sugiere nada y el campo
  // vuelve a ser obligatorio: `zonaPorOmision()` decide, y no adivina con dos.
  const zona = zonaPorOmision(zonas)
  const sufijo = zona ? `.${zona}` : ""
  const ejemploDominio = sufijo ? `pixeled${sufijo}` : "space-os.pixeled.com.mx"
  const SALTO = String.fromCharCode(10)
  const filas = solicitudes
    .map(
      (s) => `<tr>
    <td>${escapar(s.instancia)}</td><td>${escapar(s.dominio)}</td>
    <td class="${escapar(s.estado)}">${escapar(s.estado)}</td>
    <td>${escapar(s.pedidaPor)}</td><td>${escapar(s.cuando)}</td>
  </tr>
  <tr><td colspan="5" class="resumen">${escapar(resumenDeAlta(s))}</td></tr>
  <tr><td colspan="5"><pre>${(s.registro ?? []).map((l) => escapar(l)).join(SALTO)}</pre></td></tr>`,
    )
    .join(SALTO)

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Altas — SPACE OS</title>
<meta name="robots" content="noindex,nofollow">
<style>${ESTILO}
  form { margin: 0 0 2rem; display: grid; gap: .6rem; max-width: 28rem }
  label { display: grid; gap: .2rem; font-size: 12px; color: #666 }
  input { font: inherit; padding: .4rem .5rem; border: 1px solid #8886; border-radius: 4px; background: transparent; color: inherit }
  button { font: inherit; padding: .5rem .9rem; border: 0; border-radius: 4px; background: #2563eb; color: #fff; cursor: pointer }
  pre { margin: 0; font-size: 11px; color: #666; white-space: pre-wrap }
</style></head>
<body>
<h1>Altas de instancia</h1>
<p class="sub"><a href="/flota/">← la flota</a> · ${escapar(usuario?.email ?? '')}</p>

<form method="POST" action="/flota/altas/">
  <input type="hidden" name="csrf" value="${escapar(csrf)}">
  <label>Nombre de la instancia<input name="instancia" required placeholder="pixeled"></label>
  <label>Dominio${sufijo ? ' <span class="sub">(en blanco = ' + escapar(sufijo) + ')</span>' : ''}<input name="dominio"${sufijo ? '' : ' required'} placeholder="${escapar(ejemploDominio)}"></label>
  <label>Correo del Dueño (su cuenta de Google)<input name="email" type="email" required></label>
  <button type="submit">Dar de alta</button>
</form>

<p class="sub">La region es Nueva York y el canal es <b>estable</b>: no se eligen.</p>

${
  sufijo
    ? `<p class="sub"><b>Deja el dominio en blanco</b> y se usa
<code>&lt;nombre&gt;${escapar(sufijo)}</code>: cuelga de una zona nuestra, asi que el
registro DNS lo pone el ejecutor solo y la instancia queda lista sin esperar a
nadie. Es como nacio <code>ensayo4</code>.</p>`
    : ''
}
<p class="sub">Si escribes un dominio PROPIO del owner, hace falta que exista de
verdad: registrado y con sus nameservers puestos. El alta <b>no crea la maquina</b>
mientras ningun DNS reconozca una zona para ese nombre, y despues espera a que el
owner apunte su registro A. Un dominio sin registrar no avanza nunca.</p>

<table><thead><tr><th>instancia</th><th>dominio</th><th>estado</th><th>pedida por</th><th>cuando</th></tr></thead>
<tbody>
${filas}
</tbody></table>
</body></html>`
}

/**
 * Una consulta CON su token. Sin el, `/api/version` contesta `{ok:true}` y nada
 * mas, asi que la instancia sale `sin-respuesta` -- indistinguible de una caida.
 * `estado.mjs:316` ya lo hacia asi; aqui se llamaba a `consultar()` pelado.
 */
export function consultarConToken(instancia, opciones = {}) {
  const { tokensExtra = {}, ...resto } = opciones
  // El tercer argumento NO es opcional en la practica, y su ausencia costo el
  // 2026-09-08: sin el, `tokenDe` mira SOLO el entorno del proceso y nunca
  // `/etc/space-os/flota-tokens.env`. Con eso, el panel web era el unico
  // componente que no leia el archivo hecho para el (TH-FLOTA), y toda
  // instancia dada de alta salia `sin-respuesta` -- indistinguible de una
  // caida-- mientras el CLI, que si lo lee, la enseñaba al dia.
  return consultar(instancia, { token: tokenDe(instancia.nombre, process.env, tokensExtra), ...resto })
}

/**
 * El recorrido de verdad: inventario -> consulta -> reportes -> fusion -> resumen.
 *
 * Las tres piezas entran por parametro para poder probar LA COSTURA, que es
 * donde estuvieron los tres fallos del 2026-09-04: `leerReportes()` devuelve
 * `{reportes, avisos}` y no una lista, `cargarInventario()` devuelve `canales` y
 * no `versiones`, y la consulta necesita token. Los dos primeros se pasaban mal
 * y el tercero faltaba.
 */
export async function filasDeLaFlota(opciones = {}) {
  const {
    dirEstado,
    cargar = cargarInventario,
    consultarUna = consultarConToken,
    leer = leerReportes,
    leerTokens = tokensDeArchivo,
  } = opciones
  const inventario = await cargar()
  // UNA lectura por pasada y se reparte, igual que hace el CLI: por instancia
  // serian N lecturas de un archivo que no cambia entre ellas.
  const tokensExtra = await leerTokens()
  const consultas = await Promise.all(inventario.instancias.map((i) => consultarUna(i, { tokensExtra })))
  const { reportes } = dirEstado ? await leer(dirEstado, inventario.instancias) : { reportes: [] }
  return resumen(fusionar(consultas, reportes), inventario.canales)
}

/** El cuerpo de un formulario. Nada de JSON: es un `<form>` de toda la vida. */
function leerCuerpo(req, limite = 8 * 1024) {
  return new Promise((resolver, rechazar) => {
    let datos = ''
    req.on('data', (trozo) => {
      datos += trozo
      // Un cuerpo enorme no puede tumbar el proceso: son cuatro campos.
      if (datos.length > limite) {
        rechazar(new Error('cuerpo demasiado grande'))
        req.destroy()
      }
    })
    req.on('end', () => resolver(Object.fromEntries(new URLSearchParams(datos))))
    req.on('error', rechazar)
  })
}

/** El servidor de verdad. Solo traduce `manejar()` a HTTP. */
export function crearServidorPanel(opciones = {}) {
  const {
    urlPadre = process.env.URL_PADRE ?? 'http://127.0.0.1:3000',
    dirEstado = process.env.DIR_ESTADO,
    dirSolicitudes = process.env.DIR_SOLICITUDES,
    origenEsperado = process.env.ORIGEN_PANEL,
    registrar = (e) => console.log(JSON.stringify({ evento: 'panel-flota', ...e })),
  } = opciones

  return createServer(async (req, res) => {
    const ruta = (req.url ?? '/').split('?')[0]
    let respuesta
    try {
      const cuerpo = req.method === 'POST' ? await leerCuerpo(req) : undefined
      respuesta = await manejar(
        {
          metodo: req.method,
          ruta,
          cookie: req.headers.cookie,
          origen: req.headers.origin,
          csrf: cuerpo?.csrf,
          cuerpo,
        },
        {
          verificar: (c) => verificarAcceso(c, { urlPadre }),
          obtenerFilas: () => filasDeLaFlota({ dirEstado }),
          listarSolicitudes: () => listarCola(dirSolicitudes),
          crearSolicitud: (datos, quien) => crearEnCola(dirSolicitudes, datos, quien),
          origenEsperado,
          registrar,
        },
      )
    } catch (e) {
      // Un fallo aqui no puede acabar enseñando una traza con dominios dentro.
      registrar({ cuando: new Date().toISOString(), permitido: false, motivo: `error: ${e.message}`, ruta })
      respuesta = { status: 500, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>500</title><p>Error.' }
    }
    res.writeHead(respuesta.status, respuesta.cabeceras)
    res.end(respuesta.cuerpo)
  })
}
