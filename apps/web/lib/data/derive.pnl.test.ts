import { describe, it, expect } from 'vitest'
import { dashboardMetrics, margenPorSitio, rentaAtribuidaPorSitio, margenCampana, medioLabel } from './derive'

// ============================================================================
//  P&L (Fase 1.6): la renta del contrato vigente del predio ES el costo del
//  espacio (reemplaza el costo de compra) y se atribuye a cada pantalla por
//  partes iguales (÷ caras del predio). Verifica que el margen "cuadra a mano"
//  y que NO hay doble conteo (el costoCompra del sitio se ignora por completo).
// ============================================================================

// Estado base: todos los arreglos vacíos; cada prueba llena lo que necesita.
function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], reservasTentativas: [],
  }
  return { ...vacio, ...over }
}

const AYER = '2020-01-01'
const MANANA = '2999-12-31'

// Predio P1: 2 pantallas (S1, S2) de 1 cara c/u => Σ caras = 2.
// Contrato C1 vigente: renta 10 000 MENSUAL => renta mensual del predio = 10 000.
// Atribución partes iguales => 5 000 por pantalla.
const escenario = baseState({
  sitios: [
    { id: 'S1', predioId: 'P1', caras: 1, costoCompra: 99999, nombre: 'S1', claveInterna: 'K1', estatusComercial: 'OCUPADO' },
    { id: 'S2', predioId: 'P1', caras: 1, costoCompra: 88888, nombre: 'S2', claveInterna: 'K2', estatusComercial: 'DISPONIBLE' },
    { id: 'S3', predioId: null,  caras: 1, costoCompra: 77777, nombre: 'S3', claveInterna: 'K3', estatusComercial: 'DISPONIBLE' },
  ],
  contratos: [
    { id: 'C1', predioId: 'P1', sitioId: 'S1', arrendadorId: 'A1', montoRenta: 10000, periodicidad: 'MENSUAL', estatus: 'VIGENTE' },
  ],
  arrendadores: [{ id: 'A1', nombre: 'Arrendador Uno' }],
  reservas: [
    // Reserva CONFIRMADA y activa hoy en S1, ingreso 8 000.
    { id: 'R1', sitioId: 'S1', campanaId: 'CAMP1', precio: 8000, estatus: 'CONFIRMADA', fechaInicio: AYER, fechaFin: MANANA },
  ],
  campanas: [{ id: 'CAMP1', nombre: 'Campaña 1' }],
})

// medioLabel es la regla de PRESENTACIÓN (más amplia que la de booking, que por
// S0-3 solo considera digital a PANTALLA_DIGITAL). Ver el comentario en derive.ts.
describe('medioLabel — Fija o Digital', () => {
  const m = (s: any) => medioLabel(s)
  it('PANTALLA_DIGITAL es Digital', () => {
    expect(m({ tipoMedio: 'PANTALLA_DIGITAL', exhibicion: 'digital', esRotativo: true })).toBe('Digital')
  })
  it('espectacular fijo es Fija', () => {
    expect(m({ tipoMedio: 'ESPECTACULAR', exhibicion: 'fijo', esRotativo: false })).toBe('Fija')
  })
  it('un rotativo sobre estructura estática se MUESTRA como Digital', () => {
    // Ojo: para BOOKING sigue siendo fijo (regla S0-3). Las dos difieren a propósito.
    expect(m({ tipoMedio: 'ESPECTACULAR', exhibicion: 'rotativo', esRotativo: true })).toBe('Digital')
  })
  it('no truena sin exhibicion ni esRotativo', () => {
    expect(m({ tipoMedio: 'MURAL' })).toBe('Fija')
  })
})

describe('P&L renta = costo del espacio (atribución partes iguales, sin doble conteo)', () => {
  it('rentaAtribuidaPorSitio reparte la renta del predio por caras', () => {
    const m = rentaAtribuidaPorSitio(escenario)
    expect(m.get('S1')).toBeCloseTo(5000, 6) // 10 000 ÷ 2 caras
    expect(m.get('S2')).toBeCloseTo(5000, 6)
    expect(m.get('S3')).toBe(0)              // sin predio/contrato => 0 (sin fallback a costoCompra)
  })

  // DASH-PERIODO (26/10) · `dashboardMetrics` ya no da ingreso, costo de
  // espacios ni margen: los daba sobre todo lo que ha existido —aquí habría
  // dicho «ingreso del mes 8 000» por una reserva de 2020 a 2999— y el
  // Dashboard los pide ahora al motor de Reportes. Que no vuelvan.
  it('NEGATIVO · dashboardMetrics ya no expone ingreso ni margen sin periodo', () => {
    const d = dashboardMetrics(escenario) as unknown as Record<string, unknown>
    for (const campo of ['ingresoMes', 'costoEspaciosMes', 'costoOperacionMes', 'costoTotalMes', 'margen', 'margenPct']) {
      expect(d, campo).not.toHaveProperty(campo)
    }
    // costoRentaMes es informativo (bruto mensual de contratos activos) = 10 000.
    expect(d.costoRentaMes).toBeCloseTo(10000, 6)
  })

  it('la impresión es la de las órdenes creadas EN EL MES, no todas las que han existido', () => {
    const conImpresion = {
      ...escenario,
      sitios: escenario.sitios.map((s: any) => ({ ...s, tarifaImpresion: 700 })),
      ordenesImpresion: [
        { id: 'OI1', sitioId: 'S1', creadoEn: new Date(2026, 9, 3, 12).toISOString() },
        { id: 'OI2', sitioId: 'S2', creadoEn: new Date(2026, 9, 31, 20).toISOString() },
        // De septiembre: hasta el 26/10 también se sumaba.
        { id: 'OI3', sitioId: 'S1', creadoEn: new Date(2026, 8, 30, 12).toISOString() },
      ],
    }
    expect(dashboardMetrics(conImpresion, new Date(2026, 9, 26)).costoImpresionMes).toBe(1400)
  })

  it('margenPorSitio: renta atribuida por pantalla y margen a mano', () => {
    const filas = margenPorSitio(escenario)
    const s1 = filas.find((f) => f.sitioId === 'S1')!
    const s2 = filas.find((f) => f.sitioId === 'S2')!
    expect(s1.rentaMensual).toBe(5000)
    expect(s1.ingresoMensual).toBe(8000)
    expect(s1.margenMensual).toBe(3000)   // 8 000 − 5 000
    expect(s1.tieneContrato).toBe(true)
    expect(s2.rentaMensual).toBe(5000)
    expect(s2.ingresoMensual).toBe(0)
    expect(s2.margenMensual).toBe(-5000)  // pantalla que "pierde": renta sin ingreso
  })

  it('margenCampana usa la renta atribuida como costo del espacio', () => {
    const mc = margenCampana({ id: 'CAMP1' } as any, escenario)
    expect(mc.ingreso).toBe(8000)
    expect(mc.costoEspacios).toBeCloseTo(5000, 6) // no 99999
    expect(mc.margen).toBeCloseTo(3000, 6)
  })
})
