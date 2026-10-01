import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, URL_TEST } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { ordenar } from '../../../../scripts/migrar.mjs'

// ============================================================================
//  COD-03 · EL CUPÓN NACE PENDIENTE Y LO APRUEBA UN GERENTE — contra Postgres
//  de verdad.  Decisiones del dueño del 2026-09-30.
// ----------------------------------------------------------------------------
//  Es ROJO por triple —migración, tenant y dinero—, y lo que estas pruebas
//  defienden es una sola frase: **el cliente nunca ve, ni firma, un descuento
//  que nadie aprobó.** Las unitarias simulan la base; aquí se mide:
//
//   · que el JSON de la liga pública NO trae el código mientras está pendiente
//     —no que la pantalla lo esconda: que no VIAJA—, y que el total va sin él;
//   · que el VENDEDOR aplica pero no decide (403), y el GERENTE sí;
//   · que rechazar devuelve el uso de verdad (`canjes_codigo` es el contador);
//   · que una RECHAZADA con cupón vuelve a BORRADOR;
//   · que si el cliente acepta con el cupón pendiente, lo firmado (snapshot) y
//     lo cobrado (reservas) van SIN el descuento, y el uso vuelve al cupón;
//   · que aprobar por dentro con el cupón pendiente es 409;
//   · que otra organización no alcanza nada (404);
//   · y que la migración deja APROBADOS los cupones que ya existían.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let cDueno: Cliente
let cVend: Cliente
let cGer: Cliente
let cBeta: Cliente
let gerenteId: string

const correo = (quien: string) => `${quien}@cupapr.test`

async function sembrarUsuario(nombre: string, quien: string, rol: string): Promise<string> {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )
  return r.rows[0].id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('cupapralfa')
  beta = await sembrarTenant('cupaprbeta')
  // Decisión 3 del dueño: aprueban «los cuatro» que tienen `comercial.aprobar`.
  // Aquí van el más bajo de los cuatro (GERENTE_VENTAS) y quien NO debe poder
  // (VENDEDOR), en la MISMA organización: el permiso es lo único que cambia.
  await sembrarUsuario('Vera Vendedora', 'vendedora', 'VENDEDOR')
  gerenteId = await sembrarUsuario('Gael Gerente', 'gerente', 'GERENTE_VENTAS')

  await arrancarServidor()
  cDueno = new Cliente()
  cVend = new Cliente()
  cGer = new Cliente()
  cBeta = new Cliente()
  await cDueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cVend.entrar(correo('vendedora'), PASSWORD_DEMO)
  await cGer.entrar(correo('gerente'), PASSWORD_DEMO)
  await cBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function sembrarCupon(codigo: string, pct: number, usos: number | null): Promise<string> {
  const r = await poolTest().query(
    `insert into codigos_promocionales
       (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
     values ($1,$2,$3,$4::date,$5::date,$6) returning id`,
    [alfa.id, codigo, pct, enDias(-5), enDias(30), usos],
  )
  return r.rows[0].id as string
}

/** 100 000 de lista exactos (en `spot`, ver `codigo-promocional.e2e.test.ts`). */
async function crearPropuesta(c: Cliente): Promise<{ id: string; token: string }> {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: 'Cotizacion con cupon por aprobar',
      clienteId: alfa.clienteId,
      fechaInicio: enDias(3),
      fechaFin: enDias(33),
      items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 100000, cantidad: 1 }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  const t = await poolTest().query('select token_publico from propuestas where id=$1', [r.datos.id])
  return { id: r.datos.id as string, token: t.rows[0].token_publico as string }
}

const fila = async (id: string) =>
  (
    await poolTest().query(
      `select estatus, codigo_texto, codigo_descuento_pct, codigo_estado, codigo_aprobado_por,
              codigo_aprobado_en, snapshot_economico
         from propuestas where id=$1`,
      [id],
    )
  ).rows[0]

const usosDe = async (cuponId: string) =>
  Number(
    (await poolTest().query('select count(*)::int n from canjes_codigo where codigo_id=$1', [cuponId]))
      .rows[0].n,
  )

const acciones = async (patron: string) =>
  (
    await poolTest().query(
      `select accion, entidad, usuario_nombre from acciones
        where tenant_id=$1 and (accion ilike $2 or entidad ilike $2) order by timestamp`,
      [alfa.id, `%${patron}%`],
    )
  ).rows

const publica = (token: string) => new Cliente().pedir(`/api/propuestas/publica/${token}/`)

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración', () => {
  it('las tres columnas existen, y los tres CHECK', async () => {
    const c = await poolTest().query(
      `select column_name from information_schema.columns
        where table_name='propuestas'
          and column_name in ('codigo_estado','codigo_aprobado_por','codigo_aprobado_en')
        order by 1`,
    )
    expect(c.rows.map((r) => r.column_name)).toEqual([
      'codigo_aprobado_en',
      'codigo_aprobado_por',
      'codigo_estado',
    ])
    const k = await poolTest().query(
      `select conname from pg_constraint where conrelid='propuestas'::regclass
          and conname like 'propuestas_codigo_%' order by 1`,
    )
    const nombres = k.rows.map((r) => r.conname)
    for (const n of [
      'propuestas_codigo_aprobado_ck',
      'propuestas_codigo_aprobado_por_fkey',
      'propuestas_codigo_estado_ck',
      'propuestas_codigo_revision_ck',
    ]) {
      expect(nombres).toContain(n)
    }
  })

  it('la base rechaza un cupón sin estado, un estado sin cupón y un APROBADO sin fecha', async () => {
    const { id } = await crearPropuesta(cDueno)
    await expect(
      poolTest().query(`update propuestas set codigo_estado='PENDIENTE' where id=$1`, [id]),
    ).rejects.toThrow(/codigo_revision_ck/)
    await expect(
      poolTest().query(
        `update propuestas set codigo_texto='X', codigo_descuento_pct=10, codigo_canjeado_en=now()
          where id=$1`,
        [id],
      ),
    ).rejects.toThrow(/codigo_revision_ck/)
    await expect(
      poolTest().query(
        `update propuestas set codigo_texto='X', codigo_descuento_pct=10, codigo_canjeado_en=now(),
                codigo_estado='APROBADO' where id=$1`,
        [id],
      ),
    ).rejects.toThrow(/codigo_aprobado_ck/)
    await expect(
      poolTest().query(
        `update propuestas set codigo_texto='X', codigo_descuento_pct=10, codigo_canjeado_en=now(),
                codigo_estado='aprobado' where id=$1`,
        [id],
      ),
    ).rejects.toThrow(/codigo_estado_ck/)
  })

  it('⚠️ en una base con un cupón YA aplicado, lo deja APROBADO (el cliente ya lo vio)', async () => {
    // Base desechable aparte: hay que aplicar la historia HASTA la anterior,
    // sembrar un cupón con la forma de antes, y solo entonces la nueva. En la
    // base del arnés la nueva ya corrió y no habría nada que rellenar.
    const BASE = 'spaces_cupapr_backfill_e2e'
    const urlDe = (b: string) => {
      const u = new URL(URL_TEST)
      u.pathname = `/${b}`
      return u.toString()
    }
    const admin = poolTest()
    await admin.query(`drop database if exists ${BASE} with (force)`)
    await admin.query(`create database ${BASE}`)
    // Un `Client` y no un `Pool`: se cierra ANTES del `drop ... with (force)`,
    // así que no queda ninguna conexión ociosa que reciba el 57P01 (ver
    // `lib/test/pool-e2e.ts`).
    const c = new Client({ connectionString: urlDe(BASE) })
    await c.connect()
    try {
      const raiz = join(process.cwd(), '..', '..', 'db')
      await c.query(readFileSync(join(raiz, 'dev-rol-app.sql'), 'utf8'))
      await c.query(readFileSync(join(raiz, 'schema.sql'), 'utf8'))
      await c.query(readFileSync(join(raiz, 'semilla-desarrollo.sql'), 'utf8'))
      const NUEVA = '20261003_codigo_aprobacion.sql'
      const todas: string[] = ordenar(
        readdirSync(join(raiz, 'migrations')).filter((f) => f.endsWith('.sql')),
      )
      const i = todas.indexOf(NUEVA)
      expect(i, 'la migración nueva no está en el directorio').toBeGreaterThan(-1)
      for (const f of todas.slice(0, i)) {
        await c.query(readFileSync(join(raiz, 'migrations', f), 'utf8'))
      }
      const t = (await c.query('select id from tenants limit 1')).rows[0].id
      const vieja = (
        await c.query(
          `insert into propuestas (folio, nombre, tenant_id, codigo_texto, codigo_descuento_pct,
                                   codigo_canjeado_en)
           values ('PR-BF-1','de ayer',$1,'AYER20',20, now() - interval '2 days')
           returning id, codigo_canjeado_en`,
          [t],
        )
      ).rows[0]
      const sin = (
        await c.query(`insert into propuestas (folio, nombre, tenant_id) values ('PR-BF-2','sin',$1) returning id`, [t])
      ).rows[0]

      const sql = readFileSync(join(raiz, 'migrations', NUEVA), 'utf8')
      await c.query(sql)
      await c.query(sql) // idempotente: la segunda corrida no cambia nada

      const f = (
        await c.query(
          'select codigo_estado, codigo_aprobado_por, codigo_aprobado_en from propuestas where id=$1',
          [vieja.id],
        )
      ).rows[0]
      expect(f.codigo_estado).toBe('APROBADO')
      expect(f.codigo_aprobado_por).toBeNull()
      expect(new Date(f.codigo_aprobado_en).getTime()).toBe(new Date(vieja.codigo_canjeado_en).getTime())
      const g = (await c.query('select codigo_estado from propuestas where id=$1', [sin.id])).rows[0]
      expect(g.codigo_estado).toBeNull()
    } finally {
      await c.end()
      await admin.query(`drop database if exists ${BASE} with (force)`)
    }
  }, 120_000)
})

// ─── 2 · EL VENDEDOR APLICA → PENDIENTE, Y EL CLIENTE NO LO VE ─────────────

describe('2 · aplicado por el vendedor: PENDIENTE e invisible para el cliente', () => {
  let prop: { id: string; token: string }
  let cupon: string

  it('el vendedor aplica el cupón y nace PENDIENTE', async () => {
    cupon = await sembrarCupon('APR20', 20, 5)
    prop = await crearPropuesta(cVend)
    const r = await cVend.pedir(`/api/propuestas/${prop.id}/codigo/`, { cuerpo: { codigo: 'APR20' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.estado).toBe('PENDIENTE')
    const f = await fila(prop.id)
    expect(f.codigo_estado).toBe('PENDIENTE')
    expect(f.codigo_texto).toBe('APR20')
    expect(f.codigo_aprobado_por).toBeNull()
    expect(await usosDe(cupon)).toBe(1)
  })

  it('⚠️ el JSON público NO trae el código —en ningún campo— y el total va SIN descuento', async () => {
    const pub = await publica(prop.token)
    expect(pub.status, JSON.stringify(pub.datos)).toBe(200)
    expect(pub.datos.codigoTexto).toBeNull()
    expect(Number(pub.datos.codigoDescuentoPct)).toBe(0)
    expect(Number(pub.datos.codigoDescuentoMonto)).toBe(0)
    expect(JSON.stringify(pub.datos)).not.toContain('APR20')
    expect(Number(pub.datos.base)).toBe(100_000)
    expect(Number(pub.datos.total)).toBe(116_000)
  })

  it('la lectura interna dice PENDIENTE, y quién puede decidir lo calcula el servidor', async () => {
    const v = await cVend.pedir(`/api/propuestas/${prop.id}/codigo/`)
    expect(v.status, JSON.stringify(v.datos)).toBe(200)
    expect(v.datos.codigoEstado).toBe('PENDIENTE')
    expect(v.datos.puedeAprobarCodigo).toBe(false)
    const g = await cGer.pedir(`/api/propuestas/${prop.id}/codigo/`)
    expect(g.datos.codigoEstado).toBe('PENDIENTE')
    expect(g.datos.puedeAprobarCodigo).toBe(true)
  })

  it('el VENDEDOR no puede decidir: 403, y sigue PENDIENTE', async () => {
    const r = await cVend.pedir(`/api/propuestas/${prop.id}/codigo/decision/`, {
      cuerpo: { decision: 'APROBAR' },
    })
    expect(r.status).toBe(403)
    expect((await fila(prop.id)).codigo_estado).toBe('PENDIENTE')
  })

  it('aprobar la propuesta POR DENTRO con el cupón pendiente → 409, y no se congela nada', async () => {
    const r = await cDueno.pedir(`/api/propuestas/${prop.id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(String(r.datos.error)).toMatch(/Primero aprueba o rechaza el código promocional/)
    const f = await fila(prop.id)
    expect(f.estatus).toBe('BORRADOR')
    expect(f.snapshot_economico).toBeNull()
  })

  it('el GERENTE aprueba → APROBADO, por él y con fecha, y queda en Actividad', async () => {
    const r = await cGer.pedir(`/api/propuestas/${prop.id}/codigo/decision/`, {
      cuerpo: { decision: 'APROBAR' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await fila(prop.id)
    expect(f.codigo_estado).toBe('APROBADO')
    expect(f.codigo_aprobado_por).toBe(gerenteId)
    expect(f.codigo_aprobado_en).not.toBeNull()
    const log = await acciones('Aprobó el código promocional APR20')
    expect(log.length).toBe(1)
    expect(log[0].usuario_nombre).toBe('Gael Gerente')
    const g = await cGer.pedir(`/api/propuestas/${prop.id}/codigo/`)
    expect(g.datos.codigoAprobadoPor).toBe('Gael Gerente')
  })

  it('…y AHORA el cliente sí lo ve, con el total rebajado', async () => {
    const pub = await publica(prop.token)
    expect(pub.datos.codigoTexto).toBe('APR20')
    expect(Number(pub.datos.codigoDescuentoMonto)).toBe(20_000)
    expect(Number(pub.datos.base)).toBe(80_000)
    expect(Number(pub.datos.total)).toBe(92_800)
  })

  it('decidir otra vez sobre un APROBADO → 409', async () => {
    const r = await cGer.pedir(`/api/propuestas/${prop.id}/codigo/decision/`, {
      cuerpo: { decision: 'RECHAZAR', motivo: 'me arrepentí' },
    })
    expect(r.status).toBe(409)
    expect((await fila(prop.id)).codigo_estado).toBe('APROBADO')
  })

  it('con el cupón APROBADO, aprobar la propuesta por dentro sí funciona y congela el descuento', async () => {
    const r = await cDueno.pedir(`/api/propuestas/${prop.id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const s = (await fila(prop.id)).snapshot_economico
    expect(s.codigoTexto).toBe('APR20')
    expect(Number(s.base)).toBe(80_000)
  })
})

// ─── 3 · RECHAZAR EL CUPÓN DEVUELVE EL USO ─────────────────────────────────

describe('3 · rechazar exige motivo, quita el cupón y devuelve el uso', () => {
  it('sin motivo → 400, y nada cambia', async () => {
    const cupon = await sembrarCupon('RECH1', 15, 1)
    const p = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'RECH1' } })).status).toBe(200)
    const r = await cGer.pedir(`/api/propuestas/${p.id}/codigo/decision/`, { cuerpo: { decision: 'RECHAZAR' } })
    expect(r.status).toBe(400)
    const r2 = await cGer.pedir(`/api/propuestas/${p.id}/codigo/decision/`, {
      cuerpo: { decision: 'RECHAZAR', motivo: '   ' },
    })
    expect(r2.status).toBe(400)
    expect((await fila(p.id)).codigo_estado).toBe('PENDIENTE')
    expect(await usosDe(cupon)).toBe(1)
  })

  it('con motivo → se quita, el uso VUELVE (otra propuesta puede usar el único uso) y el motivo queda escrito', async () => {
    const cupon = await sembrarCupon('RECH2', 15, 1)
    const p1 = await crearPropuesta(cVend)
    const p2 = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${p1.id}/codigo/`, { cuerpo: { codigo: 'RECH2' } })).status).toBe(200)
    // Agotado mientras p1 lo retenga, aunque esté PENDIENTE: el canje se cuenta al aplicar.
    expect((await cVend.pedir(`/api/propuestas/${p2.id}/codigo/`, { cuerpo: { codigo: 'RECH2' } })).status).toBe(400)

    const r = await cGer.pedir(`/api/propuestas/${p1.id}/codigo/decision/`, {
      cuerpo: { decision: 'RECHAZAR', motivo: 'el cliente no califica para la promo' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await fila(p1.id)
    expect(f.codigo_texto).toBeNull()
    expect(f.codigo_estado).toBeNull()
    expect(Number(f.codigo_descuento_pct)).toBe(0)
    expect(await usosDe(cupon)).toBe(0)
    const log = await acciones('Rechazó el código promocional RECH2')
    expect(log.length).toBe(1)
    expect(`${log[0].accion} ${log[0].entidad}`).toMatch(/el cliente no califica para la promo/)

    expect((await cVend.pedir(`/api/propuestas/${p2.id}/codigo/`, { cuerpo: { codigo: 'RECH2' } })).status).toBe(200)
  })

  it('un campo de más en la decisión → 400 (el esquema es estricto)', async () => {
    await sembrarCupon('RECH3', 15, 5)
    const p = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'RECH3' } })).status).toBe(200)
    const r = await cGer.pedir(`/api/propuestas/${p.id}/codigo/decision/`, {
      cuerpo: { decision: 'APROBAR', descuentoPct: 90 },
    })
    expect(r.status).toBe(400)
    expect((await fila(p.id)).codigo_estado).toBe('PENDIENTE')
  })
})

// ─── 4 · RECHAZADA + CUPÓN → BORRADOR ──────────────────────────────────────

describe('4 · un cupón reactiva una propuesta RECHAZADA', () => {
  it('RECHAZADA + cupón → BORRADOR, con el cupón PENDIENTE y la línea en Actividad', async () => {
    await sembrarCupon('REVIVE10', 10, 5)
    const p = await crearPropuesta(cVend)
    const rech = await cVend.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'RECHAZADA' } })
    expect(rech.status, JSON.stringify(rech.datos)).toBe(200)
    expect((await fila(p.id)).estatus).toBe('RECHAZADA')

    const r = await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'REVIVE10' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.reactivada).toBe(true)
    const f = await fila(p.id)
    expect(f.estatus).toBe('BORRADOR')
    expect(f.codigo_estado).toBe('PENDIENTE')
    expect((await acciones('Reactivó la propuesta con el código REVIVE10')).length).toBe(1)
  })

  it('si el canje falla, la RECHAZADA se queda RECHAZADA', async () => {
    const p = await crearPropuesta(cVend)
    await cVend.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'RECHAZADA' } })
    const r = await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'NOEXISTE77' } })
    expect(r.status).toBe(400)
    expect((await fila(p.id)).estatus).toBe('RECHAZADA')
  })
})

// ─── 5 · EL CLIENTE ACEPTA CON EL CUPÓN PENDIENTE ──────────────────────────

describe('5 · ⚠️ el cliente acepta con el cupón PENDIENTE: firma el precio que vio', () => {
  let p: { id: string; token: string }
  let cupon: string

  it('acepta → APROBADA, el cupón se quita y su uso vuelve', async () => {
    cupon = await sembrarCupon('ACEPTA25', 25, 3)
    p = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'ACEPTA25' } })).status).toBe(200)
    expect(
      (await cVend.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })).status,
    ).toBe(200)
    expect(await usosDe(cupon)).toBe(1)

    // El cliente ve 116 000 —sin cupón— y acepta eso.
    expect(Number((await publica(p.token)).datos.total)).toBe(116_000)
    const r = await new Cliente().pedir(`/api/propuestas/publica/${p.token}/`, {
      cuerpo: { nombre: 'Clara Cliente' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const f = await fila(p.id)
    expect(f.estatus).toBe('APROBADA')
    expect(f.codigo_texto).toBeNull()
    expect(f.codigo_estado).toBeNull()
    expect(Number(f.codigo_descuento_pct)).toBe(0)
    expect(await usosDe(cupon)).toBe(0)
    const log = await acciones('sin el código ACEPTA25')
    expect(log.length).toBe(1)
  })

  it('el SNAPSHOT congelado va sin el descuento', async () => {
    const s = (await fila(p.id)).snapshot_economico
    expect(s).toBeTruthy()
    expect(Object.keys(s)).not.toContain('codigoTexto')
    expect(Number(s.base)).toBe(100_000)
    expect(Number(s.total)).toBe(116_000)
  })

  it('…y la CAMPAÑA cobra lo que se firmó: sin el descuento', async () => {
    const gen = await cDueno.pedir(`/api/propuestas/${p.id}/generar-campana/`, { cuerpo: {} })
    expect([200, 201], JSON.stringify(gen.datos)).toContain(gen.status)
    const r = await poolTest().query(
      `select r.precio, r.codigo_descuento_pct from reservas r join campanas c on c.id = r.campana_id
        where c.propuesta_id = $1`,
      [p.id],
    )
    expect(r.rows).toHaveLength(1)
    expect(Number(r.rows[0].precio)).toBe(100_000)
    expect(Number(r.rows[0].codigo_descuento_pct)).toBe(0)
  })

  it('con el cupón APROBADO, aceptar CONSERVA el descuento', async () => {
    await sembrarCupon('ACEPTA10', 10, 3)
    const q = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${q.id}/codigo/`, { cuerpo: { codigo: 'ACEPTA10' } })).status).toBe(200)
    expect(
      (await cGer.pedir(`/api/propuestas/${q.id}/codigo/decision/`, { cuerpo: { decision: 'APROBAR' } })).status,
    ).toBe(200)
    await cVend.pedir(`/api/propuestas/${q.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    const r = await new Cliente().pedir(`/api/propuestas/publica/${q.token}/`, { cuerpo: { nombre: 'Clara' } })
    expect(r.status).toBe(200)
    const s = (await fila(q.id)).snapshot_economico
    expect(s.codigoTexto).toBe('ACEPTA10')
    expect(Number(s.base)).toBe(90_000)
  })
})

// ─── 6 · OTRA ORGANIZACIÓN ─────────────────────────────────────────────────

describe('6 · otra organización no alcanza nada (R2)', () => {
  it('BETA no lee ni decide el cupón de una propuesta de ALFA: 404, y no cambia nada', async () => {
    await sembrarCupon('AJENO30', 30, 5)
    const p = await crearPropuesta(cVend)
    expect((await cVend.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'AJENO30' } })).status).toBe(200)

    const lee = await cBeta.pedir(`/api/propuestas/${p.id}/codigo/`)
    expect(lee.status).toBe(404)
    const dec = await cBeta.pedir(`/api/propuestas/${p.id}/codigo/decision/`, { cuerpo: { decision: 'APROBAR' } })
    expect(dec.status).toBe(404)
    const rec = await cBeta.pedir(`/api/propuestas/${p.id}/codigo/decision/`, {
      cuerpo: { decision: 'RECHAZAR', motivo: 'intento ajeno' },
    })
    expect(rec.status).toBe(404)
    const f = await fila(p.id)
    expect(f.codigo_estado).toBe('PENDIENTE')
    expect(f.codigo_texto).toBe('AJENO30')
  })
})
