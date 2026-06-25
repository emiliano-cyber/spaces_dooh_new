// Convertidor Markdown → HTML acotado + impresión a PDF con Edge headless.
// Uso: node scripts/md-to-pdf.mjs <entrada.md> <salida.pdf>
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('uso: node scripts/md-to-pdf.mjs <entrada.md> <salida.pdf>')
  process.exit(1)
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Inline: **negrita**, `código`.
function inline(s) {
  let t = esc(s)
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return t
}

const md = readFileSync(inPath, 'utf8').split(/\r?\n/)
const out = []
let i = 0

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
    out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
    i++
    continue
  }

  // Regla horizontal
  if (/^---+\s*$/.test(line)) {
    out.push('<hr/>')
    i++
    continue
  }

  // Cita
  if (line.startsWith('>')) {
    const buf = []
    while (i < md.length && md[i].startsWith('>')) buf.push(inline(md[i++].replace(/^>\s?/, '')))
    out.push(`<blockquote>${buf.join('<br/>')}</blockquote>`)
    continue
  }

  // Lista
  if (/^\s*[-*]\s+/.test(line)) {
    const buf = []
    while (i < md.length && /^\s*[-*]\s+/.test(md[i])) {
      buf.push(`<li>${inline(md[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
      i++
    }
    out.push(`<ul>${buf.join('')}</ul>`)
    continue
  }

  // Línea en blanco
  if (line.trim() === '') {
    i++
    continue
  }

  // Párrafo
  const buf = []
  while (i < md.length && md[i].trim() !== '' && !/^[#>|`]/.test(md[i]) && !/^\s*[-*]\s+/.test(md[i]) && !/^---+\s*$/.test(md[i])) {
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
  ul { margin: 6px 0 6px 18px; padding: 0; }
  li { margin: 2px 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  blockquote { margin: 10px 0; padding: 8px 12px; background: #f7f8fa; border-left: 3px solid #0a66ff; color: #444; font-size: 11px; }
  code { font-family: ui-monospace, Consolas, monospace; background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; }
  pre { background: #f7f8fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 10px; line-height: 1.45; }
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
