import { describe, it, expect } from 'vitest'
import { ES_OPERACIONES, EN_OPERACIONES } from './operaciones'
import { DICCIONARIOS } from '../diccionario'

// ============================================================================
//  EL DICCIONARIO DE OPERACIONES, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que `propuestas.test.ts` y `codigos.test.ts`: una instantanea
//  de los dos idiomas, para que ni el espanol (copia literal) ni el ingles
//  cambien sin que el diff de `__snapshots__/` lo enseñe, y las mismas
//  guardias de forma que los otros lotes.
// ============================================================================

const ES = ES_OPERACIONES as Record<string, string>
const EN = EN_OPERACIONES as Record<string, string>

describe('diccionario de OPERACIONES · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_OPERACIONES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_OPERACIONES).toMatchSnapshot()
  })
})

describe('diccionario de OPERACIONES · el ingles no esta en espanol', () => {
  // Iguales en los dos idiomas, cada una con su motivo.
  const IGUALES = new Set<string>([
    'operaciones.slots.total', // «{total} slots»: slots no se traduce
    'operaciones.slots.slots', // idem
    'operaciones.disponibilidad.digital', // «digital» es igual en ingles
    'operaciones.disponibilidad.en-propuesta-spots', // «, {n} spots»: spot no se traduce
    'operaciones.imprenta.error', // «Error» es igual en ingles
    'operaciones.imprenta.campo.material', // «Material» tambien
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(
      Object.entries(EN)
        .filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|«|»|\b(tap|press)\b/i.test(v))
        .map(([k]) => k),
    ).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })

  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) =>
        (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) ||
        (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })

  it('esta dentro del diccionario de la aplicacion', () => {
    for (const k of Object.keys(ES)) {
      expect((DICCIONARIOS.es as Record<string, string>)[k]).toBe(ES[k])
      expect((DICCIONARIOS.en as Record<string, string>)[k]).toBe(EN[k])
    }
  })
})

describe('diccionario de OPERACIONES · los espejos reproducen EXACTAMENTE su modulo', () => {
  // `almacen/page.tsx` traduce `ETIQUETA_TIPO_ACTIVO` y `ETIQUETA_CAMPO` con
  // claves que siguen el nombre del valor (VEHICULO → `tipo.vehiculo`,
  // numeroSerie → `campo.numero-serie`). Los mapas no se exportan (un
  // `page.tsx` de Next no puede), asi que la regla se comprueba aqui.
  it('los tipos de articulo y sus campos (`lib/almacen-tipos.ts`)', async () => {
    const { ETIQUETA_TIPO_ACTIVO, ETIQUETA_CAMPO } = await import('../../almacen-tipos')
    for (const [k, v] of Object.entries(ETIQUETA_TIPO_ACTIVO)) {
      expect(ES[`operaciones.almacen.tipo.${k.toLowerCase()}`]).toBe(v)
    }
    for (const [k, v] of Object.entries(ETIQUETA_CAMPO)) {
      expect(ES[`operaciones.almacen.campo.${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`]).toBe(v)
    }
  })
})
