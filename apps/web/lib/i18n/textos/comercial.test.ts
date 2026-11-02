import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_COMERCIAL, EN_COMERCIAL } from './comercial'

// ============================================================================
//  EL DICCIONARIO DE COMERCIAL ENTERO, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo motivo que `propuestas.test.ts` (validacion del piloto, §5): muchas
//  claves no salen en ningun estado rendido por `pantallas-comercial.test.ts`
//  (avisos emergentes, `window.confirm`, estados de carga, singulares). Para
//  esas, nada impediria cambiar una letra del espanol —que es una copia
//  literal del texto de antes— o dejar el ingles en espanol. La INSTANTANEA de
//  los dos idiomas lo impide: cambiar una entrada a proposito obliga a
//  regenerarla (`npx vitest run -u`) y el diff de `__snapshots__/` lo enseña.
// ============================================================================

describe('diccionario de comercial · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_COMERCIAL).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_COMERCIAL).toMatchSnapshot()
  })
})

describe('diccionario de comercial · el ingles no esta en espanol', () => {
  // Las que coinciden A PROPOSITO en los dos idiomas: palabras iguales, marcas,
  // nombres propios de ejemplo o plantillas sin texto que traducir.
  const IGUALES = new Set([
    'comercial.comun.no', // «No»
    'comercial.comun.video', // «Video»
    'comercial.pagina.leyenda.digital', // «Digital»
    'comercial.reserva.tipo.dooh', // «Digital»
    'comercial.ficha.exhibicion.digital', // «digital»
    'comercial.ficha.renovacion.manual', // «Manual»
    'comercial.reserva.slots', // « · {n} slots»: «slots» no se traduce
    'comercial.editar.cupo.global-ph', // «Global: {n}»
    'comercial.reserva.cliente-ej', // «Seguros Andinos», nombre propio de ejemplo
    'comercial.negociacion.canal.whatsapp', // marca
    'comercial.tipo-medio.mural', // «Mural» tambien es ingles (decision del orquestador, 2026-11-02)
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_COMERCIAL).filter(
      (k) => ES_COMERCIAL[k as keyof typeof ES_COMERCIAL] === EN_COMERCIAL[k as keyof typeof EN_COMERCIAL],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    const malas = Object.entries(EN_COMERCIAL)
      .filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const distintos = Object.keys(ES_COMERCIAL).filter(
      (k) =>
        huecos(ES_COMERCIAL[k as keyof typeof ES_COMERCIAL]).join() !==
        huecos(EN_COMERCIAL[k as keyof typeof EN_COMERCIAL]).join(),
    )
    expect(distintos).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_COMERCIAL).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso emergente de Comercial que NO se rinde.
// ----------------------------------------------------------------------------
//  La tercera gemela (despues de `textos/finanzas.test.ts` y
//  `textos/campanas.test.ts`). El validador de la costura
//  (docs/i18n/validacion-costura.md, mutante M5b) cambio el toast de
//  `comercial.tarifas.guardadas` por `comercial.ficha.galeria-guardada` y la
//  suite entera siguio en verde: un toast no sale en `renderToStaticMarkup` y
//  la instantanea fija el VALOR de cada clave, no QUE clave elige cada aviso.
//  Se lee el fuente y se fija la clave de cada uno.
// ============================================================================
describe('comercial · los avisos que no se rinden usan su clave', () => {
  const leer = (archivo: string) =>
    readFileSync(path.join(__dirname, '../../..', archivo), 'utf8').replace(/\r\n/g, '\n')
  const ficha = leer('components/demo/comercial/SiteFicha.tsx')
  const pagina = leer('app/(app)/(shell)/comercial/page.tsx')
  const codigos = leer('components/demo/codigos/GestionCodigos.tsx')

  it('reubicar: con OT nombra su folio, sin OT no; y su error', () => {
    expect(ficha).toMatch(
      /toast\.success\(otFolio \? t\('comercial\.ficha\.reubicada\.ot', \{ folio: otFolio \}\) : t\('comercial\.ficha\.reubicada'\)\)/,
    )
    expect(ficha).toMatch(/e\.message : t\('comercial\.ficha\.reubicar-error'\)/)
  })

  it('pausar, reanudar y eliminar avisan cada uno su error', () => {
    expect(ficha).toMatch(/pausarSitioLegalApi[\s\S]{0,200}?e\.message : t\('comercial\.ficha\.pausar-error'\)/)
    expect(ficha).toMatch(/reanudarSitioLegalApi[\s\S]{0,200}?e\.message : t\('comercial\.ficha\.reanudar-error'\)/)
    expect(ficha).toMatch(/guardar: \(\) => borrarSitioApi\(sitio\.id\),[\s\S]{0,120}?mensajeSiFalla: t\('comercial\.ficha\.eliminar-error'\)/)
  })

  it('la galeria avisa «guardada» al lograrlo y su error al fallar', () => {
    expect(ficha).toMatch(
      /imagenPromocional: urls\[0\] \?\? null \}\)\s*\n\s*toast\.success\(t\('comercial\.ficha\.galeria-guardada'\)\)/,
    )
    expect(ficha).toMatch(/e\.message : t\('comercial\.ficha\.galeria-error'\)/)
  })

  it('las tarifas por unidad avisan «guardadas» (no la galeria) y su error', () => {
    expect(ficha).toMatch(
      /guardar: \(\) => actualizarModalidadesApi\([\s\S]{0,80}?alLograr: \(\) => \{\s*\n\s*toast\.success\(t\('comercial\.tarifas\.guardadas'\)\)/,
    )
    expect(ficha).toMatch(/mensajeSiFalla: t\('comercial\.tarifas\.error'\)/)
  })

  it('editar el sitio avisa su error generico', () => {
    expect(ficha).toMatch(/guardar: \(\) => actualizarSitioApi\(sitio\.id, cambios\),[\s\S]{0,120}?mensajeSiFalla: t\('comercial\.comun\.no-se-pudo-guardar'\)/)
  })

  it('la pagina: descarga (singular y plural), su error, alta y reserva', () => {
    expect(pagina).toMatch(
      /notify\(t\(filtrados\.length === 1 \? 'comercial\.pagina\.descargadas\.uno' : 'comercial\.pagina\.descargadas\.otros'/,
    )
    expect(pagina).toMatch(/\} catch \{\s*\n\s*notify\(t\('comercial\.pagina\.descarga-error'\)\)/)
    expect(pagina).toMatch(/onCreado=\{\(s\) => notify\(t\('comercial\.pagina\.alta-hecha', \{ nombre: s\.nombre \}\)\)\}/)
    expect(pagina).toMatch(/setSeleccion\(new Set\(\)\)\s*\n\s*notify\(t\('comercial\.pagina\.reservados', \{ nombre \}\)\)/)
  })

  it('asignar un codigo: «reactivada» solo si la propuesta volvio a borrador', () => {
    expect(codigos).toMatch(/t\(r\.reactivada \? 'codigos\.asignado\.reactivada' : 'codigos\.asignado'/)
  })
})
