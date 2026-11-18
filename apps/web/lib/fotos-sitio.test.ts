import { describe, it, expect } from 'vitest'
import { fotosMostrables, enlaceGoogleMaps, MAX_FOTOS } from './fotos-sitio'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQ'

describe('fotosMostrables · lo que se pinta en el cuadro de fotos', () => {
  it('deja pasar data URLs de imagen y URLs https, en su orden', () => {
    expect(fotosMostrables([PNG, 'https://cdn.ejemplo.test/a.jpg', JPG])).toEqual([
      PNG,
      'https://cdn.ejemplo.test/a.jpg',
      JPG,
    ])
  })

  it('NEGATIVO · descarta lo que no es una imagen: javascript:, data:text/html, http plano, vacíos y no-cadenas', () => {
    expect(
      fotosMostrables([
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD4=',
        'http://inseguro.test/a.jpg',
        '',
        '   ',
        null,
        42,
        { url: PNG },
      ]),
    ).toEqual([])
  })

  it('quita duplicadas (la 1.ª se guarda también como imagen promocional)', () => {
    expect(fotosMostrables([PNG, PNG, JPG])).toEqual([PNG, JPG])
  })

  it(`se topa en ${MAX_FOTOS} para no mandar una galería sin fin por una liga pública`, () => {
    const muchas = Array.from({ length: MAX_FOTOS + 5 }, (_, i) => `data:image/png;base64,${i}`)
    expect(fotosMostrables(muchas)).toHaveLength(MAX_FOTOS)
  })

  it('cualquier cosa que no sea arreglo da lista vacía', () => {
    expect(fotosMostrables(null)).toEqual([])
    expect(fotosMostrables(undefined)).toEqual([])
    expect(fotosMostrables('data:image/png;base64,x')).toEqual([])
  })
})

describe('enlaceGoogleMaps', () => {
  it('arma la búsqueda por coordenadas', () => {
    expect(enlaceGoogleMaps(19.4326, -99.1332)).toBe(
      'https://www.google.com/maps/search/?api=1&query=19.4326,-99.1332',
    )
  })

  it('NEGATIVO · sin coordenadas útiles no hay enlace (null, NaN, 0,0 o fuera de rango)', () => {
    expect(enlaceGoogleMaps(null, -99)).toBeNull()
    expect(enlaceGoogleMaps(19, undefined)).toBeNull()
    expect(enlaceGoogleMaps(Number.NaN, 1)).toBeNull()
    expect(enlaceGoogleMaps(0, 0)).toBeNull()
    expect(enlaceGoogleMaps(95, 10)).toBeNull()
    expect(enlaceGoogleMaps(10, 200)).toBeNull()
  })
})
