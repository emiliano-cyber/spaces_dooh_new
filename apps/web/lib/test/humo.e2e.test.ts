import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Que el servidor de pruebas arranca, habla con la BD de prueba y autentica.
//  Si esto falla, los 14 casos fallan por el andamio y no por el producto.
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('humo')
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('humo del arnés HTTP', () => {
  it('el login rechaza credenciales malas', async () => {
    const c = new Cliente()
    const r = await c.pedir('/api/auth/login/', {
      cuerpo: { email: a.usuarioEmail, password: 'incorrecta' },
    })
    expect(r.status).toBe(401)
  })

  it('el login acepta las buenas y deja sesión utilizable', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    // `/api/auth/me` resuelve con la cookie: si el tarro no funcionara, 401.
    const yo = await c.pedir('/api/auth/me/')
    expect(yo.status).toBe(200)
    expect(yo.datos.usuario.email).toBe(a.usuarioEmail)
  })

  it('sin sesión, una ruta con módulo responde 401', async () => {
    const anon = new Cliente()
    const r = await anon.pedir('/api/estado/')
    expect(r.status).toBe(401)
  })

  it('el servidor habla con la BD de PRUEBA, no con otra', async () => {
    // El canario: el cliente sembrado aquí tiene que verse por la API. Si el
    // servidor apuntara a otra base, esto saldría vacío y las 14 pruebas
    // estarían midiendo datos ajenos.
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const estado = await c.pedir('/api/estado/')
    expect(estado.status).toBe(200)
    const nombres = (estado.datos.clientes ?? []).map((x: any) => x.nombre)
    expect(nombres).toContain(`Cliente humo`)
  })
})
