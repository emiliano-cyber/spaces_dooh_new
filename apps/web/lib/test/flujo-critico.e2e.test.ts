import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  LA ESPINA: propuesta → campaña → publicación → candado → factura → cobranza.
//
//  Es el recorrido que la auditoría QA del 04/08/2026 pidió blindar («pruebas
//  automatizadas de regresión sobre los flujos críticos»). Las 631 unitarias
//  prueban las piezas; esto prueba que encajan, que el SQL casa con el esquema
//  y que los guards componen en el orden correcto — que es lo que rompe una
//  migración.
//
//  Casos 1–7 del plan acordado. Los casos 4 y 5 —el candado de facturación y
//  la cobranza— son el tramo que la auditoría señaló como el de más dinero por
//  línea de código, y el que ninguna prueba tocaba de punta a punta.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

// Crea una propuesta con su item sobre la pantalla sembrada. `rentaMonto` y
// compañía hacen que el contrato que nace con la campaña nazca COMPLETO
// (ADR 0001); sin ellos la campaña arrastraría un contrato a medias y el fallo
// aparecería tres pasos más adelante, lejos de su causa.
async function crearPropuesta(nombre: string, extra: Record<string, unknown> = {}) {
  return c.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId: org.clienteId,
      nombre,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [{
        sitioId: org.sitioId,
        precio: 45000,
        unidad: 'mensual',
        tarifaUnitaria: 45000,
        cantidad: 1,
        rentaMonto: 20000,
        rentaPeriodicidad: 'MENSUAL',
        rentaInicio: enDias(0),
      }],
      ...extra,
    },
  })
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('espina')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('1 · el recorrido completo llega de propuesta a cobranza', () => {
  it('propuesta → campaña → publicación → candado → factura', async () => {
    const prop = await crearPropuesta('Campaña de regresión')
    expect(prop.status, JSON.stringify(prop.datos)).toBe(201)

    // Aprobar la propuesta: es lo que habilita generar la campaña.
    const aprob = await c.pedir(`/api/propuestas/${prop.datos.id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    // APROBAR YA GENERA LA CAMPAÑA: el PATCH lo hace como efecto, de forma
    // idempotente. Se deja explícito aquí porque no es evidente leyendo la API
    // —hay un endpoint `generar-campana` que parece el paso obligatorio— y
    // porque de ahí sale el 200 de abajo: la campaña ya existía.
    const gen = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
    expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
    const campanaId = gen.datos.id
    expect(campanaId).toBeTruthy()
    expect(gen.datos.estadoComercial).toBe('CONFIRMADA')

    // La campaña nace con su reserva sobre la pantalla de la propuesta.
    const reservas = await poolTest().query(
      'select id, sitio_id from reservas where campana_id = $1',
      [campanaId],
    )
    expect(reservas.rows.length).toBe(1)
    expect(reservas.rows[0].sitio_id).toBe(org.sitioId)
  })
})

describe('2 · generar la campaña dos veces no crea dos (A5)', () => {
  it('la segunda llamada devuelve la MISMA campaña', async () => {
    const prop = await crearPropuesta('Doble clic')
    await c.pedir(`/api/propuestas/${prop.datos.id}/`, {
      metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' },
    })
    const a = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
    const b = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })

    // Las dos devuelven 200 («ya existía») porque la aprobación ya la creó, y
    // sobre todo devuelven LA MISMA. Lo que A5 arregló es que el servidor no
    // anote en bitácora ni notifique cuando no hubo creación real.
    expect(a.status, JSON.stringify(a.datos)).toBe(200)
    expect(b.status, JSON.stringify(b.datos)).toBe(200)
    expect(b.datos.id).toBe(a.datos.id)

    const n = await poolTest().query(
      'select count(*)::int n from campanas where propuesta_id = $1',
      [prop.datos.id],
    )
    expect(n.rows[0].n).toBe(1)

    // Y la bitácora no inventa creaciones: era la otra mitad de A5 —dos
    // entradas «Generó campaña desde propuesta» con el mismo minuto.
    const bitacora = await poolTest().query(
      `select count(*)::int n from acciones
        where accion = 'Generó campaña desde propuesta' and entidad = $1`,
      ['Doble clic'],
    )
    expect(bitacora.rows[0].n).toBeLessThanOrEqual(1)
  })
})

describe('3 · no se envía a dominio con pantallas sin creativo (M14)', () => {
  it('rechaza y NOMBRA la pantalla que falta', async () => {
    const prop = await crearPropuesta('Sin creativo asignado')
    await c.pedir(`/api/propuestas/${prop.datos.id}/`, {
      metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' },
    })
    const gen = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
    const campanaId = gen.datos.id

    // Un creativo CARGADO pero sin asignar a la reserva: exactamente el estado
    // que la auditoría encontró en campañas ya publicadas.
    await poolTest().query(
      `insert into creatividades (campana_id, nombre, estatus_validacion, tenant_id)
       values ($1,'arte.jpg','VALIDADA',$2)`,
      [campanaId, org.id],
    )

    const r = await c.pedir(`/api/campanas/${campanaId}/enviar-dominio/`, { cuerpo: {} })
    // 409: es un conflicto de estado (la campaña no está lista), no un cuerpo
    // mal formado.
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    // El mensaje tiene que decir CUÁL: «asigna los creativos» a secas obliga a
    // buscarlas una por una.
    expect(String(r.datos.error)).toContain('Pantalla espina')
  })
})

// Deja una campaña CONFIRMADA con su reserva, lista para lo que venga después.
async function campanaDesdePropuesta(nombre: string, extra: Record<string, unknown> = {}) {
  const prop = await crearPropuesta(nombre, extra)
  expect(prop.status, JSON.stringify(prop.datos)).toBe(201)
  await c.pedir(`/api/propuestas/${prop.datos.id}/`, {
    metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' },
  })
  const gen = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
  expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
  return gen.datos.id as string
}

async function reservaDe(campanaId: string): Promise<string> {
  const r = await poolTest().query('select id from reservas where campana_id = $1 limit 1', [campanaId])
  return r.rows[0].id
}

async function campana(campanaId: string) {
  const r = await poolTest().query(
    `select tipo_campana, estado_comercial, oc_recibida, fotos_comprobatorias,
            reporte_publicacion, validacion_estatus, enviada_dominio
       from campanas where id = $1`,
    [campanaId],
  )
  return r.rows[0]
}

// Enciende la evidencia DIGITAL por el CAMINO REAL: creativo → APROBADO →
// asignado a la reserva → enviada al dominio → publicación aprobada. Se hace
// así, y no con un `update reporte_publicacion = true`, porque lo que hay que
// probar es que los pasos COMPONEN: tocar la columna a mano probaría el candado
// y se saltaría justamente la cadena que lo enciende.
//
// El paso de APROBAR el creativo no estaba en mi primera versión y por eso
// fallaba: `setCreativosDeReserva` solo asigna los que están en 'VALIDADA' y
// descarta el resto EN SILENCIO — devuelve 200 con la lista vacía. Un creativo
// recién subido nace 'PENDIENTE', así que la asignación no asignaba nada y el
// fallo aparecía tres pasos más adelante, en el guard de M14.
async function publicarYAprobar(campanaId: string) {
  const crea = await c.pedir('/api/creatividades/', {
    cuerpo: { campanaId, nombre: 'arte-espina.jpg', archivoUrl: 'https://ejemplo.test/arte.jpg' },
  })
  expect(crea.status, JSON.stringify(crea.datos)).toBe(201)

  const aprobado = await c.pedir(`/api/creatividades/${crea.datos.id}/`, {
    metodo: 'PATCH', cuerpo: { aprobar: true },
  })
  expect(aprobado.status, JSON.stringify(aprobado.datos)).toBe(200)
  expect(aprobado.datos.estatusValidacion).toBe('VALIDADA')

  const asignacion = await c.pedir(`/api/reservas/${await reservaDe(campanaId)}/creativo/`, {
    metodo: 'PATCH',
    cuerpo: { creativos: [{ creatividadId: crea.datos.id, veces: 1 }] },
  })
  // Se comprueba el EFECTO y no solo el 200: esta ruta contesta 200 aunque
  // descarte todo lo que le mandas. Un status no es una asignación.
  expect(asignacion.datos?.creativos?.length, JSON.stringify(asignacion.datos)).toBe(1)

  const envio = await c.pedir(`/api/campanas/${campanaId}/enviar-dominio/`, { cuerpo: {} })
  const validacion = await c.pedir(`/api/campanas/${campanaId}/validar/`, { cuerpo: { aprobar: true } })
  return { asignacion, envio, validacion }
}

describe('4 · el candado de facturación (A-2)', () => {
  it('sin OC ni evidencia no se factura', async () => {
    const id = await campanaDesdePropuesta('Candado · sin nada')
    const r = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toContain('candado')

    // Y no queda una factura a medias: el rechazo es ANTES de escribir nada.
    const n = await poolTest().query('select count(*)::int n from facturas where campana_id = $1', [id])
    expect(n.rows[0].n).toBe(0)
  })

  it('la OC sola no abre una DOOH: falta la evidencia digital', async () => {
    const id = await campanaDesdePropuesta('Candado · solo OC')
    const oc = await c.pedir(`/api/campanas/${id}/oc/`, { cuerpo: {} })
    expect(oc.status, JSON.stringify(oc.datos)).toBe(200)
    expect((await campana(id)).oc_recibida).toBe(true)

    const r = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
  })

  it('la evidencia FÍSICA no abre una DOOH — los segmentos son independientes', async () => {
    // ESTA es la prueba de A-2, y la razón de que el candado se reescribiera:
    // la UI lo evaluaba como `oc && fotos && reporte`, así que una digital
    // quedaba «Pendiente» para siempre; y al revés, dar por buena una digital
    // porque alguien subió fotos sería facturar sin la evidencia que se vendió.
    //
    // Las fotos se encienden por SQL a propósito: la vía real es la OT de
    // montaje de lona, que en una campaña DOOH no existe. Es exactamente el
    // escenario de N-5 —una campaña sin segmento físico con el flag físico
    // encendido— y el candado tiene que seguir cerrado igual.
    const id = await campanaDesdePropuesta('Candado · física en una digital')
    await c.pedir(`/api/campanas/${id}/oc/`, { cuerpo: {} })
    await poolTest().query('update campanas set fotos_comprobatorias = true where id = $1', [id])

    const est = await campana(id)
    expect(est.tipo_campana).toBe('DOOH')
    expect(est.oc_recibida).toBe(true)
    expect(est.fotos_comprobatorias).toBe(true)
    expect(est.reporte_publicacion).toBe(false)

    const r = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
  })

  it('con la publicación aprobada y la OC, factura — y cuadra el desglose fiscal', async () => {
    const id = await campanaDesdePropuesta('Candado · camino completo')

    const { asignacion, envio, validacion } = await publicarYAprobar(id)
    expect(asignacion.status, JSON.stringify(asignacion.datos)).toBe(200)
    expect(envio.status, JSON.stringify(envio.datos)).toBe(200)
    expect(validacion.status, JSON.stringify(validacion.datos)).toBe(200)

    // Aprobar la publicación es lo que enciende la evidencia digital. Nadie
    // tocó la columna: la encendió el flujo.
    const trasAprobar = await campana(id)
    expect(trasAprobar.enviada_dominio).toBe(true)
    expect(trasAprobar.validacion_estatus).toBe('APROBADA')
    expect(trasAprobar.reporte_publicacion).toBe(true)

    // Sigue faltando la OC: la evidencia sin orden de compra tampoco factura.
    const sinOc = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(sinOc.status, JSON.stringify(sinOc.datos)).toBe(400)

    await c.pedir(`/api/campanas/${id}/oc/`, { cuerpo: {} })
    const r = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.folio).toBeTruthy()

    // El desglose tiene que cerrar al centavo: subtotal + IVA = total. Si no,
    // lo que se timbra no es lo que se cobra.
    const f = await poolTest().query(
      'select subtotal::float s, igv::float i, monto::float m, estatus from facturas where campana_id = $1',
      [id],
    )
    const { s, i, m } = f.rows[0]
    expect(Math.round((s + i) * 100) / 100).toBe(m)
    expect(m).toBeGreaterThan(0)
    expect(f.rows[0].estatus).toBe('EMITIDA')

    // Facturar cierra la campaña y abre la cobranza: sin esto, «facturada» y
    // «por cobrar» serían dos verdades sin conexión.
    expect((await campana(id)).estado_comercial).toBe('COMPLETADA')
    const cob = await poolTest().query(
      'select count(*)::int n from cobranzas where factura_id = (select id from facturas where campana_id = $1)',
      [id],
    )
    expect(cob.rows[0].n).toBe(1)
  })

  it('facturar dos veces devuelve 409 y deja UNA sola factura (A-1)', async () => {
    const id = await campanaDesdePropuesta('Candado · doble factura')
    await publicarYAprobar(id)
    await c.pedir(`/api/campanas/${id}/oc/`, { cuerpo: {} })

    const a = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    const b = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)
    // 409 y no 500: que ya exista factura es una regla de negocio, no una
    // excepción de base de datos que se escapa hacia arriba.
    expect(b.status, JSON.stringify(b.datos)).toBe(409)
    expect(String(b.datos.error)).toContain('ya tiene factura')

    const n = await poolTest().query('select count(*)::int n from facturas where campana_id = $1', [id])
    expect(n.rows[0].n).toBe(1)
  })
})

describe('5 · cobranza en parcialidades', () => {
  // Una campaña de ~6 meses: es lo que hace que existan opciones de cuotas.
  // `opcionesParcialidad` exige que quepa un número ENTERO de periodos y al
  // menos 2, así que con la campaña de 30 días del resto del archivo no habría
  // ningún plan válido y la prueba mediría otra cosa.
  const SEIS_MESES = { fechaInicio: enDias(7), fechaFin: enDias(189) }

  async function facturada(nombre: string, plan: unknown) {
    const id = await campanaDesdePropuesta(nombre, SEIS_MESES)
    await publicarYAprobar(id)
    await c.pedir(`/api/campanas/${id}/oc/`, { cuerpo: {} })
    const f = await c.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90, plan } })
    return { id, f }
  }

  it('las cuotas suman EXACTAMENTE el total de la factura', async () => {
    const { f } = await facturada('Cobranza · seis mensualidades', {
      periodicidad: 'MENSUAL', primerVencimiento: enDias(37),
    })
    expect(f.status, JSON.stringify(f.datos)).toBe(201)

    const cuotas = await poolTest().query(
      `select numero, total_cuotas, monto::float m, estatus, fecha_vencimiento
         from cobranzas where factura_id = $1 order by numero`,
      [f.datos.id],
    )
    expect(cuotas.rows.length).toBe(6)
    expect(cuotas.rows.map((r: any) => r.numero)).toEqual([1, 2, 3, 4, 5, 6])

    // El invariante del dinero: repartir en cuotas no puede crear ni perder un
    // centavo por redondeo. Una cartera que no suma la factura es una cartera
    // que miente, y el propio repo aborta la facturación si no cuadra.
    const suma = Math.round(cuotas.rows.reduce((a: number, r: any) => a + r.m, 0) * 100) / 100
    expect(suma).toBe(f.datos.monto)

    // Y se escalonan: seis cuotas con el mismo vencimiento no son un plan.
    const vencimientos = cuotas.rows.map((r: any) => String(r.fecha_vencimiento))
    expect(new Set(vencimientos).size).toBe(6)
  })

  it('un plan que no cabe en la duración se rechaza, y dice cuáles caben', async () => {
    // ANUAL en una campaña de seis meses: media cuota no existe. El mensaje
    // tiene que ofrecer las opciones buenas — si no, el usuario prueba a ciegas.
    const { f } = await facturada('Cobranza · plan imposible', {
      periodicidad: 'ANUAL', primerVencimiento: enDias(37),
    })
    expect(f.status, JSON.stringify(f.datos)).toBe(400)
    expect(String(f.datos.error)).toMatch(/mensuales|bimestrales|trimestrales/)
  })

  it('abonar de más no crea saldo a favor: el abono se acota a lo que se debe', async () => {
    const { f } = await facturada('Cobranza · abono excesivo', {
      periodicidad: 'TRIMESTRAL', primerVencimiento: enDias(37),
    })
    const cuotas = await poolTest().query(
      'select id, monto::float m from cobranzas where factura_id = $1 order by numero',
      [f.datos.id],
    )
    const primera = cuotas.rows[0]

    const r = await c.pedir(`/api/cobranzas/${primera.id}/pagar/`, {
      cuerpo: { monto: primera.m * 10 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const tras = await poolTest().query('select monto_pagado::float p, estatus from cobranzas where id = $1', [primera.id])
    expect(tras.rows[0].p).toBe(primera.m)
    expect(tras.rows[0].estatus).toBe('PAGADA')
  })

  it('liquidar UNA cuota no da por cobrada la factura; liquidarlas todas, sí', async () => {
    const { f } = await facturada('Cobranza · liquidación por partes', {
      periodicidad: 'TRIMESTRAL', primerVencimiento: enDias(37),
    })
    expect(f.status, JSON.stringify(f.datos)).toBe(201)
    const cuotas = await poolTest().query(
      'select id, monto::float m from cobranzas where factura_id = $1 order by numero',
      [f.datos.id],
    )
    expect(cuotas.rows.length).toBe(2)

    // Un ABONO parcial no liquida ni siquiera su propia cuota.
    const abono = await c.pedir(`/api/cobranzas/${cuotas.rows[0].id}/pagar/`, {
      cuerpo: { monto: Math.floor(cuotas.rows[0].m / 3) },
    })
    expect(abono.status, JSON.stringify(abono.datos)).toBe(200)
    let estado = await poolTest().query('select estatus, monto_pagado::float p from cobranzas where id = $1', [cuotas.rows[0].id])
    expect(estado.rows[0].estatus).toBe('AL_CORRIENTE')
    expect(estado.rows[0].p).toBeGreaterThan(0)

    // Liquidada la PRIMERA, la factura sigue sin estar pagada: marcarla aquí
    // daría por cobrado lo que no se ha cobrado, y ese número sube al KPI de
    // cartera.
    await c.pedir(`/api/cobranzas/${cuotas.rows[0].id}/pagar/`, { cuerpo: {} })
    estado = await poolTest().query('select estatus from cobranzas where id = $1', [cuotas.rows[0].id])
    expect(estado.rows[0].estatus).toBe('PAGADA')
    let fac = await poolTest().query('select estatus from facturas where id = $1', [f.datos.id])
    expect(fac.rows[0].estatus).toBe('EMITIDA')

    // Con la última, ya no queda parcialidad viva y la factura sí se cierra.
    await c.pedir(`/api/cobranzas/${cuotas.rows[1].id}/pagar/`, { cuerpo: {} })
    fac = await poolTest().query('select estatus from facturas where id = $1', [f.datos.id])
    expect(fac.rows[0].estatus).toBe('PAGADA')
  })
})

describe('6 y 7 · validación de dominio en la propuesta (C2)', () => {
  it('rechaza fecha fin anterior al inicio', async () => {
    const r = await c.pedir('/api/propuestas/', {
      cuerpo: {
        clienteId: org.clienteId,
        nombre: 'Fechas al revés',
        fechaInicio: enDias(37),
        fechaFin: enDias(7),
        items: [{ sitioId: org.sitioId, precio: 45000, unidad: 'mensual', cantidad: 1 }],
      },
    })
    expect(r.status).toBe(400)
  })

  it('rechaza una comisión mayor que 100%', async () => {
    // Con 150% el divisor daba -0.5 y el neto salía NEGATIVO; de ahí los
    // importes en rojo que viajaban hasta los KPI del dashboard.
    const r = await crearPropuesta('Comisión imposible', { comisionPct: 150 })
    expect(r.status).toBe(400)
  })

  it('con una comisión válida, el neto NUNCA sale negativo', async () => {
    const r = await crearPropuesta('Comisión al límite', { comisionPct: 99 })
    expect(r.status).toBe(201)
    const totales = await poolTest().query(
      `select coalesce(sum(precio),0)::float as bruto from propuesta_items where propuesta_id = $1`,
      [r.datos.id],
    )
    expect(totales.rows[0].bruto).toBeGreaterThan(0)
  })
})
