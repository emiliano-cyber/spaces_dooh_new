import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  `/api/space-eyes/foto?p=` cumple lo que su comentario promete (revisión 06/10).
// ----------------------------------------------------------------------------
//  El comentario decía «sin `..`, sin `//`» y la expresión admitía `//` dentro
//  del camino: `[A-Za-z0-9/_.-]+` casa con dos barras seguidas. No abre un SSRF
//  —el host lo pone siempre el servidor—, pero un comentario de seguridad que
//  no se cumple es el que el siguiente toca creyéndolo.
// ============================================================================

vi.mock('@/lib/server/auth', () => ({ exigir: async () => ({ ok: true, usuario: { id: 'u' } }) }))
const fetchFalso = vi.fn(async () => new Response('IMG', { headers: { 'content-type': 'image/jpeg' } }))
vi.mock('@/lib/server/space-eye', () => ({
  spaceEyeHabilitado: () => true,
  urlAbsolutaDeFoto: (p: string) => `http://se.interno${p}`,
}))

const { GET } = await import('@/app/api/space-eyes/foto/route')
const pedir = (p: string) =>
  GET(new Request(`http://127.0.0.1/spaces-dooh/api/space-eyes/foto?p=${encodeURIComponent(p)}`))

beforeEach(() => {
  fetchFalso.mockClear()
  vi.stubGlobal('fetch', fetchFalso)
})

describe('la ruta de una foto', () => {
  it('una doble barra en el camino es un 400 y no se pide nada', async () => {
    const r = await pedir('/storage//fotos/a.jpg')
    expect(r.status).toBe(400)
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('una ruta normal sigue sirviéndose', async () => {
    const r = await pedir('/storage/fotos/2026/a.jpg?firma=abc')
    expect(r.status).toBe(200)
  })
})
