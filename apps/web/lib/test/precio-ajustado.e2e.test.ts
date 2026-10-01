import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PRECIO-01 · LA TARIFA LA CALCULA EL SERVIDOR, Y SOLO UN GERENTE O SUPERIOR
//  PUEDE PONER OTRA — contra Postgres y un Next de verdad.
// ----------------------------------------------------------------------------
//  Decisión del dueño, 2026-10-01: «en propuestas aparte de ser calculado el
//  gerente será el único que podrá poner otro precio diferente al de la tarifa
//  e igual usuarios superiores». Cierra el hallazgo B40 para la tarifa BASE.
//
//  Es ROJO por triple —migración, tenant y dinero—. Las unitarias
//  (`propuestas-precio.test.ts`) simulan la base; aquí se mide:
//
//   · que el VENDEDOR a la tarifa crea, y con otro precio recibe 403 y NO se
//     escribe ni la propuesta;
//   · que la tarifa sale de la REJILLA (prime) y no solo de la modalidad;
//   · que GERENTE_VENTAS y DUEÑO pueden apartarse, y quedan las dos columnas y
//     la línea de Actividad;
//   · que la liga PÚBLICA no trae ni la tarifa calculada ni quién ajustó;
//   · que la tarifa se calcula con los datos de ESTA organización (R2);
//   · y que la migración deja las columnas con la forma aprobada.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let cDueno: Cliente
let cVend: Cliente
let cGer: Cliente
let gerenteId: string
let duenoId: string
let franjaPrime: string

const correo = (quien: string) => `${quien}@precio.test`
const MSJ_DISTINTA = 'Solo un gerente o superior puede cambiar la tarifa de una pantalla.'
const MSJ_SIN_TARIFA =
  'Esta pantalla no tiene una tarifa calculada para esa unidad. Pide a un gerente o superior que le ponga precio.'

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
  alfa = await sembrarTenant('precioalfa')
  beta = await sembrarTenant('preciobeta')
  const p = poolTest()
  // La pantalla de alfa: mensual 45 000 y spot 1 200, y el prime a 1 800.
  await p.query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1,'mensual',45000,0,$2), ($1,'spot',1200,0,$2)`,
    [alfa.sitioId, alfa.id],
  )
  franjaPrime = (
    await p.query(
      `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin, orden)
       values ($1,'Prime','06:00','10:00',1) returning id`,
      [alfa.id],
    )
  ).rows[0].id
  await p.query(
    `insert into sitio_tarifas (sitio_id, unidad, franja_id, temporada_id, tarifa_publicada, tenant_id)
     values ($1,'spot',$2,null,1800,$3)`,
    [alfa.sitioId, franjaPrime, alfa.id],
  )
  // La pantalla de beta, con OTRA tarifa: si la de alfa saliera de aquí, se vería.
  await p.query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1,'mensual',99000,0,$2)`,
    [beta.sitioId, beta.id],
  )

  await sembrarUsuario('Vera Vendedora', 'vendedora', 'VENDEDOR')
  gerenteId = await sembrarUsuario('Gael Gerente', 'gerente', 'GERENTE_VENTAS')
  duenoId = (await p.query('select id from usuarios where email=$1', [alfa.usuarioEmail])).rows[0].id

  await arrancarServidor()
  cDueno = new Cliente()
  cVend = new Cliente()
  cGer = new Cliente()
  await cDueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cVend.entrar(correo('vendedora'), PASSWORD_DEMO)
  await cGer.entrar(correo('gerente'), PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let n = 0
const crear = (c: Cliente, items: any[], sitio?: string) =>
  c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: `Precio ${++n}`,
      clienteId: alfa.clienteId,
      fechaInicio: enDias(3),
      fechaFin: enDias(32),
      items: items.map((it) => ({ sitioId: sitio ?? alfa.sitioId, ...it })),
    },
  })

const lineas = async (propuestaId: string) =>
  (
    await poolTest().query(
      `select precio::float8 as precio, tarifa_unitaria::float8 as tarifa_unitaria,
              tarifa_calculada::float8 as tarifa_calculada, precio_ajustado_por
         from propuesta_items where propuesta_id=$1 order by creado_en, tarifa_unitaria desc`,
      [propuestaId],
    )
  ).rows

const cuantasPropuestas = async () =>
  Number((await poolTest().query('select count(*)::int n from propuestas where tenant_id=$1', [alfa.id])).rows[0].n)

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración', () => {
  it('las dos columnas, con su tipo y nullables', async () => {
    const r = await poolTest().query(
      `select column_name, data_type, numeric_precision, numeric_scale, is_nullable
         from information_schema.columns
        where table_name='propuesta_items' and column_name in ('tarifa_calculada','precio_ajustado_por')
        order by 1`,
    )
    expect(r.rows).toEqual([
      { column_name: 'precio_ajustado_por', data_type: 'uuid', numeric_precision: null, numeric_scale: null, is_nullable: 'YES' },
      { column_name: 'tarifa_calculada', data_type: 'numeric', numeric_precision: 14, numeric_scale: 2, is_nullable: 'YES' },
    ])
  })

  it('la FK a usuarios es on delete SET NULL', async () => {
    const r = await poolTest().query(
      `select confdeltype from pg_constraint
        where conname='propuesta_items_precio_ajustado_por_fkey' and conrelid='propuesta_items'::regclass`,
    )
    expect(r.rows).toEqual([{ confdeltype: 'n' }])
  })

  it('el rol de la APP puede escribirlas (bajo su tenant)', async () => {
    const c = await poolApp().connect()
    try {
      await c.query('begin')
      await c.query(`select set_config('app.tenant_id', $1, true)`, [alfa.id])
      const prop = (
        await c.query(`insert into propuestas (folio, nombre, tenant_id) values ('PR-GRANT-1','grant',$1) returning id`, [alfa.id])
      ).rows[0].id
      const it = (
        await c.query(
          `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, tenant_id,
                                        tarifa_calculada, precio_ajustado_por)
           values ($1,$2,current_date,current_date,1,$3,45000,$4) returning id`,
          [prop, alfa.sitioId, alfa.id, gerenteId],
        )
      ).rows[0].id
      await c.query('update propuesta_items set tarifa_calculada=1, precio_ajustado_por=null where id=$1', [it])
      await c.query('rollback')
    } finally {
      c.release()
    }
  })
})

// ─── 2 · EL VENDEDOR ────────────────────────────────────────────────────────

describe('2 · VENDEDOR: a la tarifa sí, con otro precio NO', () => {
  it('a la tarifa mensual → 201, con la tarifa calculada guardada y sin ajuste', async () => {
    const r = await crear(cVend, [{ unidad: 'mensual', tarifaUnitaria: 45000 }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toEqual([
      { precio: 45000, tarifa_unitaria: 45000, tarifa_calculada: 45000, precio_ajustado_por: null },
    ])
  })

  it('NEGATIVO · a 1 peso → 403 con la frase, y NO se escribe nada', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ unidad: 'mensual', tarifaUnitaria: 1 }])
    expect(r.status).toBe(403)
    expect(r.datos.error).toBe(MSJ_DISTINTA)
    expect(await cuantasPropuestas()).toBe(antes)
  })

  it('NEGATIVO · el modo compatible (precio sin unidad) tampoco es una puerta trasera', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ precio: 10 }])
    expect(r.status).toBe(403)
    expect(await cuantasPropuestas()).toBe(antes)
    // …y a la tarifa sí entra.
    const ok = await crear(cVend, [{ precio: 45000 }])
    expect(ok.status, JSON.stringify(ok.datos)).toBe(201)
  })

  it('NEGATIVO · el prime a tarifa base (1 200) se rechaza; a 1 800 entra', async () => {
    const malo = await crear(cVend, [{ unidad: 'spot', tarifaUnitaria: 1200, cantidad: 10, franjaId: franjaPrime }])
    expect(malo.status).toBe(403)
    const bueno = await crear(cVend, [{ unidad: 'spot', tarifaUnitaria: 1800, cantidad: 10, franjaId: franjaPrime }])
    expect(bueno.status, JSON.stringify(bueno.datos)).toBe(201)
    expect(await lineas(bueno.datos.id)).toEqual([
      { precio: 18000, tarifa_unitaria: 1800, tarifa_calculada: 1800, precio_ajustado_por: null },
    ])
  })

  it('NEGATIVO · una unidad sin tarifa (semanal) → 403 «pide a un gerente»', async () => {
    const r = await crear(cVend, [{ unidad: 'semanal', tarifaUnitaria: 0 }])
    expect(r.status).toBe(403)
    expect(r.datos.error).toBe(MSJ_SIN_TARIFA)
  })
})

// ─── 3 · GERENTE Y DUEÑO ────────────────────────────────────────────────────

describe('3 · GERENTE_VENTAS y DUEÑO pueden apartarse de la tarifa', () => {
  it('GERENTE_VENTAS a 30 000 → 201, las dos columnas puestas y la línea en Actividad', async () => {
    const r = await crear(cGer, [{ unidad: 'mensual', tarifaUnitaria: 30000 }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toEqual([
      { precio: 30000, tarifa_unitaria: 30000, tarifa_calculada: 45000, precio_ajustado_por: gerenteId },
    ])
    const acc = (
      await poolTest().query(
        `select accion, usuario_nombre from acciones where tenant_id=$1 and entidad=$2 order by timestamp`,
        [alfa.id, r.datos.nombre],
      )
    ).rows
    expect(acc.map((a) => a.accion)).toEqual([
      'Creó propuesta',
      expect.stringMatching(/^Cambió la tarifa de «Pantalla precioalfa» \(mensual\) de \$45,000 a \$30,000/),
    ])
    expect(acc[1].usuario_nombre).toBe('Gael Gerente')
  })

  it('el detalle INTERNO dice quién la ajustó', async () => {
    const r = await crear(cGer, [{ unidad: 'mensual', tarifaUnitaria: 40000 }])
    const est = await cGer.pedir('/api/estado/')
    const p = (est.datos.propuestas as any[]).find((x) => x.id === r.datos.id)
    expect(p.items[0]).toMatchObject({
      tarifaCalculada: 45000,
      precioAjustadoPor: gerenteId,
      precioAjustadoPorNombre: 'Gael Gerente',
    })
  })

  it('a la tarifa, el gerente NO deja ajuste que atribuir', async () => {
    const r = await crear(cGer, [{ unidad: 'mensual', tarifaUnitaria: 45000 }])
    expect((await lineas(r.datos.id))[0].precio_ajustado_por).toBeNull()
  })

  it('DUEÑO también, y una pantalla sin tarifa la puede tarifar', async () => {
    const r = await crear(cDueno, [
      { unidad: 'mensual', tarifaUnitaria: 50000 },
      { unidad: 'semanal', tarifaUnitaria: 9000 },
    ])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    // La cantidad de semanas sale del rango de fechas; el precio la multiplica.
    const semanas = Number(r.datos.items.find((i: any) => i.unidad === 'semanal').cantidad)
    expect(await lineas(r.datos.id)).toEqual([
      { precio: 50000, tarifa_unitaria: 50000, tarifa_calculada: 45000, precio_ajustado_por: duenoId },
      { precio: 9000 * semanas, tarifa_unitaria: 9000, tarifa_calculada: null, precio_ajustado_por: duenoId },
    ])
  })
})

// ─── 4 · LA LIGA PÚBLICA ────────────────────────────────────────────────────

describe('4 · el CLIENTE ve solo el precio final', () => {
  it('el JSON público no trae ni la tarifa calculada ni quién ajustó', async () => {
    const r = await crear(cGer, [{ unidad: 'mensual', tarifaUnitaria: 30000 }])
    const token = (await poolTest().query('select token_publico from propuestas where id=$1', [r.datos.id])).rows[0]
      .token_publico
    const pub = await new Cliente().pedir(`/api/propuestas/publica/${token}/`)
    expect(pub.status).toBe(200)
    const crudo = JSON.stringify(pub.datos)
    for (const fuga of ['tarifaCalculada', 'tarifa_calculada', 'precioAjustado', 'precio_ajustado', 'Gael', gerenteId, '45000']) {
      expect(crudo, `la liga pública filtra «${fuga}»`).not.toContain(fuga)
    }
    expect(pub.datos.items[0].precio).toBe(30000)
  })
})

// ─── 5 · R2 · LA TARIFA SALE DE ESTA ORGANIZACIÓN ───────────────────────────

describe('5 · aislamiento: la tarifa se calcula con los datos de ESTA organización', () => {
  it('NEGATIVO · la pantalla de beta, a la tarifa de beta, no la puede tarifar el vendedor de alfa', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ unidad: 'mensual', tarifaUnitaria: 99000 }], beta.sitioId)
    expect(r.status).toBe(403)
    expect(r.datos.error).toBe(MSJ_SIN_TARIFA)
    expect(await cuantasPropuestas()).toBe(antes)
  })

  it('NEGATIVO · una modalidad de otra organización colgada de la pantalla de alfa NO cuenta', async () => {
    // Filas que solo puede escribir un superusuario: un tenant que no casa con
    // el de su pantalla. Bajo RLS y con `and tenant_id` no se leen, así que
    // alfa sigue sin tarifa semanal ni horaria.
    await poolTest().query(
      `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
       values ($1,'hora',777,0,$2)`,
      [alfa.sitioId, beta.id],
    )
    await poolTest().query(
      `insert into sitio_tarifas (sitio_id, unidad, franja_id, temporada_id, tarifa_publicada, tenant_id)
       values ($1,'diaria',null,null,555,$2)`,
      [alfa.sitioId, beta.id],
    )
    const hora = await crear(cVend, [{ unidad: 'hora', tarifaUnitaria: 777, cantidad: 1 }])
    expect(hora.status).toBe(403)
    expect(hora.datos.error).toBe(MSJ_SIN_TARIFA)
    const diaria = await crear(cVend, [{ unidad: 'diaria', tarifaUnitaria: 555 }])
    expect(diaria.status).toBe(403)
    // Y lo propio de alfa sigue valiendo.
    expect((await crear(cVend, [{ unidad: 'mensual', tarifaUnitaria: 45000 }])).status).toBe(201)
  })
})

// ─── 6 · LA BAJA DEL GERENTE ────────────────────────────────────────────────

describe('6 · borrar al usuario que ajustó no bloquea nada', () => {
  it('on delete set null: la línea conserva su tarifa calculada y pierde solo quién', async () => {
    // Se siembra la línea a mano y con un usuario SIN historia: quien pasó por
    // la aplicación tiene filas en `acciones`, que es append-only, y entonces
    // es la bitácora —no esta FK— la que impide borrarlo. Lo que aquí se mide
    // es solo la FK: que no sea `restrict`.
    const otro = await sembrarUsuario('Gina Temporal', 'temporal', 'GERENTE_VENTAS')
    const p = poolTest()
    const prop = (
      await p.query(`insert into propuestas (folio, nombre, tenant_id) values ('PR-FK-1','fk',$1) returning id`, [alfa.id])
    ).rows[0].id
    await p.query(
      `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, tarifa_unitaria, tenant_id,
                                    tarifa_calculada, precio_ajustado_por)
       values ($1,$2,current_date,current_date,20000,20000,$3,45000,$4)`,
      [prop, alfa.sitioId, alfa.id, otro],
    )
    await p.query('delete from usuarios where id=$1', [otro])
    expect(await lineas(prop)).toEqual([
      { precio: 20000, tarifa_unitaria: 20000, tarifa_calculada: 45000, precio_ajustado_por: null },
    ])
  })
})
