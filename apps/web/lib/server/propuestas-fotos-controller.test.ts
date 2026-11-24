import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const leer = vi.fn()
vi.mock('./propuestas-fotos-repo', () => ({
  leerFotosDeSitiosDePropuesta: (id: string) => leer(id),
}))

import { fotosDePropuestaCtrl } from './propuestas-fotos-controller'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQ='

// ============================================================================
//  «Fotos de las pantallas» de la ficha interna (dueño, 20/11). La ruta ya
//  revisó el permiso y que la propuesta es del vendedor; aquí se mide qué se
//  devuelve: UNA entrada por sitio, en el orden de la propuesta, y solo lo
//  que se puede poner en un `src`.
// ============================================================================
describe('fotosDePropuestaCtrl', () => {
  beforeEach(() => leer.mockReset())

  it('una entrada por sitio, en su orden, con las fotos filtradas', async () => {
    leer.mockResolvedValue([
      { sitioId: 's1', nombre: 'Reforma', fotos: [PNG, 'javascript:alert(1)', PNG, JPG] },
      { sitioId: 's2', nombre: 'Muro', fotos: null },
    ])
    expect(await fotosDePropuestaCtrl('p1')).toEqual({
      sitios: [
        { sitioId: 's1', nombre: 'Reforma', fotos: [PNG, JPG] },
        { sitioId: 's2', nombre: 'Muro', fotos: [] },
      ],
    })
    expect(leer).toHaveBeenCalledTimes(1)
    expect(leer).toHaveBeenCalledWith('p1')
  })

  it('NEGATIVO · un texto que no es imagen no llega a la pantalla', async () => {
    leer.mockResolvedValue([{ sitioId: 's1', nombre: 'X', fotos: ['data:text/html,<script>', 'http://x/y.png'] }])
    expect((await fotosDePropuestaCtrl('p1')).sitios[0].fotos).toEqual([])
  })

  it('NEGATIVO · una propuesta que no existe aquí es 404', async () => {
    leer.mockResolvedValue(null)
    await expect(fotosDePropuestaCtrl('p1')).rejects.toMatchObject({ status: 404 })
  })
})
