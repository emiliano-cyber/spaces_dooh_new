import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ordenar, tipoDeMigracion, ANTES_DE, tablasQueCrea, testigosDeHistoria } from './migrar.mjs'

// ============================================================================
//  La parte PURA del runner de migraciones: el orden y el tipo.
// ----------------------------------------------------------------------------
//  Son las dos decisiones que el runner toma ANTES de tocar la base, y las dos
//  que, si se equivocan, no dan error: aplican en un orden que no levanta, o se
//  saltan un archivo en silencio. Por eso se prueban aquí, sin Postgres.
//
//  Se corren desde `apps/web` (`npm test`): el include de
//  `apps/web/vitest.config.ts` alcanza `../../scripts/**/*.test.ts` a propósito.
//  Un fichero de pruebas que no corre nadie es peor que no tenerlo.
// ============================================================================

const DIR_MIGRACIONES = join(__dirname, '..', 'db', 'migrations')

describe('ordenar()', () => {
  it('respeta las dos excepciones reales del repo', () => {
    // El orden NO es lexicográfico puro, y no es un capricho:
    //   · `..._rls_todas_tablas` comprueba que `usuarios` ya tenga RLS+FORCE, y
    //     eso lo hace `..._usuarios_rls`, que por nombre va DESPUÉS (r < u).
    //   · `..._contrato_incompleto` USA el valor 'INCOMPLETO' del enum, y quien
    //     lo añade es `..._contrato_incompleto_enum`, que va después ('.' < '_').
    // En producción se aplicaron a mano en el orden bueno y el desorden nunca se
    // notó. Una base nueva sí lo nota: no levanta.
    const ordenados = ordenar([
      '20260720_hard1_rls_todas_tablas.sql',
      '20260720_hard1_usuarios_rls.sql',
      '20260727_contrato_incompleto.sql',
      '20260727_contrato_incompleto_enum.sql',
    ])
    expect(ordenados.indexOf('20260720_hard1_usuarios_rls.sql')).toBeLessThan(
      ordenados.indexOf('20260720_hard1_rls_todas_tablas.sql'),
    )
    expect(ordenados.indexOf('20260727_contrato_incompleto_enum.sql')).toBeLessThan(
      ordenados.indexOf('20260727_contrato_incompleto.sql'),
    )
  })

  it('sobre el directorio real mantiene las dos excepciones y no pierde archivos', () => {
    // Contra el directorio de verdad, no contra una lista escrita aquí: si
    // mañana entra una migración nueva, esta prueba la incluye sola.
    const archivos = readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith('.sql'))
    const ordenados = ordenar(archivos)
    expect(ordenados.length).toBe(archivos.length)
    expect([...ordenados].sort()).toEqual([...archivos].sort())
    for (const [primero, segundo] of Object.entries(ANTES_DE)) {
      expect(ordenados.indexOf(primero)).toBeLessThan(ordenados.indexOf(segundo))
    }
  })

  it('no muta el array que recibe', () => {
    // `ordenar()` la llaman el runner y el arnés de e2e sobre listas que luego
    // reusan. Un `sort()` in situ ahí es de los fallos que aparecen lejos.
    const entrada = ['20260720_hard1_rls_todas_tablas.sql', '20260720_hard1_usuarios_rls.sql']
    const copia = [...entrada]
    ordenar(entrada)
    expect(entrada).toEqual(copia)
  })

  it('el resto va en orden lexicográfico, que es el cronológico', () => {
    expect(ordenar(['20260810_b.sql', '20260625_a.sql', '20260729_c.sql'])).toEqual([
      '20260625_a.sql',
      '20260729_c.sql',
      '20260810_b.sql',
    ])
  })
})

describe('tipoDeMigracion()', () => {
  it('lee la CABECERA, no el cuerpo: la marca es la primera línea', () => {
    // La trampa concreta, y está en el repo: `20260812_schema_migrations.sql`
    // MENCIONA la cadena `-- @tipo: datos` en su prosa (`:44` y `:168`) para
    // explicar por qué deja fuera del backfill a la migración de datos. Un
    // filtro por «el archivo contiene @tipo: datos» daría esa migración por de
    // datos y se saltaría, en silencio, justo la que crea la tabla de registro.
    const datos = readFileSync(join(DIR_MIGRACIONES, '20260731_calendario_meses_cortos.sql'), 'utf8')
    const registro = readFileSync(join(DIR_MIGRACIONES, '20260812_schema_migrations.sql'), 'utf8')
    expect(datos).toMatch(/@tipo: *datos/)
    expect(registro).toMatch(/@tipo: *datos/) // la menciona, pero en prosa
    expect(tipoDeMigracion(datos)).toBe('datos')
    expect(tipoDeMigracion(registro)).toBe('esquema')
  })

  it('una migración sin marca es de esquema', () => {
    expect(tipoDeMigracion('alter table sitios add column if not exists x int;\n')).toBe('esquema')
  })

  it('acepta la marca con espacios y mayúsculas, como el grep del despliegue', () => {
    // `deploy.yml:141-148` usa `grep -qiE '^-- *@tipo: *datos'`. Mismo criterio,
    // para que runner y despliegue no discrepen sobre qué es una migración de
    // datos mientras los dos convivan.
    expect(tipoDeMigracion('--   @TIPO:  datos\nupdate x set y = 1;\n')).toBe('datos')
  })

  it('la marca en una línea que no es la primera NO cuenta', () => {
    expect(tipoDeMigracion('begin;\n-- @tipo: datos\ncommit;\n')).toBe('esquema')
  })
})

// ============================================================================
//  La señal que VERIFICA `--instalacion-nueva`.
// ----------------------------------------------------------------------------
//  La bandera afirma un hecho —«esta base acaba de nacer»— y hasta ahora nadie
//  comprobaba que fuera verdad en la dirección peligrosa: sobre el droplet de
//  hoy (historia aplicada a mano, sin registro) el runner se la creía y le
//  reaplicaba las 67 migraciones.
//
//  La señal se DERIVA del repositorio en vez de escribirse a mano: las tablas
//  que crean las migraciones y que `db/schema.sql` NO crea. Una instalación
//  recién nacida es rol de app + `schema.sql` y nada más, así que ninguna de
//  esas tablas puede existir en ella; si existe alguna, la base tiene historia.
//
//  Estas pruebas son el aviso de caducidad de esa señal. Si se derivara a cero
//  el runner se niega (fail-closed) y nadie se enteraría del porqué; aquí sí.
// ============================================================================

const RUTA_ESQUEMA = join(__dirname, '..', 'db', 'schema.sql')

function migracionesDelRepo() {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((archivo) => ({
      archivo,
      contenido: readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8'),
    }))
}

describe('tablasQueCrea()', () => {
  it('lee los `create table`, con o sin `if not exists` y con o sin `public.`', () => {
    const sql = [
      'create table usuarios (',
      'create table if not exists almacen_activos (',
      'CREATE TABLE public."comillada" (',
    ].join('\n')
    expect([...tablasQueCrea(sql)].sort()).toEqual(['almacen_activos', 'comillada', 'usuarios'])
  })

  it('no se traga un `create table` comentado ni un `drop table`', () => {
    // `20260812_schema_migrations.sql:234` lleva `--   drop table if exists
    // schema_migrations;` como rollback comentado. Un parser que lo contara
    // daría por testigo una tabla que ese archivo NO crea.
    const sql = '--   drop table if exists schema_migrations;\n-- create table fantasma (\n'
    expect([...tablasQueCrea(sql)]).toEqual([])
  })

  it('solo mira TABLAS: un índice o un tipo con ese nombre no cuenta', () => {
    // Es la razón de que la señal sean tablas y no índices. Un índice puede
    // nacer de un `constraint … unique` declarado dentro del `create table` de
    // `schema.sql`, con el MISMO nombre y sin un `create index` que lo delate:
    // se derivaría como testigo y una instalación legítima sería rechazada.
    // Con las tablas eso no pasa — un nombre de tabla solo llega de un
    // `create table`.
    const sql = 'create index almacen_activos on x(y);\ncreate type est_activo as enum (\'A\');\n'
    expect([...tablasQueCrea(sql)]).toEqual([])
  })
})

describe('testigosDeHistoria()', () => {
  it('una tabla que también crea schema.sql NO es testigo', () => {
    // `folios_consecutivos` está en los dos sitios (`schema.sql:95` y
    // `20260804_folios_consecutivos.sql:26`): existe en una instalación recién
    // nacida, así que no prueba nada.
    const testigos = testigosDeHistoria('create table folios_consecutivos (\n', [
      { archivo: '20260804_folios_consecutivos.sql', contenido: 'create table if not exists folios_consecutivos (\n' },
      { archivo: '20260723_almacen.sql', contenido: 'create table if not exists almacen_activos (\n' },
    ])
    expect(testigos).toEqual([{ tabla: 'almacen_activos', archivo: '20260723_almacen.sql' }])
  })

  it('sin testigos derivables devuelve lista vacía — y el runner se niega', () => {
    // El caso fail-closed: si `schema.sql` acabara creándolas todas, la señal
    // deja de separar nada. La lista vacía es lo que el runner mira para
    // negarse en vez de creerse la bandera a ciegas.
    expect(testigosDeHistoria('create table sitios (\n', [])).toEqual([])
  })

  it('sobre el repo real la señal existe y es amplia', () => {
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    expect(testigos.length).toBeGreaterThanOrEqual(10)
    // Ninguna de ellas puede estar en `schema.sql`: es la definición misma de
    // testigo, y comprobarlo aquí atrapa un parser que lea mal cualquiera de
    // los dos lados.
    const esquema = readFileSync(RUTA_ESQUEMA, 'utf8')
    for (const t of testigos) {
      expect([...tablasQueCrea(esquema)]).not.toContain(t.tabla)
    }
  })

  it('CANARIO: `almacen_activos` sigue siendo testigo — si esto cae, la señal caducó', () => {
    // Escrito a mano a propósito, y es lo ÚNICO escrito a mano de toda la
    // señal. El runner no cablea este nombre: lo deriva. Pero si algún día
    // `almacen_activos` se renombra, se retira o entra en `schema.sql`, la
    // señal pierde cobertura EN SILENCIO — y este caso rojo es el aviso.
    // Quien lo vea: revisar que sigan quedando testigos suficientes y volver a
    // elegir el canario, no borrar la prueba.
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    expect(testigos).toContainEqual({ tabla: 'almacen_activos', archivo: '20260723_almacen.sql' })
  })

  it('la señal cubre la ventana [20260723, 20260807) desde su PRIMER archivo', () => {
    // Es la ventana en la que reaplicar la historia aborta a mitad y deja la
    // base con migraciones aplicadas y cero registradas. Empieza justo en
    // `20260723_almacen.sql`, que es testigo: cualquier base parada dentro de
    // esa ventana enseña historia y el runner la rechaza.
    //
    // Lo que la señal NO cubre, dicho en voz alta: una base parada ANTES de
    // `20260716_doohmain_playlogs.sql` —la primera migración que crea una tabla
    // propia— es indistinguible de una recién nacida por este criterio. Ninguna
    // instancia real está ahí (el droplet va por 20260810) y la ventana
    // peligrosa queda entera dentro de la cobertura.
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    const primero = testigos.map((t) => t.archivo).sort()[0]
    expect(primero < '20260723').toBe(true)
    expect(testigos.some((t) => t.archivo >= '20260723' && t.archivo < '20260807')).toBe(true)
  })
})
