import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CFG-01 · el plazo de cobranza válido es el que configuró LA ORGANIZACIÓN.
// ----------------------------------------------------------------------------
//  Las unitarias ya prueban la validación con la base doblada. Lo que NO puede
//  probar un mock es lo que aquí importa:
//
//   · que lo que guarda Administración (`PATCH /api/config`) es exactamente lo
//     que lee la facturación — el bucle completo, no dos módulos que se creen
//     de acuerdo,
//   · que la lectura de `config_negocio` va con RLS de verdad y la lista de una
//     organización no decide lo que puede facturar la otra. Las unitarias
//     simulan el tenant; el aislamiento solo se ve contra Postgres,
//   · que el plazo capturado LLEGA a `cobranzas.plazo_dias` y a la fecha de
//     vencimiento, que es donde vive el dinero.
//
//  Y el caso que da miedo: una cobranza ya emitida a 45 días cuando la
//  organización deja de ofrecer 45. La validación es para lo que se ESCRIBE;
//  lo ya escrito no puede volverse inválido de golpe.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('plazoalfa')
  beta = await sembrarTenant('plazobeta')
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)

  // ─── Desde el 2026-08-28 hay que desbloquear para facturar ───────────────
  // `20260828_reautenticacion_por_defecto.sql` puso el DEFAULT de
  // `tenants.exigir_reautenticacion` en `true`, así que una organización recién
  // sembrada nace con el candado CERRADO y `POST /api/campanas/[id]/facturar`
  // responde `403 {"requiereDesbloqueo":true}`.
  //
  // **LAS DOS**, y no solo `ca`: el desbloqueo vive en la SESIÓN
  // (`sesiones.desbloqueo_expira_en`, `cambios.ts:65-68`), no en la
  // organización. `cb` factura en el caso de aislamiento y necesita el suyo.
  //
  // ⚠️ Una sola vez por cliente, no antes de cada caso: el endpoint limita a 5
  // por usuario e IP cada 5 minutos (`cambios/desbloquear/route.ts:20`) y el
  // desbloqueo dura 15 (`cambios.ts:49`). Ver `borrado-cliente.e2e.test.ts:78-82`.
  for (const cl of [ca, cb]) {
    const d = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(d.status, JSON.stringify(d.datos)).toBe(200)
  }
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// Deja una campaña LISTA PARA FACTURAR por el camino real: propuesta aprobada →
// campaña → creativo validado y asignado → enviada a dominio → publicación
// aprobada → OC recibida. Encender las columnas a mano probaría otra cosa: el
// candado de facturación (A-2) rechaza antes de mirar el plazo, y entonces
// todos los casos de abajo darían 400 por el motivo equivocado.
async function campanaFacturable(
  c: Cliente,
  org: Awaited<ReturnType<typeof sembrarTenant>>,
  nombre: string,
): Promise<string> {
  const prop = await c.pedir('/api/propuestas/', {
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
    },
  })
  expect(prop.status, JSON.stringify(prop.datos)).toBe(201)
  await c.pedir(`/api/propuestas/${prop.datos.id}/`, {
    metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' },
  })
  const gen = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
  expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
  const campanaId = gen.datos.id as string

  const crea = await c.pedir('/api/creatividades/', {
    cuerpo: { campanaId, nombre: 'arte-plazos.jpg', archivoUrl: 'https://ejemplo.test/arte.jpg' },
  })
  expect(crea.status, JSON.stringify(crea.datos)).toBe(201)
  await c.pedir(`/api/creatividades/${crea.datos.id}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })
  const reserva = await poolTest().query(
    'select id from reservas where campana_id = $1 limit 1', [campanaId],
  )
  const asignacion = await c.pedir(`/api/reservas/${reserva.rows[0].id}/creativo/`, {
    metodo: 'PATCH',
    cuerpo: { creativos: [{ creatividadId: crea.datos.id, veces: 1 }] },
  })
  // El status no basta: esta ruta contesta 200 aunque descarte todo lo que le
  // mandas, y entonces el candado quedaría cerrado tres pasos más adelante.
  expect(asignacion.datos?.creativos?.length, JSON.stringify(asignacion.datos)).toBe(1)

  await c.pedir(`/api/campanas/${campanaId}/enviar-dominio/`, { cuerpo: {} })
  await c.pedir(`/api/campanas/${campanaId}/validar/`, { cuerpo: { aprobar: true } })
  const oc = await c.pedir(`/api/campanas/${campanaId}/oc/`, { cuerpo: {} })
  expect(oc.status, JSON.stringify(oc.datos)).toBe(200)
  return campanaId
}

async function configurarPlazos(c: Cliente, plazos: number[]) {
  const r = await c.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { plazosCobranza: plazos } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r
}

async function cobranzaDe(campanaId: string) {
  const r = await poolTest().query(
    // La fecha se formatea EN SQL: un `date` de Postgres llega como Date de JS
    // a medianoche local, y `toISOString()` la corre un día entero en cualquier
    // zona con desfase positivo. Comparar cadenas evita una prueba que pasa en
    // esta máquina (UTC-6) y falla en CI.
    `select c.plazo_dias, to_char(c.fecha_vencimiento, 'YYYY-MM-DD') vence, c.tenant_id
       from cobranzas c
       join facturas f on f.id = c.factura_id
      where f.campana_id = $1`,
    [campanaId],
  )
  return r.rows
}

describe('CFG-01 · lo que guarda Administración es lo que acepta Facturación', () => {
  it('un plazo capturado por la organización se puede facturar', async () => {
    // Este es el hallazgo entero en una prueba: 45 días es un plazo legítimo
    // de esta empresa y hasta hoy la API le contestaba «Plazo inválido».
    await configurarPlazos(ca, [45, 75])
    const id = await campanaFacturable(ca, alfa, 'CFG-01 · plazo propio')

    const r = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 45 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)

    // Y el plazo LLEGA al dinero: la cobranza vence a 45 días, no a 90.
    const [cob] = await cobranzaDe(id)
    expect(cob.plazo_dias).toBe(45)
    expect(cob.vence).toBe(enDias(45))
  })

  it('un plazo que NO configuró se rechaza, y el mensaje dice los suyos', async () => {
    await configurarPlazos(ca, [45, 75])
    const id = await campanaFacturable(ca, alfa, 'CFG-01 · plazo ajeno')

    const r = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toContain('45')
    expect(String(r.datos.error)).toContain('75')
    // La mentira que se corrige: recitar 60/90/120 a quien no los tiene.
    expect(String(r.datos.error)).not.toContain('120')

    // Y no queda nada a medias: ni factura ni cobranza.
    const f = await poolTest().query(
      'select count(*)::int n from facturas where campana_id = $1', [id],
    )
    expect(f.rows[0].n).toBe(0)
  })

  it('quitar un plazo de la configuración lo retira de la facturación', async () => {
    // El bucle al revés: hasta ahora daba igual lo que se guardara.
    await configurarPlazos(ca, [30])
    const id = await campanaFacturable(ca, alfa, 'CFG-01 · plazo retirado')

    const fuera = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 45 } })
    expect(fuera.status, JSON.stringify(fuera.datos)).toBe(400)

    const dentro = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 30 } })
    expect(dentro.status, JSON.stringify(dentro.datos)).toBe(201)
  })
})

describe('CFG-01 · dos organizaciones, dos listas (RLS)', () => {
  it('la lista de una NO decide lo que puede facturar la otra', async () => {
    // Es el fallo que no da error: si la lectura de `config_negocio` perdiera
    // el contexto de tenant, alfa validaría contra la lista de beta —o contra
    // cero filas— y nadie vería una excepción. Solo se ve así, con dos
    // organizaciones vivas a la vez contra el mismo Postgres.
    await configurarPlazos(ca, [15])
    await configurarPlazos(cb, [200])

    const idA = await campanaFacturable(ca, alfa, 'CFG-01 · aislamiento alfa')
    const idB = await campanaFacturable(cb, beta, 'CFG-01 · aislamiento beta')

    expect((await ca.pedir(`/api/campanas/${idA}/facturar/`, { cuerpo: { plazoDias: 200 } })).status).toBe(400)
    expect((await cb.pedir(`/api/campanas/${idB}/facturar/`, { cuerpo: { plazoDias: 15 } })).status).toBe(400)

    const a = await ca.pedir(`/api/campanas/${idA}/facturar/`, { cuerpo: { plazoDias: 15 } })
    const b = await cb.pedir(`/api/campanas/${idB}/facturar/`, { cuerpo: { plazoDias: 200 } })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)
    expect(b.status, JSON.stringify(b.datos)).toBe(201)

    // Cada cobranza, con su plazo y en su organización.
    const [cobA] = await cobranzaDe(idA)
    const [cobB] = await cobranzaDe(idB)
    expect(cobA.plazo_dias).toBe(15)
    expect(cobA.tenant_id).toBe(alfa.id)
    expect(cobB.plazo_dias).toBe(200)
    expect(cobB.tenant_id).toBe(beta.id)
  })

  it('cambiar los plazos de una no toca la fila de la otra', async () => {
    await configurarPlazos(ca, [10, 20])
    const antes = await poolTest().query(
      'select plazos_cobranza from config_negocio where tenant_id = $1', [beta.id],
    )
    await configurarPlazos(ca, [10, 20, 30])
    const despues = await poolTest().query(
      'select plazos_cobranza from config_negocio where tenant_id = $1', [beta.id],
    )
    expect(despues.rows[0].plazos_cobranza).toEqual(antes.rows[0].plazos_cobranza)
  })
})

describe('CFG-01 · la lista vacía no apaga la facturación', () => {
  it('sin plazos configurados se sigue facturando con 60/90/120', async () => {
    // `PATCH /api/config` acepta el arreglo vacío, así que este estado es
    // alcanzable desde la pantalla. Si la validación lo tomara al pie de la
    // letra, esta organización no podría emitir NINGUNA factura — un fallo
    // peor que el que se está corrigiendo, y sobre dinero.
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { plazosCobranza: [] } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const guardado = await poolTest().query(
      'select plazos_cobranza from config_negocio where tenant_id = $1', [alfa.id],
    )
    // Se comprueba que la base quedó VACÍA de verdad: si el PATCH la hubiera
    // ignorado, la prueba pasaría sin probar nada.
    expect(guardado.rows[0].plazos_cobranza).toEqual([])

    const id = await campanaFacturable(ca, alfa, 'CFG-01 · lista vacia')
    const f = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 90 } })
    expect(f.status, JSON.stringify(f.datos)).toBe(201)
    expect((await cobranzaDe(id))[0].plazo_dias).toBe(90)
  })
})

describe('CFG-01 · lo ya facturado no se vuelve inválido', () => {
  it('una cobranza emitida a 45 días sobrevive a que se retire el 45', async () => {
    // LA VALIDACIÓN ES PARA LO QUE SE ESCRIBE, NO PARA LO YA ESCRITO. Si
    // alguien quita el 45 de Administración, las cobranzas vivas a 45 días
    // tienen que seguir leyéndose, cobrándose y venciendo cuando les toca:
    // reescribirlas o esconderlas sería mover dinero pactado.
    await configurarPlazos(ca, [45, 90])
    const id = await campanaFacturable(ca, alfa, 'CFG-01 · historico a 45')
    const emision = await ca.pedir(`/api/campanas/${id}/facturar/`, { cuerpo: { plazoDias: 45 } })
    expect(emision.status, JSON.stringify(emision.datos)).toBe(201)
    const [antes] = await cobranzaDe(id)
    expect(antes.plazo_dias).toBe(45)

    // Se retira el 45 de la configuración.
    await configurarPlazos(ca, [90])

    // 1) La fila no se toca: sigue a 45 días y con su vencimiento.
    const [despues] = await cobranzaDe(id)
    expect(despues.plazo_dias).toBe(45)
    expect(despues.vence).toBe(antes.vence)

    const cobId = (await poolTest().query(
      `select c.id from cobranzas c join facturas f on f.id = c.factura_id
        where f.campana_id = $1`, [id],
    )).rows[0].id as string

    // 2) Y se sigue LEYENDO por la aplicación: ESTA cobranza aparece en el
    //    estado que hidrata la pantalla, con sus 45 días. Se busca por id y no
    //    por «alguna a 45» porque otras pruebas del fichero ya dejaron una, y
    //    entonces la aserción pasaría sin mirar la que importa.
    const estado = await ca.pedir('/api/estado/')
    expect(estado.status, JSON.stringify(estado.datos?.error)).toBe(200)
    const cobranzas = (estado.datos.cobranzas ?? []) as { id: string; plazoDias: number }[]
    expect(cobranzas.find((c) => c.id === cobId)?.plazoDias).toBe(45)

    // 3) Y se sigue COBRANDO: un plazo retirado no congela el dinero en vuelo.
    const pago = await ca.pedir(`/api/cobranzas/${cobId}/pagar/`, { cuerpo: {} })
    expect(pago.status, JSON.stringify(pago.datos)).toBe(200)
  })
})
