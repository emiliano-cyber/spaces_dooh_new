import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'
// El MISMO orden que aplica una instancia de verdad. Aquí no se recalcula a
// mano: lo que se prueba no es el orden (de eso se ocupa `migraciones.e2e`),
// sino que la cadena aguante una segunda pasada tal y como se aplica en el
// droplet.
import { ordenar } from '../../../../scripts/migrar.mjs'

// ============================================================================
//  La cadena de migraciones tiene que poder REAPLICARSE entera.
// ----------------------------------------------------------------------------
//  ⚠️ 2026-08-31 · LA PREMISA DE ESTE ARCHIVO CAMBIÓ, y no se ha decidido qué
//  hacer con él. Lo escrito abajo describía a `deploy.yml:141-148`, que
//  reaplicaba TODAS las migraciones en cada despliegue. **Ese workflow se retiró
//  hoy (F3.6)** y `scripts/migrar.mjs` lleva registro y aplica cada archivo UNA
//  vez, así que en el camino normal ya nadie reaplica. Quedan dos usos que sí lo
//  rozan —la vuelta atrás de `update.sh`, que restaura sobre un esquema limpio, y
//  `--forzar-checksum`—, pero **no son los que este archivo ejercita**.
//  Mantenerlo o retirarlo es una decisión, no una limpieza: se deja escrito en
//  vez de resolverlo de tapadillo.
//
//  Lo que decía, y sigue explicando por qué nació: `deploy.yml:141-148`
//  reaplicaba todas las migraciones de esquema en cada despliegue y confiaba en
//  que fueran idempotentes. Esa confianza no la comprobaba nadie: el arnés (`recrearEsquema()`) las aplica siempre sobre una base recién
//  vaciada, así que ejercita la PRIMERA pasada y nunca la segunda. Por eso el
//  repo llegó al 2026-08-17 con dos migraciones que abortaban al reaplicarse, y
//  se descubrieron auditando F3.2 y no en CI:
//
//    · `20260720_hard1_usuarios_rls.sql` — «cannot change return type of
//      existing function». `create or replace` no puede devolver
//      `auth_usuario_por_sesion` a su forma de julio después de que
//      `20260804_reautenticacion_individual.sql:70-71` le añadiera una columna
//      de retorno.
//    · `20260729_datos_contrato_documento.sql` — «constraint
//      "contrato_dia_pago_ck" ... already exists». `add constraint` no admite
//      IF NOT EXISTS.
//
//  Las dos son de julio, o sea que llevaban semanas rotas sin que nada lo
//  dijera. Esta prueba es la que faltaba.
//
//  Ojo con el modo de fallo: la primera rotura ABORTA la pasada, así que quien
//  la mire solo ve una. Aquí se sigue adelante tras cada fallo y se censan
//  TODAS — un rojo que nombra un archivo cuando en realidad hay tres es lo que
//  hace que esto se arregle a medias.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const DIR_MIGRACIONES = join(RAIZ, 'db', 'migrations')

// Base desechable propia. No se usa `spaces_e2e`: esto reaplica 67 migraciones
// sobre ella y los demás archivos e2e comparten esa base. El sufijo `_e2e` es
// la misma disciplina que exige `exigirBaseDePrueba()` (`db-e2e.ts:43-60`).
const BASE = 'spaces_reaplicacion_e2e'

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

// Solo las de ESQUEMA, que son las que se reaplican de verdad: `migrar.mjs`
// omite las `@tipo: datos` salvo que se le pidan a mano con `--con-datos`
// (`deploy.yml` hacía lo mismo, y se retiró el 31/08). Exigirle idempotencia a una migración de datos sería inventarse un
// requisito que nadie tiene. El marcador se busca en la PRIMERA línea, que es
// donde está (`20260731_calendario_meses_cortos.sql:1`).
function migracionesDeEsquema(): string[] {
  return ordenar(readdirSync(DIR_MIGRACIONES).filter((f: string) => f.endsWith('.sql'))).filter(
    (f: string) => {
      const primera = readFileSync(join(DIR_MIGRACIONES, f), 'utf8').split('\n')[0]
      return !/^\uFEFF?--\s*@tipo:\s*datos/i.test(primera)
    },
  )
}

// La firma del esquema: lo que una migración puede cambiar. Incluye el RETORNO
// y el CUERPO de las funciones a propósito — la rotura de julio era justo eso, y
// una reaplicación que «funcione» dejando la función de sesión en su forma vieja
// sería peor que el error: `auth.ts:116-117` pide `debe_cambiar_password` en
// cada petición autenticada.
const FIRMA = [
  `select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_schema = 'public' order by 1, 2`,
  `select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  `select conrelid::regclass::text as tabla, conname, pg_get_constraintdef(oid) as def
     from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`,
  `select tablename, indexname, indexdef from pg_indexes
    where schemaname = 'public' order by 1, 2`,
  `select p.polrelid::regclass::text as tabla, p.polname, p.polcmd,
          pg_get_expr(p.polqual, p.polrelid) as usando,
          pg_get_expr(p.polwithcheck, p.polrelid) as con_check
     from pg_policy p order by 1, 2`,
  `select p.proname, pg_get_function_identity_arguments(p.oid) as args,
          pg_get_function_result(p.oid) as retorno, p.prosecdef, p.prosrc
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' order by 1, 2`,
]

async function firmaDe(pool: Pool): Promise<unknown[][]> {
  const partes: unknown[][] = []
  for (const sql of FIRMA) partes.push((await pool.query(sql)).rows)
  return partes
}

/** Aplica la lista entera y devuelve los archivos que fallaron, con su error. */
async function aplicarTodas(pool: Pool): Promise<string[]> {
  const fallos: string[] = []
  for (const archivo of migracionesDeEsquema()) {
    try {
      await pool.query(readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8'))
    } catch (e) {
      // El archivo trae su propia transacción, así que un fallo deja la base
      // como estaba y la siguiente migración puede intentarlo. Ese `rollback`
      // es lo que permite censar todas las roturas en una sola pasada.
      await pool.query('rollback').catch(() => {})
      fallos.push(`${archivo}: ${(e as Error).message}`)
    }
  }
  return fallos
}

describe('la cadena de migraciones se puede reaplicar entera', () => {
  let pool: Pool
  let fallosPrimera: string[]

  beforeAll(async () => {
    const admin = poolTest()
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE} with (force)`)
    await admin.query(`create database ${BASE}`)
    pool = new Pool({ connectionString: urlDe(BASE), max: 1 })

    // El prólogo real de una instancia: rol de app → `schema.sql` →
    // migraciones. El rol va PRIMERO porque `20260729_licencias_permisos
    // .sql:96-97` aborta si no encuentra ninguno (mismo motivo que
    // `db-e2e.ts:129-133`).
    await pool.query(readFileSync(join(RAIZ, 'db', 'dev-rol-app.sql'), 'utf8'))
    await pool.query(readFileSync(join(RAIZ, 'db', 'schema.sql'), 'utf8'))
    fallosPrimera = await aplicarTodas(pool)
  }, 120_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE} with (force)`)
    await cerrarPool()
  })

  it('la primera pasada, sobre una base limpia, no falla', () => {
    // Si esto se pone rojo, el problema no es la reaplicación: es que la cadena
    // ya no levanta un entorno nuevo.
    expect(fallosPrimera).toEqual([])
  })

  it('la segunda pasada sobre la misma base tampoco falla', async () => {
    // El caso que dejó F3.2 en rojo, y el que vive un droplet en CADA
    // despliegue. Se listan todas las roturas, no solo la primera.
    expect(await aplicarTodas(pool)).toEqual([])
  }, 60_000)

  it('y la tercera, para que no valga con alternar entre dos estados', async () => {
    expect(await aplicarTodas(pool)).toEqual([])
  }, 60_000)

  it('reaplicar no cambia el esquema: converge, no deriva', async () => {
    // Una migración puede reaplicarse sin dar error y aun así dejar el esquema
    // distinto —una función devuelta a una forma vieja, un DEFAULT que vuelve—.
    // Eso no daría ningún rojo en las otras tres pruebas y es exactamente el
    // modo de fallo silencioso que este repo ya ha pagado dos veces.
    const antes = await firmaDe(pool)
    expect(await aplicarTodas(pool)).toEqual([])
    expect(await firmaDe(pool)).toEqual(antes)
  }, 60_000)
})
