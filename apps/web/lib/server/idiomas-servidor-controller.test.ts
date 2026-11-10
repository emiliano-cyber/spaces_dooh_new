import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./idiomas-servidor', () => ({
  idiomasDelServidor: vi.fn(),
  guardarIdiomasDelServidor: vi.fn(),
}))

import { validarIdiomasServidor } from './idiomas-servidor-controller'

describe('validarIdiomasServidor (IDIOMAS-SERVIDOR)', () => {
  it('null deja mandar a las variables del servidor, como antes de esta tarea', () => {
    expect(validarIdiomasServidor({ idiomas: null })).toBeNull()
  })

  it('el espanol va SIEMPRE, aunque no se mande, y el orden es el de IDIOMAS', () => {
    expect(validarIdiomasServidor({ idiomas: ['pt', 'en'] })).toEqual(['es', 'en', 'pt'])
    expect(validarIdiomasServidor({ idiomas: [] })).toEqual(['es'])
  })

  it('RECHAZA un idioma que no existe, una lista que no es lista y un cuerpo vacio', () => {
    expect(() => validarIdiomasServidor({ idiomas: ['es', 'fr'] })).toThrow(/no son validos/)
    expect(() => validarIdiomasServidor({ idiomas: 'en' })).toThrow()
    expect(() => validarIdiomasServidor({})).toThrow()
    expect(() => validarIdiomasServidor(null)).toThrow()
  })
})
