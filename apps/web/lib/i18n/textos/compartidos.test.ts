import { describe, it, expect } from 'vitest'
import { ES_COMPARTIDOS, EN_COMPARTIDOS, IT_COMPARTIDOS } from './compartidos'
import { UNIDADES } from '../../periodos'
import { PERIODICIDAD_RENTA_LABEL, PERIODICIDAD_VALUES } from '../../renta-periodicidad'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from '../../rejilla'
import { OPCIONES_PERIODO } from '../../../components/demo/finanzas/TableroPeriodo'
import { NOMBRE_DIA, textoHorario, textoReproducciones, textoOrigenDoohmain } from '../../doohmain-programacion'
import { traducir } from '../diccionario'
import { ETIQUETA_SIN_ASIGNAR, etiquetaAsignacion } from '../../../components/demo/razones-sociales/asignacion'

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

  it('los textos de `razones-sociales/asignacion.ts` (costura)', () => {
    expect(ES_COMPARTIDOS['compartidos.asignacion.sin-asignar']).toBe(ETIQUETA_SIN_ASIGNAR)
    const baja = { id: 'a', razonSocial: 'AS Media', activo: false } as never
    expect(traducir('es', 'compartidos.asignacion.baja', { nombre: 'AS Media' })).toBe(etiquetaAsignacion([baja], 'a'))
    expect(ES_COMPARTIDOS['compartidos.asignacion.no-disponible']).toBe(etiquetaAsignacion([], 'zz'))
  })

  it('los textos de `lib/doohmain-programacion.ts` (costura)', () => {
    const es = ES_COMPARTIDOS as Record<string, string>
    NOMBRE_DIA.forEach((d, i) => expect(es[`compartidos.dia.${i}`]).toBe(d))
    const vacia = { cantDia: null, cantTotal: null, horaInicio: null, horaFin: null, dias: null, autoCant: false }
    expect(ES_COMPARTIDOS['compartidos.doohmain.todo-el-dia']).toBe(textoHorario(vacia))
    expect(ES_COMPARTIDOS['compartidos.doohmain.las-que-quepan']).toBe(textoReproducciones(vacia).porDia)
    expect(traducir('es', 'compartidos.doohmain.horario', { desde: '07:00', hasta: '09:00' })).toBe(
      textoHorario({ ...vacia, horaInicio: '07:00', horaFin: '09:00' }),
    )
    const origenes = { ficha: 'ficha', mapa: 'mapa', servidor: 'servidor', ninguna: null } as const
    for (const [k, o] of Object.entries(origenes)) expect(es[`compartidos.doohmain.origen.${k}`]).toBe(textoOrigenDoohmain(o))
  })
})

// Lote L5 del italiano (2026-11-03): el glosario comun de TODAS las pantallas.
describe('diccionario compartidos · el italiano', () => {
  const IT = IT_COMPARTIDOS as Record<string, string>

  it('instantanea', () => {
    expect(IT).toMatchSnapshot()
  })

  it('completo: cada clave espanola tiene su italiano', () => {
    expect(Object.keys(ES_COMPARTIDOS).filter((k) => !IT[k])).toEqual([])
  })

  it('sin espacio antes de %, con el apostrofo tipografico', () => {
    expect(Object.entries(IT).filter(([, v]) => / %/.test(v) || /\w'\w/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('las periodicidades van en letra (ogni due mesi, due volte al mese), nunca con cifra', () => {
    const per = Object.entries(IT).filter(([k]) => k.startsWith('compartidos.periodicidad.'))
    expect(per.filter(([, v]) => /\d/.test(v)).map(([k]) => k)).toEqual([])
    expect(IT['compartidos.periodicidad.bimestral']).toBe('Ogni due mesi')
    expect(IT['compartidos.periodicidad.semestral']).toBe('Ogni sei mesi')
    expect(IT['compartidos.periodicidad.quincenal']).toBe('Due volte al mese')
  })

  it('el selector de periodo dice lo del glosario', () => {
    expect(
      ['mes', 'mes-anterior', 'trimestre', 'trimestre-anterior', 'anio', 'rango'].map((k) => IT[`compartidos.periodo.${k}`]),
    ).toEqual(['Questo mese', 'Mese scorso', 'Questo trimestre', 'Trimestre scorso', 'Quest’anno', 'Intervallo personalizzato'])
  })

  it('los dias de `NOMBRE_DIA` en italiano, de domingo a sabado', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => IT[`compartidos.dia.${i}`])).toEqual(['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'])
  })

  it('la etiqueta del trimestre usa la letra del formato italiano (T1 2026)', () => {
    expect(traducir('it', 'compartidos.periodo.etiqueta.trimestre', { n: 1, anio: 2026 })).toBe('T1 2026')
  })
})
