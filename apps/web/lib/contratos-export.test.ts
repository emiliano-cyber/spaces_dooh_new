import { describe, it, expect } from 'vitest'
import {
  filasDeContratos,
  nombreArchivoContratos,
  ESTATUS_VIGENTES,
} from './contratos-export'
import type { ContratoArrendamiento, Arrendador, Sitio, Predio } from './data/types'

// ============================================================================
//  Reporte de contratos VIGENTES.
//
//  Lo que decide si este archivo sirve no son las columnas, sino QUÉ deja
//  fuera y cómo cuenta las pantallas. Un contrato de predio ampara todas las
//  caras del inmueble; reportar 1 subestimaría el acuerdo. Y un INCOMPLETO
//  colado haría creer que hay un trato que todavía no existe (ADR 0001).
// ============================================================================

const HOY = new Date(2026, 7, 3) // 2026-08-03

const ARR: Arrendador[] = [
  { id: 'a1', nombre: 'Predios del Norte SA', rfc: 'PNO900101AAA', telefono: null, email: null, notas: null, creadoEn: '' },
]
const RAZONES = [
  { id: 'r1', arrendadorId: 'a1', razonSocial: 'Predios SA de CV', rfc: 'PSA010101AAA' },
]
const PREDIOS = [{ id: 'p1', nombre: 'Plaza Insurgentes' }] as unknown as Predio[]
const SITIOS = [
  { id: 's1', nombre: 'Cara A', predioId: 'p1' },
  { id: 's2', nombre: 'Cara B', predioId: 'p1' },
  { id: 's3', nombre: 'Cara C', predioId: 'p1' },
  { id: 's9', nombre: 'Pantalla suelta', predioId: null },
] as unknown as Sitio[]

const DATOS = { arrendadores: ARR, razones: RAZONES, sitios: SITIOS, predios: PREDIOS }

const contrato = (over: Partial<ContratoArrendamiento>): ContratoArrendamiento =>
  ({
    id: 'c1', sitioId: 's1', arrendadorId: 'a1', predioId: 'p1',
    fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
    montoRenta: 30000, periodicidad: 'MENSUAL', moneda: 'MXN',
    autoRenovable: false, documentoUrl: null, estatus: 'VIGENTE', creadoEn: '',
    ...over,
  }) as ContratoArrendamiento

describe('qué entra y qué no', () => {
  it('deja fuera los INCOMPLETO: no son un acuerdo todavía', () => {
    const filas = filasDeContratos(
      [contrato({ id: 'ok' }), contrato({ id: 'no', estatus: 'INCOMPLETO', montoRenta: null })],
      DATOS, HOY,
    )
    expect(filas).toHaveLength(1)
  })

  it('deja fuera cancelados y vencidos', () => {
    const filas = filasDeContratos(
      [contrato({ estatus: 'CANCELADO' }), contrato({ estatus: 'VENCIDO' })],
      DATOS, HOY,
    )
    expect(filas).toHaveLength(0)
  })

  it('SÍ incluye POR_VENCER y RENOVADO: siguen cubriendo el espacio hoy', () => {
    const filas = filasDeContratos(
      [contrato({ estatus: 'POR_VENCER' }), contrato({ estatus: 'RENOVADO' })],
      DATOS, HOY,
    )
    expect(filas).toHaveLength(2)
    expect(ESTATUS_VIGENTES).toContain('POR_VENCER')
  })
})

describe('cuántas pantallas ampara el contrato', () => {
  it('un contrato de predio cuenta TODAS sus caras, no la que quedó anclada', () => {
    const [fila] = filasDeContratos([contrato({ predioId: 'p1', sitioId: 's1' })], DATOS, HOY)
    expect(fila.pantallas).toBe(3)
    expect(fila.predio).toBe('Plaza Insurgentes')
  })

  it('una pantalla suelta cuenta 1 y se identifica por su nombre', () => {
    const [fila] = filasDeContratos(
      [contrato({ predioId: null, sitioId: 's9' })], DATOS, HOY,
    )
    expect(fila.pantallas).toBe(1)
    expect(fila.predio).toBe('Pantalla suelta')
  })
})

describe('datos fiscales y renta', () => {
  it('usa la razón social del arrendador cuando solo tiene una', () => {
    const [fila] = filasDeContratos([contrato({})], DATOS, HOY)
    expect(fila.razon_social).toBe('Predios SA de CV')
    expect(fila.rfc).toBe('PSA010101AAA')
  })

  it('no elige razón social si el arrendador tiene varias: sería inventar cuál factura', () => {
    const dosRazones = {
      ...DATOS,
      razones: [...RAZONES, { id: 'r2', arrendadorId: 'a1', razonSocial: 'Otra SA', rfc: 'OTR010101AAA' }],
    }
    const [fila] = filasDeContratos([contrato({ razonSocialId: null })], dosRazones, HOY)
    expect(fila.razon_social).toBe('')
    // Cae al RFC del arrendador, que sí es inequívoco.
    expect(fila.rfc).toBe('PNO900101AAA')
  })

  it('normaliza la renta a mensual para poder sumar la columna', () => {
    // Catorcenal: 26 pagos al año / 12 meses.
    const [fila] = filasDeContratos(
      [contrato({ montoRenta: 10000, periodicidad: 'CATORCENAL' })], DATOS, HOY,
    )
    expect(fila.renta).toBe(10000)
    expect(Number(fila.renta_mensual_equivalente)).toBeGreaterThan(10000)
  })
})

describe('días restantes', () => {
  it('cuenta desde hoy hasta el vencimiento', () => {
    const [fila] = filasDeContratos([contrato({ fechaFin: '2026-08-13' })], DATOS, HOY)
    expect(fila.dias_restantes).toBe(10)
  })

  it('un contrato que vence hoy da 0, no vacío', () => {
    const [fila] = filasDeContratos([contrato({ fechaFin: '2026-08-03' })], DATOS, HOY)
    expect(fila.dias_restantes).toBe(0)
  })

  it('sin fecha de fin la celda va vacía, no 0', () => {
    // Un 0 se leería como «vence hoy», que es lo contrario de «no se sabe».
    const [fila] = filasDeContratos([contrato({ fechaFin: null })], DATOS, HOY)
    expect(fila.dias_restantes).toBe('')
  })
})

describe('nombre del archivo', () => {
  it('lleva la fecha', () => {
    expect(nombreArchivoContratos(HOY, 'xlsx')).toBe('contratos-vigentes-2026-08-03.xlsx')
  })
})
