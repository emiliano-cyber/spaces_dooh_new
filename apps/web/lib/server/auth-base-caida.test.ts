import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Las rutas de `app/api/auth/**` con la BASE CAÍDA.
// ----------------------------------------------------------------------------
//  El fallo que lo motiva (2026-09-30): con Postgres apagado, `POST
//  /api/auth/login` respondía 500 CON EL CUERPO VACÍO, y la pantalla de login
//  enseñaba «Failed to execute 'json' on 'Response': Unexpected end of JSON
//  input». La consulta de `auth_usuario_por_email` estaba fuera de cualquier
//  try, así que la excepción de `pg` escapaba del handler y Next contestaba su
//  500 sin cuerpo.
//
//  Lo que se defiende aquí: que TODA ruta de auth que toca la base conteste
//  JSON cuando la base no responde, con 503 y un mensaje en español que no
//  filtra nada de la conexión (ni host, ni puerto, ni el texto de `pg`).
//
//  La base se simula: esto no prueba que Postgres esté caído de verdad —eso lo
//  hace `login-sin-base.e2e.test.ts` con un `next start` apuntado a un puerto
//  cerrado—, prueba lo que el handler hace con la excepción.
// ============================================================================

// La forma REAL del error, medida el 2026-09-30 con `pg` contra un puerto
// cerrado en Node 24: un `AggregateError` con `code: 'ECONNREFUSED'` (un
// intento por familia, ::1 y 127.0.0.1), cuyo `message` va VACÍO. El detalle
// —dirección y puerto— vive en `errors[]`, que es justo lo que no puede salir.
function errorConexionRechazada(): Error {
  const hijo = (addr: string) =>
    Object.assign(new Error(`connect ECONNREFUSED ${addr}:5433`), {
      code: 'ECONNREFUSED', errno: -4078, syscall: 'connect', address: addr, port: 5433,
    })
  return Object.assign(new AggregateError([hijo('::1'), hijo('127.0.0.1')], ''), {
    code: 'ECONNREFUSED',
  })
}

const falla = vi.fn(async (..._a: unknown[]): Promise<any> => {
  throw errorConexionRechazada()
})

vi.mock('@/lib/server/db', () => ({
  qRaw: falla,
  qRaw1: falla,
  q: falla,
  q1: falla,
  qConTenant: falla,
  pool: { query: falla, connect: falla, on: vi.fn() },
}))

// Las rutas de sesión leen la cookie con `cookies()`, que fuera de una petición
// de Next revienta. Se da una cookie de sesión cualquiera para que el handler
// llegue a la base, que es lo que se quiere ver fallar.
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'spaces_sesion' ? { value: 'token-de-prueba' } : undefined) }),
}))

const MENSAJE = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'

let ip = 1
function peticion(ruta: string, cuerpo?: unknown): Request {
  return new Request(`http://127.0.0.1/spaces-dooh${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    // IP distinta por petición: el limitador es por IP y en memoria, y un 429
    // taparía justo lo que se mide.
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.30.0.${ip++}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
}

async function esperar503(res: Response) {
  expect(res.status).toBe(503)
  const texto = await res.text()
  // El cuerpo NO puede ir vacío: es el defecto entero.
  expect(texto.length).toBeGreaterThan(0)
  const datos = JSON.parse(texto)
  expect(datos).toEqual({ error: MENSAJE })
  // Y no filtra nada de la conexión.
  expect(texto).not.toMatch(/ECONNREFUSED|5433|127\.0\.0\.1|::1/)
}

beforeEach(() => {
  falla.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('rutas de auth con la base caída', () => {
  it('POST /api/auth/login responde 503 con JSON, no un 500 vacío', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(peticion('/api/auth/login/', { email: 'a@b.mx', password: 'x' }))
    expect(falla).toHaveBeenCalled()
    await esperar503(res)
  })

  it('el login sigue validando ANTES de tocar la base (400 sin credenciales)', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(peticion('/api/auth/login/', { email: 'a@b.mx' }))
    expect(res.status).toBe(400)
    expect(falla).not.toHaveBeenCalled()
  })

  it('POST /api/auth/codigo responde 503 con JSON', async () => {
    const { POST } = await import('@/app/api/auth/codigo/route')
    await esperar503(await POST(peticion('/api/auth/codigo/', { codigo: 'abcd-efgh' })))
  })

  it('GET /api/auth/me con cookie de sesión responde 503 con JSON', async () => {
    const { GET } = await import('@/app/api/auth/me/route')
    await esperar503(await GET())
  })

  it('POST /api/auth/logout con cookie de sesión responde 503 con JSON', async () => {
    const { POST } = await import('@/app/api/auth/logout/route')
    await esperar503(await POST())
  })

  it('GET /api/auth/reset?token= responde 503 con JSON', async () => {
    const { GET } = await import('@/app/api/auth/reset/route')
    await esperar503(await GET(peticion('/api/auth/reset/?token=abc')))
  })

  it('POST /api/auth/reset responde 503 con JSON', async () => {
    const { POST } = await import('@/app/api/auth/reset/route')
    await esperar503(await POST(peticion('/api/auth/reset/', { token: 'abc', password: 'Una-Clave-Larga-1' })))
  })
})
