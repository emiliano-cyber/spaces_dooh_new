import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos } from './semillas-e2e'

// ============================================================================
//  20261004_pantallas_digitales_importadas.sql — las pantallas digitales que
//  el importador viejo (antes del 29/09) dejó con su estructura física en
//  `tipo_medio`, y que por eso se reservaban como FIJAS.
// ----------------------------------------------------------------------------
//  Encontrado en DEMO el 2026-10-01: una campaña desde propuesta sobre «Santa
//  Fe Torre Digital» salía OOH. La pantalla tenía `tipo_medio = ESPECTACULAR`,
//  `exhibicion = rotativo`, PROGRAMATICO y 12 slots — exactamente lo que deja
//  el importador viejo.
//
//  Se siembran las filas con esa forma DESPUÉS de `recrearEsquema()` (que ya
//  aplicó la migración sobre una base vacía) y se corre el archivo a mano: es
//  lo que pasa en una instancia que tenía las filas antes de actualizarse.
//
//  Lo que de verdad protege son los NEGATIVOS: un prisma rotativo es una lona
//  y no se toca, y una fija normal tampoco.
// ============================================================================

// Relativa a `apps/web`, desde donde se corren las e2e — como en
// codigo-aprobacion.e2e.test.ts.
const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261004_pantallas_digitales_importadas.sql')

type Fila = { tipo_medio: string; tipo_estructura: string | null }
let ids: Record<string, string> = {}

async function sitio(
  clave: string,
  tenantId: string,
  predioId: string,
  f: { tipoMedio: string; exhibicion: string; comercializacion: string; totalSpots: number | null; estructura: string },
) {
  const r = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, spots_disponibles, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion, comercializacion, tipo_estructura)
     values ($1,$1,$1,$2::tipo_medio,'DISPONIBLE','Cuauhtémoc','CDMX',$3,$3,10000,10000,$4,$5,$6,$7::comercializacion,$8)
     returning id`,
    [clave, f.tipoMedio, f.totalSpots, predioId, tenantId, f.exhibicion, f.comercializacion, f.estructura],
  )
  ids[clave] = r.rows[0].id
}

async function leer(clave: string): Promise<Fila> {
  return (await poolTest().query('select tipo_medio, tipo_estructura from sitios where id=$1', [ids[clave]])).rows[0]
}

const aplicar = () => poolTest().query(readFileSync(MIGRACION, 'utf8'))

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  const a = await sembrarTenant('pdi-a')
  const b = await sembrarTenant('pdi-b')
  const predio = async (sitioId: string) =>
    (await poolTest().query('select predio_id from sitios where id=$1', [sitioId])).rows[0].predio_id as string
  const pa = await predio(a.sitioId)
  const pb = await predio(b.sitioId)
  ids = {}

  // Las dos formas reales que dejó el importador viejo en DEMO.
  await sitio('LED-ESPEC', a.id, pa, { tipoMedio: 'ESPECTACULAR', exhibicion: 'rotativo', comercializacion: 'PROGRAMATICO', totalSpots: 12, estructura: 'Pantalla LED' })
  await sitio('LED-MURAL', a.id, pa, { tipoMedio: 'MURAL', exhibicion: 'rotativo', comercializacion: 'PROGRAMATICO', totalSpots: 12, estructura: 'Pantalla LED fachada' })
  // `exhibicion = 'digital'` es la otra marca que pudo dejar el importador.
  await sitio('MUPI-DIG', a.id, pa, { tipoMedio: 'MOBILIARIO_URBANO', exhibicion: 'digital', comercializacion: 'PROGRAMATICO', totalSpots: 12, estructura: 'Mupi digital' })
  // Otra organización de la misma instancia: también se corrige.
  await sitio('LED-OTRA', b.id, pb, { tipoMedio: 'OTRO', exhibicion: 'rotativo', comercializacion: 'PROGRAMATICO', totalSpots: 12, estructura: 'Pantalla interior' })
  // NEGATIVOS.
  await sitio('PRISMA', a.id, pa, { tipoMedio: 'ESPECTACULAR', exhibicion: 'rotativo', comercializacion: 'TRADICIONAL', totalSpots: null, estructura: 'Prisma rotativo' })
  await sitio('FIJA', a.id, pa, { tipoMedio: 'ESPECTACULAR', exhibicion: 'fijo', comercializacion: 'TRADICIONAL', totalSpots: null, estructura: 'Unipolar' })
  // Rotativo y con slots, pero vendido TRADICIONAL: le falta una de las tres
  // marcas, así que no se adivina.
  await sitio('DUDOSA', a.id, pa, { tipoMedio: 'ESPECTACULAR', exhibicion: 'rotativo', comercializacion: 'TRADICIONAL', totalSpots: 12, estructura: 'Pantalla LED' })

  await aplicar()
}, 120_000)

afterAll(async () => {
  await cerrarPool()
})

describe('20261004 · pantallas digitales importadas antes del 29/09', () => {
  it('la pantalla LED que se guardó como ESPECTACULAR pasa a PANTALLA_DIGITAL', async () => {
    expect((await leer('LED-ESPEC')).tipo_medio).toBe('PANTALLA_DIGITAL')
  })

  it('las otras formas del importador viejo también: MURAL, MOBILIARIO_URBANO con exhibición «digital», OTRO', async () => {
    expect((await leer('LED-MURAL')).tipo_medio).toBe('PANTALLA_DIGITAL')
    expect((await leer('MUPI-DIG')).tipo_medio).toBe('PANTALLA_DIGITAL')
  })

  it('corrige las de TODAS las organizaciones de la instancia', async () => {
    expect((await leer('LED-OTRA')).tipo_medio).toBe('PANTALLA_DIGITAL')
  })

  it('la estructura física no se pierde: sigue en tipo_estructura', async () => {
    expect((await leer('LED-ESPEC')).tipo_estructura).toBe('Pantalla LED')
    expect((await leer('LED-MURAL')).tipo_estructura).toBe('Pantalla LED fachada')
  })

  it('⚠️ un PRISMA rotativo es una lona: no se toca', async () => {
    expect((await leer('PRISMA')).tipo_medio).toBe('ESPECTACULAR')
  })

  it('una fija normal no se toca', async () => {
    expect((await leer('FIJA')).tipo_medio).toBe('ESPECTACULAR')
  })

  it('a la que le falta una de las tres marcas no se le adivina el tipo', async () => {
    expect((await leer('DUDOSA')).tipo_medio).toBe('ESPECTACULAR')
  })

  it('es lo que el booking mira: tras corregir, la regla de campanas-repo la ve digital', async () => {
    // La misma expresión que `generarCampanaDesdePropuesta` y `reservar`.
    const r = await poolTest().query(
      `select (tipo_medio = 'PANTALLA_DIGITAL') as digital from sitios where id = $1`,
      [ids['LED-ESPEC']],
    )
    expect(r.rows[0].digital).toBe(true)
  })

  it('es idempotente: la segunda pasada no cambia nada', async () => {
    const antes = (await poolTest().query('select id, tipo_medio from sitios order by id')).rows
    await aplicar()
    const despues = (await poolTest().query('select id, tipo_medio from sitios order by id')).rows
    expect(despues).toEqual(antes)
  })
})
