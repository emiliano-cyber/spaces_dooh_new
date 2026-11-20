import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  LIGA + PLANO DE VALLAS (dueño, 20/11) · «En la liga que se le manda al
//  cliente también debe estar, si es valla, cómo se ven las pantallas que
//  rentará, si es más de 1; si solo es una, sin tema». Contra Postgres y Next
//  reales, sobre `GET /api/propuestas/publica/<token>` (campo `planoVallas`).
//
//   · Más de una valla activa entre los sitios de la propuesta → el plano,
//     con número, medida, cara, posición, grupo y esquina; ids OPACOS.
//   · Una sola (la otra de baja) → la respuesta NO trae el campo.
//   · R2 (negativos): las vallas de otra organización no salen con este
//     token ni al revés; un token inventado da 404 sin plano; el sitio fuera
//     de la propuesta donde sigue un grupo NO se nombra; nada de marcas,
//     campañas, notas, uuids de vallas/grupos ni el tenant en el texto crudo.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let sitio2: string
let sitioFuera: string
let grupoId: string
let tokenVarias: string
let tokenUna: string
let tokenBeta: string
const uuidsVallas: string[] = []

async function liga(token: string) {
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/`)
  const texto = await r.text()
  let datos: any = null
  try {
    datos = JSON.parse(texto)
  } catch {
    datos = texto
  }
  return { status: r.status, datos, texto }
}

async function sitioNuevo(tenantId: string, nombre: string, clave: string): Promise<string> {
  const r = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion)
     values ($1, $2, $3, 'VALLA', 'DISPONIBLE', 'Coyoacán', 'CDMX', 30000, 30000, $4, 'fijo')
     returning id`,
    [nombre, clave, `${clave}-PROV`, tenantId],
  )
  return r.rows[0].id
}

async function valla(
  tenantId: string,
  sitioId: string,
  numero: string,
  o: { cara?: number; grupo?: string; posicion?: number; dobla?: string; activo?: boolean; notas?: string; ancho?: number } = {},
) {
  const r = await poolTest().query(
    `insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m, cara, grupo_id, posicion, dobla, activo, notas)
     values ($1,$2,$3,$4,3,$5,$6,$7,$8,$9,$10) returning id`,
    [tenantId, sitioId, numero, o.ancho ?? 6, o.cara ?? null, o.grupo ?? null, o.posicion ?? null, o.dobla ?? null, o.activo ?? true, o.notas ?? null],
  )
  uuidsVallas.push(r.rows[0].id)
}

async function crearPropuesta(c: Cliente, clienteId: string, nombre: string, sitios: string[]) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId,
      nombre,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: sitios.map((sitioId) => ({
        sitioId,
        precio: 45000,
        unidad: 'mensual',
        tarifaUnitaria: 45000,
        cantidad: 1,
      })),
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.tokenPublico as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('ligavalla-alfa')
  beta = await sembrarTenant('ligavalla-beta')
  const p = poolTest()

  sitio2 = await sitioNuevo(alfa.id, 'Muro Norte Alfa', 'LVA-002')
  sitioFuera = await sitioNuevo(alfa.id, 'Sitio Fuera Secreto', 'LVA-003')
  const g = await p.query(
    `insert into vallas_grupos (tenant_id, numero, nombre, modo) values ($1, 'G-LA', 'Muro largo', 'una_imagen') returning id`,
    [alfa.id],
  )
  grupoId = g.rows[0].id

  // Sitio 1 (en la propuesta): dos vallas del grupo, la primera dobla.
  await valla(alfa.id, alfa.sitioId, 'LA-001', { cara: 1, grupo: grupoId, posicion: 1, dobla: 'derecha', notas: 'NOTA-SECRETA' })
  await valla(alfa.id, alfa.sitioId, 'LA-002', { cara: 1, grupo: grupoId, posicion: 2 })
  // Sitio 2 (en la propuesta): una activa y una DE BAJA.
  await valla(alfa.id, sitio2, 'LA-003', { ancho: 12 })
  await valla(alfa.id, sitio2, 'LA-BAJA', { activo: false })
  // Sitio fuera de la propuesta: el grupo SIGUE aquí.
  await valla(alfa.id, sitioFuera, 'LA-FUERA', { grupo: grupoId, posicion: 3 })

  // Beta: dos vallas en su sitio.
  await valla(beta.id, beta.sitioId, 'LB-SECRETA-1')
  await valla(beta.id, beta.sitioId, 'LB-SECRETA-2')

  // Una campaña de OTRA marca reservando el sitio 1 (más adelante): la liga no
  // la puede enseñar.
  const k = await p.query(
    `insert into campanas (nombre, cliente_id, marca, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ('CampanaAjenaXYZ', $1, 'MarcaAjenaXYZ', 'OOH'::tipo_campana, $2, $3, 'CONFIRMADA', $4) returning id`,
    [alfa.clienteId, enDias(100), enDias(120), alfa.id],
  )
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,$3,$4,1000,'CONFIRMADA',$5)`,
    [k.rows[0].id, alfa.sitioId, enDias(100), enDias(120), alfa.id],
  )

  await arrancarServidor()
  const dueno = new Cliente()
  const duenoBeta = new Cliente()
  await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await duenoBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  tokenVarias = await crearPropuesta(dueno, alfa.clienteId, 'Propuesta varias vallas', [alfa.sitioId, sitio2])
  tokenUna = await crearPropuesta(dueno, alfa.clienteId, 'Propuesta una valla', [sitio2])
  tokenBeta = await crearPropuesta(duenoBeta, beta.clienteId, 'Propuesta Beta', [beta.sitioId])
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('1 · con más de una valla, la liga trae el plano', () => {
  it('los cuadros de los sitios de la propuesta, con número, medida, cara, grupo y esquina', async () => {
    const r = await liga(tokenVarias)
    expect(r.status, r.texto).toBe(200)
    const pv = r.datos.planoVallas
    expect(pv).toBeTruthy()
    expect(pv.vallas.map((v: any) => v.numero)).toEqual(['LA-001', 'LA-002', 'LA-003'])
    expect(pv.sitios.map((s: any) => s.nombre).sort()).toEqual(['Muro Norte Alfa', 'Pantalla ligavalla-alfa'].sort())
    const [v1, v2, v3] = pv.vallas
    expect(v1).toMatchObject({ sitioId: alfa.sitioId, cara: 1, ancho: 6, alto: 3, posicion: 1, dobla: 'derecha' })
    expect(v2).toMatchObject({ sitioId: alfa.sitioId, cara: 1, posicion: 2, dobla: null })
    expect(v3).toMatchObject({ sitioId: sitio2, cara: null, ancho: 12, grupoId: null })
    expect(v1.grupoId).toBe(v2.grupoId)
    expect(pv.grupos).toEqual([{ id: v1.grupoId, numero: 'G-LA', nombre: 'Muro largo', modo: 'una_imagen', sigueFuera: true }])
  })

  it('el resto de la liga no cambia (mismos campos de siempre más `planoVallas`)', async () => {
    const r = await liga(tokenVarias)
    expect(r.datos.items.map((i: any) => i.sitioId).sort()).toEqual([alfa.sitioId, sitio2].sort())
  })

  it('NEGATIVO · ni marcas ni campañas ni notas ni el sitio de fuera ni la de baja', async () => {
    const { texto } = await liga(tokenVarias)
    expect(texto).not.toMatch(/MarcaAjenaXYZ|CampanaAjenaXYZ|NOTA-SECRETA|Sitio Fuera Secreto|LA-FUERA|LA-BAJA/)
    expect(texto).not.toContain(sitioFuera)
  })

  it('NEGATIVO · ningún uuid de valla ni de grupo, ni el tenant', async () => {
    const { texto } = await liga(tokenVarias)
    for (const u of uuidsVallas) expect(texto).not.toContain(u)
    expect(texto).not.toContain(grupoId)
    expect(texto).not.toContain(alfa.id)
  })
})

describe('2 · con una sola valla (la otra de baja), la liga queda como estaba', () => {
  it('sin el campo `planoVallas`', async () => {
    const r = await liga(tokenUna)
    expect(r.status).toBe(200)
    expect(r.datos).not.toHaveProperty('planoVallas')
    expect(r.texto).not.toContain('LA-003')
  })
})

describe('3 · R2 · otra organización y tokens falsos', () => {
  it('el token de beta ve SUS vallas y ninguna de alfa', async () => {
    const r = await liga(tokenBeta)
    expect(r.status).toBe(200)
    expect(r.datos.planoVallas.vallas.map((v: any) => v.numero)).toEqual(['LB-SECRETA-1', 'LB-SECRETA-2'])
    expect(r.texto).not.toMatch(/LA-0|G-LA|Muro/)
  })

  it('el token de alfa no trae ninguna valla de beta', async () => {
    expect((await liga(tokenVarias)).texto).not.toContain('LB-SECRETA')
  })

  it('NEGATIVO · un token inventado o mal formado: 404 y sin plano', async () => {
    for (const tok of [randomBytes(24).toString('hex'), 'abc', `${tokenVarias}'--`]) {
      const r = await liga(tok)
      expect(r.status).toBe(404)
      expect(r.texto).not.toMatch(/LA-0|LB-SECRETA|planoVallas/)
    }
  })
})
