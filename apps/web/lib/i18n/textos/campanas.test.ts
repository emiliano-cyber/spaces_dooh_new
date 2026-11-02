import { describe, it, expect } from 'vitest'
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

  it('AVISO_PANTALLA_DOOHMAIN', () => {
    expect(es('campanas.validacion.aviso-pantalla')).toBe(AVISO_PANTALLA_DOOHMAIN)
  })
})
