import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  R2 · La escritura del costo de una OT lleva su `and tenant_id`, y esta
//  prueba se pone roja si alguien lo quita.
// ----------------------------------------------------------------------------
//  Nació MATANDO MUTANTES, el 2026-09-29. El mutante que cambiaba
//
//      where id = $1 and tenant_id = $2
//  por  where id = $1 and $2 = $2
//
//  **SOBREVIVIÓ** con las 2571 unitarias en verde. No lo cazaba nada, y es
//  dinero que cambia el margen del reporte de OTRA organización.
//
//  ─── Por qué el guard lee el FUENTE y no usa una base ─────────────────────
//  Es el mismo patrón que `reportes-repo.aislamiento.test.ts`, y por sus mismas
//  dos razones:
//
//   1. `vitest.config.ts` no monta Postgres a propósito. Si esto viviera solo en
//      las e2e, `npm test` no lo vería y el guard existiría únicamente los días
//      en que alguien corre el arnés completo.
//   2. **Las unitarias no ven los fallos de RLS**: simulan la base. Lo que sí se
//      puede comprobar sin base es que el filtro ESTÉ ESCRITO, que es
//      exactamente lo que falló las dos veces que este repositorio ya pagó.
//
//  Y hay una razón más, propia de este caso: con la RLS activa, quitar el
//  `and tenant_id` **no cambia el comportamiento observable** —la RLS ya corta—,
//  así que ni siquiera una e2e contra Postgres real lo delataría. Eso es
//  precisamente lo que significa «segunda capa»: una defensa que no se nota
//  mientras la primera aguanta. Si no se comprueba que está escrita, se borra
//  sin que nada se queje y el día que la RLS falle no hay nada debajo.
// ============================================================================

const RUTA = join(__dirname, 'ot-repo.ts')

// Normaliza CRLF ANTES de mirar: `.` no cruza `\r` en JavaScript, así que sin
// esto los comentarios no se quitarían en un árbol con `core.autocrlf` y el
// guard se pondría rojo en todas las máquinas menos en la que lo escribió. Es
// la lección que `reportes-repo.aislamiento.test.ts` aprendió el 18/09.
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

const FUENTE = sinComentarios(readFileSync(RUTA, 'utf8'))

// El `update` que escribe el costo. Se busca por la COLUMNA y no por el nombre
// de la función: si alguien mueve la escritura a otra función, el guard tiene
// que seguirla en vez de quedarse en verde mirando a un sitio vacío.
const ESCRITURAS = FUENTE.split('\n').filter(
  (l) => /\bupdate\s+ordenes_trabajo\b/.test(l) && /costo_real/.test(l),
)

describe('ot-repo · la escritura del costo real está acotada por tenant', () => {
  it('hay exactamente UNA escritura de `costo_real` que revisar', () => {
    // Control positivo, y además cuenta: si aparecieran dos, una podría llevar
    // el filtro y la otra no, y un `some()` daría verde. Este repositorio ya
    // documenta el caso de mutar el literal equivocado por existir dos veces.
    expect(ESCRITURAS.length).toBe(1)
  })

  it('lleva `and tenant_id = $n` PARAMETRIZADO, además de la RLS', () => {
    for (const sql of ESCRITURAS) {
      expect(sql, sql).toMatch(/and\s+tenant_id\s*=\s*\$\d+/)
    }
  })

  it('NEGATIVO · no se cuela un comodín del tipo `$2 = $2`', () => {
    // El mutante exacto que sobrevivió. Un `and $2 = $2` es sintácticamente un
    // filtro y semánticamente nada — y deja pasar la prueba de arriba si esta
    // no existiera, porque `$2 = $2` no casa con `tenant_id = $n` pero un
    // `and tenant_id = $2 or true` sí sería otro modo de lo mismo.
    for (const sql of ESCRITURAS) {
      expect(sql, sql).not.toMatch(/\$\d+\s*=\s*\$\d+/)
      expect(sql, sql).not.toMatch(/\bor\s+true\b/i)
    }
  })

  it('y acota por `id`, para no reescribir el costo de TODAS las OT del tenant', () => {
    // Sin el `id`, un solo PATCH pondría el mismo importe en cada orden de la
    // organización. No da error y el reporte queda irreconocible.
    for (const sql of ESCRITURAS) {
      expect(sql, sql).toMatch(/where\s+id\s*=\s*\$\d+/)
    }
  })
})
