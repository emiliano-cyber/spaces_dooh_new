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
import { verificarAcceso } from './acceso.mjs'
import { cargarInventario, consultar, leerReportes, fusionar, resumen, tokenDe, COLUMNAS } from './estado.mjs'

/** nginx puede pasar el prefijo o recortarlo según lleve barra el `proxy_pass`. */
export const RUTAS = ['/flota/', '/flota', '/']

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
  const { metodo = 'GET', ruta = '/', cookie } = peticion
  const { verificar, obtenerFilas, registrar = () => {} } = deps

  if (!RUTAS.includes(ruta)) {
    return { status: 404, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>404</title><p>No existe.' }
  }
  if (metodo !== 'GET') {
    return { status: 405, cabeceras: { ...SIN_CACHE, allow: 'GET' }, cuerpo: '<!doctype html><meta charset="utf-8"><title>405</title><p>Solo GET.' }
  }

  const acceso = await verificar(cookie)
  registrar({
    cuando: new Date().toISOString(),
    permitido: !!acceso.permitido,
    usuario: acceso.usuario?.email ?? null,
    motivo: acceso.motivo ?? null,
    ruta,
  })

  // Se deniega ANTES de consultar: no hay por qué ir a tocar los servidores de
  // los clientes para acabar contestando 401.
  if (!acceso.permitido) return noAutorizado()

  const filas = await obtenerFilas()
  return { status: 200, cabeceras: SIN_CACHE, cuerpo: pagina(filas, acceso.usuario) }
}

/**
 * Una consulta CON su token. Sin el, `/api/version` contesta `{ok:true}` y nada
 * mas, asi que la instancia sale `sin-respuesta` -- indistinguible de una caida.
 * `estado.mjs:316` ya lo hacia asi; aqui se llamaba a `consultar()` pelado.
 */
export function consultarConToken(instancia, opciones = {}) {
  return consultar(instancia, { token: tokenDe(instancia.nombre), ...opciones })
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
  } = opciones
  const inventario = await cargar()
  const consultas = await Promise.all(inventario.instancias.map((i) => consultarUna(i)))
  const { reportes } = dirEstado ? await leer(dirEstado, inventario.instancias) : { reportes: [] }
  return resumen(fusionar(consultas, reportes), inventario.canales)
}

/** El servidor de verdad. Solo traduce `manejar()` a HTTP. */
export function crearServidorPanel(opciones = {}) {
  const {
    urlPadre = process.env.URL_PADRE ?? 'http://127.0.0.1:3000',
    dirEstado = process.env.DIR_ESTADO,
    registrar = (e) => console.log(JSON.stringify({ evento: 'panel-flota', ...e })),
  } = opciones

  return createServer(async (req, res) => {
    const ruta = (req.url ?? '/').split('?')[0]
    let respuesta
    try {
      respuesta = await manejar(
        { metodo: req.method, ruta, cookie: req.headers.cookie },
        {
          verificar: (c) => verificarAcceso(c, { urlPadre }),
          obtenerFilas: () => filasDeLaFlota({ dirEstado }),
          registrar,
        },
      )
    } catch (e) {
      // Un fallo aquí no puede acabar enseñando una traza con dominios dentro.
      registrar({ cuando: new Date().toISOString(), permitido: false, motivo: `error: ${e.message}`, ruta })
      respuesta = { status: 500, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>500</title><p>Error.' }
    }
    res.writeHead(respuesta.status, respuesta.cabeceras)
    res.end(respuesta.cuerpo)
  })
}
