// ============================================================================
//  Arma el manual de usuario ilustrado en PDF.
//
//  Correr (desde la raíz del repo):
//    node manuales/armar-pdf.mjs
//    CAPTURAS_ENTORNO='…' CAPTURAS_FECHA=AAAA-MM-DD node manuales/armar-pdf.mjs
//
//  Toma el manual vigente del vault y lo imprime con Playwright —el mismo que
//  toma las capturas, para no meter otra herramienta al proyecto—.
//
//  ─── Por qué ya no hay un mapa de «qué imagen va en qué paso» ─────────────
//  El armador de agosto llevaba aquí una tabla `UBICACION` (imagen → sección y
//  paso) e insertaba las fotos al construir el HTML. Desde septiembre las
//  imágenes viven DENTRO del manual, debajo del paso que ilustran, con su pie
//  (`![…](capturas-2026-09-18/…png)` + `*Captura — …*`). Una tabla aquí sería
//  una segunda copia de ese vínculo, y dos copias divergen: el manual es la
//  única fuente, y este script solo lo traduce.
//
//  NO modifica el manual. Lo lee y construye un HTML de trabajo
//  (`manuales/manual-ilustrado.html`), con rutas RELATIVAS a las imágenes para
//  que no lleve quemada la ruta de ninguna máquina.
//
//  Si una imagen citada no existe en disco, no se inventa un hueco: se omite y
//  se cuenta en la portada. `## Relacionadas` y `## PENDIENTES` no van al PDF:
//  son trabajo interno de quien redacta, no instrucciones para quien usa.
//
//  El PDF NO se versiona (`.gitignore`, «Ningún PDF se versiona», 2026-09-03):
//  sale en `manuales/` y se reparte a mano.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..')

const MANUAL = resolve(RAIZ, 'vault/08-Manuales/manual-usuario-2026-09-18.md')
const DIR_MANUAL = dirname(MANUAL)
const HTML_TRABAJO = resolve(RAIZ, 'manuales/manual-ilustrado.html')

// Fecha LOCAL, no UTC: `toISOString()` da el día siguiente al caer la tarde en
// México, y el PDF saldría fechado mañana. La fecha de las capturas es un dato
// del documento —dice si las imágenes siguen vigentes—, así que es la del día
// de quien las tomó, y se puede fijar a mano si el PDF se arma otro día.
const HOY = (() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()
const FECHA_CAPTURAS = process.env.CAPTURAS_FECHA ?? HOY
const SALIDA = resolve(RAIZ, `manuales/manual-usuario-${HOY}.pdf`)
const ENTORNO =
  process.env.CAPTURAS_ENTORNO ??
  'Pruebas LOCAL (next build + next start en localhost), base de demostración desechable'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Marcas de línea del subconjunto que usa este manual.
function enLinea(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(«—])\*([^*\s][^*]*?)\*(?=$|[\s.,;:)»—])/g, '$1<em>$2</em>')
    .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => `<em>${b ?? a}</em>`)
}

// ── Conversión del manual a HTML ────────────────────────────────────────────
//
// Convertidor a medida: encabezados, párrafos, listas (con imágenes y pies
// DENTRO del paso, sangrados), tablas, avisos de Obsidian, citas y bloques de
// código. No pretende ser un Markdown general: meter una dependencia nueva por
// este puñado de construcciones no compensa.
function convertir(md) {
  const imagenes = { citadas: 0, incluidas: 0, faltan: [] }
  const cuerpo = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const L = cuerpo.split(/\r?\n/)
  const out = []

  let lista = null // 'ol' | 'ul'
  let itemAbierto = false
  let parrafo = []
  let enTabla = false

  const cerrarParrafo = () => {
    if (parrafo.length) { out.push(`<p>${enLinea(parrafo.join(' '))}</p>`); parrafo = [] }
  }
  const cerrarItem = () => { if (itemAbierto) { out.push('</li>'); itemAbierto = false } }
  const cerrarLista = () => { cerrarItem(); if (lista) { out.push(`</${lista}>`); lista = null } }
  const cerrarTabla = () => { if (enTabla) { out.push('</tbody></table>'); enTabla = false } }
  const cerrarTodo = () => { cerrarParrafo(); cerrarTabla(); cerrarLista() }

  // Una figura: la imagen y, si la sigue, su pie en cursiva (una o varias líneas).
  const figura = (i, alt, ruta) => {
    imagenes.citadas++
    let pie = ''
    let j = i + 1
    if (j < L.length && /^\s*\*Captura/.test(L[j])) {
      const trozos = []
      while (j < L.length && L[j].trim() !== '') {
        trozos.push(L[j].trim())
        if (/\*\s*$/.test(L[j]) && trozos.length) { j++; break }
        j++
      }
      pie = trozos.join(' ').replace(/^\*/, '').replace(/\*$/, '')
    } else {
      j = i + 1
    }
    const abs = resolve(DIR_MANUAL, ruta)
    if (!existsSync(abs)) {
      imagenes.faltan.push(ruta)
      return { html: '', siguiente: j }
    }
    imagenes.incluidas++
    const src = relative(dirname(HTML_TRABAJO), abs).replace(/\\/g, '/')
    return {
      html:
        `<figure><img src="${esc(src)}" alt="${esc(alt)}">` +
        (pie ? `<figcaption>${enLinea(pie)}</figcaption>` : '') +
        '</figure>',
      siguiente: j,
    }
  }

  for (let i = 0; i < L.length; i++) {
    const l = L[i]

    if (/^##\s+(PENDIENTES|Relacionadas)\s*$/.test(l)) break

    // Bloque de código.
    if (/^\s*```/.test(l)) {
      cerrarParrafo(); cerrarTabla()
      const cod = []
      while (++i < L.length && !/^\s*```/.test(L[i])) cod.push(L[i])
      out.push(`<pre><code>${esc(cod.join('\n'))}</code></pre>`)
      continue
    }

    // Imagen, suelta o sangrada dentro de un paso.
    let m = l.match(/^(\s*)!\[([^\]]*)\]\(([^)]+)\)\s*$/)
    if (m) {
      cerrarParrafo(); cerrarTabla()
      const dentro = m[1].length >= 2 && itemAbierto
      if (!dentro) cerrarLista()
      const f = figura(i, m[2], m[3])
      out.push(f.html)
      i = f.siguiente - 1
      continue
    }

    // Encabezados.
    m = l.match(/^(#{1,4})\s+(.*)$/)
    if (m) {
      cerrarTodo()
      out.push(`<h${m[1].length}>${enLinea(m[2].trim())}</h${m[1].length}>`)
      continue
    }

    // Avisos de Obsidian (> [!tipo] …) y citas normales (> …).
    if (/^>/.test(l)) {
      cerrarTodo()
      const a = l.match(/^>\s*\[!(\w+)\]\s*(.*)$/)
      // En Obsidian la primera línea de un aviso es su TÍTULO. Va aparte y en
      // negrita: pegada al cuerpo se leía «…vigente Los manuales…».
      const titulo = a ? a[2].trim() : ''
      const lineas = a ? [] : [l.replace(/^>\s?/, '')]
      while (i + 1 < L.length && /^>/.test(L[i + 1])) lineas.push(L[++i].replace(/^>\s?/, ''))
      // Las notas «Captura: …» son instrucciones para quien ilustra. La imagen
      // ya está debajo del paso: dejarlas sería decir «aquí va una captura» al
      // lado de la captura.
      if (a && /^Captura:/i.test(titulo)) continue
      // Dentro del aviso, los párrafos se separan por líneas `>` vacías.
      const parrafos = lineas.join('\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      const html = parrafos
        .map((p) => {
          const ls = p.split('\n')
          if (ls.every((x) => /^(\d+\.|[-*])\s+/.test(x) || /^\s{2,}/.test(x))) {
            const ord = /^\d+\./.test(ls[0])
            const items = []
            for (const x of ls) {
              if (/^(\d+\.|[-*])\s+/.test(x)) items.push(x.replace(/^(\d+\.|[-*])\s+/, ''))
              else items[items.length - 1] += ' ' + x.trim()
            }
            return `<${ord ? 'ol' : 'ul'}>${items.map((t) => `<li>${enLinea(t)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`
          }
          return `<p>${enLinea(ls.join(' '))}</p>`
        })
        .join('')
      out.push(
        a
          ? `<div class="aviso aviso-${a[1].toLowerCase()}">` +
              (titulo ? `<p class="aviso-titulo">${enLinea(titulo)}</p>` : '') +
              `${html}</div>`
          : `<blockquote>${html}</blockquote>`,
      )
      continue
    }

    // Tablas.
    if (/^\|/.test(l)) {
      cerrarParrafo(); cerrarLista()
      if (/^[\s|:-]+$/.test(l)) continue
      const celdas = l.split('|').slice(1, -1).map((c) => c.trim())
      if (!enTabla) {
        out.push('<table><thead><tr>' + celdas.map((c) => `<th>${enLinea(c)}</th>`).join('') + '</tr></thead><tbody>')
        enTabla = true
      } else {
        out.push('<tr>' + celdas.map((c) => `<td>${enLinea(c)}</td>`).join('') + '</tr>')
      }
      continue
    }
    cerrarTabla()

    // Listas: el paso queda ABIERTO para que la imagen sangrada que lo sigue
    // caiga dentro de él y no suelta al final de la lista.
    m = l.match(/^(\d+)\.\s+(.*)$/) || l.match(/^([-*])\s+(.*)$/)
    if (m) {
      cerrarParrafo()
      const tipo = /\d/.test(m[1]) ? 'ol' : 'ul'
      if (lista !== tipo) { cerrarLista(); out.push(tipo === 'ol' ? `<ol start="${m[1]}">` : '<ul>'); lista = tipo }
      cerrarItem()
      let texto = m[2]
      while (i + 1 < L.length && /^\s{2,}\S/.test(L[i + 1]) && !/^\s*!\[/.test(L[i + 1]) && !/^\s*\*Captura/.test(L[i + 1])) {
        texto += ' ' + L[++i].trim()
      }
      out.push(`<li>${enLinea(texto)}`)
      itemAbierto = true
      continue
    }

    if (l.trim() === '') {
      cerrarParrafo()
      // Una línea en blanco no cierra la lista si lo siguiente sigue dentro de
      // ella (otro paso, o algo sangrado bajo el paso).
      let k = i + 1
      while (k < L.length && L[k].trim() === '') k++
      const sigue = k < L.length && (/^\s{2,}\S/.test(L[k]) || /^(\d+\.|[-*])\s+/.test(L[k]))
      if (!sigue) cerrarLista()
      continue
    }

    // Texto sangrado bajo un paso abierto: se queda dentro del paso.
    // Las líneas seguidas forman UN párrafo: partirlas dejaba sin cerrar una
    // cursiva que cruzaba de una línea a otra, y salían los asteriscos.
    if (itemAbierto && /^\s{2,}\S/.test(l)) {
      const trozos = [l.trim()]
      while (i + 1 < L.length && /^\s{2,}\S/.test(L[i + 1]) && !/^\s*!\[/.test(L[i + 1]) && !/^\s*\*Captura/.test(L[i + 1])) {
        trozos.push(L[++i].trim())
      }
      out.push(`<p>${enLinea(trozos.join(' '))}</p>`)
      continue
    }

    cerrarLista()
    parrafo.push(l.trim())
  }
  cerrarTodo()
  return { html: out.join('\n'), imagenes }
}

// ── Portada: la nota de fecha y entorno ─────────────────────────────────────
function portada(img) {
  return `
<section class="portada">
  <h1 class="titulo">Manual de usuario</h1>
  <p class="sub">SPACE OS · lo que entró en septiembre de 2026</p>

  <div class="ficha">
    <div class="fila"><span>Capturas tomadas el</span><strong>${esc(FECHA_CAPTURAS)}</strong></div>
    <div class="fila"><span>Entorno de las capturas</span><strong>${esc(ENTORNO)}</strong></div>
    <div class="fila"><span>Imágenes incluidas</span><strong>${img.incluidas} de ${img.citadas} citadas en el manual</strong></div>
    <div class="fila"><span>Manual de origen</span><strong>vault/08-Manuales/manual-usuario-2026-09-18.md</strong></div>
    <div class="fila"><span>PDF armado el</span><strong>${esc(HOY)}</strong></div>
  </div>

  <div class="aviso aviso-info">
    <p><strong>Las imágenes son de una base de demostración, no de tu instalación.</strong>
    Los nombres de empresas, pantallas, correos (terminados en <code>.invalid</code>) y RFC
    (empiezan por <code>DMO</code>) son inventados. Si un botón se llama distinto en tu
    instalación, manda lo que ves en tu instalación.</p>
  </div>

  <div class="aviso aviso-warning">
    <p><strong>Dos estados se prepararon a mano en la instalación local.</strong> La
    <strong>versión nueva disponible</strong> del apartado 6 (en una instalación real la escribe
    el actualizador del servidor al encontrarla en el registro; las versiones v0.7.0 y v0.8.0
    son de ejemplo, y aprobarla no instaló nada) y las <strong>dos campañas listas para
    facturar</strong> del apartado 4.2. Cada captura afectada lo dice en su pie.</p>
    <p><strong>Un paso no tiene imagen:</strong> la primera entrada con Google (1.1), que no se
    puede reproducir en local. El motivo está en <code>manuales/capturas-pendientes.md</code>.</p>
  </div>

  <p class="nota">
    Las imágenes envejecen. Si la aplicación cambió después de la fecha de arriba, vuelve a
    generarlas: <code>manuales/capturas-2026-09-18.spec.ts</code> las rehace todas y
    <code>node manuales/armar-pdf.mjs</code> arma este PDF otra vez.
  </p>
</section>
<div class="salto"></div>`
}

const ESTILO = `
  @page { size: Letter; margin: 2cm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; font-size: 10.5pt; line-height: 1.5; margin: 0;
  }
  h1, h2, h3, h4 { line-height: 1.25; page-break-after: avoid; }
  h1 { font-size: 21pt; margin: 0 0 6pt; }
  h2 { font-size: 15pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 1.5px solid #d8d8d8; }
  h3 { font-size: 12.5pt; margin: 16pt 0 5pt; }
  h4 { font-size: 11pt; margin: 12pt 0 4pt; }
  p { margin: 0 0 7pt; }
  ol, ul { margin: 0 0 9pt; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  li > p { margin-top: 4pt; }
  code { font-family: Consolas, "SF Mono", monospace; font-size: 8.8pt; background: #f2f2f0; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f5f5f3; padding: 7pt 9pt; border-radius: 4px; font-size: 8.5pt; white-space: pre-wrap; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; font-size: 9pt; page-break-inside: avoid; }
  th, td { border: 1px solid #dcdcdc; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f5f5f3; font-weight: 600; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3px solid #ccc; color: #444; }

  /* Las capturas, nunca partidas entre dos páginas: media captura no ilustra nada. */
  figure { margin: 8pt 0 12pt; page-break-inside: avoid; }
  figure img { display: block; max-width: 100%; max-height: 17cm; height: auto; border: 1px solid #d5d5d5; border-radius: 4px; }
  figcaption { font-size: 8.5pt; color: #555; margin-top: 4pt; padding-left: 6pt; border-left: 2.5px solid #c9c9c9; }

  .aviso { margin: 8pt 0; padding: 7pt 10pt; border-radius: 4px; border-left: 3px solid #999; background: #f7f7f5; font-size: 9.5pt; page-break-inside: avoid; }
  .aviso p:last-child, .aviso ol:last-child, .aviso ul:last-child { margin-bottom: 0; }
  .aviso-titulo { font-weight: 700; margin-bottom: 4pt; }
  .aviso-warning { border-left-color: #d97706; background: #fff8ed; }
  .aviso-danger  { border-left-color: #dc2626; background: #fef2f2; }
  .aviso-info    { border-left-color: #2563eb; background: #eff5ff; }
  .aviso-success { border-left-color: #16a34a; background: #f0fdf4; }
  .aviso-important { border-left-color: #7c3aed; background: #f5f3ff; }
  .aviso-note, .aviso-tip { border-left-color: #6b7280; background: #f6f7f8; }

  .portada { padding-top: 40pt; }
  .portada .titulo { font-size: 30pt; margin-bottom: 2pt; }
  .portada .sub { font-size: 12pt; color: #666; margin-bottom: 26pt; }
  .ficha { margin-bottom: 20pt; }
  .ficha .fila { display: flex; justify-content: space-between; gap: 16pt; border-bottom: 1px solid #e6e6e6; padding: 6pt 0; font-size: 10pt; }
  .ficha .fila span { color: #666; white-space: nowrap; }
  .ficha .fila strong { text-align: right; }
  .nota { font-size: 9pt; color: #666; margin-top: 18pt; }
  .salto { page-break-after: always; }
`

const md = readFileSync(MANUAL, 'utf8')
const { html, imagenes } = convertir(md)

const doc = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Manual de usuario — SPACE OS</title>
<style>${ESTILO}</style></head>
<body>${portada(imagenes)}${html}</body></html>`

mkdirSync(dirname(HTML_TRABAJO), { recursive: true })
writeFileSync(HTML_TRABAJO, doc, 'utf8')

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
await pagina.goto(pathToFileURL(HTML_TRABAJO).href, { waitUntil: 'load' })
// Esperar a que TODAS las imágenes estén decodificadas: con solo `load`,
// Chromium a veces imprime antes y salen huecos.
const rotas = await pagina.evaluate(async () => {
  await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))))
  return Array.from(document.images).filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'))
})
if (rotas.length) {
  await navegador.close()
  throw new Error(`Imágenes que el navegador no pudo cargar:\n  ${rotas.join('\n  ')}`)
}
await pagina.pdf({
  path: SALIDA,
  format: 'Letter',
  printBackground: true,
  margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#888;padding:0 2cm;display:flex;justify-content:space-between;">' +
    `<span>Manual de usuario · SPACE OS · capturas del ${FECHA_CAPTURAS}</span>` +
    '<span class="pageNumber"></span></div>',
})
await navegador.close()

console.log(`PDF: ${SALIDA}`)
console.log(`Imágenes incluidas: ${imagenes.incluidas} de ${imagenes.citadas} citadas`)
if (imagenes.faltan.length) console.log(`Citadas y sin archivo:\n  ${imagenes.faltan.join('\n  ')}`)
