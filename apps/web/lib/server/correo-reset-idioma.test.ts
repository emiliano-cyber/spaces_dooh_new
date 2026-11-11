import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ============================================================================
//  Cierre de idiomas (04/11) · el correo de RESTABLECER LA CONTRASENA sale en
//  el idioma de la instancia (ADR 0049), como la invitacion.
// ----------------------------------------------------------------------------
//  `/api/auth/forgot` es ruta de autenticacion (ROJO). Lo unico que cambia es
//  el asunto y el cuerpo del correo; lo que este archivo ata ademas es que lo
//  demas NO cambio:
//
//   · En una instancia `es` el correo sale BYTE A BYTE como en `cb116dde`
//     (hash medido antes del cambio).
//   · La respuesta es la MISMA en los tres idiomas y exista o no el correo:
//     no revela nada (anti-enumeracion). El mensaje sigue en espanol, como
//     siempre; lo traduce I18N-05 en el cliente.
//   · Si el correo no existe, ni se pregunta el idioma ni se manda nada.
//   · Si leer el idioma falla (fail-closed: `idiomaDeLaInstancia` LANZA), la
//     respuesta sigue siendo la misma y el correo no sale: nunca en otro idioma.
// ============================================================================

vi.mock('server-only', () => ({}))

const crearReset = vi.fn()
vi.mock('@/lib/server/password-reset-repo', () => ({
  crearReset: (...a: unknown[]) => crearReset(...a),
}))

const enviarEmail = vi.fn(async (_o: { to: string; subject: string; html: string }) => undefined)
vi.mock('@/lib/server/email', async (original) => ({
  ...(await original<typeof import('@/lib/server/email')>()),
  emailHabilitado: () => true,
  enviarEmail: (o: { to: string; subject: string; html: string }) => enviarEmail(o),
}))

const idiomaDeLaInstancia = vi.fn(async () => 'es')
vi.mock('@/lib/server/idioma-instancia', () => ({
  idiomaDeLaInstancia: () => idiomaDeLaInstancia(),
}))

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
// Medido sobre `cb116dde` con `htmlCorreoReset('Ana', <este enlace>)`.
const HASH_ES = 'b1d89817477e263238e21edd81975560fb6128cee119cd31f213bc27a1507b30'
const MENSAJE = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.'

let ip = 1
function pedir(email: string): Request {
  return new Request('http://127.0.0.1/spaces-dooh/api/auth/forgot/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.71.0.${ip++}` },
    body: JSON.stringify({ email }),
  })
}

let n = 0
beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD
  delete process.env.APP_URL
  // Un correo distinto por prueba: el limite por correo es de 3 por hora.
  n++
  crearReset.mockImplementation(async (email: string) => ({ token: 'tok-1', email, nombre: 'Ana' }))
})

async function post(email = `ana${n}@x.mx`) {
  const { POST } = await import('@/app/api/auth/forgot/route')
  const res = await POST(pedir(email))
  return { status: res.status, cuerpo: await res.json() }
}

describe('el correo de restablecer, en el idioma de la instancia', () => {
  it('es: asunto y cuerpo byte a byte como antes', async () => {
    idiomaDeLaInstancia.mockResolvedValue('es')
    await post()
    expect(enviarEmail).toHaveBeenCalledTimes(1)
    const o = enviarEmail.mock.calls[0][0]
    expect(o.subject).toBe('Restablece tu contraseña · Space OS')
    expect(h(o.html)).toBe(HASH_ES)
  })

  it('en: en ingles, sin una frase espanola', async () => {
    idiomaDeLaInstancia.mockResolvedValue('en')
    await post()
    const o = enviarEmail.mock.calls[0][0]
    expect(o.subject).toBe('Reset your password · Space OS')
    expect(o.html).toContain('Hi Ana, we received a request to reset')
    expect(o.html).toContain('http://127.0.0.1/spaces-dooh/recuperar/tok-1')
    for (const p of ['Hola', 'contraseña', 'Haz clic', 'enlace']) expect(o.html).not.toContain(p)
  })

  it('it: en italiano, sin ingles ni espanol', async () => {
    idiomaDeLaInstancia.mockResolvedValue('it')
    await post()
    const o = enviarEmail.mock.calls[0][0]
    expect(o.subject).toBe('Reimposta la tua password · Space OS')
    expect(o.html).toContain('Ciao Ana, abbiamo ricevuto una richiesta')
    for (const p of ['Hola', 'contraseña', 'Haz clic', 'Reset your', 'If you', 'Hi Ana']) expect(o.html).not.toContain(p)
  })
})

describe('lo demas de la ruta NO cambia', () => {
  it.each(['es', 'en', 'it'] as const)('%s: la respuesta es la de siempre, exista o no el correo', async (idioma) => {
    idiomaDeLaInstancia.mockResolvedValue(idioma)
    const existe = await post()
    crearReset.mockResolvedValueOnce(null)
    const noExiste = await post(`nadie${n}@x.mx`)
    expect(existe).toEqual({ status: 200, cuerpo: { ok: true, mensaje: MENSAJE } })
    expect(noExiste).toEqual(existe)
  })

  it('si el correo no existe, ni se lee el idioma ni sale nada', async () => {
    crearReset.mockResolvedValueOnce(null)
    await post()
    expect(enviarEmail).not.toHaveBeenCalled()
    expect(idiomaDeLaInstancia).not.toHaveBeenCalled()
  })

  it('si leer el idioma falla, el correo NO sale en otro idioma y la respuesta no cambia', async () => {
    idiomaDeLaInstancia.mockRejectedValueOnce(new Error('base caida'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await post()
    err.mockRestore()
    expect(enviarEmail).not.toHaveBeenCalled()
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, mensaje: MENSAJE } })
  })
})
