import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiLogin } from './auth-real'

// ============================================================================
//  `apiLogin()` ante respuestas que NO son JSON.
// ----------------------------------------------------------------------------
//  El 2026-09-30 la pantalla de login enseñó, literal, «Failed to execute
//  'json' on 'Response': Unexpected end of JSON input». El servidor había
//  contestado un 500 con el cuerpo vacío (la base estaba caída) y el cliente
//  hacía `res.json()` sin mirar: el `SyntaxError` del navegador subía tal cual
//  hasta el `setError()` de la pantalla.
//
//  Arreglar el servidor no basta: un proxy delante (nginx con un 502 en HTML,
//  un corte de red) puede devolver cualquier cosa. El cliente tiene que decir
//  algo legible pase lo que pase.
// ============================================================================

function respuesta(cuerpo: string, status: number, tipo = 'text/plain'): Response {
  return new Response(cuerpo, { status, headers: { 'content-type': tipo } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiLogin con respuestas raras', () => {
  it('500 con el cuerpo vacío → mensaje legible, no el SyntaxError del navegador', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('', 500)))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e).toBeInstanceOf(Error)
    expect(e.message).not.toMatch(/JSON|json|Unexpected/)
    expect(e.message).toMatch(/no está disponible/)
  })

  it('502 con una página HTML de nginx → mismo mensaje legible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('<html><body>502 Bad Gateway</body></html>', 502, 'text/html')))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e.message).toMatch(/no está disponible/)
    expect(e.message).not.toMatch(/html|Bad Gateway|JSON/)
  })

  it('el 503 del servidor con su JSON → se enseña SU mensaje', async () => {
    const error = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(JSON.stringify({ error }), 503, 'application/json')))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e.message).toBe(error)
  })

  it('el 401 de credenciales sigue enseñando el mensaje del servidor, sin tocarlo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta(JSON.stringify({ error: 'Correo o contraseña inválidos' }), 401, 'application/json')))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e.message).toBe('Correo o contraseña inválidos')
  })

  it('un 4xx sin cuerpo JSON → el genérico de siempre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('', 404)))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e.message).toBe('No se pudo iniciar sesión')
  })

  it('sin red (fetch revienta) → mensaje en español, no «Failed to fetch»', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e.message).not.toMatch(/Failed to fetch/)
    expect(e.message).toMatch(/conectar/)
  })

  it('200 con JSON válido → devuelve los datos tal cual', async () => {
    const datos = { usuario: { id: 'u1' }, permisos: {} }
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(JSON.stringify(datos), 200, 'application/json')))
    expect(await apiLogin('a@b.mx', 'x')).toEqual(datos)
  })

  it('200 con cuerpo que no es JSON → error legible, no SyntaxError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('', 200)))
    const e = await apiLogin('a@b.mx', 'x').catch((x) => x)
    expect(e).toBeInstanceOf(Error)
    expect(e.message).not.toMatch(/JSON|Unexpected/)
  })
})
