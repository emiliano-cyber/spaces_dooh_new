import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { vigilarPool } from './pool-e2e'
// El orden de las migraciones se declara UNA vez, en el runner que las aplica
// en el droplet. Importarlo desde aquí es lo que garantiza que el arnés pruebe
// el mismo orden que corre en una instancia.
import { ordenar } from '../../../../scripts/migrar.mjs'

// ============================================================================
//  lib/test/db-e2e.ts — La base de las pruebas de integración.
// ----------------------------------------------------------------------------
//  Postgres REAL, no simulado. Las 631 pruebas unitarias ya cubren la lógica
//  pura con la BD mockeada; lo que NO cubre nadie es que el SQL case con el
//  esquema, que la RLS aísle de verdad y que los guards compongan en el orden
//  correcto. Eso es justo lo que rompe una migración, y llevamos dos.
//
//  Por qué se recrea el esquema en cada corrida y no se reutiliza el volumen:
//  `db/docker-compose.yml` ejecuta `schema.sql` UNA sola vez, al crear el
//  volumen. O sea que un contenedor levantado hace semanas tiene el esquema de
//  hace semanas — comprobado: el de esta máquina no tenía `config_negocio
//  .tenant_id` y habría dado por buenas unas pruebas que en realidad corrían
//  contra otro esquema. Peor que no tenerlas.
// ============================================================================

// Base DEDICADA (`spaces_e2e`), no la `spaces` del docker-compose. La
// diferencia no es cosmética: `spaces` es la base del DEMO LOCAL, donde se
// suben pantallas, campañas y CREATIVOS con sus imágenes — y esto corre
// `drop schema public cascade` en cada arranque. Apuntar aquí la base del demo
// la borra entera, sin preguntar y sin vuelta atrás (las imágenes viven solo
// ahí). Se crea una vez:
//
//   docker exec spaces_db psql -U spaces -d postgres -c "create database spaces_e2e"
//
// Se puede apuntar a otra con DATABASE_URL_TEST (en CI, al Postgres del runner).
export const URL_TEST =
  process.env.DATABASE_URL_TEST ?? 'postgresql://spaces:spaces@localhost:5433/spaces_e2e'

// NUNCA contra producción NI contra una base con datos de alguien. El check es
// por NOMBRE de base y por host, y exige que el nombre DIGA que es de pruebas
// (`_e2e` / `_test`). Antes solo rechazaba las que llevaran «prod» en el
// nombre, y eso deja pasar la de la demo local —se llama `spaces` a secas—, que
// es justo el despiste caro: un `drop schema` sobre datos reales.
function exigirBaseDePrueba(url: string) {
  const u = new URL(url)
  const nombre = u.pathname.replace('/', '')
  if (!/(_e2e|_test)$/.test(nombre)) {
    throw new Error(
      `db-e2e recrea el esquema desde cero (drop schema public cascade) y la base «${nombre}» ` +
        `no se llama como una base de pruebas. Usa una que termine en _e2e o _test ` +
        `(p. ej. spaces_e2e) o pásala en DATABASE_URL_TEST. Abortado.`,
    )
  }
  // Y aun llamándose «de prueba»: ni producción ni un host remoto.
  const local = ['localhost', '127.0.0.1', 'db', 'postgres'].includes(u.hostname)
  if (nombre.includes('prod') || !local) {
    throw new Error(
      `db-e2e apunta a una base que NO parece de prueba (${u.hostname}/${nombre}). Abortado.`,
    )
  }
}

// ─── DOS conexiones, y la distinción es lo que hace válidas las pruebas ─────
//
// `spaces` (el POSTGRES_USER del contenedor) es SUPERUSUARIO, y un superusuario
// se salta la RLS aunque la tabla tenga FORCE. Conectando con él, TODA prueba
// de aislamiento pasa por casualidad: es lo que me ocurrió — la comprobación de
// «sin tenant, cero filas» daba verde porque la tabla estaba vacía, no porque
// aislara. Habría firmado un aislamiento inexistente.
//
// `db/dev-rol-app.sql` ya preveía esto y crea `spaces_app` NOSUPERUSER
// NOBYPASSRLS con el mismo aviso escrito. Así que:
//
//   · ADMIN (`spaces`)      → recrear esquema y SEMBRAR. Necesita saltarse la
//                             RLS para poder insertar datos de varios tenants.
//   · APP   (`spaces_app`)  → todo lo que deba RESPETAR la RLS. Es el rol
//                             equivalente a `spaces_user` en producción.
//
// Si una prueba de aislamiento usara el pool admin, no probaría nada.
export const URL_APP =
  process.env.DATABASE_URL_TEST_APP ??
  'postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces_e2e'

let poolAdminRef: Pool | null = null
let poolAppRef: Pool | null = null

export function poolTest(): Pool {
  if (!poolAdminRef) {
    exigirBaseDePrueba(URL_TEST)
    poolAdminRef = new Pool({ connectionString: URL_TEST, max: 4 })
    vigilarPool(poolAdminRef, 'admin (URL_TEST)')
  }
  return poolAdminRef
}

// Conexión con la RLS ACTIVA de verdad. Úsala en todo lo que verifique
// aislamiento; `poolTest()` es para montar el escenario.
export function poolApp(): Pool {
  if (!poolAppRef) {
    exigirBaseDePrueba(URL_APP)
    poolAppRef = new Pool({ connectionString: URL_APP, max: 4 })
    vigilarPool(poolAppRef, 'app (URL_APP)')
  }
  return poolAppRef
}

// Deja la base como el droplet: `schema.sql`, la organización de desarrollo y
// todas las migraciones, en orden de nombre.
//
// Lo de las migraciones no es un extra: `schema.sql` es un SUBCONJUNTO de lo
// que corre en producción. Se comparó columna a columna y le faltan 143 —
// tablas enteras (`almacen_activos`, `almacen_movimientos`) y columnas del
// propio flujo crítico (`campanas.enviada_dominio`, `campanas
// .validacion_estatus`). Las migraciones se aplicaron a prod y nunca se
// plegaron de vuelta al esquema.
//
// Probar contra `schema.sql` a secas seria probar una base que no existe en
// ningun sitio: las pruebas de publicacion fallarian por falta de columna, y
// las que pasaran no dirian nada sobre lo desplegado.
//
// Efecto secundario que vale por si solo: esto EJERCITA la cadena de
// migraciones en cada corrida. Si una deja de poder aplicarse desde cero, se
// entera CI en vez de descubrirse el dia que se levante un entorno nuevo.
//
// `drop schema public cascade` se lleva por delante tablas, tipos, funciones y
// políticas: sin eso, un `create type` fallaría por duplicado.
export async function recrearEsquema(): Promise<void> {
  const p = poolTest()
  const raizDb = join(process.cwd(), '..', '..', 'db')

  // El rol de app va PRIMERO: la migración `..._arr_m6_rol_restringido` le da
  // los GRANT solo `if exists (select 1 from pg_roles where rolname =
  // 'spaces_app')`. Creado después, se quedaría sin permisos y todas las
  // consultas del pool de app fallarían por permiso en vez de por RLS.
  // El rol vive en el CLUSTER, así que sobrevive al drop del esquema.
  await p.query(readFileSync(join(raizDb, 'dev-rol-app.sql'), 'utf8'))

  await p.query('drop schema if exists public cascade')
  await p.query('create schema public')
  await p.query(readFileSync(join(raizDb, 'schema.sql'), 'utf8'))

  // La organización de trabajo va ENTRE el esquema y las migraciones, y esa
  // posición es la que hace válido lo que prueban las demás.
  //
  // Desde el 19/08 `schema.sql` ya no siembra ningún tenant: una instancia
  // nueva no debe nacer con la identidad de otro owner (ver la cabecera de
  // `db/semilla-desarrollo.sql`). Pero el estado que el arnés tiene que
  // reproducir NO es el de una instancia recién nacida, sino el del DROPLET:
  // una base que ya tenía organización cuando le llegaron las migraciones. De
  // eso dependen dos cosas medibles:
  //   · el backfill de `20260812_schema_migrations.sql` solo dispara si
  //     `tenants` tiene filas — sembrar DESPUÉS lo dejaría sin disparar y
  //     `migraciones.e2e.test.ts` mediría otra cosa;
  //   · las migraciones que rellenan por organización (`config_negocio`,
  //     moneda, razón social) no tendrían a quién rellenar.
  //
  // Quien prueba el caso contrario —una base sin owner, que es como nace una
  // instancia— es `esquema-sin-owner.e2e.test.ts`, con su propia base y sin
  // pasar por aquí.
  await p.query(readFileSync(join(raizDb, 'semilla-desarrollo.sql'), 'utf8'))

  const dirMigraciones = join(raizDb, 'migrations')
  // El orden lo decide `ordenar()`, del runner (`scripts/migrar.mjs`). Aquí
  // había una copia del mapa `ANTES_DE` y desde el 17/08 (F3.2) ya no: es el
  // mismo orden que aplica una instancia de verdad, y dos copias divergen. Si
  // divergieran éstas, las pruebas aplicarían en un orden y el droplet en otro
  // — el escenario que ninguna prueba vería.
  const archivos = ordenar(readdirSync(dirMigraciones).filter((f) => f.endsWith('.sql')))
  for (const archivo of archivos) {
    try {
      await p.query(readFileSync(join(dirMigraciones, archivo), 'utf8'))
    } catch (e) {
      // Se nombra el archivo: sin esto, el error de Postgres llega sin decir
      // cuál de las 59 migraciones lo provocó.
      throw new Error(`Falló la migración ${archivo}: ${(e as Error).message}`)
    }
  }
}

export async function cerrarPool(): Promise<void> {
  if (poolAdminRef) { await poolAdminRef.end(); poolAdminRef = null }
  if (poolAppRef) { await poolAppRef.end(); poolAppRef = null }
}

// Ejecuta con el contexto de tenant puesto, igual que hace la app en cada
// request. Sin esto, cualquier consulta a una tabla con RLS devuelve 0 filas —
// que es exactamente lo que las pruebas de aislamiento verifican.
export async function comoTenant<T>(
  tenantId: string,
  fn: (q: (texto: string, params?: unknown[]) => Promise<any[]>) => Promise<T>,
): Promise<T> {
  // Pool de APP a propósito: con el admin (superusuario) la RLS no se aplica y
  // esto devolvería las filas de todos los tenants.
  const cliente = await poolApp().connect()
  try {
    await cliente.query('begin')
    await cliente.query("select set_config('app.tenant_id', $1, true)", [tenantId])
    const res = await fn(async (texto, params) => (await cliente.query(texto, params as any[])).rows)
    await cliente.query('commit')
    return res
  } catch (e) {
    await cliente.query('rollback').catch(() => {})
    throw e
  } finally {
    cliente.release()
  }
}
