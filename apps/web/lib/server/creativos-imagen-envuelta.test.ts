import { describe, it, expect, vi } from 'vitest'

// El controller importa el repo, y el repo arrastra el tenant y la base. Aquí
// solo se prueba la VALIDACIÓN, que no toca nada de eso.
vi.mock('./creativos-repo', () => ({}))

import { validarReemplazoCreatividad } from './creativos-controller'
import { imagenAHtml } from '@/lib/creativo-html'

// ============================================================================
//  2026-09-30 · Subir una imagen como creativo fallaba con casi cualquier foto.
// ----------------------------------------------------------------------------
//  El dueño: «en campaña está el error de fetch para subir imágenes».
//  Reproducido: la pantalla permitía 5 MB, pero envuelve la imagen en HTML
//  (`imagenAHtml`) con la imagen DOS veces —fondo difuminado y frente— y la
//  manda por `codigo`, cuyo límite es 2 MB. La imagen más grande que entraba
//  rondaba los 700 KB. Y en producción nginx corta en 12 MB
//  (`client_max_body_size 12M`): una de 5 MB envuelta pesaba ~14 MB y moría
//  ANTES de llegar a la app, como un error de red.
//
//  La regla nueva: si el HTML es EXACTAMENTE la envoltura de la app, la imagen
//  de dentro se valida COMO IMAGEN (tipo real por magic bytes, hasta 4 MB) y el
//  HTML puede llegar a 11 MB —por debajo de los 12 de nginx—. Un HTML escrito a
//  mano conserva su límite de 2 MB.
// ============================================================================

// PNG mínimo válido (1×1) + relleno: los magic bytes son de PNG y el tamaño
// es el que pidamos. validarUpload mira la cabecera, no decodifica la imagen.
const CABECERA_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
function pngDe(bytes: number): string {
  const relleno = Buffer.alloc(Math.max(0, bytes - CABECERA_PNG.length), 7)
  return 'data:image/png;base64,' + Buffer.concat([CABECERA_PNG, relleno]).toString('base64')
}

const MB = 1024 * 1024
const reemplazo = (codigo: string) => validarReemplazoCreatividad({ codigo, formato: 'text/html' })

describe('una imagen subida desde la pantalla (envuelta en HTML)', () => {
  it('de 3 MB ENTRA: era el caso que fallaba', () => {
    const html = imagenAHtml(pngDe(3 * MB), 'foto.png')
    expect(Buffer.byteLength(html)).toBeGreaterThan(2 * MB) // pasa el límite viejo
    expect(reemplazo(html).codigo).toBe(html)
  })

  it('de 4 MB justos también entra, y el HTML queda por debajo de los 12 MB de nginx', () => {
    const html = imagenAHtml(pngDe(4 * MB - 1024), 'foto.png')
    expect(Buffer.byteLength(html)).toBeLessThan(12 * MB)
    expect(() => reemplazo(html)).not.toThrow()
  })

  it('de más de 4 MB se rechaza diciendo que es la IMAGEN, no «el código»', () => {
    const html = imagenAHtml(pngDe(5 * MB), 'grande.png')
    expect(() => reemplazo(html)).toThrow(/imagen/i)
    expect(() => reemplazo(html)).not.toThrow(/código del creativo/i)
  })

  it('si lo de dentro no es de verdad una imagen, se rechaza (magic bytes)', () => {
    const falso = 'data:image/png;base64,' + Buffer.alloc(3 * MB, 65).toString('base64')
    expect(() => reemplazo(imagenAHtml(falso, 'x.png'))).toThrow()
  })
})

describe('un HTML escrito a mano conserva su límite de 2 MB', () => {
  it('3 MB de HTML que NO es la envoltura se rechaza', () => {
    const html = '<!doctype html><html><body>' + 'a'.repeat(3 * MB) + '</body></html>'
    expect(() => reemplazo(html)).toThrow(/2 MB/)
  })

  it('una envoltura retocada a mano ya no es «la de la app»: vuelve al límite de 2 MB', () => {
    const html = imagenAHtml(pngDe(3 * MB), 'foto.png').replace('</body>', '<script>x()</script></body>')
    expect(() => reemplazo(html)).toThrow(/2 MB/)
  })

  it('un HTML pequeño cualquiera sigue entrando', () => {
    expect(() => reemplazo('<div>hola</div>')).not.toThrow()
  })
})
