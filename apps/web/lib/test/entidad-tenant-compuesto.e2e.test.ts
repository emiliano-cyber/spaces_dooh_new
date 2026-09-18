import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, comoTenant } from './db-e2e'
import { sembrarTenant } from './semillas-e2e'

// ============================================================================
//  El agujero de las claves ajenas hacia `entidades_fiscales`.
// ----------------------------------------------------------------------------
//  MEDIDO el 2026-09-18 con el rol `spaces_app` dentro de una transaccion que
//  se deshizo. Con `app.tenant_id = B`:
//
//    select razon_social from entidades_fiscales;   -> solo las de B   (la RLS lee bien)
//    insert into entidad_roles (entidad_id, rol, tenant_id)
//      values (<entidad de A>, 'VENTAS', <B>);      -> INSERT 0 1      <- PASABA
//
//  Por que pasaba, y por que la RLS no lo ve: la politica `tenant_isolation`
//  filtra por `tenant_id`, y la fila que se escribe LLEVA el tenant correcto
//  (B). Lo que apunta a otra organizacion es `entidad_id`, y eso lo comprueba
//  la clave ajena — que en PostgreSQL corre como DUEÑO de la tabla y por tanto
//  ELUDE la politica. La FK era plana contra `(id)`, asi que solo exigia que la
//  fila existiera EN ALGUN SITIO, no que fuera de esta organizacion.
//
//  ─── Por que esto NO puede ser una unitaria ───────────────────────────────
//  Lo que hay que demostrar es integridad referencial acotada por tenant, y las
//  unitarias simulan la base: no hay FK que comprobar en un doble. Se usa el
//  pool de la APP (`comoTenant` -> `poolApp`), NUNCA el de administracion: el
//  rol `spaces` es superusuario y se salta la RLS aunque la tabla tenga FORCE,
//  asi que con el estas pruebas pasarian por casualidad.
//
//  ─── Y es un fallo R2 de libro: NO DA ERROR ───────────────────────────────
//  Hoy no se alcanza desde la aplicacion porque `entidades-repo.ts` valida el
//  tenant antes de escribir. Se vuelve alcanzable en cuanto una pantalla cablee
//  un selector de entidad, que es justo lo que se esta construyendo. El cierre
//  es estructural —`unique (id, tenant_id)` y las tres FK repuntadas a la
//  pareja— para que no dependa de que nadie olvide una validacion.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
// La entidad fiscal de A: el objetivo del cruce.
let entidadDeA: string
// La de B: el control positivo, para que el rojo no sea «todo falla».
let entidadDeB: string
// Un contrato y un comprobante de B, a los que se intentara colgar la de A.
let contratoDeB: string
let facturaDeB: string

beforeAll(async () => {
  await recrearEsquema()
  orgA = await sembrarTenant('cruzada')
  orgB = await sembrarTenant('cruzadb')

  const p = poolTest()
  const alta = async (tenantId: string, razon: string) =>
    (
      await p.query(
        `insert into entidades_fiscales (tenant_id, razon_social) values ($1,$2) returning id`,
        [tenantId, razon],
      )
    ).rows[0].id as string

  entidadDeA = await alta(orgA.id, 'Entidad de A SA de CV')
  entidadDeB = await alta(orgB.id, 'Entidad de B SA de CV')

  contratoDeB = (
    await p.query(
      `select id from contratos_arrendamiento where tenant_id = $1 limit 1`,
      [orgB.id],
    )
  ).rows[0].id
  // `facturas.campana_id` es NOT NULL: en este producto un comprobante siempre
  // sale de una campaña. Hace falta una para poder emitirlo.
  const campanaDeB = (
    await p.query(
      `insert into campanas (nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
       values ('Campana de B', $1, current_date, current_date + 30, $2) returning id`,
      [orgB.clienteId, orgB.id],
    )
  ).rows[0].id
  facturaDeB = (
    await p.query(
      `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, moneda,
                             fecha_emision, estatus, tenant_id)
       values ('F-CRUZ-1', $1, $2, 1000, 160, 1160, 'MXN', current_date, 'EMITIDA', $3)
       returning id`,
      [campanaDeB, orgB.clienteId, orgB.id],
    )
  ).rows[0].id
}, 180_000)

afterAll(async () => {
  await cerrarPool()
})

// ─── 1 · la pareja sobre la que se pueden componer las FK ───────────────────
describe('1 · entidades_fiscales expone la pareja (id, tenant_id)', () => {
  it('tiene un unique (id, tenant_id), no solo la PK sobre (id)', async () => {
    // Sin esta restriccion las FK NO SE PUEDEN componer: PostgreSQL exige que
    // las columnas referenciadas sean clave unica. Es la pieza que faltaba, y
    // por eso las tres FK nacieron planas.
    const { rows } = await poolTest().query(
      `select conname, pg_get_constraintdef(oid) as def
         from pg_constraint
        where conrelid = 'entidades_fiscales'::regclass
          and contype in ('p','u')`,
    )
    const defs = rows.map((r) => String(r.def).replace(/\s+/g, ' '))
    expect(defs.some((d) => /UNIQUE \(id, tenant_id\)/i.test(d))).toBe(true)
  })
})

// ─── 2 · las tres FK apuntan a la pareja ────────────────────────────────────
describe('2 · las tres claves ajenas van contra (id, tenant_id)', () => {
  const esperadas: [string, string][] = [
    ['entidad_roles', 'entidad_id'],
    ['contratos_arrendamiento', 'entidad_id'],
    ['facturas', 'entidad_emisora_id'],
  ]

  for (const [tabla, columna] of esperadas) {
    it(`${tabla}.${columna} referencia (id, tenant_id)`, async () => {
      const { rows } = await poolTest().query(
        `select pg_get_constraintdef(oid) as def
           from pg_constraint
          where conrelid = $1::regclass
            and confrelid = 'entidades_fiscales'::regclass`,
        [tabla],
      )
      expect(rows.length).toBeGreaterThan(0)
      const def = String(rows[0].def).replace(/\s+/g, ' ')
      // Las dos mitades: la columna de tenant viaja en la FK Y el destino es la
      // pareja. Con una sola de las dos la comprobacion seguiria siendo plana.
      expect(def).toMatch(new RegExp(`\\(${columna}, tenant_id\\)`, 'i'))
      expect(def).toMatch(/entidades_fiscales\(id, tenant_id\)/i)
    })
  }
})

// ─── 3 · EL AGUJERO MEDIDO ──────────────────────────────────────────────────
describe('3 · desde B no se puede colgar nada de la entidad de A', () => {
  it('PRUEBA NEGATIVA CLAVE · el rol cruzado que PASABA ahora falla', async () => {
    // Literalmente el insert de la medicion: tenant_id correcto (B), entidad
    // ajena (A). La RLS lo deja pasar porque el tenant cuadra; lo tiene que
    // parar la FK compuesta.
    await expect(
      comoTenant(orgB.id, (q) =>
        q(`insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'VENTAS',$2)`, [
          entidadDeA,
          orgB.id,
        ]),
      ),
    ).rejects.toThrow()
  })

  it('PRUEBA NEGATIVA CLAVE · ni un contrato de B puede pagar con la entidad de A', async () => {
    // El contrato es de B y la columna que se escribe es `entidad_id`: la renta
    // quedaria atribuida a una sociedad de otra organizacion sin un solo error.
    await expect(
      comoTenant(orgB.id, (q) =>
        q(`update contratos_arrendamiento set entidad_id = $1 where id = $2`, [
          entidadDeA,
          contratoDeB,
        ]),
      ),
    ).rejects.toThrow()
    const { rows } = await poolTest().query(
      'select entidad_id from contratos_arrendamiento where id = $1',
      [contratoDeB],
    )
    expect(rows[0].entidad_id).toBeNull()
  })

  it('PRUEBA NEGATIVA CLAVE · ni un comprobante de B puede emitirlo la entidad de A', async () => {
    await expect(
      comoTenant(orgB.id, (q) =>
        q(`update facturas set entidad_emisora_id = $1 where id = $2`, [entidadDeA, facturaDeB]),
      ),
    ).rejects.toThrow()
    const { rows } = await poolTest().query(
      'select entidad_emisora_id from facturas where id = $1',
      [facturaDeB],
    )
    expect(rows[0].entidad_emisora_id).toBeNull()
  })
})

// ─── 4 · el control positivo ────────────────────────────────────────────────
// Sin este bloque el de arriba se podria satisfacer rompiendo la escritura
// entera, que no es lo que se pide: lo que tiene que discriminar la FK es DE
// QUIEN es la entidad.
describe('4 · con su PROPIA entidad, B escribe sin problema', () => {
  it('el rol propio entra', async () => {
    const filas = await comoTenant(orgB.id, (q) =>
      q(
        `insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,'VENTAS',$2) returning rol`,
        [entidadDeB, orgB.id],
      ),
    )
    expect(filas.map((f: any) => f.rol)).toEqual(['VENTAS'])
  })

  it('el contrato propio la acepta como pagadora', async () => {
    await comoTenant(orgB.id, (q) =>
      q(`update contratos_arrendamiento set entidad_id = $1 where id = $2`, [
        entidadDeB,
        contratoDeB,
      ]),
    )
    const { rows } = await poolTest().query(
      'select entidad_id from contratos_arrendamiento where id = $1',
      [contratoDeB],
    )
    expect(rows[0].entidad_id).toBe(entidadDeB)
  })

  it('el comprobante propio la acepta como emisora', async () => {
    await comoTenant(orgB.id, (q) =>
      q(`update facturas set entidad_emisora_id = $1 where id = $2`, [entidadDeB, facturaDeB]),
    )
    const { rows } = await poolTest().query(
      'select entidad_emisora_id from facturas where id = $1',
      [facturaDeB],
    )
    expect(rows[0].entidad_emisora_id).toBe(entidadDeB)
  })

  it('y «sin asignar» sigue siendo legitimo: NULL entra', async () => {
    // Las filas anteriores al 17/09 estan asi, y la FK compuesta con MATCH
    // SIMPLE no se comprueba cuando alguna de sus columnas es NULL. Si alguien
    // la escribiera MATCH FULL, `tenant_id` (not null) forzaria a que toda fila
    // tuviera entidad y el modulo quedaria inservible hacia atras.
    await comoTenant(orgB.id, (q) =>
      q(`update contratos_arrendamiento set entidad_id = null where id = $1`, [contratoDeB]),
    )
    const { rows } = await poolTest().query(
      'select entidad_id from contratos_arrendamiento where id = $1',
      [contratoDeB],
    )
    expect(rows[0].entidad_id).toBeNull()
  })
})
