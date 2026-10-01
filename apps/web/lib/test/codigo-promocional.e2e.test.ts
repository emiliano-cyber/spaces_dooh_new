import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  COD-01 · el CÓDIGO PROMOCIONAL contra Postgres de verdad.  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  Es ROJO por triple —migración, tenant y dinero—. Las unitarias SIMULAN la
//  base, así que hay cinco cosas que no pueden ver y que son exactamente lo que
//  esta fase arriesga:
//
//   1. **LA CARRERA DEL ÚLTIMO USO.** Es la razón principal de este archivo. Dos
//      canjes simultáneos del último uso solo se pueden probar con dos
//      conexiones de verdad: un mock siempre serializa, así que una
//      implementación rota —contar, comprobar, insertar— pasaría las unitarias
//      sin despeinarse. Aquí se lanzan los dos a la vez y se exige que **uno
//      gane y el otro pierda**.
//   2. **Que la vigencia la decide POSTGRES.** `current_date` viene del motor;
//      un mock no puede demostrar que no se está usando `new Date()` de Node.
//   3. **Que el cupón de una organización NO se ve desde otra** (R2). Su modo
//      de fallo no da error: un código ajeno «no existe», que es lo mismo que
//      ve quien se equivoca al teclear. Y al revés es peor: canjearlo le
//      gastaría un uso a una empresa que no autorizó nada.
//   4. **Que UN SOLO CÓDIGO POR PROPUESTA lo corta la BASE**, no el controller.
//      El `unique (propuesta_id)` es lo único que sirve contra un doble clic.
//   5. **Que BORRAR EL CUPÓN NO MUEVE UNA PROPUESTA APROBADA.** Es el
//      invariante 3 del ADR 0039 y el que decide si esta fase está bien hecha.
//      Su modo de fallo no da error: la propuesta se lee perfectamente, solo
//      que con otro precio que el que el cliente aceptó.
//
//  Y la sexta, que protege a los clientes de hoy: **vender SIN código tiene que
//  seguir funcionando exactamente igual.**
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('codalfa')
  beta = await sembrarTenant('codbeta')

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/** El candado: escribir el catálogo de cupones es un cambio SENSIBLE. */
async function desbloquear(c: Cliente) {
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

/**
 * COD-03 · aprueba el cupón pendiente de una propuesta, como lo haría un
 * gerente.
 *
 * Desde el 2026-10-03 todo cupón aplicado nace PENDIENTE y la propuesta NO se
 * puede aprobar por dentro hasta que alguien con `comercial.aprobar` lo decida
 * (409 en `cambiarEstatusPropuesta`). Las pruebas de este archivo que aprueban
 * una propuesta con cupón —el congelado, el vencido después del canje, la
 * cadena completa y la campaña— pasan por aquí ANTES de aprobar. No debilita
 * lo que miden: siguen exigiendo los mismos importes, el mismo snapshot y la
 * misma inmutabilidad; solo recorren el paso que ahora existe entre aplicar y
 * aprobar. Lo que pasa SIN aprobar el cupón lo mide
 * `codigo-aprobacion.e2e.test.ts`.
 *
 * La hace el DUEÑO de ALFA (`ca`), que tiene `comercial.aprobar`.
 */
async function aprobarCupon(c: Cliente, propuestaId: string) {
  const r = await c.pedir(`/api/propuestas/${propuestaId}/codigo/decision/`, {
    cuerpo: { decision: 'APROBAR' },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

/** Siembra un cupón con el pool de pruebas, saltándose la aplicación. */
async function sembrarCupon(
  org: { id: string },
  codigo: string,
  pct: number,
  desde: string,
  hasta: string,
  usosMaximos: number | null,
): Promise<string> {
  const r = await poolTest().query(
    `insert into codigos_promocionales
       (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
     values ($1,$2,$3,$4::date,$5::date,$6) returning id`,
    [org.id, codigo, pct, desde, hasta, usosMaximos],
  )
  return r.rows[0].id as string
}

/**
 * Crea una propuesta de EXACTAMENTE 100 000 de lista en la organización de `c`.
 *
 * Va en `spot` y no en `mensual`, y no es un detalle: para las unidades de
 * TIEMPO el servidor deriva la cantidad del rango de fechas
 * (`cantidadEfectiva`), así que `cantidad: 1` con un rango de 30 días daba 2
 * meses y 200 000 de lista. Es exactamente el candado de VOL-01 funcionando
 * --la cantidad que cuenta es la EFECTIVA, no la que manda el cuerpo-- y aquí
 * hacía que los importes esperados no cuadraran. Con `spot` la cantidad sí es
 * la que se manda, así que el importe es determinista.
 */
async function crearPropuesta(c: Cliente, org: { sitioId: string; clienteId: string }) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: 'Cotización con código',
      clienteId: org.clienteId,
      fechaInicio: enDias(3),
      fechaFin: enDias(33),
      items: [
        { sitioId: org.sitioId, unidad: 'spot', tarifaUnitaria: 100000, cantidad: 1 },
      ],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id as string
}

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración dejó el esquema como se pidió', () => {
  it('las dos tablas existen con RLS ENABLE y FORCE', async () => {
    const r = await poolTest().query(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relname in ('codigos_promocionales','canjes_codigo') order by relname`,
    )
    expect(r.rows).toHaveLength(2)
    for (const f of r.rows) {
      expect(f.relrowsecurity, `${f.relname} sin RLS`).toBe(true)
      expect(f.relforcerowsecurity, `${f.relname} sin FORCE`).toBe(true)
    }
  })

  it('la política cierra por los DOS lados: `using` y `with check`', async () => {
    // Regla 3 del ADR 0039. Sin `with check` se podría ESCRIBIR un cupón en otra
    // organización aunque no se pudiera leer, y la fila sería coherente consigo
    // misma: nada daría error.
    const r = await poolTest().query(
      `select tablename, qual, with_check from pg_policies
        where tablename in ('codigos_promocionales','canjes_codigo')
          and policyname = 'tenant_isolation' order by tablename`,
    )
    expect(r.rows).toHaveLength(2)
    for (const f of r.rows) {
      expect(f.qual, `${f.tablename} sin using`).toBeTruthy()
      expect(f.with_check, `${f.tablename} sin with check`).toBeTruthy()
    }
  })

  it('las columnas nuevas existen y nacen en «sin código»', async () => {
    const r = await poolTest().query(
      `select table_name, column_name, column_default, is_nullable
         from information_schema.columns
        where (table_name='propuestas' and column_name in
                 ('codigo_texto','codigo_descuento_pct','codigo_canjeado_en'))
           or (table_name='reservas' and column_name='codigo_descuento_pct')
        order by table_name, column_name`,
    )
    expect(r.rows).toHaveLength(4)
    const pct = r.rows.filter((f) => f.column_name === 'codigo_descuento_pct')
    expect(pct).toHaveLength(2)
    for (const f of pct) expect(String(f.column_default)).toMatch(/^0/)
  })

  it('EL UNIQUE VA SOBRE upper(codigo): un cupón es UNA palabra, no dos', async () => {
    await poolTest().query(
      `insert into codigos_promocionales
         (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
       values ($1,'DOBLE10',10,current_date,current_date,1)`,
      [alfa.id],
    )
    await expect(
      poolTest().query(
        `insert into codigos_promocionales
           (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
         values ($1,'doble10',50,current_date,current_date,1)`,
        [alfa.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i)
    await poolTest().query(`delete from codigos_promocionales where codigo='DOBLE10'`)
  })

  it('el mismo código SÍ puede existir en DOS organizaciones distintas', async () => {
    // Cada empresa pone las suyas (ADR 0039 §3): que ALFA use VERANO20 no puede
    // impedirle a BETA usarlo. El unique lleva el `tenant_id` delante.
    const a = await sembrarCupon(alfa, 'COMPARTIDO', 10, enDias(-1), enDias(30), 5)
    const b = await sembrarCupon(beta, 'COMPARTIDO', 40, enDias(-1), enDias(30), 5)
    expect(a).not.toBe(b)
  })

  it('la base prohíbe un cupón al 0 % y uno con vigencia al revés', async () => {
    await expect(
      sembrarCupon(alfa, 'CERO', 0, enDias(-1), enDias(30), 1),
    ).rejects.toThrow(/codigos_promocionales_pct_ck/)
    await expect(
      sembrarCupon(alfa, 'ALREVES', 10, enDias(30), enDias(-1), 1),
    ).rejects.toThrow(/vigencia_ck/)
    await expect(
      sembrarCupon(alfa, 'CEROUSOS', 10, enDias(-1), enDias(30), 0),
    ).rejects.toThrow(/usos_ck/)
    await expect(
      sembrarCupon(alfa, 'CON ESPACIO', 10, enDias(-1), enDias(30), 1),
    ).rejects.toThrow(/codigo_ck/)
  })

  it('la base prohíbe un porcentaje SIN su código, y un código sin porcentaje', async () => {
    // `propuestas_codigo_pareja_ck`. Un porcentaje huérfano es un descuento que
    // nadie puede auditar; un código al 0 % es una promesa aceptada y no
    // cumplida. Las dos son filas que alguien escribe tocando una columna sola.
    const id = await crearPropuesta(ca, alfa)
    await expect(
      poolTest().query('update propuestas set codigo_descuento_pct=20 where id=$1', [id]),
    ).rejects.toThrow(/codigo_pareja_ck/)
    await expect(
      poolTest().query(`update propuestas set codigo_texto='X' where id=$1`, [id]),
    ).rejects.toThrow(/codigo_pareja_ck/)
  })
})

// ─── 2 · EL CANJE, Y LOS CASOS NEGATIVOS ───────────────────────────────────

describe('2 · el servidor valida y aplica el código, y solo el servidor', () => {
  it('un código vigente se aplica, y el PORCENTAJE lo pone el servidor', async () => {
    await sembrarCupon(alfa, 'VIGENTE20', 20, enDias(-5), enDias(5), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'VIGENTE20' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.descuentoPct).toBe(20)

    const f = await poolTest().query(
      'select codigo_texto, codigo_descuento_pct, codigo_canjeado_en from propuestas where id=$1',
      [id],
    )
    expect(f.rows[0].codigo_texto).toBe('VIGENTE20')
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(20)
    expect(f.rows[0].codigo_canjeado_en).not.toBeNull()
  })

  it('⚠️ LA PANTALLA NO PUEDE MANDAR EL PORCENTAJE: se ignora por completo', async () => {
    // Es el invariante número uno de la Fase 3. Se manda un 90 % en el cuerpo,
    // por todos los nombres plausibles a la vez, y se exige que la propuesta
    // salga con el 20 % que dice el CUPÓN.
    await sembrarCupon(alfa, 'INYECTA', 20, enDias(-5), enDias(5), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, {
      cuerpo: {
        codigo: 'INYECTA',
        descuentoPct: 90,
        codigoDescuentoPct: 90,
        porcentaje: 90,
        descuento: 90,
        monto: 999999,
        validado: true,
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.descuentoPct).toBe(20)
    const f = await poolTest().query(
      'select codigo_descuento_pct from propuestas where id=$1',
      [id],
    )
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(20)
  })

  it('un código VENCIDO no aplica, y no escribe nada', async () => {
    await sembrarCupon(alfa, 'VENCIDO', 20, enDias(-30), enDias(-1), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'VENCIDO' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/vencio/i)
    const f = await poolTest().query('select codigo_texto from propuestas where id=$1', [id])
    expect(f.rows[0].codigo_texto).toBeNull()
    const k = await poolTest().query('select count(*) n from canjes_codigo where propuesta_id=$1', [id])
    expect(Number(k.rows[0].n)).toBe(0)
  })

  it('un código que TODAVÍA no empieza no aplica', async () => {
    await sembrarCupon(alfa, 'FUTURO', 20, enDias(5), enDias(30), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'FUTURO' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/todavia no/i)
  })

  it('LOS DOS EXTREMOS DE LA VIGENCIA SON INCLUSIVOS: hoy vale', async () => {
    // Un cupón de un solo día, que empieza y acaba HOY. Si alguno de los dos
    // extremos fuera exclusivo, esto fallaría — y quien configuró «hasta el 30»
    // habría perdido el día 30 sin saberlo.
    await sembrarCupon(alfa, 'SOLOHOY', 15, enDias(0), enDias(0), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'SOLOHOY' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.descuentoPct).toBe(15)
  })

  it('un código AGOTADO no aplica', async () => {
    await sembrarCupon(alfa, 'UNAVEZ', 20, enDias(-5), enDias(5), 1)
    const p1 = await crearPropuesta(ca, alfa)
    const p2 = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${p1}/codigo/`, { cuerpo: { codigo: 'UNAVEZ' } })).status).toBe(200)
    const r = await ca.pedir(`/api/propuestas/${p2}/codigo/`, { cuerpo: { codigo: 'UNAVEZ' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/ya se uso/i)
  })

  it('SIN TOPE (null) no se agota nunca', async () => {
    await sembrarCupon(alfa, 'INFINITO', 5, enDias(-5), enDias(5), null)
    for (let i = 0; i < 3; i++) {
      const id = await crearPropuesta(ca, alfa)
      const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'INFINITO' } })
      expect(r.status, JSON.stringify(r.datos)).toBe(200)
    }
  })

  it('el código se acepta en minúsculas y con espacios alrededor', async () => {
    await sembrarCupon(alfa, 'MAYUS20', 20, enDias(-5), enDias(5), 10)
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: '  mayus20  ' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.codigo).toBe('MAYUS20')
  })
})

// ─── 3 · EL AISLAMIENTO (R2) ───────────────────────────────────────────────

describe('3 · un cupón de OTRA organización NO EXISTE, y no se le gasta un uso', () => {
  it('BETA no puede canjear el cupón de ALFA', async () => {
    await sembrarCupon(alfa, 'SOLOALFA', 30, enDias(-5), enDias(5), 10)
    const idB = await crearPropuesta(cb, beta)
    const r = await cb.pedir(`/api/propuestas/${idB}/codigo/`, { cuerpo: { codigo: 'SOLOALFA' } })
    expect(r.status).toBe(400)
    // El mensaje es el MISMO que el de un código inventado: decir «existe pero
    // no es tuyo» ya cuenta algo de la otra empresa.
    expect(String(r.datos.error)).toMatch(/no existe/i)
  })

  it('y NO le gasta un uso al cupón de ALFA — ésta es la parte cara', async () => {
    const cupon = await poolTest().query(
      `select id from codigos_promocionales where codigo='SOLOALFA' and tenant_id=$1`,
      [alfa.id],
    )
    const k = await poolTest().query('select count(*) n from canjes_codigo where codigo_id=$1', [
      cupon.rows[0].id,
    ])
    expect(Number(k.rows[0].n)).toBe(0)
  })

  it('BETA no ve los cupones de ALFA al listarlos', async () => {
    const r = await cb.pedir('/api/codigos-promocionales/')
    expect(r.status).toBe(200)
    const codigos = (r.datos.codigos ?? []).map((c: any) => c.codigo)
    expect(codigos).not.toContain('SOLOALFA')
    expect(codigos).not.toContain('VIGENTE20')
  })
})

// ─── 4 · LA CARRERA DEL ÚLTIMO USO ─────────────────────────────────────────

describe('4 · ⚠️ LA CARRERA: dos canjes simultáneos del ÚLTIMO uso', () => {
  it('uno gana y el otro pierde — nunca los dos', async () => {
    // ES LA PRUEBA QUE JUSTIFICA ESTE ARCHIVO. Un mock siempre serializa, así
    // que una implementación rota —contar, comprobar, insertar— pasaría las
    // unitarias. Aquí son dos peticiones HTTP de verdad, contra dos conexiones
    // de verdad, lanzadas a la vez sobre un cupón de UN SOLO uso.
    await sembrarCupon(alfa, 'CARRERA1', 25, enDias(-5), enDias(5), 1)
    const p1 = await crearPropuesta(ca, alfa)
    const p2 = await crearPropuesta(ca, alfa)

    const [r1, r2] = await Promise.all([
      ca.pedir(`/api/propuestas/${p1}/codigo/`, { cuerpo: { codigo: 'CARRERA1' } }),
      ca.pedir(`/api/propuestas/${p2}/codigo/`, { cuerpo: { codigo: 'CARRERA1' } }),
    ])

    const oks = [r1, r2].filter((r) => r.status === 200)
    const malos = [r1, r2].filter((r) => r.status !== 200)
    expect(oks, `los dos contestaron ${r1.status}/${r2.status}`).toHaveLength(1)
    expect(malos).toHaveLength(1)
    expect(String(malos[0].datos.error)).toMatch(/ya se uso/i)
  })

  it('y en la base queda EXACTAMENTE un canje, no dos', async () => {
    // El conteo es la verdad: `canjes_codigo` ES el contador, no hay columna
    // que se pueda desincronizar.
    const cupon = await poolTest().query(
      `select id, usos_maximos from codigos_promocionales where codigo='CARRERA1' and tenant_id=$1`,
      [alfa.id],
    )
    const k = await poolTest().query('select count(*) n from canjes_codigo where codigo_id=$1', [
      cupon.rows[0].id,
    ])
    expect(Number(k.rows[0].n)).toBe(1)
    expect(Number(k.rows[0].n)).toBeLessThanOrEqual(Number(cupon.rows[0].usos_maximos))
  })

  it('con CINCO a la vez sobre un cupón de DOS usos, entran exactamente dos', async () => {
    await sembrarCupon(alfa, 'CARRERA5', 25, enDias(-5), enDias(5), 2)
    const ids: string[] = []
    for (let i = 0; i < 5; i++) ids.push(await crearPropuesta(ca, alfa))

    const rs = await Promise.all(
      ids.map((id) => ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'CARRERA5' } })),
    )
    expect(rs.filter((r) => r.status === 200)).toHaveLength(2)

    const cupon = await poolTest().query(
      `select id from codigos_promocionales where codigo='CARRERA5' and tenant_id=$1`,
      [alfa.id],
    )
    const k = await poolTest().query('select count(*) n from canjes_codigo where codigo_id=$1', [
      cupon.rows[0].id,
    ])
    expect(Number(k.rows[0].n)).toBe(2)
  })

  it('un SEGUNDO codigo sobre una propuesta que ya tiene uno se rechaza con una FRASE', async () => {
    // Nacio del mutante M24. Quitar la comprobacion explicita dejaba en pie el
    // `unique (propuesta_id)` --o sea que el dinero seguia a salvo-- pero el
    // vendedor recibia un error de restriccion de Postgres en vez de una frase.
    // La prueba del doble clic no lo veia: con `Promise.all` solo exigia que
    // UNO ganara, y un 500 tambien es «no ganar».
    //
    // Y hay que exigir el codigo de estado ADEMAS del texto: un 500 con el
    // mensaje correcto seguiria siendo un fallo del servidor en el registro.
    await sembrarCupon(alfa, 'SEGUNDO-A', 10, enDias(-5), enDias(5), 50)
    await sembrarCupon(alfa, 'SEGUNDO-B', 30, enDias(-5), enDias(5), 50)
    const id = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'SEGUNDO-A' } })).status).toBe(200)

    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'SEGUNDO-B' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/ya tiene el codigo/i)
    // Y el segundo cupon NO se ha gastado un uso por el intento fallido.
    const cup = await poolTest().query(
      `select id from codigos_promocionales where codigo='SEGUNDO-B' and tenant_id=$1`,
      [alfa.id],
    )
    const k = await poolTest().query('select count(*) n from canjes_codigo where codigo_id=$1', [
      cup.rows[0].id,
    ])
    expect(Number(k.rows[0].n)).toBe(0)
    // La propuesta sigue con el primero, intacta.
    const f = await poolTest().query('select codigo_texto, codigo_descuento_pct from propuestas where id=$1', [id])
    expect(f.rows[0].codigo_texto).toBe('SEGUNDO-A')
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(10)
  })

  it('EL DOBLE CLIC: el mismo código dos veces en la MISMA propuesta', async () => {
    // No es una carrera entre personas, y no la resuelve el bloqueo: la
    // resuelve el `unique (propuesta_id)`. El segundo tiene que fallar.
    await sembrarCupon(alfa, 'DOBLECLIC', 10, enDias(-5), enDias(5), 50)
    const id = await crearPropuesta(ca, alfa)
    const [a, b] = await Promise.all([
      ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'DOBLECLIC' } }),
      ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'DOBLECLIC' } }),
    ])
    expect([a, b].filter((r) => r.status === 200)).toHaveLength(1)
    const k = await poolTest().query('select count(*) n from canjes_codigo where propuesta_id=$1', [id])
    expect(Number(k.rows[0].n)).toBe(1)
  })
})

// ─── 5 · QUITAR EL CÓDIGO DEVUELVE EL USO ──────────────────────────────────

describe('5 · quitar el código devuelve el uso', () => {
  it('se aplica, se quita, y el cupón vuelve a poder usarse', async () => {
    // Es lo que paga el coste de contar al APLICAR: el uso solo queda retenido
    // mientras la promesa al cliente siga en pie.
    await sembrarCupon(alfa, 'DEVUELVE', 20, enDias(-5), enDias(5), 1)
    const p1 = await crearPropuesta(ca, alfa)
    const p2 = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${p1}/codigo/`, { cuerpo: { codigo: 'DEVUELVE' } })).status).toBe(200)
    // Agotado mientras p1 lo tenga.
    expect((await ca.pedir(`/api/propuestas/${p2}/codigo/`, { cuerpo: { codigo: 'DEVUELVE' } })).status).toBe(400)
    // Se quita de p1…
    const q = await ca.pedir(`/api/propuestas/${p1}/codigo/`, { metodo: 'DELETE' })
    expect(q.status, JSON.stringify(q.datos)).toBe(200)
    // …y ahora p2 sí puede.
    const r = await ca.pedir(`/api/propuestas/${p2}/codigo/`, { cuerpo: { codigo: 'DEVUELVE' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const f = await poolTest().query(
      'select codigo_texto, codigo_descuento_pct, codigo_canjeado_en from propuestas where id=$1',
      [p1],
    )
    expect(f.rows[0].codigo_texto).toBeNull()
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(0)
    expect(f.rows[0].codigo_canjeado_en).toBeNull()
  })

  it('BORRAR la propuesta también devuelve el uso, por la cascada', async () => {
    await sembrarCupon(alfa, 'CASCADA', 20, enDias(-5), enDias(5), 1)
    const p1 = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${p1}/codigo/`, { cuerpo: { codigo: 'CASCADA' } })).status).toBe(200)
    await poolTest().query('delete from propuestas where id=$1', [p1])
    const cupon = await poolTest().query(
      `select id from codigos_promocionales where codigo='CASCADA' and tenant_id=$1`,
      [alfa.id],
    )
    const k = await poolTest().query('select count(*) n from canjes_codigo where codigo_id=$1', [
      cupon.rows[0].id,
    ])
    expect(Number(k.rows[0].n)).toBe(0)
  })
})

// ─── 6 · EL CONGELADO, QUE ES LO QUE DECIDE SI LA FASE ESTÁ BIEN HECHA ─────

describe('6 · ⚠️ BORRAR EL CUPÓN NO MUEVE UNA PROPUESTA APROBADA', () => {
  let idAprobada: string
  let totalAntes: number
  let snapAntes: any

  it('se vende con VERANO20 al 20 % y se aprueba', async () => {
    await sembrarCupon(alfa, 'CONGELA20', 20, enDias(-5), enDias(5), 10)
    idAprobada = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${idAprobada}/codigo/`, { cuerpo: { codigo: 'CONGELA20' } })).status).toBe(200)
    await aprobarCupon(ca, idAprobada) // COD-03: nace PENDIENTE

    const ap = await ca.pedir(`/api/propuestas/${idAprobada}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const f = await poolTest().query(
      'select snapshot_economico from propuestas where id=$1',
      [idAprobada],
    )
    snapAntes = f.rows[0].snapshot_economico
    expect(snapAntes.codigoTexto).toBe('CONGELA20')
    expect(Number(snapAntes.codigoDescuentoPct)).toBe(20)
    expect(snapAntes.codigoCanjeadoEn).toBeTruthy()
    // 100 000 de lista, sin volumen ni comercial → 20 000 de cupón.
    expect(Number(snapAntes.codigoDescuentoMonto)).toBe(20_000)
    expect(Number(snapAntes.base)).toBe(80_000)
    totalAntes = Number(snapAntes.total)
  })

  it('el dueño SUBE el cupón al 60 % y la propuesta aprobada NO se mueve', async () => {
    await poolTest().query(
      `update codigos_promocionales set descuento_pct=60 where codigo='CONGELA20' and tenant_id=$1`,
      [alfa.id],
    )
    const f = await poolTest().query(
      'select snapshot_economico, codigo_descuento_pct from propuestas where id=$1',
      [idAprobada],
    )
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(20)
    expect(Number(f.rows[0].snapshot_economico.codigoDescuentoPct)).toBe(20)
    expect(Number(f.rows[0].snapshot_economico.total)).toBe(totalAntes)
  })

  it('el dueño BORRA el cupón y la propuesta aprobada SIGUE sin moverse', async () => {
    await desbloquear(ca)
    const cupon = await poolTest().query(
      `select id from codigos_promocionales where codigo='CONGELA20' and tenant_id=$1`,
      [alfa.id],
    )
    const del = await ca.pedir(`/api/codigos-promocionales/${cupon.rows[0].id}/`, {
      metodo: 'DELETE',
    })
    expect(del.status, JSON.stringify(del.datos)).toBe(200)

    // El cupón ya no existe…
    const q = await poolTest().query(
      `select count(*) n from codigos_promocionales where codigo='CONGELA20' and tenant_id=$1`,
      [alfa.id],
    )
    expect(Number(q.rows[0].n)).toBe(0)

    // …y la propuesta aprobada no se ha movido ni un peso, ni en la línea viva
    // ni en el snapshot. El texto del código sigue ahí, que es lo que permite
    // explicar la venta seis meses después.
    const f = await poolTest().query(
      'select codigo_texto, codigo_descuento_pct, codigo_canjeado_en, snapshot_economico from propuestas where id=$1',
      [idAprobada],
    )
    expect(f.rows[0].codigo_texto).toBe('CONGELA20')
    expect(Number(f.rows[0].codigo_descuento_pct)).toBe(20)
    expect(f.rows[0].codigo_canjeado_en).not.toBeNull()
    expect(f.rows[0].snapshot_economico).toEqual(snapAntes)
  })

  it('la propuesta APROBADA no admite código nuevo ni deja quitar el suyo', async () => {
    const r = await ca.pedir(`/api/propuestas/${idAprobada}/codigo/`, { cuerpo: { codigo: 'VIGENTE20' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/inmutable/i)
    const q = await ca.pedir(`/api/propuestas/${idAprobada}/codigo/`, { metodo: 'DELETE' })
    expect(q.status).toBe(409)
  })
})

// ─── 7 · UN CUPÓN APLICADO ANTES DE VENCER SIGUE VALIENDO AL APROBAR ───────

describe('7 · la tercera pregunta con trampa: aplicado antes de vencer', () => {
  it('se aplica con el cupón vigente, VENCE, y la propuesta se aprueba igual', async () => {
    // LA DECISIÓN: el canje es un HECHO con fecha. La vigencia controla si el
    // código se puede APLICAR, que es el momento en que se le promete algo al
    // cliente; una vez prometido y con el uso ya contado, aprobar tres días
    // después no puede quitárselo. Lo contrario haría que una cotización
    // enviada el 30 y firmada el 2 cambiara de total sin que nadie lo tocara.
    await sembrarCupon(alfa, 'VENCEDESPUES', 20, enDias(-5), enDias(1), 10)
    const id = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'VENCEDESPUES' } })).status).toBe(200)

    // El cupón vence (se le mueve la fecha de fin al pasado).
    await poolTest().query(
      `update codigos_promocionales set vigente_hasta = current_date - 1
        where codigo='VENCEDESPUES' and tenant_id=$1`,
      [alfa.id],
    )

    // COD-03: el cupón nace PENDIENTE y se aprueba aquí, YA VENCIDO. Aprobar no
    // vuelve a mirar la vigencia: igual que aprobar la propuesta, decide sobre
    // lo canjeado, y la vigencia gobierna el canje.
    await aprobarCupon(ca, id)

    const ap = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const f = await poolTest().query('select snapshot_economico from propuestas where id=$1', [id])
    expect(f.rows[0].snapshot_economico.codigoTexto).toBe('VENCEDESPUES')
    expect(Number(f.rows[0].snapshot_economico.codigoDescuentoPct)).toBe(20)
    expect(Number(f.rows[0].snapshot_economico.base)).toBe(80_000)

    // Pero YA NO SE PUEDE APLICAR a una cotización nueva: la vigencia gobierna
    // el canje, no lo canjeado.
    const otra = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${otra}/codigo/`, { cuerpo: { codigo: 'VENCEDESPUES' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/vencio/i)
  })
})

// ─── 8 · LA CADENA COMPLETA Y LA LIGA PÚBLICA ──────────────────────────────

describe('8 · la cadena se COMPONE, y llega hasta el documento que firma el cliente', () => {
  it('volumen 20 % + comercial 20 % + código 20 % dejan el 51,2 %, no el 40 %', async () => {
    await poolTest().query(
      `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
       values ($1,'spot',50,20)`,
      [alfa.id],
    )
    await sembrarCupon(alfa, 'CADENA20', 20, enDias(-5), enDias(5), 10)

    const cr = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Cadena completa',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(3),
        fechaFin: enDias(33),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 2000, cantidad: 50 }],
      },
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    const id = cr.datos.id as string

    expect((await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { descuentoPct: 20 } })).status).toBe(200)
    expect((await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'CADENA20' } })).status).toBe(200)
    await aprobarCupon(ca, id) // COD-03: sin esto, la liga pública no lo enseña
    expect((await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })).status).toBe(200)

    const f = await poolTest().query('select snapshot_economico, token_publico from propuestas where id=$1', [id])
    const s = f.rows[0].snapshot_economico
    // 50 × 2 000 = 100 000 de lista.
    expect(Number(s.bruto)).toBe(100_000)
    expect(Number(s.brutoConVolumen)).toBe(80_000)
    expect(Number(s.descuentoMonto)).toBe(16_000)
    expect(Number(s.baseComercial)).toBe(64_000)
    expect(Number(s.codigoDescuentoMonto)).toBe(12_800)
    expect(Number(s.base)).toBe(51_200)

    // LA LIGA PÚBLICA: es el documento que el cliente lee y acepta. Si el
    // código no llegara hasta aquí, la cotización enseñaría un total más bajo
    // que su propia cuenta. Es el defecto que la Fase 2 encontró en este mismo
    // sitio revisando el diff.
    const pub = await ca.pedir(`/api/propuestas/publica/${f.rows[0].token_publico}/`)
    expect(pub.status, JSON.stringify(pub.datos)).toBe(200)
    expect(pub.datos.codigoTexto).toBe('CADENA20')
    expect(Number(pub.datos.codigoDescuentoPct)).toBe(20)
    expect(Number(pub.datos.codigoDescuentoMonto)).toBe(12_800)
    expect(Number(pub.datos.baseComercial)).toBe(64_000)
    // Y la cuenta del documento CUADRA: bruto − volumen − comercial − código.
    expect(
      Number(pub.datos.bruto) -
        Number(pub.datos.descuentoVolumenMonto ?? 0) -
        Number(pub.datos.descuentoMonto) -
        Number(pub.datos.codigoDescuentoMonto),
    ).toBe(Number(pub.datos.base))
  })

  it('la CAMPAÑA hereda el código y cobra lo mismo que la propuesta', async () => {
    await sembrarCupon(alfa, 'CAMPANA20', 20, enDias(-5), enDias(5), 10)
    const id = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'CAMPANA20' } })).status).toBe(200)
    await aprobarCupon(ca, id) // COD-03: nace PENDIENTE
    expect((await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })).status).toBe(200)

    const gen = await ca.pedir(`/api/propuestas/${id}/generar-campana/`, { cuerpo: {} })
    expect([200, 201]).toContain(gen.status)

    const r = await poolTest().query(
      `select r.precio, r.codigo_descuento_pct
         from reservas r join campanas c on c.id = r.campana_id
        where c.propuesta_id = $1`,
      [id],
    )
    expect(r.rows).toHaveLength(1)
    // El neto de la propuesta era 80 000: si la campaña cobrara 100 000, el
    // número sería plausible y nadie lo vería — es el de antes del cupón.
    expect(Number(r.rows[0].precio)).toBe(80_000)
    // Y la columna es lo único que explica por qué ese neto no cuadra con la
    // multiplicación de sus partes.
    expect(Number(r.rows[0].codigo_descuento_pct)).toBe(20)
  })
})

// ─── 9 · SIN CÓDIGO, TODO SIGUE EXACTAMENTE IGUAL ──────────────────────────

describe('9 · vender SIN código sigue funcionando, dígito por dígito', () => {
  it('una propuesta sin cupón se aprueba y su snapshot no menciona ningún código', async () => {
    const id = await crearPropuesta(ca, alfa)
    expect((await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })).status).toBe(200)
    const f = await poolTest().query('select snapshot_economico from propuestas where id=$1', [id])
    const s = f.rows[0].snapshot_economico
    expect(Object.keys(s)).not.toContain('codigoTexto')
    expect(Object.keys(s)).not.toContain('baseComercial')
    expect(Number(s.base)).toBe(100_000)
    expect(Number(s.total)).toBe(116_000)
  })

  it('quitar un código a una propuesta que no lo tiene devuelve 404, no 500', async () => {
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { metodo: 'DELETE' })
    expect(r.status).toBe(404)
  })

  it('un código inventado devuelve 400 con una frase, no un error de base', async () => {
    const id = await crearPropuesta(ca, alfa)
    const r = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'NOEXISTE99' } })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/no existe/i)
  })
})

// ─── 10 · EL CANDADO DE ESCRITURA DEL CATÁLOGO ─────────────────────────────

describe('10 · crear un cupón es un cambio SENSIBLE', () => {
  it('sin desbloquear, el POST se rechaza', async () => {
    const c = new Cliente()
    await c.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/codigos-promocionales/', {
      cuerpo: {
        codigo: 'SINPERMISO',
        descuentoPct: 20,
        vigenteDesde: enDias(0),
        vigenteHasta: enDias(10),
        usosMaximos: 5,
      },
    })
    expect(r.status).not.toBe(201)
    const q = await poolTest().query(`select count(*) n from codigos_promocionales where codigo='SINPERMISO'`)
    expect(Number(q.rows[0].n)).toBe(0)
  })

  it('desbloqueado, se crea y el canje lo encuentra', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/codigos-promocionales/', {
      cuerpo: {
        codigo: 'porlaapi',
        descuentoPct: 12,
        vigenteDesde: enDias(0),
        vigenteHasta: enDias(10),
        usosMaximos: 5,
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    // Se guarda NORMALIZADO, en mayúsculas: la pantalla y la publicidad tienen
    // que enseñar la misma palabra.
    expect(r.datos.codigo).toBe('PORLAAPI')
    expect(r.datos.usos).toBe(0)

    const id = await crearPropuesta(ca, alfa)
    const ap = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'PorLaApi' } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
    expect(ap.datos.descuentoPct).toBe(12)
  })

  it('el listado cuenta los usos de verdad', async () => {
    const r = await ca.pedir('/api/codigos-promocionales/')
    expect(r.status).toBe(200)
    const c = (r.datos.codigos ?? []).find((x: any) => x.codigo === 'PORLAAPI')
    expect(c).toBeTruthy()
    expect(c.usos).toBe(1)
  })

  it('un código repetido (aunque cambie de mayúsculas) se rechaza con una frase', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/codigos-promocionales/', {
      cuerpo: {
        codigo: 'PORLAAPI',
        descuentoPct: 30,
        vigenteDesde: enDias(0),
        vigenteHasta: enDias(10),
        usosMaximos: 5,
      },
    })
    expect(r.status).toBe(400)
    expect(String(r.datos.error)).toMatch(/ya existe/i)
  })
})
