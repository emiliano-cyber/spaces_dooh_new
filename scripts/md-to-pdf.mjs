// Convertidor Markdown → HTML acotado + impresión a PDF con Edge headless.
// Uso: node scripts/md-to-pdf.mjs <entrada.md> <salida.pdf>
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('uso: node scripts/md-to-pdf.mjs <entrada.md> <salida.pdf>')
  process.exit(1)
}

const baseDir = dirname(resolve(inPath))
// Resuelve la ruta de una imagen a file:// absoluto (relativa al .md de entrada).
function resolveSrc(src) {
  if (/^(https?:|file:|data:)/i.test(src)) return src
  return 'file:///' + resolve(baseDir, src).replace(/\\/g, '/')
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Inline: imágenes, enlaces, wikilinks, `código`, **negrita**, *cursiva*.
//
// El ORDEN importa y no es intercambiable:
//   1. imágenes ANTES que enlaces — `![alt](src)` también encaja en el patrón
//      de enlace, y al revés una imagen saldría como <a> con el `!` suelto.
//   2. wikilinks ANTES que cursiva, para que un `[[a|b]]` no se coma nada.
//   3. negrita ANTES que cursiva — si no, `**x**` se lee como dos cursivas
//      vacías alrededor de `x`.
// La cursiva excluye `<` y `>` a propósito: cuando en un renglón hay dos
// `<code>*</code>` (el asterisco como MARCA, no como énfasis), un patrón
// permisivo los uniría y se tragaría el texto de en medio.
function inline(s) {
  let t = esc(s)
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => `<img src="${resolveSrc(src)}" alt="${alt}" />`)
  // Wikilinks de Obsidian. En un PDF no hay bóveda que abrir, así que se
  // imprime el texto —el alias si lo trae— sin el corchete doble, que fuera de
  // Obsidian es ruido.
  t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, destino, alias) =>
    (alias ?? destino.split('/').pop()))
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, href) => `<a href="${href}">${txt}</a>`)
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\*([^*<>\n]+)\*/g, '<em>$1</em>')
  return t
}

// Ancla al estilo GitHub, para que el índice del documento salte de verdad
// dentro del PDF. Se calcula sobre el texto SIN marcado: el `**` de un título
// en negrita no forma parte de su ancla.
function slug(texto) {
  return texto
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .trim()
    .replace(/ /g, '-')
}

const md = readFileSync(inPath, 'utf8').split(/\r?\n/)
const out = []
let i = 0

// Frontmatter YAML. Sin esto, el `---` de apertura sale como línea horizontal y
// los metadatos de la nota (tipo, tags, la lista de `archivos:`) se imprimen
// como párrafos sueltos en la primera página — que es justo lo que nadie
// necesita leer de un manual.
if (md[0]?.trim() === '---') {
  let j = 1
  while (j < md.length && md[j].trim() !== '---') j++
  if (j < md.length) i = j + 1
}

function flushTable(rows) {
  // rows: array de líneas "| a | b |"
  const parse = (line) =>
    line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const head = parse(rows[0])
  const body = rows.slice(2).map(parse) // rows[1] es el separador ---
  let h = '<table><thead><tr>'
  for (const c of head) h += `<th>${inline(c)}</th>`
  h += '</tr></thead><tbody>'
  for (const r of body) {
    h += '<tr>'
    for (const c of r) h += `<td>${inline(c)}</td>`
    h += '</tr>'
  }
  h += '</tbody></table>'
  out.push(h)
}

while (i < md.length) {
  const line = md[i]

  // Bloque de código
  if (line.startsWith('```')) {
    const buf = []
    i++
    while (i < md.length && !md[i].startsWith('```')) buf.push(esc(md[i++]))
    i++ // cierre
    out.push(`<pre><code>${buf.join('\n')}</code></pre>`)
    continue
  }

  // Tabla
  if (line.trim().startsWith('|') && md[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(md[i + 1])) {
    const rows = []
    while (i < md.length && md[i].trim().startsWith('|')) rows.push(md[i++].trim())
    flushTable(rows)
    continue
  }

  // Encabezados
  const h = line.match(/^(#{1,6})\s+(.*)$/)
  if (h) {
    const lvl = h[1].length
    out.push(`<h${lvl} id="${slug(h[2])}">${inline(h[2])}</h${lvl}>`)
    i++
    continue
  }

  // Regla horizontal
  if (/^---+\s*$/.test(line)) {
    out.push('<hr/>')
    i++
    continue
  }

  // Cita, y su caso particular: los CALLOUTS de Obsidian (`> [!warning] Título`).
  //
  // Las líneas se unen con espacio y NO con <br/>: el salto del .md es donde
  // terminó el renglón al escribir a 80 columnas, no donde el autor quiso
  // cortar. Conservarlo dejaba párrafos con el borde derecho mordido. Lo que sí
  // separa de verdad es la línea `>` vacía, que abre párrafo nuevo.
  if (line.startsWith('>')) {
    const crudas = []
    while (i < md.length && md[i].startsWith('>')) crudas.push(md[i++].replace(/^>\s?/, ''))

    let tipo = null
    let titulo = null
    const cabecera = crudas[0]?.match(/^\[!(\w+)\]\s*(.*)$/)
    if (cabecera) {
      tipo = cabecera[1].toLowerCase()
      titulo = cabecera[2].trim()
      crudas.shift()
    }

    const parrafos = []
    let acc = []
    for (const l of crudas) {
      if (l.trim() === '') {
        if (acc.length) parrafos.push(acc.join(' '))
        acc = []
      } else acc.push(l)
    }
    if (acc.length) parrafos.push(acc.join(' '))

    const cuerpo = parrafos.map((p) => `<p>${inline(p)}</p>`).join('')
    if (tipo) {
      const enc = titulo ? `<p class="callout-titulo">${inline(titulo)}</p>` : ''
      out.push(`<blockquote class="callout callout-${tipo}">${enc}${cuerpo}</blockquote>`)
    } else {
      out.push(`<blockquote>${cuerpo}</blockquote>`)
    }
    continue
  }

  // Lista numerada. Va ANTES de la de viñetas y del párrafo: sin esto, un
  // "1. Escribe tu correo" caía en el caso párrafo y los pasos de un
  // procedimiento se imprimían como prosa corrida, que es justo lo que un
  // manual no puede permitirse.
  if (/^\s*\d+[.)]\s+/.test(line)) {
    const buf = []
    while (i < md.length && /^\s*\d+[.)]\s+/.test(md[i])) {
      const partes = [md[i++].replace(/^\s*\d+[.)]\s+/, '')]
      // Continuación indentada del mismo punto.
      while (i < md.length && /^\s{3,}\S/.test(md[i]) && !/^\s*\d+[.)]\s+/.test(md[i]) && !/^\s*[-*]\s+/.test(md[i])) {
        partes.push(md[i++].trim())
      }
      buf.push(`<li>${inline(partes.join(' '))}</li>`)
    }
    out.push(`<ol>${buf.join('')}</ol>`)
    continue
  }

  // Lista de viñetas. Las sub-viñetas (indentadas) se anidan en su propia <ul>
  // para que no queden al mismo nivel que su punto padre.
  if (/^\s*[-*]\s+/.test(line)) {
    const buf = []
    while (i < md.length && (/^\s*[-*]\s+/.test(md[i]) || /^\s{3,}\S/.test(md[i]))) {
      if (/^\s{2,}[-*]\s+/.test(md[i])) {
        const sub = []
        while (i < md.length && /^\s{2,}[-*]\s+/.test(md[i])) {
          const partes = [md[i++].replace(/^\s*[-*]\s+/, '')]
          while (i < md.length && /^\s{5,}\S/.test(md[i]) && !/^\s*[-*]\s+/.test(md[i])) partes.push(md[i++].trim())
          sub.push(`<li>${inline(partes.join(' '))}</li>`)
        }
        buf.push(`<ul>${sub.join('')}</ul>`)
        continue
      }
      if (!/^\s*[-*]\s+/.test(md[i])) { i++; continue }
      const partes = [md[i++].replace(/^\s*[-*]\s+/, '')]
      while (i < md.length && /^\s{3,}\S/.test(md[i]) && !/^\s*[-*]\s+/.test(md[i])) partes.push(md[i++].trim())
      buf.push(`<li>${inline(partes.join(' '))}</li>`)
    }
    out.push(`<ul>${buf.join('')}</ul>`)
    continue
  }

  // Línea en blanco
  if (line.trim() === '') {
    i++
    continue
  }

  // Párrafo. La primera línea se consume SIEMPRE; el guard solo decide hasta
  // dónde sigue el párrafo.
  //
  // Consumirla incondicionalmente no es cosmético: si el guard se aplicara
  // también a ella, una línea que llega hasta aquí empezando por uno de esos
  // caracteres —un backtick suelto al inicio de un renglón, un `|` sin fila
  // separadora debajo— no entraría en el bucle, `buf` quedaría vacío, `i` no
  // avanzaría y el bucle principal no terminaría nunca. No falla con un error:
  // acumula `<p></p>` hasta agotar la memoria del proceso.
  const buf = [inline(md[i++])]
  while (
    i < md.length &&
    md[i].trim() !== '' &&
    !/^[#>|`]/.test(md[i]) &&
    !/^\s*[-*]\s+/.test(md[i]) &&
    !/^\s*\d+[.)]\s+/.test(md[i]) &&
    !/^---+\s*$/.test(md[i])
  ) {
    buf.push(inline(md[i++]))
  }
  out.push(`<p>${buf.join(' ')}</p>`)
}

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1d21; font-size: 11.5px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #0a4fcc; }
  h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13.5px; margin: 16px 0 4px; color: #0a4fcc; }
  h4 { font-size: 12px; margin: 12px 0 4px; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 20px; padding: 0; }
  li { margin: 2px 0; }
  li > ul, li > ol { margin: 2px 0 2px 16px; }
  a { color: #0a4fcc; text-decoration: none; }
  em { font-style: italic; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  blockquote { margin: 10px 0; padding: 8px 12px; background: #f7f8fa; border-left: 3px solid #0a66ff; color: #444; font-size: 11px; }
  blockquote p { margin: 4px 0; }
  blockquote p:first-child { margin-top: 0; }
  blockquote p:last-child { margin-bottom: 0; }
  /* Callouts de Obsidian. El color es la única señal de jerarquía que sobrevive
     a la impresión: danger es "esto rompe algo", warning "esto te va a frenar",
     important una regla del producto, y note/tip/info un apunte.
     Sin acentos graves aquí dentro: este bloque vive en una plantilla de
     JavaScript y un solo acento grave la cierra a media hoja de estilos. */
  .callout-titulo { font-weight: 600; color: #1a1d21; }
  .callout-danger    { border-left-color: #dc2626; background: #fef4f3; }
  .callout-warning   { border-left-color: #f59e0b; background: #fffaf0; }
  .callout-important { border-left-color: #7c3aed; background: #f8f5ff; }
  .callout-note, .callout-tip, .callout-info { border-left-color: #0a66ff; background: #f5f8ff; }
  /* Un encabezado no puede quedarse solo al pie de una página, y una fila de
     tabla no debe partirse a la mitad. */
  h1, h2, h3, h4 { break-after: avoid-page; }
  tr, blockquote, li { break-inside: avoid-page; }
  code { font-family: ui-monospace, Consolas, monospace; background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; }
  pre { background: #f7f8fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 10px; line-height: 1.45; }
  img { max-width: 100%; height: auto; display: block; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10.5px; }
  th, td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f3f5; font-weight: 600; }
  tr:nth-child(even) td { background: #fafbfc; }
  strong { font-weight: 600; }
</style></head><body>${out.join('\n')}</body></html>`

const tmpHtml = join(tmpdir(), `report-${process.pid}.html`)
writeFileSync(tmpHtml, html, 'utf8')

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
execFileSync(edge, [
  '--headless',
  '--disable-gpu',
  `--print-to-pdf=${outPath}`,
  '--no-pdf-header-footer',
  `file:///${tmpHtml.replace(/\\/g, '/')}`,
], { stdio: 'inherit' })

console.log('PDF:', outPath)
