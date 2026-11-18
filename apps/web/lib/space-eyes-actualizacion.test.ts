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

// Lote del ingles (2026-11-02): el texto sale del diccionario. El español tiene
// que ser LETRA POR LETRA el de antes —el servidor lo manda en la lista de
// equipos sin idioma—, y el ingles no puede quedarse en español.
describe('comoSeActualiza · los dos idiomas', () => {
  const casos: [Partial<Parameters<typeof comoSeActualiza>[0]>, string][] = [
    [{ app_version: 'pi-agent 0.7.5', app_version_code: null }, 'Se actualiza sola.'],
    [{ device_owner: 1 }, 'Se actualiza sola (modo kiosco).'],
    [{ app_actualiza_sola: 1 }, 'Se actualiza sola, sin tocar el teléfono.'],
    [{ app_actualiza_sola: 0, app_actualiza_motivo: 'android_viejo' }, 'Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior.'],
    [{ app_actualiza_sola: 0, app_actualiza_motivo: 'sin_instalar_apps' }, 'Pide un toque: en el teléfono está apagado «Instalar apps desconocidas» para Space Eye.'],
    [{ app_actualiza_sola: 0, app_actualiza_motivo: 'otro_dueno' }, 'Pide un toque: otra tienda administra sus actualizaciones.'],
    [{ app_actualiza_sola: 0, app_actualiza_motivo: 'sin_permiso' }, 'La próxima actualización pide un toque en el teléfono; después se actualiza sola.'],
    [{ app_version: '0.8.0', app_version_code: 9 }, 'Necesita una visita: esta versión no se puede actualizar a distancia.'],
    [{ app_version: '0.14.0', app_version_code: 15, app_actualiza_sola: null }, 'La próxima actualización pide un toque en el teléfono; después se actualiza sola.'],
  ]
  for (const [o, es] of casos) {
    it(es, () => {
      expect(comoSeActualiza(tel(o)).texto).toBe(es)
      expect(comoSeActualiza(tel(o), 'es').texto).toBe(es)
      const en = comoSeActualiza(tel(o), 'en')
      expect(en.texto).not.toBe(es)
      expect(en.texto).not.toMatch(/[áéíóúñ¿]|\btap\b/i)
      expect({ sola: en.sola, tono: en.tono }).toEqual({ sola: comoSeActualiza(tel(o)).sola, tono: comoSeActualiza(tel(o)).tono })
    })
  }
})

describe('ola 7 · el texto que manda el servidor, al pintarlo', async () => {
  const { textoDeActualizacion } = await import('./space-eyes-actualizacion')
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { traducir } = await import('./i18n/diccionario')
  const fuente = readFileSync(join(process.cwd(), 'lib/space-eyes-actualizacion.ts'), 'utf8')
  const usadas = [...new Set([...fuente.matchAll(/r\((?:true|false), '(spaceeyes\.actualizacion\.[a-z-]+)'/g)].map((m) => m[1]))]

  it('cada frase que arma `comoSeActualiza` se reconoce y sale en ingles', () => {
    expect(usadas.length).toBeGreaterThanOrEqual(8)
    for (const k of usadas) {
      expect(textoDeActualizacion(traducir('es', k as never), 'en'), k).toBe(traducir('en', k as never))
    }
  })
  it('en espanol, y con una frase ajena, sale tal cual', () => {
    for (const k of usadas) expect(textoDeActualizacion(traducir('es', k as never), 'es')).toBe(traducir('es', k as never))
    expect(textoDeActualizacion('Otra cosa', 'en')).toBe('Otra cosa')
    expect(textoDeActualizacion('Se actualiza sola. ', 'en')).toBe('Se actualiza sola. ')
  })
})
