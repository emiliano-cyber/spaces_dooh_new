import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  R2 · El reporte NO devuelve filas de otra organización — y la prueba falla
//  si alguien quita el `and tenant_id`.
// ----------------------------------------------------------------------------
//  Esta prueba lee el CÓDIGO FUENTE de `reportes-repo.ts` y comprueba que cada
//  consulta lleva su filtro explícito por `tenant_id`. Se hace así, y no con una
//  base de datos, por dos razones:
//
//   1. `vitest.config.ts` no monta Postgres a propósito: si estas
//      comprobaciones vivieran en las e2e, `npm test` no las vería y el guard
//      solo existiría los días en que alguien corre el arnés completo.
//   2. **Las pruebas unitarias no ven los fallos de RLS**: simulan la base. Los
//      dos peores fallos de aislamiento de este repo pasaron las unitarias sin
//      despeinarse. Lo que sí se puede comprobar sin base es que el filtro
//      ESTÉ ESCRITO, que es exactamente lo que falló las dos veces (`qRaw`
//      donde tocaba `q`, y la consulta sin `and tenant_id`).
//
//  Es el mismo patrón que `lib/rbac-coherencia.test.ts`, que lee los
//  `exigir(...)` reales de las rutas: valida la mitad que vive en el repo. La
//  otra mitad —que la RLS corte de verdad con el rol de la aplicación— la
//  verifica `aislamiento.e2e.test.ts`, que NO se toca.
// ============================================================================

const RUTA_REPO = join(__dirname, 'reportes-repo.ts')

// El guard mira CÓDIGO, no prosa. Los comentarios de este repo son largos y
// citan `qRaw`, `select *` y nombres de columnas para explicar por qué NO se
// usan; sin quitarlos, el propio comentario que advierte del peligro pondría
// esta prueba en rojo — y la forma fácil de arreglarlo sería borrar la
// advertencia, que es exactamente lo que no debe pasar.
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

const FUENTE = sinComentarios(readFileSync(RUTA_REPO, 'utf8'))

// Los literales SQL del archivo: todo lo que va entre acentos graves y contiene
// un `select`. No se parsea TypeScript: lo que se busca es el texto de la
// consulta, y una consulta de este repo siempre es una plantilla.
function consultas(fuente: string): string[] {
  const out: string[] = []
  for (const m of fuente.matchAll(/`([^`]*)`/g)) {
    if (/\bselect\b/i.test(m[1])) out.push(m[1])
  }
  return out
}

describe('reportes-repo — aislamiento por tenant', () => {
  it('hay consultas que revisar (si no, esta prueba no prueba nada)', () => {
    // Control positivo. Sin él, borrar el archivo o reescribir las consultas de
    // otra forma dejaría este guard en verde sin mirar nada — que es peor que
    // no tenerlo.
    expect(consultas(FUENTE).length).toBeGreaterThanOrEqual(4)
  })

  it('TODA consulta filtra por tenant_id de forma parametrizada', () => {
    for (const sql of consultas(FUENTE)) {
      const unaLinea = sql.replace(/\s+/g, ' ').trim()
      expect(
        /tenant_id\s*=\s*\$\d/.test(unaLinea),
        `esta consulta no filtra por tenant_id:\n${unaLinea}`,
      ).toBe(true)
    }
  })

  it('NO usa qRaw: qRaw no fija app.tenant_id y la RLS no corta', () => {
    // El modo de fallo de `qRaw` donde tocaba `q` no da error: devuelve cero
    // filas en silencio, o las de otra empresa. Ya pasó dos veces en este repo.
    expect(FUENTE).not.toMatch(/\bqRaw1?\b/)
  })

  it('ninguna consulta interpola: ni un ${...} dentro del SQL', () => {
    // Si `dimension` o `granularidad` acabaran dentro de un `group by` por
    // interpolación, el enum del controller sería la ÚNICA defensa. Aquí se
    // comprueba que no haya siquiera por dónde.
    for (const sql of consultas(FUENTE)) {
      expect(sql, `consulta con interpolacion:\n${sql}`).not.toMatch(/\$\{/)
    }
  })

  it('el rango de fechas viaja como parametro, no pegado al SQL', () => {
    // Un `between '2026-01-01'` escrito en el texto significaría que la fecha
    // del usuario se concatenó en algún punto.
    for (const sql of consultas(FUENTE)) {
      expect(sql, `fecha literal en el SQL:\n${sql}`).not.toMatch(/'\d{4}-\d{2}-\d{2}'/)
    }
  })
})

describe('el SQL y el motor puro no pueden divergir', () => {
  // El `where` del repo decide qué OT LLEGAN; `fechaDeOt()` en
  // `lib/data/reportes.ts` decide en qué periodo CAEN. Si las dos prelaciones de
  // fecha difirieran, una OT quedaría fuera del reporte sin aparecer en ningún
  // periodo y SIN DAR ERROR. Dos implementaciones de la misma regla divergen:
  // este repo lo documenta como su error de raíz (`lib/server/tenant.ts:87-89`).
  const PURO = sinComentarios(readFileSync(join(__dirname, '..', 'data', 'reportes.ts'), 'utf8'))

  it('la prelacion de fechas de una OT es la MISMA en el SQL y en fechaDeOt', () => {
    const enSql = /coalesce\(\s*fecha_completada\s*,\s*fecha_programada\s*,\s*creado_en\s*\)/.test(
      FUENTE.replace(/\s+/g, ' '),
    )
    const enPuro =
      /o\.fechaCompletada\s*\?\?\s*o\.fechaProgramada\s*\?\?\s*o\.creadoEn/.test(PURO)
    expect(enSql, 'el SQL no usa coalesce(fecha_completada, fecha_programada, creado_en)').toBe(true)
    expect(enPuro, 'fechaDeOt no usa fechaCompletada ?? fechaProgramada ?? creadoEn').toBe(true)
  })

  it('el repo NO reimplementa la atribucion de renta: la importa de derive', () => {
    // Si el repo calculara la renta atribuida por su cuenta, el reporte y el
    // dashboard darian dos costos distintos para la misma pantalla.
    expect(FUENTE).not.toMatch(/carasPredio|rentaAMensual|factorMensual/)
    expect(PURO).toMatch(/from '\.\/derive'/)
    expect(PURO).toMatch(/rentaAtribuidaPorSitio/)
  })
})

describe('las rutas de reportes exigen finanzas, no dashboard', () => {
  // Un reporte de rentabilidad es DINERO. Con `dashboard` lo vería cualquier rol
  // que pueda abrir el tablero, y el margen por pantalla —lo que se gana y lo
  // que se paga a cada arrendador— no es un indicador de vitrina.
  const DIR = join(__dirname, '..', '..', 'app', 'api', 'reportes')

  function rutas(dir: string): string[] {
    const out: string[] = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) out.push(...rutas(p))
      else if (e.name === 'route.ts') out.push(p)
    }
    return out
  }

  it('cada route.ts de /api/reportes exige finanzas', () => {
    const encontradas = rutas(DIR)
    expect(encontradas.length).toBeGreaterThan(0)
    for (const r of encontradas) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src, `${r} no exige finanzas`).toMatch(/exigir\(\s*'finanzas'\s*,\s*'ver'\s*\)/)
      expect(src, `${r} exige dashboard: un reporte de dinero no es vitrina`).not.toMatch(/'dashboard'/)
    }
  })

  it('cada route.ts de /api/reportes declara runtime nodejs y force-dynamic', () => {
    for (const r of rutas(DIR)) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src).toMatch(/export const runtime = 'nodejs'/)
      expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
    }
  })

  it('el SQL NO vive en el route: el route no importa db.ts', () => {
    for (const r of rutas(DIR)) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src, `${r} importa db.ts: el SQL vive en el repo`).not.toMatch(/from '@\/lib\/server\/db'/)
      expect(src).not.toMatch(/\bselect\b/i)
    }
  })
})
