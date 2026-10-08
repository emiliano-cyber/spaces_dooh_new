import { describe, it, expect } from 'vitest'
import { comoSeActualiza } from './space-eyes-actualizacion'

// Lo que dice la ficha del equipo manda (o ahorra) un viaje a un sitio: no
// puede prometer "se actualiza sola" a un teléfono que va a pedir un toque.

const tel = (o: Partial<Parameters<typeof comoSeActualiza>[0]> = {}) => ({
  app_version: '0.16.4',
  app_version_code: 36,
  device_owner: 0,
  ...o,
})

describe('comoSeActualiza', () => {
  it('Raspberry y PC siempre solas', () => {
    expect(comoSeActualiza(tel({ app_version: 'pi-agent 0.7.5', app_version_code: null })).sola).toBe(true)
    expect(comoSeActualiza(tel({ app_version: 'pc-agent 1.6.0', app_version_code: null })).sola).toBe(true)
  })

  it('el teléfono que dice que se actualiza solo, o en kiosco', () => {
    expect(comoSeActualiza(tel({ app_actualiza_sola: 1, app_actualiza_motivo: 'sola' }))).toMatchObject({ sola: true, tono: 'ok' })
    expect(comoSeActualiza(tel({ device_owner: 1 })).texto).toMatch(/kiosco/)
  })

  it('cada motivo de Android se explica', () => {
    expect(comoSeActualiza(tel({ app_actualiza_sola: 0, app_actualiza_motivo: 'android_viejo' })).texto).toMatch(/Android 11/)
    expect(comoSeActualiza(tel({ app_actualiza_sola: 0, app_actualiza_motivo: 'sin_instalar_apps' })).texto).toMatch(
      /Instalar apps desconocidas/,
    )
    expect(comoSeActualiza(tel({ app_actualiza_sola: 0, app_actualiza_motivo: 'otro_dueno' })).sola).toBe(false)
  })

  it('las versiones de antes de la 0.16.4: un toque más y luego solas', () => {
    const r = comoSeActualiza(tel({ app_version: '0.14.0', app_version_code: 15, app_actualiza_sola: null }))
    expect(r).toMatchObject({ sola: false, tono: 'aviso' })
    expect(r.texto).toMatch(/después se actualiza sola/)
  })

  it('antes de la 0.10.0 no hay actualización a distancia: visita', () => {
    expect(comoSeActualiza(tel({ app_version: '0.8.0', app_version_code: 9 }))).toMatchObject({ sola: false, tono: 'visita' })
  })
})
