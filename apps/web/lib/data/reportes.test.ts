import { describe, it, expect } from 'vitest'
import { rentabilidadPorSitio, bucketsDelRango, mesesEquivalentes } from './reportes'
import { COSTOS_OT_RESPALDO } from '../costos-ot'

// ============================================================================
//  Prorrateo por periodo — el corazón del reporte de rentabilidad.
// ----------------------------------------------------------------------------
//  Lo que ya existía (`margenPorSitio`, derive.ts:1278) es una FOTO DE HOY:
//  filtra las reservas con `ini <= hoy && fin >= hoy` (derive.ts:1285) y no sabe
//  de periodos. Un reporte que verá historia de años necesita repartir cada
//  reserva por los días que caen dentro del rango pedido, y eso es lógica nueva.
//
//  La atribución de la renta del predio entre las caras de sus pantallas NO se
//  rehace: se reusa `rentaAtribuidaPorSitio()` (derive.ts:1252), que ya está
//  pensada y probada en `derive.anclaje-contrato.test.ts`.
//
//  Todas las cifras de estas pruebas están calculadas A MANO en los comentarios.
//  Un reporte de dinero cuyo número esperado sale de correr el propio código no
//  prueba nada.
// ============================================================================

function baseDatos(over: Record<string, unknown>): any {
  const vacio = { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [] }
  return { ...vacio, ...over }
}

// Predio P1 con DOS pantallas de 1 cara cada una (Σ caras = 2).
// Contrato C1 VIGENTE del 2026-01-01 al 2026-12-31, renta 10 000 MENSUAL.
//   ⇒ renta atribuida = 10 000 × (1 / 2) = 5 000 al mes por pantalla.
const ESCENARIO = baseDatos({
  sitios: [
    { id: 'S1', predioId: 'P1', caras: 1, nombre: 'Pantalla Uno', claveInterna: 'K1' },
    { id: 'S2', predioId: 'P1', caras: 1, nombre: 'Pantalla Dos', claveInterna: 'K2' },
  ],
  contratos: [
    {
      id: 'C1', predioId: 'P1', sitioId: 'S1', arrendadorId: 'A1',
      montoRenta: 10000, periodicidad: 'MENSUAL', estatus: 'VIGENTE',
      fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
    },
  ],
  arrendadores: [{ id: 'A1', nombre: 'Arrendador Uno' }],
  reservas: [
    // R1 CRUZA el borde del trimestre: del 15/03 al 15/04.
    //   días totales = (17 de marzo) + (15 de abril) = 32
    //   precio 31 000
    { id: 'R1', sitioId: 'S1', campanaId: 'CAMP1', precio: 31000, estatus: 'CONFIRMADA', fechaInicio: '2026-03-15', fechaFin: '2026-04-15' },
  ],
})

const Q1 = { desde: '2026-01-01', hasta: '2026-03-31' }

describe('bucketsDelRango — el eje de tiempo', () => {
  it('por mes parte el trimestre en tres meses de calendario', () => {
    const b = bucketsDelRango(Q1, 'mes')
    expect(b.map((x) => x.clave)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(b[1]).toMatchObject({ desde: '2026-02-01', hasta: '2026-02-28' })
  })

  it('por trimestre da UN bucket etiquetado T1', () => {
    const b = bucketsDelRango(Q1, 'trimestre')
    expect(b.map((x) => x.clave)).toEqual(['2026-T1'])
    expect(b[0].etiqueta).toBe('T1 2026')
    expect(b[0]).toMatchObject({ desde: '2026-01-01', hasta: '2026-03-31' })
  })

  it('recorta el primer y el ultimo bucket al rango pedido', () => {
    const b = bucketsDelRango({ desde: '2026-02-10', hasta: '2026-03-05' }, 'mes')
    expect(b[0]).toMatchObject({ clave: '2026-02', desde: '2026-02-10', hasta: '2026-02-28' })
    expect(b[1]).toMatchObject({ clave: '2026-03', desde: '2026-03-01', hasta: '2026-03-05' })
  })

  it('un rango que cruza el año no mezcla los trimestres de años distintos', () => {
    const b = bucketsDelRango({ desde: '2026-12-01', hasta: '2027-01-31' }, 'trimestre')
    expect(b.map((x) => x.clave)).toEqual(['2026-T4', '2027-T1'])
  })
})

describe('mesesEquivalentes — de dias de calendario a meses de renta', () => {
  // Un mes COMPLETO es 1 mes, independientemente de que tenga 28, 30 o 31 días.
  // Dividir por 30 fijo haría que febrero costara 28/30 de mes y julio 31/30:
  // la renta mensual de un contrato se paga una vez por mes, no por día.
  it('un mes natural completo vale 1, tenga 28 o 31 dias', () => {
    expect(mesesEquivalentes('2026-02-01', '2026-02-28')).toBe(1)
    expect(mesesEquivalentes('2026-07-01', '2026-07-31')).toBe(1)
  })

  it('un trimestre completo vale 3', () => {
    expect(mesesEquivalentes('2026-01-01', '2026-03-31')).toBe(3)
  })

  // 16 de los 31 días de marzo.
  it('medio mes vale la fraccion de sus dias naturales', () => {
    expect(mesesEquivalentes('2026-03-16', '2026-03-31')).toBeCloseTo(16 / 31, 10)
  })

  it('un rango invertido vale 0, no negativo', () => {
    expect(mesesEquivalentes('2026-03-31', '2026-03-01')).toBe(0)
  })
})

describe('rentabilidadPorSitio — prorrateo de la reserva que cruza el borde', () => {
  // ─── Cuenta a mano, trimestre 2026-T1 ────────────────────────────────────
  //  Ingreso S1: R1 aporta solo los 17 días que caen en marzo:
  //      31 000 × 17 / 32 = 527 000 / 32 = 16 468.75
  //  Costo de espacio S1: 5 000 × 3 meses (ene + feb + mar, todos dentro de la
  //  vigencia del contrato) = 15 000
  //  Margen S1 = 16 468.75 − 15 000 = 1 468.75
  it('una reserva que cruza el borde del trimestre aporta SOLO la parte proporcional', () => {
    const r = rentabilidadPorSitio(ESCENARIO, { ...Q1, granularidad: 'trimestre' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.ingreso).toBe(16468.75)
    expect(s1.costoEspacio).toBe(15000)
    expect(s1.margen).toBe(1468.75)
  })

  it('los 15 dias de abril NO se cuentan en el trimestre 1', () => {
    const r = rentabilidadPorSitio(ESCENARIO, { ...Q1, granularidad: 'trimestre' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    // Si el prorrateo no existiera, aquí saldría el precio íntegro.
    expect(s1.ingreso).not.toBe(31000)
  })

  // El resto de la reserva cae en T2: 31 000 × 15 / 32 = 465 000 / 32 = 14 531.25
  // Y las dos partes SUMAN el precio: 16 468.75 + 14 531.25 = 31 000. Que el
  // reparto no pierda ni invente dinero es la propiedad que lo hace usable.
  it('el trimestre siguiente se lleva el resto, y las dos partes suman el precio', () => {
    const t2 = rentabilidadPorSitio(ESCENARIO, {
      desde: '2026-04-01', hasta: '2026-06-30', granularidad: 'trimestre',
    })
    const s1 = t2.filas.find((f) => f.clave === 'S1')!
    expect(s1.ingreso).toBe(14531.25)
    expect(16468.75 + 14531.25).toBe(31000)
  })

  it('por mes, el ingreso cae entero en marzo y los otros dos meses solo cuestan', () => {
    const r = rentabilidadPorSitio(ESCENARIO, { ...Q1, granularidad: 'mes' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.periodos.map((p) => p.clave)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(s1.periodos.map((p) => p.ingreso)).toEqual([0, 0, 16468.75])
    expect(s1.periodos.map((p) => p.costoEspacio)).toEqual([5000, 5000, 5000])
    // La suma de los periodos es la fila: un desglose que no cuadra con su total
    // es peor que no tener desglose.
    expect(s1.periodos.reduce((a, p) => a + p.ingreso, 0)).toBe(s1.ingreso)
    expect(s1.periodos.reduce((a, p) => a + p.costoEspacio, 0)).toBe(s1.costoEspacio)
  })

  it('la pantalla hermana del predio paga su mitad de renta sin ingreso ninguno', () => {
    const r = rentabilidadPorSitio(ESCENARIO, { ...Q1, granularidad: 'trimestre' })
    const s2 = r.filas.find((f) => f.clave === 'S2')!
    expect(s2.ingreso).toBe(0)
    expect(s2.costoEspacio).toBe(15000)
    expect(s2.margen).toBe(-15000)
    // Sin ingreso no hay porcentaje de margen: un «0 %» sobre 15 000 de costo
    // se lee como «no gana ni pierde», que es justo lo contrario.
    expect(s2.margenPct).toBeNull()
  })

  it('un rango de medio mes cobra la fraccion de renta, no el mes entero', () => {
    const r = rentabilidadPorSitio(ESCENARIO, {
      desde: '2026-03-16', hasta: '2026-03-31', granularidad: 'mes',
    })
    const s2 = r.filas.find((f) => f.clave === 'S2')!
    // 5 000 × 16/31 = 2 580.6451... → se redondea a dos decimales al salir.
    expect(s2.costoEspacio).toBeCloseTo(5000 * (16 / 31), 2)
  })
})

describe('rentabilidadPorSitio — negativos', () => {
  it('una reserva CANCELADA no suma', () => {
    const datos = baseDatos({
      ...ESCENARIO,
      reservas: [
        { id: 'R9', sitioId: 'S1', campanaId: 'CAMP1', precio: 99999, estatus: 'CANCELADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
    })
    const r = rentabilidadPorSitio(datos, { ...Q1, granularidad: 'trimestre' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.ingreso).toBe(0)
  })

  it('una reserva TENTATIVA si suma: el lugar ya esta apartado', () => {
    const datos = baseDatos({
      ...ESCENARIO,
      reservas: [
        { id: 'R8', sitioId: 'S1', campanaId: 'CAMP1', precio: 2800, estatus: 'TENTATIVA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
    })
    const r = rentabilidadPorSitio(datos, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.find((f) => f.clave === 'S1')!.ingreso).toBe(2800)
  })

  it('una reserva FUERA del rango no aporta nada', () => {
    const datos = baseDatos({
      ...ESCENARIO,
      reservas: [
        { id: 'R7', sitioId: 'S1', campanaId: 'CAMP1', precio: 5000, estatus: 'CONFIRMADA', fechaInicio: '2025-01-01', fechaFin: '2025-01-31' },
      ],
    })
    const r = rentabilidadPorSitio(datos, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.find((f) => f.clave === 'S1')!.ingreso).toBe(0)
  })

  // Sin datos no hay reporte vacío con ruido: hay CERO filas. Y no es un error.
  it('un rango sin movimiento ninguno da CERO filas, no un error', () => {
    const r = rentabilidadPorSitio(ESCENARIO, {
      desde: '2020-01-01', hasta: '2020-01-31', granularidad: 'mes',
    })
    expect(r.filas).toEqual([])
    expect(r.totales.ingreso).toBe(0)
  })

  it('una pantalla sin contrato ni reservas no ensucia el reporte', () => {
    const datos = baseDatos({
      ...ESCENARIO,
      sitios: [...ESCENARIO.sitios, { id: 'S9', predioId: null, caras: 1, nombre: 'Huerfana', claveInterna: 'K9' }],
    })
    const r = rentabilidadPorSitio(datos, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.map((f) => f.clave)).not.toContain('S9')
  })

  // La renta se cobra solo dentro de la VIGENCIA del contrato. Sin esto, el
  // reporte de un trimestre de 2025 cobraría un contrato firmado en 2026.
  it('no cobra renta fuera de la vigencia del contrato', () => {
    const r = rentabilidadPorSitio(ESCENARIO, {
      desde: '2025-10-01', hasta: '2025-12-31', granularidad: 'trimestre',
    })
    expect(r.filas).toEqual([])
  })
})

describe('rentabilidadPorSitio — costo de operacion por tipo de OT', () => {
  const conOts = baseDatos({
    ...ESCENARIO,
    ordenesTrabajo: [
      // Dentro del rango, por fecha de completada.
      { id: 'OT1', sitioId: 'S1', tipo: 'HERRERIA', estatus: 'COMPLETADA', fechaCompletada: '2026-02-10', fechaProgramada: null, creadoEn: '2026-01-05' },
      // Dentro del rango, sin completar: manda la programada.
      { id: 'OT2', sitioId: 'S1', tipo: 'INSPECCION', estatus: 'PENDIENTE', fechaCompletada: null, fechaProgramada: '2026-03-02', creadoEn: '2026-01-05' },
      // FUERA del rango.
      { id: 'OT3', sitioId: 'S1', tipo: 'HERRERIA', estatus: 'COMPLETADA', fechaCompletada: '2026-08-01', fechaProgramada: null, creadoEn: '2026-07-01' },
      // CANCELADA dentro del rango: no cuesta.
      { id: 'OT4', sitioId: 'S1', tipo: 'HERRERIA', estatus: 'CANCELADA', fechaCompletada: '2026-02-11', fechaProgramada: null, creadoEn: '2026-01-05' },
    ],
  })

  it('suma solo las OT del rango, no canceladas, con el costo de su tipo', () => {
    const r = rentabilidadPorSitio(conOts, { ...Q1, granularidad: 'trimestre' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.costoOperacion).toBe(COSTOS_OT_RESPALDO.HERRERIA + COSTOS_OT_RESPALDO.INSPECCION)
  })

  it('un tipo configurado manda y uno sin configurar cae al respaldo', () => {
    const r = rentabilidadPorSitio(
      { ...conOts, costosOt: { HERRERIA: 4000 } } as any,
      { ...Q1, granularidad: 'trimestre' },
    )
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.costoOperacion).toBe(4000 + COSTOS_OT_RESPALDO.INSPECCION)
  })

  it('el costo de operacion cae en el mes de la OT, no repartido', () => {
    const r = rentabilidadPorSitio(conOts, { ...Q1, granularidad: 'mes' })
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    expect(s1.periodos.map((p) => p.costoOperacion)).toEqual([
      0,
      COSTOS_OT_RESPALDO.HERRERIA,
      COSTOS_OT_RESPALDO.INSPECCION,
    ])
  })
})
