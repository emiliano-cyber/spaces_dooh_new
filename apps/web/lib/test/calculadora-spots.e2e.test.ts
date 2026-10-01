import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0042 · LA CALCULADORA DE SPOTS — contra Postgres y un Next de verdad.
// ----------------------------------------------------------------------------
//  La calculadora da la CANTIDAD; el precio sigue siendo el de la pantalla.
//  Es ROJO por triple —migración, tenant y dinero—. Las unitarias
//  (`calculadora-spots.test.ts`) fijan las fórmulas; aquí se mide:
//
//   · que la migración deja las cuatro columnas con sus CHECK;
//   · que el SERVIDOR guarda los parámetros y la cantidad, y rechaza (400) una
//     cantidad que no cuadra — sin escribir nada;
//   · que la prima del Roadblock es solo de gerente (403 al vendedor) y que,
//     puesta por un gerente, queda como ajuste con su línea de Actividad;
//   · que un Roadblock exige el loop entero libre (409);
//   · que la campaña retiene `espacios_comprados` slots, y un Roadblock todos;
//   · y que la liga PÚBLICA no trae ninguno de los parámetros.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let cDueno: Cliente
let cVend: Cliente
let cGer: Cliente
let gerenteId: string
let sitioOcupado: string
let roadblockConPrima: string

const correo = (quien: string) => `${quien}@calc.test`
const DIAS = 30 // enDias(3) … enDias(32), inclusivos
// Pantalla de 12 espacios de 20 s, 06:00–24:00: 15 rotaciones por hora, 18 h.
const SPOTS_DIA_POR_ESPACIO = 270

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
  alfa = await sembrarTenant('calcalfa')
  beta = await sembrarTenant('calcbeta')
  const p = poolTest()
  await p.query(`update sitios set duracion_spot_seg = 20, horario = '06:00-24:00' where id = $1`, [alfa.sitioId])
  await p.query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1,'mensual',45000,0,$2), ($1,'spot',1200,0,$2)`,
    [alfa.sitioId, alfa.id],
  )
  // Una segunda pantalla digital de alfa con UN espacio ocupado por una campaña
  // vigente: 11 libres de 12.
  sitioOcupado = (
    await p.query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           total_spots, duracion_spot_seg, horario, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion)
       values ('Pantalla ocupada','CALC-OCU','CALC-OCU-P','PANTALLA_DIGITAL','DISPONIBLE',12,20,'06:00-24:00',45000,45000,$1,'digital')
       returning id`,
      [alfa.id],
    )
  ).rows[0].id
  await p.query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1,'spot',1200,0,$2)`,
    [sitioOcupado, alfa.id],
  )
  const camp = (
    await p.query(
      `insert into campanas (folio, nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
       values ('CAM-CALC-1','Ocupante',$1,current_date, current_date + 60, $2) returning id`,
      [alfa.clienteId, alfa.id],
    )
  ).rows[0].id
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus, spots_reservados, tenant_id)
     values ($1,$2,current_date, current_date + 60, 1000,'FIXED_PKG','CONFIRMADA',1,$3)`,
    [camp, sitioOcupado, alfa.id],
  )
  // La pantalla de beta, también digital y con tarifa por spot.
  await p.query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1,'spot',900,0,$2)`,
    [beta.sitioId, beta.id],
  )

  await sembrarUsuario('Vera Vendedora', 'vendedora', 'VENDEDOR')
  gerenteId = await sembrarUsuario('Gael Gerente', 'gerente', 'GERENTE_VENTAS')

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
      nombre: `Calc ${++n}`,
      clienteId: alfa.clienteId,
      fechaInicio: enDias(3),
      fechaFin: enDias(32),
      items: items.map((it) => ({ sitioId: sitio ?? alfa.sitioId, unidad: 'spot', ...it })),
    },
  })

const lineas = async (propuestaId: string) =>
  (
    await poolTest().query(
      `select cantidad::float8 as cantidad, precio::float8 as precio, tarifa_unitaria::float8 as tarifa_unitaria,
              spots_por_dia, espacios_comprados, horas_dia::float8 as horas_dia, roadblock,
              prima_roadblock_pct::float8 as prima_roadblock_pct,
              tarifa_calculada::float8 as tarifa_calculada, precio_ajustado_por
         from propuesta_items where propuesta_id=$1 order by creado_en`,
      [propuestaId],
    )
  ).rows

const cuantasPropuestas = async () =>
  Number((await poolTest().query('select count(*)::int n from propuestas where tenant_id=$1', [alfa.id])).rows[0].n)

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración', () => {
  it('las cuatro columnas, con su tipo, nullables y el default de roadblock', async () => {
    const r = await poolTest().query(
      `select column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
         from information_schema.columns
        where table_name='propuesta_items'
          and column_name in ('espacios_comprados','horas_dia','roadblock','prima_roadblock_pct')
        order by 1`,
    )
    expect(r.rows).toEqual([
      { column_name: 'espacios_comprados', data_type: 'integer', numeric_precision: 32, numeric_scale: 0, is_nullable: 'YES', column_default: null },
      { column_name: 'horas_dia', data_type: 'numeric', numeric_precision: 4, numeric_scale: 2, is_nullable: 'YES', column_default: null },
      { column_name: 'prima_roadblock_pct', data_type: 'numeric', numeric_precision: 5, numeric_scale: 2, is_nullable: 'YES', column_default: null },
      { column_name: 'roadblock', data_type: 'boolean', numeric_precision: null, numeric_scale: null, is_nullable: 'NO', column_default: 'false' },
    ])
  })

  it('NEGATIVO · los CHECK rechazan lo que la aplicación nunca debe escribir', async () => {
    const c = await poolApp().connect()
    try {
      await c.query('begin')
      await c.query(`select set_config('app.tenant_id', $1, true)`, [alfa.id])
      const prop = (
        await c.query(`insert into propuestas (folio, nombre, tenant_id) values ('PR-CK-1','ck',$1) returning id`, [alfa.id])
      ).rows[0].id
      const intentar = async (cols: string, vals: string) => {
        await c.query('savepoint s')
        try {
          await c.query(
            `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, tenant_id, ${cols})
             values ($1,$2,current_date,current_date,1,$3, ${vals})`,
            [prop, alfa.sitioId, alfa.id],
          )
          await c.query('release savepoint s')
          return 'entró'
        } catch (e) {
          await c.query('rollback to savepoint s')
          return (e as any).code as string
        }
      }
      expect(await intentar('espacios_comprados', '0')).toBe('23514')
      expect(await intentar('horas_dia', '0')).toBe('23514')
      expect(await intentar('horas_dia', '24.5')).toBe('23514')
      expect(await intentar('roadblock, espacios_comprados, prima_roadblock_pct', 'true, 12, 100.5')).toBe('23514')
      expect(await intentar('roadblock, espacios_comprados, prima_roadblock_pct', 'true, 12, -1')).toBe('23514')
      // La prima solo con roadblock…
      expect(await intentar('roadblock, prima_roadblock_pct', 'false, 10')).toBe('23514')
      // …y un roadblock dice cuántos espacios compró.
      expect(await intentar('roadblock', 'true')).toBe('23514')
      // Lo bueno sí entra, y el rol de la app lo puede escribir.
      expect(await intentar('espacios_comprados, horas_dia', '2, 18')).toBe('entró')
      expect(await intentar('roadblock, prima_roadblock_pct', 'false, 0')).toBe('entró')
      expect(await intentar('roadblock, espacios_comprados, prima_roadblock_pct', 'true, 12, 25')).toBe('entró')
      await c.query('rollback')
    } finally {
      c.release()
    }
  })

  it('lo anterior queda como estaba: roadblock false y el resto en NULL', async () => {
    const r = await poolTest().query(
      `select count(*)::int n from propuesta_items
        where roadblock or espacios_comprados is not null or horas_dia is not null or prima_roadblock_pct is not null`,
    )
    expect(r.rows[0].n).toBe(0)
  })
})

// ─── 2 · EL VENDEDOR COTIZA CON LA CALCULADORA ──────────────────────────────

describe('2 · el servidor guarda los parámetros y RECALCULA la cantidad', () => {
  it('2 espacios, 18 h, 30 días → 16 200 spots a la tarifa de la pantalla', async () => {
    const cantidad = 2 * SPOTS_DIA_POR_ESPACIO * DIAS
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 2, cantidad }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toEqual([
      {
        cantidad: 16200,
        precio: 1200 * 16200,
        tarifa_unitaria: 1200,
        // La programación sale de la misma cuenta: 540 pases al día.
        spots_por_dia: 540,
        espacios_comprados: 2,
        horas_dia: 18,
        roadblock: false,
        prima_roadblock_pct: null,
        tarifa_calculada: 1200,
        precio_ajustado_por: null,
      },
    ])
  })

  it('el vendedor BAJA las horas a 6 y la cantidad baja con ellas', async () => {
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 1, horasDia: 6, cantidad: 90 * DIAS }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toMatchObject([{ cantidad: 2700, horas_dia: 6, spots_por_dia: 90 }])
  })

  it('NEGATIVO · una cantidad manipulada → 400 con la cuenta, y NO se escribe nada', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 2, cantidad: 100 }])
    expect(r.status).toBe(400)
    expect(r.datos.error).toBe(
      'La cantidad de spots no cuadra con la calculadora: con 2 espacios, 18 h al día y 30 días son 16200 spots, no 100.',
    )
    expect(await cuantasPropuestas()).toBe(antes)
  })

  it('NEGATIVO · más horas de las que transmite la pantalla → 400', async () => {
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 1, horasDia: 20, cantidad: 300 * DIAS }])
    expect(r.status).toBe(400)
  })

  it('una línea por spot SIN calculadora sigue como hoy: cantidad a mano', async () => {
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, cantidad: 10 }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toMatchObject([
      { cantidad: 10, precio: 12000, espacios_comprados: null, horas_dia: null, roadblock: false, prima_roadblock_pct: null },
    ])
  })

  it('el detalle INTERNO trae los parámetros', async () => {
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 3, cantidad: 3 * SPOTS_DIA_POR_ESPACIO * DIAS }])
    const est = await cVend.pedir('/api/estado/')
    const p = (est.datos.propuestas as any[]).find((x) => x.id === r.datos.id)
    expect(p.items[0]).toMatchObject({ espaciosComprados: 3, horasDia: 18, roadblock: false, primaRoadblockPct: null })
  })

  it('NEGATIVO · R2: la pantalla de beta no se cotiza con la calculadora desde alfa', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ tarifaUnitaria: 900, espaciosComprados: 1, cantidad: SPOTS_DIA_POR_ESPACIO * DIAS }], beta.sitioId)
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(await cuantasPropuestas()).toBe(antes)
  })
})

// ─── 3 · ROADBLOCK ──────────────────────────────────────────────────────────

const CANT_RB = 12 * SPOTS_DIA_POR_ESPACIO * DIAS // 97 200

describe('3 · Roadblock: todos los espacios, prima solo de gerente', () => {
  it('NEGATIVO · el VENDEDOR con prima > 0 → 403, y no se escribe nada', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cVend, [{ tarifaUnitaria: 1500, roadblock: true, primaRoadblockPct: 25, cantidad: CANT_RB }])
    expect(r.status).toBe(403)
    expect(r.datos.error).toBe('Solo un gerente o superior puede poner prima a un Roadblock.')
    expect(await cuantasPropuestas()).toBe(antes)
  })

  it('el VENDEDOR sí marca un Roadblock a prima 0, a la tarifa', async () => {
    const r = await crear(cVend, [{ tarifaUnitaria: 1200, roadblock: true, cantidad: CANT_RB }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await lineas(r.datos.id)).toMatchObject([
      { cantidad: CANT_RB, espacios_comprados: 12, roadblock: true, prima_roadblock_pct: 0, precio_ajustado_por: null },
    ])
  })

  it('el GERENTE con prima del 25 % → 201, tarifa 1 500, ajuste a su nombre y en Actividad', async () => {
    const r = await crear(cGer, [{ tarifaUnitaria: 1500, roadblock: true, primaRoadblockPct: 25, cantidad: CANT_RB }])
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    roadblockConPrima = r.datos.id
    expect(await lineas(r.datos.id)).toEqual([
      {
        cantidad: CANT_RB,
        precio: 1500 * CANT_RB,
        tarifa_unitaria: 1500,
        spots_por_dia: 12 * SPOTS_DIA_POR_ESPACIO,
        espacios_comprados: 12,
        horas_dia: 18,
        roadblock: true,
        prima_roadblock_pct: 25,
        // La de la PANTALLA, sin la prima: «de $1,200 a $1,500».
        tarifa_calculada: 1200,
        precio_ajustado_por: gerenteId,
      },
    ])
    const acc = (
      await poolTest().query(
        `select accion, usuario_nombre from acciones where tenant_id=$1 and entidad=$2 order by timestamp`,
        [alfa.id, r.datos.nombre],
      )
    ).rows
    expect(acc.map((a) => a.accion)).toEqual([
      'Creó propuesta',
      'Cambió la tarifa de «Pantalla calcalfa» (spot) de $1,200 a $1,500 por Roadblock con prima del 25 % en la propuesta',
    ])
    expect(acc[1].usuario_nombre).toBe('Gael Gerente')
  })

  it('la prima se aplica UNA vez: lo que se guarda es lo enviado, no 1 500 × 1,25', async () => {
    // La pantalla manda la tarifa YA con la prima. Si el servidor volviera a
    // multiplicar al guardar, la línea quedaría a 1 875 (1 200 × 1,25 × 1,25).
    const r = await crear(cGer, [{ tarifaUnitaria: 1500, roadblock: true, primaRoadblockPct: 25, cantidad: CANT_RB }])
    expect(await lineas(r.datos.id)).toMatchObject([{ tarifa_unitaria: 1500, precio: 1500 * CANT_RB }])
  })

  it('NEGATIVO · Roadblock sobre una pantalla con un espacio ocupado → 409', async () => {
    const antes = await cuantasPropuestas()
    const r = await crear(cGer, [{ tarifaUnitaria: 1200, roadblock: true, cantidad: CANT_RB }], sitioOcupado)
    expect(r.status).toBe(409)
    expect(r.datos.error).toBe('Un Roadblock necesita los 12 espacios del loop libres, y la pantalla tiene 11.')
    expect(await cuantasPropuestas()).toBe(antes)
  })

  it('NEGATIVO · más espacios que los libres → 409; los que caben, sí', async () => {
    const malo = await crear(cVend, [{ tarifaUnitaria: 1200, espaciosComprados: 12, cantidad: CANT_RB }], sitioOcupado)
    expect(malo.status).toBe(409)
    const bueno = await crear(
      cVend,
      [{ tarifaUnitaria: 1200, espaciosComprados: 11, cantidad: 11 * SPOTS_DIA_POR_ESPACIO * DIAS }],
      sitioOcupado,
    )
    expect(bueno.status, JSON.stringify(bueno.datos)).toBe(201)
  })
})

// ─── 4 · LA CAMPAÑA RETIENE LOS ESPACIOS COMPRADOS ──────────────────────────

describe('4 · al generar la campaña, spots_reservados = espacios comprados', () => {
  const aprobarYGenerar = async (propuestaId: string) => {
    const aprob = await cDueno.pedir(`/api/propuestas/${propuestaId}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)
    const gen = await cDueno.pedir(`/api/propuestas/${propuestaId}/generar-campana/`, { cuerpo: {} })
    expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
    return (
      await poolTest().query('select spots_reservados, spots_por_dia, cantidad::float8 as cantidad from reservas where campana_id=$1', [
        gen.datos.id,
      ])
    ).rows
  }

  it('3 espacios → la reserva retiene 3 slots, y programa 810 pases al día', async () => {
    // Las dos propuestas se crean ANTES de generar ninguna campaña: con una
    // campaña vigente la pantalla ya no tiene el loop entero libre y el
    // Roadblock (bien) no se dejaría cotizar.
    const tres = await crear(cDueno, [{ tarifaUnitaria: 1200, espaciosComprados: 3, cantidad: 3 * SPOTS_DIA_POR_ESPACIO * DIAS }])
    expect(tres.status, JSON.stringify(tres.datos)).toBe(201)
    const rb = await crear(cDueno, [{ tarifaUnitaria: 1200, roadblock: true, cantidad: CANT_RB }])
    expect(rb.status, JSON.stringify(rb.datos)).toBe(201)

    expect(await aprobarYGenerar(tres.datos.id)).toEqual([
      { spots_reservados: 3, spots_por_dia: 810, cantidad: 3 * SPOTS_DIA_POR_ESPACIO * DIAS },
    ])
    // Un Roadblock retiene TODOS.
    expect(await aprobarYGenerar(rb.datos.id)).toEqual([{ spots_reservados: 12, spots_por_dia: 3240, cantidad: CANT_RB }])
  })
})

// ─── 5 · LA LIGA PÚBLICA ────────────────────────────────────────────────────

describe('5 · el CLIENTE ve solo el precio final', () => {
  it('el JSON público no trae ninguno de los parámetros de la calculadora', async () => {
    // El Roadblock con prima del bloque 3: es la línea que MÁS parámetros
    // internos tiene. No se crea otro aquí porque, con las campañas del bloque
    // 4 ya generadas, la pantalla no tiene el loop entero libre.
    expect(roadblockConPrima).toBeTruthy()
    const token = (await poolTest().query('select token_publico from propuestas where id=$1', [roadblockConPrima])).rows[0]
      .token_publico
    const pub = await new Cliente().pedir(`/api/propuestas/publica/${token}/`)
    expect(pub.status).toBe(200)
    const crudo = JSON.stringify(pub.datos)
    for (const fuga of [
      'espaciosComprados',
      'espacios_comprados',
      'horasDia',
      'horas_dia',
      'roadblock',
      'Roadblock',
      'primaRoadblock',
      'prima_roadblock',
      'tarifaCalculada',
    ]) {
      expect(crudo, `la liga pública filtra «${fuga}»`).not.toContain(fuga)
    }
    expect(pub.datos.items[0].precio).toBe(1500 * CANT_RB)
  })
})
