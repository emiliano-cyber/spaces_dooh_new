import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_CAMPANAS, EN_CAMPANAS } from './campanas'
import { DICCIONARIOS, type ClaveTexto } from '../diccionario'
import {
  CAMPANA_LABEL,
  VALIDACION_PUB_LABEL,
  CREATIVIDAD_LABEL,
  RESERVA_LABEL,
  OT_LABEL,
  IMPRESION_LABEL,
} from '@/components/demo/StatusBadge'
import { ETAPA_LABEL } from '@/lib/data/derive'
import type { TipoCampana } from '@/lib/data/types'
import { ETIQUETA_ESTADO_REMOTO } from '@/lib/doohmain-estado'
import { AVISO_PANTALLA_DOOHMAIN } from '@/lib/doohmain-aviso'
import {
  CLAVE_ESTADO_CAMPANA,
  CLAVE_ETAPA,
  CLAVE_VALIDACION_PUB,
  CLAVE_CREATIVIDAD,
  CLAVE_RESERVA,
  CLAVE_OT,
  CLAVE_IMPRESION,
  CLAVE_ESTADO_REMOTO,
  CLAVE_TIPO_CAMPANA,
} from '@/components/demo/campanas/etiquetas'

// ============================================================================
//  EL DICCIONARIO DE CAMPANAS ENTERO, CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Lo que el piloto aprendio a golpes (docs/i18n/validacion-propuestas.md §5):
//  rendir pantallas no alcanza, porque los avisos emergentes, los
//  `window.prompt` y las ramas raras no salen en ningun estado. La instantanea
//  de los dos idiomas cierra ese hueco: cambiar una letra de cualquier entrada
//  pone esto en rojo, y quien lo haga a proposito regenera con
//  `npx vitest run -u` y el diff de `__snapshots__/` dice que cambio.
//
//  Y las etiquetas de estado tienen su verdad FUERA de este archivo
//  (StatusBadge.tsx, derive.ts, doohmain-*.ts), que el lote no toca: aqui se
//  exige que el espanol del diccionario sea el MISMO, como el menu con `nav.ts`.
// ============================================================================

describe('diccionario de campanas · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_CAMPANAS).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_CAMPANAS).toMatchSnapshot()
  })
})

describe('diccionario de campanas · el ingles no esta en espanol', () => {
  // Iguales A PROPOSITO en los dos idiomas.
  const IGUALES = new Set<string>([
    'campanas.comun.total', // «Total»
    'campanas.comun.error', // «Error»
    'campanas.ficha.pipeline', // «Pipeline», el nombre del modulo
    'campanas.ficha.no', // «No»
    'campanas.ficha.snapshot', // termino ya en ingles en la pantalla espanola
    'campanas.tipo.ooh', // siglas del medio, iguales en los dos
    'campanas.tipo.dooh',
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_CAMPANAS).filter(
      (k) => ES_CAMPANAS[k as keyof typeof ES_CAMPANAS] === EN_CAMPANAS[k as keyof typeof EN_CAMPANAS],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN_CAMPANAS).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_CAMPANAS).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const distintos = Object.keys(ES_CAMPANAS).filter(
      (k) => huecos(ES_CAMPANAS[k as keyof typeof ES_CAMPANAS]) !== huecos(EN_CAMPANAS[k as keyof typeof EN_CAMPANAS]),
    )
    expect(distintos).toEqual([])
  })
})

describe('diccionario de campanas · el espanol reproduce EXACTAMENTE su modulo', () => {
  const es = (clave: ClaveTexto) => DICCIONARIOS.es[clave]
  const casos: [string, Record<string, string>, Record<string, ClaveTexto>][] = [
    ['CAMPANA_LABEL', CAMPANA_LABEL, CLAVE_ESTADO_CAMPANA],
    ['ETAPA_LABEL', ETAPA_LABEL, CLAVE_ETAPA],
    ['VALIDACION_PUB_LABEL', VALIDACION_PUB_LABEL, CLAVE_VALIDACION_PUB],
    ['CREATIVIDAD_LABEL', CREATIVIDAD_LABEL, CLAVE_CREATIVIDAD],
    ['RESERVA_LABEL', RESERVA_LABEL, CLAVE_RESERVA],
    ['OT_LABEL', OT_LABEL, CLAVE_OT],
    ['IMPRESION_LABEL', IMPRESION_LABEL, CLAVE_IMPRESION],
    ['ETIQUETA_ESTADO_REMOTO', ETIQUETA_ESTADO_REMOTO, CLAVE_ESTADO_REMOTO],
  ]
  for (const [nombre, fuente, claves] of casos) {
    it(nombre, () => {
      // Mismas llaves en los dos mapas: un estado nuevo sin clave no compila
      // por el `Record`, y uno retirado de la fuente se ve aqui.
      expect(Object.keys(claves).sort()).toEqual(Object.keys(fuente).sort())
      for (const k of Object.keys(fuente)) expect(es(claves[k])).toBe(fuente[k])
    })
  }

  it('el tipo de campana en espanol es el valor crudo que se pintaba', () => {
    for (const tipo of ['OOH', 'DOOH', 'HIBRIDA'] as TipoCampana[]) expect(es(CLAVE_TIPO_CAMPANA[tipo])).toBe(tipo)
  })

  it('AVISO_PANTALLA_DOOHMAIN', () => {
    expect(es('campanas.validacion.aviso-pantalla')).toBe(AVISO_PANTALLA_DOOHMAIN)
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso emergente que NO se rinde (costura, 2026-11-02).
// ----------------------------------------------------------------------------
//  La gemela de la de `textos/finanzas.test.ts`. El validador del lote
//  (docs/i18n/validacion-campanas-finanzas.md §5, M12) cambio en
//  `ValidacionPanel` el aviso de «retirado» por el de «bajado» y sobrevivio a
//  la suite entera: un toast no sale en `renderToStaticMarkup`, y la
//  instantanea fija el VALOR de la clave, no QUE clave elige cada rama. Se lee
//  el fuente y se fija la rama del ternario.
// ============================================================================
describe('campanas · los avisos que no se rinden usan su clave', () => {
  const leer = (archivo: string) =>
    readFileSync(path.join(__dirname, '../../../components/demo/campanas', archivo), 'utf8').replace(/\r\n/g, '\n')
  const validacion = leer('ValidacionPanel.tsx')
  const creativos = leer('CreativosEnDoohmain.tsx')

  it('bajar un creativo: «retirado» si queda pendiente en DOOHmain, «bajado» si no', () => {
    expect(validacion).toMatch(
      /res\?\.pendienteEnDoohmain\s*\n\s*\? t\('campanas\.validacion\.retirado\.toast', \{ nombre: cr\.nombre \}\)\s*\n\s*: t\('campanas\.validacion\.bajado\.toast', \{ nombre: cr\.nombre \}\)/,
    )
    expect(validacion).toMatch(/e\.message : t\('campanas\.validacion\.no-bajar'\)/)
  })

  it('publicar: el singular con 1 y el plural con el resto, en publicada y en parcial', () => {
    expect(validacion).toMatch(
      /t\(publicadas === 1 \? 'campanas\.validacion\.toast\.publicada\.uno' : 'campanas\.validacion\.toast\.publicada\.otros'/,
    )
    expect(validacion).toMatch(
      /t\(res\.fallidas === 1 \? 'campanas\.validacion\.toast\.parcial\.uno' : 'campanas\.validacion\.toast\.parcial\.otros'/,
    )
    // Ninguna publicada (todas de otro CMS) avisa «ninguna», y el error, error.
    expect(validacion).toMatch(/res\.filas\.length === res\.omitidas\) toast\.info\(t\('campanas\.validacion\.toast\.ninguna'\)\)/)
    expect(validacion).toMatch(/res\.tipo === 'error'\) toast\.error\(t\('campanas\.validacion\.toast\.error'\)\)/)
  })

  it('los fallos de enviar, validar y republicar avisan cada uno el suyo', () => {
    expect(validacion).toMatch(/await enviarADominioApi\(campanaId\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('campanas\.validacion\.no-enviar'\)\)/)
    expect(validacion).toMatch(/mostrarPublicacion\(r\.doohmain\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('campanas\.validacion\.no-validar'\)\)/)
    expect(validacion).toMatch(/reintentarPublicacionApi\(campanaId\)\)\.doohmain\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('campanas\.validacion\.no-republicar'\)\)/)
  })

  it('creativos en DOOHmain: «pausado» al pausar y «reanudado» al reanudar, no al reves', () => {
    expect(creativos).toMatch(
      /confirmar\.accion === 'pausar'\s*\n\s*\? t\('campanas\.doohmain-ahora\.pausado', \{ nombre: confirmar\.cr\.nombre \}\)\s*\n\s*: t\('campanas\.doohmain-ahora\.reanudado', \{ nombre: confirmar\.cr\.nombre \}\)/,
    )
    expect(creativos).toMatch(/e\.message : t\('campanas\.doohmain-ahora\.no-cambiar'\)/)
  })
})
