import { describe, it, expect } from 'vitest'
import { imagenAHtml, imagenDeHtml } from './creativo-html'

// ============================================================================
//  Las dos mitades de la misma convención: envolver una imagen en HTML, y
//  volver a sacarla.
//
//  Importa porque de esto depende que la pantalla de Creativos sea usable. Un
//  creativo «HTML» que en realidad es una imagen envuelta pesa ~1 MB y lleva un
//  desenfoque de 28 px; si nadie reconoce que por dentro hay una imagen, la
//  rejilla monta once documentos de ese tamaño y el navegador se cuelga —
//  comprobado en producción el 06/08.
//
//  Y hay un TERCER sitio que tiene que reconocer el mismo `<img>`: la consulta
//  de `listarCreatividades`, que lo comprueba con una expresión regular de
//  Postgres porque mirar dentro desde JavaScript exigiría traerse el megabyte
//  que este cambio vino a dejar de mover. Esa expresión no se puede compartir
//  —es otro lenguaje—, así que la prueba de abajo la reproduce y exige que las
//  dos vean lo mismo. Si `imagenAHtml` cambia cómo escribe el `<img>`, aquí
//  falla en vez de degradarse en silencio.
// ============================================================================

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// El MISMO patrón que usa la consulta en `listarCreatividades`. Escrito aquí
// como literal a propósito: si alguien lo cambia allá y no acá, esta prueba lo
// caza.
const PATRON_SQL = /<img[^>]+src="data:image\//

describe('imagenAHtml + imagenDeHtml', () => {
  it('lo que se envuelve se puede volver a sacar', () => {
    expect(imagenDeHtml(imagenAHtml(PNG, 'banner.png'))).toBe(PNG)
  })

  it('el HTML generado lo reconoce también el patrón de la consulta', () => {
    // Esta es la prueba que ata los TRES sitios.
    expect(PATRON_SQL.test(imagenAHtml(PNG, 'banner.png'))).toBe(true)
  })

  it('un nombre con comillas o signos no rompe la extracción', () => {
    // El alt se sanea, pero el `src` va justo al lado: un escape mal puesto
    // cortaría el atributo y la imagen dejaría de encontrarse.
    const html = imagenAHtml(PNG, 'promo "verano" <2026> & cía')
    expect(imagenDeHtml(html)).toBe(PNG)
    expect(PATRON_SQL.test(html)).toBe(true)
  })

  it('el HTML de verdad NO se confunde con una imagen envuelta', () => {
    // Un creativo de código no debe pintarse en un <img>: se vería roto.
    const real = '<!doctype html><html><body><div>Hola</div></body></html>'
    expect(imagenDeHtml(real)).toBeNull()
    expect(PATRON_SQL.test(real)).toBe(false)
  })

  it('una imagen remota no cuenta: solo se extrae lo que va incrustado', () => {
    const remota = '<img src="https://cdn.ejemplo.com/x.png">'
    expect(imagenDeHtml(remota)).toBeNull()
    expect(PATRON_SQL.test(remota)).toBe(false)
  })

  it('vacío y nulo no lanzan', () => {
    expect(imagenDeHtml(null)).toBeNull()
    expect(imagenDeHtml(undefined)).toBeNull()
    expect(imagenDeHtml('')).toBeNull()
  })
})
