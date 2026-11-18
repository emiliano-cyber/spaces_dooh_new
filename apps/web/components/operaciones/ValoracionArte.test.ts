import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RevisionArte } from './ValoracionArte'

// ============================================================================
//  IMP-VAL (18/11) · lo que ve quien sube o revisa un arte para una lona.
// ----------------------------------------------------------------------------
//  Las cuentas se prueban en `lib/valoracion-arte.test.ts`; aquí, que la
//  pantalla las DIGA: la lona rotulada en metros, el semáforo en texto, los cm
//  que se pierden y la referencia de escala. Sin proveedor de idioma sale en
//  español (`useIdioma`), que es lo que se mira.
// ============================================================================

const PNG = 'data:image/png;base64,AAAA'
const html = (props: Parameters<typeof RevisionArte>[0]) => renderToStaticMarkup(createElement(RevisionArte, props))

describe('RevisionArte', () => {
  it('un arte que ajusta y con píxeles de sobra: verde, lona rotulada y figura de escala', () => {
    const s = html({ medida: { ancho: 12.9, alto: 7.2 }, src: PNG, imagen: true, pixeles: { ancho: 12900, alto: 7200 }, tipo: 'image/png', bytes: 2 * 1024 * 1024 })
    expect(s).toContain('<svg')
    expect(s).toContain('12.9 m')
    expect(s).toContain('7.2 m')
    expect(s).toContain('Sirve para imprimir')
    expect(s).toContain('Proporción: coincide con la lona (16:9)')
    expect(s).toContain('Formato PNG: sirve')
    expect(s).toContain('margen de seguridad de 5 cm')
    expect(s).toContain('persona de 1.70 m')
    expect(s).not.toMatch(/operaciones\.imprenta\./)
  })

  it('un 16:9 en un muro vertical: rojo, dice cuánto se pierde y en qué proporción pedirlo', () => {
    const s = html({ medida: { ancho: 3, alto: 9 }, src: PNG, imagen: true, pixeles: { ancho: 1920, alto: 1080 } })
    expect(s).toContain('No conviene imprimirlo así')
    expect(s).toMatch(/No ajusta: a sangre se pierde el 81 % del arte \(\d[\d,]* cm por lado\)\. Pide el arte en 1:3/)
    expect(s).toContain('Lo sombreado fuera de la lona se pierde al imprimir')
  })

  it('un recorte moderado es ámbar y dice los cm de arriba y abajo', () => {
    const s = html({ medida: { ancho: 4, alto: 2 }, src: PNG, imagen: true, pixeles: { ancho: 16000, alto: 9000 } })
    expect(s).toContain('Sirve, con observaciones')
    expect(s).toContain('se pierden 13 cm arriba y otro tanto abajo (11 % del arte)')
  })

  it('pocos píxeles para el tamaño real: «se verá pixelado» y cuántos pedir', () => {
    const s = html({ medida: { ancho: 12.9, alto: 7.2 }, src: PNG, imagen: true, pixeles: { ancho: 1920, alto: 1080 } })
    expect(s).toContain('Resolución baja')
    expect(s).toContain('se verá pixelado')
    expect(s).toMatch(/Pide al menos 5,0\d\d × 2,8\d\d px/)
  })

  it('el archivo que pasa del tope de peso sale en rojo', () => {
    const s = html({ medida: { ancho: 12.9, alto: 7.2 }, src: PNG, imagen: true, pixeles: { ancho: 12900, alto: 7200 }, tipo: 'image/jpeg', bytes: 6 * 1024 * 1024 })
    expect(s).toContain('pasa del tope de 4 MB: no se puede subir')
  })

  it('con el tope del arte de impresión (OOH), 10 MB sirven y lo dice con su tope', () => {
    const s = html({ medida: { ancho: 12.9, alto: 7.2 }, src: PNG, imagen: true, pixeles: { ancho: 12900, alto: 7200 }, tipo: 'image/jpeg', bytes: 10 * 1024 * 1024, maxMb: 15 })
    expect(s).toContain('Archivo de 10.0 MB (tope 15 MB)')
  })

  it('sin medida de la lona no se dibuja ni se inventa una valoración', () => {
    const s = html({ medida: null, src: PNG, imagen: true, pixeles: { ancho: 1920, alto: 1080 } })
    expect(s).not.toContain('<svg')
    expect(s).toContain('Sin medida de la lona')
  })
})
