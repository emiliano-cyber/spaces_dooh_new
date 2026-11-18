import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const leer = vi.fn()
const guardar = vi.fn()
vi.mock('./imprenta-visible-repo', () => ({
  leerImprentaVisible: (id: string) => leer(id),
  guardarImprentaVisible: (id: string, v: boolean) => guardar(id, v),
}))

import { cambiarImprentaVisibleCtrl, imprentaVisibleCtrl } from './imprenta-visible-controller'

// SEG-CLIENTE (17/11) · la imprenta oculta por omisión; la muestra el vendedor
// que creó la propuesta o un superior.
describe('imprenta visible', () => {
  beforeEach(() => {
    leer.mockReset()
    guardar.mockReset()
    leer.mockResolvedValue({ imprentaVisible: false, usuarioId: 'v1', rolCreador: 'VENDEDOR' })
    guardar.mockImplementation(async (_id: string, v: boolean) => v)
  })

  it('NEGATIVO · otro vendedor recibe 403 y NO se escribe nada', async () => {
    await expect(cambiarImprentaVisibleCtrl('p1', { id: 'v2', rol: 'VENDEDOR' }, { visible: true })).rejects.toMatchObject({ status: 403 })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('el creador la enciende', async () => {
    expect(await cambiarImprentaVisibleCtrl('p1', { id: 'v1', rol: 'VENDEDOR' }, { visible: true })).toEqual({ imprentaVisible: true, puedeCambiar: true })
    expect(guardar).toHaveBeenCalledWith('p1', true)
  })

  it('NEGATIVO · sin `visible` booleano es 400', async () => {
    await expect(cambiarImprentaVisibleCtrl('p1', { id: 'v1', rol: 'VENDEDOR' }, { visible: 'si' })).rejects.toBeTruthy()
    expect(guardar).not.toHaveBeenCalled()
  })

  it('propuesta inexistente: 404', async () => {
    leer.mockResolvedValue(null)
    await expect(imprentaVisibleCtrl('nada', { id: 'v1', rol: 'DUENO' })).rejects.toMatchObject({ status: 404 })
  })

  it('el GET dice si quien mira puede moverlo', async () => {
    expect(await imprentaVisibleCtrl('p1', { id: 'g1', rol: 'GERENTE_VENTAS' })).toEqual({ imprentaVisible: false, puedeCambiar: true })
    expect(await imprentaVisibleCtrl('p1', { id: 'x', rol: 'FINANZAS' })).toEqual({ imprentaVisible: false, puedeCambiar: false })
  })
})
