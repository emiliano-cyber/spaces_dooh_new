import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  R2 + R3 · La captura de consumos de luz: su migración y su aislamiento.
// ----------------------------------------------------------------------------
//  Dos guards que leen ARCHIVOS, por las mismas dos razones que
//  `reportes-repo.aislamiento.test.ts`:
//
//   1. `vitest.config.ts` no monta Postgres a propósito. Si esto viviera en las
//      e2e, `npm test` no lo vería y el guard solo existiría los días en que
//      alguien corre el arnés completo.
//   2. **Las pruebas unitarias no ven los fallos de RLS**: simulan la base. Lo
//      que sí se puede comprobar sin base es que el filtro ESTÉ ESCRITO y que
//      la migración DECLARE la política — que es exactamente lo que falló las
//      dos veces que este repo se comió un fallo de aislamiento (`qRaw` donde
//      tocaba `q`, y la consulta sin `and tenant_id`).
//
//  La otra mitad —que la RLS corte de verdad con el rol de la aplicación— solo
//  la puede ver una e2e con `poolApp()`, y está pendiente: ver la nota
//  `vault/02-Backend/energia-consumos.md`.
// ============================================================================

// Normaliza los finales de línea ANTES de mirar, y quita los comentarios.
//
// Las dos cosas son la lección del 2026-09-18 de `reportes-repo.aislamiento`:
// el `.` de una expresión regular de JavaScript NO cruza `\r`, así que `//.*$`
// no llega al final de una línea CRLF, el comentario no se quita y sobreviven
// **las propias advertencias que citan lo prohibido**. Verde en el árbol de
// quien lo escribió y rojo en CI y en el de todos los demás, con el arreglo
// fácil a la vista: borrar la advertencia. Un guard que solo funciona con un
// final de línea no es un guard.
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** El SQL sin sus comentarios de línea (`--`) ni sus bloques. */
function sqlSinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
}

const RAIZ = join(__dirname, '..', '..', '..', '..')
const RUTA_MIGRACION = join(RAIZ, 'db', 'migrations', '20260918_consumos_energia.sql')
const RUTA_ESQUEMA = join(RAIZ, 'db', 'schema.sql')

function leer(ruta: string): string {
  return existsSync(ruta) ? readFileSync(ruta, 'utf8') : ''
}

describe('la migracion de consumos_energia', () => {
  it('existe donde tiene que existir', () => {
    // Control positivo de todo el bloque: sin él, renombrar el archivo dejaría
    // los demás casos en verde sobre una cadena vacía, que es peor que no
    // tenerlos.
    expect(existsSync(RUTA_MIGRACION), `falta ${RUTA_MIGRACION}`).toBe(true)
  })

  it('es transaccional: begin y commit', () => {
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION))
    expect(sql).toMatch(/^\s*begin\s*;/im)
    expect(sql).toMatch(/\bcommit\s*;/i)
  })

  it('es IDEMPOTENTE: nada que falle al aplicarla dos veces', () => {
    // `update.sh` la aplica con el runner, pero una migración que solo funciona
    // la primera vez convierte cualquier reintento en una salida distinta de
    // cero y deja la instancia a medias.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION))
    expect(sql).toMatch(/create table if not exists consumos_energia/i)
    // Índices y política: `if not exists` y `drop ... if exists` antes de crear.
    for (const crear of sql.match(/create (unique )?index [^;]*/gi) ?? []) {
      expect(crear, `indice sin if not exists:\n${crear}`).toMatch(/if not exists/i)
    }
    expect(sql).toMatch(/drop policy if exists tenant_isolation on consumos_energia/i)
    for (const c of sql.match(/add constraint [^;]*/gi) ?? []) {
      // Cada `add constraint` necesita su `drop constraint if exists` delante.
      const nombre = /add constraint (\w+)/i.exec(c)?.[1]
      expect(nombre, `add constraint sin nombre:\n${c}`).toBeTruthy()
      expect(sql, `${nombre} se añade sin soltarlo antes`).toMatch(
        new RegExp(`drop constraint if exists ${nombre}`, 'i'),
      )
    }
  })

  it('tenant_id es NOT NULL y sin DEFAULT', () => {
    // El DEFAULT de `tenant_id` a RGB es una deriva que este repo ya midió y
    // retiró (`20260812_sin_default_tenant.sql`): una fila insertada sin
    // contexto de tenant acababa en otra organización SIN dar error.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION))
    expect(sql).toMatch(/tenant_id\s+uuid\s+not null/i)
    expect(sql, 'tenant_id con DEFAULT: la deriva que ya se retiro').not.toMatch(
      /tenant_id\s+uuid\s+not null\s+default/i,
    )
  })

  it('RLS fail-closed y FORCE, con el patron literal del repo', () => {
    // FORCE es lo que impide que el DUEÑO de la tabla se salte la política, y
    // fail-closed —comparar contra `nullif(current_setting(...),'')::uuid`— es
    // lo que hace que SIN contexto de tenant no se vea nada, en vez de verlo
    // todo. Patrón de `db/migrations/20260723_almacen.sql:47-60`.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION))
    expect(sql).toMatch(/alter table consumos_energia enable row level security/i)
    expect(sql).toMatch(/alter table consumos_energia force\s+row level security/i)
    expect(sql).toMatch(/create policy tenant_isolation on consumos_energia/i)
    // Las DOS mitades: `using` para leer y `with check` para escribir. Sin el
    // `with check`, una organización podría INSERTAR filas con el `tenant_id`
    // de otra y no verlas nunca — y el reporte de la otra sí.
    expect(sql).toMatch(/using\s*\(\s*tenant_id\s*=/i)
    expect(sql).toMatch(/with check\s*\(\s*tenant_id\s*=/i)
    expect(sql).toMatch(/nullif\(\s*current_setting\('app\.tenant_id',\s*true\)/i)
    // Fail-OPEN es el modo de fallo que no da error: la política del barrido
    // global de Hardening 1 llevaba un `or ... is null` para poder migrar, y
    // copiarlo aquí dejaría la tabla abierta sin contexto.
    expect(sql, 'politica fail-OPEN: sin tenant se veria todo').not.toMatch(
      /current_setting\('app\.tenant_id',\s*true\)\s*,?\s*''?\)?\s*is null/i,
    )
  })

  it('el mismo recibo no se puede capturar DOS VECES', () => {
    // Un recibo capturado dos veces DUPLICA el costo de la luz en el reporte y
    // no da ningún error: da un margen peor de lo que es. La clave lleva el
    // MEDIDOR dentro porque un predio puede tener más de uno — sin él, el
    // segundo medidor real sería imposible de capturar.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION)).replace(/\s+/g, ' ')
    const unicos = sql.match(/create unique index if not exists [^;]*/gi) ?? []
    expect(unicos.length, 'sin indice unico: el recibo duplicado entra').toBeGreaterThanOrEqual(1)
    const todos = unicos.join(' | ')
    expect(todos).toMatch(/tenant_id/i)
    expect(todos).toMatch(/periodo/i)
    expect(todos).toMatch(/medidor/i)
    // `medidor` es nullable (un predio con un solo medidor puede no tener el
    // número anotado) y en Postgres los NULL son DISTINTOS entre sí, así que un
    // índice sobre la columna a secas NO impediría dos filas con medidor nulo.
    // Se indexa `coalesce(medidor,'')` para no depender de la versión del motor.
    expect(todos, 'con medidor nullable el unico no corta: falta el coalesce').toMatch(
      /coalesce\(\s*medidor\s*,\s*''\s*\)/i,
    )
  })

  it('el anclaje es EXCLUYENTE: o predio, o pantalla suelta', () => {
    // El molde es `licencias` (`20260729_licencias_permisos.sql:41-58`). Sin el
    // CHECK, una fila con los DOS anclajes —o con ninguno— haría ambiguo a quién
    // se le reparte el consumo, y el reparto lo tiraría en silencio.
    //
    // Se admite la pantalla suelta porque `sitios.predio_id` es NULLABLE: hay
    // pantallas sin predio y su consumo no tendría dónde ir.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION)).replace(/\s+/g, ' ')
    expect(sql).toMatch(/predio_id\s+uuid references predios\(id\)/i)
    expect(sql).toMatch(/sitio_id\s+uuid references sitios\(id\)/i)
    expect(sql).toMatch(/\(\s*predio_id is not null\s*\)\s*<>\s*\(\s*sitio_id is not null\s*\)/i)
  })

  it('el periodo es MENSUAL: el dia 1, y lo dice la base', () => {
    // El recibo cubre un mes de calendario, y el motor lo reparte por los días
    // del mes al que pertenece. Una fila con `periodo = 2026-02-17` se
    // repartiría como si el mes empezara ese día: el CHECK lo impide en la base,
    // que es donde tiene que estar porque la tabla la puede escribir cualquiera.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION)).replace(/\s+/g, ' ')
    expect(sql).toMatch(/periodo\s+date\s+not null/i)
    expect(sql).toMatch(/extract\(\s*day from periodo\s*\)\s*=\s*1/i)
  })

  it('kWh e importe son NOT NULL y no admiten negativos', () => {
    // NOT NULL los dos, y es una decisión: un recibo de luz trae siempre las dos
    // cifras impresas. Con `kwh` nullable, una fila sumaría importe y no kWh, y
    // el costo por kWh de ese renglón saldría de dividir un importe completo
    // entre unos kWh incompletos — una cifra creíble y falsa. Es más barato no
    // admitir el dato a medias que manejarlo con cuidado en cinco sitios.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION)).replace(/\s+/g, ' ')
    expect(sql).toMatch(/kwh\s+numeric\([^)]*\)\s+not null/i)
    expect(sql).toMatch(/importe\s+numeric\([^)]*\)\s+not null/i)
    expect(sql).toMatch(/kwh\s*>=\s*0/i)
    expect(sql).toMatch(/importe\s*>=\s*0/i)
  })

  it('concede permisos al rol de la aplicacion, o falla a la vista', () => {
    // Sin GRANT la tabla queda inaccesible para la app y el sintoma es un error
    // de permisos en tiempo de peticion, no al migrar. El rol NO se escribe a
    // mano: en local es `spaces_app` y en produccion `spaces_user`.
    const sql = sqlSinComentarios(leer(RUTA_MIGRACION))
    expect(sql).toMatch(/grant select, insert, update, delete on consumos_energia/i)
    expect(sql).toMatch(/raise exception/i)
  })

  it('NO toca db/schema.sql', () => {
    // El esquema base no se edita a mano: los cambios van por migracion. Si la
    // tabla apareciera en los dos sitios, una base nueva y una migrada
    // divergirian sin que nada lo dijera.
    expect(leer(RUTA_ESQUEMA)).not.toMatch(/consumos_energia/)
  })
})

describe('energia-repo — aislamiento por tenant', () => {
  const RUTA_REPO = join(__dirname, 'energia-repo.ts')
  const FUENTE = sinComentarios(leer(RUTA_REPO))

  function consultas(fuente: string): string[] {
    const out: string[] = []
    for (const m of fuente.matchAll(/`([^`]*)`/g)) {
      if (/\b(select|insert|update|delete)\b/i.test(m[1])) out.push(m[1])
    }
    return out
  }

  it('hay consultas que revisar (si no, esta prueba no prueba nada)', () => {
    expect(existsSync(RUTA_REPO), `falta ${RUTA_REPO}`).toBe(true)
    expect(consultas(FUENTE).length).toBeGreaterThanOrEqual(3)
  })

  it('TODA consulta filtra por tenant_id de forma parametrizada', () => {
    // Segunda capa SOBRE la RLS. `entidad_id` NO es frontera de seguridad: la
    // única es `tenant_id`.
    for (const sql of consultas(FUENTE)) {
      const unaLinea = sql.replace(/\s+/g, ' ').trim()
      expect(
        /tenant_id\s*=\s*\$\d/.test(unaLinea),
        `esta consulta no filtra por tenant_id:\n${unaLinea}`,
      ).toBe(true)
    }
  })

  it('NO usa qRaw: qRaw no fija app.tenant_id y la RLS no corta', () => {
    // Su modo de fallo no da error: devuelve cero filas en silencio, o las de
    // otra empresa. Ya pasó dos veces en este repo.
    expect(FUENTE).not.toMatch(/\bqRaw1?\b/)
  })

  it('ninguna consulta interpola: ni un ${...} dentro del SQL', () => {
    for (const sql of consultas(FUENTE)) {
      expect(sql, `consulta con interpolacion:\n${sql}`).not.toMatch(/\$\{/)
    }
  })

  it('el rango de fechas viaja como parametro, no pegado al SQL', () => {
    for (const sql of consultas(FUENTE)) {
      expect(sql, `fecha literal en el SQL:\n${sql}`).not.toMatch(/'\d{4}-\d{2}-\d{2}'/)
    }
  })

  it('el DELETE lleva su and tenant_id, que es el que borra de mas', () => {
    // Un borrado por `id` sin `and tenant_id` es el caso más caro de los cuatro:
    // con un id adivinado o filtrado se borraría el recibo de otra organización,
    // y la RLS es la única defensa que quedaría.
    for (const sql of consultas(FUENTE)) {
      if (!/^\s*delete\b/i.test(sql.trim())) continue
      expect(sql.replace(/\s+/g, ' '), `delete sin tenant_id:\n${sql}`).toMatch(
        /tenant_id\s*=\s*\$\d/,
      )
    }
  })
})

describe('las rutas de /api/energia', () => {
  const DIR = join(__dirname, '..', '..', 'app', 'api', 'energia')

  function rutas(dir: string): string[] {
    if (!existsSync(dir)) return []
    const out: string[] = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) out.push(...rutas(p))
      else if (e.name === 'route.ts') out.push(p)
    }
    return out
  }

  it('hay rutas que revisar', () => {
    expect(rutas(DIR).length, `sin route.ts bajo ${DIR}`).toBeGreaterThan(0)
  })

  it('cada route.ts exige un permiso, y ninguna se queda abierta', () => {
    // La captura la hace OPERACIONES por decisión del dueño («la hace
    // operaciones»), así que el guard es `operaciones` y no `finanzas`. El
    // REPORTE que consume estos datos sigue exigiendo `finanzas.ver`: son dos
    // preguntas distintas —quién teclea el recibo y quién ve el margen— y por
    // eso son dos permisos.
    for (const r of rutas(DIR)) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src, `${r} no exige ningun permiso`).toMatch(/exigir\(\s*'operaciones'\s*,/)
    }
  })

  it('cada route.ts declara runtime nodejs y force-dynamic', () => {
    for (const r of rutas(DIR)) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src, r).toMatch(/export const runtime = 'nodejs'/)
      expect(src, r).toMatch(/export const dynamic = 'force-dynamic'/)
    }
  })

  it('el SQL NO vive en el route: el route no importa db.ts', () => {
    // Capas del repo: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`.
    for (const r of rutas(DIR)) {
      const src = sinComentarios(readFileSync(r, 'utf8'))
      expect(src, `${r} importa db.ts: el SQL vive en el repo`).not.toMatch(
        /from '@\/lib\/server\/db'/,
      )
      expect(src, r).not.toMatch(/\bselect\b/i)
    }
  })
})
