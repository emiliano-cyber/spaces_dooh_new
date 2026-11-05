import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarNovedades, agruparPorTipo, textoDeItem, entradaValida, type EntradaNovedades, type ItemNovedad } from './novedades'
import { notasParaVersion } from '../../../scripts/actualizaciones.mjs'

// ============================================================================
//  Las notas de version EN EL IDIOMA DE LA PERSONA (2026-11-05).
// ----------------------------------------------------------------------------
//  Hasta este dia se declaraban «en espanol a proposito». Cada item puede
//  traer ahora `en` e `it` OPCIONALES junto a su `texto` (el espanol, el
//  original):
//
//    · en espanol se pinta `texto`, SIEMPRE, aunque haya traducciones;
//    · en ingles, `en`, y si falta, `texto`;
//    · en italiano, `it`; si falta, `en` (la misma caida del resto del
//      italiano, que cae al ingles); si faltan los dos, `texto`.
//
//  Una entrada vieja sin traducciones sigue siendo valida y se pinta como
//  siempre. Y el archivo real lleva TODAS sus entradas traducidas: lo mide la
//  ultima prueba, con las reglas de estilo de cada idioma.
// ============================================================================

const ITEM: ItemNovedad = { tipo: 'NUEVO', texto: 'Algo nuevo.', en: 'Something new.', it: 'Qualcosa di nuovo.' }
const entrada = (items: unknown[]): unknown => [{ version: 'v0.9.2', fecha: '2026-10-01', items }]
const errores = (datos: unknown) => {
  const r = validarNovedades(datos)
  return r.ok ? [] : r.errores
}

describe('novedades-reglas · las traducciones de un item', () => {
  it('un item con `en` e `it` es valido, y uno sin ellas tambien (las entradas viejas)', () => {
    expect(errores(entrada([ITEM]))).toEqual([])
    expect(errores(entrada([{ tipo: 'NUEVO', texto: 'Solo espanol.' }]))).toEqual([])
    expect(errores(entrada([{ tipo: 'NUEVO', texto: 'Solo ingles.', en: 'Only English.' }]))).toEqual([])
  })

  it('NEGATIVO: una traduccion vacia, de espacios o que no es texto no vale', () => {
    for (const v of ['', '   ', null, 3, ['x']]) {
      expect(errores(entrada([{ ...ITEM, en: v }])).join(' ')).toMatch(/«en»/)
      expect(errores(entrada([{ ...ITEM, it: v }])).join(' ')).toMatch(/«it»/)
    }
  })

  it('NEGATIVO: un idioma que no existe sigue siendo un campo desconocido', () => {
    expect(errores(entrada([{ ...ITEM, fr: 'Quelque chose.' }])).join(' ')).toMatch(/desconocido: «fr»/)
    expect(errores(entrada([{ ...ITEM, es: 'Algo.' }])).join(' ')).toMatch(/desconocido: «es»/)
  })
})

describe('textoDeItem y agruparPorTipo · el texto en el idioma de quien lee', () => {
  it('espanol: el texto original, aunque haya traducciones', () => {
    expect(textoDeItem(ITEM, 'es')).toBe('Algo nuevo.')
  })

  it('ingles e italiano: su traduccion', () => {
    expect(textoDeItem(ITEM, 'en')).toBe('Something new.')
    expect(textoDeItem(ITEM, 'it')).toBe('Qualcosa di nuovo.')
  })

  it('caidas: el italiano cae al ingles, y los dos al espanol', () => {
    expect(textoDeItem({ tipo: 'NUEVO', texto: 'Algo.', en: 'Something.' }, 'it')).toBe('Something.')
    expect(textoDeItem({ tipo: 'NUEVO', texto: 'Algo.' }, 'it')).toBe('Algo.')
    expect(textoDeItem({ tipo: 'NUEVO', texto: 'Algo.' }, 'en')).toBe('Algo.')
    expect(textoDeItem({ tipo: 'NUEVO', texto: 'Algo.', it: 'Qualcosa.' }, 'en')).toBe('Algo.')
  })

  it('agruparPorTipo pinta cada grupo en el idioma pedido, y en espanol por omision', () => {
    const items: ItemNovedad[] = [ITEM, { tipo: 'CORREGIDO', texto: 'Un arreglo.', en: 'A fix.', it: 'Una correzione.' }]
    expect(agruparPorTipo(items).map((g) => g.textos)).toEqual([['Algo nuevo.'], ['Un arreglo.']])
    expect(agruparPorTipo(items, 'en').map((g) => g.textos)).toEqual([['Something new.'], ['A fix.']])
    expect(agruparPorTipo(items, 'it').map((g) => g.textos)).toEqual([['Qualcosa di nuovo.'], ['Una correzione.']])
  })
})

describe('notas_disponibles · lo que escribe el actualizador lo tiene que entender la version VIEJA', () => {
  // El actualizador corre en la imagen NUEVA y escribe la entrada en una
  // columna que lee la aplicacion VIEJA (el panel de Actualizaciones, antes de
  // instalar). La vieja rechaza cualquier campo que no conozca: con `en`/`it`
  // dentro, el dueno veria la alarma de `avisoSinNotas` («el servidor no
  // anoto las notas, reportalo») justo en la
  // actualizacion que las trae.
  const REGLA_VIEJA = (e: EntradaNovedades) =>
    e.items.every((i) => Object.keys(i).every((k) => k === 'tipo' || k === 'texto'))

  it('las quita: cada item queda en { tipo, texto }, con el espanol intacto', () => {
    const e = notasParaVersion(JSON.stringify(entrada([ITEM, { tipo: 'AJUSTADO', texto: 'Otro.' }])), 'v0.9.2') as EntradaNovedades
    expect(e.items).toEqual([
      { tipo: 'NUEVO', texto: 'Algo nuevo.' },
      { tipo: 'AJUSTADO', texto: 'Otro.' },
    ])
    expect(REGLA_VIEJA(e)).toBe(true)
    expect(entradaValida(e, 'v0.9.2')).toEqual(e)
  })
})

// ─── El archivo real ────────────────────────────────────────────────────────

const archivo = JSON.parse(readFileSync(join(__dirname, '..', 'novedades.json'), 'utf8')) as EntradaNovedades[]
const items = archivo.flatMap((e) => e.items.map((i, n) => ({ donde: `${e.version} #${n + 1}`, ...i })))

describe('novedades.json · todas las entradas, en ingles y en italiano', () => {
  it('el archivo sigue siendo valido con las reglas de siempre', () => {
    expect(errores(archivo)).toEqual([])
  })

  it('cada item trae `en` e `it`, distintos del espanol', () => {
    const faltan = items.filter((i) => !i.en || !i.it || i.en === i.texto || i.it === i.texto).map((i) => i.donde)
    expect(faltan).toEqual([])
  })

  // Las cifras, folios y nombres propios viajan tal cual; si el ingles o el
  // italiano pierde una cifra del espanol, dice otra cosa.
  it('cada cifra del espanol sigue en el ingles y en el italiano', () => {
    const cifras = (s: string) => (s.match(/\d+/g) ?? []).sort()
    const mal = items.filter((i) => {
      const es = cifras(i.texto).join(' ')
      return cifras(i.en ?? '').join(' ') !== es || cifras(i.it ?? '').join(' ') !== es
    })
    expect(mal.map((i) => `${i.donde}: ${i.texto}`)).toEqual([])
  })

  it('ingles: apostrofo tipografico, sin comillas rectas ni espanol colado', () => {
    const mal = items.filter((i) => {
      const t = (i.en ?? '').replace(/19°25'57\.4"N 99°07'59\.5"W/g, '')
      return /['"]/.test(t) || /[áéíóúñ¿¡]/i.test(t) || /\b(campaña|propuesta|pantalla|cliente)\b/i.test(t)
    })
    expect(mal.map((i) => `${i.donde}: ${i.en}`)).toEqual([])
  })

  it('italiano: ’ y « », tuteo, sin espanol colado y con el glosario', () => {
    const mal = items.filter((i) => {
      const t = (i.it ?? '').replace(/19°25'57\.4"N 99°07'59\.5"W/g, '')
      return (
        /['"“”]/.test(t) ||
        /[ñ¿¡]/.test(t) ||
        // Glosario (italiano-olas.md): «provvigione», nunca «commissione»;
        // «codice di negoziazione»; Impostazioni, no «Amministrazione»; tuteo.
        /commission/i.test(t) ||
        // (la nota del cambio de nombre, v0.11.9, nombra el viejo a proposito)
        (i.donde !== 'v0.11.9 #1' && /codice promozionale|coupon/i.test(t)) ||
        /Amministrazione/.test(t) ||
        /\b(Lei|Suo|Sua|cliccare|clicchi|selezioni)\b/.test(t) ||
        /\b(campaña|propuesta|pantalla|arrendador)\b/i.test(t)
      )
    })
    expect(mal.map((i) => `${i.donde}: ${i.it}`)).toEqual([])
  })

  // «Sin articulo ante fecha» (italiano-olas.md) es para las fechas en HUECO
  // ({fecha}), donde no se sabe que cifra caera. En prosa fija la fecha se
  // escribe como en italiano, con articulo («dal 5 ottobre», «il 4 dicembre»,
  // «dal 1° al 31»), y lo que se vigila es la ELISION: ante 8, 11 y 80–89 va
  // «l’8», «dall’11» (nunca «il 8», «dal 11»); el primero del mes, «il 1°»;
  // y una elision solo ante esas cifras («l’5» es un error).
  it('italiano: el articulo ante una fecha con la elision correcta («dall’8», «l’11», «il 1°»)', () => {
    const sinElidir = /\b(il|al|dal|del|nel|sul)\s+(8\d?|11|1)(?![\d°])/
    const elisionMala = /\b(l|all|dall|dell|nell|sull)’(?!(8\d?|11)(?!\d))\d/
    const mal = items.filter((i) => sinElidir.test(i.it ?? '') || elisionMala.test(i.it ?? ''))
    expect(mal.map((i) => `${i.donde}: ${i.it}`)).toEqual([])
  })

  it('la guardia de la elision muerde', () => {
    const sinElidir = /\b(il|al|dal|del|nel|sul)\s+(8\d?|11|1)(?![\d°])/
    const elisionMala = /\b(l|all|dall|dell|nell|sull)’(?!(8\d?|11)(?!\d))\d/
    for (const malo of ['dal 8 ottobre', 'il 11 maggio', 'dal 1 al 31', 'l’5 ottobre', 'dall’18'])
      expect(sinElidir.test(malo) || elisionMala.test(malo), malo).toBe(true)
    for (const bueno of ['dal 5 ottobre', 'il 4 dicembre', 'dal 1° al 31', 'dall’8', 'l’11', 'il 18 marzo', 'il 21 ottobre'])
      expect(sinElidir.test(bueno) || elisionMala.test(bueno), bueno).toBe(false)
  })
})
