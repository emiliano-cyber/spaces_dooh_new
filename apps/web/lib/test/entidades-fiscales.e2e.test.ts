import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Las entidades fiscales del OWNER, contra Postgres real y con el rol de la app.
// ----------------------------------------------------------------------------
//  Un owner de SPACE OS reparte su operación entre varias razones sociales
//  PROPIAS: una paga las rentas, otra compra los activos, otra tramita las
//  licencias, otra vende. Hasta hoy el producto no guardaba ninguna.
//
//  Cuidado con la confusión que ya vive en el repositorio:
//  `arrendador_razon_social` es la razón social del ARRENDADOR —quien me cobra
//  la renta—. Estas son las del owner —quien la paga—. Son cosas distintas y
//  aquí se comprueba que no se mezclan.
//
//  ─── Por qué esto NO puede ser una unitaria ───────────────────────────────
//  Lo que hay que demostrar es aislamiento, y las unitarias simulan la base: los
//  dos peores fallos de aislamiento de este proyecto las pasaron sin
//  despeinarse. Se usa el pool de la APP (`poolApp`), NO el de administración:
//  el rol `spaces` es superusuario y se salta la RLS aunque la tabla tenga
//  FORCE, así que con él toda prueba de aislamiento pasa por casualidad.
//
//  ─── Y sobre todo: `entidad_id` NO es una frontera de seguridad ───────────
//  La frontera es UNA: `tenant_id` con RLS. El bloque 4 es el corazón de este
//  archivo: comprueba que una consulta acotada SOLO por `entidad_id` no alcanza
//  filas de otra organización. Si alguien quitara la RLS o el `and tenant_id`
//  creyendo que el uuid ya aísla, esas pruebas se ponen rojas.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let orgC: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente
let comercial: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('entidada')
  orgB = await sembrarTenant('entidadb')
  // Un rol SIN `administracion`: la identidad fiscal del negocio no es un dato
  // operativo y no la ve cualquiera.
  orgC = await sembrarTenant('entidadc', { rol: 'COMERCIAL' })
  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  comercial = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  await comercial.entrar(orgC.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const alta = (cli: Cliente, cuerpo: Record<string, unknown>) =>
  cli.pedir('/api/entidades/', { cuerpo })

const enBase = async (id: string) =>
  (
    await poolTest().query(
      'select id, tenant_id, razon_social, rfc, activo from entidades_fiscales where id = $1',
      [id],
    )
  ).rows[0]

// ─── 1 · el esquema ─────────────────────────────────────────────────────────
describe('1 · las dos tablas nuevas nacen fail-closed', () => {
  it('RLS activa y FORZADA en entidades_fiscales y entidad_roles', async () => {
    // FORCE no es adorno: sin él, el dueño de la tabla se salta su propia
    // política, y en producción las tablas las posee otro rol.
    const { rows } = await poolTest().query(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relname in ('entidades_fiscales','entidad_roles') order by relname`,
    )
    expect(rows).toEqual([
      { relname: 'entidad_roles', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'entidades_fiscales', relrowsecurity: true, relforcerowsecurity: true },
    ])
  })

  it('sin contexto de tenant, una tabla CON DATOS devuelve cero filas', async () => {
    // Se siembra ANTES de comprobar: si no, un cero no distingue «aislado» de
    // «vacío». Es el error que ya se cometió una vez en este arnés.
    await poolTest().query(
      `insert into entidades_fiscales (razon_social, tenant_id) values ('Canario RLS SA de CV', $1)`,
      [orgA.id],
    )
    const hay = await poolTest().query('select count(*)::int n from entidades_fiscales')
    expect(hay.rows[0].n).toBeGreaterThan(0)
    const sinTenant = await poolApp().query('select count(*)::int n from entidades_fiscales')
    expect(sinTenant.rows[0].n).toBe(0)
  })

  it('el catálogo de roles viene sembrado con los cinco de partida', async () => {
    const { rows } = await poolTest().query(
      'select rol from catalogo_roles_entidad order by rol',
    )
    expect(rows.map((r: any) => r.rol)).toEqual([
      'ACTIVOS', 'ARRENDAMIENTOS', 'LICENCIAS', 'OPERACION', 'VENTAS',
    ])
  })

  it('`contratos_arrendamiento.entidad_id` es NULLABLE, a propósito', async () => {
    // Las filas viejas se quedan sin entidad y eso es correcto: se pintan como
    // «sin asignar». Exigirla habría dejado inservible el módulo entero el día
    // del despliegue.
    const { rows } = await poolTest().query(
      `select is_nullable from information_schema.columns
        where table_name = 'contratos_arrendamiento' and column_name = 'entidad_id'`,
    )
    expect(rows[0]?.is_nullable).toBe('YES')
  })

  it('`facturas.entidad_emisora_id` existe y también es nullable', async () => {
    const { rows } = await poolTest().query(
      `select is_nullable from information_schema.columns
        where table_name = 'facturas' and column_name = 'entidad_emisora_id'`,
    )
    expect(rows[0]?.is_nullable).toBe('YES')
  })
})

// ─── 2 · el alta ────────────────────────────────────────────────────────────
describe('2 · el alta estampa la organización de la sesión', () => {
  it('crear una entidad la deja con el tenant_id de quien la creó', async () => {
    const r = await alta(a, {
      razonSocial: 'Arrendamientos del Centro SA de CV',
      rfc: 'XAXX010101000',
      roles: ['ARRENDAMIENTOS'],
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await enBase(r.datos.id)
    expect(fila.tenant_id).toBe(orgA.id)
    expect(fila.activo).toBe(true)
  })

  it('el tenant NO se puede elegir desde el cuerpo de la petición', async () => {
    // Un `curl` se salta la UI entera. Si el alta aceptara `tenantId`, cualquier
    // usuario podría sembrar filas en la organización de otro.
    const r = await alta(a, {
      razonSocial: 'Intento de colarse SA de CV',
      tenantId: orgB.id,
      tenant_id: orgB.id,
    })
    expect(r.status).toBe(201)
    expect((await enBase(r.datos.id)).tenant_id).toBe(orgA.id)
  })

  it('queda anotada en la bitácora de acciones', async () => {
    await alta(a, { razonSocial: 'Con bitácora SA de CV' })
    const { rows } = await poolTest().query(
      `select accion, entidad from acciones where tenant_id = $1 order by timestamp desc limit 5`,
      [orgA.id],
    )
    expect(rows.some((f: any) => /entidad fiscal/i.test(f.accion))).toBe(true)
  })

  it('una razón social vacía se rechaza con 400', async () => {
    const r = await alta(a, { razonSocial: '  ' })
    expect(r.status).toBe(400)
  })

  it('un RFC imposible se rechaza con 400', async () => {
    const r = await alta(a, { razonSocial: 'RFC malo SA de CV', rfc: 'XAXX021301000' })
    expect(r.status).toBe(400)
  })
})

// ─── 3 · roles ──────────────────────────────────────────────────────────────
describe('3 · una entidad puede tener VARIOS roles', () => {
  it('operación y ventas a la vez, que es el caso normal', async () => {
    const r = await alta(a, {
      razonSocial: 'Operadora y Ventas SA de CV',
      roles: ['OPERACION', 'VENTAS'],
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const { rows } = await poolTest().query(
      'select rol from entidad_roles where entidad_id = $1 order by rol',
      [r.datos.id],
    )
    expect(rows.map((f: any) => f.rol)).toEqual(['OPERACION', 'VENTAS'])
    expect(r.datos.roles).toEqual(['OPERACION', 'VENTAS'])
  })

  it('el rol duplicado se rechaza', async () => {
    const r = await alta(a, { razonSocial: 'Duplicada SA de CV', roles: ['VENTAS', 'VENTAS'] })
    expect([400, 409]).toContain(r.status)
    expect(String(r.datos?.error)).toMatch(/VENTAS/)
  })

  it('y la base lo impide por su cuenta, no solo el controller', async () => {
    // La restricción es el último cerrojo: si un día una ruta nueva insertara
    // roles sin pasar por el controller, esto sigue en pie.
    const e = await poolTest().query(
      `insert into entidades_fiscales (razon_social, tenant_id) values ('Cerrojo SA de CV', $1)
       returning id`,
      [orgA.id],
    )
    const id = e.rows[0].id
    await poolTest().query(
      `insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'ACTIVOS',$2)`,
      [id, orgA.id],
    )
    await expect(
      poolTest().query(
        `insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'ACTIVOS',$2)`,
        [id, orgA.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('un rol que no está en el catálogo no se inventa', async () => {
    const r = await alta(a, { razonSocial: 'Rol inventado SA de CV', roles: ['NOMINA'] })
    expect(r.status).toBe(400)
  })
})

// ─── 4 · EL CORAZÓN: entidad_id no aísla; tenant_id sí ──────────────────────
describe('4 · una entidad de otra organización no se ve, no se lee y no se toca', () => {
  let deB: string

  beforeAll(async () => {
    const r = await alta(b, { razonSocial: 'Solo de B SA de CV', roles: ['LICENCIAS'] })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    deB = r.datos.id
  })

  it('no aparece en el listado de A', async () => {
    const r = await a.pedir('/api/entidades/')
    expect(r.status).toBe(200)
    const ids = (r.datos.entidades ?? r.datos).map((e: any) => e.id)
    expect(ids).not.toContain(deB)
  })

  it('leerla por id desde A da 404, no la entidad', async () => {
    const r = await a.pedir(`/api/entidades/${deB}/`)
    expect([404, 405]).toContain(r.status)
  })

  it('editarla desde A da 404 y NO la modifica', async () => {
    const antes = await enBase(deB)
    const r = await a.pedir(`/api/entidades/${deB}/`, {
      metodo: 'PATCH',
      cuerpo: { razonSocial: 'Secuestrada SA de CV' },
    })
    expect(r.status).toBe(404)
    expect((await enBase(deB)).razon_social).toBe(antes.razon_social)
  })

  it('desactivarla desde A da 404 y la deja activa', async () => {
    const r = await a.pedir(`/api/entidades/${deB}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(404)
    expect((await enBase(deB)).activo).toBe(true)
  })

  it('PRUEBA NEGATIVA CLAVE · filtrar SOLO por id no alcanza otra organización', async () => {
    // Escrita a propósito sin `and tenant_id`: es la consulta que escribiría
    // quien creyera que un uuid ya aísla. Con la RLS puesta devuelve cero filas;
    // si alguien la quitara, esta prueba es la que se pone roja.
    const filas = await comoTenant(orgA.id, (q) =>
      q('select id from entidades_fiscales where id = $1', [deB]),
    )
    expect(filas).toEqual([])
  })

  it('PRUEBA NEGATIVA CLAVE · ni los ROLES por entidad_id suelto', async () => {
    // `entidad_roles` es donde la tentación es mayor: `where entidad_id = $1`
    // parece bastar. No basta — y sin RLS devolvería los papeles fiscales de
    // otra empresa sin dar ningún error.
    const dentroDeB = await comoTenant(orgB.id, (q) =>
      q('select rol from entidad_roles where entidad_id = $1', [deB]),
    )
    expect(dentroDeB.map((f: any) => f.rol)).toEqual(['LICENCIAS'])

    const desdeA = await comoTenant(orgA.id, (q) =>
      q('select rol from entidad_roles where entidad_id = $1', [deB]),
    )
    expect(desdeA).toEqual([])
  })

  it('y tampoco se puede ESCRIBIR un rol en la entidad de otro', async () => {
    // El `with check` de la política. Sin él se podría colgar un rol —o una
    // entidad— del tenant ajeno, que es escritura cruzada, no solo lectura.
    await expect(
      comoTenant(orgA.id, (q) =>
        q(`insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'VENTAS',$2)`, [
          deB,
          orgB.id,
        ]),
      ),
    ).rejects.toThrow()
  })
})

// ─── 5 · borrado lógico ─────────────────────────────────────────────────────
describe('5 · dar de baja una entidad no borra su historia', () => {
  it('DELETE apaga `activo` y la fila sigue ahí', async () => {
    const r = await alta(a, { razonSocial: 'Para dar de baja SA de CV' })
    const d = await a.pedir(`/api/entidades/${r.datos.id}/`, { metodo: 'DELETE' })
    expect(d.status, JSON.stringify(d.datos)).toBe(200)
    const fila = await enBase(r.datos.id)
    expect(fila).toBeDefined()
    expect(fila.activo).toBe(false)
  })

  it('y deja de venir en el listado por omisión', async () => {
    const r = await alta(a, { razonSocial: 'Baja y fuera SA de CV' })
    await a.pedir(`/api/entidades/${r.datos.id}/`, { metodo: 'DELETE' })
    const lista = await a.pedir('/api/entidades/')
    const ids = (lista.datos.entidades ?? lista.datos).map((e: any) => e.id)
    expect(ids).not.toContain(r.datos.id)
  })
})

// ─── 6 · los contratos viejos ───────────────────────────────────────────────
describe('6 · un contrato SIN entidad no rompe nada', () => {
  it('la semilla dejó su contrato con entidad_id nulo y sigue ahí', async () => {
    const { rows } = await poolTest().query(
      'select count(*)::int n from contratos_arrendamiento where tenant_id = $1 and entidad_id is null',
      [orgA.id],
    )
    expect(rows[0].n).toBeGreaterThan(0)
  })

  it('`/api/estado` sigue trayendo esos contratos', async () => {
    const r = await a.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.datos.contratos)).toBe(true)
    expect(r.datos.contratos.length).toBeGreaterThan(0)
  })

  it('asignar la entidad a un contrato funciona, y borrarla lo deja sin entidad', async () => {
    // La FK es ON DELETE SET NULL a propósito: un contrato no desaparece porque
    // se retire una razón social. Lo que NO puede pasar es que se lleve el
    // contrato por delante.
    const e = await alta(a, { razonSocial: 'Firmante SA de CV', roles: ['ARRENDAMIENTOS'] })
    const c = await poolTest().query(
      'select id from contratos_arrendamiento where tenant_id = $1 limit 1',
      [orgA.id],
    )
    await poolTest().query('update contratos_arrendamiento set entidad_id = $1 where id = $2', [
      e.datos.id,
      c.rows[0].id,
    ])
    await poolTest().query('delete from entidades_fiscales where id = $1', [e.datos.id])
    const { rows } = await poolTest().query(
      'select entidad_id from contratos_arrendamiento where id = $1',
      [c.rows[0].id],
    )
    expect(rows.length).toBe(1)
    expect(rows[0].entidad_id).toBeNull()
  })

  it('borrar la entidad se lleva SUS roles, y nada más', async () => {
    const e = await alta(a, { razonSocial: 'Con roles a borrar SA de CV', roles: ['ACTIVOS'] })
    await poolTest().query('delete from entidades_fiscales where id = $1', [e.datos.id])
    const { rows } = await poolTest().query(
      'select count(*)::int n from entidad_roles where entidad_id = $1',
      [e.datos.id],
    )
    expect(rows[0].n).toBe(0)
  })
})

// ─── 7 · permisos y /api/estado ─────────────────────────────────────────────
describe('7 · la identidad fiscal del negocio la ve quien administra', () => {
  it('la rebanada llega en `/api/estado` a quien tiene administración', async () => {
    await alta(a, { razonSocial: 'En el estado SA de CV' })
    const r = await a.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.datos.entidadesFiscales)).toBe(true)
    expect(r.datos.entidadesFiscales.length).toBeGreaterThan(0)
  })

  it('a un rol sin administración llega como ARREGLO VACÍO, no como clave ausente', async () => {
    // La forma del cuerpo es contrato con el store del front: una clave que
    // desaparece rompe la hidratación, y el efecto de seguridad es el mismo.
    const r = await comercial.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(r.datos).toHaveProperty('entidadesFiscales')
    expect(r.datos.entidadesFiscales).toEqual([])
  })

  it('y no puede crear entidades', async () => {
    const r = await alta(comercial, { razonSocial: 'No deberia entrar SA de CV' })
    expect([401, 403]).toContain(r.status)
  })

  it('sin sesión, ni listar ni crear', async () => {
    const anonimo = new Cliente()
    expect((await anonimo.pedir('/api/entidades/')).status).toBe(401)
    expect((await alta(anonimo, { razonSocial: 'Anónima SA de CV' })).status).toBe(401)
  })
})
