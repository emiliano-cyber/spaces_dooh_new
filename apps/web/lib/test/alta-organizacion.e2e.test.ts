import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import bcrypt from 'bcryptjs'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  F5.1 — la organización y su Dueño nacen juntos, o no nacen.
//
//  Hoy `crearOrgConDueno` hace DOS llamadas sueltas: primero crea el tenant y
//  después el usuario. Si la segunda falla, **el tenant sobrevive** — queda una
//  organización sin nadie dentro, que nadie puede administrar y que ocupa su
//  slug para siempre.
//
//  ─── Por qué esto tiene que ser e2e y no unitaria ─────────────────────────
//  Lo que se prueba es una TRANSACCIÓN. Un mock no tiene transacciones: haría
//  verde con las dos llamadas igual de sueltas que hoy. Hace falta Postgres de
//  verdad, y por eso el fallo se induce con un TRIGGER — la única forma de
//  reventar el `INSERT` de `usuarios` sin tocar el código que se está probando.
//
//  ─── Y por qué va por HTTP ────────────────────────────────────────────────
//  `cuentas-controller` arrastra `tenant.ts`, que llama a `cache()` de React en
//  el cuerpo del módulo: importarlo fuera de Next revienta antes de ejecutar
//  nada. Se entra por `POST /api/tenants`, que es una de las dos puertas reales
//  del alta (la otra es `/api/signup`).
//
//  El caso NEGATIVO es el que importa. El positivo solo demuestra que no
//  rompimos el alta al envolverla.
// ============================================================================

const EMAIL_DUENO = 'duena-plataforma-f51@ejemplo.com'

const EMAIL_QUE_REVIENTA = 'rompe@ejemplo.com'
const SLUG_HUERFANO = 'organizacion-que-no-debe-quedar'

/** Un trigger que revienta el INSERT de `usuarios` para un correo concreto. */
async function armarTrampa() {
  await poolTest().query(`
    create or replace function fallar_alta_de_prueba() returns trigger
    language plpgsql as $$
    begin
      if new.email = '${EMAIL_QUE_REVIENTA}' then
        raise exception 'fallo inducido por la prueba F5.1';
      end if;
      return new;
    end $$;
  `)
  await poolTest().query('drop trigger if exists tr_fallar_alta_de_prueba on usuarios')
  await poolTest().query(`
    create trigger tr_fallar_alta_de_prueba before insert on usuarios
      for each row execute function fallar_alta_de_prueba();
  `)
}

async function desarmarTrampa() {
  await poolTest().query('drop trigger if exists tr_fallar_alta_de_prueba on usuarios')
}

async function tenantsConSlug(slug: string): Promise<number> {
  const r = await poolTest().query('select count(*)::int as n from tenants where slug = $1', [slug])
  return r.rows[0].n
}

/** Sesión del Dueño del TENANT DE LA PLATAFORMA. */
async function comoDuenoDeLaPlataforma(): Promise<Cliente> {
  const c = new Cliente()
  const r = await c.pedir('/api/auth/login/', {
    cuerpo: { email: EMAIL_DUENO, password: PASSWORD_DEMO },
  })
  expect(r.status).toBe(200)
  return c
}

// El Dueño va DENTRO del tenant de la plataforma, y eso no es un detalle:
// `puedeCambiarCrm()` (`tenant.ts:44-48`) exige rol DUENO **y** que su tenant
// sea el de la plataforma, que `tenant.ts:26-29` define como EL MÁS ANTIGUO.
//
// Con `sembrarTenant()` la prueba fallaba con «No autorizado», y el motivo no
// era el codigo: `recrearEsquema()` carga `db/semilla-desarrollo.sql`
// (`db-e2e.ts:157`), que siembra el tenant `rgb`. Ese es siempre el mas antiguo,
// asi que un tenant sembrado despues NUNCA sera el de la plataforma.
async function sembrarDuenoDeLaPlataforma(): Promise<void> {
  const t = await poolTest().query('select id from tenants order by creado_en asc limit 1')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3::rol_demo,$4,true,$5)`,
    ['Duena plataforma', EMAIL_DUENO, 'DUENO', await bcrypt.hash(PASSWORD_DEMO, 4), t.rows[0].id],
  )
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  await sembrarDuenoDeLaPlataforma()
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await desarmarTrampa()
  await poolTest().query('delete from tenants where slug = $1', [SLUG_HUERFANO])
})

describe('F5.1 · el caso negativo: si falla el Dueño, no queda organización', () => {
  it('NO deja tenant huérfano cuando revienta el INSERT del usuario', async () => {
    await armarTrampa()
    const c = await comoDuenoDeLaPlataforma()

    const r = await c.pedir('/api/tenants/', {
      cuerpo: {
        nombre: 'Organizacion que no debe quedar',
        slug: SLUG_HUERFANO,
        admin: { nombre: 'Nadie', email: EMAIL_QUE_REVIENTA, password: 'UnaClaveLarga123' },
      },
    })

    // El alta tiene que fallar: el trigger revienta el usuario.
    expect(r.status).toBeGreaterThanOrEqual(400)

    // Y ESTA es la afirmación de la tarea: la organización NO se quedó.
    expect(await tenantsConSlug(SLUG_HUERFANO)).toBe(0)
  })

  it('tampoco deja al usuario a medias: cero filas con ese correo', async () => {
    await armarTrampa()
    const c = await comoDuenoDeLaPlataforma()

    await c.pedir('/api/tenants/', {
      cuerpo: {
        nombre: 'Otra que no debe quedar',
        slug: SLUG_HUERFANO,
        admin: { nombre: 'Nadie', email: EMAIL_QUE_REVIENTA, password: 'UnaClaveLarga123' },
      },
    })

    const u = await poolTest().query('select count(*)::int as n from usuarios where email = $1', [
      EMAIL_QUE_REVIENTA,
    ])
    expect(u.rows[0].n).toBe(0)
  })
})

describe('F5.1 · el camino normal sigue igual', () => {
  it('crea la organización y su Dueño, y devuelve 201', async () => {
    const c = await comoDuenoDeLaPlataforma()

    const r = await c.pedir('/api/tenants/', {
      cuerpo: {
        nombre: 'Organizacion valida',
        slug: SLUG_HUERFANO,
        admin: { nombre: 'Duena', email: 'duena-f51@ejemplo.com', password: 'UnaClaveLarga123' },
      },
    })

    // El criterio de aceptación dice, literal: «`POST /api/tenants` sigue
    // devolviendo 201 con el mismo cuerpo que hoy».
    expect(r.datos?.error).toBeUndefined()
    expect(r.status).toBe(201)
    expect(r.datos?.tenant?.slug).toBe(SLUG_HUERFANO)
    expect(r.datos?.usuario?.email).toBe('duena-f51@ejemplo.com')

    // Y las dos filas existen de verdad, no solo en la respuesta.
    expect(await tenantsConSlug(SLUG_HUERFANO)).toBe(1)
    const u = await poolTest().query('select count(*)::int as n from usuarios where email = $1', [
      'duena-f51@ejemplo.com',
    ])
    expect(u.rows[0].n).toBe(1)
  })
})
