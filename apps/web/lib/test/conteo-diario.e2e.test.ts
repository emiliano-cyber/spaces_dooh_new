import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { hoyDeVigencia, zonaDelNegocio } from '@/lib/propuesta-vigencia'
import { ventanaDeDias, type ConteoDiario } from '@/lib/propuestas-por-dia'

// ============================================================================
//  CONTEO-DIA (17/11) · `GET /api/propuestas/conteo-diario`: cuántas campañas
//  creó y cuántas le aprobaron a cada vendedor, día por día.
// ----------------------------------------------------------------------------
//  Toca sesión y tenant, que es justo lo que las unitarias no ven. Lo que se
//  mide aquí, contra Postgres y con el rol de la aplicación (RLS de verdad):
//
//   1. El VENDEDOR ve solo lo suyo, aunque pida lo de otro por la URL. El
//      filtro sale de la sesión; si saliera del parámetro, el fallo no daría
//      error: daría las cifras del compañero en una tarjeta que se lee bien.
//   2. El GERENTE (quien tiene `comercial.aprobar`) ve a todos, y el total
//      cuadra con la suma de las filas.
//   3. Nada de otra organización entra en la cuenta. Beta siembra lo MISMO que
//      alfa: si el aislamiento fallara, el síntoma sería el doble, no un nombre raro.
//   4. El día se corta en la zona del NEGOCIO: lo de las 23:30 de Ciudad de
//      México es de ese día, aunque en UTC ya sea el siguiente.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
const cli: Record<'ana' | 'beto' | 'gerente' | 'dueno' | 'betaDueno', Cliente> = {} as never
const ids: Record<string, string> = {}

const HOY = hoyDeVigencia()
const VENTANA = ventanaDeDias(HOY, 30)
const ZONA = zonaDelNegocio()
// Tres días antes de hoy: dentro de la ventana y lejos de sus bordes.
const DIA = ventanaDeDias(HOY, 4).desde
const AYER = ventanaDeDias(HOY, 2).desde

let folio = 0

async function usuario(tenantId: string, nombre: string, rol: string): Promise<{ id: string; email: string }> {
  const email = `${nombre.toLowerCase()}@${tenantId.slice(0, 8)}.test`
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3::rol_demo,$4,true,$5) returning id`,
    [nombre, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )
  return { id: r.rows[0].id, email }
}

// Una propuesta con sus dos fechas puestas a mano. `hora` es la hora LOCAL del
// negocio: la base la convierte a instante con la misma zona que usa la app.
async function propuesta(
  org: Awaited<ReturnType<typeof sembrarTenant>>,
  p: { usuarioId: string | null; creada: string; aprobada?: string; estatus?: string; hora?: string },
): Promise<void> {
  folio++
  await poolTest().query(
    `insert into propuestas (folio, nombre, cliente_id, usuario_id, estatus, creado_en, aprobada_en, tenant_id)
     values ($1, $2, $3, $4, $5::est_propuesta,
             ($6::date + $7::time) at time zone $8,
             case when $9::date is null then null else ($9::date + time '12:00') at time zone $8 end,
             $10)`,
    [
      `CD-${org.slug}-${folio}`,
      `Propuesta ${folio}`,
      org.clienteId,
      p.usuarioId,
      p.estatus ?? (p.aprobada ? 'APROBADA' : 'ENVIADA'),
      p.creada,
      p.hora ?? '12:00',
      ZONA,
      p.aprobada ?? null,
      org.id,
    ],
  )
}

async function sembrar(org: Awaited<ReturnType<typeof sembrarTenant>>, pref: string) {
  const ana = await usuario(org.id, `Ana${pref}`, 'VENDEDOR')
  const beto = await usuario(org.id, `Beto${pref}`, 'VENDEDOR')
  const gerente = await usuario(org.id, `Gerente${pref}`, 'GERENTE_VENTAS')
  // Ana: dos creadas el DIA, una de ellas aprobada AYER.
  await propuesta(org, { usuarioId: ana.id, creada: DIA })
  await propuesta(org, { usuarioId: ana.id, creada: DIA, aprobada: AYER })
  // Beto: una creada y aprobada el DIA.
  await propuesta(org, { usuarioId: beto.id, creada: DIA, aprobada: DIA })
  // Una histórica, sin vendedor.
  await propuesta(org, { usuarioId: null, creada: DIA })
  // Una de Ana FUERA de la ventana: no cuenta.
  await propuesta(org, { usuarioId: ana.id, creada: ventanaDeDias(HOY, 60).desde })
  return { ana, beto, gerente }
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('cdalfa')
  beta = await sembrarTenant('cdbeta')
  const a = await sembrar(alfa, 'A')
  await sembrar(beta, 'B')
  ids.ana = a.ana.id
  ids.beto = a.beto.id

  await arrancarServidor()
  for (const k of ['ana', 'beto', 'gerente', 'dueno', 'betaDueno'] as const) cli[k] = new Cliente()
  await cli.ana.entrar(a.ana.email, PASSWORD_DEMO)
  await cli.beto.entrar(a.beto.email, PASSWORD_DEMO)
  await cli.gerente.entrar(a.gerente.email, PASSWORD_DEMO)
  await cli.dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cli.betaDueno.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function conteo(c: Cliente, extra = ''): Promise<{ desde: string; hasta: string; soloPropio: boolean; conteo: ConteoDiario }> {
  const r = await c.pedir(`/api/propuestas/conteo-diario/${extra}`)
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r.datos
}

const en = (c: ConteoDiario, dia: string) => c.dias.indexOf(dia)

describe('quién ve qué', () => {
  it('sin fechas, la ventana son los últimos 30 días del negocio', async () => {
    const r = await conteo(cli.gerente)
    expect({ desde: r.desde, hasta: r.hasta }).toEqual(VENTANA)
    expect(r.conteo.dias).toHaveLength(30)
  })

  it('el GERENTE ve a cada vendedor, «sin vendedor» y el total', async () => {
    const { soloPropio, conteo: c } = await conteo(cli.gerente)
    expect(soloPropio).toBe(false)
    expect(c.porVendedor.map((v) => v.nombre)).toEqual(['AnaA', 'BetoA', null])
    expect(c.total.totalCreadas).toBe(4)
    expect(c.total.totalAprobadas).toBe(2)
    expect(c.total.creadas[en(c, DIA)]).toBe(4)
    expect(c.total.aprobadas[en(c, DIA)]).toBe(1)
    expect(c.total.aprobadas[en(c, AYER)]).toBe(1)
  })

  it('el DUEÑO ve lo mismo que el gerente', async () => {
    const { conteo: c } = await conteo(cli.dueno)
    expect(c.total.totalCreadas).toBe(4)
    expect(c.porVendedor).toHaveLength(3)
  })

  it('NEGATIVO · la VENDEDORA ve solo lo suyo: ni a Beto ni «sin vendedor»', async () => {
    const { soloPropio, conteo: c } = await conteo(cli.ana)
    expect(soloPropio).toBe(true)
    expect(c.porVendedor.map((v) => v.id)).toEqual([ids.ana])
    expect(c.total).toMatchObject({ totalCreadas: 2, totalAprobadas: 1 })
  })

  it('NEGATIVO · pedir lo de otro por la URL no sirve: el filtro sale de la sesión', async () => {
    const { conteo: c } = await conteo(cli.ana, `?vendedor=${ids.beto}&usuario=${ids.beto}&usuarioId=${ids.beto}`)
    expect(c.porVendedor.map((v) => v.id)).toEqual([ids.ana])
    expect(c.total.totalCreadas).toBe(2)
  })

  it('NEGATIVO · nada de la otra organización entra en la cuenta', async () => {
    const { conteo: c } = await conteo(cli.betaDueno)
    expect(c.porVendedor.map((v) => v.nombre)).toEqual(['AnaB', 'BetoB', null])
    expect(c.total.totalCreadas).toBe(4)
  })
})

describe('las fechas', () => {
  it('lo creado a las 23:30 del negocio cuenta en ESE día, no en el de UTC', async () => {
    await propuesta(alfa, { usuarioId: ids.beto!, creada: AYER, hora: '23:30' })
    const { conteo: c } = await conteo(cli.beto)
    expect(c.total.creadas[en(c, AYER)]).toBe(1)
    expect(c.total.creadas[en(c, HOY)]).toBe(0)
  })

  it('un rango a la medida se respeta', async () => {
    const r = await conteo(cli.gerente, `?desde=${DIA}&hasta=${DIA}`)
    expect(r.conteo.dias).toEqual([DIA])
    expect(r.conteo.total.creadas).toEqual([4])
  })

  it('más de 92 días → 400', async () => {
    const r = await cli.gerente.pedir(`/api/propuestas/conteo-diario/?desde=2026-01-01&hasta=2026-12-31`)
    expect(r.status).toBe(400)
  })

  it('una fecha que no es fecha → 400', async () => {
    const r = await cli.gerente.pedir(`/api/propuestas/conteo-diario/?desde=ayer&hasta=hoy`)
    expect(r.status).toBe(400)
  })

  it('el 31 de febrero no es un día → 400 (V8 lo aceptaría corrido a marzo)', async () => {
    const r = await cli.gerente.pedir(`/api/propuestas/conteo-diario/?desde=2026-02-01&hasta=2026-02-31`)
    expect(r.status).toBe(400)
  })

  it('un rango al revés → 400', async () => {
    const r = await cli.gerente.pedir(`/api/propuestas/conteo-diario/?desde=${HOY}&hasta=${DIA}`)
    expect(r.status).toBe(400)
  })

  it('sin sesión → 401', async () => {
    const r = await new Cliente().pedir(`/api/propuestas/conteo-diario/`)
    expect(r.status).toBe(401)
  })
})

// ─── CONTEO-DIA, tarea 5 · el tablero de propuestas por periodo, alineado ───
//
// Decisión del dueño (17/11): si el vendedor solo ve lo suyo en el conteo
// diario, verlo todo en el tablero de Propuestas lo contradice. Hasta hoy
// `/api/propuestas/resumen` le daba a cualquiera con `comercial.ver` el
// «por vendedor» del equipo entero.
describe('el tablero de propuestas por periodo sigue la misma regla', () => {
  const resumen = async (c: Cliente) => {
    const r = await c.pedir(`/api/propuestas/resumen/?periodo=rango&desde=${VENTANA.desde}&hasta=${VENTANA.hasta}`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    return r.datos.resumen as { generadas: number; aprobadas: { n: number }; porVendedor: { vendedor: string }[] }
  }

  it('el GERENTE ve a todo el equipo', async () => {
    const r = await resumen(cli.gerente)
    expect(r.porVendedor.map((v) => v.vendedor).sort()).toEqual(['AnaA', 'BetoA', 'Sin vendedor'])
  })

  it('NEGATIVO · la VENDEDORA ve solo lo suyo, en las filas Y en los totales', async () => {
    const r = await resumen(cli.ana)
    expect(r.porVendedor.map((v) => v.vendedor)).toEqual(['AnaA'])
    expect(r.generadas).toBe(2)
    expect(r.aprobadas.n).toBe(1)
  })
})
