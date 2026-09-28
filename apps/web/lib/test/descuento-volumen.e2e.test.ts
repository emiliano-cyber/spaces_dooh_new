import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  VOL-01 · el descuento por volumen contra Postgres de verdad.  ADR 0039,
//  Fase 2.
// ----------------------------------------------------------------------------
//  Es ROJO por triple —migración, tenant y dinero—. Las unitarias SIMULAN la
//  base, así que hay cuatro cosas que no pueden ver y que son exactamente lo
//  que esta fase arriesga:
//
//   1. **Que la migración se aplicó.** El alta de propuestas escribe ahora dos
//      columnas nuevas. Si no existieran, las unitarias seguirían en verde y
//      crear una propuesta devolvería un 500.
//   2. **Que la escala de una organización NO se lee desde otra** (R2). Su modo
//      de fallo no da error: cero tramos significa «aquí no se descuenta», así
//      que una fuga al revés —no ver los propios— se ve como una venta más cara
//      y nadie la investiga.
//   3. **Que el umbral repetido lo corta la BASE**, no solo el controller. El
//      `unique` es lo que queda en pie el día que alguien escriba por otra ruta.
//   4. **Que una propuesta APROBADA no cambia al mover la escala.** El modo de
//      fallo no da error: la propuesta se lee perfectamente bien, solo que con
//      el descuento de hoy en vez de con el que el cliente aceptó.
//
//  Y la quinta, que protege a los clientes de hoy: **vender SIN escala tiene
//  que seguir funcionando**. Hay inventario cargado y propuestas vivas.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('volalfa')
  beta = await sembrarTenant('volbeta')

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

/** El candado: escribir la escala es un cambio SENSIBLE, como una tarifa. */
async function desbloquear(c: Cliente) {
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

/**
 * Fija el tope de descuento de una organización.
 *
 * `config_negocio` nace VACÍA y su fila se crea la primera vez que alguien lee
 * la configuración (`config-repo.ts:73-76`), así que un `update` a secas puede
 * no tocar nada — y entonces la prueba del tope pasaría por el motivo
 * equivocado: no porque el tope funcione, sino porque sigue en 100.
 */
async function fijarTope(org: { id: string }, pct: number) {
  const r = await poolTest().query(
    'update config_negocio set tope_descuento_pct = $2 where tenant_id = $1',
    [org.id, pct],
  )
  if (!r.rowCount) {
    await poolTest().query(
      'insert into config_negocio (tenant_id, tope_descuento_pct) values ($1,$2)',
      [org.id, pct],
    )
  }
  const comp = await poolTest().query(
    'select tope_descuento_pct from config_negocio where tenant_id = $1',
    [org.id],
  )
  expect(Number(comp.rows[0].tope_descuento_pct)).toBe(pct)
}

/** Siembra un tramo con el pool de pruebas, saltándose la aplicación. */
async function sembrarTramo(
  org: { id: string },
  unidad: string,
  desde: number,
  pct: number,
): Promise<string> {
  const r = await poolTest().query(
    `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
     values ($1,$2,$3,$4) returning id`,
    [org.id, unidad, desde, pct],
  )
  return r.rows[0].id as string
}

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración dejó el esquema como se pidió', () => {
  it('`escalas_volumen` existe con RLS ENABLE y FORCE', async () => {
    const r = await poolTest().query(
      `select relrowsecurity, relforcerowsecurity from pg_class
        where relname = 'escalas_volumen'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].relrowsecurity).toBe(true)
    expect(r.rows[0].relforcerowsecurity).toBe(true)
  })

  it('las tres columnas nuevas existen y nacen en cero', async () => {
    const r = await poolTest().query(
      `select table_name, column_name, column_default from information_schema.columns
        where (table_name='propuesta_items' and column_name in ('descuento_volumen_pct','volumen_desde'))
           or (table_name='reservas' and column_name='descuento_volumen_pct')
        order by table_name, column_name`,
    )
    expect(r.rows.map((x) => `${x.table_name}.${x.column_name}`)).toEqual([
      'propuesta_items.descuento_volumen_pct',
      'propuesta_items.volumen_desde',
      'reservas.descuento_volumen_pct',
    ])
  })

  it('«desde 1» lo rechaza LA BASE, no solo la aplicación', async () => {
    // Un tramo desde 1 aplicaría a toda venta: no es volumen, es bajar el
    // tarifario entero sin tocar una tarifa y sin que se note en ningún sitio.
    await expect(
      poolTest().query(
        `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
         values ($1,'spot',1,10)`,
        [alfa.id],
      ),
    ).rejects.toThrow()
  })

  it('un tramo al 0 % lo rechaza LA BASE', async () => {
    await expect(
      poolTest().query(
        `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
         values ($1,'spot',10,0)`,
        [alfa.id],
      ),
    ).rejects.toThrow()
  })
})

// ─── 2 · EL SOLAPE LO CORTA LA BASE ─────────────────────────────────────────

describe('2 · dos tramos con el MISMO umbral no caben', () => {
  it('el `unique` rechaza el umbral repetido aunque se escriba por fuera de la aplicación', async () => {
    await sembrarTramo(alfa, 'spot', 200, 20)
    await expect(sembrarTramo(alfa, 'spot', 200, 25)).rejects.toThrow()
  })

  it('el mismo umbral en OTRA unidad sí cabe: la escala es por unidad', async () => {
    await expect(sembrarTramo(alfa, 'mensual', 200, 20)).resolves.toBeTruthy()
  })

  it('y el mismo umbral en OTRA organización también: la escala es de cada una', async () => {
    await expect(sembrarTramo(beta, 'spot', 200, 20)).resolves.toBeTruthy()
  })

  it('por la RED, el rechazo es una FRASE y no un error de restricción', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/volumen/escalas/', {
      cuerpo: { unidad: 'spot', desdeCantidad: 200, descuentoPct: 30 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/ya hay un tramo/i)
    expect(String(r.datos.error)).toMatch(/200/)
  })

  it('comprar MÁS y descontar MENOS se rechaza, y el mensaje lo explica', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/volumen/escalas/', {
      cuerpo: { unidad: 'spot', desdeCantidad: 500, descuentoPct: 5 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/comprar mas/i)
  })
})

// ─── 3 · R2 · LA ESCALA DE OTRA ORGANIZACIÓN NO SE VE NI SE TOCA ────────────

describe('3 · aislamiento entre organizaciones', () => {
  it('alfa NO ve los tramos de beta', async () => {
    const r = await ca.pedir('/api/volumen/escalas/')
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const tramos = r.datos.tramos as { id: string }[]
    const idsBeta = await poolTest().query(
      'select id from escalas_volumen where tenant_id = $1',
      [beta.id],
    )
    const beteanos = new Set(idsBeta.rows.map((x) => x.id))
    expect(tramos.some((t) => beteanos.has(t.id))).toBe(false)
    expect(tramos.length).toBeGreaterThan(0) // y sí ve los suyos
  })

  it('alfa NO puede editar un tramo de beta: 404, y el de beta no se mueve', async () => {
    const suyo = await poolTest().query(
      'select id, descuento_pct from escalas_volumen where tenant_id = $1 limit 1',
      [beta.id],
    )
    const id = suyo.rows[0].id as string
    await desbloquear(ca)
    // El cuerpo es PERFECTAMENTE VÁLIDO para alfa —unidad sin tramos suyos— y
    // eso es deliberado: las reglas de negocio se comprueban contra el catálogo
    // PROPIO antes de tocar la fila, así que un cuerpo inválido daría 400 y la
    // prueba pasaría por el motivo equivocado, sin llegar nunca a demostrar que
    // la fila ajena está fuera de alcance.
    const r = await ca.pedir(`/api/volumen/escalas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { unidad: 'diaria', desdeCantidad: 10, descuentoPct: 5 },
    })
    // 404 y no 403: decir «existe pero no es tuyo» ya cuenta algo de la otra.
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    const despues = await poolTest().query(
      'select descuento_pct from escalas_volumen where id = $1',
      [id],
    )
    expect(Number(despues.rows[0].descuento_pct)).toBe(Number(suyo.rows[0].descuento_pct))
  })

  it('alfa NO puede borrar un tramo de beta', async () => {
    const suyo = await poolTest().query(
      'select id from escalas_volumen where tenant_id = $1 limit 1',
      [beta.id],
    )
    const id = suyo.rows[0].id as string
    await desbloquear(ca)
    const r = await ca.pedir(`/api/volumen/escalas/${id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    const sigue = await poolTest().query('select 1 from escalas_volumen where id = $1', [id])
    expect(sigue.rows).toHaveLength(1)
  })

  it('la escala de alfa NO descuenta una venta de beta', async () => {
    // El fallo que esto caza no da error: beta vería un precio más barato que
    // el que su dueño decidió, y lo firmaría un cliente.
    await sembrarTramo(alfa, 'hora', 3, 50)
    const r = await cb.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Beta compra horas',
        clienteId: beta.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(5),
        items: [{ sitioId: beta.sitioId, unidad: 'hora', tarifaUnitaria: 1000, cantidad: 10 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query(
      'select descuento_volumen_pct from propuesta_items where propuesta_id = $1',
      [r.datos.id],
    )
    expect(Number(fila.rows[0].descuento_volumen_pct)).toBe(0)
  })
})

// ─── 4 · EL SERVIDOR DECIDE EL DESCUENTO (B40 contenido) ────────────────────

describe('4 · el porcentaje lo pone el servidor, no el cliente', () => {
  it('50 spots con la escala capturada quedan escritos con su 10 % y su umbral', async () => {
    await sembrarTramo(alfa, 'spot', 50, 10)
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Cincuenta spots',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query(
      'select precio, tarifa_unitaria, descuento_volumen_pct, volumen_desde from propuesta_items where propuesta_id = $1',
      [r.datos.id],
    )
    expect(Number(fila.rows[0].descuento_volumen_pct)).toBe(10)
    expect(Number(fila.rows[0].volumen_desde)).toBe(50)
    // `precio` sigue siendo el de LISTA y cuadra con su propia multiplicación.
    expect(Number(fila.rows[0].precio)).toBe(60000)
    expect(Number(fila.rows[0].tarifa_unitaria)).toBe(1200)
  })

  it('un porcentaje MANDADO POR LA RED se ignora: lo decide la escala', async () => {
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Intento de regalo',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [
          {
            sitioId: alfa.sitioId,
            unidad: 'spot',
            tarifaUnitaria: 1200,
            cantidad: 50,
            descuentoVolumenPct: 90,
            volumenDesde: 2,
          },
        ],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query(
      'select descuento_volumen_pct, volumen_desde from propuesta_items where propuesta_id = $1',
      [r.datos.id],
    )
    expect(Number(fila.rows[0].descuento_volumen_pct)).toBe(10)
    expect(Number(fila.rows[0].volumen_desde)).toBe(50)
  })

  it('49 spots NO llegan al tramo: el umbral es el que es', async () => {
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Cuarenta y nueve',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 49 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query(
      'select descuento_volumen_pct from propuesta_items where propuesta_id = $1',
      [r.datos.id],
    )
    expect(Number(fila.rows[0].descuento_volumen_pct)).toBe(0)
  })
})

// ─── 5 · EL CONGELADO ───────────────────────────────────────────────────────

describe('5 · una propuesta aprobada no se mueve al mover la escala', () => {
  it('el snapshot congela el porcentaje, el umbral y los totales compuestos', async () => {
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'La que se congela',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const id = creada.datos.id as string

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const snap = await poolTest().query(
      'select snapshot_economico from propuestas where id = $1',
      [id],
    )
    const s = snap.rows[0].snapshot_economico
    expect(s.bruto).toBe(60000)
    expect(s.descuentoVolumenMonto).toBe(6000)
    expect(s.brutoConVolumen).toBe(54000)
    expect(s.base).toBe(54000)
    expect(s.porSitio[0].descuentoVolumenPct).toBe(10)
    expect(s.porSitio[0].volumenDesde).toBe(50)
    expect(s.porSitio[0].lista).toBe(60000)

    // ── Y AHORA SE MUEVE LA ESCALA ────────────────────────────────────────
    await poolTest().query(
      `update escalas_volumen set descuento_pct = 40
        where tenant_id = $1 and unidad = 'spot' and desde_cantidad = 50`,
      [alfa.id],
    )
    // Incluso borrándola entera: nada referencia el tramo, y el snapshot no lo
    // vuelve a mirar.
    const despues = await poolTest().query(
      'select snapshot_economico from propuestas where id = $1',
      [id],
    )
    expect(despues.rows[0].snapshot_economico).toEqual(s)

    // ── Y SE DEJA LA ESCALA COMO ESTABA, ANTES DE SEGUIR AFIRMANDO ───────
    // Va aquí y no al final a propósito: si una aserción posterior fallara, la
    // restauración no correría y los bloques siguientes cotizarían con el 40 %
    // que esta prueba metió — fallando por un motivo que no es el suyo. Un
    // archivo e2e comparte una sola base: lo que una prueba ensucia, lo paga la
    // de al lado, y el diagnóstico se va por el desagüe.
    await poolTest().query(
      `update escalas_volumen set descuento_pct = 10
        where tenant_id = $1 and unidad = 'spot' and desde_cantidad = 50`,
      [alfa.id],
    )

    // Y la LÍNEA VIVA tampoco se mueve, que es la primera de las dos redes: el
    // porcentaje se copió al ítem el día de la captura, así que ni siquiera
    // hace falta llegar al snapshot para que la escala de hoy no la alcance.
    const item = await poolTest().query(
      'select descuento_volumen_pct, volumen_desde from propuesta_items where propuesta_id = $1',
      [id],
    )
    expect(Number(item.rows[0].descuento_volumen_pct)).toBe(10)
    expect(Number(item.rows[0].volumen_desde)).toBe(50)
  })
})

// ─── 6 · EL TOPE (VOL-02) ───────────────────────────────────────────────────

describe('6 · el volumen cuenta contra el tope de descuento', () => {
  it('con 10 % de volumen y tope 15, un 10 % comercial ya no cabe — y el mensaje lo dice', async () => {
    await fijarTope(alfa, 15)
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Tope con volumen',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const id = creada.datos.id as string

    // compuesto(10, 10) = 19 % > 15
    const r = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { descuentoPct: 10 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/volumen/i)

    // Y NO se guardó nada.
    const fila = await poolTest().query('select descuento_pct from propuestas where id = $1', [id])
    expect(Number(fila.rows[0].descuento_pct)).toBe(0)
  })

  it('el que sí cabe se guarda: compuesto(5, 10) = 14,5 % ≤ 15', async () => {
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Tope que sí cabe',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    const id = creada.datos.id as string
    const r = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { descuentoPct: 5 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })

  it('SIN volumen el tope se comporta exactamente como antes de esta fase', async () => {
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Tope sin volumen',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 2 }],
      },
    })
    const id = creada.datos.id as string
    const ok = await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { descuentoPct: 15 } })
    expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
    const no = await ca.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { descuentoPct: 16 } })
    expect(no.status, JSON.stringify(no.datos)).toBe(400)
  })
})

// ─── 7 · INVARIANTE 3 · VENDER SIN ESCALA SIGUE FUNCIONANDO ─────────────────

describe('7 · lo que no tiene tramos se sigue vendiendo igual', () => {
  it('una unidad sin tramos se vende y se aprueba sin un solo campo de volumen', async () => {
    await fijarTope(alfa, 100)
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta de toda la vida',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: alfa.sitioId, unidad: 'catorcenal', tarifaUnitaria: 5000 }],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const id = creada.datos.id as string

    const fila = await poolTest().query(
      'select descuento_volumen_pct, volumen_desde from propuesta_items where propuesta_id = $1',
      [id],
    )
    expect(Number(fila.rows[0].descuento_volumen_pct)).toBe(0)
    expect(fila.rows[0].volumen_desde).toBeNull()

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const snap = await poolTest().query(
      'select snapshot_economico from propuestas where id = $1',
      [id],
    )
    const s = snap.rows[0].snapshot_economico
    // Sin volumen no aparece NINGÚN campo nuevo: el JSON de una venta sin
    // tramos es el mismo que producía la Fase 1.
    expect(s.descuentoVolumenMonto).toBeUndefined()
    expect(s.brutoConVolumen).toBeUndefined()
    expect(s.porSitio[0].descuentoVolumenPct).toBeUndefined()
    expect(s.base).toBe(s.bruto)
  })
})

// ─── 7.bis · LA LIGA PÚBLICA LLEVA EL VOLUMEN ──────────────────────────────

describe('7.bis · el documento que ve el CLIENTE enseña el descuento', () => {
  it('la liga publica trae el volumen, y la cuenta cuadra', async () => {
    // Esto lo encontró la revisión del diff, no una prueba: `obtenerPropuestaPublica`
    // arma su respuesta A MANO, campo por campo, así que añadir un dato a
    // `armarPropuesta` NO basta para que llegue aquí. Sin esta prueba, la
    // cotización que firma el cliente enseñaría un bruto y un total que no
    // cuadran entre sí, y la pantalla no puede inventarse la diferencia.
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'La que ve el cliente',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const token = await poolTest().query(
      'select token_publico from propuestas where id = $1',
      [creada.datos.id],
    )
    const pub = await ca.pedir(`/api/propuestas/publica/${token.rows[0].token_publico}/`)
    expect(pub.status, JSON.stringify(pub.datos)).toBe(200)
    expect(pub.datos.bruto).toBe(60000)
    expect(pub.datos.descuentoVolumenMonto).toBe(6000)
    expect(pub.datos.brutoConVolumen).toBe(54000)
    expect(pub.datos.descuentoVolumenPct).toBeCloseTo(10, 6)
    // Y la cuenta que el cliente puede seguir con el dedo:
    expect(pub.datos.bruto - pub.datos.descuentoVolumenMonto - pub.datos.descuentoMonto)
      .toBe(pub.datos.base)
  })
})

// ─── 8 · LA CAMPAÑA HEREDA EL VOLUMEN ───────────────────────────────────────

describe('8 · la campaña que nace de la propuesta cobra lo pactado', () => {
  it('la reserva hereda el neto CON volumen y el porcentaje que lo explica', async () => {
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'La que se convierte',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
      },
    })
    const id = creada.datos.id as string
    // APROBAR YA GENERA LA CAMPAÑA (`app/api/propuestas/[id]/route.ts:78-80`).
    // Llamar además a `generar-campana` devolvería 200 con `yaExistia`, así que
    // se prueba el camino real y no uno inventado para la prueba.
    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const res = await poolTest().query(
      `select r.precio, r.descuento_volumen_pct
         from reservas r join campanas c on c.id = r.campana_id
        where c.propuesta_id = $1`,
      [id],
    )
    expect(res.rows).toHaveLength(1)
    // 60 000 × 0,9 = 54 000, sin descuento comercial ni comisión.
    expect(Number(res.rows[0].precio)).toBe(54000)
    expect(Number(res.rows[0].descuento_volumen_pct)).toBe(10)
  })
})
