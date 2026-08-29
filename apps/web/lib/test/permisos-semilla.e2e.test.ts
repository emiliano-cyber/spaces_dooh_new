import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'
import { AREAS, MODULOS } from '../modulos'

// ============================================================================
//  Una instancia recién aprovisionada nace con su catálogo de permisos.
// ----------------------------------------------------------------------------
//  `rol_permisos` no la siembra `db/schema.sql`: la crea vacía
//  (`db/schema.sql:75-80`). El único sembrado que viajaba en la cadena de
//  migraciones era `20260804_modulo_inventario.sql:22`, y son CINCO filas de UN
//  módulo. Medido antes de escribir esto: base nueva → 5 filas / 1 módulo; base
//  de desarrollo → 25 filas / 8 módulos / 3 roles.
//
//  Y no hay red debajo: `permisosDeRol` y `tienePermiso`
//  (`apps/web/lib/server/auth.ts:126-142`) son consultas directas a la tabla,
//  SIN excepción para el Dueño. O sea que en una instancia recién creada el
//  Dueño entra y ve la aplicación entera vacía — falla cerrado, no es una fuga,
//  pero deja la instancia inservible desde el minuto uno.
//
//  Lo que estas pruebas fijan es el catálogo decidido el 2026-08-20 al cerrar
//  ROJO-2 —41 filas · 9 módulos · 5 perfiles—, que adopta ENTERO el contenido
//  que llevaba el alta, el más completo de los dos catálogos que convivían. La
//  expectativa se escribe literal a propósito: si saliera de la propia
//  migración, la prueba no diría nada.
//
//  Hasta ese día había DOS catálogos que podían divergir y de hecho divergían
//  —25 filas en la migración contra 36 en `bootstrap-auth.mjs`— y la política de
//  acceso efectiva de una instancia la fijaba el último script que corrió.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')

// Base desechable propia. No se usa `spaces_e2e`: aquí hace falta una base que
// nazca EXACTAMENTE como una instancia nueva (rol de app → `schema.sql` →
// runner), y `recrearEsquema()` intercala `db/semilla-desarrollo.sql`. El
// sufijo `_e2e` es la misma disciplina que exige `exigirBaseDePrueba()`
// (`db-e2e.ts:43-60`).
const BASE_NUEVA = 'spaces_permisos_nueva_e2e'
// La segunda: una base que YA tiene las 25 filas antes de que la migración
// corra — o sea desarrollo y producción. Ahí la migración no debe cambiar nada.
const BASE_CON_PERMISOS = 'spaces_permisos_previos_e2e'

// El catálogo que funciona, medido en la base de desarrollo el 2026-08-19.
// 25 filas · 8 módulos · 3 roles.
const CATALOGO = [
  'COMERCIAL|comercial|crear',
  'COMERCIAL|comercial|ver',
  'COMERCIAL|dashboard|ver',
  'COMERCIAL|inventario|ver',
  'COMERCIAL|network|ver',
  'DUENO|administracion|aprobar',
  'DUENO|administracion|crear',
  'DUENO|administracion|ver',
  'DUENO|arrendadores|aprobar',
  'DUENO|arrendadores|crear',
  'DUENO|arrendadores|ver',
  'DUENO|comercial|aprobar',
  'DUENO|comercial|crear',
  'DUENO|comercial|ver',
  'DUENO|dashboard|ver',
  'DUENO|finanzas|crear',
  'DUENO|finanzas|facturar',
  'DUENO|finanzas|ver',
  'DUENO|inventario|aprobar',
  'DUENO|inventario|crear',
  'DUENO|inventario|ver',
  'DUENO|network|ver',
  'DUENO|operaciones|crear',
  'DUENO|operaciones|ver',
  'OPERACIONES|inventario|ver',
]

const MIGRACION = '20260819_semilla_rol_permisos.sql'
const MIGRACION_COMPLETA = '20260820_catalogo_permisos_completo.sql'

// El catálogo OBJETIVO, decidido el 2026-08-20 al cerrar ROJO-2: 41 filas · 9
// módulos · 5 perfiles. Sale del contenido del alta (`bootstrap-auth.mjs`), que
// era el más completo de los dos catálogos que convivían, adoptado ENTERO y no
// solo en sus dos perfiles nuevos. Se escribe literal aquí a propósito: si
// saliera de la propia migración, la prueba no diría nada.
//
//   · IMPRENTA ve y crea sus trabajos y mira operaciones, para saber qué se
//     instala. NO tiene `aprobar`: no cierra nada por su cuenta.
//   · FINANZAS ve, crea y FACTURA, más el tablero. `facturar` es acción de
//     dinero irreversible (R4) y va por decisión expresa: un Finanzas que no
//     puede facturar obliga al Dueño a hacer el trabajo diario, y eso acaba con
//     todo el mundo entrando como Dueño, que es peor.
const CATALOGO_COMPLETO = [
  'COMERCIAL|comercial|crear',
  'COMERCIAL|comercial|ver',
  'COMERCIAL|dashboard|ver',
  'COMERCIAL|inventario|ver',
  'COMERCIAL|network|ver',
  'DUENO|administracion|aprobar',
  'DUENO|administracion|crear',
  'DUENO|administracion|ver',
  'DUENO|arrendadores|aprobar',
  'DUENO|arrendadores|crear',
  'DUENO|arrendadores|ver',
  'DUENO|comercial|aprobar',
  'DUENO|comercial|crear',
  'DUENO|comercial|ver',
  'DUENO|dashboard|ver',
  'DUENO|finanzas|crear',
  'DUENO|finanzas|facturar',
  'DUENO|finanzas|ver',
  'DUENO|imprenta|aprobar',
  'DUENO|imprenta|crear',
  'DUENO|imprenta|ver',
  'DUENO|inventario|aprobar',
  'DUENO|inventario|crear',
  'DUENO|inventario|ver',
  'DUENO|network|crear',
  'DUENO|network|ver',
  'DUENO|operaciones|aprobar',
  'DUENO|operaciones|crear',
  'DUENO|operaciones|ver',
  'FINANZAS|dashboard|ver',
  'FINANZAS|finanzas|crear',
  'FINANZAS|finanzas|facturar',
  'FINANZAS|finanzas|ver',
  'IMPRENTA|imprenta|crear',
  'IMPRENTA|imprenta|ver',
  'IMPRENTA|operaciones|ver',
  'OPERACIONES|comercial|ver',
  'OPERACIONES|imprenta|ver',
  'OPERACIONES|inventario|ver',
  'OPERACIONES|operaciones|crear',
  'OPERACIONES|operaciones|ver',
]

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

// La cookie de sesión de la prueba del Dueño. Se declara arriba porque
// `vi.mock` se iza por encima de todo lo demás.
const TOKEN = 'token-de-prueba-permisos'

// `permisosDeRol` acaba en `usuarioActual()`, que lee la cookie de sesión. Fuera
// de una request de Next no hay cookies; se sustituyen por la de un Dueño real
// creado más abajo, para que el camino que se ejercita sea el del producto y no
// un `select` reescrito aquí.
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'spaces_sesion' ? { value: TOKEN } : undefined) }),
}))

async function crearBase(nombre: string): Promise<Pool> {
  if (!nombre.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
  const admin = poolTest()
  await admin.query(`drop database if exists ${nombre} with (force)`)
  await admin.query(`create database ${nombre}`)
  return new Pool({ connectionString: urlDe(nombre), max: 2 })
}

// El prólogo real de una instancia: rol de app → `schema.sql`. El rol va PRIMERO
// porque `20260729_licencias_permisos.sql:96-97` aborta si no encuentra ninguno.
async function prologo(pool: Pool): Promise<void> {
  await pool.query(readFileSync(join(RAIZ, 'db', 'dev-rol-app.sql'), 'utf8'))
  await pool.query(readFileSync(join(RAIZ, 'db', 'schema.sql'), 'utf8'))
}

function correrRunner(base: string, args: string[] = []) {
  return spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), ...args], {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: urlDe(base) },
    encoding: 'utf8',
  })
}

async function catalogoDe(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    "select rol || '|' || modulo || '|' || accion as fila from rol_permisos order by 1",
  )
  return rows.map((r: any) => r.fila)
}

describe('el catálogo de permisos de una instancia nueva', () => {
  let pool: Pool
  let runner: ReturnType<typeof correrRunner>
  // El pool que `lib/server/db.ts` abre contra esta base al importarse. Se
  // guarda para cerrarlo ANTES de soltar la base: `drop database ... with
  // (force)` mata sus conexiones y pg lo reporta como error no capturado, que
  // vitest señala como posible falso positivo del archivo entero.
  let poolDeLaApp: { end: () => Promise<void> } | null = null

  beforeAll(async () => {
    pool = await crearBase(BASE_NUEVA)
    await prologo(pool)
    // La receta completa de aprovisionamiento, tal cual: la bandera afirma que
    // esta base es nueva y el runner la verifica antes de aplicar nada.
    runner = correrRunner(BASE_NUEVA, ['--instalacion-nueva'])
  }, 180_000)

  afterAll(async () => {
    if (pool) await pool.end()
    if (poolDeLaApp) await poolDeLaApp.end()
    await poolTest().query(`drop database if exists ${BASE_NUEVA} with (force)`)
  })

  it('la receta de aprovisionamiento corre entera', () => {
    // Si esto falla, lo de abajo no mide permisos: mide que no hay esquema.
    expect(runner.stderr + runner.stdout).toContain(MIGRACION)
    expect(runner.status).toBe(0)
  })

  it('nace con las 41 filas: 9 módulos y 5 roles, ni una más', async () => {
    // El «ni una más» importa tanto como el «ni una menos»: las dos migraciones
    // corren DESPUÉS de `20260804_modulo_inventario.sql`, que ya sembró 5 de
    // estas filas, y la segunda repite las 25 de la primera. Un `insert` sin
    // `on conflict` dejaría 46 o abortaría.
    expect(await catalogoDe(pool)).toEqual(CATALOGO_COMPLETO)

    const { rows } = await pool.query(
      'select count(*)::int filas, count(distinct modulo)::int modulos, count(distinct rol)::int roles from rol_permisos',
    )
    expect(rows[0]).toEqual({ filas: 41, modulos: 9, roles: 5 })
  })

  it('los dos perfiles que no existían ya pueden entrar a algo', async () => {
    // Antes del 20/08, `IMPRENTA` y `FINANZAS` estaban en el enum `rol_demo` y
    // `nav.ts` los ofrecía al dar de alta un usuario, pero no tenían NI UNA fila
    // en `rol_permisos`: se podían crear, entraban, y recibían 403 en todo. Es
    // la misma trampa que el ADR 0010 le cerró a `CLIENTE`.
    const { rows } = await pool.query(
      "select rol::text rol, count(*)::int n from rol_permisos group by 1 order by 1",
    )
    expect(rows).toEqual([
      { rol: 'COMERCIAL', n: 5 },
      { rol: 'DUENO', n: 24 },
      { rol: 'FINANZAS', n: 4 },
      { rol: 'IMPRENTA', n: 3 },
      { rol: 'OPERACIONES', n: 5 },
    ])
  })

  it('reaplicar la migración no duplica ni cambia nada (idempotente)', async () => {
    // `deploy.yml:141-148` reaplica TODAS las migraciones de esquema en cada
    // despliegue, así que la segunda pasada no es hipotética.
    const antes = await catalogoDe(pool)
    await pool.query(readFileSync(join(RAIZ, 'db', 'migrations', MIGRACION), 'utf8'))
    await pool.query(readFileSync(join(RAIZ, 'db', 'migrations', MIGRACION_COMPLETA), 'utf8'))
    expect(await catalogoDe(pool)).toEqual(antes)
    expect(antes).toHaveLength(41)
  })

  it('un Dueño recién creado ve sus módulos', async () => {
    // El defecto de verdad, y por eso se mide con `permisosDeRol` y no contando
    // filas: es la función que contestan `/api/auth/login`, `/api/auth/me` y
    // `/api/estado`, o sea de la que depende lo que el Dueño ve al entrar.
    const t = await pool.query(
      "insert into tenants (nombre, slug) values ('Org de prueba','permisos-e2e') returning id",
    )
    const u = await pool.query(
      `insert into usuarios (tenant_id, nombre, email, rol, password_hash, activo)
       values ($1,'Dueña','duenia@permisos.test','DUENO','x',true) returning id`,
      [t.rows[0].id],
    )
    await pool.query(
      "insert into sesiones (token, usuario_id, expira_en) values ($1,$2, now() + interval '1 day')",
      [TOKEN, u.rows[0].id],
    )

    // El pool de `lib/server/db.ts` se construye al importarse, así que la
    // variable se fija ANTES del import dinámico.
    process.env.DATABASE_URL = urlDe(BASE_NUEVA)
    const { usuarioActual, permisosDeRol, tienePermiso } = await import('../server/auth')
    poolDeLaApp = (await import('../server/db')).pool

    const sesion = await usuarioActual()
    expect(sesion?.rol).toBe('DUENO')

    const permisos = await permisosDeRol(sesion!.rol)
    expect(Object.keys(permisos).sort()).toEqual([
      'administracion',
      'arrendadores',
      'comercial',
      'dashboard',
      'finanzas',
      'imprenta',
      'inventario',
      'network',
      'operaciones',
    ])
    // La puerta concreta que hoy se le cierra: sin catálogo, Administración —de
    // donde da de alta al resto de su equipo— contesta 403.
    expect(await tienePermiso(sesion!.rol, 'administracion', 'ver')).toBe(true)

    // Y en términos de producto: al Dueño no le queda NI UN área cerrada.
    // Hasta el 20/08 `imprenta` era la única sin ni una fila en `rol_permisos`
    // —el único módulo del catálogo (`lib/modulos.ts`) en esa situación, igual
    // que le pasaba a CLIENTE antes del ADR 0010—. La decisión de ROJO-2 la
    // siembra: quién imprime ya está escrito.
    const cerradas = AREAS.filter((a) => !permisos[a.modulo]?.includes('ver')).map((a) => a.clave)
    expect(cerradas).toEqual([])
    expect(MODULOS.filter((m) => !permisos[m])).toEqual([])
  })
})

describe('una base que ya tenía el catálogo', () => {
  let pool: Pool

  beforeAll(async () => {
    pool = await crearBase(BASE_CON_PERMISOS)
    await prologo(pool)
    // El estado de desarrollo y (según el censo del 19/08) el de producción:
    // las 25 filas puestas a mano hace meses, sin que ninguna migración las
    // registre.
    for (const fila of CATALOGO) {
      const [rol, modulo, accion] = fila.split('|')
      await pool.query(
        'insert into rol_permisos (rol, modulo, accion) values ($1,$2,$3) on conflict do nothing',
        [rol, modulo, accion],
      )
    }
  }, 60_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE_CON_PERMISOS} with (force)`)
    await cerrarPool()
  })

  it('la migración no le cambia ni una fila', async () => {
    const antes = await catalogoDe(pool)
    expect(antes).toEqual(CATALOGO)
    await pool.query(readFileSync(join(RAIZ, 'db', 'migrations', MIGRACION), 'utf8'))
    expect(await catalogoDe(pool)).toEqual(antes)
  })
})
