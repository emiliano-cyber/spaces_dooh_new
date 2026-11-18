import { describe, it, expect } from 'vitest'
import {
  etiquetaUnidad,
  unidadCorta,
  etiquetaCantidad,
  resumenContratacion,
  resumenReserva,
  etiquetaFrecuencia,
  UNIDADES,
} from './periodos'
import { etiquetaCalculadora, previsualizarCalculadora, resolverCalculadora } from './calculadora-spots'
import { periodicidadLabel, PERIODICIDAD_VALUES, PERIODICIDAD_RENTA_LABEL } from './renta-periodicidad'
import { etiquetaEstadoCodigo } from './codigo-aprobacion'
import { avisoFranja, AVISO_FRANJA_NO_VIAJA_AL_CMS } from './rejilla'
import { etiquetaPeriodo, periodoDe } from './finanzas-periodo'

// ============================================================================
//  LOTE «COMPARTIDOS» · las funciones de `lib/` que devuelven texto.
// ----------------------------------------------------------------------------
//  Cada una gano un parametro `idioma` con `'es'` POR OMISION. Dos cosas por
//  funcion:
//    · SIN el parametro (que es como la llaman hoy el servidor, el PDF, los
//      correos y todas las pantallas fuera del lote) sale EXACTAMENTE el
//      espanol de antes;
//    · con `'en'`, el ingles del glosario.
// ============================================================================

describe('periodos · el espanol de siempre sin el parametro', () => {
  it('unidadCorta, etiquetaCantidad, resumenContratacion y etiquetaFrecuencia', () => {
    expect(unidadCorta('spot', 2)).toBe('salidas')
    expect(unidadCorta('mensual', 1)).toBe('mes')
    expect(etiquetaCantidad('cpm', 2500)).toBe('2,500 millares')
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 1200 })).toBe('50 salidas × $ 1,200.00')
    expect(etiquetaFrecuencia(1)).toBe('1 pase al día')
    expect(etiquetaFrecuencia(12)).toBe('12 pases al día')
    for (const u of UNIDADES) expect(etiquetaUnidad(u.unidad)).toBe(u.label)
  })
})

describe('periodos · en ingles', () => {
  it('las unidades, con singular y plural', () => {
    expect(unidadCorta('spot', 2, 'en')).toBe('plays')
    expect(unidadCorta('spot', 1, 'en')).toBe('play')
    expect(unidadCorta('mensual', 3, 'en')).toBe('months')
    expect(unidadCorta('catorcenal', 1, 'en')).toBe('two-week period')
    expect(unidadCorta('catorcenal', 3, 'en')).toBe('two-week periods')
    // «thousand» es invariable tras un numero: «2 thousand», no «2 thousands».
    expect(unidadCorta('cpm', 2, 'en')).toBe('thousand')
    expect(etiquetaUnidad('hora', 'en')).toBe('Per hour')
    expect(etiquetaUnidad('spot', 'en')).toBe('CPS · cost per play')
    expect(etiquetaUnidad('mensual', 'en')).toBe('Monthly')
    // Una unidad que no esta en la tabla sale tal cual, en los dos idiomas.
    expect(unidadCorta('rara', 2, 'en')).toBe('rara')
    expect(etiquetaUnidad('rara', 'en')).toBe('rara')
  })

  it('la cantidad, la contratacion y la frecuencia', () => {
    expect(etiquetaCantidad('cpm', 2500, 'en')).toBe('2,500 thousand')
    expect(resumenContratacion({ unidad: 'cpm', cantidad: 2, tarifaUnitaria: 1000 }, 'en')).toBe('2 thousand × MX$ 1,000.00')
    expect(etiquetaCantidad('mensual', 1, 'en')).toBe('1 month')
    // El importe sale por `formatMonto` con el MISMO idioma: la cifra igual que
    // en espanol, y el simbolo el del lector (dueno, 2026-11-02): en una
    // instancia MXN el ingles escribe `MX$`, nunca un `$` que se lea dolar.
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 1200 }, 'en')).toBe('50 plays × MX$ 1,200.00')
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 1200 })).toBe('50 salidas × $ 1,200.00')
    expect(resumenReserva({ unidad: 'mensual', cantidad: 1, precio: 9000 }, 'en')).toBe('1 month · MX$ 9,000.00')
    expect(resumenReserva({ unidad: 'mensual', cantidad: 1, precio: 9000 })).toBe('1 mes · $ 9,000.00')
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 0 }, 'en')).toBe('50 plays')
    expect(etiquetaFrecuencia(1, 'en')).toBe('1 play per day')
    expect(etiquetaFrecuencia(12, 'en')).toBe('12 plays per day')
    expect(etiquetaFrecuencia(0, 'en')).toBeNull()
  })
})

const LINEA = {
  digital: true, unidad: 'spot', totalSpots: 8, ocupados: 0, espaciosComprados: 2, horasDia: 18,
  horasMaximas: 18, roadblock: false, primaRoadblockPct: null, duracionSeg: 10, dias: 30, libres: 8,
}

describe('calculadora · la etiqueta de la ficha', () => {
  it('en espanol, la de siempre', () => {
    expect(etiquetaCalculadora({ espaciosComprados: 1, horasDia: 18 } as never)).toBe('1 espacio del loop · 18 h al día')
    expect(
      etiquetaCalculadora({ espaciosComprados: 8, horasDia: 18, roadblock: true, primaRoadblockPct: 25 } as never),
    ).toBe('Roadblock · 8 espacios del loop · 18 h al día · prima 25 %')
  })

  it('en ingles', () => {
    expect(etiquetaCalculadora({ espaciosComprados: 1, horasDia: 18 } as never, 'en')).toBe('1 loop slot · 18 h per day')
    expect(
      etiquetaCalculadora({ espaciosComprados: 8, horasDia: 18, roadblock: true, primaRoadblockPct: 25 } as never, 'en'),
    ).toBe('Roadblock · 8 loop slots · 18 h per day · premium 25%')
    expect(etiquetaCalculadora({ espaciosComprados: null } as never, 'en')).toBeNull()
  })
})

describe('calculadora · el motivo de rechazo', () => {
  const motivo = (r: ReturnType<typeof previsualizarCalculadora>) => (r.ok ? null : r.motivo)

  it('en espanol, el de siempre (y el servidor sigue en espanol)', () => {
    expect(motivo(previsualizarCalculadora({ ...LINEA, espaciosComprados: 9 } as never))).toBe(
      'Los espacios del loop van de 1 a 8.',
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, libres: 1 } as never))).toBe(
      'Pides 2 espacios del loop y la pantalla solo tiene 1 libres.',
    )
    expect(motivo(resolverCalculadora({ ...LINEA, digital: false, cantidadEnviada: 1 } as never))).toBe(
      'La calculadora de spots solo aplica a pantallas digitales vendidas por spot.',
    )
  })

  it('en ingles, con el singular donde hace falta', () => {
    expect(motivo(previsualizarCalculadora({ ...LINEA, espaciosComprados: 9 } as never, 'en'))).toBe(
      'Loop slots go from 1 to 8.',
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, libres: 1 } as never, 'en'))).toBe(
      "You’re asking for 2 loop slots and the screen only has 1 free.",
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, espaciosComprados: 1, libres: 0 } as never, 'en'))).toBe(
      "You’re asking for 1 loop slot and the screen only has 0 free.",
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, digital: false } as never, 'en'))).toBe(
      'The spot calculator only applies to digital screens sold per spot.',
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, horasDia: 30 } as never, 'en'))).toBe(
      'Hours per day must be greater than 0 and at most 18: hours beyond what the screen broadcasts would be spots that never play.',
    )
    expect(motivo(previsualizarCalculadora({ ...LINEA, roadblock: true, libres: 3, espaciosComprados: 8 } as never, 'en'))).toBe(
      'A Roadblock needs every loop slot free (8); the screen has 3 free.',
    )
  })
})

describe('periodicidades de renta', () => {
  it('sin el parametro, la tabla de siempre', () => {
    for (const p of PERIODICIDAD_VALUES) expect(periodicidadLabel(p)).toBe(PERIODICIDAD_RENTA_LABEL[p])
    expect(periodicidadLabel(null)).toBe('—')
    expect(periodicidadLabel('rara')).toBe('Rara')
  })

  it('en ingles', () => {
    expect(periodicidadLabel('mensual', '—', 'en')).toBe('Monthly')
    expect(periodicidadLabel('CATORCENAL', '—', 'en')).toBe('Every two weeks')
    expect(periodicidadLabel('QUINCENAL', '—', 'en')).toBe('Twice a month')
    expect(periodicidadLabel(null, '—', 'en')).toBe('—')
  })
})

describe('estado del codigo de negociacion', () => {
  it('en espanol, el de siempre', () => {
    expect(etiquetaEstadoCodigo('PENDIENTE', null)).toBe('Pendiente de aprobación')
    expect(etiquetaEstadoCodigo('APROBADO', 'Ana')).toBe('Aprobado por Ana')
    expect(etiquetaEstadoCodigo('APROBADO', null)).toBe('Aprobado')
    expect(etiquetaEstadoCodigo(null, null)).toBeNull()
  })

  it('en ingles', () => {
    expect(etiquetaEstadoCodigo('PENDIENTE', null, 'en')).toBe('Pending approval')
    expect(etiquetaEstadoCodigo('APROBADO', 'Ana', 'en')).toBe('Approved by Ana')
    expect(etiquetaEstadoCodigo('APROBADO', null, 'en')).toBe('Approved')
  })
})

describe('aviso de la franja', () => {
  it('la constante y el espanol no cambian; el ingles es otro texto', () => {
    expect(avisoFranja()).toBe(AVISO_FRANJA_NO_VIAJA_AL_CMS)
    expect(avisoFranja('en')).toMatch(/^The daypart is a commercial commitment/)
  })
})

describe('la etiqueta del periodo que manda el servidor', () => {
  const hoy = '2026-11-15'
  it('en espanol se deja tal cual llega', () => {
    for (const tipo of ['mes', 'mes-anterior', 'trimestre', 'trimestre-anterior', 'anio'] as const) {
      const p = periodoDe(tipo, hoy)
      expect(etiquetaPeriodo(p)).toBe(p.etiqueta)
    }
  })

  it('en ingles se rearma desde el dato', () => {
    expect(etiquetaPeriodo(periodoDe('mes', hoy), 'en')).toBe('November 2026')
    expect(etiquetaPeriodo(periodoDe('mes-anterior', '2026-01-10'), 'en')).toBe('December 2025')
    expect(etiquetaPeriodo(periodoDe('trimestre', hoy), 'en')).toBe('Q4 2026')
    expect(etiquetaPeriodo(periodoDe('anio', hoy), 'en')).toBe('2026')
    expect(
      etiquetaPeriodo(periodoDe('rango', hoy, { desde: '2026-12-01', hasta: '2026-12-31' }), 'en'),
    ).toBe('Dec 1, 2026 to Dec 31, 2026')
    // Algo que no reconoce se deja como llego, en vez de inventar.
    expect(etiquetaPeriodo({ etiqueta: 'Otra cosa' }, 'en')).toBe('Otra cosa')
  })
})
