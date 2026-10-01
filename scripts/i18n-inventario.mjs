#!/usr/bin/env node
// ============================================================================
//  scripts/i18n-inventario.mjs — CUANTO FALTA POR TRADUCIR, CONTADO.
// ----------------------------------------------------------------------------
//  I18N-01 (2026-09-30) dejo el andamio puesto y UNA pantalla traducida de
//  punta a punta. Este script existe para que el resto se pueda REPARTIR en
//  lotes en vez de estimarse a ojo.
//
//  Recorre `apps/web` y cuenta, por archivo, los textos EN ESPANOL que un
//  usuario ve y que todavia no pasan por el diccionario.
//
//  ─── COMO CUENTA, Y POR QUE ASI ────────────────────────────────────────────
//
//  Busca tres formas, que son las tres por las que el texto llega a la
//  pantalla en este repositorio:
//
//    1. NODOS DE TEXTO JSX ..... `>Guardar cambios<`
//    2. ATRIBUTOS VISIBLES ..... `placeholder="Ej. 8000"`, `label="Renta"`,
//                                `title=`, `aria-label=`, `alt=`
//    3. LITERALES SOSPECHOSOS .. cadenas con una palabra acentuada o con dos
//                                palabras españolas seguidas (mensajes de
//                                error, opciones de un `select`, etiquetas)
//
//  ─── ES UNA ESTIMACION, Y SE DICE ──────────────────────────────────────────
//
//  No es un analizador de TypeScript: es un recuento por expresiones
//  regulares, asi que tiene falsos positivos (un comentario en español que se
//  cuele, una clase de CSS con una palabra) y falsos negativos (texto armado
//  concatenando variables). Sirve para REPARTIR el trabajo —saber que
//  `reportes/` pesa diez veces mas que `imprenta/`— y NO para declarar una
//  pantalla terminada. Eso lo dice una prueba que la rinde en los dos idiomas,
//  como `lib/i18n/pantallas.test.ts`.
//
//  Uso:
//    node scripts/i18n-inventario.mjs           # resumen por carpeta
//    node scripts/i18n-inventario.mjs --detalle # una linea por archivo
// ============================================================================
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web')
const PODAR = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git'])

// Lo que YA esta traducido: no se cuenta como pendiente.
const YA_HECHO = [
  'app/(app)/login/page.tsx',
  'components/demo/shell/Sidebar.tsx',
  'components/demo/ui/SelectorIdioma.tsx',
]

const ACENTOS = /[áéíóúñÁÉÍÓÚÑ¿¡]/
// Palabras funcionales del español. Dos de estas en una cadena es texto, no un
// identificador ni una clase de CSS.
const PALABRAS = /\b(el|la|los|las|un|una|de|del|con|sin|por|para|que|se|su|tu|no|si|al|en|y|o|es|son|hay|debe|puede|este|esta|todos|todas|nuevo|nueva)\b/gi

function fuentes(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (PODAR.has(e.name)) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) fuentes(abs, acc)
    else if (/\.tsx$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(abs)
  }
  return acc
}

// Quita comentarios para no contar la prosa de los comentarios de este repo,
// que es abundante y esta toda en español.
function sinComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

function esTextoEspanol(s) {
  const t = s.trim()
  if (t.length < 3) return false
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(t)) return false
  // Rutas, clases de CSS, identificadores y URL no son texto de pantalla.
  if (/^[a-z0-9_.-]+$/i.test(t)) return false
  if (/^[/#]/.test(t) || /^https?:/.test(t)) return false
  if (/^[a-z-]+(\s+[a-z0-9:[\]/-]+)+$/.test(t) && !ACENTOS.test(t)) return false // clases tailwind
  if (ACENTOS.test(t)) return true
  return (t.match(PALABRAS) ?? []).length >= 1 && /\s/.test(t)
}

function contar(archivo) {
  const crudo = readFileSync(archivo, 'utf8')
  const texto = sinComentarios(crudo)
  const encontrados = new Set()

  // 1 · nodos de texto JSX
  for (const m of texto.matchAll(/>([^<>{}\n]{3,120})</g)) {
    if (esTextoEspanol(m[1])) encontrados.add(m[1].trim())
  }
  // 2 · atributos visibles
  for (const m of texto.matchAll(
    /(?:placeholder|label|title|aria-label|alt|texto)=["']([^"']{3,160})["']/g,
  )) {
    if (esTextoEspanol(m[1])) encontrados.add(m[1].trim())
  }
  // 3 · literales sospechosos
  for (const m of texto.matchAll(/'([^'\\\n]{6,160})'|"([^"\\\n]{6,160})"/g)) {
    const v = m[1] ?? m[2]
    if (esTextoEspanol(v)) encontrados.add(v.trim())
  }
  return encontrados.size
}

const detalle = process.argv.includes('--detalle')
const filas = []
for (const abs of fuentes(RAIZ)) {
  const rel = path.relative(RAIZ, abs).replace(/\\/g, '/')
  const hecho = YA_HECHO.includes(rel)
  const n = contar(abs)
  if (n > 0 || hecho) filas.push({ rel, n: hecho ? 0 : n, hecho })
}

const pendientes = filas.filter((f) => !f.hecho && f.n > 0)
const total = pendientes.reduce((a, f) => a + f.n, 0)

// Agrupado por el primer tramo con sentido de la ruta.
const porGrupo = new Map()
for (const f of pendientes) {
  const p = f.rel.split('/')
  const g = p[0] === 'components' ? `components/${p[1] ?? ''}/${p[2] ?? ''}` : p.slice(0, 3).join('/')
  const prev = porGrupo.get(g) ?? { textos: 0, archivos: 0 }
  porGrupo.set(g, { textos: prev.textos + f.n, archivos: prev.archivos + 1 })
}

console.log('')
console.log('INVENTARIO DE TRADUCCION — apps/web')
console.log('='.repeat(72))
console.log(`Archivos .tsx con texto en espanol pendiente : ${pendientes.length}`)
console.log(`Textos distintos por traducir (estimado)     : ${total}`)
console.log(`Ya traducidos en I18N-01                     : ${YA_HECHO.length}`)
console.log('')

if (detalle) {
  console.log('POR ARCHIVO (mayor primero)')
  console.log('-'.repeat(72))
  for (const f of [...pendientes].sort((a, b) => b.n - a.n)) {
    console.log(String(f.n).padStart(5), f.rel)
  }
} else {
  console.log('POR AREA (mayor primero) — cada linea es un lote repartible')
  console.log('-'.repeat(72))
  const orden = [...porGrupo.entries()].sort((a, b) => b[1].textos - a[1].textos)
  for (const [g, v] of orden) {
    console.log(String(v.textos).padStart(5), `${String(v.archivos).padStart(3)} arch.`, g)
  }
  console.log('')
  console.log('Corre con --detalle para la lista archivo por archivo.')
}
console.log('')
