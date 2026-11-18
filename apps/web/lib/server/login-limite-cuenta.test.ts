import { describe, it, expect, vi, beforeAll } from 'vitest'
import bcrypt from 'bcryptjs'

// ============================================================================
//  SEG-21OCT — el login limita los intentos FALLIDOS también POR CUENTA, no
//  solo por IP.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. El único límite era `login:<ip>` (10 cada 5 min).
//  Contra una cuenta concreta eso no frena a nadie que cambie de dirección: un
//  bloque IPv6 /64 son millones, y una red de equipos alquilados también. Con
//  la política mínima (8 caracteres, letra y número) un diccionario dirigido
//  contra el correo del Dueño es viable.
//
//  El cubo nuevo es `login:cuenta:<correo normalizado>` y cuenta SOLO los
//  fallos. Las tres propiedades que esta prueba defiende:
//
//    · se bloquea aunque cada intento venga de una IP distinta;
//    · el bloqueo no dice si el correo existe: un correo inventado se bloquea
//      igual y con el mismo texto (si no, sería enumeración gratis);
//    · un login correcto lo vacía, así que equivocarse dos veces al día no
//      acumula para siempre.
//
//  El precio, y se acepta a sabiendas: quien conoce el correo de alguien puede
//  dejarle la CONTRASEÑA sin servir durante la ventana. Google y los códigos de
//  recuperación no pasan por aquí y siguen entrando.
// ============================================================================

const CORRECTA = 'Correcta123'
const { db } = vi.hoisted(() => ({ db: { hash: '' } }))

vi.mock('@/lib/server/db', () => ({
  // `auth_usuario_por_email`: solo existen los correos que acaban en @existe.mx
  qRaw1: vi.fn(async (_sql: string, params: unknown[]) => {
    const email = String(params[0]).trim().toLowerCase()
    if (!email.endsWith('@existe.mx')) return null
    return {
      id: `U-${email}`, nombre: 'Ana', email, cargo: null, rol: 'VENDEDOR',
      activo: true, password_hash: db.hash, tenant_id: 'T1',
    }
  }),
  qConTenant: vi.fn(async () => [{ solo_google: false }]),
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  qRaw: vi.fn(async () => []),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), on: vi.fn() },
}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))

import { POST } from '@/app/api/auth/login/route'

let ip = 1
function intento(email: string, password: string): Promise<Response> {
  // IP distinta en CADA intento: lo que se mide es el cubo por cuenta, y el de
  // IP no debe llegar a saltar nunca en esta prueba.
  const n = ip++
  return POST(
    new Request('http://127.0.0.1/spaces-dooh/api/auth/login/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.77.${n >> 8}.${n & 255}` },
      body: JSON.stringify({ email, password }),
    }),
  )
}

async function fallar(email: string, veces: number) {
  for (let i = 0; i < veces; i++) expect((await intento(email, 'Incorrecta999')).status).toBe(401)
}

beforeAll(async () => {
  db.hash = await bcrypt.hash(CORRECTA, 4)
})

describe('límite de intentos fallidos por cuenta', () => {
  it('tras 10 fallos desde 10 IPs distintas, la cuenta se bloquea — incluso con la contraseña correcta', async () => {
    await fallar('ana@existe.mx', 10)
    const r = await intento('ana@existe.mx', CORRECTA)
    expect(r.status).toBe(429)
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('el correo se normaliza: mayúsculas y espacios caen en el mismo cubo', async () => {
    await fallar('Beto@Existe.MX', 5)
    await fallar('  beto@existe.mx ', 5)
    expect((await intento('BETO@EXISTE.MX', CORRECTA)).status).toBe(429)
  })

  it('un correo que NO existe se bloquea igual y con el mismo texto (no se enumera)', async () => {
    await fallar('carla@existe.mx', 10)
    await fallar('nadie@inventado.mx', 10)
    const real = await intento('carla@existe.mx', CORRECTA)
    const falso = await intento('nadie@inventado.mx', CORRECTA)
    expect(real.status).toBe(429)
    expect(falso.status).toBe(429)
    expect((await falso.json()).error).toBe((await real.json()).error)
  })
})

describe('lo que el límite por cuenta NO bloquea', () => {
  it('nueve fallos no bloquean: el décimo intento con la correcta entra', async () => {
    await fallar('dani@existe.mx', 9)
    expect((await intento('dani@existe.mx', CORRECTA)).status).toBe(200)
  })

  it('un login correcto vacía el contador', async () => {
    await fallar('eva@existe.mx', 9)
    expect((await intento('eva@existe.mx', CORRECTA)).status).toBe(200)
    await fallar('eva@existe.mx', 9)
    expect((await intento('eva@existe.mx', CORRECTA)).status).toBe(200)
  })

  it('un correo que no es texto da 400 con cuerpo, no un 500 vacío', async () => {
    const r = await POST(
      new Request('http://127.0.0.1/spaces-dooh/api/auth/login/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.78.0.1' },
        body: JSON.stringify({ email: 5, password: 'x' }),
      }),
    )
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBeTruthy()
  })

  it('bloquear una cuenta no toca a las demás', async () => {
    await fallar('fer@existe.mx', 10)
    expect((await intento('fer@existe.mx', CORRECTA)).status).toBe(429)
    expect((await intento('gaby@existe.mx', CORRECTA)).status).toBe(200)
  })
})
