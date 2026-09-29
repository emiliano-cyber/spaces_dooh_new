import { describe, it, expect } from 'vitest'
import {
  rentabilidadPorSitio,
  rentabilidadPorOperacion,
  rentabilidadPorEntidad,
  rentabilidadPorTarifa,
} from './reportes'
import { COSTOS_OT_RESPALDO } from '../costos-ot'

// ============================================================================
//  OT-COSTO-01 · el costo REAL de una orden de trabajo, y que el reporte diga
//  cuántas van con él y cuántas con la estimación.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-29. Lo que el reporte llamaba «costo de
//  operación» NO era un costo: era una TARIFA POR TIPO (`config_negocio.
//  costos_ot`, ADR 0011), así que una herrería de $12,000 y otra de $800
//  entraban por el mismo importe.
//
//  Las DOS propiedades que estas pruebas fijan, y que son el cambio entero:
//
//   1. EL COSTO CAPTURADO SUSTITUYE LA TARIFA DEL TIPO, no se suma a ella. La
//      tarifa por tipo es la ESTIMACIÓN del costo de la orden entera —eso dice
//      `costos-ot.ts` de su propio valor— así que sumar los dos cobraría dos
//      veces la misma visita. Y el error no se vería: daría un costo más alto y
//      un margen más bajo, la dirección en la que nadie sospecha de una cifra.
//
//   2. LA MEZCLA SE DECLARA. Un total que junta costos reales con estimaciones
//      sin decirlo es un número que nadie puede interpretar: no se sabe si
//      «costó eso» o «se estima que costó eso». Misma doctrina que
//      `CoberturaEnergia`, `ExclusionesM2`, `AtribucionEntidad`,
//      `CoberturaTarifa` y `CoberturaVendedor`.
//
//  Todas las cifras están calculadas A MANO en los comentarios.
// ============================================================================

function baseDatos(over: Record<string, unknown>): any {
  const vacio = { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [] }
  return { ...vacio, ...over }
}

const SITIOS = [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Pantalla Uno', claveInterna: 'K1' }]

const Q1 = { desde: '2026-01-01', hasta: '2026-03-31' }
const TRIM = { ...Q1, granularidad: 'trimestre' as const }

/** Una OT dentro del rango, por fecha de completada. */
function ot(over: Record<string, unknown> = {}) {
  return {
    id: 'OT1',
    sitioId: 'S1',
    tipo: 'HERRERIA',
    estatus: 'COMPLETADA',
    fechaCompletada: '2026-02-10',
    fechaProgramada: null,
    creadoEn: '2026-01-05',
    costoReal: null,
    ...over,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  1 · SUSTITUYE, no suma
// ════════════════════════════════════════════════════════════════════════════

describe('1 · el costo real SUSTITUYE la tarifa del tipo', () => {
  it('una OT con costo capturado vale ESE importe, no el del tipo', () => {
    // Una sola OT de HERRERIA con costo real 12 000. El respaldo del tipo es
    // 1 500. Si sustituye → 12 000. Si sumara → 13 500.
    const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [ot({ costoReal: 12000 })] })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas.find((f) => f.clave === 'S1')!.costoOperacion).toBe(12000)
  })

  it('y tampoco suma cuando el tipo SÍ está configurado', () => {
    // HERRERIA configurada a 4 000 y la OT con costo real 900. Sustituye → 900.
    // Sumaría → 4 900. El caso que separa «sustituye» de «suma» sin que el
    // respaldo se meta en medio.
    const datos = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [ot({ costoReal: 900 })],
      costosOt: { HERRERIA: 4000 },
    })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas.find((f) => f.clave === 'S1')!.costoOperacion).toBe(900)
  })

  it('un costo real de CERO es un costo real, y vale cero', () => {
    // El caso que un `costoReal || estimacion` rompería en silencio: 0 es
    // falsy. Una inspección que hace el propio dueño no paga cuadrilla, y
    // `costos-ot.ts` ya acepta el 0 a propósito por el mismo motivo.
    const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [ot({ costoReal: 0 })] })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas.find((f) => f.clave === 'S1')!.costoOperacion).toBe(0)
  })

  it('NEGATIVO · una OT sin costo capturado sigue usando la estimación por tipo', () => {
    // El caso que garantiza que este cambio no mueve ni un importe el día que
    // se despliega: nadie ha capturado nada todavía.
    const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [ot({ costoReal: null })] })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas.find((f) => f.clave === 'S1')!.costoOperacion).toBe(COSTOS_OT_RESPALDO.HERRERIA)
  })

  it('NEGATIVO · `undefined` (la columna que aún no viaja) también cae a la estimación', () => {
    const sinCampo = { ...ot() }
    delete (sinCampo as Record<string, unknown>).costoReal
    const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [sinCampo] })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas.find((f) => f.clave === 'S1')!.costoOperacion).toBe(COSTOS_OT_RESPALDO.HERRERIA)
  })

  it('el costo real entra en el MES de la OT, no repartido', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [
        ot({ id: 'OT1', costoReal: 12000, fechaCompletada: '2026-02-10' }),
        ot({ id: 'OT2', costoReal: 300, fechaCompletada: '2026-03-04' }),
      ],
    })
    const r = rentabilidadPorSitio(datos, { ...Q1, granularidad: 'mes' })
    expect(r.filas.find((f) => f.clave === 'S1')!.periodos.map((p) => p.costoOperacion)).toEqual([
      0, 12000, 300,
    ])
  })

  it('una OT CANCELADA con costo capturado no cuesta nada', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [ot({ estatus: 'CANCELADA', costoReal: 12000 })],
    })
    const r = rentabilidadPorSitio(datos, TRIM)
    expect(r.filas).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  2 · La cobertura: cuántas van con costo real y cuántas con la estimación
// ════════════════════════════════════════════════════════════════════════════

describe('2 · el reporte DICE cuántas van con costo real y cuántas con estimación', () => {
  // Tres OT en el rango:
  //   OT1 HERRERIA   costo real 12 000
  //   OT2 INSPECCION costo real 0        ← real, y cero
  //   OT3 ELECTRICO  sin capturar        → estimación 1 500 (respaldo)
  //  ⇒ 2 con real por 12 000, 1 con estimación por 1 500. Total 13 500.
  const datos = baseDatos({
    sitios: SITIOS,
    ordenesTrabajo: [
      ot({ id: 'OT1', tipo: 'HERRERIA', costoReal: 12000, fechaCompletada: '2026-01-10' }),
      ot({ id: 'OT2', tipo: 'INSPECCION', costoReal: 0, fechaCompletada: '2026-02-10' }),
      ot({ id: 'OT3', tipo: 'ELECTRICO', costoReal: null, fechaCompletada: '2026-03-10' }),
    ],
  })

  it('cuenta las visitas de cada clase y suma sus importes por separado', () => {
    const c = rentabilidadPorOperacion(datos, TRIM).costosReales!
    expect(c.visitasConCostoReal).toBe(2)
    expect(c.visitasConEstimacion).toBe(1)
    expect(c.costoRealCapturado).toBe(12000)
    expect(c.costoEstimado).toBe(COSTOS_OT_RESPALDO.ELECTRICO)
  })

  it('las dos sumas son EXACTAMENTE el costo de operación de la tabla', () => {
    // Si divergieran, el aviso explicaría un total distinto del que se ve.
    const r = rentabilidadPorOperacion(datos, TRIM)
    const c = r.costosReales!
    expect(c.costoRealCapturado + c.costoEstimado).toBe(r.totales.costoOperacion)
  })

  it('la nota dice SIEMPRE qué es el costo de operación, y luego el hueco', () => {
    const nota = rentabilidadPorOperacion(datos, TRIM).costosReales!.nota
    expect(nota).toContain('estimación')
    expect(nota).toContain('1 de las 3')
  })

  it('la nota SALE TAMBIÉN cuando todas tienen costo real', () => {
    // «Todo real» y «no te lo digo» se ven igual sin texto. Y su primera frase
    // —que el costo de operación puede ser estimado— hace falta siempre.
    const todas = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [ot({ id: 'OT1', costoReal: 12000 }), ot({ id: 'OT2', costoReal: 500 })],
    })
    const c = rentabilidadPorOperacion(todas, TRIM).costosReales!
    expect(c.visitasConEstimacion).toBe(0)
    // La primera frase —qué ES el costo de operación— va siempre.
    expect(c.nota).toContain('El costo de operación se arma de dos fuentes')
    // Y la segunda afirma que aquí no hay estimación, en vez de callarse.
    expect(c.nota).toContain('no hay ninguna estimación')
    // Lo que NO debe decir: que algo entra con la estimación. Sin esta línea la
    // prueba pasaría con la nota del caso contrario, que también contiene
    // «estimación» en su primera frase.
    expect(c.nota).not.toContain('entran con la estimación por tipo')
  })

  it('la nota SALE TAMBIÉN cuando no hay ninguna visita', () => {
    const c = rentabilidadPorOperacion(baseDatos({ sitios: SITIOS }), TRIM).costosReales!
    expect(c.visitasConCostoReal).toBe(0)
    expect(c.visitasConEstimacion).toBe(0)
    expect(c.nota.length).toBeGreaterThan(0)
  })

  it('NEGATIVO · una OT CANCELADA no entra en ninguno de los dos recuentos', () => {
    const conCancelada = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [ot({ id: 'OT1', costoReal: 12000 }), ot({ id: 'OT2', estatus: 'CANCELADA', costoReal: 99000 })],
    })
    const c = rentabilidadPorOperacion(conCancelada, TRIM).costosReales!
    expect(c.visitasConCostoReal).toBe(1)
    expect(c.costoRealCapturado).toBe(12000)
  })

  it('NEGATIVO · una OT FUERA del rango no entra en el recuento', () => {
    const fuera = baseDatos({
      sitios: SITIOS,
      ordenesTrabajo: [ot({ id: 'OT1', costoReal: 12000, fechaCompletada: '2026-08-01' })],
    })
    const c = rentabilidadPorOperacion(fuera, TRIM).costosReales!
    expect(c.visitasConCostoReal).toBe(0)
    expect(c.costoRealCapturado).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  3 · Lo que NO debe cambiar
// ════════════════════════════════════════════════════════════════════════════

describe('3 · las dimensiones que no son `operacion` no ganan la cobertura', () => {
  const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [ot({ costoReal: 12000 })] })

  it('`sitio` no trae `costosReales` — su aviso pertenece a `operacion`', () => {
    // Mismo criterio que `CoberturaEnergia`, que solo viaja en `luz` aunque el
    // costo de la luz entre en el margen de todas.
    expect(rentabilidadPorSitio(datos, TRIM).costosReales).toBeUndefined()
  })

  it('`entidad` y `tarifa` siguen SIN heredar margen ni costo de operación', () => {
    const e = rentabilidadPorEntidad(datos, TRIM)
    const t = rentabilidadPorTarifa(datos, TRIM)
    expect(e.costosReales).toBeUndefined()
    expect(t.costosReales).toBeUndefined()
  })
})

describe('4 · MARGEN BRUTO — el nombre dice lo que es', () => {
  it('la fila y los totales exponen `margenBruto`, no `margen`', () => {
    const datos = baseDatos({ sitios: SITIOS, ordenesTrabajo: [ot({ costoReal: 1000 })] })
    const r = rentabilidadPorSitio(datos, TRIM)
    const f = r.filas.find((x) => x.clave === 'S1')!
    // ingreso 0 − espacio 0 − operación 1 000 − luz 0 = −1 000
    expect(f.margenBruto).toBe(-1000)
    expect(r.totales.margenBruto).toBe(-1000)
    expect((f as unknown as Record<string, unknown>).margen).toBeUndefined()
    expect((r.totales as unknown as Record<string, unknown>).margen).toBeUndefined()
  })
})
