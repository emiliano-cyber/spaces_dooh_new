import { describe, it, expect } from 'vitest'
import { dashboardMetrics } from './derive'

// `construirAlertas` no se exporta; las alertas se leen del dashboard.
const alertas = (state: any) => dashboardMetrics(state).alertas

// ============================================================================
//  Contrato INCOMPLETO (ADR 0001). Invariantes que este estatus debe cumplir:
//    1. NO aporta costo al P&L — su importe se desconoce, y suponerle uno
//       falsearía el margen tanto como ignorarlo.
//    2. NO dispara alertas de vencimiento (no tiene fecha de fin).
//    3. SÍ dispara su propia alerta de pendiente de captura, para que alguien
//       lo cierre en vez de quedarse ahí para siempre.
//    4. Nada revienta con los nulos en importe/periodicidad/fin/arrendador.
// ============================================================================

function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], reservasTentativas: [], predios: [], sitiosRed: [],
  }
  return { ...vacio, ...over }
}

const SITIO = { id: 'S1', nombre: 'Pantalla sin contrato', caras: 1, predioId: null, claveInterna: 'K1', estatusComercial: 'RESERVADO' }

// Contrato tal como lo crea la generación de campaña: solo sitio, fecha de
// inicio, moneda y estatus. Todo lo demás en null.
const INCOMPLETO = {
  id: 'C-INC', sitioId: 'S1', arrendadorId: null, fechaInicio: '2026-01-01',
  fechaFin: null, montoRenta: null, periodicidad: null, moneda: 'MXN',
  autoRenovable: false, documentoUrl: null, estatus: 'INCOMPLETO',
  predioId: null, razonSocialId: null, deposito: null,
  motivoCancelacion: null, creadoEn: '2026-01-01',
}

describe('contrato INCOMPLETO en el P&L', () => {
  it('no aporta costo de renta', () => {
    const conIncompleto = dashboardMetrics(baseState({ sitios: [SITIO], contratos: [INCOMPLETO] }))
    const sinContrato = dashboardMetrics(baseState({ sitios: [SITIO], contratos: [] }))
    expect(conIncompleto.costoRentaMes).toBe(0)
    expect(conIncompleto.costoRentaMes).toBe(sinContrato.costoRentaMes)
  })

  it('un contrato vigente sí aporta, para confirmar que la prueba mide algo', () => {
    const vigente = { ...INCOMPLETO, id: 'C-VIG', estatus: 'VIGENTE', arrendadorId: 'A1', fechaFin: '2027-01-01', montoRenta: 10000, periodicidad: 'MENSUAL' }
    const m = dashboardMetrics(baseState({ sitios: [SITIO], contratos: [vigente] }))
    expect(m.costoRentaMes).toBe(10000)
  })

  it('no revienta con todos los campos en null', () => {
    expect(() => dashboardMetrics(baseState({ sitios: [SITIO], contratos: [INCOMPLETO] }))).not.toThrow()
  })
})

describe('cobertura: el contrato debe abarcar todo el periodo vendido', () => {
  const CAMPANA = { id: 'CAM1', nombre: 'Campaña de prueba', estadoComercial: 'CONFIRMADA', moneda: 'MXN' }
  const reserva = (fin: string) => ({
    id: 'R1', campanaId: 'CAM1', sitioId: 'S1', estatus: 'CONFIRMADA',
    fechaInicio: '2026-01-01', fechaFin: fin, precio: 1000,
  })
  const contrato = (over: Record<string, unknown>) => ({ ...INCOMPLETO, ...over })

  const conAlerta = (contratos: any[], finReserva: string) =>
    alertas(baseState({
      sitios: [SITIO], campanas: [CAMPANA], reservas: [reserva(finReserva)], contratos,
    })).filter((a) => a.titulo === 'El contrato no cubre la campaña')

  it('avisa cuando la campaña termina DESPUÉS de que vence el contrato', () => {
    const vigente = contrato({ estatus: 'VIGENTE', arrendadorId: 'A1', montoRenta: 100, periodicidad: 'MENSUAL', fechaFin: '2026-06-30' })
    const a = conAlerta([vigente], '2026-12-31')
    expect(a).toHaveLength(1)
    expect(a[0].nivel).toBe('rojo')
    expect(a[0].detalle).toContain('Pantalla sin contrato')
  })

  it('no avisa cuando el contrato cubre justo hasta el final', () => {
    const vigente = contrato({ estatus: 'VIGENTE', arrendadorId: 'A1', montoRenta: 100, periodicidad: 'MENSUAL', fechaFin: '2026-12-31' })
    expect(conAlerta([vigente], '2026-12-31')).toHaveLength(0)
  })

  it('un INCOMPLETO estirado hasta el fin de la campaña cuenta como cobertura', () => {
    // La generación de campaña le pone al pendiente la fecha de fin del ítem.
    // Lo que le falta (importe, arrendador) lo denuncia su propia alerta, no esta.
    expect(conAlerta([contrato({ fechaFin: '2026-12-31' })], '2026-12-31')).toHaveLength(0)
  })

  it('un contrato CANCELADO no cuenta como cobertura', () => {
    const cancelado = contrato({ estatus: 'CANCELADO', fechaFin: '2027-12-31' })
    // Sin contrato válido no emite ESTA alerta (lo cubre «Contrato incompleto»),
    // pero tampoco debe darlo por cubierto.
    expect(conAlerta([cancelado], '2026-12-31')).toHaveLength(0)
  })

  it('las reservas CANCELADAS no generan alerta', () => {
    const vigente = contrato({ estatus: 'VIGENTE', arrendadorId: 'A1', montoRenta: 100, periodicidad: 'MENSUAL', fechaFin: '2026-06-30' })
    const a = alertas(baseState({
      sitios: [SITIO], campanas: [CAMPANA], contratos: [vigente],
      reservas: [{ ...reserva('2026-12-31'), estatus: 'CANCELADA' }],
    })).filter((x) => x.titulo === 'El contrato no cubre la campaña')
    expect(a).toHaveLength(0)
  })

  it('una sola alerta por sitio aunque tenga varias reservas descubiertas', () => {
    const vigente = contrato({ estatus: 'VIGENTE', arrendadorId: 'A1', montoRenta: 100, periodicidad: 'MENSUAL', fechaFin: '2026-06-30' })
    const a = alertas(baseState({
      sitios: [SITIO], campanas: [CAMPANA], contratos: [vigente],
      reservas: [reserva('2026-10-31'), { ...reserva('2026-12-31'), id: 'R2' }],
    })).filter((x) => x.titulo === 'El contrato no cubre la campaña')
    expect(a).toHaveLength(1)
  })
})

describe('contrato INCOMPLETO en las alertas', () => {
  const state = baseState({ sitios: [SITIO], contratos: [INCOMPLETO] })

  it('genera su alerta de pendiente de captura', () => {
    const a = alertas(state).filter((x) => x.titulo === 'Contrato incompleto')
    expect(a).toHaveLength(1)
    expect(a[0].detalle).toContain('Pantalla sin contrato')
  })

  it('no genera alertas de vencimiento', () => {
    const titulos = alertas(state).map((a) => a.titulo)
    expect(titulos).not.toContain('Contrato por vencer')
    expect(titulos).not.toContain('Contrato vencido')
  })

  it('un contrato POR_VENCER sin fecha de fin no genera alerta rota', () => {
    // Defensa: el CHECK de la BD lo impide, pero si un dato viejo llegara así,
    // la alerta no debe calcular días contra null.
    const raro = { ...INCOMPLETO, id: 'C-RARO', estatus: 'POR_VENCER' }
    expect(() => alertas(baseState({ sitios: [SITIO], contratos: [raro] }))).not.toThrow()
    expect(alertas(baseState({ sitios: [SITIO], contratos: [raro] })).map((a) => a.titulo))
      .not.toContain('Contrato por vencer')
  })
})
