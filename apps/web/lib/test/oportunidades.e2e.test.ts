import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0051 · Fase 2 — las oportunidades del CRM, contra Postgres y Next de
//  verdad.
// ----------------------------------------------------------------------------
//  Lo que se demuestra es sobre todo lo que se IMPIDE —lo que las unitarias no
//  ven porque simulan la base—:
//   · un vendedor no toca lo de otro, ni otra organización lo de ésta: 404 en
//     TODAS las rutas, no solo en la de la oportunidad;
//   · una oportunidad, una actividad o una propuesta no pueden apuntar a algo
//     de otra organización ni con el id equivocado (FK compuestas con tenant);
//   · la línea de tiempo y el historial de propuestas no se editan ni se
//     borran, ni siquiera conectando como superusuario (trigger);
//   · borrar un usuario con historia NO se rompe (la lección de `acciones`,
//     20261109): las tablas que solo crecen no llevan FK a `usuarios`;
//   · el vendedor y el autor salen de la sesión, nunca del cuerpo.
//
//  NO toca `aislamiento.e2e.test.ts`: esto es una prueba nueva y aparte.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>

const correo = (quien: string) => `${quien}@crm.test`

async function sembrarUsuario(nombre: string, quien: string, rol: string, tenantId: string) {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )
  return r.rows[0].id as string
}

async function entrar(email: string): Promise<Cliente> {
  const c = new Cliente()
  await c.entrar(email, PASSWORD_DEMO)
  return c
}

async function sembrarCliente(nombre: string, tenantId: string): Promise<string> {
  const r = await poolTest().query(`insert into clientes (nombre, tenant_id) values ($1,$2) returning id`, [
    nombre,
    tenantId,
  ])
  return r.rows[0].id as string
}

async function sembrarProspecto(tipo: string, nombre: string, tenantId: string, usuarioId: string | null) {
  const r = await poolTest().query(
    `insert into prospectos (tenant_id, tipo, nombre, usuario_id) values ($1,$2,$3,$4) returning id`,
    [tenantId, tipo, nombre, usuarioId],
  )
  return r.rows[0].id as string
}

async function comoApp<T>(tenant: string, fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const c = await poolApp().connect()
  try {
    await c.query('begin')
    await c.query("select set_config('app.tenant_id', $1, true)", [tenant])
    return await fn(c)
  } finally {
    await c.query('rollback').catch(() => {})
    c.release()
  }
}

let vendedor: Cliente
let vendedor2: Cliente
let gerente: Cliente
let duenoOtra: Cliente
let anonimo: Cliente
let idVendedor: string
let idVendedor2: string
let clienteOrg: string
let clienteOtra: string

const TABLAS = ['oportunidad_actividades', 'oportunidades', 'propuesta_cambios']
const ruta = (id: string, resto = '') => `/api/oportunidades/${id}/${resto}`

async function nueva(nombre: string, c: Cliente = vendedor, extra: Record<string, unknown> = {}): Promise<any> {
  const r = await c.pedir('/api/oportunidades/', { cuerpo: { nombre, clienteId: clienteOrg, ...extra } })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos
}

beforeAll(async () => {
  await recrearEsquema()
  org = await sembrarTenant('crm')
  otra = await sembrarTenant('crm-otra')
  idVendedor = await sembrarUsuario('Mariana López', 'v1', 'VENDEDOR', org.id)
  idVendedor2 = await sembrarUsuario('Luis Herrera', 'v2', 'VENDEDOR', org.id)
  await sembrarUsuario('Gerente', 'gerente', 'GERENTE_VENTAS', org.id)
  clienteOrg = await sembrarCliente('Refresquera del Norte', org.id)
  clienteOtra = await sembrarCliente('Cliente de la otra', otra.id)
  await arrancarServidor()
  vendedor = await entrar(correo('v1'))
  vendedor2 = await entrar(correo('v2'))
  gerente = await entrar(correo('gerente'))
  duenoOtra = await entrar(otra.usuarioEmail)
  anonimo = new Cliente()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ───────────────────────────────────────────────────────────────────────────
describe('1 · la migración', () => {
  it('las tres tablas nuevas nacen con RLS forzada', async () => {
    const r = await poolTest().query(
      `select relname from pg_class where relname = any($1) and relrowsecurity and relforcerowsecurity order by relname`,
      [TABLAS],
    )
    expect(r.rows.map((x) => x.relname)).toEqual(TABLAS)
  })

  it('una oportunidad sin cliente ni prospecto no existe', async () => {
    await expect(
      poolTest().query(`insert into oportunidades (tenant_id, nombre) values ($1, 'Huérfana')`, [org.id]),
    ).rejects.toThrow(/oportunidades_origen_ck/)
  })

  it('NO puede apuntar al cliente ni al prospecto de otra organización (FK con tenant)', async () => {
    await expect(
      poolTest().query(`insert into oportunidades (tenant_id, cliente_id, nombre) values ($1, $2, 'Colada')`, [
        otra.id,
        clienteOrg,
      ]),
    ).rejects.toThrow(/foreign key/)
    const prospecto = await sembrarProspecto('CLIENTE', 'Lead de org', org.id, idVendedor)
    await expect(
      poolTest().query(`insert into oportunidades (tenant_id, prospecto_id, nombre) values ($1, $2, 'Colada')`, [
        otra.id,
        prospecto,
      ]),
    ).rejects.toThrow(/foreign key/)
  })

  it('ni una actividad ni una propuesta pueden colgar de una oportunidad de otra organización', async () => {
    const o = await nueva('Para colgar')
    await expect(
      poolTest().query(
        `insert into oportunidad_actividades (tenant_id, oportunidad_id, tipo, nota) values ($1, $2, 'NOTA', 'x')`,
        [otra.id, o.id],
      ),
    ).rejects.toThrow(/foreign key/)
    await expect(
      poolTest().query(
        `insert into propuestas (folio, nombre, tenant_id, oportunidad_id) values ('CRM-X-1', 'Colada', $1, $2)`,
        [otra.id, o.id],
      ),
    ).rejects.toThrow(/foreign key/)
  })

  it('la línea de tiempo y el historial no se editan ni se borran — ni como superusuario', async () => {
    const o = await nueva('Inmutable')
    await poolTest().query(
      `insert into propuesta_cambios (tenant_id, propuesta_id, folio, accion) values ($1, gen_random_uuid(), 'P-1', 'CREAR')`,
      [org.id],
    )
    for (const t of ['oportunidad_actividades', 'propuesta_cambios']) {
      await expect(poolTest().query(`update ${t} set creado_en = now() where tenant_id = $1`, [org.id])).rejects.toThrow(
        /append-only/,
      )
      await expect(poolTest().query(`delete from ${t} where tenant_id = $1`, [org.id])).rejects.toThrow(/append-only/)
    }
    expect(o.actividades.length).toBe(1)
  })

  it('y el rol de la aplicación ni siquiera tiene el permiso; las oportunidades tampoco se borran', async () => {
    for (const sql of [
      `update oportunidad_actividades set nota = 'x'`,
      'delete from oportunidad_actividades',
      `update propuesta_cambios set campo = 'x'`,
      'delete from propuesta_cambios',
      'delete from oportunidades',
    ]) {
      await comoApp(org.id, async (c) => {
        await expect(c.query(sql)).rejects.toThrow(/permission denied/)
      })
    }
  })

  it('el rol de la aplicación no ve las oportunidades de otra organización', async () => {
    await nueva('Solo de org')
    const n = await comoApp(otra.id, async (c) => (await c.query('select count(*)::int n from oportunidades')).rows[0].n)
    expect(n).toBe(0)
  })

  it('borrar un usuario con historia NO se rompe: su oportunidad queda sin vendedor y la historia se queda', async () => {
    const idTemporal = await sembrarUsuario('Temporal', 'temporal', 'VENDEDOR', org.id)
    const temporal = await entrar(correo('temporal'))
    const o = await nueva('De quien se va', temporal)
    expect(
      (await temporal.pedir(ruta(o.id, 'actividades/'), { cuerpo: { tipo: 'LLAMADA', nota: 'Primera llamada' } }))
        .status,
    ).toBe(201)
    await poolTest().query('delete from sesiones where usuario_id = $1', [idTemporal])
    await poolTest().query('delete from usuarios where id = $1', [idTemporal])
    const d = (await gerente.pedir(ruta(o.id))).datos
    expect(d.usuarioId).toBeNull()
    expect(d.actividades.map((a: any) => a.usuarioNombre)).toEqual(['Temporal', 'Temporal'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('2 · el alta', () => {
  it('nace en CONTACTO, con el vendedor y el autor de la sesión y su primera fila de etapa', async () => {
    const o = await nueva('Campaña Navidad 2026', vendedor, {
      presupuestoMin: 150000,
      presupuestoMax: 220000,
      fechaInicioDeseada: '2026-12-01',
      fechaFinDeseada: '2026-12-31',
      fechaDecision: '2026-11-25',
      plazas: 'CDMX y Monterrey',
      tiposMedio: ['ESPECTACULAR', 'PANTALLA_DIGITAL', 'ESPECTACULAR'],
      objetivo: 'Lanzamiento de sabor de temporada',
      nota: 'Nos buscó por recomendación',
    })
    expect(o.etapa).toBe('CONTACTO')
    expect(o.usuarioId).toBe(idVendedor)
    expect(o.vendedorNombre).toBe('Mariana López')
    expect(o.clienteId).toBe(clienteOrg)
    expect(o.clienteNombre).toBe('Refresquera del Norte')
    expect(o.presupuestoMin).toBe(150000)
    expect(o.presupuestoMax).toBe(220000)
    expect(o.fechaInicioDeseada).toBe('2026-12-01')
    expect(o.fechaDecision).toBe('2026-11-25')
    expect(o.tiposMedio).toEqual(['ESPECTACULAR', 'PANTALLA_DIGITAL'])
    // El dueño quitó la probabilidad el 17/11: ya no viaja.
    expect(o).not.toHaveProperty('probabilidad')
    expect(o).not.toHaveProperty('probabilidadPct')
    expect(o.cotizaciones).toBe(0)
    expect(o.actividades).toHaveLength(1)
    expect(o.actividades[0]).toMatchObject({
      tipo: 'ETAPA',
      etapaAnterior: null,
      etapaNueva: 'CONTACTO',
      usuarioNombre: 'Mariana López',
      nota: 'Nos buscó por recomendación',
    })
  })

  it('el vendedor, la etapa o un campo que no existe en el cuerpo: 400', async () => {
    for (const extra of [{ usuarioId: idVendedor2 }, { etapa: 'GANADA' }, { ganadaEn: '2026-01-01' }, { color: 'rojo' }]) {
      const r = await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'X', clienteId: clienteOrg, ...extra } })
      expect(r.status, JSON.stringify(extra)).toBe(400)
    }
  })

  it('sin cliente ni prospecto, con el presupuesto al revés o las fechas al revés: 400', async () => {
    expect((await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Sin nadie' } })).status).toBe(400)
    expect(
      (await vendedor.pedir('/api/oportunidades/', {
        cuerpo: { nombre: 'Al revés', clienteId: clienteOrg, presupuestoMin: 9, presupuestoMax: 1 },
      })).status,
    ).toBe(400)
    expect(
      (await vendedor.pedir('/api/oportunidades/', {
        cuerpo: { nombre: 'Al revés', clienteId: clienteOrg, fechaInicioDeseada: '2027-01-02', fechaFinDeseada: '2027-01-01' },
      })).status,
    ).toBe(400)
    expect(
      (await vendedor.pedir('/api/oportunidades/', {
        cuerpo: { nombre: 'Medio raro', clienteId: clienteOrg, tiposMedio: ['GLOBO'] },
      })).status,
    ).toBe(400)
  })

  it('el cliente de otra organización es 404, no un alta', async () => {
    const r = await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Colada', clienteId: clienteOtra } })
    expect(r.status).toBe(404)
  })

  it('sobre un prospecto: solo de tipo CLIENTE, y solo uno que el vendedor pueda ver', async () => {
    const arrendador = await sembrarProspecto('ARRENDADOR', 'Don Rafa', org.id, idVendedor)
    expect(
      (await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'X', prospectoId: arrendador } })).status,
    ).toBe(409)
    const ajeno = await sembrarProspecto('CLIENTE', 'Lead de Luis', org.id, idVendedor2)
    expect((await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'X', prospectoId: ajeno } })).status).toBe(
      404,
    )
    const propio = await sembrarProspecto('CLIENTE', 'Cervecería Artesanal', org.id, idVendedor)
    const r = await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Verano', prospectoId: propio } })
    expect(r.status).toBe(201)
    expect(r.datos.prospectoNombre).toBe('Cervecería Artesanal')
    expect(r.datos.clienteId).toBeNull()
  })

  it('al aprobarse el prospecto, la oportunidad ve al cliente que nació de él', async () => {
    const propio = await sembrarProspecto('CLIENTE', 'Panadería La Espiga', org.id, idVendedor)
    const o = (await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Pan de muerto', prospectoId: propio } }))
      .datos
    const nuevoCliente = await sembrarCliente('Panadería La Espiga', org.id)
    await poolTest().query(
      `update prospectos set etapa = 'APROBADO', decidido_en = now(), registro_id = $2 where id = $1`,
      [propio, nuevoCliente],
    )
    const d = (await vendedor.pedir(ruta(o.id))).datos
    expect(d.clienteId).toBe(nuevoCliente)
    expect(d.clienteNombre).toBe('Panadería La Espiga')
    const lista = (await vendedor.pedir(`/api/oportunidades/?clienteId=${nuevoCliente}`)).datos
    expect(lista.oportunidades.map((x: any) => x.id)).toEqual([o.id])
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('3 · quién ve qué', () => {
  let ajena: any
  beforeAll(async () => {
    ajena = await nueva('De Luis', vendedor2)
  })

  it('un vendedor no ve la de otro: 404 en la ficha, la edición, la etapa y las actividades', async () => {
    expect((await vendedor.pedir(ruta(ajena.id))).status).toBe(404)
    expect((await vendedor.pedir(ruta(ajena.id), { metodo: 'PATCH', cuerpo: { nombre: 'Mía' } })).status).toBe(404)
    expect((await vendedor.pedir(ruta(ajena.id, 'etapa/'), { cuerpo: { etapa: 'NECESIDAD' } })).status).toBe(404)
    expect(
      (await vendedor.pedir(ruta(ajena.id, 'actividades/'), { cuerpo: { tipo: 'NOTA', nota: 'Colada' } })).status,
    ).toBe(404)
    const lista = (await vendedor.pedir('/api/oportunidades/')).datos
    expect(lista.veTodas).toBe(false)
    expect(lista.oportunidades.some((x: any) => x.id === ajena.id)).toBe(false)
    expect(lista.oportunidades.every((x: any) => x.usuarioId === idVendedor)).toBe(true)
  })

  it('quien puede aprobar en Comercial las ve todas', async () => {
    expect((await gerente.pedir(ruta(ajena.id))).status).toBe(200)
    const lista = (await gerente.pedir('/api/oportunidades/')).datos
    expect(lista.veTodas).toBe(true)
    expect(lista.oportunidades.some((x: any) => x.id === ajena.id)).toBe(true)
  })

  it('otra organización no ve ni toca nada: 404 y lista vacía', async () => {
    expect((await duenoOtra.pedir(ruta(ajena.id))).status).toBe(404)
    expect((await duenoOtra.pedir(ruta(ajena.id, 'etapa/'), { cuerpo: { etapa: 'NECESIDAD' } })).status).toBe(404)
    expect(
      (await duenoOtra.pedir(ruta(ajena.id, 'actividades/'), { cuerpo: { tipo: 'NOTA', nota: 'Colada' } })).status,
    ).toBe(404)
    const lista = (await duenoOtra.pedir('/api/oportunidades/')).datos
    expect(lista.total).toBe(0)
  })

  it('sin sesión: 401', async () => {
    expect((await anonimo.pedir('/api/oportunidades/')).status).toBe(401)
    expect((await anonimo.pedir(ruta(ajena.id))).status).toBe(401)
  })

  it('un id que no es uuid no revienta: no es un 500', async () => {
    expect((await gerente.pedir(ruta('no-es-un-id'))).status).toBeLessThan(500)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('4 · editar y mover en el embudo', () => {
  let o: any
  beforeAll(async () => {
    o = await nueva('Regreso a clases', vendedor, { presupuestoMax: 80000 })
  })

  it('lo que no viene no se toca; null lo borra', async () => {
    let r = await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { plazas: 'Guadalajara' } })
    expect(r.status).toBe(200)
    expect(r.datos.plazas).toBe('Guadalajara')
    expect(r.datos.presupuestoMax).toBe(80000)
    r = await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { presupuestoMax: null } })
    expect(r.datos.presupuestoMax).toBeNull()
    expect(r.datos.plazas).toBe('Guadalajara')
  })

  it('el presupuesto al revés se niega también contra lo ya guardado: 409', async () => {
    await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { presupuestoMax: 80000 } })
    expect((await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { presupuestoMin: 99000 } })).status).toBe(409)
  })

  it('cambiar de etapa deja su fila; a la misma etapa es 409', async () => {
    let r = await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'COTIZANDO', nota: 'Pidió cotización' } })
    expect(r.status).toBe(200)
    expect(r.datos.etapa).toBe('COTIZANDO')
    expect(r.datos.actividades.at(-1)).toMatchObject({ tipo: 'ETAPA', etapaAnterior: 'CONTACTO', etapaNueva: 'COTIZANDO' })
    r = await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'COTIZANDO' } })
    expect(r.status).toBe(409)
    // Regresar mientras está abierta es normal: pidió otra cotización.
    expect((await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'NEGOCIANDO' } })).status).toBe(200)
    expect((await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'COTIZANDO' } })).status).toBe(200)
  })

  it('una actividad: el autor sale de la sesión, y ETAPA no se puede mandar a mano', async () => {
    let r = await vendedor.pedir(ruta(o.id, 'actividades/'), {
      cuerpo: { tipo: 'REUNION', nota: 'Junta con mercadotecnia', siguientePaso: 'Mandar propuesta', siguientePasoFecha: '2026-11-20' },
    })
    expect(r.status).toBe(201)
    expect(r.datos.actividades.at(-1)).toMatchObject({
      tipo: 'REUNION',
      usuarioNombre: 'Mariana López',
      siguientePasoFecha: '2026-11-20',
    })
    r = await vendedor.pedir(ruta(o.id, 'actividades/'), { cuerpo: { tipo: 'ETAPA', nota: 'x' } })
    expect(r.status).toBe(400)
    r = await vendedor.pedir(ruta(o.id, 'actividades/'), { cuerpo: { tipo: 'NOTA', nota: 'x', usuarioNombre: 'Otro' } })
    expect(r.status).toBe(400)
  })

  it('perderla exige el motivo; perdida, ya no se mueve ni se edita, pero sí se anota', async () => {
    expect((await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'PERDIDA' } })).status).toBe(400)
    const r = await vendedor.pedir(ruta(o.id, 'etapa/'), {
      cuerpo: { etapa: 'PERDIDA', motivoPerdida: 'Se fue con la competencia' },
    })
    expect(r.status).toBe(200)
    expect(r.datos.perdidaEn).toBeTruthy()
    expect(r.datos.motivoPerdida).toBe('Se fue con la competencia')
    expect((await vendedor.pedir(ruta(o.id, 'etapa/'), { cuerpo: { etapa: 'NEGOCIANDO' } })).status).toBe(409)
    expect((await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { plazas: 'Otra' } })).status).toBe(409)
    expect(
      (await vendedor.pedir(ruta(o.id, 'actividades/'), { cuerpo: { tipo: 'NOTA', nota: 'Quizá el año que entra' } }))
        .status,
    ).toBe(201)
  })

  it('ganarla estampa la fecha', async () => {
    const g = await nueva('Ganable')
    const r = await vendedor.pedir(ruta(g.id, 'etapa/'), { cuerpo: { etapa: 'GANADA' } })
    expect(r.status).toBe(200)
    expect(r.datos.ganadaEn).toBeTruthy()
  })

  it('el embudo cuenta por etapa en la base', async () => {
    const lista = (await gerente.pedir('/api/oportunidades/?etapas=PERDIDA')).datos
    expect(lista.oportunidades.every((x: any) => x.etapa === 'PERDIDA')).toBe(true)
    expect(lista.porEtapa.PERDIDA).toBe(lista.total)
    expect(lista.porEtapa.CONTACTO).toBeGreaterThan(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('5 · las cotizaciones ligadas', () => {
  it('una propuesta con oportunidad_id se cuenta y se lista en la ficha', async () => {
    const o = await nueva('Con cotización')
    await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, cliente_id, oportunidad_id, usuario_id) values ('CRM-P-1', 'Primera', $1, $2, $3, $4)`,
      [org.id, clienteOrg, o.id, idVendedor],
    )
    const d = (await vendedor.pedir(ruta(o.id))).datos
    expect(d.cotizaciones).toBe(1)
    expect(d.propuestas).toEqual([expect.objectContaining({ folio: 'CRM-P-1', estatus: 'BORRADOR', version: 1 })])
  })

  it('borrar un cliente que tiene oportunidades se niega con 409 y lo dice (Fase 4: en el desglose)', async () => {
    const cli = await sembrarCliente('Con oportunidad', org.id)
    await nueva('Amarra al cliente', vendedor, { clienteId: cli })
    // Borrar un cliente es del Dueño o del Administrador, y pide la contraseña
    // siempre (`borrado-cliente.e2e.test.ts`).
    const dueno = await entrar(org.usuarioEmail)
    expect((await dueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })).status).toBe(200)
    const r = await dueno.pedir(`/api/clientes/${cli}/`, { metodo: 'DELETE', cuerpo: {} })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.error).toMatch(/el cliente tiene 1 oportunidad./)
    // Y el cliente sigue ahí: el borrado entero se deshizo.
    expect((await poolTest().query('select 1 from clientes where id = $1', [cli])).rowCount).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('6 · Fase 4 · lo que la ficha trae para su línea de tiempo', () => {
  it('los cambios de sus propuestas ligadas (los escribe el trigger), y no los de otras', async () => {
    const o = await nueva('Con historial')
    const ligada = (await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, cliente_id, oportunidad_id, usuario_id) values ('CRM-H-1','Ligada',$1,$2,$3,$4) returning id`,
      [org.id, clienteOrg, o.id, idVendedor],
    )).rows[0].id
    await poolTest().query(`insert into propuestas (folio, nombre, tenant_id, cliente_id) values ('CRM-H-2','Suelta',$1,$2)`, [org.id, clienteOrg])
    await poolTest().query(`update propuestas set nombre = 'Ligada v2' where id = $1`, [ligada])
    const d = (await vendedor.pedir(ruta(o.id))).datos
    expect(d.cambios.map((c: any) => c.folio)).toEqual(['CRM-H-1', 'CRM-H-1'])
    expect(d.cambios[0]).toMatchObject({ accion: 'EDITAR', campo: 'nombre', valorNuevo: 'Ligada v2' })
  })

  it('una propuesta de OTRO vendedor ligada a la mía no se ve en mi ficha, ni su historial (regla de la Fase 3)', async () => {
    // Quien ve todas puede ligar la propuesta de Luis a la oportunidad de
    // Mariana. Mariana no ve esa propuesta en Propuestas (404): tampoco puede
    // asomarse a ella —folio, nombre, historial campo por campo— desde la ficha.
    const o = await nueva('Mezclada')
    const mia = (await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, cliente_id, oportunidad_id, usuario_id) values ('CRM-M-1','Mía',$1,$2,$3,$4) returning id`,
      [org.id, clienteOrg, o.id, idVendedor],
    )).rows[0].id
    const deLuis = (await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, cliente_id, oportunidad_id, usuario_id) values ('CRM-M-2','De Luis',$1,$2,$3,$4) returning id`,
      [org.id, clienteOrg, o.id, idVendedor2],
    )).rows[0].id
    await poolTest().query(`update propuestas set nombre = nombre || ' v2' where id = any($1::uuid[])`, [[mia, deLuis]])

    const d = (await vendedor.pedir(ruta(o.id))).datos
    expect(d.propuestas.map((p: any) => p.folio)).toEqual(['CRM-M-1'])
    expect(new Set(d.cambios.map((c: any) => c.folio))).toEqual(new Set(['CRM-M-1']))
    expect(JSON.stringify(d)).not.toContain('De Luis')

    // Quien ve todas, ve las dos.
    const g = (await gerente.pedir(ruta(o.id))).datos
    expect(g.propuestas.map((p: any) => p.folio).sort()).toEqual(['CRM-M-1', 'CRM-M-2'])
    expect(new Set(g.cambios.map((c: any) => c.folio))).toEqual(new Set(['CRM-M-1', 'CRM-M-2']))
  })

  it('la bitácora del prospecto, solo si quien mira puede ver ese prospecto', async () => {
    const lead = await sembrarProspecto('CLIENTE', 'Lead con bitácora', org.id, idVendedor)
    await poolTest().query(
      `insert into prospecto_avances (tenant_id, prospecto_id, usuario_id, etapa_nueva, nota) values ($1,$2,$3,'PROSPECTO','Primer contacto')`,
      [org.id, lead, idVendedor],
    )
    const o = (await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Del lead', prospectoId: lead } })).datos
    expect(o.avancesProspecto.map((a: any) => a.nota)).toEqual(['Primer contacto'])
    // El gerente comercial ve la oportunidad (comercial.aprobar) y también el
    // lead (captacion.aprobar en la matriz de fábrica).
    expect((await gerente.pedir(ruta(o.id))).datos.avancesProspecto).toHaveLength(1)
    // Si a quien mira le quitan captacion.aprobar, ve la oportunidad pero no la bitácora del lead ajeno.
    await poolTest().query(`delete from rol_permisos where rol = 'GERENTE_VENTAS' and modulo = 'captacion' and accion = 'aprobar'`)
    try {
      const d = (await gerente.pedir(ruta(o.id))).datos
      expect(d.id).toBe(o.id)
      expect(d.avancesProspecto).toEqual([])
    } finally {
      await poolTest().query(`insert into rol_permisos (rol, modulo, accion) values ('GERENTE_VENTAS','captacion','aprobar') on conflict do nothing`)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('7 · la probabilidad de cierre ya no existe (el dueño la quitó, 17/11)', () => {
  it('ni al dar de alta ni al editar: el campo se rechaza con 400, no se ignora en silencio', async () => {
    expect(
      (await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Con prob.', clienteId: clienteOrg, probabilidadPct: 40 } })).status,
    ).toBe(400)
    const o = await nueva('Sin prob.')
    expect((await vendedor.pedir(ruta(o.id), { metodo: 'PATCH', cuerpo: { probabilidadPct: 40 } })).status).toBe(400)
  })

  it('ni en la configuración, ni la lista y la ficha traen tabla de probabilidades', async () => {
    const dueno = await entrar(org.usuarioEmail)
    expect((await dueno.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { crmProbabilidades: { CONTACTO: 5 } } })).status).toBe(400)
    expect((await dueno.pedir('/api/config/')).datos).not.toHaveProperty('crmProbabilidades')
    const lista = (await vendedor.pedir('/api/oportunidades/')).datos
    expect(lista).not.toHaveProperty('probabilidades')
    expect(lista.oportunidades.every((x: any) => !('probabilidad' in x))).toBe(true)
  })

  it('y la base no tiene la columna', async () => {
    const r = await poolTest().query(
      `select column_name from information_schema.columns
        where table_name in ('oportunidades','config_negocio') and column_name in ('probabilidad_pct','crm_probabilidades')`,
    )
    expect(r.rows).toEqual([])
  })
})

describe('8 · el cotejo con y sin IVA lleva la tasa de cada cliente', () => {
  it('la propuesta expone ivaPct: la del cliente, o 16', async () => {
    const cli = await sembrarCliente('Cliente de frontera', org.id)
    await poolTest().query('update clientes set iva_pct = 8 where id = $1', [cli])
    await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, cliente_id, usuario_id) values ('CRM-IVA-8','Frontera',$1,$2,$3),('CRM-IVA-16','Normal',$1,$4,$3)`,
      [org.id, cli, idVendedor, clienteOrg],
    )
    const props = (await vendedor.pedir('/api/estado/')).datos.propuestas as any[]
    expect(props.find((p) => p.folio === 'CRM-IVA-8').ivaPct).toBe(8)
    expect(props.find((p) => p.folio === 'CRM-IVA-16').ivaPct).toBe(16)
  })
})
