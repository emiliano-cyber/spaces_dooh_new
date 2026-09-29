import { describe, it, expect, vi } from 'vitest'
import { blobADataUrl } from './OTVista'

// ============================================================================
//  La evidencia fotográfica no se pasa por `fetch` si ya viene en base64
// ----------------------------------------------------------------------------
//  `FotoUploaderMock` entrega la foto con `readAsDataURL`, o sea ya como
//  `data:image/jpeg;base64,…`. `OTVista` la volvía a pasar por `fetch` para
//  convertirla… a lo que ya era.
//
//  No era solo trabajo de balde: la CSP de este producto trae
//  `connect-src 'self' …` SIN `data:`, así que el navegador lo rechazaba y
//  **subir la evidencia fallaba** con «Refused to connect because it violates
//  the document's Content Security Policy». Medido el 2026-09-29.
//
//  El arreglo es no llamar a `fetch`, NO relajar la CSP: `connect-src data:`
//  abriría un camino para sacar datos por una URL que el navegador no ve salir.
// ============================================================================

describe('blobADataUrl', () => {
  it('devuelve el data: URL tal cual, SIN tocar fetch', async () => {
    const espia = vi.fn()
    vi.stubGlobal('fetch', espia)
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAY='

    await expect(blobADataUrl(dataUrl)).resolves.toBe(dataUrl)

    // LA NEGATIVA, y es toda la prueba: si vuelve a llamarse a `fetch`, la
    // CSP lo rechaza y la evidencia no se sube.
    expect(espia).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('para una URL que NO es data:, sí intenta convertirla', async () => {
    const espia = vi.fn().mockRejectedValue(new Error('sin red en la prueba'))
    vi.stubGlobal('fetch', espia)

    await expect(blobADataUrl('blob:http://localhost/abc')).rejects.toThrow()
    expect(espia).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
