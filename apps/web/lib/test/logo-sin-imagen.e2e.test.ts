import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  Hallazgo B (19/11) · la liga pública de una organización SIN logo pintaba
//  un icono de imagen rota: `logo_token` existe siempre (NOT NULL) y el
//  membrete armaba `/api/logo/<token>`, que da 404 sin imagen. Contra Postgres
//  y Next reales: sin logo, `orgLogoUrl` es null; con logo, la URL sirve 200.
// ============================================================================

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let org: Awaited<ReturnType<typeof sembrarTenant>>
let token: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('logoalfa')
  await poolTest().query('update config_negocio set logo_url = null where tenant_id = $1', [org.id])
  await arrancarServidor()
  const dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  const r = await dueno.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId: org.clienteId,
      nombre: 'Propuesta sin logo',
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [{ sitioId: org.sitioId, precio: 45000, unidad: 'mensual', tarifaUnitaria: 45000, cantidad: 1 }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  token = r.datos.tokenPublico
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function liga() {
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/`)
  expect(r.status).toBe(200)
  return r.json()
}

describe('el membrete de la liga pública y el logo', () => {
  it('sin logo cargado no manda URL de logo (nada de <img> roto)', async () => {
    const d = await liga()
    expect(d.orgLogoUrl).toBeNull()
  })

  it('con logo cargado manda la URL, y la URL sirve la imagen', async () => {
    await poolTest().query('update config_negocio set logo_url = $2 where tenant_id = $1', [org.id, LOGO])
    const d = await liga()
    expect(d.orgLogoUrl).toMatch(/^\/spaces-dooh\/api\/logo\/[A-Za-z0-9_-]+\/$/)
    const img = await fetch(`${BASE}${d.orgLogoUrl.replace(/^\/spaces-dooh/, '')}`)
    expect(img.status).toBe(200)
    expect(img.headers.get('content-type')).toBe('image/png')
  })
})
