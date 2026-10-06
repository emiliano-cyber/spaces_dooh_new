#!/usr/bin/env node
// ============================================================================
//  scripts/verificar-novedades.mjs — No se publica una version sin sus notas.
// ----------------------------------------------------------------------------
//  Uso:
//    node scripts/verificar-novedades.mjs <version> [--archivo <ruta>]
//
//  Lo corre `release.yml` al principio del job de pruebas, con el nombre del
//  tag. Sale con:
//    0  la version tiene su entrada y el archivo entero es valido
//    1  falta la entrada, o el archivo no se puede leer, no es JSON o no es
//       valido
//    2  error de USO: sin version, o una version que no es vX.Y.Z[-sufijo]
//
//  POR QUE VALIDA EL ARCHIVO ENTERO y no solo busca la entrada: una release
//  con un `novedades.json` invalido llegaria a la imagen, y la aplicacion
//  -que valida con las MISMAS reglas- lo descartaria entero en silencio: el
//  cliente se quedaria sin dialogo y sin pagina de Novedades. Aqui todavia se
//  puede arreglar con un commit; en la instancia, ya no.
//
//  Una precandidata (`v0.9.2-rc1`) pasa con la entrada de `v0.9.2`: las notas
//  son de la version, no de cada ensayo antes de publicarla.
//
//  Sin dependencias: corre ANTES del `npm ci`, con el node a pelo del runner.
//  Por eso las reglas vienen de `apps/web/lib/novedades-reglas.mjs`, que es
//  JavaScript sin nada que compilar (ver su cabecera).
// ============================================================================

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarNovedades, notasDe, versionBase } from '../apps/web/lib/novedades-reglas.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const POR_OMISION = join(RAIZ, 'apps', 'web', 'novedades.json')

function fallar(codigo, mensaje) {
  // `::error::` lo pinta GitHub Actions como anotacion del run; fuera del CI
  // es solo un prefijo legible.
  console.error(`::error::${mensaje}`)
  process.exit(codigo)
}

const args = process.argv.slice(2)
let ruta = POR_OMISION
const i = args.indexOf('--archivo')
if (i !== -1) {
  ruta = args[i + 1]
  args.splice(i, 2)
}
const version = args[0]

if (!version || !versionBase(version)) {
  fallar(2, `Uso: node scripts/verificar-novedades.mjs <vX.Y.Z> [--archivo <ruta>]. Version recibida: ${JSON.stringify(version ?? null)}`)
}

// Relativa al repo si esta dentro (`apps/web/novedades.json`, que es lo que
// alguien busca en su editor); absoluta si no.
const rel = relative(RAIZ, ruta)
const mostrada = rel && !rel.startsWith('..') ? rel.split('\\').join('/') : ruta

let texto
try {
  texto = readFileSync(ruta, 'utf8')
} catch (e) {
  fallar(1, `No se pudo leer ${mostrada} (${e.code ?? e.message}). Cada release necesita sus notas de version.`)
}

let datos
try {
  datos = JSON.parse(texto)
} catch (e) {
  fallar(1, `${mostrada} no es JSON valido: ${e.message}`)
}

const r = validarNovedades(datos)
if (!r.ok) {
  fallar(1, `${mostrada} no es valido:\n  · ${r.errores.join('\n  · ')}`)
}

const entrada = notasDe(version, r.novedades)
if (!entrada) {
  const base = versionBase(version)
  fallar(
    1,
    `La version ${version} no tiene notas en ${mostrada}. Antes de publicarla, añade arriba del todo una entrada ` +
      `{ "version": "${base}", "fecha": "AAAA-MM-DD", "items": [{ "tipo": "NUEVO" | "AJUSTADO" | "CORREGIDO", "texto": "..." }] } ` +
      'que cuente al cliente que cambia, en el mismo PR que el cambio.',
  )
}

console.log(`Notas de ${version}: ${entrada.items.length} item(s) en ${mostrada} (entrada ${entrada.version}, ${entrada.fecha}).`)
