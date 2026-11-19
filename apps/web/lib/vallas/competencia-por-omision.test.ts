import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORIAS_COMPETENCIA_POR_OMISION } from './competencia-por-omision'
import { normalizarMarca } from './reglas/competencia-marcas'

// ============================================================================
//  VALLAS · las categorías de competencia que trae cada organización (decisión
//  del dueño del 19/11). La lista vive DOS veces —aquí, para las altas nuevas,
//  y en la migración, para las organizaciones que ya existían— y esta prueba es
//  la que impide que diverjan.
// ============================================================================

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261119_vallas_sembrar_competencia_por_omision.sql')

/** Saca de la migración los pares `('Nombre', array['M1','M2'])`. */
function listaDeLaMigracion(): { nombre: string; marcas: string[] }[] {
  const sql = readFileSync(MIGRACION, 'utf8')
  const lit = `'((?:[^']|'')*)'`
  const re = new RegExp(String.raw`\(\s*${lit}\s*,\s*array\[([^\]]*)\]\s*\)`, 'g')
  const des = (s: string) => s.replace(/''/g, "'")
  return [...sql.matchAll(re)].map((m) => ({
    nombre: des(m[1]),
    marcas: [...m[2].matchAll(new RegExp(lit, 'g'))].map((x) => des(x[1])),
  }))
}

describe('categorías de competencia por omisión', () => {
  it('trae las doce categorías que propuso el dueño, empezando por las colas', () => {
    expect(CATEGORIAS_COMPETENCIA_POR_OMISION.map((c) => c.nombre)).toEqual([
      'Refrescos de cola',
      'Tiendas departamentales',
      'Telefonía',
      'Bancos',
      'Cerveza',
      'Comida rápida',
      'Pizzas',
      'Autoservicio',
      'Tiendas de conveniencia',
      'Automotriz',
      'Streaming',
      'Aerolíneas',
    ])
    expect(CATEGORIAS_COMPETENCIA_POR_OMISION[0].marcas).toEqual(['Coca-Cola', 'Pepsi'])
  })

  it('cada categoría tiene al menos dos marcas (si no, no compite nadie) y nombres únicos', () => {
    for (const c of CATEGORIAS_COMPETENCIA_POR_OMISION) expect(c.marcas.length, c.nombre).toBeGreaterThanOrEqual(2)
    const nombres = CATEGORIAS_COMPETENCIA_POR_OMISION.map((c) => c.nombre.toLowerCase())
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('ninguna marca está en dos categorías ni repetida (comparando normalizado)', () => {
    const todas = CATEGORIAS_COMPETENCIA_POR_OMISION.flatMap((c) => c.marcas.map(normalizarMarca))
    expect(new Set(todas).size).toBe(todas.length)
  })

  it('caben en los límites de la tabla y de la pantalla (120 caracteres, 100 marcas)', () => {
    for (const c of CATEGORIAS_COMPETENCIA_POR_OMISION) {
      expect(c.nombre.length).toBeLessThanOrEqual(120)
      expect(c.marcas.length).toBeLessThanOrEqual(100)
      for (const m of c.marcas) expect(m.length).toBeLessThanOrEqual(120)
    }
  })

  it('la migración siembra EXACTAMENTE la misma lista, en el mismo orden', () => {
    expect(listaDeLaMigracion()).toEqual(CATEGORIAS_COMPETENCIA_POR_OMISION.map((c) => ({ nombre: c.nombre, marcas: [...c.marcas] })))
  })
})
