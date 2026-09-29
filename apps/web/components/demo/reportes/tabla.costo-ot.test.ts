import { describe, it, expect } from 'vitest'
import { avisosDelReporte, columnasDeDimension, type ReporteParaAvisos } from './tabla'
import type { CoberturaCostoOt } from '@/lib/data/reportes'

// ============================================================================
//  OT-COSTO-01 · lo que la PANTALLA del reporte dice sobre el costo de operación
//  y sobre el margen bruto.
// ----------------------------------------------------------------------------
//  Estas pruebas nacieron MATANDO MUTANTES, no leyendo. Tres mutantes del lote
//  del 2026-09-29 **sobrevivieron** con el motor entero en verde:
//
//   · quitar el aviso de cobertura del costo (`if (false && r.costosReales)`)
//   · dejarlo SIEMPRE en gris, nunca en ámbar
//   · pintar «bruto no es neto» en TODAS las dimensiones, también en las tres
//     que no tienen columna de margen
//
//  Los tres son fallos reales y ninguno rompía una sola prueba: el motor
//  redacta la nota y estaba probado, pero **que la pantalla la enseñe no lo
//  miraba nadie**. Es el mismo hueco que este repositorio ya pagó con el tono de
//  los avisos, que vivía dentro del `.tsx` hasta el 2026-09-18.
// ============================================================================

const HOY = new Date('2026-05-15T12:00:00Z')

// Un rango CERRADO (ya terminado), para que no salte el aviso del periodo en
// curso y las listas de claves sean exactamente lo que se quiere medir.
const BASE: ReporteParaAvisos = {
  dimension: 'operacion',
  desde: '2026-01-01',
  hasta: '2026-03-31',
  hoy: HOY,
  filas: [
    {
      clave: 's1',
      etiqueta: 'Pantalla Uno',
      ingreso: 100_000,
      costoEspacio: 10_000,
      costoOperacion: 13_500,
      costoEnergia: 0,
      costoTotal: 23_500,
      margenBruto: 76_500,
      margenBrutoPct: 76.5,
      visitas: 3,
      tieneContrato: true,
    },
  ],
}

function cobertura(over: Partial<CoberturaCostoOt> = {}): CoberturaCostoOt {
  return {
    visitasConCostoReal: 2,
    visitasConEstimacion: 1,
    costoRealCapturado: 12_000,
    costoEstimado: 1_500,
    nota: 'NOTA DEL MOTOR',
    ...over,
  }
}

const claves = (r: ReporteParaAvisos) => avisosDelReporte(r).map((a) => a.clave)
const aviso = (r: ReporteParaAvisos, clave: string) =>
  avisosDelReporte(r).find((a) => a.clave === clave)

// ════════════════════════════════════════════════════════════════════════════
//  1 · El aviso de cobertura del costo (mata M5 y M6)
// ════════════════════════════════════════════════════════════════════════════

describe('1 · el aviso que dice cuántas visitas van medidas y cuántas estimadas', () => {
  it('SALE cuando el reporte trae la cobertura', () => {
    expect(claves({ ...BASE, costosReales: cobertura() })).toContain('ot-costo-real')
  })

  it('pinta la nota del MOTOR verbatim, sin reescribirla', () => {
    // Si la pantalla redactara su propia frase, sería la segunda implementación
    // de la misma y divergirían: la tabla explicaría un hueco distinto del real.
    const a = aviso({ ...BASE, costosReales: cobertura({ nota: 'FRASE EXACTA' }) }, 'ot-costo-real')
    expect(a!.texto).toBe('FRASE EXACTA')
  })

  it('va en ÁMBAR cuando alguna visita entra con la estimación', () => {
    // Ámbar = «las cifras que estás viendo no son las definitivas», que es
    // exactamente lo que pasa cuando parte del costo es una estimación.
    const a = aviso({ ...BASE, costosReales: cobertura({ visitasConEstimacion: 1 }) }, 'ot-costo-real')
    expect(a!.tono).toBe('alerta')
  })

  it('y en GRIS cuando todas tienen su costo real', () => {
    // Gris = «esto es lo que el reporte no mide», y aquí no falta nada: la nota
    // sigue haciendo falta, pero no es una advertencia.
    const a = aviso(
      { ...BASE, costosReales: cobertura({ visitasConEstimacion: 0, costoEstimado: 0 }) },
      'ot-costo-real',
    )
    expect(a!.tono).toBe('info')
  })

  it('SALE TAMBIÉN sin ningún hueco: su primera frase hace falta siempre', () => {
    expect(
      claves({ ...BASE, costosReales: cobertura({ visitasConEstimacion: 0, costoEstimado: 0 }) }),
    ).toContain('ot-costo-real')
  })

  it('NEGATIVO · sin cobertura (las otras dimensiones) el aviso NO sale', () => {
    expect(claves(BASE)).not.toContain('ot-costo-real')
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  2 · «margen bruto no es margen neto» (mata M7)
// ════════════════════════════════════════════════════════════════════════════

describe('2 · el aviso de que el margen es BRUTO', () => {
  const CON_MARGEN = ['sitio', 'trimestre', 'operacion', 'm2', 'luz'] as const
  const SIN_MARGEN = ['entidad', 'tarifa', 'vendedor'] as const

  it('sale en las CINCO dimensiones que pintan una columna de margen', () => {
    for (const dimension of CON_MARGEN) {
      expect(claves({ ...BASE, dimension }), dimension).toContain('margen-bruto-no-neto')
    }
  })

  it('NEGATIVO · NO sale en `entidad`, `tarifa` ni `vendedor`', () => {
    // Las tres no pintan margen, así que el aviso hablaría de una columna que no
    // está en la pantalla. `entidad` ya dice lo suyo con `saldoAtribuido`.
    for (const dimension of SIN_MARGEN) {
      expect(claves({ ...BASE, dimension }), dimension).not.toContain('margen-bruto-no-neto')
    }
  })

  it('la condición se DERIVA del catálogo de columnas, no de una lista a mano', () => {
    // El guard que hace que las dos listas de arriba no puedan mentir: se
    // comprueban contra `columnasDeDimension`, que es de donde sale la condición
    // real. Si alguien añade el margen a otra dimensión, este caso obliga a que
    // el aviso la siga.
    for (const dimension of [...CON_MARGEN, ...SIN_MARGEN]) {
      const pintaMargen = columnasDeDimension(dimension).some((c) => c.clave === 'margenBruto')
      expect(claves({ ...BASE, dimension }).includes('margen-bruto-no-neto'), dimension).toBe(
        pintaMargen,
      )
    }
  })

  it('dice que NO es el neto, y que faltan datos que nadie captura', () => {
    // Es la mitad del trabajo del aviso. Sin esto, pasaría con un texto que solo
    // dijera «es bruto», que es justo lo que invita a pedir «entonces dame el
    // neto» — y el neto no se calcula restando nada de esta tabla.
    const t = aviso(BASE, 'margen-bruto-no-neto')!.texto
    expect(t).toMatch(/no es el margen neto/i)
    expect(t).toMatch(/indirectos/i)
    expect(t).toMatch(/nómina|nomina/i)
    expect(t).toMatch(/no captura ninguno/i)
  })

  it('está escrito para el dueño de una empresa, no para un programador', () => {
    const t = aviso(BASE, 'margen-bruto-no-neto')!.texto
    for (const jerga of ['costoOperacion', 'margenBruto', 'null', 'endpoint', 'query', 'NaN']) {
      expect(t, jerga).not.toContain(jerga)
    }
  })

  it('va en GRIS: no advierte de nada, declara lo que la columna ES', () => {
    expect(aviso(BASE, 'margen-bruto-no-neto')!.tono).toBe('info')
  })
})
