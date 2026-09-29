import { describe, expect, it } from 'vitest'
import { interpretarRecibo } from './interprete'
import { construirPropuesta, type ConsumoYaCapturado } from './propuesta'
import { pdbtBimestralConDsap } from './casos'

// ============================================================================
//  La propuesta: a que predio va el recibo, y que pasa si ya estaba.
// ----------------------------------------------------------------------------
//  Todo puro. Los recibos ya capturados se pasan como argumento porque el
//  emparejamiento y la deteccion de duplicados son DECISIONES, y una decision
//  se prueba sin base de datos.
// ============================================================================

const PREDIO = '11111111-1111-4111-8111-111111111111'
const OTRO_PREDIO = '22222222-2222-4222-8222-222222222222'
const lectura = interpretarRecibo(pdbtBimestralConDsap)

const capturado = (p: Partial<ConsumoYaCapturado> = {}): ConsumoYaCapturado => ({
  id: 'c1',
  predioId: PREDIO,
  sitioId: null,
  periodo: '2025-12-01',
  medidor: '900000000001',
  kwh: 1331.06,
  importe: 3845.53,
  ...p,
})

describe('construirPropuesta — a que predio va el recibo', () => {
  it('sin historial no inventa un predio: lo deja en null y lo dice', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [])
    expect(p.predioId).toBeNull()
    expect(p.sitioId).toBeNull()
    expect(p.emparejamiento).toBe('sin-historial')
    expect(p.avisos.join(' ')).toMatch(/primera vez/i)
  })

  it('con un recibo previo del MISMO numero de servicio, hereda su predio', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [capturado()])
    expect(p.predioId).toBe(PREDIO)
    expect(p.emparejamiento).toBe('historial')
  })

  it('hereda del recibo MAS RECIENTE, que es el primero de la lista', () => {
    // Si la pantalla cambio de predio, lo ultimo capturado es lo que vale.
    const p = construirPropuesta('recibo.pdf', lectura, [
      capturado({ id: 'nuevo', predioId: OTRO_PREDIO, periodo: '2026-01-01' }),
      capturado({ id: 'viejo', predioId: PREDIO, periodo: '2025-09-01' }),
    ])
    expect(p.predioId).toBe(OTRO_PREDIO)
  })

  it('hereda tambien un anclaje a PANTALLA SUELTA, no solo a predio', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [
      capturado({ predioId: null, sitioId: OTRO_PREDIO }),
    ])
    expect(p.predioId).toBeNull()
    expect(p.sitioId).toBe(OTRO_PREDIO)
  })

  it('propone como `medidor` el NUMERO DE SERVICIO y no el numero de aparato', () => {
    // El aparato lo cambia CFE sin avisar; el servicio no. Con el aparato como
    // clave, el recibo del mes siguiente entraria duplicado sin dar error.
    const p = construirPropuesta('recibo.pdf', lectura, [])
    expect(p.medidor).toBe('900000000001')
    expect(p.medidor).not.toBe(lectura.medidorFisico)
  })

  it('guarda el numero de aparato, la tarifa y el periodo REAL en las notas', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [])
    expect(p.notas).toContain('A000AA')
    expect(p.notas).toContain('PDBT')
    expect(p.notas).toContain('2025-11-03')
    expect(p.notas).toContain('2026-01-05')
  })
})

describe('construirPropuesta — el mismo recibo subido dos veces', () => {
  it('marca el mes que YA esta capturado, con las cifras que tiene la base', () => {
    const previo = capturado({ periodo: '2025-12-01', kwh: 999, importe: 111 })
    const p = construirPropuesta('recibo.pdf', lectura, [previo])
    const diciembre = p.renglones.find((r) => r.periodo === '2025-12-01')
    expect(diciembre?.yaCapturado?.id).toBe('c1')
    expect(diciembre?.yaCapturado?.importe).toBe(111)
    // Y los meses que NO estaban siguen limpios.
    expect(p.renglones.find((r) => r.periodo === '2025-11-01')?.yaCapturado).toBeNull()
  })

  it('avisa de que volver a capturarlo DUPLICA el costo de ese mes', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [capturado()])
    expect(p.avisos.join(' ')).toMatch(/DUPLICA/)
    expect(p.avisos.join(' ')).toContain('2025-12')
  })

  it('no bloquea la propuesta: la enseña para que una persona decida', () => {
    // Bloquear seria correcto si el unico motivo de un duplicado fuera un
    // error. No lo es: un recibo puede recapturarse porque el primero se
    // tecleo mal. Quien decide es quien mira, no este archivo.
    const p = construirPropuesta('recibo.pdf', lectura, [capturado()])
    expect(p.renglones).toHaveLength(3)
    expect(p.esRecibo).toBe(true)
  })
})

describe('construirPropuesta — lo que no es un recibo', () => {
  it('un archivo que no es de CFE no propone nada: cero renglones', () => {
    const noEs = interpretarRecibo(['CONTRATO DE ARRENDAMIENTO', 'Total 12,500.00'])
    const p = construirPropuesta('contrato.pdf', noEs, [capturado()])
    expect(p.esRecibo).toBe(false)
    expect(p.renglones).toEqual([])
    expect(p.medidor).toBeNull()
    // Y NO hereda el predio del historial de otro: no hay servicio que casar.
    expect(p.predioId).toBeNull()
  })
})

describe('construirPropuesta — el periodo que cubre varios meses', () => {
  it('avisa de cuantos meses cubre, porque el reparto no es obvio', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [])
    expect(p.renglones.map((r) => r.periodo)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ])
    expect(p.avisos.join(' ')).toMatch(/3 meses de calendario/)
  })

  it('el reparto conserva el importe del recibo al centavo', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [])
    const centavos = (n: number | null) => Math.round((n ?? 0) * 100)
    const suma = p.renglones.reduce((a, r) => a + centavos(r.importe), 0)
    expect(suma).toBe(centavos(lectura.importe))
  })
})
