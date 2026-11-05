import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dondeDeFallaEnIdioma } from './donde-falla'

// Ola 7 · el `donde` de una falla que arma el servidor, al pintarlo.
describe('donde de una falla · en ingles', () => {
  const casos: Array<[string, string]> = [
    ['Gabinete 8 (fila 2, columna 3)', 'Cabinet 8 (row 2, column 3)'],
    ['Gabinetes 2, 5, 8 (3 de 15)', 'Cabinets 2, 5, 8 (3 of 15)'],
    ['Gabinetes 2, 5, 8', 'Cabinets 2, 5, 8'],
    ['Gabinetes 4 (1 de 15)', 'Cabinet 4 (1 of 15)'],
    ['Gabinetes 4', 'Cabinet 4'],
    ['Gabinetes 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12… (14 de 20)', 'Cabinets 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12… (14 of 20)'],
    ['Toda la pantalla', 'The whole screen'],
  ]
  for (const [es, en] of casos) {
    it(es, () => {
      expect(dondeDeFallaEnIdioma(es, 'en')).toBe(en)
      expect(dondeDeFallaEnIdioma(es, 'es')).toBe(es)
    })
  }
  it('lo que no reconoce se pinta como llega', () => {
    for (const x of ['ZONA-4', 'Gabinete 8', 'Toda la pantalla ', 'Gabinetes norte', 'Gabinete 8 (fila 2, columna 3) extra'])
      expect(dondeDeFallaEnIdioma(x, 'en')).toBe(x)
  })
  it('las tres formas son las que escribe `dondeDeFalla` del servidor', () => {
    const fuente = readFileSync(join(process.cwd(), 'lib/server/space-eye.ts'), 'utf8')
    expect(fuente).toContain("return `Gabinetes ${muestra}${total ? ` (${lista.length} de ${total})` : ''}`")
    expect(fuente).toContain('return `Gabinete ${f.gabinete} (fila ${f.fila + 1}, columna ${f.columna + 1})`')
    expect(fuente).toContain("return 'Toda la pantalla'")
    expect(fuente).toContain("lista.slice(0, 12).join(', ') + (lista.length > 12 ? '…' : '')")
  })
  it('la ficha del equipo pasa el `donde` por la traduccion en sus dos sitios', () => {
    const c = readFileSync(join(process.cwd(), 'components/demo/space-eyes/PantallaYCreativos.tsx'), 'utf8')
    expect(c).not.toContain('{f.donde}')
    expect(c.split('dondeDeFallaEnIdioma(f.donde, idioma)').length - 1).toBe(2)
  })
})

// Lote L1 del italiano (2026-11-03): las mismas tres formas, en italiano.
describe('donde de una falla · en italiano', () => {
  const casos: Array<[string, string]> = [
    ['Gabinete 8 (fila 2, columna 3)', 'Cabinet 8 (riga 2, colonna 3)'],
    ['Gabinetes 2, 5, 8 (3 de 15)', 'Cabinet 2, 5, 8 (3 di 15)'],
    ['Gabinetes 2, 5, 8', 'Cabinet 2, 5, 8'],
    ['Gabinetes 4 (1 de 15)', 'Cabinet 4 (1 di 15)'],
    ['Gabinetes 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12… (14 de 20)', 'Cabinet 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12… (14 di 20)'],
    ['Toda la pantalla', 'Tutto lo schermo'],
  ]
  for (const [es, it_] of casos) {
    it(es, () => expect(dondeDeFallaEnIdioma(es, 'it')).toBe(it_))
  }
  it('lo que no reconoce se pinta como llega', () => {
    for (const x of ['ZONA-4', 'Gabinete 8', 'Toda la pantalla ', 'Gabinetes norte'])
      expect(dondeDeFallaEnIdioma(x, 'it')).toBe(x)
  })
})

describe('nombre de una falla · el que escribe el telefono', async () => {
  const { nombreDeFallaEnIdioma } = await import('./donde-falla')
  const { DICCIONARIOS } = await import('./diccionario')
  const ES = DICCIONARIOS.es as Record<string, string>
  const EN = DICCIONARIOS.en as Record<string, string>
  const claves = Object.keys(ES).filter((k) => k.startsWith('spaceeyes.fallas.nombre.'))

  it('cada nombre del catalogo del telefono sale en ingles; en espanol, igual', () => {
    expect(claves.length).toBe(8)
    for (const k of claves) {
      expect(nombreDeFallaEnIdioma(ES[k], 'en'), k).toBe(EN[k])
      expect(nombreDeFallaEnIdioma(ES[k], 'es')).toBe(ES[k])
    }
  })
  it('y en italiano: los ocho, con su italiano y distinto del ingles (lote L1)', () => {
    const IT = DICCIONARIOS.it as Record<string, string>
    for (const k of claves) {
      expect(nombreDeFallaEnIdioma(ES[k], 'it'), k).toBe(IT[k])
      expect(IT[k], k).not.toBe(EN[k])
    }
  })
  it('un nombre que no es del catalogo (o con otra forma) se pinta como llega', () => {
    // «Pantalla congelada» salio de esta lista el 04/11: es el nombre corto que
    // manda el backend de Space Eye y ahora se reconoce (recorrido-italiano.test.ts).
    for (const x of ['F-APAGADO', 'Pantalla congelada (otra)', 'zona_apagada', 'Posible gabinete apagado ', 'posible gabinete apagado'])
      expect(nombreDeFallaEnIdioma(x, 'en')).toBe(x)
  })
  it('el espanol de cada clave es el literal de la app (`Monitor.kt`)', () => {
    const kt = readFileSync(join(process.cwd(), '../../space-eye/android/app/src/main/java/com/spaceeye/agent/pantalla/Monitor.kt'), 'utf8')
    for (const k of claves) expect(kt, k).toContain(`"${ES[k]}"`)
  })
  it('las dos pantallas pasan el nombre por la traduccion en todos sus sitios', () => {
    for (const [archivo, n] of [['PantallaYCreativos', 2], ['FallasFlota', 3]] as const) {
      const c = readFileSync(join(process.cwd(), `components/demo/space-eyes/${archivo}.tsx`), 'utf8')
      expect(c, archivo).not.toMatch(/\{f\.nombre\}/)
      expect(c.split('nombreDeFallaEnIdioma(f.nombre, idioma)').length - 1, archivo).toBe(n)
    }
  })
})
