import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
//  NEXT_PUBLIC_RECUPERAR_PASSWORD=0 apaga PEDIR un enlace, no USARLO (ADR 0044).
// ----------------------------------------------------------------------------
//  Las instancias nacen con la bandera en 0 (`infra/env/app.env.example`). Hasta
//  el 06/10 bloqueaba también `/api/auth/reset`, y con eso la invitación de un
//  usuario nuevo —un enlace que emite un ADMINISTRADOR con sesión— moría con un
//  503 en todas las instancias.
//
//  La bandera existe para que nadie de fuera pueda generar enlaces sin correo
//  saliente. Eso lo cierra `/api/auth/forgot`, que es el único emisor público:
//  con él apagado, los únicos tokens que existen los creó alguien con sesión.
//  Así que el emisor público sigue apagado (caso negativo, el primero) y el
//  consumidor ya no.
//
//  Y lo que ESTE cambio no toca: crearInvitacion y crearReset escriben la MISMA
//  tabla, así que la vigencia es lo que los distingue —60 min contra 72 h—.
// ============================================================================

const tokenResetValido = vi.fn(async () => true)
const consumirReset = vi.fn(async () => undefined)
const crearReset = vi.fn(async () => null)
vi.mock('@/lib/server/password-reset-repo', () => ({
  tokenResetValido: (...a: unknown[]) => tokenResetValido(...(a as [])),
  consumirReset: (...a: unknown[]) => consumirReset(...(a as [])),
  crearReset: (...a: unknown[]) => crearReset(...(a as [])),
}))

let ip = 1
function peticion(ruta: string, cuerpo?: unknown): Request {
  return new Request(`http://127.0.0.1/spaces-dooh${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.44.0.${ip++}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
}

const antes = process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD
beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD = '0'
})
afterEach(() => {
  if (antes === undefined) delete process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD
  else process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD = antes
})

describe('con la bandera en 0', () => {
  it('PEDIR un enlace desde el login sigue apagado (503) y no emite nada', async () => {
    const { POST } = await import('@/app/api/auth/forgot/route')
    const res = await POST(peticion('/api/auth/forgot/', { email: 'a@b.mx' }))
    expect(res.status).toBe(503)
    expect(crearReset).not.toHaveBeenCalled()
  })

  it('COMPROBAR un enlace funciona: la invitación se puede abrir', async () => {
    const { GET } = await import('@/app/api/auth/reset/route')
    const res = await GET(peticion('/api/auth/reset/?token=tok123'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ valido: true })
    expect(tokenResetValido).toHaveBeenCalledWith('tok123')
  })

  it('USAR un enlace funciona: la persona invitada elige su contraseña', async () => {
    const { POST } = await import('@/app/api/auth/reset/route')
    const res = await POST(peticion('/api/auth/reset/', { token: 'tok123', password: 'Elegida123' }))
    expect(res.status).toBe(200)
    expect(consumirReset).toHaveBeenCalledWith('tok123', 'Elegida123')
  })
})
