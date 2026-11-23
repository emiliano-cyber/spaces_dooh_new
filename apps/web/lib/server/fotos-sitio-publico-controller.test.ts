import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const leer = vi.fn()
vi.mock('./fotos-sitio-publico-repo', () => ({
  leerSitioDePropuestaPorToken: (t: string, s: string) => leer(t, s),
}))

import { fotosSitioPublicoCtrl } from './fotos-sitio-publico-controller'

const TOKEN = 'a'.repeat(48)
const SITIO = '11111111-1111-4111-8111-111111111111'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

const fila = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Lona Periférico',
  tipoMedio: 'ESPECTACULAR',
  direccion: 'Periférico Sur 100',
  alcaldia: 'Coyoacán',
  ciudad: 'CDMX',
  estado: 'Ciudad de México',
  lat: '19.30000',
  lng: '-99.15000',
  fotos: [PNG, 'javascript:alert(1)'],
  ...extra,
})

describe('fotosSitioPublicoCtrl · fotos y ubicación de UNA pantalla de la propuesta', () => {
  beforeEach(() => leer.mockReset())

  it('NEGATIVO · un token con forma inválida no llega a la base', async () => {
    await expect(fotosSitioPublicoCtrl("x' or 1=1 --", SITIO)).rejects.toMatchObject({ status: 404 })
    await expect(fotosSitioPublicoCtrl('', SITIO)).rejects.toMatchObject({ status: 404 })
    expect(leer).not.toHaveBeenCalled()
  })

  it('NEGATIVO · un sitio que no es UUID no llega a la base', async () => {
    await expect(fotosSitioPublicoCtrl(TOKEN, 'PR-123')).rejects.toMatchObject({ status: 404 })
    await expect(fotosSitioPublicoCtrl(TOKEN, `${SITIO}' or 1=1`)).rejects.toMatchObject({ status: 404 })
    expect(leer).not.toHaveBeenCalled()
  })

  it('NEGATIVO · token sin propuesta, o sitio fuera de ella: 404 (el repo devuelve null)', async () => {
    leer.mockResolvedValue(null)
    await expect(fotosSitioPublicoCtrl(TOKEN, SITIO)).rejects.toMatchObject({ status: 404 })
    expect(leer).toHaveBeenCalledWith(TOKEN, SITIO)
  })

  it('devuelve SOLO ubicación y fotos mostrables, con las coordenadas como número', async () => {
    leer.mockResolvedValue(fila())
    const r = await fotosSitioPublicoCtrl(TOKEN, SITIO)
    expect(r).toEqual({
      nombre: 'Lona Periférico',
      tipoMedio: 'ESPECTACULAR',
      direccion: 'Periférico Sur 100',
      alcaldia: 'Coyoacán',
      ciudad: 'CDMX',
      estado: 'Ciudad de México',
      lat: 19.3,
      lng: -99.15,
      fotos: [PNG],
    })
  })

  it('NEGATIVO · un campo de más que se colara en la fila NO sale (lista blanca, no lista negra)', async () => {
    leer.mockResolvedValue(fila({ costoCompra: 9000, arrendador: 'Don Pepe', tarifaPublicada: 30000 }))
    const r = await fotosSitioPublicoCtrl(TOKEN, SITIO)
    expect(Object.keys(r).sort()).toEqual(
      ['alcaldia', 'ciudad', 'direccion', 'estado', 'fotos', 'lat', 'lng', 'nombre', 'tipoMedio'].sort(),
    )
    expect(JSON.stringify(r)).not.toMatch(/9000|Don Pepe|30000/)
  })

  it('sin coordenadas útiles: lat/lng en null (el (0,0) es un hueco, no un lugar)', async () => {
    leer.mockResolvedValue(fila({ lat: 0, lng: 0, fotos: null }))
    const r = await fotosSitioPublicoCtrl(TOKEN, SITIO)
    expect(r.lat).toBeNull()
    expect(r.lng).toBeNull()
    expect(r.fotos).toEqual([])
  })
})
