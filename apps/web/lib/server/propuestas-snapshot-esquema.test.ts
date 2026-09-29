import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  El snapshot dice DE QUÉ FORMA es
// ----------------------------------------------------------------------------
//  `snapshot_economico` es JSON libre y se le han ido añadiendo capas: franja y
//  temporada (Fase 1), volumen (Fase 2), código promocional (Fase 3) y el
//  PAQUETE CERRADO (Fase 4, que es la que sube la forma a 3). Y hasta
//  hoy **nada en el dato decía qué forma tenía**: un snapshot de julio y uno de
//  hoy solo se distinguen por qué campos les faltan, que es adivinar.
//
//  El campo `version` que ya llevaba NO sirve para esto: es la revisión de la
//  PROPUESTA —sube al renegociar con el cliente— y nada tiene que ver con la
//  forma del JSON. Dos cosas distintas con el mismo nombre es como se lee mal.
//
//  Se añade ahora y no cuando haga falta, y el motivo es aritmético: un snapshot
//  ya congelado NO se puede reescribir (`propuestas-repo.ts:211`), así que el día
//  que un lector necesite distinguir «viejo» de «nuevo» ya no habrá forma de
//  marcarlo hacia atrás. Cuesta una línea hoy y una migración de lectura después.
//
//  La convención, y es la que hace que esto sirva de algo:
//      `esquema` ausente  →  forma 1 (todo lo congelado antes del 2026-09-28)
//      `esquema: 2`       →  lleva franja, temporada, volumen y código
//      `esquema: 3`       →  y además PUEDE llevar paquete cerrado — y con él,
//                            `porSitio[].neto` YA NO deriva de `porSitio[].lista`
//
//  Ese último renglón es el que obligó a subirla, y no el hecho de añadir
//  campos: las formas 1 y 2 garantizaban que el neto de una pantalla salía de
//  multiplicar su lista por factores, y `lib/data/reportes.ts` vive de esa
//  garantía. Un paquete la rompe, así que un lector escrito para la forma 2 no
//  calcularía de menos: calcularía MAL. Cambiar una invariante ES cambiar la
//  forma, aunque todos los campos nuevos sean opcionales.
// ============================================================================

const repo = readFileSync(
  join(__dirname, 'propuestas-repo.ts'),
  'utf8',
).replace(/\r\n/g, '\n')

// Sin comentarios: una aserción sobre el fuente que casa con la prosa que
// EXPLICA el código no prueba nada. Ya pasó cinco veces esta semana.
const codigo = repo
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')

describe('el snapshot declara su forma', () => {
  it('escribe `esquema` con la forma vigente', () => {
    expect(codigo).toMatch(/esquema:\s*ESQUEMA_SNAPSHOT/)
  })

  it('la constante existe y vale 3 — la subió el paquete cerrado', () => {
    expect(codigo).toMatch(/const ESQUEMA_SNAPSHOT\s*=\s*3\b/)
  })

  // NEGATIVA, y es la que importa: `version` es la revisión de la propuesta.
  // Si alguien reutilizara ese campo para la forma del JSON, los dos
  // significados quedarían pegados y ya no se podrían separar.
  it('NO reutiliza `version` para decir la forma', () => {
    expect(codigo).toMatch(/version,\s*bruto/)
    expect(codigo).not.toMatch(/version:\s*ESQUEMA_SNAPSHOT/)
  })

  // NEGATIVA: el snapshot congelado es inmutable. Añadir un campo no puede
  // convertirse en una excusa para reescribir los que ya existen.
  it('sigue devolviendo el congelado sin tocarlo', () => {
    expect(codigo).toMatch(/if \(prop\.snapshot_economico\) return prop\.snapshot_economico/)
  })
})
