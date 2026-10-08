import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Las órdenes a un equipo por la puerta de Space Eye (revisión del 06/10).
// ----------------------------------------------------------------------------
//  `devices/<id>/command` estaba en la lista de rutas permitidas y el cuerpo se
//  reenviaba tal cual: el `command_type` lo elegía el navegador. El botón
//  «Reiniciar equipo» (f7ff1404) solo aparece para una Raspberry, pero eso lo
//  decide la PANTALLA; el servidor dejaba pasar cualquier orden que Space Eye
//  entendiera, a cualquier equipo, y ninguna quedaba en la bitácora.
//
//  Lo que se fija aquí:
//    · solo pasan las seis órdenes que la interfaz manda de verdad;
//    · el cuerpo llega a Space Eye intacto (se lee una vez y se reenvía);
//    · las que dejan un equipo sin servicio —reiniciar la app, el equipo o
//      actualizarla— quedan en la bitácora con quién y a qué equipo.
// ============================================================================

const usuario = { id: 'u-1', nombre: 'Ana', email: 'ana@ejemplo.test', rol: 'DUENO', tenantId: 't-1' }
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

const { POST, GET } = await import('@/app/api/space-eyes/se/[...ruta]/route')

function orden(id: string, cuerpo: unknown): Request {
  return new Request(`http://127.0.0.1/spaces-dooh/api/space-eyes/se/devices/${id}/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })
}
const ctx = (id: string) => ({ params: { ruta: ['devices', id, 'command'] } })
const textoReenviado = () => new TextDecoder().decode(reenviar.mock.calls[0][3] as ArrayBuffer)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('1 · solo pasan las órdenes que la interfaz manda', () => {
  it('una orden desconocida es un 400 y no llega a Space Eye', async () => {
    const r = await POST(orden('7', { command_type: 'FACTORY_RESET' }), ctx('7'))
    expect(r.status).toBe(400)
    expect(reenviar).not.toHaveBeenCalled()
  })

  it('un cuerpo que no es JSON es un 400 y no llega a Space Eye', async () => {
    const r = await POST(orden('7', 'esto no es json'), ctx('7'))
    expect(r.status).toBe(400)
    expect(reenviar).not.toHaveBeenCalled()
  })

  it('sin command_type es un 400', async () => {
    const r = await POST(orden('7', { payload: {} }), ctx('7'))
    expect(r.status).toBe(400)
    expect(reenviar).not.toHaveBeenCalled()
  })

  it.each(['TAKE_PHOTO', 'START_STREAM', 'STOP_STREAM', 'REBOOT_APP', 'UPDATE_APP', 'REBOOT_DEVICE'])(
    '%s pasa, con el cuerpo intacto',
    async (tipo) => {
      const cuerpo = { command_type: tipo, payload: { visor: 'v-1' } }
      const r = await POST(orden('7', cuerpo), ctx('7'))
      expect(r.status).toBe(200)
      expect(reenviar).toHaveBeenCalledTimes(1)
      expect(reenviar.mock.calls[0][1]).toBe('devices/7/command')
      expect(JSON.parse(textoReenviado())).toEqual(cuerpo)
    },
  )

  it('una orden sigue exigiendo inventario.crear', async () => {
    await POST(orden('7', { command_type: 'REBOOT_DEVICE' }), ctx('7'))
    expect(exigir).toHaveBeenCalledWith('inventario', 'crear')
  })
})

describe('2 · las órdenes que dejan un equipo sin servicio quedan en la bitácora', () => {
  it.each([
    ['REBOOT_DEVICE', 'Reinició un equipo de Space Eyes'],
    ['REBOOT_APP', 'Reinició la app de un equipo de Space Eyes'],
    ['UPDATE_APP', 'Actualizó la app de un equipo de Space Eyes'],
  ])('%s se registra con quién y a qué equipo', async (tipo, accion) => {
    await POST(orden('42', { command_type: tipo }), ctx('42'))
    expect(registrarAccion).toHaveBeenCalledWith(usuario, accion, 'equipo 42')
  })

  it('si Space Eye la rechaza, NO se registra como hecha', async () => {
    reenviar.mockResolvedValueOnce(new Response('{"error":"no"}', { status: 409 }))
    await POST(orden('42', { command_type: 'REBOOT_DEVICE' }), ctx('42'))
    expect(registrarAccion).not.toHaveBeenCalled()
  })

  it('las de todos los días (foto y vivo) no llenan la bitácora', async () => {
    for (const tipo of ['TAKE_PHOTO', 'START_STREAM', 'STOP_STREAM']) {
      await POST(orden('42', { command_type: tipo }), ctx('42'))
    }
    expect(registrarAccion).not.toHaveBeenCalled()
  })
})

describe('3 · lo que no es una orden no cambia', () => {
  it('un GET a devices pasa sin leer el cuerpo ni registrar nada', async () => {
    const req = new Request('http://127.0.0.1/spaces-dooh/api/space-eyes/se/devices')
    const r = await GET(req, { params: { ruta: ['devices'] } })
    expect(r.status).toBe(200)
    // El tercero es quién: Space Eye lo anota (p. ej. quién generó un código).
    expect(reenviar).toHaveBeenCalledWith(req, 'devices', 'ana@ejemplo.test', undefined)
    expect(registrarAccion).not.toHaveBeenCalled()
  })
})
