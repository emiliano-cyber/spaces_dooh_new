import { describe, expect, it } from 'vitest'
import { diferenciasContrato, valorParaMostrar } from './contrato-cambios'

// La fila tal como llega de Postgres: fechas como Date, importes como texto
// (`numeric`), y los ids crudos. El patch, como lo manda la pantalla.
const fila = {
  fecha_inicio: new Date('2026-01-01T06:00:00.000Z'),
  fecha_fin: new Date('2026-12-31T06:00:00.000Z'),
  monto_renta: '15000.00',
  periodicidad: 'MENSUAL',
  moneda: 'MXN',
  deposito: null,
  documento_url: null,
  auto_renovable: false,
  razon_social_id: null,
  arrendador_id: 'a-1',
  entidad_id: null,
}

describe('diferenciasContrato', () => {
  it('lo que no cambia no se anota, aunque venga en el patch con otro formato', () => {
    // Mismo dia, mismo importe y misma periodicidad: no es un cambio. Si se
    // anotara, el historial se llenaria de «15000.00 → 15000» que nadie pidio.
    expect(
      diferenciasContrato(fila, { fechaInicio: '2026-01-01', montoRenta: 15000, periodicidad: 'MENSUAL' }),
    ).toEqual([])
  })

  it('anota cada campo cambiado con su valor de antes y el de despues', () => {
    expect(diferenciasContrato(fila, { montoRenta: 18000, fechaFin: '2027-06-30' })).toEqual([
      { campo: 'fechaFin', etiqueta: 'Fecha de fin', antes: '2026-12-31', despues: '2027-06-30' },
      { campo: 'montoRenta', etiqueta: 'Renta', antes: '15000.00', despues: '18000.00' },
    ])
  })

  it('poner y quitar: null es un valor, undefined es «no lo toques»', () => {
    expect(diferenciasContrato(fila, { deposito: 5000, entidadId: undefined })).toEqual([
      { campo: 'deposito', etiqueta: 'Depósito', antes: null, despues: '5000.00' },
    ])
    expect(diferenciasContrato({ ...fila, deposito: '5000.00' }, { deposito: null })).toEqual([
      { campo: 'deposito', etiqueta: 'Depósito', antes: '5000.00', despues: null },
    ])
  })

  it('los ids se anotan con el NOMBRE de ese momento, no con el uuid', () => {
    // El historial se lee meses despues; un uuid no dice nada y el nombre de
    // hoy puede no ser el de entonces.
    expect(
      diferenciasContrato(fila, { arrendadorId: 'a-2' }, { 'a-1': 'Juan Pérez', 'a-2': 'Inmobiliaria Sur' }),
    ).toEqual([{ campo: 'arrendadorId', etiqueta: 'Arrendador', antes: 'Juan Pérez', despues: 'Inmobiliaria Sur' }])
  })

  it('el PDF no se copia al historial: solo si habia uno y si se reemplazo', () => {
    // Un PDF en data URL pesa cientos de kB; guardarlo en cada cambio
    // multiplicaria el contrato en la base.
    const [c] = diferenciasContrato({ ...fila, documento_url: 'data:application/pdf;base64,AAA' }, {
      documentoUrl: 'data:application/pdf;base64,BBB',
    })
    expect(c).toEqual({ campo: 'documentoUrl', etiqueta: 'PDF del contrato', antes: 'PDF anterior', despues: 'PDF nuevo' })
    expect(diferenciasContrato(fila, { documentoUrl: 'data:application/pdf;base64,BBB' })[0]).toMatchObject({
      antes: null, despues: 'PDF nuevo',
    })
  })

  it('autorrenovable se lee como Sí / No', () => {
    expect(diferenciasContrato(fila, { autoRenovable: true })).toEqual([
      { campo: 'autoRenovable', etiqueta: 'Renovación automática', antes: 'No', despues: 'Sí' },
    ])
  })
})

// Estándar del 08/10: el dinero del historial se MUESTRA con $ y coma de miles.
// Lo guardado no cambia («12000.00»): el historial solo admite inserciones y
// sus filas viejas tienen que verse igual de bien que las nuevas.
describe('valorParaMostrar', () => {
  it('la renta y el depósito salen con $ y coma, también los guardados antes', () => {
    expect(valorParaMostrar('montoRenta', '12000.00')).toBe('$ 12,000.00')
    expect(valorParaMostrar('deposito', '1500')).toBe('$ 1,500.00')
  })

  it('lo que no es dinero sale tal cual', () => {
    expect(valorParaMostrar('periodicidad', 'MENSUAL')).toBe('MENSUAL')
    expect(valorParaMostrar('fechaFin', '2027-01-31')).toBe('2027-01-31')
  })

  it('NEGATIVO: un texto que no es número no se convierte en $ 0.00', () => {
    expect(valorParaMostrar('montoRenta', 'abc')).toBe('abc')
  })

  it('vacío sigue vacío', () => {
    expect(valorParaMostrar('montoRenta', null)).toBeNull()
  })
})
