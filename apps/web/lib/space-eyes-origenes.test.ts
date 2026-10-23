import { describe, it, expect } from 'vitest'
import { ORIGENES_FOTO, textoOrigen, selloDeFoto } from './space-eyes-origenes'

// ============================================================================
//  Que la leyenda de una foto diga lo que la foto es.
// ----------------------------------------------------------------------------
//  El 22-oct-2026 las dos campañas de Dessea dieron su primera prueba en
//  MAGNOCENTRO y salieron en la galería SIN ETIQUETA, mientras que en la ficha
//  del equipo salían como «programada». El dato estaba bien —el contador de la
//  campaña subió de 0 a 1—; lo que fallaba era el nombre.
//
//  Estas pruebas cuidan las dos mitades: que no falte ningún origen del ENUM, y
//  que la prueba de campaña diga DE CUÁL.
// ============================================================================

// Los siete valores del ENUM `photos.source` (migración 024 de Space Eye).
const ENUM_DE_SPACE_EYE = [
  'manual',
  'scheduled',
  'on_demand',
  'boot',
  'creative_change',
  'falla',
  'campana',
]

describe('1 · el catálogo de orígenes', () => {
  it('nombra los SIETE valores del ENUM, sin faltar ninguno', () => {
    const valores = ORIGENES_FOTO.map((o) => o.valor)
    for (const v of ENUM_DE_SPACE_EYE) expect(valores).toContain(v)
    expect(valores).toHaveLength(ENUM_DE_SPACE_EYE.length)
  })

  it('no inventa orígenes que Space Eye no guarda', () => {
    for (const o of ORIGENES_FOTO) expect(ENUM_DE_SPACE_EYE).toContain(o.valor)
  })

  it('ningún origen se queda sin texto, y ninguno repite el de otro', () => {
    const textos = ORIGENES_FOTO.map((o) => o.texto)
    for (const t of textos) expect(t.trim()).not.toBe('')
    expect(new Set(textos).size).toBe(textos.length)
  })
})

describe('2 · el nombre de cada origen', () => {
  it('la campaña se llama Campaña y no se queda muda — el fallo del 22-oct', () => {
    expect(textoOrigen('campana')).toBe('Campaña')
  })

  it('cada valor del ENUM tiene nombre', () => {
    for (const v of ENUM_DE_SPACE_EYE) expect(textoOrigen(v)).toBeTruthy()
  })

  it('sin origen, no hay etiqueta', () => {
    expect(textoOrigen(null)).toBeNull()
    expect(textoOrigen(undefined)).toBeNull()
    expect(textoOrigen('')).toBeNull()
  })

  it('un origen desconocido NO se enseña crudo', () => {
    // Si Space Eye agrega un valor, que la etiqueta falte —y se note— antes que
    // enseñar un tecnicismo en inglés en la pantalla del cliente.
    expect(textoOrigen('timelapse')).toBeNull()
  })
})

describe('3 · el sello sobre la foto', () => {
  it('la prueba de campaña dice de CUÁL campaña es', () => {
    expect(selloDeFoto('campana', 'Dessea')).toBe('Campaña · Dessea')
  })

  it('dos creativos de la misma pantalla no dicen lo mismo', () => {
    // Es el caso real: Dessea quedó vendida con dos creativos en MAGNOCENTRO y
    // cada uno manda su propia prueba el mismo día.
    const a = selloDeFoto('campana', 'Dessea · Dessea 1.1.jpeg')
    const b = selloDeFoto('campana', 'Dessea · download (1).jpg')
    expect(a).not.toBe(b)
  })

  it('campaña sin nombre: al menos dice que es de campaña', () => {
    expect(selloDeFoto('campana', null)).toBe('Campaña')
    expect(selloDeFoto('campana', undefined)).toBe('Campaña')
    expect(selloDeFoto('campana', '')).toBe('Campaña')
  })

  it('el nombre de la campaña NO se pega a un origen que no es campaña', () => {
    // La programada de las 02:49 cayó el mismo día que las pruebas de Dessea:
    // si el nombre se colara aquí, diría que es prueba de una campaña que no es.
    expect(selloDeFoto('scheduled', 'Dessea')).toBe('Programada')
  })

  it('una foto a petición ya no se presenta como programada', () => {
    expect(selloDeFoto('on_demand', null)).toBe('A petición')
  })

  it('una falla de pantalla tampoco se presenta como programada', () => {
    // Era el fallo de la ficha: todo lo que no fuera `on_demand` decía
    // «programada», así que una foto de falla mentía sobre su propio origen.
    expect(selloDeFoto('falla', null)).toBe('Falla de pantalla')
  })

  it('sin origen no hay sello, aunque venga el nombre de una campaña', () => {
    expect(selloDeFoto(null, 'Dessea')).toBeNull()
  })
})
