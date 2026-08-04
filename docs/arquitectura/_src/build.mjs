// Ensambla docs/arquitectura/arquitectura.json y arquitectura.html a partir de
// las piezas de _src/. Deriva dependencias/dependientes de las aristas para que
// no haya que mantenerlas a mano en dos sitios.
//   node docs/arquitectura/_src/build.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))
const OUT = join(SRC, '..')
const leer = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'))

const { project } = leer('01-project.json')
const nodes = [
  ...leer('02-nodes-a.json'),
  ...leer('02-nodes-b.json'),
  ...leer('02-nodes-c.json'),
  ...leer('02-nodes-d.json'),
]
const edges = leer('03-edges.json')
const flows = [...leer('04-flows-a.json'), ...leer('04-flows-b.json')]
const cat = leer('05-catalogos.json')

// ─── Integridad ─────────────────────────────────────────────────────────────
const ids = new Set(nodes.map((n) => n.id))
const problemas = []
if (ids.size !== nodes.length) problemas.push('hay ids de nodo repetidos')
for (const e of edges) {
  if (!ids.has(e.from)) problemas.push(`arista con origen inexistente: ${e.from} -> ${e.to}`)
  if (!ids.has(e.to)) problemas.push(`arista con destino inexistente: ${e.from} -> ${e.to}`)
}
const capas = new Set(project.capas.map((c) => c.id))
for (const n of nodes) if (!capas.has(n.capa)) problemas.push(`nodo ${n.id} con capa desconocida: ${n.capa}`)
for (const f of flows) {
  for (const c of f.componentes ?? []) if (!ids.has(c)) problemas.push(`flujo ${f.id}: componente inexistente ${c}`)
  for (const p of f.pasos ?? []) if (!ids.has(p.nodo)) problemas.push(`flujo ${f.id} paso ${p.n}: nodo inexistente ${p.nodo}`)
}
if (problemas.length) {
  console.error('Integridad:\n - ' + problemas.join('\n - '))
  process.exit(1)
}

// ─── Derivar dependencias / dependientes ────────────────────────────────────
for (const n of nodes) {
  n.dependencias = edges
    .filter((e) => e.from === n.id)
    .map((e) => ({ nodo: e.to, tipo: e.tipo, etiqueta: e.etiqueta ?? null }))
  n.dependientes = edges
    .filter((e) => e.to === n.id)
    .map((e) => ({ nodo: e.from, tipo: e.tipo, etiqueta: e.etiqueta ?? null }))
  n.flujos = flows
    .filter((f) => (f.componentes ?? []).includes(n.id) || (f.pasos ?? []).some((p) => p.nodo === n.id))
    .map((f) => f.id)
}

const doc = {
  $schema: 'https://space-os.local/esquemas/arquitectura-1.json',
  generado: { herramienta: 'docs/arquitectura/_src/build.mjs', version: 1 },
  project,
  nodes,
  edges,
  flows,
  modules: cat.modules,
  services: cat.services,
  apis: cat.apis,
  database: cat.database,
  events: cat.events,
  jobs: cat.jobs,
  files: cat.files,
}

writeFileSync(join(OUT, 'arquitectura.json'), JSON.stringify(doc, null, 2) + '\n', 'utf8')

// ─── HTML autocontenido ─────────────────────────────────────────────────────
// El JSON se inserta en un <script type="application/json">: hay que neutralizar
// cualquier "</script>" y los separadores de línea U+2028/U+2029, que rompen el
// parseo en navegadores antiguos.
const SEP = new RegExp('[\\u2028\\u2029]', 'g')
const compacto = JSON.stringify(doc)
  .replace(/<\/script/gi, '<\\/script')
  .replace(SEP, (c) => '\\u' + c.charCodeAt(0).toString(16))

const html = readFileSync(join(SRC, 'template.html'), 'utf8').replace('__DATA__', () => compacto)
writeFileSync(join(OUT, 'arquitectura.html'), html, 'utf8')

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(0) + ' KB'
console.log(`arquitectura.json  ${nodes.length} nodos - ${edges.length} aristas - ${flows.length} flujos`)
console.log(`arquitectura.html  ${kb(html)} (autocontenido, sin dependencias externas)`)
