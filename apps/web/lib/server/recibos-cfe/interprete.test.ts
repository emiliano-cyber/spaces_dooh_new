import { describe, expect, it } from 'vitest'
import {
  conceptosDelDesglose,
  interpretarRecibo,
  repartirEnMeses,
  type ReciboCfe,
} from './interprete'
import {
  gdmthTresRenglones,
  gdmto,
  pdbtBimestralConDsap,
  pdbtConDap,
  pdbtConDeposito,
  pdbtConsumoCero,
} from './casos'

// ============================================================================
//  El interprete del recibo de CFE, contra recibos REALES anonimizados.
// ----------------------------------------------------------------------------
//  Todo lo que se prueba aqui es PURO: de un arreglo de lineas a campos. Ni
//  red, ni base, ni PDF. Lo que convierte un PDF en esas lineas vive aparte
//  (`lector-pdf.ts`) y tiene su propia prueba.
//
//  LA REGLA QUE ORDENA ESTE ARCHIVO: un campo que no se pudo leer sale `null`,
//  NUNCA cero. En este repositorio ya se pago caro lo contrario —el `?? 0` del
//  mapa convertia «no se donde esta» en un punto concreto del oceano—, y aqui
//  seria peor: un `kwh: 0` AFIRMA que no se consumio luz, y una vez guardado no
//  se distingue de un medidor que de verdad no giro. Por eso `pdbtConsumoCero`
//  es un caso de prueba y no una curiosidad: existe el cero de verdad, y tiene
//  que poder distinguirse del hueco.
// ============================================================================

describe('interpretarRecibo — la plantilla comun (PDBT, 57 de los 72)', () => {
  const r: ReciboCfe = interpretarRecibo(pdbtBimestralConDsap)

  it('reconoce que es un recibo de CFE', () => {
    expect(r.esRecibo).toBe(true)
  })

  it('lee el numero de servicio, que es lo que identifica al punto de suministro', () => {
    expect(r.numeroServicio).toBe('900000000001')
  })

  it('lee el numero de MEDIDOR aparte, porque NO es el mismo dato', () => {
    expect(r.medidorFisico).toBe('A000AA')
    expect(r.medidorFisico).not.toBe(r.numeroServicio)
  })

  it('lee la tarifa', () => {
    expect(r.tarifa).toBe('PDBT')
  })

  it('lee el periodo facturado REAL, que no es un mes de calendario', () => {
    expect(r.desde).toBe('2025-11-03')
    expect(r.hasta).toBe('2026-01-05')
  })

  it('lee los kWh del renglon de energia, que es la TERCERA cifra y no la primera', () => {
    // 74,978 es la lectura actual y 72,230 la anterior: capturar cualquiera de
    // las dos como consumo daria un costo por kWh 27 veces menor que el real.
    expect(r.kwh).toBe(2748)
  })

  it('propone la facturacion del periodo MAS el alumbrado publico, y no el Total', () => {
    expect(r.facturacionPeriodo).toBe(7838.61)
    expect(r.alumbradoPublico).toBe(101.83)
    expect(r.importe).toBe(7940.44)
  })

  it('conserva el Total impreso APARTE, porque lleva adeudo y pagos de otros meses', () => {
    // 7,941.35 = 7,838.61 + 101.83 + 9,673.91 - 9,673.00. Capturarlo como
    // importe del periodo meteria el adeudo del mes pasado en el costo de este.
    expect(r.totalDelRecibo).toBe(7941.35)
    expect(r.importe).not.toBe(r.totalDelRecibo)
  })

  it('devuelve el desglose entero para poder enseñar el valor original al lado', () => {
    const etiquetas = r.conceptos.map((c) => c.etiqueta)
    expect(etiquetas).toContain('Adeudo Anterior')
    expect(etiquetas).toContain('Su Pago')
    expect(r.conceptos.find((c) => c.etiqueta === 'Adeudo Anterior')?.monto).toBe(9673.91)
  })

  it('no mete en el desglose renglones cuya etiqueta no tiene ni una letra', () => {
    // `TOTAL 391.98 8,642.57 10,519.19 19,553.75` es el pie de la tabla de la
    // IZQUIERDA. Si entrara como concepto con etiqueta vacia o numerica, la
    // comprobacion aritmetica del recibo dejaria de cuadrar.
    for (const c of r.conceptos) {
      expect(c.etiqueta, `etiqueta sin letras: «${c.etiqueta}»`).toMatch(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/)
    }
  })

  it('no levanta ningun aviso: la aritmetica del recibo cierra', () => {
    expect(r.avisos).toEqual([])
  })
})

describe('conceptosDelDesglose — la lectura de derecha a izquierda', () => {
  it('saca el par de la columna DERECHA de una linea con las dos columnas', () => {
    expect(conceptosDelDesglose(['Transmisión 0.00 0.00 497.11 497.11 Subtotal 7,257.97'])).toEqual([
      { etiqueta: 'Subtotal', monto: 7257.97 },
    ])
  })

  it('ignora una linea que solo tiene la columna izquierda', () => {
    // Su ultimo componente es una cifra y el anterior tambien: no hay etiqueta.
    expect(conceptosDelDesglose(['SCnMEM(1) 0.00 0.00 17.04 17.04'])).toEqual([])
  })

  it('ignora una etiqueta SIN NI UNA LETRA, que no significa nada', () => {
    // Defensa, no un caso de los 72: un simbolo suelto antes de una cifra
    // entraria como concepto con una etiqueta que nadie puede leer, y —si
    // cayera entre la facturacion y el Total— desajustaria la comprobacion
    // aritmetica del recibo.
    expect(conceptosDelDesglose(['%% 12.34'])).toEqual([])
    expect(conceptosDelDesglose(['— 1,000.00'])).toEqual([])
  })

  it('NO confunde una cifra sin decimales con un monto', () => {
    // `kWh base 7,720` no es un concepto del desglose.
    expect(conceptosDelDesglose(['kWh base 7,720'])).toEqual([])
  })
})

describe('interpretarRecibo — las otras dos plantillas', () => {
  it('GDMTO: el kWh esta en un renglon con el medidor dentro y la cifra buena es la ultima', () => {
    const r = interpretarRecibo(gdmto)
    expect(r.tarifa).toBe('GDMTO')
    expect(r.kwh).toBe(7109)
    expect(r.importe).toBe(22557.6)
    expect(r.avisos).toEqual([])
  })

  it('GDMTO: el desglose conserva los conceptos que EMPIEZAN por cifra', () => {
    // `2% Baja Tension((3))` y `Bonificacion Factor de Potencia((3))` son
    // conceptos de verdad. El primero se perdia hasta el 2026-09-29 porque el
    // filtro exigia que la etiqueta empezara por letra — y sin el, quien
    // confirma no ve de donde sale una parte del importe.
    const r = interpretarRecibo(gdmto)
    const etiquetas = r.conceptos.map((c) => c.etiqueta)
    expect(etiquetas).toContain('2% Baja Tension((3))')
    expect(r.conceptos.find((c) => c.etiqueta === '2% Baja Tension((3))')?.monto).toBe(391.08)
    expect(etiquetas).toContain('Bonificacion Factor de Potencia((3))')
  })

  it('GDMTH: no hay total de kWh — hay base, intermedia y punta, y se SUMAN', () => {
    const r = interpretarRecibo(gdmthTresRenglones)
    expect(r.tarifa).toBe('GDMTH')
    // 7,720 + 20,767 + 2,983. Quedarse con cualquiera de las tres declararia
    // menos de un cuarto del consumo real.
    expect(r.kwh).toBe(31470)
    expect(r.importe).toBe(106084.41)
  })
})

describe('interpretarRecibo — lo que NO entra en el costo del periodo', () => {
  it('un Deposito posterior al periodo NO se suma al importe', () => {
    const r = interpretarRecibo(pdbtConDeposito)
    // El Total del recibo es 4,309.64 y la luz del periodo son 994.64: el
    // deposito son 3,315.00 de garantia, que no es consumo de nadie. Capturar
    // el Total inflaria el costo de este predio 4.3 veces.
    expect(r.facturacionPeriodo).toBe(994.64)
    expect(r.totalDelRecibo).toBe(4309.64)
    expect(r.importe).toBe(994.64)
    expect(r.conceptos.find((c) => c.etiqueta === 'Deposito')?.monto).toBe(3315)
  })

  it('el alumbrado publico se suma se llame DSAP o DAP((2))', () => {
    const r = interpretarRecibo(pdbtConDap)
    expect(r.facturacionPeriodo).toBe(59787.41)
    expect(r.alumbradoPublico).toBe(2577.05)
    expect(r.importe).toBe(62364.46)
  })
})

describe('interpretarRecibo — un cero LEIDO tampoco se acepta (regla del dueño, 29/09)', () => {
  // Hay 10 recibos asi entre los 72 del cliente, en 5 numeros de servicio. El
  // recibo imprime 0 kWh y cobra el cargo fijo igual. El dueño decidio que un
  // cero automatico NO entra: no dice «no se», dice «no consumio luz», y dentro
  // del reporte de rentabilidad esos dos hechos son el mismo numero.
  const r = interpretarRecibo(pdbtConsumoCero)

  it('los kWh salen VACIOS, no en cero', () => {
    expect(r.kwh).toBeNull()
    expect(r.kwh).not.toBe(0)
  })

  it('pero lo leido se conserva aparte, para poder enseñar que el PDF dice 0', () => {
    expect(r.kwhLeido).toBe(0)
  })

  it('lo dice, con su motivo, en vez de dejar el hueco sin explicacion', () => {
    expect(r.avisos.join(' ')).toMatch(/cero o negativo no se acepta/i)
  })

  it('el importe SI se acepta, porque es mayor que cero', () => {
    // El cargo fijo se cobra aunque el medidor no gire. Aqui son 270.94.
    expect(r.importe).toBe(270.94)
    expect(r.importeLeido).toBe(270.94)
  })
})

describe('interpretarRecibo — los casos negativos', () => {
  it('una factura de OTRO proveedor con un «NO. DE SERVICIO» dentro NO es un recibo', () => {
    // El numero solo no basta: en un PDF cualquiera son doce cifras al lado de
    // unas palabras. Sin la segunda señal, una factura de un proveedor de
    // internet acabaria proponiendo un consumo de luz — con un importe real,
    // que es lo que lo hace caro. Este caso lo destapo una mutacion que quito
    // la comprobacion de CFE y SOBREVIVIO: la prueba de abajo usaba un texto
    // sin numero de servicio, asi que no ejercia la segunda señal.
    const r = interpretarRecibo([
      'TELECOMUNICACIONES DEL NORTE SA DE CV',
      'FACTURA DE SERVICIOS DE INTERNET',
      'NO. DE SERVICIO: 900000000001',
      'Total 3,200.00',
    ])
    expect(r.esRecibo).toBe(false)
    expect(r.numeroServicio).toBeNull()
    expect(r.importe).toBeNull()
  })

  it('un PDF que no es de CFE no se interpreta: esRecibo false y todo en null', () => {
    const r = interpretarRecibo([
      'CONTRATO DE ARRENDAMIENTO',
      'Entre las partes se conviene un importe de 12,500.00 mensuales',
      'Total 12,500.00',
    ])
    expect(r.esRecibo).toBe(false)
    expect(r.numeroServicio).toBeNull()
    expect(r.kwh).toBeNull()
    expect(r.importe).toBeNull()
    // Y NO cero: un 0 aqui entraria como «este predio no gasto luz».
    expect(r.kwh).not.toBe(0)
    expect(r.importe).not.toBe(0)
  })

  it('un recibo con el renglon de kWh ilegible deja kwh en null y avisa', () => {
    const roto = pdbtBimestralConDsap.filter((l) => !l.startsWith('Energía (kWh)'))
    const r = interpretarRecibo(roto)
    expect(r.esRecibo).toBe(true)
    expect(r.numeroServicio).toBe('900000000001')
    expect(r.kwh).toBeNull()
    expect(r.avisos.join(' ')).toMatch(/kWh/)
  })

  it('un recibo con el importe ilegible deja importe en null y avisa', () => {
    const roto = pdbtBimestralConDsap.filter((l) => !l.includes('Fac. del Periodo'))
    const r = interpretarRecibo(roto)
    expect(r.importe).toBeNull()
    expect(r.facturacionPeriodo).toBeNull()
    expect(r.avisos.join(' ')).toMatch(/importe/i)
  })

  it('un importe NEGATIVO no se acepta: sale vacio y marcado', () => {
    // Pasa cuando el recibo trae una bonificacion mayor que el consumo. Sumado
    // como costo RESTARIA dinero al costo de la luz y mejoraria el margen sin
    // que nada lo dijera.
    const torcido = pdbtBimestralConDsap.map((l) =>
      l.includes('Fac. del Periodo')
        ? l.replace('Fac. del Periodo 7,838.61', 'Fac. del Periodo -7,838.61')
        : l,
    )
    const r = interpretarRecibo(torcido)
    expect(r.importe).toBeNull()
    expect(r.importeLeido).toBeLessThan(0)
    expect(r.avisos.join(' ')).toMatch(/cero o negativo no se acepta/i)
  })

  it('unos kWh NEGATIVOS se LEEN y se rechazan: vacios, marcados y con lo leido a la vista', () => {
    // Se leen a proposito —la expresion admite el signo— para poder decir «el
    // recibo dice -10» en vez del mensaje mas vago «no se pudieron leer». Un
    // negativo aqui es una lectura mala, no un consumo.
    const torcido = pdbtBimestralConDsap.map((l) =>
      l.startsWith('Energía (kWh)') ? 'Energía (kWh) 74,978 74,988 -10' : l,
    )
    const r = interpretarRecibo(torcido)
    expect(r.kwhLeido).toBe(-10)
    expect(r.kwh).toBeNull()
    expect(r.kwh).not.toBe(0)
    expect(r.avisos.join(' ')).toMatch(/cero o negativo no se acepta/i)
  })

  it('si la aritmetica del recibo NO cierra, lo dice en vez de callarselo', () => {
    // Se cambia el Total sin tocar sus sumandos: el recibo deja de cuadrar y eso
    // significa que se leyo mal alguna cifra. Un interprete que no lo mira
    // devuelve numeros creibles y falsos.
    const torcido = pdbtBimestralConDsap.map((l) =>
      l === 'Total 7,941.35' ? 'Total 9,999.99' : l,
    )
    const r = interpretarRecibo(torcido)
    expect(r.avisos.join(' ')).toMatch(/no cuadra|no cierra/i)
  })

  it('un periodo sin fechas legibles deja desde y hasta en null', () => {
    const roto = pdbtBimestralConDsap.filter((l) => !l.startsWith('PERIODO FACTURADO'))
    const r = interpretarRecibo(roto)
    expect(r.desde).toBeNull()
    expect(r.hasta).toBeNull()
    expect(r.avisos.join(' ')).toMatch(/periodo/i)
  })
})

// ============================================================================
//  El reparto en meses de calendario.
// ----------------------------------------------------------------------------
//  `consumos_energia.periodo` es el dia 1 de UN mes, y lo exige un CHECK de la
//  base. Pero de los 72 recibos medidos el 2026-09-29 SOLO UNO cabe dentro de
//  un mes de calendario: 19 tocan dos meses, 49 tocan tres y 3 tocan cuatro.
//  Un recibo de CFE no es un recibo mensual.
//
//  Por eso el reparto no es un detalle: sin el, un recibo bimestral entero
//  caeria en un solo mes —multiplicando por dos el costo de ese mes— y el mes
//  de al lado se quedaria vacio, que el reporte de rentabilidad declara como
//  «falta recibo». Con el, cada mes recibe los dias que le tocan y la suma
//  sigue siendo exactamente el recibo.
// ============================================================================

describe('repartirEnMeses', () => {
  it('un periodo dentro de un solo mes da UN renglon, con todo', () => {
    const p = repartirEnMeses('2025-12-01', '2025-12-31', 1000, 3000)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ periodo: '2025-12-01', kwh: 1000, importe: 3000, dias: 31 })
  })

  it('un periodo bimestral se parte por los dias que caen en cada mes', () => {
    // 03 NOV 25 → 05 ENE 26: 28 dias de noviembre (3..30), 31 de diciembre y
    // 5 de enero. 64 dias en total.
    const p = repartirEnMeses('2025-11-03', '2026-01-05', 6400, 12800)
    expect(p.map((x) => x.periodo)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01'])
    expect(p.map((x) => x.dias)).toEqual([28, 31, 5])
    expect(p.map((x) => x.kwh)).toEqual([2800, 3100, 500])
  })

  it('la suma de los renglones es EXACTAMENTE el recibo, sin perder centavos', () => {
    // El ultimo renglon absorbe el redondeo. Sin esto, repartir 7,940.44 entre
    // tres meses deja unos centavos fuera del reporte cada vez, y nadie los
    // busca nunca.
    // Se suma en CENTAVOS ENTEROS y no en pesos: sumar tres `number` de dos
    // decimales da 7940.4400000000005 en IEEE754, y esa cola no es un centavo
    // perdido — es el tipo. Lo que la base guarda es `numeric(14,2)`, asi que
    // la afirmacion que importa es «no se pierde ni un centavo», y en centavos
    // la comparacion es exacta.
    const p = repartirEnMeses('2025-11-03', '2026-01-05', 2748, 7940.44)
    const centavos = (n: number | null) => Math.round((n ?? 0) * 100)
    expect(p.reduce((a, x) => a + centavos(x.kwh), 0)).toBe(centavos(2748))
    expect(p.reduce((a, x) => a + centavos(x.importe), 0)).toBe(centavos(7940.44))
  })

  it('el ULTIMO renglon absorbe el redondeo: sin eso se pierde un centavo', () => {
    // 31 ENE 25 → 01 MAR 25: 1 dia de enero, 28 de febrero y 1 de marzo, 30 en
    // total. 100 × 1/30 = 3.3333 → 3.33, y 100 × 28/30 = 93.3333 → 93.33.
    // Multiplicando los tres da 99.99 y se pierde un centavo; restando, el
    // ultimo sale 3.34 y la suma es 100 exactos.
    //
    // Este caso lo pidio una mutacion que SOBREVIVIO: con el recibo real de
    // 7,940.44 entre esos tres meses el redondeo cuadraba por casualidad, asi
    // que la prueba no distinguia multiplicar de restar.
    const p = repartirEnMeses('2025-01-31', '2025-03-01', 100, 100)
    expect(p.map((x) => x.dias)).toEqual([1, 28, 1])
    expect(p.map((x) => x.importe)).toEqual([3.33, 93.33, 3.34])
    const centavos = (n: number | null) => Math.round((n ?? 0) * 100)
    expect(p.reduce((a, x) => a + centavos(x.importe), 0)).toBe(centavos(100))
  })

  it('un consumo de cero se reparte como cero en todos los meses, no como hueco', () => {
    const p = repartirEnMeses('2025-09-17', '2025-11-14', 0, 270.94)
    const centavos = (n: number | null) => Math.round((n ?? 0) * 100)
    expect(p.map((x) => x.kwh)).toEqual([0, 0, 0])
    expect(p.reduce((a, x) => a + centavos(x.importe), 0)).toBe(centavos(270.94))
  })

  it('sin fechas no reparte nada: devuelve vacio en vez de inventar un mes', () => {
    expect(repartirEnMeses(null, '2026-01-05', 100, 100)).toEqual([])
    expect(repartirEnMeses('2025-11-03', null, 100, 100)).toEqual([])
  })

  it('sin kWh o sin importe NO reparte ceros: deja el renglon sin cifra', () => {
    const p = repartirEnMeses('2025-12-01', '2025-12-31', null, 3000)
    expect(p[0].kwh).toBeNull()
    expect(p[0].importe).toBe(3000)
  })
})
