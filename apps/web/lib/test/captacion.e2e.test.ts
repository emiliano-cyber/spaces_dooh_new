import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CAP-01 · La bitácora de captación, contra Postgres y Next de verdad.
// ----------------------------------------------------------------------------
//  Lo que se demuestra aquí es sobre todo lo que se IMPIDE, porque es lo que
//  las unitarias no pueden ver (simulan la base):
//
//   · un vendedor no ve, ni toca, los prospectos de otro vendedor — y el
//     rechazo es 404, no 403;
//   · una organización no ve los de otra, ni por la API ni por la base;
//   · el vendedor no se aprueba solo: ni por la ruta de decisión (403), ni
//     colando la etapa en un avance (409), ni en el cuerpo del alta (400);
//   · la bitácora no se edita ni se borra: el rol de la aplicación no puede;
//   · aprobar dos veces a la vez crea UN solo registro.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>

const correo = (quien: string) => `${quien}@capt.test`

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

let vendedor: Cliente
let vendedor2: Cliente
let gerente: Cliente
let duenoOtra: Cliente
let vendedorId: string

const arrendador = (nombre: string) => ({
  tipo: 'ARRENDADOR',
  nombre,
  contacto: { nombre: 'Don Luis', telefono: '5511112222' },
  datos: { rfc: null, notas: 'Tiene dos terrenos en Insurgentes' },
})

async function crear(c: Cliente, cuerpo: unknown) {
  return c.pedir('/api/captacion/', { cuerpo })
}
async function avanzar(c: Cliente, id: string, etapa: string, nota = 'avance') {
  return c.pedir(`/api/captacion/${id}/avances/`, { cuerpo: { etapa, nota } })
}
async function decidir(c: Cliente, id: string, cuerpo: unknown) {
  return c.pedir(`/api/captacion/${id}/decision/`, { cuerpo })
}

/** Un prospecto del vendedor, ya enviado a revisión. */
async function enRevision(cuerpo: unknown): Promise<string> {
  const r = await crear(vendedor, cuerpo)
  expect(r.status).toBe(201)
  const id = r.datos.id as string
  expect((await avanzar(vendedor, id, 'EN_REVISION', 'Listo para revisar')).status).toBe(201)
  return id
}

async function cuantos(tabla: string, where: string, params: unknown[]): Promise<number> {
  const r = await poolTest().query(`select count(*)::int n from ${tabla} where ${where}`, params)
  return r.rows[0].n
}

beforeAll(async () => {
  await recrearEsquema()
  org = await sembrarTenant('capt')
  otra = await sembrarTenant('capt-otra')
  vendedorId = await sembrarUsuario('Vendedora uno', 'v1', 'VENDEDOR', org.id)
  await sembrarUsuario('Vendedor dos', 'v2', 'VENDEDOR', org.id)
  await sembrarUsuario('Gerente', 'gerente', 'GERENTE_VENTAS', org.id)
  await arrancarServidor()
  vendedor = await entrar(correo('v1'))
  vendedor2 = await entrar(correo('v2'))
  gerente = await entrar(correo('gerente'))
  duenoOtra = await entrar(otra.usuarioEmail)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ───────────────────────────────────────────────────────────────────────────
describe('1 · la migración', () => {
  it('las dos tablas nacen con RLS forzada', async () => {
    const r = await poolTest().query(
      `select relname from pg_class where relname in ('prospectos','prospecto_avances')
          and relrowsecurity and relforcerowsecurity order by relname`,
    )
    expect(r.rows.map((x) => x.relname)).toEqual(['prospecto_avances', 'prospectos'])
  })

  it('el VENDEDOR ve y crea, pero NO aprueba; el gerente sí', async () => {
    const r = await poolTest().query(
      `select rol::text || '.' || accion as p from rol_permisos
        where modulo = 'captacion' and rol in ('VENDEDOR','GERENTE_VENTAS') order by 1`,
    )
    expect(r.rows.map((x) => x.p)).toEqual([
      'GERENTE_VENTAS.aprobar',
      'GERENTE_VENTAS.crear',
      'GERENTE_VENTAS.ver',
      'VENDEDOR.crear',
      'VENDEDOR.ver',
    ])
  })
})

describe('2 · el alta', () => {
  it('el vendedor da de alta un prospecto y queda a SU nombre, con su primera línea', async () => {
    const r = await crear(vendedor, { ...arrendador('Terrenos Luis'), nota: 'Lo conocí en la feria' })
    expect(r.status).toBe(201)
    expect(r.datos.etapa).toBe('PROSPECTO')
    expect(r.datos.usuarioId).toBe(vendedorId)
    expect(r.datos.vendedorNombre).toBe('Vendedora uno')
    expect(r.datos.avances).toHaveLength(1)
    expect(r.datos.avances[0].nota).toBe('Lo conocí en la feria')
  })

  it('NO acepta el vendedor en el cuerpo: 400, no un campo que se ignora', async () => {
    const r = await crear(vendedor, { ...arrendador('Colado'), usuarioId: '00000000-0000-0000-0000-000000000000' })
    expect(r.status).toBe(400)
  })

  it('ni la etapa: nadie nace APROBADO', async () => {
    const r = await crear(vendedor, { ...arrendador('Colado dos'), etapa: 'APROBADO' })
    expect(r.status).toBe(400)
  })

  it('un campo que no es del tipo se rechaza (los datos se validan por tipo)', async () => {
    const r = await crear(vendedor, { ...arrendador('Mal tipo'), datos: { anchoM: 3 } })
    expect(r.status).toBe(400)
  })
})

describe('3 · cada vendedor, lo suyo', () => {
  let id: string

  beforeAll(async () => {
    id = (await crear(vendedor, arrendador('Solo de la uno'))).datos.id
  })

  it('el otro vendedor no lo ve en la lista', async () => {
    const r = await vendedor2.pedir('/api/captacion/')
    expect(r.status).toBe(200)
    expect(r.datos.prospectos.map((p: any) => p.id)).not.toContain(id)
    expect(r.datos.puedeAprobar).toBe(false)
  })

  it('ni por su id: 404, no 403', async () => {
    expect((await vendedor2.pedir(`/api/captacion/${id}/`)).status).toBe(404)
  })

  it('ni puede anotarle un avance, ni editarlo', async () => {
    expect((await avanzar(vendedor2, id, 'CONTACTADO')).status).toBe(404)
    const e = await vendedor2.pedir(`/api/captacion/${id}/`, {
      metodo: 'PATCH',
      cuerpo: arrendador('Robado'),
    })
    expect(e.status).toBe(404)
    expect(await cuantos('prospecto_avances', 'prospecto_id = $1', [id])).toBe(1)
  })

  it('el gerente SÍ lo ve: quien puede aprobar ve a todo el equipo', async () => {
    const r = await gerente.pedir('/api/captacion/')
    expect(r.datos.prospectos.map((p: any) => p.id)).toContain(id)
    expect(r.datos.puedeAprobar).toBe(true)
  })
})

describe('4 · otra organización', () => {
  let id: string

  beforeAll(async () => {
    id = (await crear(vendedor, arrendador('De la org uno'))).datos.id
  })

  it('su Dueño no lo ve ni por la lista ni por el id', async () => {
    const l = await duenoOtra.pedir('/api/captacion/')
    expect(l.status).toBe(200)
    expect(l.datos.prospectos.map((p: any) => p.id)).not.toContain(id)
    expect((await duenoOtra.pedir(`/api/captacion/${id}/`)).status).toBe(404)
  })

  it('ni lo puede aprobar', async () => {
    expect((await decidir(duenoOtra, id, { decision: 'APROBAR' })).status).toBe(404)
  })

  it('y en la base, con el tenant de la otra, la RLS devuelve cero filas', async () => {
    const c = await poolApp().connect()
    try {
      await c.query('begin')
      await c.query("select set_config('app.tenant_id', $1, true)", [otra.id])
      const p = await c.query('select 1 from prospectos where id = $1', [id])
      const a = await c.query('select 1 from prospecto_avances where prospecto_id = $1', [id])
      expect(p.rowCount).toBe(0)
      expect(a.rowCount).toBe(0)
      await c.query('rollback')
    } finally {
      c.release()
    }
  })
})

describe('5 · el vendedor no se aprueba solo', () => {
  let id: string

  beforeAll(async () => {
    id = await enRevision(arrendador('Quiere aprobarse'))
  })

  it('la ruta de decisión le contesta 403', async () => {
    const r = await decidir(vendedor, id, { decision: 'APROBAR' })
    expect(r.status).toBe(403)
  })

  it('y colar APROBADO en un avance es 409', async () => {
    const r = await avanzar(vendedor, id, 'APROBADO')
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/revisi/i)
  })

  it('en revisión no se edita: cambiaría lo que alguien está revisando', async () => {
    const r = await vendedor.pedir(`/api/captacion/${id}/`, {
      metodo: 'PATCH',
      cuerpo: arrendador('Cambiado a escondidas'),
    })
    expect(r.status).toBe(409)
    expect(await cuantos('arrendadores', 'tenant_id = $1 and nombre = $2', [org.id, 'Quiere aprobarse'])).toBe(0)
  })
})

describe('6 · enviar a revisión exige lo mínimo', () => {
  it('un predio sin dirección ni dueño no se puede enviar, y la frase dice qué falta', async () => {
    const id = (await crear(vendedor, { tipo: 'PREDIO', nombre: 'Lote baldío' })).datos.id
    const r = await avanzar(vendedor, id, 'EN_REVISION')
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/dirección/)
    expect(r.datos.error).toMatch(/dueño/)
    // Y no dejó línea en la bitácora: el rechazo no escribe.
    expect(await cuantos('prospecto_avances', 'prospecto_id = $1', [id])).toBe(1)
  })
})

describe('7 · rechazar, corregir y aprobar', () => {
  let id: string

  beforeAll(async () => {
    id = await enRevision(arrendador('Arrendador Pérez'))
  })

  it('rechazar pide motivo', async () => {
    expect((await decidir(gerente, id, { decision: 'RECHAZAR', motivo: '' })).status).toBe(400)
  })

  it('el rechazo vuelve al vendedor con el motivo en la bitácora', async () => {
    const r = await decidir(gerente, id, { decision: 'RECHAZAR', motivo: 'Falta el RFC' })
    expect(r.status).toBe(200)
    expect(r.datos.etapa).toBe('RECHAZADO')
    expect(r.datos.motivoRechazo).toBe('Falta el RFC')
    const v = await vendedor.pedir(`/api/captacion/${id}/`)
    expect(v.datos.avances.at(-1).nota).toMatch(/Falta el RFC/)
  })

  it('el vendedor corrige y lo reenvía', async () => {
    const e = await vendedor.pedir(`/api/captacion/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { ...arrendador('Arrendador Pérez'), datos: { rfc: 'PEPL800101AAA' } },
    })
    expect(e.status).toBe(200)
    expect((await avanzar(vendedor, id, 'EN_REVISION', 'Ya con RFC')).status).toBe(201)
  })

  it('al aprobarlo nace el arrendador de verdad, enlazado', async () => {
    const r = await decidir(gerente, id, { decision: 'APROBAR' })
    expect(r.status).toBe(200)
    expect(r.datos.etapa).toBe('APROBADO')
    expect(r.datos.registroId).toBeTruthy()
    const a = await poolTest().query('select nombre, rfc, tenant_id from arrendadores where id = $1', [
      r.datos.registroId,
    ])
    expect(a.rows[0]).toMatchObject({ nombre: 'Arrendador Pérez', rfc: 'PEPL800101AAA', tenant_id: org.id })
    expect(r.datos.avances.at(-1).etapaNueva).toBe('APROBADO')
  })

  it('aprobar otra vez es 409 y no crea un segundo arrendador', async () => {
    expect((await decidir(gerente, id, { decision: 'APROBAR' })).status).toBe(409)
    expect(await cuantos('arrendadores', 'tenant_id = $1 and nombre = $2', [org.id, 'Arrendador Pérez'])).toBe(1)
  })

  it('cerrado ya no admite avances', async () => {
    expect((await avanzar(vendedor, id, 'APROBADO', 'nota')).status).toBe(409)
  })
})

describe('8 · lo que se crea según el tipo', () => {
  it('un CLIENTE aprobado es un cliente, con su contacto', async () => {
    const id = await enRevision({
      tipo: 'CLIENTE',
      nombre: 'Refresquera del Norte',
      contacto: { nombre: 'Ana', email: 'ana@refresquera.mx' },
      datos: { presupuesto: 250000 },
    })
    const r = await decidir(gerente, id, { decision: 'APROBAR' })
    expect(r.status).toBe(200)
    const c = await poolTest().query('select nombre, contacto from clientes where id = $1', [r.datos.registroId])
    expect(c.rows[0].nombre).toBe('Refresquera del Norte')
    expect(c.rows[0].contacto.email).toBe('ana@refresquera.mx')
  })

  it('un PREDIO con el dueño como contacto crea el arrendador Y el predio', async () => {
    const id = await enRevision({
      tipo: 'PREDIO',
      nombre: 'Azotea Insurgentes 300',
      direccion: 'Insurgentes Sur 300',
      contacto: { nombre: 'Doña Marta', telefono: '5533334444' },
      datos: { rentaPedida: 18000 },
    })
    const r = await decidir(gerente, id, { decision: 'APROBAR' })
    expect(r.status).toBe(200)
    const p = await poolTest().query(
      `select p.nombre, p.estado::text, a.nombre as arrendador
         from predios p join arrendadores a on a.id = p.arrendador_id where p.id = $1`,
      [r.datos.registroId],
    )
    expect(p.rows[0]).toMatchObject({
      nombre: 'Azotea Insurgentes 300',
      estado: 'DISPONIBLE',
      arrendador: 'Doña Marta',
    })
  })

  it('una PANTALLA queda aprobada sin registro: la da de alta Inventario', async () => {
    const id = await enRevision({ tipo: 'PANTALLA', nombre: 'Muro Periférico', direccion: 'Periférico 1000' })
    const r = await decidir(gerente, id, { decision: 'APROBAR' })
    expect(r.status).toBe(200)
    expect(r.datos.etapa).toBe('APROBADO')
    expect(r.datos.registroId).toBeNull()
  })
})

describe('9 · un nombre repetido no se cuela', () => {
  it('si ya hay un arrendador con ese nombre, vuelve a revisión y se puede confirmar', async () => {
    await poolTest().query(
      `insert into arrendadores (nombre, tenant_id) values ('Repetido SA', $1)`,
      [org.id],
    )
    const id = await enRevision(arrendador('Repetido SA'))
    const r = await decidir(gerente, id, { decision: 'APROBAR' })
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/Ya existe/)
    // El reclamo se deshizo: sigue en revisión y sin línea de «aprobado».
    const v = await gerente.pedir(`/api/captacion/${id}/`)
    expect(v.datos.etapa).toBe('EN_REVISION')
    expect(v.datos.avances.some((a: any) => a.etapaNueva === 'APROBADO')).toBe(false)
    // Confirmando que es otro, pasa.
    const ok = await decidir(gerente, id, { decision: 'APROBAR', confirmaNombreRepetido: true })
    expect(ok.status).toBe(200)
    expect(await cuantos('arrendadores', 'tenant_id = $1 and nombre = $2', [org.id, 'Repetido SA'])).toBe(2)
  })
})

describe('10 · la bitácora no se reescribe', () => {
  it('el rol de la aplicación no puede editar ni borrar un avance', async () => {
    const c = await poolApp().connect()
    try {
      await c.query('begin')
      await c.query("select set_config('app.tenant_id', $1, true)", [org.id])
      await expect(c.query("update prospecto_avances set nota = 'reescrito'")).rejects.toThrow(/permission denied/)
      await c.query('rollback')
      await c.query('begin')
      await c.query("select set_config('app.tenant_id', $1, true)", [org.id])
      await expect(c.query('delete from prospecto_avances')).rejects.toThrow(/permission denied/)
      await c.query('rollback')
      await c.query('begin')
      await c.query("select set_config('app.tenant_id', $1, true)", [org.id])
      await expect(c.query('delete from prospectos')).rejects.toThrow(/permission denied/)
      await c.query('rollback')
    } finally {
      c.release()
    }
  })
})

describe('11 · LA CARRERA — dos aprobaciones a la vez', () => {
  // Con un PREDIO ligado a un arrendador que YA existe, a propósito. La primera
  // versión de esta prueba usaba un arrendador nuevo y pasaba SIN el bloqueo:
  // la segunda aprobación chocaba con el aviso de «ya existe uno con ese
  // nombre», no con el candado. Medido quitando el `for update` y viéndola
  // seguir en verde. Un predio no tiene aviso de duplicado, así que aquí lo
  // único que impide dos predios es el reclamo con la fila bloqueada.
  it('exactamente una gana, y nace UN predio', async () => {
    const arr = await poolTest().query(
      `insert into arrendadores (nombre, tenant_id) values ('Dueño de la carrera', $1) returning id`,
      [org.id],
    )
    const id = await enRevision({
      tipo: 'PREDIO',
      nombre: 'Predio de la carrera',
      direccion: 'Calzada 1',
      datos: { arrendadorId: arr.rows[0].id },
    })
    // SEIS a la vez y no dos: con dos, la carrera sin candado se perdia en 2 de
    // cada 3 corridas (medido), y una prueba que caza el defecto a veces no lo
    // caza. Cada una trae su propia sesion para no compartir conexion.
    const jueces = await Promise.all(Array.from({ length: 6 }, () => entrar(correo('gerente'))))
    const r = await Promise.all(jueces.map((j) => decidir(j, id, { decision: 'APROBAR' })))
    expect(r.map((x) => x.status).sort()).toEqual([200, 409, 409, 409, 409, 409])
    expect(await cuantos('predios', 'tenant_id = $1 and nombre = $2', [org.id, 'Predio de la carrera'])).toBe(1)
  })
})

describe('12 · las pestañas se filtran y se cuentan EN EL SERVIDOR', () => {
  // La primera versión de la pantalla pedía una página y repartía las pestañas
  // en el navegador: con más prospectos que los de una página, «Por aprobar»
  // podía salir vacía con uno esperando. Encontrado en la revisión del diff.
  it('un grupo de etapas devuelve solo esas, y los contadores cubren todas', async () => {
    const r = await gerente.pedir('/api/captacion/?etapas=EN_REVISION&porPagina=1')
    expect(r.status).toBe(200)
    expect(r.datos.prospectos.every((p: any) => p.etapa === 'EN_REVISION')).toBe(true)
    const enBase = await cuantos('prospectos', "tenant_id = $1 and etapa = 'EN_REVISION'", [org.id])
    expect(enBase).toBeGreaterThan(0)
    // Con porPagina=1 la página trae uno, pero el total y el contador dicen todos.
    expect(r.datos.total).toBe(enBase)
    expect(r.datos.porEtapa.EN_REVISION).toBe(enBase)
    expect(r.datos.porEtapa.APROBADO).toBe(
      await cuantos('prospectos', "tenant_id = $1 and etapa = 'APROBADO'", [org.id]),
    )
  })

  it('y al vendedor los contadores solo le cuentan lo suyo', async () => {
    const r = await vendedor2.pedir('/api/captacion/')
    const suyos = await cuantos('prospectos', 'tenant_id = $1 and usuario_id = (select id from usuarios where email = $2)', [org.id, correo('v2')])
    const contados = Object.values(r.datos.porEtapa as Record<string, number>).reduce((a, b) => a + b, 0)
    expect(contados).toBe(suyos)
  })

  it('una etapa inventada en el filtro es un 400', async () => {
    expect((await gerente.pedir('/api/captacion/?etapas=GANADO')).status).toBe(400)
  })
})

describe('13 · el filtro por tipo', () => {
  // Nació roto: una edición dejó `p.tipo = ${n}` sin el `$` del placeholder y
  // ninguna prueba pedía ?tipo=. La pantalla lo usa en «Todos los tipos».
  it('devuelve solo ese tipo, y combina con el grupo de etapas', async () => {
    const r = await gerente.pedir('/api/captacion/?tipo=PREDIO')
    expect(r.status).toBe(200)
    expect(r.datos.prospectos.length).toBeGreaterThan(0)
    expect(r.datos.prospectos.every((p: any) => p.tipo === 'PREDIO')).toBe(true)
    const c = await gerente.pedir('/api/captacion/?tipo=ARRENDADOR&etapas=APROBADO,PERDIDO')
    expect(c.status).toBe(200)
    expect(c.datos.prospectos.every((p: any) => p.tipo === 'ARRENDADOR' && ['APROBADO', 'PERDIDO'].includes(p.etapa))).toBe(true)
  })
})
