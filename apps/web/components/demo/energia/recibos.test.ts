import { describe, expect, it } from 'vitest'
import {
  cuerpoDeAlta,
  filasDeConfirmacion,
  motivoNoConfirmable,
  resumenDeLectura,
  textoDeLoLeido,
  type LecturaRecibo,
  type PropuestaUI,
} from './recibos'

// ============================================================================
//  La pantalla de subir recibos, sin pantalla.
// ----------------------------------------------------------------------------
//  Lo que se prueba aqui es lo que decide si un renglon se puede guardar y que
//  se le enseña a quien confirma. Nada de esto toca la red.
// ============================================================================

const lectura = (p: Partial<LecturaRecibo> = {}): LecturaRecibo => ({
  esRecibo: true,
  numeroServicio: '900000000001',
  medidorFisico: 'A000AA',
  tarifa: 'PDBT',
  desde: '2025-11-03',
  hasta: '2026-01-05',
  kwh: 2748,
  kwhLeido: 2748,
  facturacionPeriodo: 7838.61,
  alumbradoPublico: 101.83,
  importe: 7940.44,
  importeLeido: 7940.44,
  totalDelRecibo: 7941.35,
  conceptos: [],
  avisos: [],
  ...p,
})

const propuesta = (p: Partial<PropuestaUI> = {}): PropuestaUI => ({
  archivo: 'recibo.pdf',
  esRecibo: true,
  lectura: lectura(),
  predioId: 'p1',
  sitioId: null,
  emparejamiento: 'historial',
  medidor: '900000000001',
  notas: 'Recibo CFE, servicio 900000000001, medidor A000AA.',
  renglones: [
    { periodo: '2025-11-01', kwh: 1202.25, importe: 3473.94, dias: 28, yaCapturado: null },
    { periodo: '2025-12-01', kwh: 1331.06, importe: 3845.53, dias: 31, yaCapturado: null },
    { periodo: '2026-01-01', kwh: 214.69, importe: 620.97, dias: 5, yaCapturado: null },
  ],
  avisos: [],
  ...p,
})

describe('filasDeConfirmacion', () => {
  it('aplana a UN renglon por mes, porque eso es lo que se guarda', () => {
    const filas = filasDeConfirmacion([propuesta()])
    expect(filas).toHaveLength(3)
    expect(filas.map((f) => f.periodo)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('traduce el anclaje a la MISMA clave que usa la rejilla de captura', () => {
    expect(filasDeConfirmacion([propuesta()])[0].punto).toBe('P:p1')
    expect(
      filasDeConfirmacion([propuesta({ predioId: null, sitioId: 's9' })])[0].punto,
    ).toBe('S:s9')
  })

  it('sin predio deja el punto VACIO en vez de adivinar uno', () => {
    const filas = filasDeConfirmacion([propuesta({ predioId: null, sitioId: null })])
    expect(filas[0].punto).toBe('')
  })

  it('un archivo que no es recibo no produce ningun renglon', () => {
    const filas = filasDeConfirmacion([propuesta({ esRecibo: false, renglones: [] })])
    expect(filas).toEqual([])
  })

  it('una cifra que no se leyo sale VACIA, nunca como "0"', () => {
    // Es la regla entera de este modulo metida en una linea de interfaz: un `0`
    // en la casilla se guarda tal cual y afirma que no se consumio luz.
    const filas = filasDeConfirmacion([
      propuesta({
        lectura: lectura({ kwh: null, kwhLeido: 0 }),
        renglones: [{ periodo: '2025-11-01', kwh: null, importe: 3473.94, dias: 28, yaCapturado: null }],
      }),
    ])
    expect(filas[0].kwh).toBe('')
    expect(filas[0].kwh).not.toBe('0')
  })
})

describe('motivoNoConfirmable', () => {
  const fila = () => filasDeConfirmacion([propuesta()])[0]

  it('un renglon completo se puede confirmar', () => {
    expect(motivoNoConfirmable(fila())).toBeNull()
  })

  it('sin predio no se puede confirmar, y lo dice', () => {
    expect(motivoNoConfirmable({ ...fila(), punto: '' })).toMatch(/predio/i)
  })

  it('con una cifra vacia no se puede confirmar', () => {
    expect(motivoNoConfirmable({ ...fila(), kwh: '' })).toBeTruthy()
    expect(motivoNoConfirmable({ ...fila(), importe: '' })).toBeTruthy()
  })

  it('CERO: no se puede confirmar un renglon con kWh o importe en cero', () => {
    // Regla del dueño del 2026-09-29. Aqui es comodidad —el servidor lo corta
    // igual—, pero sin esto la persona da a guardar y recibe un 400 con el
    // recibo ya cerrado.
    expect(motivoNoConfirmable({ ...fila(), kwh: '0' })).toMatch(/mayor que cero/i)
    expect(motivoNoConfirmable({ ...fila(), importe: '0' })).toMatch(/mayor que cero/i)
    expect(motivoNoConfirmable({ ...fila(), kwh: '0.00' })).toMatch(/mayor que cero/i)
  })

  it('NEGATIVO: tampoco', () => {
    expect(motivoNoConfirmable({ ...fila(), kwh: '-1' })).toMatch(/mayor que cero/i)
    expect(motivoNoConfirmable({ ...fila(), importe: '-500' })).toMatch(/mayor que cero/i)
  })

  it('un texto que no es numero tampoco', () => {
    expect(motivoNoConfirmable({ ...fila(), importe: 'siete mil' })).toBeTruthy()
  })

  it('que YA este capturado NO lo bloquea: se avisa y decide la persona', () => {
    // Un recibo puede recapturarse porque el primero se tecleo mal. Quien
    // decide es quien mira, no este archivo — y el indice unico de la base
    // sigue siendo la ultima defensa.
    const f = {
      ...fila(),
      yaCapturado: { id: 'c1', periodo: '2025-11-01', medidor: '900000000001', kwh: 1, importe: 1 },
    }
    expect(motivoNoConfirmable(f)).toBeNull()
  })
})

describe('cuerpoDeAlta', () => {
  it('manda el anclaje EXCLUYENTE que exige la base', () => {
    const c = cuerpoDeAlta(filasDeConfirmacion([propuesta()])[0])
    expect(c.predioId).toBe('p1')
    expect(c.sitioId).toBeNull()
  })

  it('manda como `medidor` el numero de SERVICIO, no el del aparato', () => {
    const c = cuerpoDeAlta(filasDeConfirmacion([propuesta()])[0])
    expect(c.medidor).toBe('900000000001')
    expect(c.medidor).not.toBe('A000AA')
  })

  it('manda el periodo en AAAA-MM, que es lo que el controller normaliza al dia 1', () => {
    expect(cuerpoDeAlta(filasDeConfirmacion([propuesta()])[0]).periodo).toBe('2025-11')
  })

  it('NO manda tenantId: el tenant sale de la sesion y no hay por donde metarlo', () => {
    // Que no haya por donde mandarlo es parte del diseño del endpoint, y el
    // schema es `.strict()`, asi que un `tenantId` de mas seria un 400.
    expect(Object.keys(cuerpoDeAlta(filasDeConfirmacion([propuesta()])[0]))).not.toContain('tenantId')
  })
})

describe('resumenDeLectura', () => {
  it('cuando todo salio bien lo dice, y recuerda que nada se ha guardado', () => {
    const r = resumenDeLectura({ propuestas: [propuesta()], leidos: 1, total: 1 })
    expect(r.tono).toBe('ok')
    expect(r.texto).toMatch(/nada se guarda/i)
  })

  it('cuenta los archivos que NO son recibos', () => {
    const r = resumenDeLectura({
      propuestas: [propuesta(), propuesta({ esRecibo: false, renglones: [] })],
      leidos: 1,
      total: 2,
    })
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/1 archivo no es/)
  })

  it('cuenta los renglones SIN predio, que son los que hay que elegir a mano', () => {
    const r = resumenDeLectura({
      propuestas: [propuesta({ predioId: null, sitioId: null })],
      leidos: 1,
      total: 1,
    })
    expect(r.texto).toMatch(/3 sin predio/)
  })

  it('cuenta los renglones YA capturados y dice que duplican el costo', () => {
    const p = propuesta()
    p.renglones[1].yaCapturado = {
      id: 'c1',
      periodo: '2025-12-01',
      medidor: '900000000001',
      kwh: 1,
      importe: 1,
    }
    const r = resumenDeLectura({ propuestas: [p], leidos: 1, total: 1 })
    expect(r.texto).toMatch(/1 ya capturados/)
    expect(r.texto).toMatch(/DUPLICA/)
  })

  it('cuenta los renglones con una cifra ilegible', () => {
    const p = propuesta()
    p.renglones[0].kwh = null
    const r = resumenDeLectura({ propuestas: [p], leidos: 1, total: 1 })
    expect(r.texto).toMatch(/1 con una cifra que no se pudo leer/)
  })
})

describe('textoDeLoLeido — el valor ORIGINAL al lado', () => {
  it('trae el servicio, el aparato, la tarifa y el periodo real', () => {
    const t = textoDeLoLeido(lectura())
    expect(t).toContain('900000000001')
    expect(t).toContain('A000AA')
    expect(t).toContain('PDBT')
    expect(t).toContain('2025-11-03')
  })

  it('enseña el Total del recibo, MARCADO como lo que es', () => {
    // Es el numero grande del papel, el que una persona buscaria, y NO es lo
    // que se captura: lleva adeudos, pagos y depositos de otros meses.
    const t = textoDeLoLeido(lectura())
    expect(t).toContain('7941.35')
    expect(t).toMatch(/incluye adeudos y pagos/i)
  })

  it('cuando el kWh sale vacio por ser cero, enseña que el PDF dice 0', () => {
    // Sin esto, el campo sale vacio y quien captura no tiene forma de saber si
    // el PDF estaba roto o si de verdad dice cero.
    const t = textoDeLoLeido(lectura({ kwh: null, kwhLeido: 0 }))
    expect(t).toMatch(/el PDF dice 0 kWh/)
  })
})
