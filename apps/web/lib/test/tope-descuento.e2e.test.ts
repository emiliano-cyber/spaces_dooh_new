import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  TOPE-01 · el descuento de una propuesta tiene un techo POR ORGANIZACIÓN.
// ----------------------------------------------------------------------------
//  Las unitarias de `lib/descuento.tope.test.ts` ya prueban la aritmética con
//  el tope como argumento. Lo que NO puede ver una unitaria —porque simula la
//  base— es lo único que decide aquí:
//
//   · que el tope que guarda Administración es EXACTAMENTE el que aplica
//     `PATCH /api/propuestas/[id]`, y que por encima **no se guarda nada**;
//   · que ese tope se lee CON contexto de tenant. Es el modo de fallo que no
//     da error (R2): un `qRaw` en la lectura haría que el techo de una empresa
//     lo decidiera la configuración de otra, o de cero filas, con 200 OK. Los
//     dos peores fallos de aislamiento del proyecto pasaron las unitarias sin
//     despeinarse;
//   · que cambiar el TOPE pide la contraseña y cambiar el descuento no. El
//     candado vive en `sesiones`, así que solo se ve con sesiones de verdad;
//   · que un COMERCIAL puede poner descuento y NO puede subirse el techo. Es
//     la separación que hace que el tope signifique algo.
//
//  Y el caso que da miedo, el mismo que en CFG-01: una propuesta viva al 40 %
//  cuando la organización baja el tope al 10. La validación es para lo que se
//  ESCRIBE; lo ya escrito no puede volverse inválido de golpe.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
/** Dueño de alfa, DESBLOQUEADO. Configura el tope. */
let ca: Cliente
/** Dueño de beta, DESBLOQUEADO. */
let cb: Cliente
/**
 * Dueño de alfa en OTRA sesión, que NUNCA se desbloquea. El desbloqueo vive en
 * `sesiones.desbloqueo_expira_en` (`cambios.ts:65-68`), no en el usuario, así
 * que esta sesión ve el candado cerrado aunque `ca` lo tenga abierto. Es la
 * única forma de probar el 403 sin gastar el desbloqueo de `ca`.
 */
let sinLlave: Cliente
/** COMERCIAL de alfa: vende, pero no se sube el techo. */
let comercial: Cliente

const EMAIL_COMERCIAL = 'vendedora@topealfa.test'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('topealfa')
  beta = await sembrarTenant('topebeta')

  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Vendedora Alfa', $1, 'COMERCIAL', $2, true, $3)`,
    [EMAIL_COMERCIAL, await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  sinLlave = new Cliente()
  comercial = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await sinLlave.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await comercial.entrar(EMAIL_COMERCIAL, PASSWORD_DEMO)

  // `20260828_reautenticacion_por_defecto.sql` dejó el DEFAULT de
  // `tenants.exigir_reautenticacion` en `true`: una organización recién
  // sembrada nace con el candado CERRADO.
  //
  // ⚠️ UNA sola vez por cliente, no antes de cada caso: `/api/cambios/desbloquear`
  // limita a 5 por usuario e IP cada 5 minutos y el desbloqueo dura 15.
  // `sinLlave` y `comercial` se quedan fuera A PROPÓSITO.
  for (const cl of [ca, cb]) {
    const d = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(d.status, JSON.stringify(d.datos)).toBe(200)
  }
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/** Guarda el tope de la organización de este cliente. */
async function configurarTope(c: Cliente, tope: number) {
  const r = await c.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { topeDescuentoPct: tope } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r
}

/** Una propuesta en BORRADOR, por el camino real de la API. */
async function nuevaPropuesta(
  c: Cliente,
  org: Awaited<ReturnType<typeof sembrarTenant>>,
  nombre: string,
): Promise<string> {
  const r = await c.pedir('/api/propuestas/', {
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
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id as string
}

/** El descuento tal y como quedó EN LA BASE, sin pasar por la aplicación. */
async function descuentoEnBase(id: string): Promise<number> {
  const r = await poolTest().query('select descuento_pct from propuestas where id = $1', [id])
  return Number(r.rows[0].descuento_pct)
}

async function ponerDescuento(c: Cliente, id: string, pct: unknown) {
  return c.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { descuentoPct: pct } })
}

describe('TOPE-01 · por encima del tope NO SE GUARDA', () => {
  it('el descuento que pasa el techo se rechaza y la base no se toca', async () => {
    // ESTE es el agujero de la tarea: hasta hoy el 90 % pasaba liso.
    await configurarTope(ca, 25)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-01 · por encima')

    const r = await ponerDescuento(ca, id, 90)
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    // El mensaje dice CUÁL es el tope, no «valor inválido».
    expect(String(r.datos.error)).toContain('25')

    // Y lo que de verdad importa: la fila quedó como estaba. Un 200 con el
    // valor recortado en silencio sería igual de malo.
    expect(await descuentoEnBase(id)).toBe(0)
  })

  it('el tope EXACTO sí se guarda, y llega a la base', async () => {
    await configurarTope(ca, 25)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-01 · justo en el tope')

    const r = await ponerDescuento(ca, id, 25)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await descuentoEnBase(id)).toBe(25)
  })

  it('por debajo del tope se guarda como siempre', async () => {
    await configurarTope(ca, 25)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-01 · por debajo')

    expect((await ponerDescuento(ca, id, 22)).status).toBe(200)
    expect(await descuentoEnBase(id)).toBe(22)
  })

  it('bajar el tope NO invalida lo ya pactado, y el resto de la propuesta se sigue editando', async () => {
    // LA VALIDACIÓN ES PARA LO QUE SE ESCRIBE, NO PARA LO YA ESCRITO. Si al
    // bajar el techo las propuestas vivas por encima dejaran de poder tocarse,
    // el comercial no podría ni corregirles una falta de ortografía.
    await configurarTope(ca, 40)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-01 · historico al 40')
    expect((await ponerDescuento(ca, id, 40)).status).toBe(200)

    await configurarTope(ca, 10)

    // 1) El descuento pactado sigue ahí.
    expect(await descuentoEnBase(id)).toBe(40)
    // 2) Y se puede seguir editando lo demás.
    const ren = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH', cuerpo: { nombre: 'TOPE-01 · historico al 40 (renombrada)' },
    })
    expect(ren.status, JSON.stringify(ren.datos)).toBe(200)
    expect(await descuentoEnBase(id)).toBe(40)
    // 3) Pero volver a escribir ese 40 ya no se puede: el techo es de hoy.
    expect((await ponerDescuento(ca, id, 40)).status).toBe(400)
  })

  it('un tope de 0 apaga los descuentos de esa organización', async () => {
    await configurarTope(ca, 0)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-01 · sin descuentos')
    expect((await ponerDescuento(ca, id, 1)).status).toBe(400)
    expect((await ponerDescuento(ca, id, 0)).status).toBe(200)
    await configurarTope(ca, 100)
  })

  it('el tope por omisión es 100: una organización recién nacida se comporta como ayer', async () => {
    // El valor por omisión de la migración. Ninguna venta en curso se rompe
    // por desplegar esto — es la misma decisión del ADR 0008 con el cupo de
    // clientes, que nace apagado.
    const fila = await poolTest().query(
      'select tope_descuento_pct from config_negocio where tenant_id = $1', [beta.id],
    )
    expect(Number(fila.rows[0].tope_descuento_pct)).toBe(100)

    const id = await nuevaPropuesta(cb, beta, 'TOPE-01 · sin tope configurado')
    expect((await ponerDescuento(cb, id, 90)).status).toBe(200)
    expect(await descuentoEnBase(id)).toBe(90)
  })
})

describe('TOPE-01 · dos organizaciones, dos techos (RLS)', () => {
  it('el tope de una NO decide lo que puede descontar la otra', async () => {
    // El fallo que no da error. Si la lectura perdiera el contexto de tenant,
    // alfa validaría contra el techo de beta —o contra cero filas— y nadie
    // vería una excepción. Solo se ve así: dos organizaciones vivas a la vez
    // contra el mismo Postgres.
    await configurarTope(ca, 10)
    await configurarTope(cb, 60)

    const idA = await nuevaPropuesta(ca, alfa, 'TOPE-01 · aislamiento alfa')
    const idB = await nuevaPropuesta(cb, beta, 'TOPE-01 · aislamiento beta')

    // El 40 % es legal en beta e ilegal en alfa. Las DOS direcciones, porque un
    // solo sentido lo pasaría también una lectura que siempre devolviera el
    // tope más alto (o el más bajo).
    expect((await ponerDescuento(ca, idA, 40)).status).toBe(400)
    expect((await ponerDescuento(cb, idB, 40)).status).toBe(200)

    // Y el que sí cabe en cada una, entra.
    expect((await ponerDescuento(ca, idA, 10)).status).toBe(200)
    expect(await descuentoEnBase(idA)).toBe(10)
    expect(await descuentoEnBase(idB)).toBe(40)

    // Cada propuesta, en su organización.
    const t = await poolTest().query(
      'select id, tenant_id from propuestas where id = any($1::uuid[])', [[idA, idB]],
    )
    const por = Object.fromEntries(t.rows.map((r: any) => [r.id, r.tenant_id]))
    expect(por[idA]).toBe(alfa.id)
    expect(por[idB]).toBe(beta.id)
  })

  it('cambiar el tope de una no toca la fila de la otra', async () => {
    await configurarTope(ca, 30)
    const antes = await poolTest().query(
      'select tope_descuento_pct from config_negocio where tenant_id = $1', [beta.id],
    )
    await configurarTope(ca, 35)
    const despues = await poolTest().query(
      'select tope_descuento_pct from config_negocio where tenant_id = $1', [beta.id],
    )
    expect(Number(despues.rows[0].tope_descuento_pct))
      .toBe(Number(antes.rows[0].tope_descuento_pct))
  })

  it('y el tope viaja a la pantalla del tenant CORRECTO por /api/estado', async () => {
    await configurarTope(ca, 18)
    await configurarTope(cb, 55)
    const ea = await ca.pedir('/api/estado/')
    const eb = await cb.pedir('/api/estado/')
    expect(ea.datos.configNegocio.topeDescuentoPct).toBe(18)
    expect(eb.datos.configNegocio.topeDescuentoPct).toBe(55)
  })
})

describe('TOPE-01 · quién puede subir el techo', () => {
  it('un COMERCIAL pone descuento pero NO se sube el tope', async () => {
    // Si el vendedor pudiera mover su propio techo, el tope no sería un
    // control: sería un recordatorio.
    await configurarTope(ca, 12)
    const id = await nuevaPropuesta(comercial, alfa, 'TOPE-01 · comercial')
    expect((await ponerDescuento(comercial, id, 12)).status).toBe(200)

    const subir = await comercial.pedir('/api/config/', {
      metodo: 'PATCH', cuerpo: { topeDescuentoPct: 90 },
    })
    expect(subir.status, JSON.stringify(subir.datos)).toBe(403)

    // Y no se movió: 403 con efecto es peor que 403 sin él.
    const fila = await poolTest().query(
      'select tope_descuento_pct from config_negocio where tenant_id = $1', [alfa.id],
    )
    expect(Number(fila.rows[0].tope_descuento_pct)).toBe(12)
    expect((await ponerDescuento(comercial, id, 90)).status).toBe(400)
  })

  it('cambiar el TOPE pide la contraseña; poner descuento NO', async () => {
    // El tope es el CONTROL, no el dato. Una sesión abierta y sin vigilar no
    // debería poder desactivar el control con un clic — que es justo lo que ya
    // se exige para tocar la renta de una pantalla (ADR 0009).
    const r = await sinLlave.pedir('/api/config/', {
      metodo: 'PATCH', cuerpo: { topeDescuentoPct: 80 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(r.datos.requiereDesbloqueo).toBe(true)

    // Y el candado es QUIRÚRGICO: el resto de Administración sigue como estaba.
    // Sin esto, pondríamos contraseña a los veinte campos de la pantalla y el
    // cambio sería mucho más grande de lo pedido.
    const otro = await sinLlave.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { loopSeg: 90 } })
    expect(otro.status, JSON.stringify(otro.datos)).toBe(200)

    // Poner descuento por debajo del tope tampoco pide nada: el candado está
    // en el control, no en la venta del día a día.
    await configurarTope(ca, 30)
    const id = await nuevaPropuesta(sinLlave, alfa, 'TOPE-01 · descuento sin llave')
    expect((await ponerDescuento(sinLlave, id, 30)).status).toBe(200)
  })
})

describe('TOPE-02 · la bitácora dice CUÁNTO descuento se puso', () => {
  async function ultimaAccionDe(c: Cliente, nombrePropuesta: string): Promise<string | undefined> {
    const e = await c.pedir('/api/estado/')
    const acciones = (e.datos.acciones ?? []) as { accion: string; entidad: string }[]
    return acciones.find((a) => a.entidad === nombrePropuesta)?.accion
  }

  it('anota el porcentaje, con nombre y apellidos de quien lo puso', async () => {
    // Con esto, «Actividad filtrada por persona» pasa a enseñar «Fulana puso
    // 22 % de descuento en la propuesta X». Hasta hoy decía «Actualizó
    // propuesta (v1)», que no dice nada de dinero.
    await configurarTope(ca, 40)
    const nombre = 'TOPE-02 · con descuento'
    const id = await nuevaPropuesta(comercial, alfa, nombre)
    expect((await ponerDescuento(comercial, id, 22)).status).toBe(200)

    const accion = await ultimaAccionDe(ca, nombre)
    expect(accion, 'la bitácora tiene que nombrar la propuesta').toBeDefined()
    expect(accion).toContain('22 %')
    expect(accion).toContain('descuento')

    // Y con el usuario de verdad, que es lo que hace útil el filtro por persona.
    const e = await ca.pedir('/api/estado/')
    const fila = (e.datos.acciones as any[]).find((a) => a.entidad === nombre)
    expect(fila.usuarioNombre).toBe('Vendedora Alfa')
  })

  it('NO lo menciona cuando el descuento no cambió', async () => {
    // «Solo cuando cambió de verdad». Un guardado de nombre o notas no puede
    // ensuciar Actividad con un descuento que nadie tocó.
    const nombre = 'TOPE-02 · solo el nombre'
    const id = await nuevaPropuesta(ca, alfa, nombre)
    const nuevo = 'TOPE-02 · solo el nombre (v2)'
    expect((await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH', cuerpo: { nombre: nuevo },
    })).status).toBe(200)

    const accion = await ultimaAccionDe(ca, nuevo)
    expect(accion).toBe('Actualizó propuesta (v1)')
    expect(accion).not.toContain('descuento')
  })

  it('reenviar el MISMO descuento tampoco lo anota', async () => {
    // El caso que separa «se guardó» de «cambió». La pantalla deshabilita el
    // botón cuando el valor es igual, pero la API es pública para el que
    // integre: sin esta comprobación, un cliente que reenvíe el cuerpo entero
    // en cada guardado dejaría una entrada de descuento por pulsación.
    await configurarTope(ca, 40)
    const nombre = 'TOPE-02 · mismo descuento dos veces'
    const id = await nuevaPropuesta(ca, alfa, nombre)
    expect((await ponerDescuento(ca, id, 15)).status).toBe(200)
    expect((await ponerDescuento(ca, id, 15)).status).toBe(200)

    const acciones = ((await ca.pedir('/api/estado/')).datos.acciones ?? []) as {
      accion: string; entidad: string
    }[]
    const suyas = acciones.filter((a) => a.entidad === nombre)
    expect(suyas.filter((a) => a.accion.includes('descuento')).length).toBe(1)
    expect(suyas.filter((a) => a.accion === 'Actualizó propuesta (v1)').length).toBe(1)
  })

  it('quitar el descuento se anota como QUITARLO', async () => {
    await configurarTope(ca, 40)
    const nombre = 'TOPE-02 · quitado'
    const id = await nuevaPropuesta(ca, alfa, nombre)
    expect((await ponerDescuento(ca, id, 30)).status).toBe(200)
    expect((await ponerDescuento(ca, id, 0)).status).toBe(200)

    const acciones = ((await ca.pedir('/api/estado/')).datos.acciones ?? []) as {
      accion: string; entidad: string
    }[]
    const suyas = acciones.filter((a) => a.entidad === nombre).map((a) => a.accion)
    expect(suyas).toContain('Quitó el descuento de la propuesta (v1)')
    expect(suyas).toContain('Puso 30 % de descuento en la propuesta (v1)')
  })
})

describe('TOPE-03 · aprobar y aceptar revisan el tope VIGENTE', () => {
  // El caso de arriba («bajar el tope NO invalida lo ya pactado») sigue en pie:
  // el descuento guardado se conserva y la propuesta se sigue editando. Lo que
  // ya no se puede es CERRARLA con él. Hasta el 2026-10-05 ni la aprobación
  // interna ni la aceptación por la liga miraban el tope, y el descuento por
  // encima del techo vigente se congelaba en el snapshot.

  async function enviar(c: Cliente, id: string) {
    const r = await c.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  }
  async function aprobar(c: Cliente, id: string) {
    return c.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH', cuerpo: { estatus: 'APROBADA', confirmarCero: true },
    })
  }
  async function aceptarPorLiga(id: string) {
    const t = await poolTest().query('select token_publico from propuestas where id=$1', [id])
    return new Cliente().pedir(`/api/propuestas/publica/${t.rows[0].token_publico}/`, {
      cuerpo: { nombre: 'Cliente Final' },
    })
  }
  async function estado(id: string) {
    const r = await poolTest().query(
      'select estatus::text as estatus, snapshot_economico, aceptado_en from propuestas where id=$1',
      [id],
    )
    return r.rows[0]
  }

  it('tope bajado → APROBAR por dentro se niega (409), y la propuesta queda como estaba', async () => {
    await configurarTope(ca, 40)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-03 · aprobar con tope bajado')
    expect((await ponerDescuento(ca, id, 40)).status).toBe(200)
    await enviar(ca, id)
    await configurarTope(ca, 10)

    const r = await aprobar(ca, id)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.descuentoSobreTope).toBe(true)
    expect(String(r.datos.error)).toContain('40 %')
    expect(String(r.datos.error)).toContain('10 %')

    const e = await estado(id)
    expect(e.estatus).toBe('ENVIADA')
    expect(e.snapshot_economico).toBeNull()
    // Lo ya guardado NO se toca (TOPE-01).
    expect(await descuentoEnBase(id)).toBe(40)

    // Y la salida que el mensaje propone funciona: ajustar el descuento y aprobar.
    expect((await ponerDescuento(ca, id, 10)).status).toBe(200)
    const ok = await aprobar(ca, id)
    expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
    expect((await estado(id)).estatus).toBe('APROBADA')
    expect((await estado(id)).snapshot_economico).not.toBeNull()
  })

  it('tope bajado → ACEPTAR por la liga se niega (409) sin decirle el tope al cliente', async () => {
    await configurarTope(ca, 40)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-03 · liga con tope bajado')
    expect((await ponerDescuento(ca, id, 40)).status).toBe(200)
    await enviar(ca, id)
    await configurarTope(ca, 10)

    const r = await aceptarPorLiga(id)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(String(r.datos.error)).toMatch(/ejecutivo/)
    expect(String(r.datos.error)).not.toMatch(/%/)

    const e = await estado(id)
    expect(e.estatus).toBe('ENVIADA')
    expect(e.aceptado_en).toBeNull()
    expect(e.snapshot_economico).toBeNull()
  })

  it('con el descuento DENTRO del tope vigente, aprobar y aceptar siguen funcionando', async () => {
    await configurarTope(ca, 40)
    const idA = await nuevaPropuesta(ca, alfa, 'TOPE-03 · aprobar dentro')
    const idL = await nuevaPropuesta(ca, alfa, 'TOPE-03 · liga dentro')
    for (const id of [idA, idL]) {
      expect((await ponerDescuento(ca, id, 10)).status).toBe(200)
      await enviar(ca, id)
    }
    // Bajado, pero no por debajo de lo guardado: el límite es inclusivo.
    await configurarTope(ca, 10)

    const a = await aprobar(ca, idA)
    expect(a.status, JSON.stringify(a.datos)).toBe(200)
    expect((await estado(idA)).estatus).toBe('APROBADA')

    const l = await aceptarPorLiga(idL)
    expect(l.status, JSON.stringify(l.datos)).toBe(200)
    expect((await estado(idL)).estatus).toBe('APROBADA')
    expect((await estado(idL)).snapshot_economico).not.toBeNull()
  })

  it('la liga lee el tope de la organización DE LA PROPUESTA (RLS, sin sesión)', async () => {
    // Las dos direcciones: el 40 % cabe en beta (60) y no en alfa (10). Si la
    // lectura del tope en la ruta pública perdiera el tenant del token, una de
    // las dos saldría al revés.
    await configurarTope(ca, 40)
    await configurarTope(cb, 60)
    const idA = await nuevaPropuesta(ca, alfa, 'TOPE-03 · liga alfa')
    const idB = await nuevaPropuesta(cb, beta, 'TOPE-03 · liga beta')
    expect((await ponerDescuento(ca, idA, 40)).status).toBe(200)
    expect((await ponerDescuento(cb, idB, 40)).status).toBe(200)
    await enviar(ca, idA)
    await enviar(cb, idB)
    await configurarTope(ca, 10)

    expect((await aceptarPorLiga(idA)).status).toBe(409)
    const b = await aceptarPorLiga(idB)
    expect(b.status, JSON.stringify(b.datos)).toBe(200)
    expect((await estado(idB)).estatus).toBe('APROBADA')
    await configurarTope(ca, 100)
  })

  // ── TOPE-04 (2026-10-05) · el VOLUMEN SOLO ya pasa el tope ────────────────
  // Administración baja el tope al 5 % y la escala de la organización da 10 %.
  // Hasta hoy aprobar contestaba 409 «Ajusta el descuento» y la edición
  // rechazaba incluso el 0 % comercial: el vendedor no tenía salida. Ahora el
  // 0 % se guarda (el volumen no es discreción suya) y aprobar funciona; con
  // cualquier comercial > 0 se sigue negando, y el mensaje dice la salida real.
  it('TOPE-04 · volumen solo sobre el tope: 0 % comercial se guarda y aprueba; > 0 sigue 409', async () => {
    const tramo = await poolTest().query(
      `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
       values ($1, 'spot', 50, 10) returning id`,
      [alfa.id],
    )
    try {
      await configurarTope(ca, 40)
      const r = await ca.pedir('/api/propuestas/', {
        cuerpo: {
          nombre: 'TOPE-04 · volumen sobre el tope',
          clienteId: alfa.clienteId,
          fechaInicio: enDias(1),
          fechaFin: enDias(10),
          items: [{ sitioId: alfa.sitioId, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
        },
      })
      expect(r.status, JSON.stringify(r.datos)).toBe(201)
      const id = r.datos.id as string
      const lin = await poolTest().query(
        'select descuento_volumen_pct from propuesta_items where propuesta_id = $1',
        [id],
      )
      expect(Number(lin.rows[0].descuento_volumen_pct)).toBe(10)
      expect((await ponerDescuento(ca, id, 5)).status).toBe(200)
      await enviar(ca, id)

      // Administración baja el tope POR DEBAJO de su propia escala, por la API.
      await configurarTope(ca, 5)

      const SALIDA =
        'El descuento por volumen (10 %) ya supera el tope (5 %): deja el descuento ' +
        'comercial en 0 % o pide a Administración que suba el tope.'

      // Aprobar con 5 % comercial: 409, y el mensaje dice la salida REAL.
      const a = await aprobar(ca, id)
      expect(a.status, JSON.stringify(a.datos)).toBe(409)
      expect(a.datos.descuentoSobreTope).toBe(true)
      expect(String(a.datos.error)).toContain(SALIDA)
      expect(String(a.datos.error)).not.toMatch(/Ajusta el descuento/)
      expect((await estado(id)).estatus).toBe('ENVIADA')

      // Editar a un comercial > 0 sigue rechazándose, con la misma salida.
      const mal = await ponerDescuento(ca, id, 1)
      expect(mal.status, JSON.stringify(mal.datos)).toBe(400)
      expect(String(mal.datos.error)).toBe(SALIDA)
      expect(await descuentoEnBase(id)).toBe(5)

      // Editar a 0 % SE GUARDA — hasta hoy también era 400.
      const cero = await ponerDescuento(ca, id, 0)
      expect(cero.status, JSON.stringify(cero.datos)).toBe(200)
      expect(await descuentoEnBase(id)).toBe(0)

      // Y aprobar funciona, con el snapshot escrito.
      const ok = await aprobar(ca, id)
      expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
      expect((await estado(id)).estatus).toBe('APROBADA')
      expect((await estado(id)).snapshot_economico).not.toBeNull()
    } finally {
      await poolTest().query('delete from escalas_volumen where id = $1', [tramo.rows[0].id])
      await configurarTope(ca, 100)
    }
  })

  it('TOPE-04 · con volumen que SÍ cabe, el rechazo dice hasta cuánto comercial cabe', async () => {
    await configurarTope(ca, 20)
    const id = await nuevaPropuesta(ca, alfa, 'TOPE-04 · máximo que cabe')
    const r = await ponerDescuento(ca, id, 25)
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/Cabe hasta 20 % comercial/)
    await configurarTope(ca, 100)
  })
})
