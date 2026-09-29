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

// ============================================================================
//  Los meses DECLARADOS antes de subir, contra los que dice el PDF.
// ----------------------------------------------------------------------------
//  Requisito del dueño, 2026-09-29: «los recibos deben permitir que ANTES de
//  subir el archivo se elija cuantos meses, y al subir el PDF se valide si
//  coincide la cantidad de meses».
//
//  Lo que añade sobre lo que ya había: antes el sistema DEDUCÍA cuántos meses
//  cubre el recibo y repartía. Ahora la persona **declara lo que espera antes
//  de ver el resultado** y el sistema comprueba si coinciden. Es una
//  expectativa declarada contra una medición, que es lo único que convierte
//  «el sistema dedujo algo» en «el sistema y yo estamos de acuerdo».
//
//  ─── LA REGLA QUE NO SE NEGOCIA AQUÍ: MANDA EL PDF ───────────────────────
//  Lo declarado es una EXPECTATIVA, no una instrucción. Si no coinciden, se
//  marca y se enseñan los dos números; el reparto sigue saliendo del periodo
//  que dice el papel. Si lo declarado mandara, un error de dedo repartiría un
//  recibo bimestral dentro de un solo mes — y eso no daría ningún error.
//
//  «Cuántos meses» significa **cuántos meses de CALENDARIO toca el periodo**,
//  no cuánto dura. Un recibo de 31 días que empieza el 14 toca DOS.
// ============================================================================

describe('construirPropuesta — los meses declarados contra los del PDF', () => {
  it('sin declarar nada, no hay nada que comparar y no se inventa un aviso', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [])
    expect(p.mesesEsperados).toBeNull()
    expect(p.mesesDelPdf).toBe(3)
    expect(p.coincideMeses).toBeNull()
    expect(p.avisos.join(' ')).not.toMatch(/declaraste/i)
  })

  it('declarando 3 y cubriendo 3, pasa limpio', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [], 3)
    expect(p.mesesEsperados).toBe(3)
    expect(p.mesesDelPdf).toBe(3)
    expect(p.coincideMeses).toBe(true)
    expect(p.avisos.join(' ')).not.toMatch(/declaraste/i)
  })

  it('declarando 1 y cubriendo 3, lo MARCA con los dos numeros y el periodo real', () => {
    const p = construirPropuesta('recibo.pdf', lectura, [], 1)
    expect(p.coincideMeses).toBe(false)
    const aviso = p.avisos.join(' ')
    expect(aviso).toMatch(/declaraste 1/i)
    expect(aviso).toMatch(/3 meses/i)
    // El periodo del papel, para poder comprobarlo sin abrir el PDF.
    expect(aviso).toContain('2025-11-03')
    expect(aviso).toContain('2026-01-05')
  })

  it('NO se reparte segun lo declarado: manda el PDF', () => {
    // Es el corazon del requisito. Si lo declarado mandara, declarar 1 meteria
    // un recibo de tres meses dentro de uno solo — triplicando el costo de ese
    // mes y dejando los otros dos como «falta recibo». Y no daria ningun error.
    const conUno = construirPropuesta('recibo.pdf', lectura, [], 1)
    const conTres = construirPropuesta('recibo.pdf', lectura, [], 3)
    const sinNada = construirPropuesta('recibo.pdf', lectura, [])
    expect(conUno.renglones).toHaveLength(3)
    expect(conUno.renglones.map((r) => r.periodo)).toEqual(
      sinNada.renglones.map((r) => r.periodo),
    )
    expect(conUno.renglones.map((r) => r.importe)).toEqual(
      conTres.renglones.map((r) => r.importe),
    )
  })

  it('el borde de los NUEVE DIAS dentro de un solo mes se mide como 1, no como 0', () => {
    // `12 NOV 25 - 21 NOV 25` existe entre los 72 recibos del cliente. Dura
    // nueve dias y toca UN mes de calendario: quien declare «1» acierta, y
    // quien cuente meses de duracion se confundiria.
    const corto = interpretarRecibo(
      pdbtBimestralConDsap.map((l) =>
        l.startsWith('PERIODO FACTURADO')
          ? 'PERIODO FACTURADO: 12 NOV 25-21 NOV 25'
          : l,
      ),
    )
    const p = construirPropuesta('corto.pdf', corto, [], 1)
    expect(p.mesesDelPdf).toBe(1)
    expect(p.coincideMeses).toBe(true)
    expect(p.renglones).toHaveLength(1)
  })

  it('un recibo MENSUAL que empieza a mitad de mes toca DOS, y declarar 1 lo marca', () => {
    // Medido sobre los 72: los 15 recibos de tarifa mensual (GDMTO y GDMTH)
    // tocan DOS meses de calendario, los 15. Es la confusion mas facil de esta
    // pantalla y la que haria saltar el aviso siempre.
    const mensual = interpretarRecibo(
      pdbtBimestralConDsap.map((l) =>
        l.startsWith('PERIODO FACTURADO')
          ? 'PERIODO FACTURADO: 14 NOV 25-16 DIC 25'
          : l,
      ),
    )
    expect(construirPropuesta('m.pdf', mensual, [], 1).coincideMeses).toBe(false)
    expect(construirPropuesta('m.pdf', mensual, [], 2).coincideMeses).toBe(true)
  })

  it('un archivo que no es recibo no se compara: no hay periodo que medir', () => {
    const noEs = interpretarRecibo(['CONTRATO DE ARRENDAMIENTO', 'Total 12,500.00'])
    const p = construirPropuesta('contrato.pdf', noEs, [], 3)
    expect(p.mesesDelPdf).toBeNull()
    expect(p.coincideMeses).toBeNull()
    expect(p.avisos.join(' ')).not.toMatch(/declaraste/i)
  })

  it('sin fechas legibles no se compara: no hay nada que medir contra lo declarado', () => {
    const sinPeriodo = interpretarRecibo(
      pdbtBimestralConDsap.filter((l) => !l.startsWith('PERIODO FACTURADO')),
    )
    const p = construirPropuesta('roto.pdf', sinPeriodo, [], 3)
    expect(p.mesesDelPdf).toBeNull()
    expect(p.coincideMeses).toBeNull()
  })
})
