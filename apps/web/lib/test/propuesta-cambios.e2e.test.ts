import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0051 · Fase 3 — el historial de cada propuesta, campo por campo, contra
//  Postgres y Next de verdad.
// ----------------------------------------------------------------------------
//  Lo escribe un TRIGGER (`20261117_propuesta_cambios_por_trigger.sql`), así
//  que esta prueba no mira el código de cada ruta: recorre las rutas que
//  ESCRIBEN una propuesta y exige, en cada una, la fila con la acción, el campo
//  y el autor correctos. Es la red que el ADR pedía para que ninguna ruta deje
//  un hueco en silencio.
//
//  Y lo que se IMPIDE:
//   · un cambio que falla no deja historial (misma transacción);
//   · el autor sale de la sesión y NO se queda pegado a la conexión del pool:
//     una escritura sin sesión sale como SISTEMA;
//   · la aceptación por la liga sale como CLIENTE, con el nombre que escribió;
//   · el historial de un borrador borrado sobrevive, con su folio;
//   · ligar a la oportunidad de otro vendedor es 404, a una perdida o de otro
//     cliente es 409.
//
//  No cubre `POST …/enviar` (manda correo de verdad) ni `…/codigo/decision`
//  (necesita un cupón con aprobación): los dos cambian columnas que el trigger
//  ya registra por la misma vía que las rutas de aquí (`estatus` y `codigo_*`).
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let vendedor: Cliente
let vendedor2: Cliente
let idDueno: string
let sitio2: string

const correo = (q: string) => `${q}@cambios.test`

async function sembrarUsuario(nombre: string, quien: string, rol: string) {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  return r.rows[0].id as string
}

async function entrar(email: string) {
  const c = new Cliente()
  await c.entrar(email, PASSWORD_DEMO)
  return c
}

/** Copia la pantalla sembrada (mismo predio, así hereda su contrato completo). */
async function segundaPantalla(): Promise<string> {
  const p = poolTest()
  const base = await p.query('select predio_id from sitios where id = $1', [org.sitioId])
  const r = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion)
     values ('Pantalla cambios 2','CAMB-002','CAMB-PROV-002','PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc',
             'CDMX',12,15000,15000,$1,$2,'digital')
     returning id`,
    [base.rows[0].predio_id, org.id],
  )
  return r.rows[0].id as string
}

const linea = (sitioId: string, tarifa = 45_000) => ({ sitioId, unidad: 'mensual', tarifaUnitaria: tarifa, cantidad: 1 })

async function crear(c: Cliente, nombre: string, extra: Record<string, unknown> = {}, sitios = [org.sitioId]) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre,
      clienteId: org.clienteId,
      fechaInicio: enDias(1),
      fechaFin: enDias(30),
      items: sitios.map((s) => linea(s)),
      ...extra,
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos
}

/** El historial de una propuesta, del más viejo al más nuevo. */
async function historial(propuestaId: string) {
  const r = await poolTest().query(
    `select accion, campo, origen, usuario_id, usuario_nombre, folio, version, item_id,
            valor_anterior, valor_nuevo
       from propuesta_cambios where propuesta_id = $1 order by creado_en, id`,
    [propuestaId],
  )
  return r.rows
}

const acciones = async (id: string) => (await historial(id)).map((f) => `${f.accion}${f.campo ? ':' + f.campo : ''}`)

async function desbloquear(c: Cliente) {
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('cambios')
  idDueno = (await poolTest().query('select id from usuarios where email = $1', [org.usuarioEmail])).rows[0].id
  await sembrarUsuario('Mariana López', 'v1', 'VENDEDOR')
  await sembrarUsuario('Luis Herrera', 'v2', 'VENDEDOR')
  sitio2 = await segundaPantalla()
  await arrancarServidor()
  dueno = await entrar(org.usuarioEmail)
  vendedor = await entrar(correo('v1'))
  vendedor2 = await entrar(correo('v2'))
  await desbloquear(dueno)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ───────────────────────────────────────────────────────────────────────────
describe('1 · la migración', () => {
  it('los dos triggers existen', async () => {
    const r = await poolTest().query(
      `select tgname from pg_trigger
        where tgname in ('trg_propuestas_registrar_cambio','trg_propuesta_items_registrar_cambio')
          and not tgisinternal order by tgname`,
    )
    expect(r.rows.map((x) => x.tgname)).toEqual(['trg_propuesta_items_registrar_cambio', 'trg_propuestas_registrar_cambio'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('2 · cada ruta que escribe deja su fila', () => {
  it('crear: UNA fila CREAR con el autor de la sesión, no una por pantalla', async () => {
    const p = await crear(dueno, 'Navidad', {}, [org.sitioId, sitio2])
    const h = await historial(p.id)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ accion: 'CREAR', origen: 'APP', usuario_id: idDueno, folio: p.folio, version: 1 })
    expect(h[0].usuario_nombre).toBeTruthy()
    expect(h[0].valor_nuevo).toMatchObject({ nombre: 'Navidad', cliente_id: org.clienteId })
  })

  it('editar el nombre y el descuento: una fila por campo, con lo de antes y lo de después', async () => {
    const p = await crear(dueno, 'Antes')
    const r = await dueno.pedir(`/api/propuestas/${p.id}/`, {
      metodo: 'PATCH',
      cuerpo: { nombre: 'Después', descuentoPct: 5 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const h = (await historial(p.id)).filter((f) => f.accion === 'EDITAR')
    expect(h.map((f) => f.campo).sort()).toEqual(['descuento_pct', 'nombre'])
    const nombre = h.find((f) => f.campo === 'nombre')!
    expect(nombre.valor_anterior).toBe('Antes')
    expect(nombre.valor_nuevo).toBe('Después')
    expect(Number(h.find((f) => f.campo === 'descuento_pct')!.valor_nuevo)).toBe(5)
  })

  it('un cambio que FALLA no deja historial: es la misma transacción', async () => {
    // Una aprobada es inmutable: editarla da 409 desde `actualizarPropuesta`.
    const p = await crear(dueno, 'No cambia')
    expect((await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })).status).toBe(200)
    const antes = (await historial(p.id)).length
    const r = await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'Otro nombre' } })
    expect(r.status).toBe(409)
    expect((await historial(p.id)).length).toBe(antes)
    // Y el borrado de un no-borrador tampoco deja fila BORRAR.
    expect((await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })).status).toBe(409)
    expect((await historial(p.id)).length).toBe(antes)
  })

  it('enviar: ENVIAR, con el estatus de antes y el de después', async () => {
    const p = await crear(dueno, 'A enviar')
    expect((await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })).status).toBe(200)
    const est = (await historial(p.id)).find((f) => f.campo === 'estatus')!
    expect(est).toMatchObject({ accion: 'ENVIAR', valor_anterior: 'BORRADOR', valor_nuevo: 'ENVIADA' })
  })

  it('agregar, aprobar y quitar un sitio: AGREGAR_SITIO, APROBAR_SITIO y QUITAR_SITIO, con su renglón', async () => {
    const p = await crear(dueno, 'Sitios')
    const ag = await dueno.pedir(`/api/propuestas/${p.id}/items/`, { cuerpo: { items: [linea(sitio2, 15_000)] } })
    expect(ag.status, JSON.stringify(ag.datos)).toBe(201)
    const nuevo = ag.datos.items.find((i: any) => i.sitioId === sitio2)
    expect((await dueno.pedir(`/api/propuestas/items/${nuevo.id}/`, { metodo: 'PATCH', cuerpo: { aprobado: true } })).status).toBe(200)
    expect((await dueno.pedir(`/api/propuestas/items/${nuevo.id}/`, { metodo: 'DELETE' })).status).toBe(200)
    const h = await historial(p.id)
    const deItem = h.filter((f) => f.item_id === nuevo.id).map((f) => f.accion)
    expect(deItem).toEqual(['AGREGAR_SITIO', 'APROBAR_SITIO', 'QUITAR_SITIO'])
    expect(h.find((f) => f.accion === 'APROBAR_SITIO')).toMatchObject({ campo: 'aprobado', valor_anterior: false, valor_nuevo: true })
  })

  it('el cupón: CODIGO', async () => {
    await poolTest().query(
      `insert into codigos_promocionales (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
       values ($1,'HIST10',10,current_date,current_date + 30, 10)`,
      [org.id],
    )
    const p = await crear(dueno, 'Con cupón')
    const r = await dueno.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'HIST10' } })
    expect(r.status, JSON.stringify(r.datos)).toBeLessThan(300)
    const h = (await historial(p.id)).filter((f) => f.accion === 'CODIGO')
    expect(h.length).toBeGreaterThan(0)
    expect(h.every((f) => String(f.campo).startsWith('codigo_'))).toBe(true)
  })

  it('el paquete: PAQUETE al aplicarlo y al quitarlo', async () => {
    const paq = await dueno.pedir('/api/paquetes/', {
      cuerpo: { nombre: 'Historial', precioCerrado: 50_000, sitios: [org.sitioId, sitio2] },
    })
    expect(paq.status, JSON.stringify(paq.datos)).toBe(201)
    const p = await crear(dueno, 'Con paquete', {}, [org.sitioId, sitio2])
    const ap = await dueno.pedir(`/api/propuestas/${p.id}/paquete/`, { cuerpo: { paqueteId: paq.datos.id } })
    expect(ap.status, JSON.stringify(ap.datos)).toBeLessThan(300)
    const conPaquete = (await historial(p.id)).filter((f) => f.accion === 'PAQUETE')
    expect(conPaquete.some((f) => f.campo === 'paquete_precio')).toBe(true)
    expect((await dueno.pedir(`/api/propuestas/${p.id}/paquete/`, { metodo: 'DELETE' })).status).toBeLessThan(300)
    const despues = (await historial(p.id)).filter((f) => f.accion === 'PAQUETE' && f.campo === 'paquete_precio')
    expect(despues).toHaveLength(2)
  })

  it('rechazar: ESTATUS', async () => {
    const p = await crear(dueno, 'A rechazar')
    await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect((await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'RECHAZADA' } })).status).toBe(200)
    expect((await historial(p.id)).find((f) => f.valor_nuevo === 'RECHAZADA')).toMatchObject({ accion: 'ESTATUS', campo: 'estatus' })
  })

  it('el cliente la acepta por la liga: ACEPTAR, origen CLIENTE, con el nombre que escribió y sin usuario', async () => {
    const p = await crear(dueno, 'Por la liga')
    await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    const r = await new Cliente().pedir(`/api/propuestas/publica/${p.tokenPublico}/`, { cuerpo: { nombre: 'Clara Ruiz' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const acept = (await historial(p.id)).filter((f) => f.accion === 'ACEPTAR')
    expect(acept.length).toBeGreaterThan(0)
    expect(acept.find((f) => f.campo === 'estatus')).toMatchObject({
      origen: 'CLIENTE', usuario_id: null, usuario_nombre: 'Clara Ruiz', valor_nuevo: 'APROBADA',
    })
  })

  it('ponerle cliente a una aprobada sin él (al generar la campaña): EDITAR cliente_id', async () => {
    const p = await crear(dueno, 'Sin cliente', { clienteId: null })
    const ap = await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
    await dueno.pedir(`/api/propuestas/${p.id}/generar-campana/`, { cuerpo: { clienteId: org.clienteId } })
    expect((await historial(p.id)).find((f) => f.campo === 'cliente_id')).toMatchObject({
      accion: 'EDITAR', valor_anterior: null, valor_nuevo: org.clienteId,
    })
  })

  it('borrar un borrador: BORRAR, y la historia SOBREVIVE con su folio', async () => {
    const p = await crear(dueno, 'Se borra')
    await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'Se borra ya' } })
    expect((await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })).status).toBe(200)
    expect((await poolTest().query('select 1 from propuestas where id = $1', [p.id])).rowCount).toBe(0)
    const h = await historial(p.id)
    expect(h.map((f) => f.accion)).toEqual(['CREAR', 'EDITAR', 'BORRAR'])
    expect(h.every((f) => f.folio === p.folio)).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('3 · el autor no se queda pegado a la conexión', () => {
  it('una escritura sin sesión, tras otra con sesión, sale como SISTEMA', async () => {
    const p = await crear(dueno, 'Conexión limpia')
    // Muchas escrituras con sesión primero, para reusar conexiones del pool del
    // servidor; y luego una del rol de la aplicación con SOLO el tenant fijado.
    for (let i = 0; i < 5; i++) {
      await dueno.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { notas: `nota ${i}` } })
    }
    const c = await poolApp().connect()
    try {
      await c.query('begin')
      await c.query("select set_config('app.tenant_id', $1, true)", [org.id])
      await c.query(`update propuestas set notas = 'del sistema' where id = $1`, [p.id])
      await c.query('commit')
    } finally {
      c.release()
    }
    const ultima = (await historial(p.id)).at(-1)!
    expect(ultima).toMatchObject({ campo: 'notas', valor_nuevo: 'del sistema', origen: 'SISTEMA', usuario_id: null })
    expect(ultima.usuario_nombre).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('4 · ligar a una oportunidad', () => {
  let opMariana: any
  beforeAll(async () => {
    const r = await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Navidad 2026', clienteId: org.clienteId } })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    opMariana = r.datos
  })

  it('al crear: la propuesta nace ligada y la oportunidad la cuenta', async () => {
    const p = await crear(vendedor, 'Primera cotización', { oportunidadId: opMariana.id })
    expect((await historial(p.id))[0].valor_nuevo.oportunidad_id).toBe(opMariana.id)
    const o = (await vendedor.pedir(`/api/oportunidades/${opMariana.id}/`)).datos
    expect(o.cotizaciones).toBe(1)
    expect(o.propuestas[0].id).toBe(p.id)
  })

  it('después: LIGAR, y desligar con null', async () => {
    const p = await crear(vendedor, 'Segunda cotización')
    let r = await vendedor.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: opMariana.id } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    r = await vendedor.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: null } })
    expect(r.status).toBe(200)
    const l = (await historial(p.id)).filter((f) => f.accion === 'LIGAR')
    expect(l.map((f) => [f.valor_anterior, f.valor_nuevo])).toEqual([[null, opMariana.id], [opMariana.id, null]])
  })

  it('a la oportunidad de OTRO vendedor: 404, al crear y al ligar', async () => {
    const r = await vendedor2.pedir('/api/propuestas/', {
      cuerpo: { nombre: 'Colada', clienteId: org.clienteId, fechaInicio: enDias(1), fechaFin: enDias(30),
                items: [linea(org.sitioId)], oportunidadId: opMariana.id },
    })
    expect(r.status).toBe(404)
    const p = await crear(vendedor2, 'De Luis')
    expect(
      (await vendedor2.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: opMariana.id } })).status,
    ).toBe(404)
  })

  it('de otro cliente o a una perdida: 409; mezclado con otros campos: 400', async () => {
    const otroCliente = (await poolTest().query(
      `insert into clientes (nombre, tenant_id) values ('Otro cliente', $1) returning id`, [org.id],
    )).rows[0].id
    const p = await crear(vendedor, 'De otro cliente', { clienteId: otroCliente })
    expect(
      (await vendedor.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: opMariana.id } })).status,
    ).toBe(409)
    expect(
      (await vendedor.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: opMariana.id, nombre: 'x' } })).status,
    ).toBe(400)
    const perdida = (await vendedor.pedir('/api/oportunidades/', { cuerpo: { nombre: 'Se pierde', clienteId: otroCliente } })).datos
    await vendedor.pedir(`/api/oportunidades/${perdida.id}/etapa/`, { cuerpo: { etapa: 'PERDIDA', motivoPerdida: 'Precio' } })
    expect(
      (await vendedor.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { oportunidadId: perdida.id } })).status,
    ).toBe(409)
    expect((await historial(p.id)).some((f) => f.accion === 'LIGAR')).toBe(false)
  })
})
