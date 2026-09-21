#!/usr/bin/env node
// ============================================================================
//  recuentos.mjs — mide de una vez las cifras que la documentación afirma.
// ----------------------------------------------------------------------------
//  Existe porque `CLAUDE.md` ha tenido las MISMAS SEIS CIFRAS MAL TRES VECES:
//  del 10/08 al 28/08, otra vez al 18/09, y una tercera **dentro de la misma
//  rama que acababa de corregirlas** — se arreglaron a mano en un commit y el
//  siguiente añadió cuatro `route.ts` y dos migraciones.
//
//  La lección no es «acuérdate de actualizarlas». Es que una cifra que se
//  mantiene a mano en un repositorio que crece **caduca en el commit
//  siguiente**. Lo único que lo arregla es que medirlas cueste un comando.
//
//    node scripts/recuentos.mjs
//
//  Y la propiedad que importa: se mide SOBRE EL ÁRBOL DONDE SE CORRE. Cada
//  worktree está en una rama distinta y da un número distinto, así que córrelo
//  donde vayas a escribir la cifra.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function archivos(dir, filtro, acc = []) {
  for (const e of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(raiz, rel)).isDirectory()) archivos(rel, filtro, acc)
    else if (filtro(e, rel)) acc.push(rel)
  }
  return acc
}

const leer = (rel) => readFileSync(join(raiz, rel), 'utf8')

// ─── Endpoints ───────────────────────────────────────────────────────────────
const endpoints = archivos('apps/web/app/api', (e) => e === 'route.ts').length

// ─── Migraciones y tablas ────────────────────────────────────────────────────
const migraciones = readdirSync(join(raiz, 'db/migrations')).filter((f) => f.endsWith('.sql'))
const CREA_TABLA = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi
const tablas = new Set()
for (const f of ['db/schema.sql', ...migraciones.map((m) => `db/migrations/${m}`)]) {
  for (const m of leer(f).matchAll(CREA_TABLA)) tablas.add(m[1])
}

// ─── ADR ─────────────────────────────────────────────────────────────────────
const adr = readdirSync(join(raiz, 'docs/adr')).filter((f) => f.endsWith('.md')).sort()

// ─── Bóveda: notas, enlaces, rotos y huérfanas ───────────────────────────────
const notasRel = archivos('vault', (e) => e.endsWith('.md'))
const nombres = new Set(notasRel.map((r) => r.split('/').pop().slice(0, -3)))
let enlaces = 0
const destinos = new Set()
for (const rel of notasRel) {
  for (const m of leer(rel).matchAll(/\[\[([^\]|#]+)/g)) {
    enlaces++
    destinos.add(m[1].trim().split('/').pop())
  }
}
const rotos = [...destinos].filter((d) => !nombres.has(d))
const huerfanas = [...nombres].filter((n) => !destinos.has(n))

// ─── Salida ──────────────────────────────────────────────────────────────────
const linea = (k, v) => console.log(`  ${k.padEnd(24)} ${v}`)
console.log(`\nMedido sobre ${raiz}\n`)
linea('endpoints', endpoints)
linea('tablas', tablas.size)
linea('migraciones', migraciones.length)
linea('ADR', `${adr.length}  (hasta ${adr[adr.length - 1].slice(0, 4)})`)
linea('notas de boveda', notasRel.length)
linea('enlaces internos', enlaces)
linea('wikilinks rotos', `${rotos.length}${rotos.length ? '  ' + rotos.join(', ') : ''}`)
linea('notas huerfanas', `${huerfanas.length}${huerfanas.length ? '  ' + huerfanas.join(', ') : ''}`)
console.log(`
  Las pruebas NO salen de aqui: se miden corriendolas.
      cd apps/web && npm test
      cd apps/web && npm run build && npm run test:e2e
`)
