import { describe, it, expect } from 'vitest'
import { nombreEnAlbum, nombreDelAlbum, bytesDeDataUrl, armarAlbum } from './album-evidencias'

// ============================================================================
//  FLUJO-CREA (20/11) · «Descargar álbum» del comprobante de exhibición de
//  fijos: las fotos de evidencia de la campaña en un .zip, con nombre por sitio
//  y fecha. Reutiliza `crearZip` del álbum de Space Eyes.
// ============================================================================

// Mediodía en UTC: el mismo día de calendario en cualquier zona de América.
const T = '2026-11-20T18:00:00.000Z'
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('nombreEnAlbum', () => {
  it('sitio y fecha de la toma, sin caracteres que Windows no acepta', () => {
    expect(nombreEnAlbum({ url: 'https://x/y.jpg', sitioNombre: 'Valla Reforma / Norte', tomadaEn: T })).toBe(
      'Valla_Reforma_Norte_2026-11-20.jpg',
    )
    expect(nombreEnAlbum({ url: 'x', sitioNombre: 'Pared: "A"*?<>|', tomadaEn: T })).toBe('Pared_A_2026-11-20.jpg')
  })
  it('sin fecha de toma usa la de subida; sin ninguna, «sin-fecha»', () => {
    expect(nombreEnAlbum({ url: 'x', sitioNombre: 'A', subidaEn: T })).toBe('A_2026-11-20.jpg')
    expect(nombreEnAlbum({ url: 'x', sitioNombre: 'A' })).toBe('A_sin-fecha.jpg')
    expect(nombreEnAlbum({ url: 'x', sitioNombre: 'A', tomadaEn: 'basura' })).toBe('A_sin-fecha.jpg')
  })
  it('sin sitio: «sitio»; y la extensión sale del tipo de la imagen si es data URL', () => {
    expect(nombreEnAlbum({ url: PNG, tomadaEn: T })).toBe('sitio_2026-11-20.png')
    expect(nombreEnAlbum({ url: 'data:image/webp;base64,AAAA', sitioNombre: 'A', tomadaEn: T })).toBe('A_2026-11-20.webp')
  })
})

describe('nombreDelAlbum', () => {
  it('lleva el folio de la campaña (o su nombre) y no deja caracteres raros', () => {
    expect(nombreDelAlbum({ folio: 'CMP-2026-0007', nombre: 'Lona' })).toBe('album_CMP-2026-0007.zip')
    expect(nombreDelAlbum({ folio: null, nombre: 'Lona Reforma/Norte' })).toBe('album_Lona_Reforma_Norte.zip')
  })
})

describe('bytesDeDataUrl', () => {
  it('decodifica base64 y rechaza lo que no es imagen', () => {
    const b = bytesDeDataUrl(PNG)
    expect(b?.[0]).toBe(0x89)
    expect(b?.[1]).toBe(0x50)
    expect(bytesDeDataUrl('data:text/html;base64,PGI+')).toBeNull()
    expect(bytesDeDataUrl('https://x/y.jpg')).toBeNull()
  })
})

describe('armarAlbum', () => {
  it('mete cada foto con su nombre, salta las que fallan y las cuenta', async () => {
    const leer = async (url: string) => {
      if (url.includes('rota')) throw new Error('404')
      return new Uint8Array([1, 2, 3])
    }
    const r = await armarAlbum(
      [
        { url: PNG, sitioNombre: 'Valla', tomadaEn: T },
        { url: 'https://cdn/ok.jpg', sitioNombre: 'Valla', tomadaEn: T },
        { url: 'https://cdn/rota.jpg', sitioNombre: 'Muro', tomadaEn: T },
        { url: 'mock://foto', sitioNombre: 'Muro', tomadaEn: T },
      ],
      leer,
    )
    expect(r.incluidas).toBe(2)
    expect(r.fallidas).toBe(2)
    expect(r.zip).toBeInstanceOf(Uint8Array)
    // El .zip empieza con la firma local y lleva los dos nombres (el segundo, sin pisar al primero).
    const texto = new TextDecoder().decode(r.zip!)
    expect(r.zip![0]).toBe(0x50)
    expect(texto).toContain('Valla_2026-11-20.png')
    expect(texto).toContain('Valla_2026-11-20.jpg')
  })

  it('sin ninguna foto legible no hay .zip', async () => {
    const r = await armarAlbum([{ url: 'mock://x' }], async () => new Uint8Array())
    expect(r).toEqual({ zip: null, incluidas: 0, fallidas: 1 })
    expect((await armarAlbum([], async () => new Uint8Array())).zip).toBeNull()
  })
})
