import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const leer = vi.fn()
vi.mock('./seguimiento-publico-repo', () => ({ leerSeguimientoPorToken: (t: string) => leer(t) }))

import { seguimientoPublicoCtrl } from './seguimiento-publico-controller'

const TOKEN = 'a'.repeat(48)

describe('seguimientoPublicoCtrl', () => {
  beforeEach(() => leer.mockReset())

  it('NEGATIVO · un token con forma inválida no llega a la base', async () => {
    await expect(seguimientoPublicoCtrl("x' or 1=1 --")).rejects.toMatchObject({ status: 404 })
    await expect(seguimientoPublicoCtrl('')).rejects.toMatchObject({ status: 404 })
    expect(leer).not.toHaveBeenCalled()
  })

  it('NEGATIVO · un token que no es de ninguna propuesta da 404', async () => {
    leer.mockResolvedValue(null)
    await expect(seguimientoPublicoCtrl(TOKEN)).rejects.toMatchObject({ status: 404 })
  })

  it('propuesta sin campaña: hayCampana false', async () => {
    leer.mockResolvedValue({ propuestaId: 'p1', datos: null })
    expect(await seguimientoPublicoCtrl(TOKEN)).toEqual({ hayCampana: false })
  })

  it('«hoy» es el de México: a las 23:30 UTC del 30/11 todavía no arranca la del 01/12', async () => {
    leer.mockResolvedValue({
      propuestaId: 'p1',
      datos: {
        aceptadoEn: null,
        campana: {
          folio: 'C', nombre: 'N', tipo: 'DOOH', estado: 'ACTIVA', fechaInicio: '2026-12-01', fechaFin: '2026-12-31',
          creadaEn: null, publicada: true, publicadaEn: '2026-11-20T00:00:00.000Z',
        },
        creativos: [{ nombre: 'a', formato: null, resolucion: null, estatus: 'VALIDADA', creadoEn: null }],
        imprenta: [],
        montajes: [],
      },
    })
    const r = await seguimientoPublicoCtrl(TOKEN, new Date('2026-12-01T03:30:00.000Z'))
    expect(r.hayCampana && r.seguimiento.pasoActual).toBe('al_aire')
  })
})
