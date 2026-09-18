import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El cuestionario de bienvenida contra Postgres real y con el rol de la app.
// ----------------------------------------------------------------------------
//  Las TRES pruebas que `vault/02-Backend/cuestionario-bienvenida.md` dejó
//  anotadas como pendientes el 2026-09-18 («Lo que falta por probar, y no se
//  probó»): no se escribieron porque el puerto 3311 y `spaces_e2e` los tenía
//  otro agente en exclusiva. Son las tres cosas que la unitaria NO puede ver
//  porque simula la base:
//
//    1. que el POST de una organización no cree entidades en otra;
//    2. que la transacción REVIERTE de verdad — un plan que falla a mitad deja
//       cero filas, no la primera entidad escrita;
//    3. que el segundo POST responde 409 SIN escribir, con el cerrojo de por
//       medio.
//
//  ─── La regla que decide si esto vale algo ────────────────────────────────
//  Las consultas que comprueban aislamiento van por `comoTenant()`, que usa
//  `poolApp()` — el rol `spaces_app`, NOSUPERUSER y NOBYPASSRLS. Con el pool de
//  administración (`spaces` es superusuario) la RLS no se aplica aunque la
//  tabla tenga FORCE, y toda prueba de aislamiento pasaría POR CASUALIDAD.
//  `poolTest()` se usa solo para montar el escenario y para MIRAR la base por
//  encima de la RLS, que es justo lo que hace falta para contar las filas de
//  las dos organizaciones a la vez.
//
//  ─── Por qué las dos organizaciones mandan EL MISMO CUERPO ────────────────
//  Es el detalle que hace la prueba capaz de cazar el fallo que importa. Con
//  nombres distintos, un fallo de aislamiento saldría como una lista de razones
//  sociales raras — algo que alguien notaría. Con el MISMO cuerpo sale como un
//  recuento AL DOBLE (10 en vez de 5), y sobre todo como un 409 en la segunda
//  organización: «tu organizacion ya tiene razones sociales registradas»
//  cuando no tiene ninguna. Eso no da error en ningún log y deja a un owner sin
//  poder registrar nunca su identidad fiscal.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let orgC: Awaited<ReturnType<typeof sembrarTenant>>
let orgD: Awaited<ReturnType<typeof sembrarTenant>>
let orgE: Awaited<ReturnType<typeof sembrarTenant>>
let orgF: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente
let c: Cliente
let d: Cliente
let e: Cliente
let f1: Cliente
let f2: Cliente

// EL MISMO cuerpo para todas las organizaciones. Ver la cabecera: que los
// nombres coincidan es lo que convierte un fallo de aislamiento en un número al
// doble en vez de en una lista de nombres distinta.
const CUESTIONARIO_CINCO = {
  variasRazonesSociales: true,
  operacionYVentasJuntas: false,
  razonSocialPorRol: {
    ARRENDAMIENTOS: 'Rentas del Centro SA de CV',
    ACTIVOS: 'Activos del Centro SA de CV',
    LICENCIAS: 'Tramites del Centro SA de CV',
    OPERACION: 'Operadora del Centro SA de CV',
    VENTAS: 'Comercializadora del Centro SA de CV',
  },
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('bienva')
  orgB = await sembrarTenant('bienvb')
  orgC = await sembrarTenant('bienvc')
  orgD = await sembrarTenant('bienvd')
  orgE = await sembrarTenant('bienve')
  orgF = await sembrarTenant('bienvf')
  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  c = new Cliente()
  d = new Cliente()
  e = new Cliente()
  f1 = new Cliente()
  f2 = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  await c.entrar(orgC.usuarioEmail, PASSWORD_DEMO)
  await d.entrar(orgD.usuarioEmail, PASSWORD_DEMO)
  await e.entrar(orgE.usuarioEmail, PASSWORD_DEMO)
  // DOS sesiones de la MISMA persona: dos pestañas, o dos dispositivos. Es el
  // escenario que el `pg_advisory_xact_lock` existe para cubrir.
  await f1.entrar(orgF.usuarioEmail, PASSWORD_DEMO)
  await f2.entrar(orgF.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const contestar = (cli: Cliente, cuerpo: Record<string, unknown>) =>
  cli.pedir('/api/bienvenida/', { cuerpo })

// Cuenta POR ENCIMA de la RLS (pool de administración): es la única forma de
// ver a la vez las filas de las dos organizaciones y comprobar que ninguna se
// coló en la otra.
const filasDe = async (tenantId: string): Promise<number> =>
  Number(
    (
      await poolTest().query(
        'select count(*)::int n from entidades_fiscales where tenant_id = $1',
        [tenantId],
      )
    ).rows[0].n,
  )

// ─── 1 · AISLAMIENTO: el mismo cuerpo desde dos organizaciones ──────────────
describe('1 · el mismo cuestionario desde dos organizaciones no cruza ni una fila', () => {
  let deA: string[]
  let deB: string[]

  it('las dos lo contestan y las dos reciben 201 — la segunda NO recibe 409', async () => {
    // El 409 de la segunda sería el síntoma exacto de que `contarEntidades
    // DelTenant()` perdió su `and tenant_id`: la organización B vería el
    // recuento de A y el servidor le diría «ya tienes razones sociales
    // registradas» teniendo cero. No da error en ningún log y deja a un owner
    // sin poder registrar NUNCA su identidad fiscal.
    const rA = await contestar(a, CUESTIONARIO_CINCO)
    expect(rA.status, JSON.stringify(rA.datos)).toBe(201)
    const rB = await contestar(b, CUESTIONARIO_CINCO)
    expect(rB.status, JSON.stringify(rB.datos)).toBe(201)

    deA = rA.datos.entidades.map((x: any) => x.id)
    deB = rB.datos.entidades.map((x: any) => x.id)
    expect(deA).toHaveLength(5)
    expect(deB).toHaveLength(5)
    // Ni un id repetido entre las dos: son diez filas distintas.
    expect(new Set([...deA, ...deB]).size).toBe(10)
  })

  it('cada fila nace con el tenant de la sesión que la creó, no con el del cuerpo', async () => {
    const { rows } = await poolTest().query(
      'select id, tenant_id from entidades_fiscales where id = any($1::uuid[])',
      [[...deA, ...deB]],
    )
    const porId = new Map(rows.map((r: any) => [r.id, r.tenant_id]))
    for (const id of deA) expect(porId.get(id), `${id} deberia ser de A`).toBe(orgA.id)
    for (const id of deB) expect(porId.get(id), `${id} deberia ser de B`).toBe(orgB.id)
    expect(await filasDe(orgA.id)).toBe(5)
    expect(await filasDe(orgB.id)).toBe(5)
  })

  it('EL SINTOMA QUE IMPORTA · el estado de A dice 5, no 10', async () => {
    // Con nombres idénticos en las dos organizaciones, un fallo de aislamiento
    // NO se ve como una lista rara: se ve como este número al doble. Es el
    // mismo criterio con el que se escribió `reportes-rentabilidad.e2e`.
    const r = await a.pedir('/api/bienvenida/')
    expect(r.status).toBe(200)
    expect(r.datos.totalEntidades).toBe(5)
    expect(r.datos.pendiente).toBe(false)
    const ids = r.datos.entidades.map((x: any) => x.id)
    expect(ids.sort()).toEqual([...deA].sort())
    for (const id of deB) expect(ids).not.toContain(id)
  })

  it('y el de B dice 5 también — el corte va en las dos direcciones', async () => {
    const r = await b.pedir('/api/bienvenida/')
    expect(r.datos.totalEntidades).toBe(5)
    const ids = r.datos.entidades.map((x: any) => x.id)
    for (const id of deA) expect(ids).not.toContain(id)
  })

  it('PRUEBA NEGATIVA CLAVE · filtrar SOLO por id no alcanza la entidad de B', async () => {
    // Escrita a propósito SIN `and tenant_id`: es la consulta que escribiría
    // quien creyera que un uuid ya aísla. Con la RLS puesta devuelve cero
    // filas; si alguien la quitara, esta prueba es la que se pone roja. Va por
    // `poolApp()` (dentro de `comoTenant`), NUNCA por el pool de
    // administración: `spaces` es superusuario y se salta la RLS aunque la
    // tabla tenga FORCE.
    const desdeA = await comoTenant(orgA.id, (q) =>
      q('select id from entidades_fiscales where id = any($1::uuid[])', [deB]),
    )
    expect(desdeA).toEqual([])
    // Y el control positivo: desde B sí se ven. Sin él, un cero no distingue
    // «aislado» de «la consulta no encuentra nada por otro motivo».
    const desdeB = await comoTenant(orgB.id, (q) =>
      q('select id from entidades_fiscales where id = any($1::uuid[])', [deB]),
    )
    expect(desdeB).toHaveLength(5)
  })

  it('PRUEBA NEGATIVA CLAVE · ni los ROLES creados por el cuestionario', async () => {
    // `entidad_roles` es donde la tentación es mayor: `where entidad_id = $1`
    // parece bastar, y sin RLS devolvería los papeles fiscales de otra empresa
    // sin dar ningún error.
    const desdeA = await comoTenant(orgA.id, (q) =>
      q('select rol from entidad_roles where entidad_id = any($1::uuid[])', [deB]),
    )
    expect(desdeA).toEqual([])
    const desdeB = await comoTenant(orgB.id, (q) =>
      q('select rol from entidad_roles where entidad_id = any($1::uuid[])', [deB]),
    )
    expect(desdeB.map((r: any) => r.rol).sort()).toEqual([
      'ACTIVOS', 'ARRENDAMIENTOS', 'LICENCIAS', 'OPERACION', 'VENTAS',
    ])
  })

  it('sin contexto de tenant, las tablas CON DATOS devuelven cero filas', async () => {
    // Se comprueba que hay datos ANTES: si no, un cero no distingue «aislado»
    // de «vacío». Es el error que ya se cometió una vez en este arnés.
    const hay = await poolTest().query('select count(*)::int n from entidades_fiscales')
    expect(hay.rows[0].n).toBeGreaterThanOrEqual(10)
    const sinTenant = await poolApp().query('select count(*)::int n from entidades_fiscales')
    expect(sinTenant.rows[0].n).toBe(0)
    const rolesSinTenant = await poolApp().query('select count(*)::int n from entidad_roles')
    expect(rolesSinTenant.rows[0].n).toBe(0)
  })

  it('un `tenantId` en el cuerpo no elige la organización de destino', async () => {
    // Un `curl` se salta la pantalla entera. Si el POST aceptara el tenant del
    // cuerpo, cualquier usuario sembraría la identidad fiscal de otro owner.
    const r = await contestar(c, { ...CUESTIONARIO_CINCO, tenantId: orgB.id, tenant_id: orgB.id })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const ids = r.datos.entidades.map((x: any) => x.id)
    const { rows } = await poolTest().query(
      'select distinct tenant_id from entidades_fiscales where id = any($1::uuid[])',
      [ids],
    )
    expect(rows.map((x: any) => x.tenant_id)).toEqual([orgC.id])
    // Y B se quedó con las suyas: ni una más.
    expect(await filasDe(orgB.id)).toBe(5)
  })

  it('y escribir un rol en la entidad de OTRA organización lo rechaza la base', async () => {
    // El `with check` de la política. Sin él se podría colgar un rol del tenant
    // ajeno: escritura cruzada, no solo lectura.
    await expect(
      comoTenant(orgA.id, (q) =>
        q(`insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'VENTAS',$2)`, [
          deB[0],
          orgB.id,
        ]),
      ),
    ).rejects.toThrow()
  })
})

// ─── 2 · LA TRANSACCION REVIERTE DE VERDAD ─────────────────────────────────
//
//  La afirmación central del módulo, y la única que no se puede ver sin
//  Postgres: `crearEntidadesDelCuestionario` mete TODAS las entidades en un
//  `withTenantTx`. A medias es PEOR que no haberlo contestado, porque
//  «contestado» se DERIVA de que exista alguna entidad: quedaría una
//  organización con parte de su identidad fiscal escrita y sin forma de volver
//  a ofrecer el cuestionario.
//
//  ─── Por qué hace falta INYECTAR el fallo, y no vale un rol inválido ──────
//  El camino de error que la nota de la bóveda sugería —un rol fuera del
//  catálogo— no sirve para esto: `planDelCuestionario` lo rechaza ANTES de
//  abrir la transacción y devuelve 400 sin haber escrito nada, así que una
//  prueba montada así saldría verde con la transacción quitada. Sería verde por
//  vacuidad, que es justo lo que este repositorio ya se ha comido dos veces.
//
//  Lo que sí falla a mitad es cualquier cosa que reviente en el SEGUNDO insert
//  —un constraint que llegue mañana, un corte de conexión, un disparador—, y
//  eso se reproduce con un trigger de prueba que rechaza el segundo insert de
//  un tenant. El trigger se crea justo antes y se retira justo después: mientras
//  está puesto, ninguna otra prueba de este archivo escribe entidades.
describe('2 · un plan que falla a mitad no deja NI UNA fila', () => {
  const CREAR_TRIGGER = `
    create or replace function e2e_falla_en_la_segunda() returns trigger
    language plpgsql as $$
    begin
      if (select count(*) from entidades_fiscales where tenant_id = new.tenant_id) >= 1 then
        raise exception 'fallo inyectado: la segunda entidad del plan no entra';
      end if;
      return new;
    end $$;
    drop trigger if exists e2e_falla_segunda on entidades_fiscales;
    create trigger e2e_falla_segunda before insert on entidades_fiscales
      for each row execute function e2e_falla_en_la_segunda();`

  const QUITAR_TRIGGER = `
    drop trigger if exists e2e_falla_segunda on entidades_fiscales;
    drop function if exists e2e_falla_en_la_segunda();`

  it('el trigger de prueba deja pasar la PRIMERA y rechaza la SEGUNDA', async () => {
    // Se comprueba el arnés antes de usarlo: un trigger que rechazara también
    // la primera haría que la prueba de abajo saliera verde sin decir nada
    // sobre la transacción — el cero vendría de que nunca se escribió nada.
    await poolTest().query(CREAR_TRIGGER)
    try {
      await poolTest().query(
        `insert into entidades_fiscales (razon_social, tenant_id) values ('Canario 1 SA de CV', $1)`,
        [orgD.id],
      )
      await expect(
        poolTest().query(
          `insert into entidades_fiscales (razon_social, tenant_id) values ('Canario 2 SA de CV', $1)`,
          [orgD.id],
        ),
      ).rejects.toThrow(/fallo inyectado/)
    } finally {
      await poolTest().query(QUITAR_TRIGGER)
      await poolTest().query('delete from entidades_fiscales where tenant_id = $1', [orgD.id])
    }
    expect(await filasDe(orgD.id)).toBe(0)
  })

  it('el POST falla y la organización se queda en CERO entidades', async () => {
    expect(await filasDe(orgD.id), 'el escenario arranca en cero').toBe(0)
    await poolTest().query(CREAR_TRIGGER)
    let r: { status: number; datos: any }
    try {
      // Cinco razones sociales: la primera entra y la segunda revienta. Si la
      // transacción no existiera, la primera se quedaría escrita.
      r = await contestar(d, CUESTIONARIO_CINCO)
    } finally {
      await poolTest().query(QUITAR_TRIGGER)
    }
    expect(r.status, JSON.stringify(r.datos)).toBe(500)
    expect(await filasDe(orgD.id), 'la primera entidad del plan se quedó escrita').toBe(0)
    const roles = await poolTest().query(
      'select count(*)::int n from entidad_roles where tenant_id = $1',
      [orgD.id],
    )
    expect(roles.rows[0].n).toBe(0)
  })

  it('y el cuestionario SIGUE pendiente, que es el motivo de que sea atómico', async () => {
    // Es la consecuencia que hace cara la escritura a medias: «contestado» se
    // deriva de que exista alguna entidad, así que UNA fila huérfana cerraría
    // el cuestionario para siempre con la identidad fiscal a medio escribir.
    const est = await d.pedir('/api/bienvenida/')
    expect(est.status).toBe(200)
    expect(est.datos.pendiente).toBe(true)
    expect(est.datos.totalEntidades).toBe(0)
  })

  it('y con el trigger retirado, la misma organización lo contesta entero', async () => {
    const r = await contestar(d, CUESTIONARIO_CINCO)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await filasDe(orgD.id)).toBe(5)
  })
})

// ─── 3 · EL 409, CON EL CERROJO DE POR MEDIO ───────────────────────────────
describe('3 · contestarlo dos veces da 409 y no escribe ni una fila', () => {
  it('el primero entra con 201', async () => {
    const r = await contestar(e, CUESTIONARIO_CINCO)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await filasDe(orgE.id)).toBe(5)
  })

  it('el segundo POST es 409 y el recuento no se mueve', async () => {
    const r = await contestar(e, CUESTIONARIO_CINCO)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(String(r.datos?.error)).toMatch(/ya tiene razones sociales|ya se contest/i)
    expect(await filasDe(orgE.id)).toBe(5)
  })

  it('un cuerpo DISTINTO tampoco entra por la puerta de atrás', async () => {
    // El 409 no depende de que el cuerpo coincida: depende de que ya haya
    // entidades. Si dependiera del cuerpo, contestar dos veces con nombres
    // distintos duplicaría la identidad fiscal del negocio.
    const r = await contestar(e, {
      variasRazonesSociales: false,
      razonSocialUnica: 'Otra Cosa SA de CV',
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(await filasDe(orgE.id)).toBe(5)
  })

  it('DOS POST SIMULTANEOS · exactamente uno escribe, y quedan 5 filas', async () => {
    // Aquí es donde se ejercita `pg_advisory_xact_lock`. El recuento del
    // controller y los `insert` NO son la misma transacción, así que dos
    // pestañas pueden contar las dos cero y escribir las dos: serían DIEZ filas
    // y una identidad fiscal duplicada, sin un solo error en ningún log.
    //
    // La carrera puede resolverse en cualquiera de las dos puertas —la de
    // cortesía del controller o el cerrojo de dentro—, y el invariante que se
    // afirma es el mismo en los dos casos: un 201, un 409, cinco filas. Lo que
    // NO puede pasar es que haya dos 201 o diez filas.
    const [r1, r2] = await Promise.all([
      contestar(f1, CUESTIONARIO_CINCO),
      contestar(f2, CUESTIONARIO_CINCO),
    ])
    const estados = [r1.status, r2.status].sort()
    expect(estados, `${JSON.stringify(r1.datos)} | ${JSON.stringify(r2.datos)}`).toEqual([201, 409])
    expect(await filasDe(orgF.id), 'el cerrojo dejó escribir a las dos').toBe(5)
    const roles = await poolTest().query(
      'select count(*)::int n from entidad_roles where tenant_id = $1',
      [orgF.id],
    )
    expect(roles.rows[0].n).toBe(5)
  })

  it('y la carrera no se llevó por delante a las otras organizaciones', async () => {
    for (const org of [orgA, orgB, orgC, orgD, orgE]) {
      expect(await filasDe(org.id), org.slug).toBe(5)
    }
  })
})
