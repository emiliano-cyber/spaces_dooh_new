import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  NEG-01 · Comercial negociación, contra Postgres y Next de verdad.
// ----------------------------------------------------------------------------
//  Se monta ENCIMA de `prospectos` (decisión del dueño, 21/10): un espacio que
//  se negocia es un prospecto PREDIO o PANTALLA, con contactos, ofertas al
//  dueño, competencia, notas, visibilidad, medidas y ubicación.
//
//  Lo que se demuestra es sobre todo lo que se IMPIDE —lo que las unitarias no
//  ven porque simulan la base—:
//   · un vendedor no toca lo de otro, ni otra organización lo de ésta: 404 en
//     TODAS las rutas hijas, no solo en la del prospecto;
//   · un contacto, una oferta o una nota no pueden colgar de un prospecto de
//     otra organización ni con el id equivocado (FK compuesta con tenant);
//   · las notas no se editan ni se borran, y las ofertas no se borran;
//   · la etapa 5 («responsable legal confirmado») no se alcanza sin alguien que
//     firme, ni se le quita la firma después;
//   · el autor de una nota y quien fija una ubicación salen de la sesión.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>

const correo = (quien: string) => `${quien}@neg.test`

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
let anonimo: Cliente

const espacio = (nombre: string) => ({
  tipo: 'PREDIO',
  nombre,
  direccion: 'Av. Insurgentes Sur 1420, Col. Del Valle',
  contacto: { nombre: 'Ing. Roberto Salinas', telefono: '5531204471' },
  datos: {},
})

async function nuevo(nombre: string, c: Cliente = vendedor): Promise<string> {
  const r = await c.pedir('/api/captacion/', { cuerpo: espacio(nombre) })
  expect(r.status).toBe(201)
  return r.datos.id as string
}

const ruta = (id: string, resto = '') => `/api/captacion/${id}/${resto}`
const ficha = (c: Cliente, id: string, cuerpo: unknown) => c.pedir(ruta(id, 'ficha/'), { metodo: 'PATCH', cuerpo })
const leer = (c: Cliente, id: string) => c.pedir(ruta(id))

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

const TABLAS = ['prospecto_competencia', 'prospecto_contactos', 'prospecto_notas', 'prospecto_ofertas']

beforeAll(async () => {
  await recrearEsquema()
  org = await sembrarTenant('neg')
  otra = await sembrarTenant('neg-otra')
  await sembrarUsuario('Mariana López', 'v1', 'VENDEDOR', org.id)
  await sembrarUsuario('Luis Herrera', 'v2', 'VENDEDOR', org.id)
  await sembrarUsuario('Gerente', 'gerente', 'GERENTE_VENTAS', org.id)
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
  it('las cuatro tablas nuevas nacen con RLS forzada', async () => {
    const r = await poolTest().query(
      `select relname from pg_class where relname = any($1) and relrowsecurity and relforcerowsecurity order by relname`,
      [TABLAS],
    )
    expect(r.rows.map((x) => x.relname)).toEqual(TABLAS)
  })

  it('la visibilidad solo admite cercana, media o lejana', async () => {
    const id = await nuevo('Check visibilidad')
    await expect(
      poolTest().query(`update prospectos set visibilidad = 'REGULAR' where id = $1`, [id]),
    ).rejects.toThrow(/prospectos_visibilidad_ck/)
  })

  it('una medida no puede ser cero ni negativa', async () => {
    const id = await nuevo('Check medidas')
    await expect(poolTest().query(`update prospectos set ancho_m = 0 where id = $1`, [id])).rejects.toThrow(/ck/)
  })

  it('un contacto NO puede colgar de un prospecto de otra organización (FK con tenant)', async () => {
    const id = await nuevo('FK compuesta')
    await expect(
      poolTest().query(
        `insert into prospecto_contactos (tenant_id, prospecto_id, nombre) values ($1, $2, 'Colado')`,
        [otra.id, id],
      ),
    ).rejects.toThrow(/foreign key/)
  })

  it('las notas no se editan ni se borran, y las ofertas no se borran — ni por un defecto', async () => {
    await comoApp(org.id, async (c) => {
      await expect(c.query(`update prospecto_notas set texto = 'x'`)).rejects.toThrow(/permission denied/)
    })
    await comoApp(org.id, async (c) => {
      await expect(c.query('delete from prospecto_notas')).rejects.toThrow(/permission denied/)
    })
    await comoApp(org.id, async (c) => {
      await expect(c.query('delete from prospecto_ofertas')).rejects.toThrow(/permission denied/)
    })
  })
})

describe('2 · la ficha del espacio', () => {
  let id: string
  beforeAll(async () => {
    id = await nuevo('Azotea Insurgentes 1420')
  })

  it('guarda tipo de espacio, visibilidad, medidas y presupuesto, y los devuelve', async () => {
    const r = await ficha(vendedor, id, {
      tipoEspacio: 'Espectacular en azotea',
      visibilidad: 'LEJANA',
      anchoM: 12.9,
      altoM: 7.2,
      superficieM2: 140,
      presupuestoMin: 18000,
      presupuestoMax: 26000,
      presupuestoAutoriza: 'Dirección comercial',
    })
    expect(r.status).toBe(200)
    const d = (await leer(vendedor, id)).datos
    expect(d.tipoEspacio).toBe('Espectacular en azotea')
    expect(d.visibilidad).toBe('LEJANA')
    expect(d.anchoM).toBe(12.9)
    expect(d.altoM).toBe(7.2)
    expect(d.superficieM2).toBe(140)
    expect(d.presupuestoMin).toBe(18000)
    expect(d.presupuestoMax).toBe(26000)
    expect(d.presupuestoAutoriza).toBe('Dirección comercial')
  })

  it('lo que no viene no se toca; null lo borra', async () => {
    expect((await ficha(vendedor, id, { visibilidad: 'MEDIA' })).status).toBe(200)
    let d = (await leer(vendedor, id)).datos
    expect(d.visibilidad).toBe('MEDIA')
    expect(d.anchoM).toBe(12.9)
    expect((await ficha(vendedor, id, { superficieM2: null })).status).toBe(200)
    d = (await leer(vendedor, id)).datos
    expect(d.superficieM2).toBeNull()
    expect(d.altoM).toBe(7.2)
  })

  it('una visibilidad que no existe, un campo que no existe o un presupuesto al revés: 400', async () => {
    expect((await ficha(vendedor, id, { visibilidad: 'REGULAR' })).status).toBe(400)
    expect((await ficha(vendedor, id, { usuarioId: '00000000-0000-0000-0000-000000000000' })).status).toBe(400)
    expect((await ficha(vendedor, id, { presupuestoMin: 30000, presupuestoMax: 20000 })).status).toBe(400)
    expect((await ficha(vendedor, id, { anchoM: -1 })).status).toBe(400)
  })

  it('el presupuesto al revés también se niega si el otro extremo ya estaba guardado', async () => {
    expect((await ficha(vendedor, id, { presupuestoMin: 99000 })).status).toBe(409)
  })

  it('la ubicación: guarda la que confirma la persona, con su origen y quién la fijó', async () => {
    const r = await ficha(vendedor, id, {
      ubicacion: { lat: 19.3765, lng: -99.1781, origen: 'BUSCADOR', placeId: null },
    })
    expect(r.status).toBe(200)
    const d = (await leer(vendedor, id)).datos
    expect(d.lat).toBe(19.3765)
    expect(d.lng).toBe(-99.1781)
    expect(d.ubicacionOrigen).toBe('BUSCADOR')
    expect(d.ubicacionFijadaPorNombre).toBe('Mariana López')
    expect(d.ubicacionFijadaEn).toBeTruthy()
  })

  it('el GPS está PENDIENTE: la API no acepta ese origen todavía', async () => {
    const r = await ficha(vendedor, id, { ubicacion: { lat: 19.37, lng: -99.17, origen: 'GPS' } })
    expect(r.status).toBe(400)
  })

  it('y quien fija la ubicación no se manda en el cuerpo', async () => {
    const r = await ficha(vendedor, id, {
      ubicacion: { lat: 19.37, lng: -99.17, origen: 'PIN', fijadaPor: '00000000-0000-0000-0000-000000000000' },
    })
    expect(r.status).toBe(400)
  })

  it('el (0,0) no es una ubicación: 400', async () => {
    expect((await ficha(vendedor, id, { ubicacion: { lat: 0, lng: 0, origen: 'PIN' } })).status).toBe(400)
  })
})

describe('3 · quién toca qué', () => {
  let id: string
  beforeAll(async () => {
    id = await nuevo('Muro Parque Hundido')
  })

  it('otro vendedor recibe 404 —no 403— en la ficha y en TODAS las rutas hijas', async () => {
    expect((await ficha(vendedor2, id, { visibilidad: 'CERCANA' })).status).toBe(404)
    expect((await vendedor2.pedir(ruta(id, 'contactos/'), { cuerpo: { nombre: 'X' } })).status).toBe(404)
    expect((await vendedor2.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: 1000, plazoMeses: 12 } })).status).toBe(404)
    expect((await vendedor2.pedir(ruta(id, 'competencia/'), { cuerpo: { nombre: 'X' } })).status).toBe(404)
    expect((await vendedor2.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'X' } })).status).toBe(404)
    expect((await vendedor2.pedir(ruta(id, 'notas/'))).status).toBe(404)
  })

  it('otra organización, igual: 404', async () => {
    expect((await ficha(duenoOtra, id, { visibilidad: 'CERCANA' })).status).toBe(404)
    expect((await duenoOtra.pedir(ruta(id, 'contactos/'), { cuerpo: { nombre: 'X' } })).status).toBe(404)
    expect((await duenoOtra.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'X' } })).status).toBe(404)
  })

  it('quien puede aprobar (el gerente) sí trabaja el espacio de su vendedor', async () => {
    expect((await ficha(gerente, id, { visibilidad: 'CERCANA' })).status).toBe(200)
    expect((await gerente.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'Lo reviso el lunes' } })).status).toBe(201)
  })

  it('un id que no es uuid es 404, no 500', async () => {
    expect((await ficha(vendedor, 'no-es-uuid', { visibilidad: 'CERCANA' })).status).toBe(404)
    expect((await vendedor.pedir(ruta(id, 'contactos/no-es-uuid/'), { metodo: 'DELETE' })).status).toBe(404)
  })

  it('sin sesión, 401', async () => {
    expect((await ficha(anonimo, id, { visibilidad: 'CERCANA' })).status).toBe(401)
    expect((await anonimo.pedir('/api/geo/buscar/?q=Insurgentes')).status).toBe(401)
  })

  it('y en la base, con el tenant de la otra, las cuatro tablas devuelven cero filas', async () => {
    await vendedor.pedir(ruta(id, 'contactos/'), { cuerpo: { nombre: 'Condominio Porfirio 88' } })
    await vendedor.pedir(ruta(id, 'competencia/'), { cuerpo: { nombre: 'Publimex' } })
    await vendedor.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: 11000, plazoMeses: 48 } })
    await comoApp(otra.id, async (c) => {
      for (const t of TABLAS) {
        const r = await c.query(`select 1 from ${t} where prospecto_id = $1`, [id])
        expect(r.rowCount, t).toBe(0)
      }
    })
  })
})

describe('4 · contactos y la búsqueda del responsable', () => {
  let id: string
  beforeAll(async () => {
    id = await nuevo('Unipolar Viaducto km 4')
  })

  it('el contacto único del alta ya aparece como el primer contacto', async () => {
    const d = (await leer(vendedor, id)).datos
    expect(d.contactos.map((c: any) => c.nombre)).toEqual(['Ing. Roberto Salinas'])
  })

  it('se añaden varios, con papel, y un correo raro es 400', async () => {
    let r = await vendedor.pedir(ruta(id, 'contactos/'), {
      cuerpo: { nombre: 'Don Efraín', papel: 'Vecino', telefono: '5571203390' },
    })
    expect(r.status).toBe(201)
    expect(r.datos.contactos).toHaveLength(2)
    r = await vendedor.pedir(ruta(id, 'contactos/'), { cuerpo: { nombre: 'Sin correo', email: 'no-es-correo' } })
    expect(r.status).toBe(400)
  })

  it('la etapa 5 sin nadie que firme es 409; con alguien que firma, entra y queda en la bitácora', async () => {
    expect((await ficha(vendedor, id, { etapaResponsable: 5 })).status).toBe(409)
    const r = await vendedor.pedir(ruta(id, 'contactos/'), {
      cuerpo: { nombre: 'Lic. Andrea Ruiz', papel: 'Apoderada legal', esLegal: true },
    })
    expect(r.status).toBe(201)
    expect((await ficha(vendedor, id, { etapaResponsable: 5 })).status).toBe(200)
    const d = (await leer(vendedor, id)).datos
    expect(d.etapaResponsable).toBe(5)
    expect(d.avances.at(-1).nota).toMatch(/Responsable legal confirmado/)
  })

  it('a la única que firma no se le quita la firma ni se la borra mientras esté en 5', async () => {
    const d = (await leer(vendedor, id)).datos
    const legal = d.contactos.find((c: any) => c.esLegal)
    expect((await vendedor.pedir(ruta(id, `contactos/${legal.id}/`), { metodo: 'PATCH', cuerpo: { esLegal: false } })).status).toBe(409)
    expect((await vendedor.pedir(ruta(id, `contactos/${legal.id}/`), { metodo: 'DELETE' })).status).toBe(409)
  })

  it('a otro contacto se le edita y se le borra', async () => {
    const d = (await leer(vendedor, id)).datos
    const vecino = d.contactos.find((c: any) => c.nombre === 'Don Efraín')
    let r = await vendedor.pedir(ruta(id, `contactos/${vecino.id}/`), { metodo: 'PATCH', cuerpo: { telefono: '5500000000' } })
    expect(r.status).toBe(200)
    expect(r.datos.contactos.find((c: any) => c.id === vecino.id).telefono).toBe('5500000000')
    r = await vendedor.pedir(ruta(id, `contactos/${vecino.id}/`), { metodo: 'DELETE' })
    expect(r.status).toBe(200)
    expect(r.datos.contactos.find((c: any) => c.id === vecino.id)).toBeUndefined()
  })

  it('un contacto de OTRO espacio no se toca por la ruta de éste', async () => {
    const otroId = await nuevo('Otro espacio')
    const ajeno = (await leer(vendedor, otroId)).datos.contactos[0]
    expect((await vendedor.pedir(ruta(id, `contactos/${ajeno.id}/`), { metodo: 'DELETE' })).status).toBe(404)
  })
})

describe('5 · las ofertas al dueño', () => {
  let id: string
  beforeAll(async () => {
    id = await nuevo('Azotea Félix Cuevas 210')
  })

  it('la versión la pone el servidor: 1, 2, 3', async () => {
    for (const importe of [17500, 19000, 21500]) {
      const r = await vendedor.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: importe, plazoMeses: 36 } })
      expect(r.status).toBe(201)
    }
    const d = (await leer(vendedor, id)).datos
    expect(d.ofertas.map((o: any) => [o.version, o.importeMensual, o.estado])).toEqual([
      [3, 21500, 'ENVIADA'],
      [2, 19000, 'ENVIADA'],
      [1, 17500, 'ENVIADA'],
    ])
  })

  it('la versión no se manda: 400', async () => {
    const r = await vendedor.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: 1, plazoMeses: 1, version: 9 } })
    expect(r.status).toBe(400)
  })

  it('un importe de cero o un plazo fuera de rango es 400', async () => {
    expect((await vendedor.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: 0, plazoMeses: 12 } })).status).toBe(400)
    expect((await vendedor.pedir(ruta(id, 'ofertas/'), { cuerpo: { importeMensual: 100, plazoMeses: 0 } })).status).toBe(400)
  })

  it('cambia de estado; aceptada es final', async () => {
    const d = (await leer(vendedor, id)).datos
    const v3 = d.ofertas.find((o: any) => o.version === 3)
    let r = await vendedor.pedir(ruta(id, `ofertas/${v3.id}/`), {
      metodo: 'PATCH',
      cuerpo: { estado: 'CONTRAOFERTA', notas: 'Pide $24,000 con mantenimiento' },
    })
    expect(r.status).toBe(200)
    r = await vendedor.pedir(ruta(id, `ofertas/${v3.id}/`), { metodo: 'PATCH', cuerpo: { estado: 'ACEPTADA' } })
    expect(r.status).toBe(200)
    r = await vendedor.pedir(ruta(id, `ofertas/${v3.id}/`), { metodo: 'PATCH', cuerpo: { estado: 'RECHAZADA' } })
    expect(r.status).toBe(409)
  })

  it('el importe de una oferta no se reescribe: se hace otra versión', async () => {
    const v1 = (await leer(vendedor, id)).datos.ofertas.find((o: any) => o.version === 1)
    const r = await vendedor.pedir(ruta(id, `ofertas/${v1.id}/`), { metodo: 'PATCH', cuerpo: { importeMensual: 1 } })
    expect(r.status).toBe(400)
  })

  it('y no hay forma de borrarla por la API', async () => {
    const v1 = (await leer(vendedor, id)).datos.ofertas.find((o: any) => o.version === 1)
    expect((await vendedor.pedir(ruta(id, `ofertas/${v1.id}/`), { metodo: 'DELETE' })).status).toBe(405)
  })
})

describe('6 · la competencia', () => {
  it('se añade, se corrige y se borra', async () => {
    const id = await nuevo('Pantalla Glorieta Mixcoac')
    let r = await vendedor.pedir(ruta(id, 'competencia/'), {
      cuerpo: { nombre: 'Publimex Exterior', nota: 'Ofreció $22,000 a 3 años', desde: '2026-06-01' },
    })
    expect(r.status).toBe(201)
    const c = r.datos.competencia[0]
    expect(c.desde).toBe('2026-06-01')
    r = await vendedor.pedir(ruta(id, `competencia/${c.id}/`), { metodo: 'PATCH', cuerpo: { nota: 'Subió a $23,000' } })
    expect(r.datos.competencia[0].nota).toBe('Subió a $23,000')
    r = await vendedor.pedir(ruta(id, `competencia/${c.id}/`), { metodo: 'DELETE' })
    expect(r.datos.competencia).toHaveLength(0)
  })
})

describe('7 · las notas adicionales', () => {
  let id: string
  beforeAll(async () => {
    id = await nuevo('Notas')
  })

  it('cada nota lleva su autor y su fecha, que pone el servidor', async () => {
    let r = await vendedor.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'La azotea tiene acceso por el estacionamiento' } })
    expect(r.status).toBe(201)
    r = await gerente.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'Pedir planos estructurales' } })
    expect(r.status).toBe(201)
    const n = (await vendedor.pedir(ruta(id, 'notas/'))).datos.notas
    expect(n.map((x: any) => [x.texto, x.autorNombre])).toEqual([
      ['Pedir planos estructurales', 'Gerente'],
      ['La azotea tiene acceso por el estacionamiento', 'Mariana López'],
    ])
    expect(n[0].creadoEn).toBeTruthy()
  })

  it('el autor no se manda, y una nota vacía no es una nota', async () => {
    expect((await vendedor.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'x', autorId: '00000000-0000-0000-0000-000000000000' } })).status).toBe(400)
    expect((await vendedor.pedir(ruta(id, 'notas/'), { cuerpo: { texto: '   ' } })).status).toBe(400)
  })

  it('las notas vienen también en el detalle del espacio', async () => {
    expect((await leer(vendedor, id)).datos.notas).toHaveLength(2)
  })
})

describe('8 · la bitácora: canal y con quién se habló', () => {
  it('el avance guarda el canal y el contacto', async () => {
    const id = await nuevo('Bitácora')
    const r = await vendedor.pedir(ruta(id, 'avances/'), {
      cuerpo: { etapa: 'CONTACTADO', nota: 'Confirma que la apoderada decide', canal: 'LLAMADA', contactoNombre: 'Ing. Roberto Salinas' },
    })
    expect(r.status).toBe(201)
    const a = r.datos.avances.at(-1)
    expect(a.canal).toBe('LLAMADA')
    expect(a.contactoNombre).toBe('Ing. Roberto Salinas')
    expect(r.datos.ultimoContactoEn).toBeTruthy()
  })

  it('un canal que no existe es 400', async () => {
    const id = await nuevo('Bitácora mala')
    const r = await vendedor.pedir(ruta(id, 'avances/'), { cuerpo: { etapa: 'CONTACTADO', nota: 'x', canal: 'PALOMA' } })
    expect(r.status).toBe(400)
  })
})

describe('9 · la lista de espacios', () => {
  it('filtra por varios tipos a la vez y trae la búsqueda del responsable', async () => {
    await vendedor.pedir('/api/captacion/', {
      cuerpo: { tipo: 'CLIENTE', nombre: 'Un cliente', contacto: { telefono: '5500000000' }, datos: {} },
    })
    const r = await vendedor.pedir('/api/captacion/?tipos=PREDIO,PANTALLA&porPagina=100')
    expect(r.status).toBe(200)
    expect(r.datos.prospectos.length).toBeGreaterThan(0)
    expect(r.datos.prospectos.every((p: any) => ['PREDIO', 'PANTALLA'].includes(p.tipo))).toBe(true)
    expect(r.datos.prospectos[0]).toHaveProperty('etapaResponsable')
    expect(r.datos.prospectos[0]).toHaveProperty('visibilidad')
  })

  it('un tipo que no existe en la lista es 400', async () => {
    expect((await vendedor.pedir('/api/captacion/?tipos=PREDIO,NAVE')).status).toBe(400)
  })
})

describe('10 · un espacio perdido es historia', () => {
  it('no admite ficha ni contactos, pero sí notas', async () => {
    const id = await nuevo('Perdido')
    expect((await vendedor.pedir(ruta(id, 'avances/'), { cuerpo: { etapa: 'PERDIDO', nota: 'El dueño vendió' } })).status).toBe(201)
    expect((await ficha(vendedor, id, { visibilidad: 'CERCANA' })).status).toBe(409)
    expect((await vendedor.pedir(ruta(id, 'contactos/'), { cuerpo: { nombre: 'Tarde' } })).status).toBe(409)
    expect((await vendedor.pedir(ruta(id, 'notas/'), { cuerpo: { texto: 'Retomar si lo revenden' } })).status).toBe(201)
  })

  it('en revisión, la ficha no se mueve', async () => {
    const id = await nuevo('En revisión')
    expect((await vendedor.pedir(ruta(id, 'avances/'), { cuerpo: { etapa: 'EN_REVISION', nota: 'Listo' } })).status).toBe(201)
    expect((await ficha(vendedor, id, { anchoM: 3 })).status).toBe(409)
  })
})

describe('11 · el buscador de direcciones', () => {
  it('con sesión, una consulta demasiado corta es 400 sin salir a la red', async () => {
    expect((await vendedor.pedir('/api/geo/buscar/?q=a')).status).toBe(400)
  })
})
