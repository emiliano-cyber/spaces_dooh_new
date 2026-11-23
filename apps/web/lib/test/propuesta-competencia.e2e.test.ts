import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PROP-MARCA (20/11) · la competencia de marcas AL CREAR LA PROPUESTA, contra
//  Postgres y Next reales.
// ----------------------------------------------------------------------------
//  Pedido del dueño: «la validación de la competencia también debe estar al
//  crear la propuesta, con las lógicas que ya están dentro». Se mide:
//
//   1. Coca-Cola reservada en un sitio con valla; una propuesta de Pepsi en ese
//      sitio y esas fechas → 201 CON el aviso (nunca un bloqueo), y la marca
//      guardada. Otras fechas → sin aviso.
//   2. Marca vacía → cuenta el nombre del CLIENTE, y se guarda NULL.
//   3. Agregar el sitio después también avisa; editar la marca también.
//   4. La vista previa de la pantalla (`POST /api/propuestas/competencia`).
//   5. Aislamiento (R2): otra organización no ve el choque de ésta, ni
//      preguntando por el sitio de ésta.
//   6. Generar la campaña COPIA la marca a `campanas.marca`.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let sitioSinValla: string
let clientePepsi: string

const INI = 30
const FIN = 45

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('compalfa')
  beta = await sembrarTenant('compbeta')
  // Un segundo sitio de alfa SIN vallas: la regla trabaja sobre vallas, así
  // que aquí no puede salir aviso aunque la marca choque.
  sitioSinValla = (
    await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion)
       values ('Sin valla compalfa','COMPALFA-002','COMPALFA-PROV-002','VALLA','DISPONIBLE','Tlalpan','CDMX',30000,30000,$1,'fijo')
       returning id`,
      [alfa.id],
    )
  ).rows[0].id
  // Un cliente que SE LLAMA como la marca: con la marca vacía, cuenta él.
  clientePepsi = (
    await poolTest().query(
      `insert into clientes (nombre, razon_social, rfc, tipo, iva_pct, tenant_id)
       values ('Pepsi','Pepsi SA de CV','XAXX010101000','DIRECTO',16,$1) returning id`,
      [alfa.id],
    )
  ).rows[0].id
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)

  // La categoría y la valla, por la API y como el Dueño, en las DOS
  // organizaciones: beta tiene la misma regla y aun así no debe ver nada de alfa.
  for (const [c, t] of [[ca, alfa], [cb, beta]] as const) {
    const k = await c.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    expect(k.status, JSON.stringify(k.datos)).toBe(201)
    const v = await c.pedir('/api/vallas/', { cuerpo: { sitioId: t.sitioId, numero: 'V-1', ancho: 12, alto: 3 } })
    expect(v.status, JSON.stringify(v.datos)).toBe(201)
  }
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let campanaCoca: string
beforeEach(async () => {
  // Una campaña de Coca-Cola reservada en el sitio con valla de alfa.
  await poolTest().query(`delete from reservas where campana_id in (select id from campanas where nombre = 'Navidad Coca')`)
  await poolTest().query(`delete from campanas where nombre = 'Navidad Coca'`)
  campanaCoca = (
    await poolTest().query(
      `insert into campanas (nombre, cliente_id, marca, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
       values ('Navidad Coca',$1,'Coca-Cola','OOH'::tipo_campana,$2,$3,'CONFIRMADA',$4) returning id`,
      [alfa.clienteId, enDias(INI), enDias(FIN), alfa.id],
    )
  ).rows[0].id
  await poolTest().query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,$3,$4,1000,'CONFIRMADA',$5)`,
    [campanaCoca, alfa.sitioId, enDias(INI), enDias(FIN), alfa.id],
  )
})

const precioDe = (sitioId: string) => (sitioId === sitioSinValla ? 30_000 : 45_000)

async function crear(c: Cliente, cuerpo: Record<string, unknown>, sitioId: string) {
  return c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: 'Propuesta competencia',
      fechaInicio: enDias(INI + 5),
      fechaFin: enDias(FIN + 10),
      items: [{ sitioId, precio: precioDe(sitioId) }],
      ...cuerpo,
    },
  })
}

const marcaGuardada = async (id: string) =>
  (await poolTest().query('select marca from propuestas where id = $1', [id])).rows[0].marca as string | null

describe('crear la propuesta avisa de la competencia', () => {
  it('Pepsi en el sitio de Coca-Cola, fechas que se solapan → 201 con UN aviso, y la marca guardada', async () => {
    const r = await crear(ca, { marca: '  Pepsi ' }, alfa.sitioId)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.marca).toBe('Pepsi')
    expect(r.datos.avisosCompetencia).toEqual([
      expect.objectContaining({
        nivel: 'aviso',
        marca: 'Pepsi',
        marcaExistente: 'Coca-Cola',
        categoria: 'Refrescos de cola',
        sitioId: alfa.sitioId,
        sitioNombre: 'Pantalla compalfa',
        inicio: enDias(INI),
        fin: enDias(FIN),
      }),
    ])
    // La campaña rival no viaja: ni su id ni su nombre.
    expect(JSON.stringify(r.datos.avisosCompetencia)).not.toContain(campanaCoca)
    expect(JSON.stringify(r.datos.avisosCompetencia)).not.toContain('Navidad Coca')
    expect(await marcaGuardada(r.datos.id)).toBe('Pepsi')
  })

  it('fechas que NO se solapan → 201 sin avisos', async () => {
    const r = await c_fuera()
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.avisosCompetencia).toEqual([])
  })

  it('un sitio sin vallas no avisa (la regla trabaja sobre vallas)', async () => {
    const r = await crear(ca, { marca: 'Pepsi' }, sitioSinValla)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.avisosCompetencia).toEqual([])
  })

  it('marca vacía → cuenta el NOMBRE DEL CLIENTE, y se guarda NULL', async () => {
    const r = await crear(ca, { marca: '   ', clienteId: clientePepsi }, alfa.sitioId)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.marca).toBeNull()
    expect(await marcaGuardada(r.datos.id)).toBeNull()
    expect(r.datos.avisosCompetencia).toHaveLength(1)
    expect(r.datos.avisosCompetencia[0]).toMatchObject({ marca: 'Pepsi', marcaExistente: 'Coca-Cola' })
  })

  it('la misma marca que la reservada no compite consigo misma', async () => {
    const r = await crear(ca, { marca: 'coca cola' }, alfa.sitioId)
    expect(r.status).toBe(201)
    expect(r.datos.avisosCompetencia).toEqual([])
  })

  it('una marca de más de 120 caracteres → 400 y no se guarda nada', async () => {
    const antes = Number((await poolTest().query('select count(*) n from propuestas where tenant_id=$1', [alfa.id])).rows[0].n)
    const r = await crear(ca, { marca: 'x'.repeat(121) }, alfa.sitioId)
    expect(r.status).toBe(400)
    const despues = Number((await poolTest().query('select count(*) n from propuestas where tenant_id=$1', [alfa.id])).rows[0].n)
    expect(despues).toBe(antes)
  })
})

function c_fuera() {
  return ca.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: 'Propuesta fuera',
      marca: 'Pepsi',
      fechaInicio: enDias(FIN + 1),
      fechaFin: enDias(FIN + 20),
      items: [{ sitioId: alfa.sitioId, precio: 45_000 }],
    },
  })
}

describe('después de crear', () => {
  it('agregar el sitio con valla avisa', async () => {
    const p = await crear(ca, { marca: 'Pepsi' }, sitioSinValla)
    expect(p.datos.avisosCompetencia).toEqual([])
    const r = await ca.pedir(`/api/propuestas/${p.datos.id}/items/`, {
      cuerpo: { items: [{ sitioId: alfa.sitioId, precio: 45_000 }] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.avisosCompetencia).toHaveLength(1)
    expect(r.datos.avisosCompetencia[0]).toMatchObject({ sitioId: alfa.sitioId, marcaExistente: 'Coca-Cola' })
  })

  it('editar la marca la guarda y recalcula el aviso; vaciarla la quita', async () => {
    const p = await crear(ca, { marca: 'Nike' }, alfa.sitioId)
    expect(p.datos.avisosCompetencia).toEqual([])
    const e = await ca.pedir(`/api/propuestas/${p.datos.id}/`, { metodo: 'PATCH', cuerpo: { marca: 'Pepsi' } })
    expect(e.status, JSON.stringify(e.datos)).toBe(200)
    expect(e.datos.marca).toBe('Pepsi')
    expect(e.datos.avisosCompetencia).toHaveLength(1)
    // Editar OTRO campo no toca la marca.
    expect((await ca.pedir(`/api/propuestas/${p.datos.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'Otro nombre' } })).status).toBe(200)
    expect(await marcaGuardada(p.datos.id)).toBe('Pepsi')
    const v = await ca.pedir(`/api/propuestas/${p.datos.id}/`, { metodo: 'PATCH', cuerpo: { marca: '' } })
    expect(v.status).toBe(200)
    expect(await marcaGuardada(p.datos.id)).toBeNull()
  })
})

describe('vista previa de la pantalla', () => {
  const previa = (c: Cliente, cuerpo: Record<string, unknown>) =>
    c.pedir('/api/propuestas/competencia/', {
      cuerpo: { fechaInicio: enDias(INI), fechaFin: enDias(FIN), sitioIds: [alfa.sitioId], ...cuerpo },
    })

  it('Pepsi en ese sitio y esas fechas → aviso, sin guardar nada', async () => {
    const antes = Number((await poolTest().query('select count(*) n from propuestas')).rows[0].n)
    const r = await previa(ca, { marca: 'Pepsi' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.avisosCompetencia).toHaveLength(1)
    expect(Number((await poolTest().query('select count(*) n from propuestas')).rows[0].n)).toBe(antes)
  })

  it('marca vacía + cliente → cuenta el cliente', async () => {
    const r = await previa(ca, { marca: '', clienteId: clientePepsi })
    expect(r.datos.avisosCompetencia).toHaveLength(1)
  })

  it('datos mal formados → 400', async () => {
    expect((await previa(ca, { marca: 'Pepsi', sitioIds: ['nope'] })).status).toBe(400)
    expect((await previa(ca, { marca: 'Pepsi', fechaInicio: 'ayer' })).status).toBe(400)
  })

  // 20/11 · una fecha con la forma buena que NO EXISTE pasaba el patrón y
  // llegaba a Postgres: en `/api/vallas/verificar` reventaba con un 500 y en
  // la vista previa se tragaba el error y decía «sin avisos» con un 200 —que
  // es peor: parece que no hay competencia—. Ahora las dos responden 400, con
  // la misma validación que `GET /api/vallas/ocupacion`.
  it('fecha que no existe (2026-13-40, 2026-02-30) → 400 en la vista previa', async () => {
    const r = await previa(ca, { marca: 'Pepsi', fechaInicio: '2026-13-40', fechaFin: '2026-13-41' })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect((await previa(ca, { marca: 'Pepsi', fechaInicio: '2026-02-30', fechaFin: '2026-03-01' })).status).toBe(400)
    expect((await previa(ca, { marca: 'Pepsi', fechaInicio: '2026-02-01', fechaFin: '2026-02-30' })).status).toBe(400)
  })

  // Medido al escribir esta prueba: el 500 que se temía NO salía —Postgres
  // rechazaba la fecha y `respuestaError` traducía su SQLSTATE a un 400 «Fecha
  // fuera de rango»—, pero solo DESPUÉS de leer la base y con otro mensaje que
  // el resto de Vallas. Ahora se corta en la validación, antes de consultar,
  // con el «Fecha inválida» de `GET /api/vallas/ocupacion` (más el nombre del campo).
  it('fecha que no existe → 400 «Fecha inválida» en POST /api/vallas/verificar, antes de tocar la base', async () => {
    const verificar = (fechaInicio: string, fechaFin: string) =>
      ca.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Pepsi', fechaInicio, fechaFin, sitioIds: [alfa.sitioId] } })
    const r = await verificar('2026-13-40', '2026-13-41')
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(r.datos.error).toBe('Fecha de inicio: Fecha inválida')
    const f = await verificar('2026-02-30', '2026-03-01')
    expect(f.status).toBe(400)
    expect(f.datos.error).toBe('Fecha de inicio: Fecha inválida')
    // Y el negativo: con fechas reales sigue respondiendo (y avisando).
    const bien = await verificar(enDias(INI), enDias(FIN))
    expect(bien.status).toBe(200)
    expect(bien.datos.hallazgos).toHaveLength(1)
  })

  it('sin sesión → 401', async () => {
    expect((await previa(new Cliente(), { marca: 'Pepsi' })).status).toBe(401)
  })
})

describe('aislamiento (R2)', () => {
  it('beta, con la MISMA categoría, no ve el choque de alfa ni preguntando por su sitio', async () => {
    const r = await cb.pedir('/api/propuestas/competencia/', {
      cuerpo: { marca: 'Pepsi', fechaInicio: enDias(INI), fechaFin: enDias(FIN), sitioIds: [alfa.sitioId] },
    })
    expect(r.status).toBe(200)
    expect(r.datos.avisosCompetencia).toEqual([])
  })

  it('beta crea Pepsi en SU sitio en las mismas fechas → sin avisos (la Coca-Cola es de alfa)', async () => {
    const r = await crear(cb, { marca: 'Pepsi' }, beta.sitioId)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.avisosCompetencia).toEqual([])
  })

  it('y el aviso vuelve a salir en alfa: el negativo de arriba no es una regla rota', async () => {
    const r = await cb.pedir('/api/propuestas/competencia/', {
      cuerpo: { marca: 'Pepsi', fechaInicio: enDias(INI), fechaFin: enDias(FIN), sitioIds: [beta.sitioId] },
    })
    expect(r.datos.avisosCompetencia).toEqual([])
    const a = await ca.pedir('/api/propuestas/competencia/', {
      cuerpo: { marca: 'Pepsi', fechaInicio: enDias(INI), fechaFin: enDias(FIN), sitioIds: [alfa.sitioId] },
    })
    expect(a.datos.avisosCompetencia).toHaveLength(1)
  })
})

describe('generar la campaña copia la marca', () => {
  it('aprobada → la campaña nace con campanas.marca = la de la propuesta', async () => {
    const p = await crear(ca, { marca: 'Pepsi', clienteId: alfa.clienteId }, alfa.sitioId)
    expect(p.status, JSON.stringify(p.datos)).toBe(201)
    const item = p.datos.items[0].id
    expect((await ca.pedir(`/api/propuestas/items/${item}/`, { metodo: 'PATCH', cuerpo: { aprobado: true } })).status).toBe(200)
    const ap = await ca.pedir(`/api/propuestas/${p.datos.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
    const gen = await ca.pedir(`/api/propuestas/${p.datos.id}/generar-campana/`, { cuerpo: {} })
    expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
    const camp = await poolTest().query('select marca from campanas where propuesta_id = $1', [p.datos.id])
    expect(camp.rows).toEqual([{ marca: 'Pepsi' }])
  })

  it('sin marca → la campaña queda en NULL (la regla usa el cliente)', async () => {
    // El sitio con contrato completo (el de `sembrarTenant`): sin contrato la
    // campaña no se genera (ADR 0003) y la prueba mediría otra cosa.
    const p = await crear(ca, { clienteId: alfa.clienteId }, alfa.sitioId)
    expect(p.status, JSON.stringify(p.datos)).toBe(201)
    const item = p.datos.items[0].id
    expect((await ca.pedir(`/api/propuestas/items/${item}/`, { metodo: 'PATCH', cuerpo: { aprobado: true } })).status).toBe(200)
    expect((await ca.pedir(`/api/propuestas/${p.datos.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })).status).toBe(200)
    expect((await ca.pedir(`/api/propuestas/${p.datos.id}/generar-campana/`, { cuerpo: {} })).status).toBe(200)
    const camp = await poolTest().query('select marca from campanas where propuesta_id = $1', [p.datos.id])
    expect(camp.rows).toEqual([{ marca: null }])
  })
})
