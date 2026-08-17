import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ordenar, tipoDeMigracion, ANTES_DE } from './migrar.mjs'

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
