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

  // IDIOMAS-SIN-ES (18/11): el espanol ya no se anade solo. La lista elegida se
  // respeta tal cual (en el orden de IDIOMAS), con al menos un idioma.
  it('la lista se respeta tal cual, SIN anadir el espanol, en el orden de IDIOMAS', () => {
    expect(validarIdiomasServidor({ idiomas: ['pt', 'en'] })).toEqual(['en', 'pt'])
    expect(validarIdiomasServidor({ idiomas: ['it'] })).toEqual(['it'])
    expect(validarIdiomasServidor({ idiomas: ['en', 'es'] })).toEqual(['es', 'en'])
  })

  it('NEGATIVO · una lista vacia es 400: hay que elegir al menos un idioma', () => {
    let e: unknown
    try {
      validarIdiomasServidor({ idiomas: [] })
    } catch (x) {
      e = x
    }
    expect(e).toBeInstanceOf(Error)
    expect((e as { status?: number }).status).toBe(400)
    expect((e as Error).message).toMatch(/al menos un idioma/)
  })

  it('RECHAZA un idioma que no existe, una lista que no es lista y un cuerpo vacio', () => {
    expect(() => validarIdiomasServidor({ idiomas: ['es', 'fr'] })).toThrow(/no son validos/)
    expect(() => validarIdiomasServidor({ idiomas: 'en' })).toThrow()
    expect(() => validarIdiomasServidor({})).toThrow()
    expect(() => validarIdiomasServidor(null)).toThrow()
  })
})
