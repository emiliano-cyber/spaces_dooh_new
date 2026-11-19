import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  19/11 · «Prospectos nuevos» en el Resumen de Propuestas
//  (`GET /api/propuestas/resumen` → `prospectosNuevos`).
// ----------------------------------------------------------------------------
//  Lo que se demuestra es lo que se IMPIDE: el vendedor no recibe los
//  prospectos de otro vendedor, nadie recibe los de otra organización, y no
//  entran los viejos (más de 7 días), los perdidos ni los que no son de
//  cliente. Quien tiene `comercial.aprobar` recibe los del equipo entero.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let vendedor: Cliente
let gerente: Cliente
let mariana: string
let luis: string

const correo = (q: string) => `${q}@nuevos.test`

async function sembrarUsuario(tenantId: string, nombre: string, quien: string, rol: string) {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )
  return r.rows[0].id as string
}

async function prospecto(
  tenantId: string,
  nombre: string,
  usuarioId: string | null,
  o: { tipo?: string; dias?: number; etapa?: string; contacto?: object; datos?: object } = {},
) {
  // RECHAZADO y APROBADO piden `decidido_en` por constraint; aquí basta PERDIDO.
  await poolTest().query(
    `insert into prospectos (tenant_id, tipo, nombre, usuario_id, etapa, contacto, datos, creado_en)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb, now() - make_interval(hours => $8::int))`,
    [
      tenantId,
      o.tipo ?? 'CLIENTE',
      nombre,
      usuarioId,
      o.etapa ?? 'PROSPECTO',
      JSON.stringify(o.contacto ?? {}),
      JSON.stringify(o.datos ?? {}),
      Math.round((o.dias ?? 0) * 24) + 1,
    ],
  )
}

const nuevos = async (c: Cliente) => {
  const r = await c.pedir('/api/propuestas/resumen/?periodo=mes')
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r.datos.prospectosNuevos as { dias: number; total: number; lista: any[] }
}
const nombres = (n: { lista: any[] }) => n.lista.map((p) => p.nombre)

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('nuevos')
  otra = await sembrarTenant('ajena')
  mariana = await sembrarUsuario(org.id, 'Mariana López', 'v1', 'VENDEDOR')
  luis = await sembrarUsuario(org.id, 'Luis Herrera', 'v2', 'VENDEDOR')
  await sembrarUsuario(org.id, 'Gerente', 'gerente', 'GERENTE_VENTAS')

  await prospecto(org.id, 'Panadería Sol', mariana, {
    dias: 2,
    contacto: { nombre: 'Rosa Díaz', telefono: '5551234567' },
    datos: { razonSocial: 'Panificadora Sol SA de CV' },
  })
  await prospecto(org.id, 'Ferretería Luna', luis, { dias: 1, etapa: 'CONTACTADO' })
  await prospecto(org.id, 'Viejo de Mariana', mariana, { dias: 10 })
  await prospecto(org.id, 'Perdido de Mariana', mariana, { dias: 1, etapa: 'PERDIDO' })
  await prospecto(org.id, 'Predio de Mariana', mariana, { dias: 1, tipo: 'PREDIO' })
  await prospecto(otra.id, 'De otra organización', null, { dias: 0 })

  await arrancarServidor()
  vendedor = await (async () => {
    const c = new Cliente()
    await c.entrar(correo('v1'), PASSWORD_DEMO)
    return c
  })()
  gerente = await (async () => {
    const c = new Cliente()
    await c.entrar(correo('gerente'), PASSWORD_DEMO)
    return c
  })()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('prospectos nuevos en el Resumen', () => {
  it('el vendedor recibe SOLO los suyos: el de otro vendedor no llega', async () => {
    const n = await nuevos(vendedor)
    expect(nombres(n)).toEqual(['Panadería Sol'])
    expect(n.total).toBe(1)
    expect(n.dias).toBe(7)
  })

  it('quien aprueba en Comercial recibe los del equipo, más recientes primero', async () => {
    const n = await nuevos(gerente)
    expect(nombres(n)).toEqual(['Ferretería Luna', 'Panadería Sol'])
    expect(n.lista.map((p) => p.vendedor)).toEqual(['Luis Herrera', 'Mariana López'])
  })

  it('ni viejos, ni perdidos, ni predios, ni de otra organización', async () => {
    const todos = nombres(await nuevos(gerente))
    for (const fuera of ['Viejo de Mariana', 'Perdido de Mariana', 'Predio de Mariana', 'De otra organización']) {
      expect(todos).not.toContain(fuera)
    }
  })

  it('cada uno trae etapa, vendedor, días desde el alta y su contacto', async () => {
    const p = (await nuevos(vendedor)).lista[0]
    expect(p).toMatchObject({
      nombre: 'Panadería Sol',
      etapa: 'PROSPECTO',
      vendedor: 'Mariana López',
      dias: 2,
      contactoNombre: 'Rosa Díaz',
      telefono: '5551234567',
      email: null,
      razonSocial: 'Panificadora Sol SA de CV',
    })
    expect(typeof p.id).toBe('string')
  })
})
