import { describe, it, expect } from 'vitest'
import { dashboardMetrics } from './derive'

// ============================================================================
//  Recordatorios de pago de renta con periodicidades cortas.
//
//  Al abrir el enum a DIARIA (ADR 0004) las dos reglas de aviso que existían
//  dejaban de servir, cada una por un motivo distinto:
//
//   · «Renta vencida» emitía UNA alerta POR CUOTA. Con renta mensual eso son
//     una o dos; con renta diaria, un contrato impago un mes son 30 alertas
//     rojas idénticas que empujan fuera del panel a incidencias, OT y licencias.
//     Ahora se agrupan: una alerta por contrato, con el conteo y el total.
//
//   · «Renta por vencer» avisaba con 90 días fijos. Aplicado a una renta diaria,
//     todas las cuotas del trimestre estaban "por vencer" a la vez y el aviso
//     dejaba de señalar nada. Ahora el margen escala con la cadencia.
//
//  Lo que estas pruebas protegen sobre todo es que el contrato ANUAL —la
//  cadencia para la que se diseñó el 90 fijo— no cambie de comportamiento.
// ============================================================================

function hoyMas(dias: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const BASE: any = {
  sitios: [{ id: 'S1', nombre: 'Pantalla Centro', predioId: null, caras: 1, estatusComercial: 'DISPONIBLE' }],
  predios: [], contratos: [], reservas: [], campanas: [], facturas: [], cobranzas: [],
  ordenesTrabajo: [], creatividades: [], ordenesImpresion: [], evidencias: [],
  incidencias: [], pagosRenta: [], arrendadores: [], clientes: [], propuestas: [],
  ordenesCompra: [], notificaciones: [], acciones: [], sitiosRed: [],
  razonesSociales: [], licencias: [],
}

const contrato = (periodicidad: string, over: any = {}) => ({
  id: 'C1', sitioId: 'S1', arrendadorId: 'A1', predioId: null,
  fechaInicio: '2026-01-01', fechaFin: '2027-01-01',
  montoRenta: 1_000, periodicidad, moneda: 'MXN', autoRenovable: false,
  documentoUrl: null, estatus: 'VIGENTE', creadoEn: '2026-01-01', ...over,
})

const pago = (id: string, periodo: string, estatus: string, monto = 1_000) => ({
  id, contratoId: 'C1', periodo, monto, fechaPago: null, estatus,
})

const alertasPago = (estado: any) =>
  dashboardMetrics(estado).alertas.filter((a: any) => a.tipo === 'pago')

describe('renta vencida: una alerta por contrato, no por cuota', () => {
  const estado = {
    ...BASE,
    contratos: [contrato('DIARIA')],
    pagosRenta: [
      pago('P1', hoyMas(-5), 'VENCIDO'),
      pago('P2', hoyMas(-4), 'VENCIDO'),
      pago('P3', hoyMas(-3), 'VENCIDO'),
      pago('P4', hoyMas(-2), 'VENCIDO'),
    ],
  }

  it('agrupa las 4 cuotas vencidas en una sola alerta', () => {
    const a = alertasPago(estado).filter((x: any) => x.titulo === 'Renta vencida')
    expect(a).toHaveLength(1)
    expect(a[0].nivel).toBe('rojo')
  })

  it('la alerta dice cuántas cuotas se deben y cuánto suman', () => {
    // El conteo es lo que sustituye a "ver 30 alertas": sin él, agrupar
    // escondería la gravedad en vez de ordenarla.
    const [a] = alertasPago(estado).filter((x: any) => x.titulo === 'Renta vencida')
    expect(a.detalle).toContain('4 cuotas')
    expect(a.detalle).toContain('Pantalla Centro')
    expect(a.detalle).toContain(hoyMas(-5)) // desde la más antigua
  })

  it('con una sola cuota vencida el texto no dice "1 cuotas"', () => {
    const uno = { ...BASE, contratos: [contrato('MENSUAL')], pagosRenta: [pago('P1', hoyMas(-9), 'VENCIDO')] }
    const [a] = alertasPago(uno).filter((x: any) => x.titulo === 'Renta vencida')
    expect(a.detalle).toContain('sin liquidar')
    expect(a.detalle).not.toContain('cuotas')
  })

  it('dos contratos morosos siguen siendo dos alertas', () => {
    // Agrupar es POR CONTRATO. Fundir contratos distintos escondería a un
    // arrendador entero detrás de otro.
    const dos = {
      ...BASE,
      sitios: [...BASE.sitios, { id: 'S2', nombre: 'Pantalla Norte', predioId: null, caras: 1, estatusComercial: 'DISPONIBLE' }],
      contratos: [contrato('MENSUAL'), contrato('MENSUAL', { id: 'C2', sitioId: 'S2' })],
      pagosRenta: [
        pago('P1', hoyMas(-40), 'VENCIDO'),
        { ...pago('P2', hoyMas(-40), 'VENCIDO'), contratoId: 'C2' },
      ],
    }
    expect(alertasPago(dos).filter((x: any) => x.titulo === 'Renta vencida')).toHaveLength(2)
  })
})

describe('renta por vencer: el margen escala con la cadencia', () => {
  const porVencer = (periodicidad: string, dias: number) => ({
    ...BASE,
    contratos: [contrato(periodicidad)],
    pagosRenta: [pago('P1', hoyMas(dias), 'PENDIENTE')],
  })

  it('ANUAL sigue avisando a 90 días y en rojo a 15 — sin regresión', () => {
    expect(alertasPago(porVencer('ANUAL', 80))).toHaveLength(1)
    expect(alertasPago(porVencer('ANUAL', 80))[0].nivel).toBe('ambar')
    expect(alertasPago(porVencer('ANUAL', 10))[0].nivel).toBe('rojo')
    expect(alertasPago(porVencer('ANUAL', 100))).toHaveLength(0)
  })

  it('DIARIA no avisa con 30 días de antelación', () => {
    // Con el 90 fijo, este caso encendía la alerta. Es el fallo que motivó el
    // cambio: un aviso siempre encendido no informa de nada.
    expect(alertasPago(porVencer('DIARIA', 30))).toHaveLength(0)
  })

  it('DIARIA avisa el día antes, en rojo', () => {
    const a = alertasPago(porVencer('DIARIA', 1))
    expect(a).toHaveLength(1)
    expect(a[0].nivel).toBe('rojo')
    expect(a[0].detalle).toContain('1 día') // singular, no "1 días"
  })

  it('MENSUAL avisa dentro de sus 15 días y no antes', () => {
    expect(alertasPago(porVencer('MENSUAL', 10))).toHaveLength(1)
    expect(alertasPago(porVencer('MENSUAL', 20))).toHaveLength(0)
  })

  it('un pago que vence hoy lo dice así, no "en 0 días"', () => {
    const a = alertasPago(porVencer('MENSUAL', 0))
    expect(a).toHaveLength(1)
    expect(a[0].detalle).toContain('vence hoy')
  })

  it('solo avisa del PRÓXIMO pago, aunque haya muchos pendientes', () => {
    // Un contrato diario tiene cientos de cuotas pendientes por delante. Sin
    // esta regla el panel se llenaría con el mismo contrato repetido.
    const muchos = {
      ...BASE,
      contratos: [contrato('DIARIA')],
      pagosRenta: [
        pago('P1', hoyMas(1), 'PENDIENTE'),
        pago('P2', hoyMas(2), 'PENDIENTE'),
        pago('P3', hoyMas(3), 'PENDIENTE'),
      ],
    }
    const a = alertasPago(muchos).filter((x: any) => x.titulo === 'Renta por vencer')
    expect(a).toHaveLength(1)
  })
})
