import { describe, it, expect } from 'vitest'
import { sanearRequisitos, resolverRequisitos, REQUISITOS_RESPALDO, FORMATOS_ARTE } from './requisitos-impresion'
import { valorarArte, valorarResolucion } from './valoracion-arte'

describe('sanearRequisitos', () => {
  it('conserva lo válido y tira lo que no es del esquema', () => {
    expect(
      sanearRequisitos({ dpiGranVerde: 20, dpiGranAmbar: 8, corteGranM: 5, margenCm: 3, formatos: ['PNG', 'TIFF'], basura: 1 }),
    ).toEqual({ dpiGranVerde: 20, dpiGranAmbar: 8, corteGranM: 5, margenCm: 3, formatos: ['PNG', 'TIFF'] })
  })
  it('números fuera de rango, texto o negativos se descartan (cae al siguiente nivel, nunca a 0)', () => {
    expect(sanearRequisitos({ dpiGranVerde: 0, dpiCercanaVerde: -3, corteGranM: 'x', margenCm: 1000 })).toEqual({})
  })
  it('acepta números que llegan como texto desde un jsonb tocado a mano', () => {
    expect(sanearRequisitos({ dpiGranVerde: '12' })).toEqual({ dpiGranVerde: 12 })
  })
  it('un ámbar mayor que su verde no tiene sentido: se descarta el ámbar', () => {
    expect(sanearRequisitos({ dpiGranVerde: 10, dpiGranAmbar: 20 })).toEqual({ dpiGranVerde: 10 })
  })
  it('formatos desconocidos se quitan; una lista vacía es «sin configurar»', () => {
    expect(sanearRequisitos({ formatos: ['PNG', 'EXE', 'png'] })).toEqual({ formatos: ['PNG'] })
    expect(sanearRequisitos({ formatos: [] })).toEqual({})
    expect(FORMATOS_ARTE).toContain('PDF')
  })
  it('null, arreglos y basura son objeto vacío', () => {
    expect(sanearRequisitos(null)).toEqual({})
    expect(sanearRequisitos([1, 2])).toEqual({})
    expect(sanearRequisitos('hola')).toEqual({})
  })
})

describe('resolverRequisitos · imprenta > empresa > constantes', () => {
  it('sin nada, las constantes de siempre', () => {
    expect(resolverRequisitos(null, null)).toEqual(REQUISITOS_RESPALDO)
    expect(REQUISITOS_RESPALDO).toMatchObject({ dpiGranVerde: 10, dpiGranAmbar: 5, dpiCercanaVerde: 30, dpiCercanaAmbar: 15, corteGranM: 6, margenCm: 5, formatos: null })
  })
  it('la empresa pisa a las constantes y la imprenta a la empresa, campo por campo', () => {
    const r = resolverRequisitos({ dpiGranVerde: 25 }, { dpiGranVerde: 15, margenCm: 2 })
    expect(r.dpiGranVerde).toBe(25)
    expect(r.margenCm).toBe(2)
    expect(r.dpiCercanaVerde).toBe(30)
  })
  it('el ámbar heredado no puede quedar por encima del verde resuelto', () => {
    const r = resolverRequisitos({ dpiGranVerde: 4 }, null)
    expect(r.dpiGranAmbar).toBeLessThanOrEqual(r.dpiGranVerde)
  })
})

describe('la valoración usa los requisitos resueltos', () => {
  const ESPECTACULAR = { ancho: 12.9, alto: 7.2 }
  it('una imprenta más exigente vuelve ámbar lo que con las constantes es verde', () => {
    // 12 900 px en 12,9 m = 25,4 DPI: verde con 10, ámbar si la imprenta pide 30 con ámbar 20.
    expect(valorarResolucion(ESPECTACULAR, 12900, 7200).semaforo).toBe('verde')
    const req = resolverRequisitos({ dpiGranVerde: 30, dpiGranAmbar: 20 }, null)
    expect(valorarResolucion(ESPECTACULAR, 12900, 7200, req).semaforo).toBe('ambar')
  })
  it('el corte entre lona grande y chica viene de los requisitos', () => {
    const req = resolverRequisitos(null, { corteGranM: 20 })
    expect(valorarResolucion(ESPECTACULAR, 12900, 7200, req).escala).toBe('cercana')
  })
  it('con formatos configurados, uno fuera de la lista es rojo', () => {
    const req = resolverRequisitos({ formatos: ['PDF', 'TIFF'] }, null)
    expect(valorarArte(ESPECTACULAR, { anchoPx: 12900, altoPx: 7200, tipo: 'image/png' }, 15, req).formato?.semaforo).toBe('rojo')
    // Sin configurar, como siempre: PNG sirve.
    expect(valorarArte(ESPECTACULAR, { anchoPx: 12900, altoPx: 7200, tipo: 'image/png' }, 15).formato?.semaforo).toBe('verde')
  })
})
