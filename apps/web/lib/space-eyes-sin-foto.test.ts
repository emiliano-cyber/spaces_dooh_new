import { describe, it, expect } from 'vitest'
import { MOTIVOS_SIN_FOTO, contarSinFoto, textoSinFoto } from './space-eyes-sin-foto'

// ============================================================================
//  Que la pantalla diga por qué faltan las fotos que faltan.
// ----------------------------------------------------------------------------
//  El 23-oct-2026 el dueño preguntó por un creativo de TLALPAN: «si es un
//  creativo nuevo, entonces debería aparecer en la galería». Un hallazgo sin
//  foto es legítimo —la huella viaja siempre y la foto no— pero la pantalla lo
//  escondía sin decir nada, y lo que no se dice se lee como un error.
// ============================================================================

// Los motivos que guarda Space Eye (migración 028), más el de los viejos.
const MOTIVOS_DE_SPACE_EYE = ['aprendizaje', 'tope_del_dia', 'envio_agrupado', 'no_subio']

describe('1 · el catálogo de motivos', () => {
  it('nombra todos los que guarda Space Eye', () => {
    const claves = MOTIVOS_SIN_FOTO.map((m) => m.clave)
    for (const m of MOTIVOS_DE_SPACE_EYE) expect(claves).toContain(m)
  })

  it('ninguno se queda sin texto, y ninguno repite el de otro', () => {
    const textos = MOTIVOS_SIN_FOTO.map((m) => m.texto)
    for (const t of textos) expect(t.trim()).not.toBe('')
    expect(new Set(textos).size).toBe(textos.length)
  })

  it('lo que hay que atender se lee primero', () => {
    const claves = MOTIVOS_SIN_FOTO.map((m) => m.clave)
    expect(claves.indexOf('no_subio')).toBeLessThan(claves.indexOf('aprendizaje'))
  })
})

describe('2 · la línea que se enseña', () => {
  it('si todas tienen su foto, no se dice nada', () => {
    expect(textoSinFoto({})).toBeNull()
    expect(textoSinFoto(null)).toBeNull()
    expect(textoSinFoto(undefined)).toBeNull()
    expect(textoSinFoto({ no_subio: 0, aprendizaje: 0 })).toBeNull()
  })

  it('uno solo se dice en singular', () => {
    expect(textoSinFoto({ no_subio: 1 })).toBe('1 detectado sin foto: 1 no se pudo subir')
  })

  it('varios motivos salen juntos y en orden', () => {
    const t = textoSinFoto({ aprendizaje: 3, no_subio: 1, envio_agrupado: 2 })
    expect(t).toBe('6 detectados sin foto: 1 no se pudo subir, 2 esperan el envío agrupado, 3 se aprendieron del loop')
  })

  it('el caso de TLALPAN: la foto espera su envío agrupado', () => {
    expect(textoSinFoto({ envio_agrupado: 1 })).toBe('1 detectado sin foto: 1 esperan el envío agrupado')
  })

  it('un motivo nuevo de Space Eye suma al total aunque no sepamos nombrarlo', () => {
    // Que el total cuadre importa mas que nombrarlo: es lo que se mira primero.
    expect(textoSinFoto({ no_subio: 1, motivo_del_futuro: 2 })).toBe('3 detectados sin foto: 1 no se pudo subir')
  })

  it('solo un motivo desconocido: se dice cuántos son y nada más', () => {
    expect(textoSinFoto({ motivo_del_futuro: 2 })).toBe('2 detectados sin foto')
  })
})

describe('3 · contar los que no trajeron foto', () => {
  it('no cuenta los que sí la tienen', () => {
    expect(contarSinFoto([{ thumbnail_path: 'a.jpg' }, { storage_path: 'b.jpg' }])).toEqual({})
  })

  it('agrupa por el motivo que guardó Space Eye', () => {
    const c = contarSinFoto([
      { sin_foto: 'envio_agrupado' },
      { sin_foto: 'envio_agrupado' },
      { sin_foto: 'no_subio' },
      { thumbnail_path: 'a.jpg', sin_foto: null },
    ])
    expect(c).toEqual({ envio_agrupado: 2, no_subio: 1 })
  })

  it('un aprendido sin motivo es aprendizaje, no un misterio', () => {
    // Las primeras horas registran el loop a propósito, sin fotografiarlo: esas
    // filas son anteriores a la columna y no hay que alarmar con ellas.
    expect(contarSinFoto([{ aprendido: 1 }, { aprendido: true }])).toEqual({ aprendizaje: 2 })
  })

  it('los viejos sin motivo se cuentan aparte, no se inventa uno', () => {
    expect(contarSinFoto([{ aprendido: 0 }, {}])).toEqual({ desconocido: 2 })
  })

  it('sin catálogo no hay nada que contar', () => {
    expect(contarSinFoto(null)).toEqual({})
    expect(contarSinFoto(undefined)).toEqual({})
    expect(contarSinFoto([])).toEqual({})
  })

  it('de punta a punta: del catálogo a la línea que se lee', () => {
    const cuenta = contarSinFoto([
      { thumbnail_path: 'a.jpg' },
      { sin_foto: 'envio_agrupado' },
      { aprendido: 1 },
    ])
    expect(textoSinFoto(cuenta)).toBe('2 detectados sin foto: 1 esperan el envío agrupado, 1 se aprendieron del loop')
  })
})
