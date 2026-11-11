import { describe, it, expect } from 'vitest'
import { rangoDelMesDe, consultaPnlDelMes, consultaPrecioDelMes, pnlDesdeRespuesta, rutaReportesDelMes } from './pnl-del-mes'

// ============================================================================
//  DASH-PERIODO (26/10) · El ingreso, los costos y el margen del Dashboard son
//  DEL MES y salen del MISMO motor que Reportes → Rentabilidad.
//
//  Hasta hoy `dashboardMetrics` sumaba el precio de TODAS las reservas
//  confirmadas que han existido bajo el letrero «Ingreso contratado del mes»,
//  contaba la renta de una pantalla una vez por cada reserva que tuvo en su
//  vida, y un vendedor —sin permiso de finanzas— veía «margen 100 %» en verde
//  porque sus costos le llegaban vacíos.
// ============================================================================

describe('rangoDelMesDe · el mes EN CURSO, de calendario local', () => {
  it('octubre completo', () => {
    expect(rangoDelMesDe(new Date(2026, 9, 26, 10, 0))).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('febrero de un año bisiesto y de uno que no', () => {
    expect(rangoDelMesDe(new Date(2028, 1, 10))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(rangoDelMesDe(new Date(2027, 1, 10))).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' })
  })

  it('el 1.º a medianoche local sigue siendo ese mes (no el anterior por UTC)', () => {
    // A las 00:00 del 1.º de noviembre en México, `toISOString` da 31 de
    // octubre: un rango hecho desde UTC enseñaría el mes que ya terminó.
    expect(rangoDelMesDe(new Date(2026, 10, 1, 0, 0))).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
  })
})

describe('consultaPnlDelMes · lo que se le pide al endpoint de Reportes', () => {
  it('pide el mes en curso, una sola fila de totales, con basePath y barra final', () => {
    const url = consultaPnlDelMes(new Date(2026, 9, 26))
    expect(url.startsWith('/spaces-dooh/api/reportes/rentabilidad/?')).toBe(true)
    const p = new URLSearchParams(url.split('?')[1])
    expect(Object.fromEntries(p)).toEqual({
      dimension: 'trimestre',
      granularidad: 'mes',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    })
  })
})

describe('consultaPrecioDelMes · la dimensión tarifa del mismo mes', () => {
  it('mismo rango, dimensión tarifa', () => {
    const p = new URLSearchParams(consultaPrecioDelMes(new Date(2026, 9, 26)).split('?')[1])
    expect(Object.fromEntries(p)).toEqual({ dimension: 'tarifa', granularidad: 'mes', desde: '2026-10-01', hasta: '2026-10-31' })
  })
})

describe('rutaReportesDelMes · «ver el detalle» abre el MISMO mes en Reportes', () => {
  it('por pantalla, mensual, el mes en curso, sin basePath (lo pone next/link)', () => {
    expect(rutaReportesDelMes(new Date(2026, 9, 26))).toBe(
      '/reportes?dimension=sitio&granularidad=mes&desde=2026-10-01&hasta=2026-10-31',
    )
  })
})

const TOTALES = {
  ingreso: 120000,
  costoEspacio: 30000,
  costoOperacion: 4500,
  costoEnergia: 1500,
  costoTotal: 36000,
  margenBruto: 84000,
  margenBrutoPct: 70,
}

describe('pnlDesdeRespuesta · qué se pinta con lo que contestó el servidor', () => {
  it('200 con totales → los datos tal cual', () => {
    expect(pnlDesdeRespuesta(200, { totales: TOTALES })).toEqual({ fase: 'datos', totales: TOTALES })
  })

  it('NEGATIVO · 403 es «sin acceso», NUNCA ceros', () => {
    // Es el defecto que motivó esto: el rol sin finanzas veía $0 de costo y un
    // margen de 100 % en verde. Sin permiso no hay cifra que enseñar.
    expect(pnlDesdeRespuesta(403, { error: 'Sin permiso' })).toEqual({ fase: 'sin-acceso' })
  })

  it('401 también es «sin acceso»', () => {
    expect(pnlDesdeRespuesta(401, null)).toEqual({ fase: 'sin-acceso' })
  })

  it('NEGATIVO · un 500, o una caída de red (status 0), es error y no un mes en cero', () => {
    expect(pnlDesdeRespuesta(500, { error: 'boom' })).toEqual({ fase: 'error' })
    expect(pnlDesdeRespuesta(0, null)).toEqual({ fase: 'error' })
  })

  it('NEGATIVO · un 200 sin totales (HTML de un proxy, cuerpo roto) es error', () => {
    expect(pnlDesdeRespuesta(200, null)).toEqual({ fase: 'error' })
    expect(pnlDesdeRespuesta(200, { filas: [] })).toEqual({ fase: 'error' })
    expect(pnlDesdeRespuesta(200, { totales: { ingreso: 'mucho' } })).toEqual({ fase: 'error' })
  })
})
