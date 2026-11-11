import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  NOTIF-USUARIO · las rutas de la campanita usan el usuario de la SESIÓN.
// ----------------------------------------------------------------------------
//  Nunca del cuerpo ni de la URL: si una ruta aceptara el usuario de fuera,
//  cualquiera podría borrar o leer en la bandeja de otro. Y un id que no es un
//  uuid se corta con 404 ANTES de la base: sin eso, Postgres contesta
//  «invalid input syntax for type uuid» y la ruta da un 500.
// ============================================================================

const { auth, repo } = vi.hoisted(() => ({
  auth: { exigir: vi.fn() },
  repo: {
    borrarNotificacion: vi.fn(async () => true),
    marcarNotificacionLeida: vi.fn(async () => ({ id: 'x', leida: true })),
    archivarTodasNotificaciones: vi.fn(async () => 3),
    notificacionesDesde: vi.fn(async () => ({ notificaciones: [], marca: 'm' })),
  },
}))
vi.mock('@/lib/server/auth', () => auth)
vi.mock('@/lib/server/notificaciones-repo', () => repo)

import { DELETE } from '@/app/api/notificaciones/[id]/route'
import { POST as LEER } from '@/app/api/notificaciones/[id]/leer/route'
import { POST as TODAS } from '@/app/api/notificaciones/archivar-todas/route'
import { GET as NUEVAS } from '@/app/api/notificaciones/nuevas/route'

const ID = '3f2c8a52-6d1e-4b8a-9c3e-1a2b3c4d5e6f'
const req = (url = 'http://x/spaces-dooh/api/notificaciones/') => new Request(url, { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
  auth.exigir.mockResolvedValue({ ok: true, usuario: { id: 'U-sesion', rol: 'VENDEDOR' } })
  repo.borrarNotificacion.mockResolvedValue(true)
  repo.marcarNotificacionLeida.mockResolvedValue({ id: ID, leida: true })
})

describe('DELETE /api/notificaciones/[id] — borrar una', () => {
  it('borra con el usuario de la sesión', async () => {
    const r = await DELETE(req(), { params: { id: ID } })
    expect(r.status).toBe(200)
    expect(repo.borrarNotificacion).toHaveBeenCalledWith(ID, 'U-sesion')
  })

  it('404 si el aviso no es de su empresa', async () => {
    repo.borrarNotificacion.mockResolvedValue(false)
    expect((await DELETE(req(), { params: { id: ID } })).status).toBe(404)
  })

  it('un id que no es uuid da 404 sin tocar la base', async () => {
    expect((await DELETE(req(), { params: { id: 'no-es-uuid' } })).status).toBe(404)
    expect(repo.borrarNotificacion).not.toHaveBeenCalled()
  })

  it('si la base falla, contesta JSON con su mensaje, no un 500 vacío', async () => {
    repo.borrarNotificacion.mockRejectedValue(new Error('se cayó la conexión'))
    const r = await DELETE(req(), { params: { id: ID } })
    expect(r.status).toBeGreaterThanOrEqual(500)
    const cuerpo = await r.json()
    expect(cuerpo.error).toBeTruthy()
    // Y sin filtrar el texto interno del error.
    expect(JSON.stringify(cuerpo)).not.toContain('se cayó la conexión')
  })

  it('sin sesión, lo que diga exigir() y nada más', async () => {
    auth.exigir.mockResolvedValue({ ok: false, status: 401, error: 'No autenticado' })
    expect((await DELETE(req(), { params: { id: ID } })).status).toBe(401)
    expect(repo.borrarNotificacion).not.toHaveBeenCalled()
  })
})

describe('las demás rutas también van por el usuario de la sesión', () => {
  it('leer una', async () => {
    expect((await LEER(req(), { params: { id: ID } })).status).toBe(200)
    expect(repo.marcarNotificacionLeida).toHaveBeenCalledWith(ID, 'U-sesion')
  })

  it('leer con un id que no es uuid: 404 sin tocar la base', async () => {
    expect((await LEER(req(), { params: { id: 'x' } })).status).toBe(404)
    expect(repo.marcarNotificacionLeida).not.toHaveBeenCalled()
  })

  it('borrar todas', async () => {
    expect((await TODAS()).status).toBe(200)
    expect(repo.archivarTodasNotificaciones).toHaveBeenCalledWith('U-sesion')
  })

  it('el sondeo', async () => {
    const desde = '2030-01-01T00:00:00.000Z'
    await NUEVAS(new Request(`http://x/spaces-dooh/api/notificaciones/nuevas/?desde=${desde}`))
    expect(repo.notificacionesDesde).toHaveBeenCalledWith(desde, 'U-sesion')
  })
})
