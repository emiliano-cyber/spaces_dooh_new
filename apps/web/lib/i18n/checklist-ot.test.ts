import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { etiquetaDePuntoOT, CHECKLIST_OT_POR_OMISION } from './checklist-ot'

// ============================================================================
//  OLA 6 · LA LISTA DE COMPROBACION POR OMISION DE UNA OT NUEVA.
// ----------------------------------------------------------------------------
//  La pantalla de alta la manda en espanol y se GUARDA en la OT. No cambia lo
//  que se guarda: al pintarla, un punto cuyo texto es EXACTAMENTE uno de los
//  tres de la lista por omision sale en ingles; lo que escribe el usuario se
//  queda como esta.
// ============================================================================

const RAIZ = path.join(__dirname, '../..')
const leer = (f: string) => readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')

describe('checklist de una OT nueva · la lista por omision', () => {
  it('es la que manda la pantalla de alta, letra por letra y en su orden', () => {
    const s = leer('app/(app)/(shell)/operaciones/page.tsx')
    const bloque = s.slice(s.indexOf('checklist: ['), s.indexOf('],', s.indexOf('checklist: [')))
    const labels = [...bloque.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
    expect(labels).toEqual(CHECKLIST_OT_POR_OMISION)
  })

  const EN = ['Structure and hardware inspection', 'Installation / execution', 'Proof photo with geolocation']
  CHECKLIST_OT_POR_OMISION.forEach((es, i) => {
    it(`«${es}»: igual en espanol, «${EN[i]}» en ingles`, () => {
      expect(etiquetaDePuntoOT(es, 'es')).toBe(es)
      expect(etiquetaDePuntoOT(es)).toBe(es)
      expect(etiquetaDePuntoOT(es, 'en')).toBe(EN[i])
    })
  })

  it('lo que escribe el usuario se queda como esta', () => {
    for (const x of ['Revisar estructura', 'inspección de estructura y herrajes', 'Montaje / ejecución ', 'Montaje']) {
      expect(etiquetaDePuntoOT(x, 'en')).toBe(x)
    }
  })
})

describe('checklist de una OT · la ficha pinta la etiqueta traducida y GUARDA la original', () => {
  const s = leer('components/operaciones/OTVista.tsx')
  it('las dos listas (abierta y cerrada) pasan por `etiquetaDePuntoOT`', () => {
    expect(s.match(/\{etiquetaDePuntoOT\(c\.label, idioma\)\}/g)?.length).toBe(2)
    expect(s).not.toMatch(/>\{c\.label\}</)
  })
  it('al marcar un punto se manda el texto guardado, no el traducido', () => {
    expect(s).toContain('onClick={() => alternarPunto(i, c.label)}')
  })
})
