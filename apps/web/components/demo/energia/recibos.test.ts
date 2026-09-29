import { describe, expect, it } from 'vitest'
import {
  OPCIONES_MESES,
  cuerpoDeAlta,
  filasDeConfirmacion,
  motivoNoConfirmable,
  resumenDeLectura,
  textoDeLoLeido,
  type LecturaRecibo,
  type PropuestaUI,
  type RespuestaRecibosUI,
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
  mesesEsperados: null,
  mesesDelPdf: 3,
  coincideMeses: null,
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
    const r = resumenDeLectura({ propuestas: [propuesta()], leidos: 1, total: 1, mesesEsperados: null })
    expect(r.tono).toBe('ok')
    expect(r.texto).toMatch(/nada se guarda/i)
  })

  it('cuenta los archivos que NO son recibos', () => {
    const r = resumenDeLectura({
      propuestas: [propuesta(), propuesta({ esRecibo: false, renglones: [] })],
      leidos: 1,
      total: 2,
      mesesEsperados: null,
    })
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/1 archivo no es/)
  })

  it('cuenta los renglones SIN predio, que son los que hay que elegir a mano', () => {
    const r = resumenDeLectura({
      propuestas: [propuesta({ predioId: null, sitioId: null })],
      leidos: 1,
      total: 1,
      mesesEsperados: null,
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
    const r = resumenDeLectura({ propuestas: [p], leidos: 1, total: 1, mesesEsperados: null })
    expect(r.texto).toMatch(/1 ya capturados/)
    expect(r.texto).toMatch(/DUPLICA/)
  })

  it('cuenta los renglones con una cifra ilegible', () => {
    const p = propuesta()
    p.renglones[0].kwh = null
    const r = resumenDeLectura({ propuestas: [p], leidos: 1, total: 1, mesesEsperados: null })
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

// ============================================================================
//  Los meses declarados antes de subir — lo que la pantalla enseña.
// ----------------------------------------------------------------------------
//  Requisito del dueño del 2026-09-29. Aquí se prueba lo único que puede
//  equivocarse: qué opciones se ofrecen, cómo se cuenta lo que no coincide, y
//  —lo que de verdad importa— **que la pantalla sepa DECIR POR QUÉ** cuando el
//  desajuste es sistemático.
//
//  El modo de fallo a evitar no es que el aviso falle: es que salte SIEMPRE.
//  Un aviso que salta en 53 de 57 recibos deja de leerse, y a partir de ahí no
//  protege nada.
// ============================================================================

describe('OPCIONES_MESES — la guia que evita que el aviso salte siempre', () => {
  it('ofrece 1, 2, 3 y 4, que es el rango MEDIDO sobre los 72 recibos', () => {
    // 4 es el maximo real: `09 MAY 25 - 22 AGO 25` toca cuatro meses.
    expect(OPCIONES_MESES.map((o) => o.meses)).toEqual([1, 2, 3, 4])
  })

  it('el 2 dice que es el de los recibos MENSUALES, y el 3 el de los bimestrales', () => {
    // Es la correccion que hace util la pantalla. Un recibo mensual de CFE dura
    // ~31 dias pero empieza a mitad de mes, asi que toca DOS meses de
    // calendario: los 15 mensuales de los 72, los 15. Quien declare «1» porque
    // «es mensual» veria el aviso en todos.
    const dos = OPCIONES_MESES.find((o) => o.meses === 2)!
    const tres = OPCIONES_MESES.find((o) => o.meses === 3)!
    expect(dos.etiqueta).toMatch(/mensual/i)
    expect(tres.etiqueta).toMatch(/bimestral/i)
  })

  it('ninguna etiqueta habla de CUANTO DURA el recibo, sino de lo que TOCA', () => {
    // «Cuantos meses» tiene que significar meses de calendario tocados. Si una
    // etiqueta dijera «dura dos meses», la gente contaria distinto y el aviso
    // saltaria por una diferencia de vocabulario.
    for (const o of OPCIONES_MESES) {
      expect(o.etiqueta, o.etiqueta).toMatch(/mes(es)? de calendario/i)
    }
  })
})

describe('resumenDeLectura — cuando lo declarado no cuadra', () => {
  const conMeses = (esperados: number, delPdf: number): RespuestaRecibosUI => ({
    propuestas: [
      propuesta({
        mesesEsperados: esperados,
        mesesDelPdf: delPdf,
        coincideMeses: esperados === delPdf,
      }),
    ],
    leidos: 1,
    total: 1,
    mesesEsperados: esperados,
  })

  it('si todo coincide, no dice nada de meses', () => {
    const r = resumenDeLectura(conMeses(3, 3))
    expect(r.texto).not.toMatch(/no coincide/i)
  })

  it('cuenta los recibos cuyo periodo NO coincide con lo declarado', () => {
    const r = resumenDeLectura(conMeses(1, 3))
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/1 no coincide/i)
  })

  it('cuando TODOS los que fallan cubren el mismo numero, lo DICE', () => {
    // Es lo que convierte el aviso en algo accionable: «declaraste 1 y los 12
    // cubren 2» es una frase que se arregla cambiando el selector, no mirando
    // doce recibos uno por uno.
    const r = resumenDeLectura({
      propuestas: [
        propuesta({ archivo: 'a.pdf', mesesEsperados: 1, mesesDelPdf: 2, coincideMeses: false }),
        propuesta({ archivo: 'b.pdf', mesesEsperados: 1, mesesDelPdf: 2, coincideMeses: false }),
        propuesta({ archivo: 'c.pdf', mesesEsperados: 1, mesesDelPdf: 2, coincideMeses: false }),
      ],
      leidos: 3,
      total: 3,
      mesesEsperados: 1,
    })
    expect(r.texto).toMatch(/los 3 cubren 2/i)
  })

  it('cuando los que fallan estan repartidos, NO inventa una explicacion', () => {
    // Una tanda mezclada no tiene una sola causa. Decir «todos cubren N»
    // cuando no es verdad seria peor que no decir nada.
    const r = resumenDeLectura({
      propuestas: [
        propuesta({ archivo: 'a.pdf', mesesEsperados: 3, mesesDelPdf: 2, coincideMeses: false }),
        propuesta({ archivo: 'b.pdf', mesesEsperados: 3, mesesDelPdf: 4, coincideMeses: false }),
      ],
      leidos: 2,
      total: 2,
      mesesEsperados: 3,
    })
    expect(r.texto).toMatch(/2 no coinciden/i)
    expect(r.texto).not.toMatch(/los 2 cubren/i)
  })

  it('sin declarar nada no cuenta desajustes: no hay contra que comparar', () => {
    const r = resumenDeLectura({
      propuestas: [propuesta({ mesesEsperados: null, mesesDelPdf: 3, coincideMeses: null })],
      leidos: 1,
      total: 1,
      mesesEsperados: null,
    })
    expect(r.texto).not.toMatch(/no coincide/i)
  })
})

describe('filasDeConfirmacion — el desajuste viaja hasta el renglon', () => {
  it('cada renglon sabe si su recibo coincidio con lo declarado', () => {
    const filas = filasDeConfirmacion([
      propuesta({ mesesEsperados: 1, mesesDelPdf: 3, coincideMeses: false }),
    ])
    expect(filas).toHaveLength(3)
    for (const f of filas) {
      expect(f.coincideMeses).toBe(false)
      expect(f.mesesEsperados).toBe(1)
      expect(f.mesesDelPdf).toBe(3)
    }
  })

  it('un desajuste NO impide confirmar el renglon: se marca, no se bloquea', () => {
    // Manda el PDF y decide la persona. Bloquear convertiria un error de dedo
    // en el selector en trabajo perdido de toda una tanda.
    const f = filasDeConfirmacion([
      propuesta({ mesesEsperados: 1, mesesDelPdf: 3, coincideMeses: false }),
    ])[0]
    expect(motivoNoConfirmable(f)).toBeNull()
  })
})
