import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El almacén por TIPO de artículo, contra Postgres real. Pedido del dueño
//  2026-09-30: «camionetas, herramientas, pantallas, cámaras, etc.».
// ----------------------------------------------------------------------------
//  Lo que estas pruebas miden y las unitarias NO pueden:
//
//   1. **Que el `?tipo=` del servidor agrupa igual que la pantalla.** OTRO es
//      «todo lo que no es de los demás», incluido el texto libre que la ruta
//      aceptaba antes de hoy. Eso vive en SQL (`<> all($1)`) y solo se ve
//      contra una base.
//   2. **El AISLAMIENTO del filtro.** Las dos organizaciones dan de alta el
//      MISMO tipo con la MISMA etiqueta: si el filtro se saltara la RLS, el
//      síntoma sería una camioneta «de más», indistinguible de haber comprado
//      dos.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente

const alta = (cli: Cliente, cuerpo: Record<string, unknown>) => cli.pedir('/api/almacen/', { cuerpo })
const lista = (cli: Cliente, tipo?: string) => cli.pedir(`/api/almacen/${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''}`)

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('alma')
  orgB = await sembrarTenant('almb')

  // Una fila de ANTES del 30/09, con texto libre en el tipo: la ruta lo
  // aceptaba. Se inserta directo porque la ruta de hoy ya no lo deja entrar.
  await poolTest().query(
    `insert into almacen_activos (etiqueta, descripcion, tipo_activo, tenant_id)
     values ('LEG-1','Fila vieja','Pantalla LED',$1)`,
    [orgA.id],
  )

  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('1 · alta por tipo', () => {
  it('las dos organizaciones dan de alta una camioneta con la MISMA etiqueta', async () => {
    const ra = await alta(a, { etiqueta: 'VEH-01', descripcion: 'Camioneta NP300', tipoActivo: 'VEHICULO' })
    const rb = await alta(b, { etiqueta: 'VEH-01', descripcion: 'Camioneta NP300', tipoActivo: 'VEHICULO' })
    expect(ra.status).toBe(201)
    expect(rb.status).toBe(201)
    expect(ra.datos.tipoActivo).toBe('VEHICULO')
    expect(ra.datos.estado).toBe('EN_ALMACEN')
  })

  it('A da de alta también una herramienta y una cámara', async () => {
    expect((await alta(a, { etiqueta: 'HER-01', descripcion: 'Taladro', tipoActivo: 'HERRAMIENTA' })).status).toBe(201)
    expect((await alta(a, { etiqueta: 'CAM-01', descripcion: 'Cámara PTZ', tipoActivo: 'CAMARA' })).status).toBe(201)
  })

  it('NEGATIVO · un tipo fuera del catálogo da 400 y no crea nada', async () => {
    const r = await alta(a, { etiqueta: 'X-1', descripcion: 'x', tipoActivo: 'Pantalla LED' })
    expect(r.status).toBe(400)
    const { rows } = await poolTest().query(`select count(*)::int n from almacen_activos where etiqueta = 'X-1'`)
    expect(rows[0].n).toBe(0)
  })

  it('NEGATIVO · un tenantId en el cuerpo da 400: el tenant sale de la sesión', async () => {
    const r = await alta(a, { etiqueta: 'X-2', descripcion: 'x', tipoActivo: 'OTRO', tenantId: orgB.id })
    expect(r.status).toBe(400)
  })
})

describe('2 · el filtro por tipo', () => {
  it('?tipo=VEHICULO da SOLO la camioneta propia, no la de la otra organización', async () => {
    const r = await lista(a, 'VEHICULO')
    expect(r.status).toBe(200)
    expect(r.datos.activos.map((x: { etiqueta: string }) => x.etiqueta)).toEqual(['VEH-01'])
    const rb = await lista(b, 'VEHICULO')
    expect(rb.datos.activos).toHaveLength(1)
  })

  it('?tipo=OTRO incluye la fila vieja con texto libre', async () => {
    const r = await lista(a, 'OTRO')
    expect(r.status).toBe(200)
    expect(r.datos.activos.map((x: { etiqueta: string }) => x.etiqueta)).toEqual(['LEG-1'])
    // La otra organización no tiene filas «otro»: la de A no se le cuela.
    expect((await lista(b, 'OTRO')).datos.activos).toEqual([])
  })

  it('sin filtro, A ve sus cuatro artículos y B su único', async () => {
    expect((await lista(a)).datos.activos).toHaveLength(4)
    expect((await lista(b)).datos.activos).toHaveLength(1)
  })

  it('NEGATIVO · un ?tipo mal escrito da 400, no una lista vacía', async () => {
    expect((await lista(a, 'CAMIONETA')).status).toBe(400)
  })
})

describe('3 · lo que el almacén hacía antes sigue igual', () => {
  it('mover un artículo de A desde la sesión de B da 404 y no lo toca', async () => {
    const { rows } = await poolTest().query(
      `select id from almacen_activos where etiqueta = 'HER-01' and tenant_id = $1`,
      [orgA.id],
    )
    const r = await b.pedir(`/api/almacen/${rows[0].id}/movimiento/`, { cuerpo: { tipo: 'BAJA' } })
    expect(r.status).toBe(404)
    const d = await poolTest().query('select estado from almacen_activos where id = $1', [rows[0].id])
    expect(d.rows[0].estado).toBe('EN_ALMACEN')
  })

  it('el dueño sí lo da de baja', async () => {
    const { rows } = await poolTest().query(
      `select id from almacen_activos where etiqueta = 'HER-01' and tenant_id = $1`,
      [orgA.id],
    )
    const r = await a.pedir(`/api/almacen/${rows[0].id}/movimiento/`, { cuerpo: { tipo: 'BAJA' } })
    expect(r.status).toBe(200)
    expect(r.datos.estado).toBe('BAJA')
  })
})
