// ============================================================================
//  Arma el manual de usuario ilustrado en PDF.
//
//  Correr:
//    node manuales/armar-pdf.mjs
//
//  Toma el manual del vault, le inserta cada captura JUSTO DEBAJO del paso que
//  le toca, y lo imprime con Playwright — el mismo Playwright que toma las
//  capturas, para no meter otra herramienta al proyecto.
//
//  NO modifica el manual del vault. Lo lee y construye un HTML de trabajo.
//
//  Si una captura no existe (porque quedó pendiente o bloqueada), no se inventa
//  un hueco ni se rompe: se omite y se contabiliza en el resumen de portada.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..')

const MANUAL = resolve(RAIZ, 'vault/08-Manuales/manual-usuario-2026-08-11.md')
const CAPTURAS = resolve(RAIZ, 'manuales/capturas')
const HTML_TRABAJO = resolve(RAIZ, 'manuales/manual-ilustrado.html')

// Fecha LOCAL, no UTC: `toISOString()` daba el día siguiente al caer la tarde
// en México, y el PDF salía fechado mañana. La fecha de las capturas es un dato
// del documento —dice si las imágenes siguen vigentes—, así que tiene que ser
// el día de quien las tomó.
const HOY = (() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()
const SALIDA = resolve(RAIZ, `manual-usuario-${HOY}.pdf`)
const ENTORNO = process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh'

// ── Dónde va cada captura ───────────────────────────────────────────────────
//
// `seccion` es el título ### del manual y `paso` el número de la lista. Con
// `paso: null` la imagen va al final de la sección (cuando ilustra el «qué
// debes ver» y no un paso concreto).
//
// Este mapa ES el vínculo entre el manual y las imágenes. Si el manual cambia
// de pasos, aquí se nota.
const UBICACION = [
  { img: '01-01-acceso-tres-opciones', seccion: 'Cómo entras', paso: 1, pie: 'La pantalla de acceso, con sus tres caminos' },
  { img: '01-02-alta-organizacion', seccion: 'Crear tu organización', paso: 2, pie: 'El formulario de alta de organización' },
  { img: '01-03-tablero-inicio', seccion: 'Cómo entras', paso: null, pie: 'El tablero de inicio al entrar' },
  { img: '01-04-menu-lateral-grupos', seccion: 'Qué puedes ver según tu tipo de cuenta', paso: null, pie: 'El menú lateral y sus cinco grupos' },
  { img: '01-05-desbloqueo-cambios', seccion: 'Cuando el sistema te pide desbloquear', paso: null, pie: 'La ventana de desbloqueo de cambios' },

  { img: '02-01-inventario-lista', seccion: 'Dar de alta una pantalla', paso: null, pie: 'La lista de inventario' },
  { img: '02-02-alta-pantalla-datos', seccion: 'Dar de alta una pantalla', paso: 3, pie: 'Los datos de la pantalla' },
  { img: '02-03-alta-pantalla-arrendador', seccion: 'Dar de alta una pantalla', paso: 4, pie: 'La elección del arrendador' },
  { img: '02-04-carga-masiva', seccion: 'Cargar muchas pantallas de una vez', paso: 2, pie: 'La carga masiva por Excel' },
  { img: '02-05-ficha-pantalla', seccion: 'Corregir o dar de baja una pantalla', paso: 2, pie: 'La ficha de la pantalla' },
  { img: '02-06-incidencia-pausa', seccion: 'Reportar una avería, reubicar o pausar una pantalla', paso: 3, pie: 'Incidencia, reubicación y pausa' },

  { img: '03-01-arrendadores-lista', seccion: 'Dar de alta un arrendador', paso: null, pie: 'La lista de arrendadores' },
  { img: '03-02-alta-arrendador', seccion: 'Dar de alta un arrendador', paso: 3, pie: 'Los datos del arrendador' },
  { img: '03-03-contrato-renta', seccion: 'Completar el contrato de renta', paso: 3, pie: 'El monto de la renta y su periodicidad' },
  { img: '03-04-contrato-documento', seccion: 'Mandar el contrato a firma del arrendador', paso: 3, pie: 'El documento del contrato' },
  { img: '03-05-calendario-pagos', seccion: 'Registrar el pago de la renta', paso: 2, pie: 'El calendario de pagos de renta' },

  { img: '04-01-clientes-lista', seccion: 'Registrar un cliente o una agencia', paso: null, pie: 'La lista de clientes' },
  { img: '04-02-alta-cliente', seccion: 'Registrar un cliente o una agencia', paso: 3, pie: 'Los datos fiscales del cliente' },
  { img: '04-03-comercial-mapa-filtro', seccion: 'Buscar pantallas para un cliente', paso: 2, pie: 'El buscador comercial, con el mapa y un filtro' },
  { img: '04-04-disponibilidad-calendario', seccion: 'Buscar pantallas para un cliente', paso: 4, pie: 'El calendario de disponibilidad' },
  { img: '04-05-propuestas-lista', seccion: 'Armar una propuesta', paso: 1, pie: 'La lista de propuestas' },
  { img: '04-06-propuesta-alta', seccion: 'Armar una propuesta', paso: 4, pie: 'Las pantallas, sus fechas y sus spots' },
  { img: '04-07-propuesta-detalle-total', seccion: 'Armar una propuesta', paso: null, pie: 'La propuesta con su folio y su total' },
  { img: '04-08-propuesta-liga-publica', seccion: 'Compartir la propuesta y que el cliente la acepte', paso: null, pie: 'La propuesta como la ve el cliente, sin usuario ni contraseña' },
  { img: '04-09-generar-campana', seccion: 'Convertir la propuesta aceptada en campaña', paso: 3, pie: 'El control para generar la campaña' },

  { img: '05-01-creativos-lista', seccion: 'Cargar los creativos', paso: 1, pie: 'El módulo de creativos' },
  { img: '05-05-imprenta-orden', seccion: 'Pedir la impresión', paso: 2, pie: 'La orden de impresión' },
  { img: '05-07-operaciones-alta-ot', seccion: 'Levantar una orden de trabajo', paso: 2, pie: 'El alta de una orden de trabajo' },
  { img: '05-08-almacen-activo', seccion: 'Mover activos en el almacén', paso: 1, pie: 'El almacén' },

  { img: '06-01-finanzas-lista', seccion: 'Facturar una campaña', paso: 1, pie: 'El módulo de finanzas' },
  { img: '06-05-comisiones', seccion: 'Consultar comisiones', paso: 2, pie: 'El cálculo de comisiones' },

  { img: '07-01-notificaciones-panel', seccion: 'Avisos del sistema', paso: 1, pie: 'El panel de notificaciones' },
]

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Marcas de línea: negritas, código y los enlaces del vault.
function enLinea(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[([^\]]+)\]\]/g, '<em>$1</em>')
}

// ── Conversión del manual a HTML ────────────────────────────────────────────
//
// Es un convertidor a medida del subconjunto que usa ESTE manual (encabezados,
// listas, tablas, avisos y citas). No pretende ser un Markdown general: meter
// una dependencia nueva por catorce construcciones no compensa.
function convertir(md) {
  const usadas = new Set()
  // Fuera el frontmatter.
  const cuerpo = md.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lineas = cuerpo.split(/\r?\n/)

  const out = []
  let seccion = ''      // ### vigente (o ## si el capítulo no tiene ###)
  let nPaso = 0         // contador de la lista ordenada en curso
  let enLista = null    // 'ol' | 'ul' | null
  let enTabla = false
  let parrafo = []

  const cerrarParrafo = () => {
    if (parrafo.length) {
      out.push(`<p>${enLinea(parrafo.join(' '))}</p>`)
      parrafo = []
    }
  }
  const cerrarLista = () => {
    if (enLista) { out.push(`</${enLista}>`); enLista = null }
  }
  const cerrarTabla = () => {
    if (enTabla) { out.push('</tbody></table>'); enTabla = false }
  }
  const cerrarTodo = () => { cerrarParrafo(); cerrarLista(); cerrarTabla() }

  // Figuras que tocan en este punto: por sección y paso.
  const figuras = (sec, paso) =>
    UBICACION.filter((u) => u.seccion === sec && u.paso === paso)
      .map((u) => {
        const ruta = resolve(CAPTURAS, `${u.img}.png`)
        if (!existsSync(ruta)) return ''
        usadas.add(u.img)
        // file:// para que Chromium las cargue del disco.
        return `<figure><img src="file:///${ruta.replace(/\\/g, '/')}" alt="${esc(u.pie)}">` +
          `<figcaption><span class="cap-sec">${esc(sec)}</span>` +
          `${paso ? ` · paso ${paso}` : ''} — ${esc(u.pie)}</figcaption></figure>`
      })
      .join('')

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]

    // El manual cierra con secciones de trabajo interno que no van al PDF del
    // usuario final: son preguntas del redactor, no instrucciones.
    if (/^##\s+PENDIENTES\s*$/.test(l)) break
    if (/^##\s+Relacionadas\s*$/.test(l)) break

    // Encabezados
    let m = l.match(/^(#{1,4})\s+(.*)$/)
    if (m) {
      // Antes de cambiar de sección, las figuras de «final de sección».
      const pend = figuras(seccion, null)
      cerrarTodo()
      if (pend) out.push(pend)
      const nivel = m[1].length
      const texto = m[2].trim()
      if (nivel <= 3) { seccion = texto; nPaso = 0 }
      out.push(`<h${nivel}>${enLinea(texto)}</h${nivel}>`)
      continue
    }

    // Avisos del vault: > [!warning] / [!note] / [!info]
    m = l.match(/^>\s*\[!(\w+)\]\s*(.*)$/)
    if (m) {
      cerrarTodo()
      const tipo = m[1].toLowerCase()
      const linea1 = m[2].trim()
      const cuerpoAviso = [linea1]
      while (i + 1 < lineas.length && /^>\s?/.test(lineas[i + 1])) {
        cuerpoAviso.push(lineas[++i].replace(/^>\s?/, '').trim())
      }
      // Las notas «Captura: …» del manual son instrucciones para quien ilustra,
      // no para quien usa el sistema. En el PDF ya está la imagen: dejarlas
      // sería decirle al lector «aquí va una captura» justo al lado de ella.
      if (/^Captura:/i.test(linea1)) continue
      out.push(
        `<div class="aviso aviso-${tipo}">${enLinea(cuerpoAviso.filter(Boolean).join(' '))}</div>`,
      )
      continue
    }

    // Tablas
    if (/^\|/.test(l)) {
      cerrarParrafo(); cerrarLista()
      const celdas = l.split('|').slice(1, -1).map((c) => c.trim())
      if (/^[\s|:-]+$/.test(l)) continue // separador
      if (!enTabla) {
        out.push('<table><thead><tr>' + celdas.map((c) => `<th>${enLinea(c)}</th>`).join('') + '</tr></thead><tbody>')
        enTabla = true
      } else {
        out.push('<tr>' + celdas.map((c) => `<td>${enLinea(c)}</td>`).join('') + '</tr>')
      }
      continue
    }
    if (enTabla && l.trim() === '') { cerrarTabla(); continue }

    // Lista ordenada = los pasos. Aquí es donde entran las capturas.
    m = l.match(/^(\d+)\.\s+(.*)$/)
    if (m) {
      cerrarParrafo(); cerrarTabla()
      if (enLista !== 'ol') { cerrarLista(); out.push('<ol>'); enLista = 'ol' }
      nPaso = parseInt(m[1], 10)
      // Continuación indentada del paso.
      let texto = m[2]
      while (i + 1 < lineas.length && /^\s{2,}\S/.test(lineas[i + 1]) && !/^\s*\d+\./.test(lineas[i + 1])) {
        texto += ' ' + lineas[++i].trim()
      }
      // La imagen va DENTRO del <li>: así queda justo debajo de su paso, y no
      // suelta al final de la lista donde ya no se sabe a qué paso pertenece.
      out.push(`<li>${enLinea(texto)}${figuras(seccion, nPaso)}</li>`)
      continue
    }

    // Lista sin numerar
    m = l.match(/^[-*]\s+(.*)$/)
    if (m) {
      cerrarParrafo(); cerrarTabla()
      if (enLista !== 'ul') { cerrarLista(); out.push('<ul>'); enLista = 'ul' }
      out.push(`<li>${enLinea(m[1])}</li>`)
      continue
    }

    if (l.trim() === '') { cerrarParrafo(); cerrarLista(); continue }

    cerrarTabla()
    parrafo.push(l.trim())
  }

  const pend = figuras(seccion, null)
  cerrarTodo()
  if (pend) out.push(pend)

  return { html: out.join('\n'), usadas }
}

// ── Portada ─────────────────────────────────────────────────────────────────
function portada(usadas) {
  const total = UBICACION.length
  const n = usadas.size
  const faltan = total - n
  return `
<section class="portada">
  <h1 class="titulo">Manual de usuario</h1>
  <p class="sub">Space OS · gestión de espacios publicitarios</p>

  <div class="ficha">
    <div class="fila"><span>Capturas tomadas el</span><strong>${HOY}</strong></div>
    <div class="fila"><span>Entorno</span><strong>Pruebas LOCAL — ${esc(ENTORNO)}</strong></div>
    <div class="fila"><span>Imágenes incluidas</span><strong>${n} de ${total} previstas</strong></div>
    <div class="fila"><span>Manual de origen</span><strong>manual-usuario-2026-08-11.md</strong></div>
  </div>

  <div class="aviso aviso-warning">
    <strong>Este documento contiene datos reales y no debe distribuirse.</strong>
    Las capturas se tomaron sin difuminar, por decisión expresa de quien encargó
    el documento, así que incluyen correos, RFC y domicilios reales del entorno
    local. No lo reenvíes por correo ni lo publiques: compártelo solo con quien
    ya tiene acceso a esos datos.
  </div>

  ${faltan > 0 ? `<div class="aviso aviso-info">
    <strong>Faltan ${faltan} de las ${total} imágenes previstas.</strong>
    Los pasos sin ilustrar se leen igual, pero no tienen imagen todavía. El
    motivo de cada una está en <code>manuales/capturas-pendientes.md</code>.
  </div>` : ''}

  <p class="nota">
    Las imágenes envejecen. Si la aplicación cambió después de la fecha de
    arriba, vuelve a generar este PDF: las capturas se regeneran solas con
    <code>npx playwright test --config manuales/playwright.config.ts</code> y
    <code>node manuales/armar-pdf.mjs</code>.
  </p>
</section>
<div class="salto"></div>`
}

const ESTILO = `
  @page { size: Letter; margin: 2cm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; font-size: 10.5pt; line-height: 1.55; margin: 0;
  }
  h1, h2, h3, h4 { line-height: 1.25; page-break-after: avoid; }
  h1 { font-size: 21pt; margin: 0 0 4pt; }
  h2 {
    font-size: 15pt; margin: 22pt 0 8pt; padding-bottom: 4pt;
    border-bottom: 1.5px solid #d8d8d8; page-break-before: auto;
  }
  h3 { font-size: 12.5pt; margin: 16pt 0 5pt; color: #111; }
  p { margin: 0 0 7pt; }
  ol, ul { margin: 0 0 9pt; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  code {
    font-family: "SF Mono", Consolas, monospace; font-size: 9pt;
    background: #f2f2f0; padding: 1px 4px; border-radius: 3px;
  }
  table {
    width: 100%; border-collapse: collapse; margin: 0 0 10pt;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th, td { border: 1px solid #dcdcdc; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #f5f5f3; font-weight: 600; }

  /* Las capturas. Nunca partidas entre dos páginas: media captura no ilustra
     nada. */
  figure { margin: 9pt 0 12pt; page-break-inside: avoid; }
  figure img {
    display: block; width: 100%; height: auto;
    border: 1px solid #d5d5d5; border-radius: 4px;
  }
  figcaption {
    font-size: 8.5pt; color: #666; margin-top: 4pt;
    padding-left: 2pt; border-left: 2.5px solid #c9c9c9;
    padding-left: 6pt;
  }
  .cap-sec { font-weight: 600; color: #444; }

  .aviso {
    margin: 8pt 0; padding: 7pt 10pt; border-radius: 4px;
    border-left: 3px solid #999; background: #f7f7f5;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  .aviso-warning { border-left-color: #d97706; background: #fff8ed; }
  .aviso-info    { border-left-color: #2563eb; background: #eff5ff; }
  .aviso-note    { border-left-color: #6b7280; background: #f6f7f8; }

  .portada { padding-top: 40pt; }
  .portada .titulo { font-size: 30pt; margin-bottom: 2pt; }
  .portada .sub { font-size: 12pt; color: #666; margin-bottom: 26pt; }
  .ficha { margin-bottom: 20pt; }
  .ficha .fila {
    display: flex; justify-content: space-between;
    border-bottom: 1px solid #e6e6e6; padding: 6pt 0; font-size: 10pt;
  }
  .ficha .fila span { color: #666; }
  .nota { font-size: 9pt; color: #666; margin-top: 18pt; }
  .salto { page-break-after: always; }
`

const md = readFileSync(MANUAL, 'utf8')
const { html, usadas } = convertir(md)

const doc = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Manual de usuario — Space OS</title>
<style>${ESTILO}</style></head>
<body>${portada(usadas)}${html}</body></html>`

mkdirSync(dirname(HTML_TRABAJO), { recursive: true })
writeFileSync(HTML_TRABAJO, doc, 'utf8')

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
// `file://` y esperar a la carga de las imágenes: con networkidle Chromium a
// veces imprime antes de que los PNG estén decodificados y salen huecos.
await pagina.goto(`file:///${HTML_TRABAJO.replace(/\\/g, '/')}`, { waitUntil: 'load' })
await pagina.evaluate(async () => {
  await Promise.all(
    Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))),
  )
})
await pagina.pdf({
  path: SALIDA,
  format: 'Letter',
  printBackground: true,
  margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#888;padding:0 2cm;display:flex;justify-content:space-between;">' +
    '<span>Manual de usuario · Space OS</span>' +
    '<span class="pageNumber"></span></div>',
})
await navegador.close()

const faltan = UBICACION.filter((u) => !usadas.has(u.img)).map((u) => u.img)
console.log(`PDF: ${SALIDA}`)
console.log(`Imágenes insertadas: ${usadas.size} de ${UBICACION.length}`)
if (faltan.length) console.log(`Sin imagen (ver capturas-pendientes.md):\n  ${faltan.join('\n  ')}`)
