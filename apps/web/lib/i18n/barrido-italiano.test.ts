import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  A_PROPOSITO_IT,
  barrerHtml,
  frasesAjenas,
  sinPartesEnOtroIdioma,
  trozosAjenos,
  italianoConFrasesDeOtraClave,
  type Hallazgo,
} from './barrido-italiano'

// ============================================================================
//  El barrido global del HTML italiano (pulido, 2026-11-04). Dos partes:
//
//   · las reglas del barrido, que corren siempre (que muerda y que no grite
//     por un cognado);
//   · el barrido de verdad, solo con `I18N_BARRIDO_IT=<carpeta>[;<carpeta>]`
//     (las carpetas de `I18N_VOLCAR_IT` y de `I18N_VOLCAR_TODO`; de la segunda
//     solo los estados de `_italiano.txt`). Escribe el informe en
//     `I18N_BARRIDO_SALIDA` (JSON) y exige 0 hallazgos sin declarar.
//     `node scripts/i18n-barrido-italiano.mjs` lo prepara entero.
// ============================================================================

describe('barrido italiano · las reglas', () => {
  const dic = {
    es: { a: 'Guardar cambios', b: 'Periodo de {desde} a {hasta}', c: 'Total', d: 'Sin asignar' },
    en: { a: 'Save changes', b: 'Period from {desde} to {hasta}', c: 'Total', d: 'Unassigned' },
    it: { a: 'Salva modifiche', b: 'Periodo dal {desde} al {hasta}', c: 'Totale', d: 'Non assegnato' },
  }

  it('saca los trozos ajenos: dos palabras, ocho letras, que el italiano no tenga', () => {
    const t = trozosAjenos(dic).map((x) => x.trozo)
    expect(t).toContain('Guardar cambios')
    expect(t).toContain('Save changes')
    expect(t).toContain('Sin asignar')
    // Los huecos parten el texto: «Period from» es un trozo, «to» suelto no.
    expect(t).toContain('Period from')
    expect(t).not.toContain('to')
    // «Total» es una sola palabra.
    expect(t).not.toContain('Total')
  })

  it('un trozo que el italiano contiene no es ajeno', () => {
    const conCognado = { ...dic, it: { ...dic.it, e: 'Ultima modifica: guardar cambios' } }
    expect(trozosAjenos(conCognado).map((x) => x.trozo)).not.toContain('Guardar cambios')
  })

  it('muerde: una frase espanola o inglesa en el HTML italiano', () => {
    const trozos = trozosAjenos(dic)
    expect(frasesAjenas('<button>Guardar cambios</button>', trozos).map((h) => h.trozo.trozo)).toEqual(['Guardar cambios'])
    expect(frasesAjenas('<span title="Save changes"></span>', trozos)).toHaveLength(1)
    expect(frasesAjenas('<button>Salva modifiche</button>', trozos)).toHaveLength(0)
  })

  it('respeta los bordes de palabra', () => {
    expect(frasesAjenas('<p>Sin asignarlo</p>', trozosAjenos(dic))).toHaveLength(0)
  })

  it('no junta dos nodos: «Save» en uno y «changes» en otro no es «Save changes»', () => {
    expect(frasesAjenas('<dt>Save</dt><dd>changes</dd>', trozosAjenos(dic))).toHaveLength(0)
    expect(frasesAjenas('<dd>Save   changes</dd>', trozosAjenos(dic))).toHaveLength(1)
  })

  it('no barre un papel con lang de otro idioma (B68, B72)', () => {
    const html =
      '<div><div lang="es" style="display:contents"><div class="doc">Sin asignar <div>x</div></div></div>Guardar cambios</div>'
    expect(sinPartesEnOtroIdioma(html)).toBe('<div>Guardar cambios</div>')
    expect(frasesAjenas(html, trozosAjenos(dic)).map((h) => h.trozo.trozo)).toEqual(['Guardar cambios'])
  })

  it('con el diccionario real hay miles de trozos', () => {
    expect(trozosAjenos().length).toBeGreaterThan(3000)
  })

  it('cada excepcion dice por que', () => {
    for (const a of A_PROPOSITO_IT) expect(a.motivo.length, String(a.patron)).toBeGreaterThan(10)
  })
})

// ─── P-L2-1 cerrada (04/11) · la captura de cifras ya es italiana ───────────
// Hasta el 04/11 los ejemplos de captura («0.00», «Es. 12.9», «212,500.50»)
// llevaban una excepcion declarada: el campo leia a la mexicana en todos los
// idiomas. Desde que `lib/captura-cifra.ts` lee el italiano a la italiana, esa
// excepcion se quito, y un ejemplo a la mexicana en italiano vuelve a ser un
// hallazgo SIN declarar. Los italianos, en cambio, no lo son.
describe('barrido italiano · la captura de cifras ya no tiene excepcion (P-L2-1 cerrada)', () => {
  const sinDeclarar = (html: string) => barrerHtml('x', html, []).filter((h) => !h.aProposito)

  it('ningun A_PROPOSITO_IT menciona P-L2-1', () => {
    expect(A_PROPOSITO_IT.filter((a) => /P-L2-1/.test(a.motivo))).toEqual([])
  })

  it('un ejemplo de captura a la mexicana en italiano SE declara fallo', () => {
    for (const html of [
      '<input placeholder="0.00"/>',
      '<input placeholder="Es. 12.9"/>',
      '<input placeholder="es. 180,000"/>',
      '<p>il punto separa le migliaia e la virgola i decimali. Esempio: 212,500.50</p>',
      '<p>il punto separa le migliaia e la virgola i decimali (15,000.50).</p>',
      '<p>Importo 212,500.50</p>',
    ]) {
      expect(sinDeclarar(html), html).not.toHaveLength(0)
    }
  })

  it('el mismo ejemplo a la italiana no es ningun hallazgo', () => {
    for (const html of [
      '<input placeholder="0,00"/>',
      '<input placeholder="Es. 12,9"/>',
      '<input placeholder="es. 180.000"/>',
      '<p>il punto separa le migliaia e la virgola i decimali. Esempio: 212.500,50</p>',
      '<p>il punto separa le migliaia e la virgola i decimali (15.000,50).</p>',
    ]) {
      expect(sinDeclarar(html), html).toEqual([])
    }
  })
})

// ─── Validacion del pulido (04/11) · ESTATICA: siempre corre ────────────────
// El barrido da por no ajena cualquier frase que aparezca en un texto
// italiano: un `IT_*` con el espanol (o el ingles) de OTRA clave quedaba
// invisible para el barrido, la cobertura y la costura. Esto lo mira sobre el
// diccionario, sin volcado.
describe('el italiano no lleva frases espanolas o inglesas de otra clave', () => {
  it('muerde: el espanol de otra clave metido en un valor italiano', () => {
    const dic = {
      es: { a: 'No se pudo guardar el idioma', b: 'Usar el idioma del navegador' },
      en: { a: 'Could not save the language', b: 'Use the browser language' },
      it: { a: 'Impossibile salvare la lingua', b: 'No se pudo guardar el idioma' },
    }
    expect(italianoConFrasesDeOtraClave(dic).map((h) => `${h.clave}<-${h.de}`)).toEqual(['b<-a'])
  })

  it('el propio espanol de la clave no cuenta aqui (lo mira la cobertura)', () => {
    const dic = { es: { a: 'Guardar los cambios' }, en: { a: 'Save the changes' }, it: { a: 'Guardar los cambios' } }
    expect(italianoConFrasesDeOtraClave(dic)).toEqual([])
  })

  it('un cognado declarado no cuenta', () => {
    const dic = {
      es: { a: 'Raspberry Pi', b: 'Instalar' },
      en: { a: 'Raspberry Pi', b: 'Install' },
      it: { a: 'Raspberry Pi', b: 'Installa il Raspberry Pi' },
    }
    expect(italianoConFrasesDeOtraClave(dic)).toEqual([])
  })

  it('en el diccionario real, ninguna', () => {
    expect(italianoConFrasesDeOtraClave().map((h) => `${h.clave}: ${h.idioma} «${h.trozo}» (de ${h.de})`)).toEqual([])
  })
})

const carpetas = (process.env.I18N_BARRIDO_IT ?? '').split(';').filter(Boolean)

function htmls(raiz: string): string[] {
  const lista = join(raiz, '_italiano.txt')
  if (existsSync(lista)) {
    return [...new Set(readFileSync(lista, 'utf8').split('\n').filter(Boolean))].map((r) => join(raiz, r))
  }
  const out: string[] = []
  const andar = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) andar(p)
      else if (e.endsWith('.html')) out.push(p)
    }
  }
  andar(raiz)
  return out
}

describe.runIf(carpetas.length > 0)('barrido italiano · sobre el HTML volcado', () => {
  it('ninguna frase ajena ni huella de formato sin declarar', () => {
    const trozos = trozosAjenos()
    const hallazgos: Hallazgo[] = []
    let estados = 0
    for (const c of carpetas) {
      for (const f of htmls(c)) {
        estados++
        hallazgos.push(...barrerHtml(f.slice(c.length + 1), readFileSync(f, 'utf8'), trozos))
      }
    }
    const sinDeclarar = hallazgos.filter((h) => !h.aProposito)
    const resumen = {
      estados,
      trozos: trozos.length,
      hallazgos: hallazgos.length,
      declarados: hallazgos.length - sinDeclarar.length,
      sinDeclarar: sinDeclarar.length,
    }
    if (process.env.I18N_BARRIDO_SALIDA) {
      writeFileSync(process.env.I18N_BARRIDO_SALIDA, JSON.stringify({ resumen, hallazgos }, null, 1))
    }
    console.log('barrido italiano', resumen)
    expect(sinDeclarar.map((h) => `${h.archivo}: ${h.detalle}`)).toEqual([])
  })
})
