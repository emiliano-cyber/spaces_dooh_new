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
import { clasificarFallo, RECURSO_TICKETS } from './diagnostico.mjs'
import { filasDeTickets, OK as TICKET_OK, SIN_RESPUESTA as TICKET_SIN_RESPUESTA } from './tickets.mjs'

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
 * La pantalla de tickets (T9, ADR 0038), con las mismas CUATRO variantes de
 * prefijo que `RUTAS_ALTAS`.
 *
 * Y son cuatro por una razon medida, no por simetria: el `proxy_pass` de
 * `infra/nginx/snippets/flota-panel.conf:16` lleva **barra final**, que RECORTA
 * el prefijo, asi que detras del nginx de verdad el panel recibe `/tickets/` y
 * no `/flota/tickets/`. Hasta el 2026-09-23 aqui solo estaban las dos con
 * prefijo --- y el comentario ya afirmaba «con las mismas variantes», que era
 * falso---: la pantalla habria dado **404 en produccion** y en el panel local
 * no, que es la peor forma de descubrirlo.
 *
 * El POST entra por el mismo sitio: el `action` del formulario es
 * `/flota/tickets/` --- la direccion que ve el NAVEGADOR, igual que en
 * `paginaAltas()` --- y nginx se la entrega recortada. Sin las dos variantes
 * sueltas, contestar un ticket daba 404 DESPUES de escribir la respuesta.
 */
export const RUTAS_TICKETS = ['/flota/tickets/', '/flota/tickets', '/tickets/', '/tickets']

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
  td.ok { color: #070; font-weight: 600 }
  td.hay-pendientes { color: #b60; font-weight: 700 }
  td.sin-contestar { color: #b00; font-weight: 600 }
  td.contestado { color: #070 }
  tr.motivo td { border-top: 0; padding-top: 0; color: #b60; font-size: 12px }
  tr.cuerpo-ticket td { border-top: 0; padding-top: 0; font-size: 12px; color: #444 }
  tr.respuesta-ticket td { border-top: 0; padding-top: 0; font-size: 12px; color: #070 }
  .sin-dato { color: #b00; font-style: italic }
  h2 { font-size: .95rem; margin: 1.5rem 0 .5rem }
  footer { margin-top: 2rem; color: #666; font-size: 12px }
`

/**
 * Fecha corta y legible en es-MX, para no obligar a quien mira el panel a
 * descifrar un ISO crudo (`2026-09-22T10:00:00.000Z`). Es un panel que lee
 * una PERSONA para decidir a quien atender (pasada visual del 23/09); esa
 * cadena obliga a descifrarla en la cabeza.
 *
 * Si el valor no es una fecha valida se devuelve TAL CUAL, sin fallar en
 * silencio a una cadena vacia: la instancia mando lo que mando, y esconder el
 * dato es peor que enseñarlo crudo. Quien lo llame sigue pasandolo por
 * `escapar()`, igual que cualquier otro texto que venga de una instancia.
 */
export function fechaLegible(iso) {
  if (iso === null || iso === undefined || iso === '') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
      const fila = `<tr>${celdas}</tr>`

      // El motivo va en una sub-fila a ancho completo y NO en una celda: es una
      // frase, y en una celda estrecha se lee mal. Mismo criterio que el
      // terminal, que ya los imprime debajo de la tabla por la misma razón.
      //
      // Una instancia al día no trae motivo, así que no pinta nada: el silencio
      // es la señal de que está bien.
      if (!f.motivo) return fila
      const visto = f.ultimaVezBien ? ' · ultima vez bien ' + escapar(f.ultimaVezBien) : ''
      return (
        fila +
        `\n<tr class="motivo"><td colspan="${COLUMNAS.length}">${escapar(f.motivo)}${visto}</td></tr>`
      )
    })
    .join('\n')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Flota — SPACE OS</title>
<meta name="robots" content="noindex,nofollow">
<style>${ESTILO}</style></head>
<body>
<h1>Flota</h1>
<p class="sub"><a href="/flota/tickets/">tickets</a> · <a href="/flota/altas/">altas</a> · ${escapar(filas.length)} instancia(s) · consultado ahora · ${escapar(usuario?.email ?? '')}</p>
<table><thead><tr>${encabezados}</tr></thead>
<tbody>
${cuerpo}
</tbody></table>
<footer>Se consulta a cada instancia al cargar la página. Una instancia que no
responde sale como <b>sin-respuesta</b> y no rompe la tabla.</footer>
</body></html>`
}

/**
 * Los estados de un ticket que el PATCH del panel puede fijar. Lista cerrada
 * y en el mismo orden que el contrato del ADR 0038 (T6/T11).
 */
const ESTADOS_TICKET = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']

/**
 * La pantalla de tickets (T9, ADR 0038; el formulario de contestar es T12).
 *
 * `respuestas` es lo que dejó `respuestasDeTickets()` (T9, red): una por
 * instancia, `{ nombre, dominio, tickets }` si contestó o
 * `{ nombre, dominio, motivo }` si no. El resumen —pendientes, total,
 * estado— sale de `filasDeTickets()` (T8, lógica ya probada): **no se
 * recuenta aquí**.
 *
 * ─── El texto del ticket lo escribe un TERCERO ────────────────────────────
 * Folio, tenant, asunto, cuerpo y el motivo de un fallo de red son texto que
 * puso el dueño de la instancia, no SPACE OS. Pasan TODOS por `escapar()`,
 * igual que en `pagina()`: pintarlos crudos es XSS en el panel de AS OOH con
 * un cliente como atacante.
 *
 * ─── La distinción que el ADR marca por escrito ───────────────────────────
 * Una instancia `sin-respuesta` trae `pendientes`/`total` en `null` — nunca
 * en `0`, que es lo que también traería una instancia `ok` sin tickets.
 * Confundir esas dos filas es el mismo error que este proyecto ya penalizó
 * con el panel de versiones ("Sale SIEMPRE con 0", `estado.mjs`): aquí la
 * muda pinta "sin dato" con su propia clase, nunca un cero.
 *
 * ─── `csrf` y `aviso` (T12) ────────────────────────────────────────────────
 * `csrf` es el valor de la cookie `flota_csrf` (ver `COOKIE_CSRF`), el mismo
 * patrón que `paginaAltas()`: viaja en un campo oculto de CADA formulario de
 * ticket, no uno solo, porque cada ticket contestable es su propio `<form>`.
 * `aviso`, si llega, es un mensaje para pintar arriba de todo -- lo usa
 * `contestarTicketDesdePanel()` cuando la instancia NO contestó al PATCH, y
 * es lo que impide que un fallo se repinte como si se hubiera guardado.
 */
export function paginaTickets(respuestas, usuario, csrf, aviso) {
  const filas = filasDeTickets(respuestas)
  const porNombre = new Map(respuestas.map((r) => [r.nombre, r]))

  const resumen = filas
    .map((f) => {
      const sinDato = f.estado === TICKET_SIN_RESPUESTA
      const pendientes = sinDato ? '<span class="sin-dato">sin dato</span>' : escapar(f.pendientes)
      const total = sinDato ? '<span class="sin-dato">sin dato</span>' : escapar(f.total)
      // La clase de la columna de pendientes NO es la del estado de conexion.
      // Son dos preguntas distintas: `estado` dice si la instancia contesto,
      // `hay-pendientes` dice si hay trabajo esperando. Pintarlas con la misma
      // clase hacia que un cliente con 2 tickets abiertos se viera igual de
      // verde que uno sin ninguno -- en la pantalla cuyo proposito, segun el
      // ADR 0038, es ensenar lo que hay que atender.
      const claseAtencion = sinDato ? escapar(f.estado) : f.pendientes > 0 ? 'hay-pendientes' : 'ok'
      const fila = `<tr>
    <td>${escapar(f.nombre)}</td><td>${escapar(f.dominio)}</td>
    <td class="${claseAtencion}">${pendientes}</td>
    <td class="${escapar(f.estado)}">${total}</td>
    <td class="${escapar(f.estado)}">${escapar(f.estado)}</td>
  </tr>`
      // Igual que en pagina(): sin motivo no se pinta nada, el silencio es la
      // señal de que esa instancia está bien.
      if (!f.motivo) return fila
      return fila + `\n<tr class="motivo"><td colspan="5">${escapar(f.motivo)}</td></tr>`
    })
    .join('\n')

  // El detalle por ticket solo existe para quien SÍ contestó: una instancia
  // sin-respuesta no tiene tickets que enseñar, tiene un motivo, y ese ya
  // salió en la sub-fila de arriba.
  const detalle = filas
    .filter((f) => f.estado === TICKET_OK && (porNombre.get(f.nombre)?.tickets?.length ?? 0) > 0)
    .map((f) => {
      const filasTicket = porNombre
        .get(f.nombre)
        .tickets.map((t) => {
          // La distincion que la pasada visual del 23/09 encontro que faltaba:
          // sin esto, quien mira la pantalla no sabe si ya contesto y
          // responde dos veces. `respuesta` la escribe AS OOH, no el cliente,
          // pero pasa por `escapar()` igual -- el dia que alguien pegue ahi un
          // fragmento del correo del cliente, el origen deja de ser de
          // confianza sin que nadie lo note.
          const contestado = t.respuesta !== null && t.respuesta !== undefined && t.respuesta !== ''
          const celdaRespuesta = contestado
            ? `Contestado · ${escapar(fechaLegible(t.respondido_en))}`
            : 'Sin responder'
          // Una sub-fila aparte para el texto de la respuesta, igual que
          // `cuerpo-ticket`: es un párrafo, no una celda estrecha, y solo
          // existe si de verdad hay respuesta que enseñar.
          const filaRespuesta = contestado
            ? `\n  <tr class="respuesta-ticket"><td colspan="7">${escapar(t.respuesta)}</td></tr>`
            : ''
          // El formulario para contestar (T12). Va con el resto del detalle
          // porque solo existe para tickets de una instancia que SÍ contestó
          // -- una instancia muda no tiene a quién mandarle el PATCH.
          //
          // `respuesta` vuelve ESCAPADA dentro del `<textarea>` aunque ya la
          // haya escrito AS OOH: el día que alguien pegue ahí un fragmento
          // del correo de un cliente, el origen deja de ser de confianza sin
          // que nadie lo note. Mismo criterio que la sub-fila de solo lectura
          // de arriba.
          //
          // ─── `respuesta_previa`, y el salto de linea pegado al <textarea> ──
          // El campo oculto lleva la respuesta TAL COMO ESTABA al pintar la
          // pantalla, y es lo unico que permite a `contestarTicketDesdePanel()`
          // saber si quien pulsa Guardar la cambio o solo movio el estado.
          // Sin el, mover el estado reenviaba la respuesta vieja y la instancia
          // sellaba `respondido_en = now()`: el cliente veia una fecha de
          // respuesta falsa.
          //
          // Y el salto de linea justo despues de `<textarea ...>` NO es
          // formato: el parser de HTML se come el primero, asi que una
          // respuesta que EMPIECE por salto de linea volveria recortada y se
          // veria como «cambiada» sin que nadie tocara nada. Se pone uno de
          // sobra para que lo que vuelve sea exactamente lo que se pinto.
          //
          // ─── Y un ticket CERRADO no pinta formulario ──────────────────────
          // El guard de verdad esta en la instancia (`tickets-repo.ts`: el
          // `where` del update refuse tocar un CERRADO). Esto NO es una
          // segunda cerradura --- una pantalla no puede serlo--- es no
          // invitar a nadie a escribir una respuesta que la instancia va a
          // rechazar con un 409 y que se pierde al pulsar Guardar.
          //
          // Y se DICE que esta cerrado en vez de dejar el hueco: un espacio
          // en blanco donde los demas tickets tienen su recuadro se lee como
          // un fallo de la pantalla, que es justo la confusion que este
          // repositorio ya pago tres veces con entornos que "se ven rotos"
          // sin estarlo. Aqui es una decision, y tiene que verse como tal.
          //
          // Solo CERRADO: RESUELTO sigue siendo editable a proposito --- es
          // una hipotesis de AS OOH, y el cliente puede volver con un «pues
          // sigue pasando».
          const opcionesEstado = ESTADOS_TICKET.map(
            (e) => `<option value="${e}"${e === t.estado ? ' selected' : ''}>${e}</option>`,
          ).join('')
          const formulario = t.estado === 'CERRADO'
            ? `
  <tr class="ticket-cerrado"><td colspan="7">Cerrado: ya no admite respuesta ni cambio de estado.</td></tr>`
            : `
  <tr class="formulario-ticket"><td colspan="7"><form class="formulario-ticket" method="POST" action="/flota/tickets/">
    <input type="hidden" name="csrf" value="${escapar(csrf)}">
    <input type="hidden" name="id" value="${escapar(t.id)}">
    <input type="hidden" name="instancia" value="${escapar(f.nombre)}">
    <input type="hidden" name="dominio" value="${escapar(f.dominio)}">
    <input type="hidden" name="respuesta_previa" value="${escapar(t.respuesta)}">
    <label>Respuesta<textarea name="respuesta" rows="2">
${escapar(t.respuesta)}</textarea></label>
    <label>Estado<select name="estado">${opcionesEstado}</select></label>
    <button type="submit">Guardar</button>
  </form></td></tr>`
          return `<tr>
    <td>${escapar(t.folio)}</td><td>${escapar(t.tenant_id)}</td><td>${escapar(t.asunto)}</td>
    <td>${escapar(t.estado)}</td><td>${escapar(t.prioridad)}</td><td>${escapar(fechaLegible(t.creado_en))}</td>
    <td class="${contestado ? 'contestado' : 'sin-contestar'}">${celdaRespuesta}</td>
  </tr>
  <tr class="cuerpo-ticket"><td colspan="7">${escapar(t.cuerpo)}</td></tr>${filaRespuesta}${formulario}`
        })
        .join('\n')
      return `<h2>${escapar(f.nombre)}</h2>
<table><thead><tr><th>folio</th><th>tenant</th><th>asunto</th><th>estado</th><th>prioridad</th><th>creado</th><th>respuesta</th></tr></thead>
<tbody>
${filasTicket}
</tbody></table>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Tickets — SPACE OS</title>
<meta name="robots" content="noindex,nofollow">
<style>${ESTILO}
  form.formulario-ticket { margin: .5rem 0 1rem; display: grid; gap: .4rem; max-width: 32rem }
  form.formulario-ticket label { display: grid; gap: .2rem; font-size: 12px; color: #666 }
  form.formulario-ticket textarea, form.formulario-ticket select {
    font: inherit; padding: .4rem .5rem; border: 1px solid #8886; border-radius: 4px;
    background: transparent; color: inherit;
  }
  form.formulario-ticket textarea { resize: vertical }
  form.formulario-ticket button {
    font: inherit; padding: .4rem .9rem; border: 0; border-radius: 4px;
    background: #2563eb; color: #fff; cursor: pointer; justify-self: start;
  }
  .aviso-error { color: #b00; background: #fee2e2; padding: .6rem .9rem; border-radius: 4px; margin: 0 0 1rem; font-weight: 600 }
  tr.ticket-cerrado td { border-top: 0; padding-top: 0; font-size: 12px; color: #666; font-style: italic }
</style></head>
<body>
<h1>Tickets</h1>
${aviso ? `<p class="aviso-error">${escapar(aviso)}</p>` : ''}
<p class="sub"><a href="/flota/">← la flota</a> · ${escapar(filas.length)} instancia(s) · ${escapar(usuario?.email ?? '')}</p>
<table><thead><tr><th>instancia</th><th>dominio</th><th>pendientes</th><th>total</th><th>estado</th></tr></thead>
<tbody>
${resumen}
</tbody></table>
${detalle}
<footer>Se consulta a cada instancia al cargar la página. Una instancia que NO
CONTESTA sale <b>sin-respuesta</b> con "sin dato" en pendientes y total — nunca
0, que también diría una instancia al día sin tickets.</footer>
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
  const {
    verificar,
    obtenerFilas,
    obtenerRespuestasTickets,
    contestarTicket,
    registrar = () => {},
    listarSolicitudes,
    crearSolicitud,
    origenEsperado,
  } = deps

  const esFlota = RUTAS.includes(ruta)
  const esAltas = RUTAS_ALTAS.includes(ruta)
  const esTickets = RUTAS_TICKETS.includes(ruta)
  if (!esFlota && !esAltas && !esTickets) {
    return { status: 404, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>404</title><p>No existe.' }
  }
  const esAltaNueva = esAltas && metodo === 'POST'
  // El formulario de la T12: un POST aqui contesta UN ticket (o mueve su
  // estado) en la instancia del cliente. Mismo criterio que `esAltaNueva`:
  // el metodo se admite ANTES de saber si trae CSRF valido, porque el
  // rechazo por CSRF es un 403 -- lo decide `contestarTicketDesdePanel()`,
  // no este guard de metodo.
  const esTicketContestar = esTickets && metodo === 'POST'
  if (metodo !== 'GET' && !esAltaNueva && !esTicketContestar) {
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

  if (esTicketContestar) {
    return await contestarTicketDesdePanel(
      { origen, csrf, cookie, cuerpo },
      { contestarTicket, origenEsperado, acceso, registrar, obtenerRespuestasTickets },
    )
  }

  if (esTickets) {
    const respuestas = await obtenerRespuestasTickets()
    // Mismo patron que `esAltas` arriba: se reutiliza la cookie si ya la
    // trae, y si no se crea -- es la MISMA cookie `flota_csrf` de toda la
    // pagina, no una nueva por ruta, asi que un formulario abierto en
    // `/flota/altas/` y otro en `/flota/tickets/` no se invalidan entre si.
    const token = tokenDeCookie(cookie, COOKIE_CSRF) || randomUUID()
    const cabeceras = {
      ...SIN_CACHE,
      'set-cookie': `${COOKIE_CSRF}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    }
    return { status: 200, cabeceras, cuerpo: paginaTickets(respuestas, acceso.usuario, token) }
  }

  const filas = await obtenerFilas()
  return { status: 200, cabeceras: SIN_CACHE, cuerpo: pagina(filas, acceso.usuario) }
}

/**
 * Finales de linea a `\n`, y nada mas.
 *
 * Un `<textarea>` se envia con **CRLF**: lo manda el navegador asi por el
 * formato de los formularios, no por lo que se tecleo. Lo que hay guardado en
 * la instancia lleva `\n`. Comparando en crudo, CUALQUIER respuesta de dos
 * lineas se veria siempre como cambiada --- y con eso el arreglo de
 * `respuesta_previa` no serviria de nada justo en los tickets con mas texto,
 * que son los que mas importan.
 */
export function normalizarSaltos(texto) {
  return String(texto).replace(/\r\n/g, '\n')
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
 * Un POST aqui contesta UN ticket (y/o mueve su estado) en la instancia del
 * cliente. Mismos dos cerrojos que `pedirAlta()`, copiados a proposito y por
 * la misma razon (Origin, y CSRF de doble envio contra la MISMA cookie
 * `flota_csrf`): quien ya tiene sesion en el panel puede mandar este POST, y
 * otra pagina no puede hacerlo hablar en su nombre.
 *
 * ─── Lo que distingue esto de `pedirAlta()`, y es lo que mas importa aqui ──
 * Un alta que falla es una solicitud que se queda en la cola -- nada se
 * pierde. Un PATCH que falla es una respuesta que alguien ACABA DE ESCRIBIR.
 * Por eso el exito y el fallo NO pueden compartir el mismo camino:
 *
 *   - exito: 303 a `/flota/tickets/` -- recargar no puede reenviar el mismo
 *     PATCH, igual que en `pedirAlta()`.
 *   - fallo: se queda EN ESTA peticion (no redirige), con `aviso` puesto en
 *     `paginaTickets()`. Si esto redirigiera igual que el exito, quien
 *     escribio la respuesta veria la pantalla de siempre y creeria que se
 *     guardo -- el fallo silencioso que este proyecto ya penalizo.
 */
async function contestarTicketDesdePanel(entrada, ctx) {
  const { origen, csrf, cookie, cuerpo } = entrada
  const { contestarTicket, origenEsperado, acceso, registrar, obtenerRespuestasTickets } = ctx

  // Mismo criterio que `pedirAlta()`: «si VIENE y no coincide, rechaza», no
  // «si no coincide» -- ver el comentario de alli, mismo cerrojo.
  const origenDice = origen && origen !== 'null' ? origen : null
  if (origenEsperado && origenDice && origenDice !== origenEsperado) {
    registrar({ cuando: new Date().toISOString(), permitido: false, motivo: `origen ajeno: ${origenDice}`, ruta: '/flota/tickets/' })
    return { status: 403, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>403</title><p>Peticion rechazada.' }
  }

  const esperado = tokenDeCookie(cookie, COOKIE_CSRF)
  if (!csrf || !esperado || csrf !== esperado) {
    registrar({ cuando: new Date().toISOString(), permitido: false, motivo: 'csrf', ruta: '/flota/tickets/' })
    return { status: 403, cabeceras: SIN_CACHE, cuerpo: '<!doctype html><meta charset="utf-8"><title>403</title><p>Peticion rechazada.' }
  }

  const id = String(cuerpo?.id ?? '').trim()
  // `instancia.dominio` sale del formulario y es dato del NAVEGADOR: NO es la
  // frontera de confianza. El `contestarTicket` de verdad, cableado en
  // `crearServidorPanel()`, es `contestarTicketDeConfianza()`, que ignora
  // este campo y resuelve el dominio real desde el inventario por `nombre` --
  // ver su comentario. Aqui viaja solo para que un doble de pruebas pueda
  // afirmar que el formulario se leyo bien.
  const instancia = { nombre: String(cuerpo?.instancia ?? ''), dominio: String(cuerpo?.dominio ?? '') }
  const respuestaTexto = normalizarSaltos(String(cuerpo?.respuesta ?? ''))
  const respuestaPrevia = normalizarSaltos(String(cuerpo?.respuesta_previa ?? ''))
  const estadoNuevo = String(cuerpo?.estado ?? '')
  // Lista blanca de claves, igual que `paraElPanel()` en `route.ts`: el
  // cuerpo NO se reenvia tal cual, se reconstruye campo a campo.
  //
  // ─── `respuesta` viaja SOLO si cambio de verdad ──────────────────────────
  // El <textarea> viene precargado y el <select> manda valor siempre, asi que
  // abrir un ticket YA contestado, cambiar solo el estado y pulsar Guardar
  // reenviaba la respuesta vieja tal cual. La instancia no puede distinguir
  // eso de una respuesta nueva --- `tickets-repo.ts` escribe
  // `respondido_en = now()` en cuanto llega el campo, y hace bien: escribe lo
  // que le mandan--- asi que el cliente acababa viendo «Respuesta de AS OOH»
  // con la fecha de hoy para algo escrito tres dias antes. El arreglo va
  // AQUI, que es donde esta la mentira.
  //
  // `respuesta_previa` es un campo del NAVEGADOR, y se le concede exactamente
  // una cosa: decir que habia en la pantalla al abrirla, que es lo unico que
  // puede saber. Manipularlo o quitarlo no escribe texto que nadie tecleo ni
  // cambia a donde va el PATCH (eso lo decide el inventario, en
  // `contestarTicketDeConfianza()`): en el peor caso se vuelve al
  // comportamiento anterior, mandar la respuesta siempre.
  const cambios = { id }
  if (respuestaTexto.trim() !== '' && respuestaTexto !== respuestaPrevia) {
    cambios.respuesta = respuestaTexto
  }
  if (estadoNuevo.trim() !== '') cambios.estado = estadoNuevo

  // El guard mira el NOMBRE, no el dominio. `contestarTicketDeConfianza()`
  // ignora a proposito el `dominio` del formulario --- resuelve el real por
  // `nombre` contra el inventario, que es lo que cierra la fuga de token---,
  // asi que exigir aqui un campo que despues no decide nada ataba el camino
  // feliz a un input oculto: quitarlo por limpieza habria puesto toda la
  // pantalla en 502 sin que nada lo delatara.
  const resultado =
    id && instancia.nombre
      ? await contestarTicket(instancia, cambios)
      : { ok: false, motivo: 'falta el id del ticket o el nombre de la instancia' }

  if (resultado.ok) {
    return { status: 303, cabeceras: { ...SIN_CACHE, location: '/flota/tickets/' }, cuerpo: '' }
  }

  // El fallo SI se anota: al registro, no al visitante a secas -- aqui el
  // visitante tambien lo ve, porque es quien tiene que saber que reintentar.
  registrar({ cuando: new Date().toISOString(), permitido: true, motivo: `PATCH no llego: ${resultado.motivo}`, ruta: '/flota/tickets/' })

  const respuestas = await obtenerRespuestasTickets()
  return {
    status: 502,
    cabeceras: SIN_CACHE,
    cuerpo: paginaTickets(respuestas, acceso.usuario, esperado, `No se guardo: ${resultado.motivo}`),
  }
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
<p class="sub"><a href="/flota/">← la flota</a> · <a href="/flota/tickets/">tickets</a> · ${escapar(usuario?.email ?? '')}</p>

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

/**
 * Bajo el `basePath` de Next; mismo criterio que `RUTA_VERSION` en `estado.mjs`.
 * `/api/tickets` con `x-flota-token` es el contrato que fija T6 (ADR 0038).
 */
const RUTA_TICKETS = '/spaces-dooh/api/tickets/'

/**
 * Los tickets de UNA instancia, con su token de flota. NUNCA lanza: el fallo
 * es una entrada sin `tickets`, con `motivo`, que `filasDeTickets()` (T8)
 * convierte en la fila `sin-respuesta` — nunca en `pendientes: 0`, que es el
 * punto que el ADR 0038 marca por escrito.
 *
 * Mismo motivo que `consultarConToken()` arriba para no llamar a `consultar()`
 * pelado: sin token la ruta del panel no atraviesa tenants (es `esElPanel()`,
 * el mismo guard de `/api/version`), así que la instancia saldría
 * `sin-respuesta` — indistinguible de una caída — por una cabecera que falta,
 * no porque la instancia esté mal.
 */
export async function consultarTickets(instancia, opciones = {}) {
  const { tokensExtra = {}, esperaMs = 5000, pedir = fetch } = opciones
  const token = tokenDe(instancia.nombre, process.env, tokensExtra)
  const base = { nombre: instancia.nombre, dominio: instancia.dominio }
  const url = 'https://' + instancia.dominio + RUTA_TICKETS
  try {
    const respuesta = await pedir(url, {
      method: 'GET',
      headers: token ? { 'x-flota-token': token } : {},
      signal: AbortSignal.timeout(esperaMs),
      redirect: 'manual',
    })
    if (!respuesta.ok) {
      return { ...base, motivo: clasificarFallo({ status: respuesta.status, recurso: RECURSO_TICKETS }) }
    }
    const cuerpo = await respuesta.json()
    if (!Array.isArray(cuerpo?.tickets)) {
      // Mismo caso que `cuerpoSinVersion` en /api/version: un 200 sin la
      // forma esperada significa que el token no se reconoció como panel.
      return {
        ...base,
        motivo: clasificarFallo({ cuerpoSinVersion: true, token, nombre: instancia.nombre }),
      }
    }
    return { ...base, tickets: cuerpo.tickets }
  } catch (error) {
    return { ...base, motivo: clasificarFallo({ error }) }
  }
}

/**
 * El PATCH de UN ticket a UNA instancia (T12) -- la escritura equivalente de
 * `consultarTickets()`, con el MISMO resolutor de token, la MISMA URL base y
 * el MISMO `clasificarFallo()`. No es una segunda forma de hablar con las
 * instancias, es la de siempre con otro verbo.
 *
 * NUNCA lanza: el llamador es `contestarTicketDesdePanel()`, que acaba de
 * recibir el POST de alguien que escribio una respuesta a mano, y si esto
 * lanzara en vez de devolver `{ok:false}` esa persona veria un 500 generico
 * en vez de un motivo que le diga que paso.
 *
 * `cambios` viaja TAL CUAL como cuerpo del PATCH -- `{id, respuesta?,
 * estado?}` -- porque quien arma esa lista blanca es `contestarTicketDesdePanel()`,
 * no aqui: esta funcion es solo la costura de red, igual que `consultarTickets()`.
 */
export async function contestarTicket(instancia, cambios, opciones = {}) {
  const { tokensExtra, leerTokens = tokensDeArchivo, esperaMs = 5000, pedir = fetch } = opciones
  const tokens = tokensExtra ?? (await leerTokens())
  const token = tokenDe(instancia.nombre, process.env, tokens)
  const url = 'https://' + instancia.dominio + RUTA_TICKETS
  try {
    const respuesta = await pedir(url, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-flota-token': token } : {}),
      },
      body: JSON.stringify(cambios),
      signal: AbortSignal.timeout(esperaMs),
      redirect: 'manual',
    })
    if (!respuesta.ok) {
      return { ok: false, motivo: clasificarFallo({ status: respuesta.status, recurso: RECURSO_TICKETS }) }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, motivo: clasificarFallo({ error }) }
  }
}

/**
 * El PATCH de verdad, pero SIN CONFIAR en el dominio que trae el formulario
 * (T12, hallazgo de la revision de codigo antes de cerrar la tarea).
 *
 * El formulario manda `{nombre, dominio}` en campos ocultos, y un campo
 * oculto de un POST es un dato que pone el NAVEGADOR, no el servidor: quien
 * ya tiene sesion en el panel podria editarlo a mano y mandar el
 * `x-flota-token` de una instancia real a un host que controla -- fuga de
 * credencial, no XSS ni CSRF, pero el mismo principio de fondo: no confiar en
 * lo que trae el cliente para decidir A DONDE viaja un secreto.
 *
 * Por eso el dominio de verdad sale de `cargarInventario()` -- la MISMA
 * fuente que ya usan `consultarTickets()`/`filasDeLaFlota()` para el GET, que
 * NUNCA lo toman del cliente -- y se busca por `nombre`. Si ese nombre no
 * esta en el inventario no hay a donde mandar el PATCH, y se rechaza: ni con
 * el dominio del formulario ni con ningun otro.
 */
export async function contestarTicketDeConfianza(instanciaFormulario, cambios, opciones = {}) {
  const { cargar = cargarInventario, ...resto } = opciones
  const inventario = await cargar()
  const real = inventario.instancias.find((i) => i.nombre === instanciaFormulario?.nombre)
  if (!real) return { ok: false, motivo: 'instancia desconocida' }
  return contestarTicket({ nombre: real.nombre, dominio: real.dominio }, cambios, resto)
}

/**
 * El recorrido de tickets: inventario -> consulta a cada instancia, cruda.
 * Misma costura, y los mismos riesgos, que `filasDeLaFlota()` arriba — ver sus
 * comentarios sobre los tres fallos del 2026-09-04 y el del 2026-09-08.
 *
 * Devuelve la respuesta CRUDA de cada instancia — `{nombre, dominio, tickets}`
 * o `{nombre, dominio, motivo}` — y no la fila resumida: `paginaTickets()`
 * necesita el detalle (asunto, folio…) que `filasDeTickets()` (T8) descarta a
 * propósito al agregar, y el resumen mismo lo saca llamando a esa función
 * sobre este mismo arreglo — no se recuenta aquí ni ahí.
 */
export async function respuestasDeTickets(opciones = {}) {
  const { cargar = cargarInventario, consultarUna = consultarTickets, leerTokens = tokensDeArchivo } = opciones
  const inventario = await cargar()
  const tokensExtra = await leerTokens()
  return Promise.all(inventario.instancias.map((i) => consultarUna(i, { tokensExtra })))
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
          obtenerRespuestasTickets: () => respuestasDeTickets(),
          // `contestarTicketDeConfianza()`, NO `contestarTicket()` pelado: el
          // dominio del PATCH tiene que salir del inventario, no del
          // formulario. Ver su comentario de cabecera.
          contestarTicket: (instancia, cambios) => contestarTicketDeConfianza(instancia, cambios),
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
