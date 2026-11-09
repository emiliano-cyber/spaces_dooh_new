import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Los avisos por correo de Space Eyes, por la puerta de Space Eye.
// ----------------------------------------------------------------------------
//  Quien opera el inventario cambia la lista de correos y la espera: poner su
//  propio correo para enterarse de una pantalla apagada es parte del trabajo de
//  todos los días.
//
//  La CUENTA del proveedor no. La llave de Resend es una credencial, y si
//  alguien la cambia mal la flota entera se queda sin avisos sin que nada lo
//  diga: no hay error que ver, simplemente no llega nada la noche que una
//  pantalla se apague. Esa es del Dueño, por el mismo criterio que el encuadre.
//
//  Lo que se fija aquí:
//    · `avisos` y `avisos/prueba` pasan; nada más bajo ese nombre;
//    · a quien no encuadra se le QUITAN del cuerpo la llave, el remitente y el
//      borrado, en vez de rechazarle la petición entera (igual que el control
//      del visor se reenvía con `guardar: false`);
//    · al Dueño le pasan intactos;
//    · cambiar la LLAVE queda en la bitácora; cambiar la lista de correos, no.
// ============================================================================

const dueno = { id: 'u-1', nombre: 'Ana', email: 'ana@ejemplo.test', rol: 'DUENO', tenantId: 't-1' }
const opera = { id: 'u-2', nombre: 'Beto', email: 'beto@ejemplo.test', rol: 'OPERACIONES', tenantId: 't-1' }
let usuario = dueno
const exigir = vi.fn(async (..._a: unknown[]) => ({ ok: true, usuario }))
vi.mock('@/lib/server/auth', () => ({ exigir: (...a: unknown[]) => exigir(...a) }))

const reenviar = vi.fn(async (..._a: unknown[]) => new Response('{"ok":true}', { status: 200 }))
vi.mock('@/lib/server/space-eye', () => ({
  spaceEyeHabilitado: () => true,
  reenviarASpaceEye: (...a: unknown[]) => reenviar(...a),
}))

const registrarAccion = vi.fn(async (..._a: unknown[]) => undefined)
vi.mock('@/lib/server/acciones-repo', () => ({
  registrarAccion: (...a: unknown[]) => registrarAccion(...a),
}))

const { GET, PUT, POST } = await import('@/app/api/space-eyes/se/[...ruta]/route')

function peticion(ruta: string, metodo: string, cuerpo?: unknown): Request {
  return new Request(`http://127.0.0.1/spaces-dooh/api/space-eyes/se/${ruta}`, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })
}
const ctx = (ruta: string) => ({ params: { ruta: ruta.split('/') } })
const reenviado = () => JSON.parse(new TextDecoder().decode(reenviar.mock.calls[0][3] as ArrayBuffer))

const COMPLETO = {
  activo: true,
  destinatarios: 'guardia@empresa.test',
  agrupar_min: 15,
  remitente: 'Space Eye <avisos@empresa.test>',
  llave: 're_unaLlaveDeVerdad123',
}

beforeEach(() => {
  vi.clearAllMocks()
  usuario = dueno
})

describe('1 · qué rutas abre', () => {
  it('se pueden leer los avisos', async () => {
    const r = await GET(peticion('avisos', 'GET'), ctx('avisos'))
    expect(r.status).toBe(200)
    expect(exigir).toHaveBeenCalledWith('inventario', 'ver')
  })

  it('cambiarlos exige inventario.crear', async () => {
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(exigir).toHaveBeenCalledWith('inventario', 'crear')
  })

  it('el correo de prueba pasa', async () => {
    const r = await POST(peticion('avisos/prueba', 'POST', {}), ctx('avisos/prueba'))
    expect(r.status).toBe(200)
    expect(reenviar.mock.calls[0][1]).toBe('avisos/prueba')
  })

  it('cualquier otra cosa bajo avisos no existe', async () => {
    const r = await GET(peticion('avisos/destinatarios', 'GET'), ctx('avisos/destinatarios'))
    expect(r.status).toBe(404)
    expect(reenviar).not.toHaveBeenCalled()
  })

  it('un cuerpo que no es JSON es un 400 y no llega a Space Eye', async () => {
    const r = await PUT(peticion('avisos', 'PUT', 'esto no es json'), ctx('avisos'))
    expect(r.status).toBe(400)
    expect(reenviar).not.toHaveBeenCalled()
  })
})

describe('2 · la cuenta del proveedor es del Dueño', () => {
  it('al Dueño le pasa el cuerpo intacto', async () => {
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(reenviado()).toEqual(COMPLETO)
  })

  it('a quien opera se le quitan la llave, el remitente y el borrado', async () => {
    usuario = opera
    const r = await PUT(peticion('avisos', 'PUT', { ...COMPLETO, borrar_llave: true }), ctx('avisos'))
    // No es un 403: cambiar su propio correo de la lista tiene que seguir
    // funcionando, y lo que no le toca simplemente no viaja.
    expect(r.status).toBe(200)
    expect(reenviado()).toEqual({
      activo: true,
      destinatarios: 'guardia@empresa.test',
      agrupar_min: 15,
    })
  })

  it('un rol desconocido tampoco toca la cuenta', async () => {
    usuario = { ...opera, rol: 'LO_QUE_SEA' }
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(reenviado().llave).toBeUndefined()
  })
})

describe('3 · quién tocó la llave queda escrito', () => {
  it('cambiar la llave se registra', async () => {
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(registrarAccion).toHaveBeenCalledWith(
      dueno,
      'Cambió la llave de correo de los avisos de Space Eyes',
      'avisos',
    )
  })

  it('quitarla también', async () => {
    await PUT(peticion('avisos', 'PUT', { ...COMPLETO, llave: '', borrar_llave: true }), ctx('avisos'))
    expect(registrarAccion).toHaveBeenCalledTimes(1)
  })

  it('cambiar solo la lista de correos no llena la bitácora', async () => {
    // La llave viaja vacía en CADA guardado, porque el panel nunca la recibe de
    // vuelta y no tiene qué reenviar. Si eso contara como cambiarla, la
    // bitácora diría que la tocan a diario y no serviría para nada.
    await PUT(peticion('avisos', 'PUT', { ...COMPLETO, llave: '' }), ctx('avisos'))
    expect(registrarAccion).not.toHaveBeenCalled()
  })

  it('si Space Eye lo rechaza, NO se registra como hecho', async () => {
    reenviar.mockResolvedValueOnce(new Response('{"error":"no"}', { status: 400 }))
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(registrarAccion).not.toHaveBeenCalled()
  })

  it('a quien opera no se le registra nada, porque no la tocó', async () => {
    usuario = opera
    await PUT(peticion('avisos', 'PUT', COMPLETO), ctx('avisos'))
    expect(registrarAccion).not.toHaveBeenCalled()
  })
})
