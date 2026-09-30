import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  OT-CHECK-01 · R2 · la escritura de UN punto del checklist está acotada por
//  tenant y por id, y NO toca el estado de la OT ni su dinero.
// ----------------------------------------------------------------------------
//  Mismo patrón que `ot-repo.costo-aislamiento.test.ts`, y por sus mismas
//  razones: con la RLS activa, quitar el `and tenant_id` no cambia nada que una
//  e2e pueda ver —la RLS ya corta—, así que la segunda capa solo se defiende
//  comprobando que ESTÁ ESCRITA. Y `npm test` no monta Postgres.
//
//  Las dos comprobaciones de abajo del todo son las del pedido del dueño
//  (2026-09-30): marcar un punto **no cierra ni cambia de estado la OT por sí
//  solo** —hoy no lo hace, y el autoguardado no debe empezar a hacerlo— y **no
//  toca el costo real**, que es dinero con su propia ruta y su propio candado.
// ============================================================================

const RUTA = join(__dirname, 'ot-repo.ts')

// Normaliza CRLF ANTES de mirar (la lección de `reportes-repo.aislamiento`).
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

const FUENTE = sinComentarios(readFileSync(RUTA, 'utf8'))

// El SQL es multilínea: se toma cada literal entre comillas invertidas y se
// queda el que escribe el checklist punto a punto (`jsonb_set` sobre la
// columna). Se busca por lo que HACE y no por el nombre de la función: si la
// escritura se muda, el guard la sigue.
const LITERALES = FUENTE.match(/`[^`]*`/g) ?? []
const ESCRITURAS = LITERALES.filter(
  (s) => /\bupdate\s+ordenes_trabajo\b/i.test(s) && /jsonb_set\s*\(\s*checklist\b/i.test(s),
)

describe('ot-repo · marcar un punto del checklist', () => {
  it('hay exactamente UNA escritura punto a punto que revisar', () => {
    expect(ESCRITURAS.length).toBe(1)
  })

  it('lleva `and tenant_id = $n` PARAMETRIZADO, además de la RLS', () => {
    for (const sql of ESCRITURAS) expect(sql, sql).toMatch(/and\s+tenant_id\s*=\s*\$\d+/)
  })

  it('y acota por `id`, para no marcar el punto en TODAS las OT del tenant', () => {
    for (const sql of ESCRITURAS) expect(sql, sql).toMatch(/where\s+id\s*=\s*\$\d+/)
  })

  it('NEGATIVO · no se cuela un comodín del tipo `$2 = $2` ni un `or true`', () => {
    for (const sql of ESCRITURAS) {
      expect(sql, sql).not.toMatch(/\$\d+\s*=\s*\$\d+/)
      expect(sql, sql).not.toMatch(/\bor\s+true\b/i)
    }
  })

  it('es UN solo `update` atómico, sin leer antes y escribir después', () => {
    // Un select + update en dos viajes deja una carrera: dos clics rápidos
    // sobre puntos distintos leen el mismo checklist y el segundo pisa al
    // primero. `jsonb_set` dentro del `update` cambia solo ESE punto con la
    // fila bloqueada por el propio update.
    for (const sql of ESCRITURAS) expect(sql, sql).toMatch(/set\s+checklist\s*=\s*jsonb_set\s*\(\s*checklist\b/i)
  })

  it('NEGATIVO · no cambia el estado de la OT ni sus fechas', () => {
    for (const sql of ESCRITURAS) {
      const set = sql.split(/\bwhere\b/i)[0]
      expect(set, sql).not.toMatch(/\bestatus\b/i)
      expect(set, sql).not.toMatch(/\bfecha_(inicio|completada)\b/i)
      expect(set, sql).not.toMatch(/\basignado_a\b/i)
    }
  })

  it('NEGATIVO · no toca el costo real (dinero, con su propia ruta y candado)', () => {
    for (const sql of ESCRITURAS) expect(sql, sql).not.toMatch(/costo_real/i)
  })
})
