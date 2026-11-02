import { describe, it, expect } from 'vitest'
import { ES_COMPARTIDOS, EN_COMPARTIDOS } from './compartidos'
import { UNIDADES } from '../../periodos'
import { PERIODICIDAD_RENTA_LABEL, PERIODICIDAD_VALUES } from '../../renta-periodicidad'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from '../../rejilla'
import { OPCIONES_PERIODO } from '../../../components/demo/finanzas/TableroPeriodo'

// ============================================================================
//  EL DICCIONARIO DE LOS MODULOS COMPARTIDOS, CONGELADO.
// ----------------------------------------------------------------------------
//  Igual que `propuestas.test.ts`: una instantanea de los dos idiomas. Muchas
//  de estas entradas no salen en ninguna pantalla rendida (los motivos de la
//  calculadora, el error del candado, las periodicidades que no se eligen):
//  sin la instantanea, cambiar una letra del espanol pasaria sin ruido.
//
//  Y una cosa mas que el piloto no necesito: varias tablas en espanol SIGUEN
//  viviendo en su modulo (`UNIDADES`, `PERIODICIDAD_RENTA_LABEL`,
//  `OPCIONES_PERIODO`, `AVISO_FRANJA_NO_VIAJA_AL_CMS`) porque las usan el
//  servidor y otras pantallas. Aqui se exige que el diccionario diga
//  EXACTAMENTE lo mismo, como el menu con `nav.ts`: si alguien cambia una,
//  esta prueba le obliga a traer la otra.
// ============================================================================

describe('diccionario compartidos · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_COMPARTIDOS).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_COMPARTIDOS).toMatchSnapshot()
  })
})

describe('diccionario compartidos · el ingles no esta en espanol', () => {
  it('ninguna entrada inglesa es igual a la espanola', () => {
    const iguales = Object.keys(ES_COMPARTIDOS).filter(
      (k) => ES_COMPARTIDOS[k as keyof typeof ES_COMPARTIDOS] === EN_COMPARTIDOS[k as keyof typeof EN_COMPARTIDOS],
    )
    expect(iguales).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    const malas = Object.entries(EN_COMPARTIDOS)
      .filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡º]/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })

  it('en ingles no hay espacio antes de %', () => {
    const malas = Object.entries(EN_COMPARTIDOS)
      .filter(([, v]) => / %/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })
})

describe('diccionario compartidos · el espanol reproduce las tablas de su modulo', () => {
  it('UNIDADES (label, corta y plural)', () => {
    const es = ES_COMPARTIDOS as Record<string, string>
    for (const u of UNIDADES) {
      expect(es[`compartidos.unidad.${u.unidad}`]).toBe(u.label)
      expect(es[`compartidos.unidad.${u.unidad}.uno`]).toBe(u.corta)
      expect(es[`compartidos.unidad.${u.unidad}.otros`]).toBe(u.plural)
    }
  })

  it('PERIODICIDAD_RENTA_LABEL', () => {
    const es = ES_COMPARTIDOS as Record<string, string>
    for (const p of PERIODICIDAD_VALUES) {
      expect(es[`compartidos.periodicidad.${p.toLowerCase()}`]).toBe(PERIODICIDAD_RENTA_LABEL[p])
    }
  })

  it('OPCIONES_PERIODO', () => {
    const es = ES_COMPARTIDOS as Record<string, string>
    for (const o of OPCIONES_PERIODO) expect(es[`compartidos.periodo.${o.tipo}`]).toBe(o.label)
  })

  it('AVISO_FRANJA_NO_VIAJA_AL_CMS', () => {
    expect(ES_COMPARTIDOS['compartidos.franja.aviso']).toBe(AVISO_FRANJA_NO_VIAJA_AL_CMS)
  })
})
