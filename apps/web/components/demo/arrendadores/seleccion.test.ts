import { describe, expect, it } from 'vitest'
import { contratoSeleccionado } from './seleccion'

// La ficha del contrato se abría con una COPIA del contrato guardada en el estado
// de la página. Al asignar «La paga», `editarContratoApi` refrescaba el estado
// global —la lista ya traía la razón social— pero la ficha seguía pintando la
// copia y decía «Sin asignar» hasta cerrarla y volver a abrirla. Visto en la
// pasada del manual del 2026-09-24.
//
// Lo que se prueba: la ficha se resuelve SIEMPRE contra la lista vigente.

type C = { id: string; entidadId: string | null }

describe('contratoSeleccionado', () => {
  it('devuelve la versión de la lista vigente, no la que había al abrir la ficha', () => {
    const alAbrir: C[] = [{ id: 'c1', entidadId: null }]
    const trasGuardar: C[] = [{ id: 'c1', entidadId: 'e1' }]
    expect(contratoSeleccionado(alAbrir, 'c1')?.entidadId).toBeNull()
    expect(contratoSeleccionado(trasGuardar, 'c1')?.entidadId).toBe('e1')
  })

  it('sin selección, o con una lista que aún no llegó, no hay ficha', () => {
    expect(contratoSeleccionado([{ id: 'c1', entidadId: null }], null)).toBeNull()
    expect(contratoSeleccionado(undefined, 'c1')).toBeNull()
    expect(contratoSeleccionado(null, 'c1')).toBeNull()
  })

  it('si el contrato ya no está en la lista, la ficha se cierra en vez de enseñar uno fantasma', () => {
    expect(contratoSeleccionado([{ id: 'c2', entidadId: null }], 'c1')).toBeNull()
  })
})
