import { describe, it, expect } from 'vitest'
import {
  motivoTramoInvalido,
  resolverVolumen,
  volumenDeLineas,
  SIN_VOLUMEN,
  type TramoVolumen,
} from './volumen'

// ============================================================================
//  VOL-01 · la escala de volumen — ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  Lo que estas pruebas fijan, y por qué cada una:
//
//   · La escala es PLANA: al llegar al umbral, TODO baja. No hay tramo
//     marginal, y por eso la tarifa unitaria que se congela sigue siendo un
//     número del tarifario y no un promedio que nadie puede señalar.
//   · La escala es DISPERSA: sin tramos, `resolverVolumen` devuelve 0 y la
//     venta sale exactamente igual que ayer. Es el invariante 3 del encargo.
//   · El solape de una escala plana ES el umbral repetido, y la monotonía
//     —comprar más nunca puede descontar menos— se comprueba al escribir,
//     porque al leer ya sería tarde.
// ============================================================================

const t = (desdeCantidad: number, descuentoPct: number, unidad = 'spot'): TramoVolumen => ({
  unidad,
  desdeCantidad,
  descuentoPct,
})

describe('resolverVolumen — de una cantidad a UN descuento', () => {
  it('sin tramos no descuenta nada: la venta sale como ayer', () => {
    expect(resolverVolumen([], 500)).toEqual(SIN_VOLUMEN)
    expect(resolverVolumen([], 0)).toEqual(SIN_VOLUMEN)
  })

  it('por debajo del primer umbral no descuenta', () => {
    expect(resolverVolumen([t(50, 10)], 49)).toEqual(SIN_VOLUMEN)
  })

  it('el umbral es INCLUSIVO: «a partir de 50» incluye el 50', () => {
    expect(resolverVolumen([t(50, 10)], 50)).toEqual({ descuentoPct: 10, desdeCantidad: 50 })
  })

  it('gana el umbral MAYOR que se alcanza, no el primero ni el ultimo de la lista', () => {
    const escala = [t(100, 15), t(10, 5), t(50, 10)]
    expect(resolverVolumen(escala, 9)).toEqual(SIN_VOLUMEN)
    expect(resolverVolumen(escala, 10)).toEqual({ descuentoPct: 5, desdeCantidad: 10 })
    expect(resolverVolumen(escala, 49)).toEqual({ descuentoPct: 5, desdeCantidad: 10 })
    expect(resolverVolumen(escala, 50)).toEqual({ descuentoPct: 10, desdeCantidad: 50 })
    expect(resolverVolumen(escala, 99)).toEqual({ descuentoPct: 10, desdeCantidad: 50 })
    expect(resolverVolumen(escala, 100)).toEqual({ descuentoPct: 15, desdeCantidad: 100 })
    expect(resolverVolumen(escala, 100000)).toEqual({ descuentoPct: 15, desdeCantidad: 100 })
  })

  it('una cantidad que no es un numero no descuenta — y NO revienta la venta', () => {
    // Un `?? 0` al reves —tratar la basura como «cantidad enorme»— regalaria el
    // tramo mas alto. Aqui lo ilegible cae al lado que NO mueve dinero.
    for (const basura of [NaN, Infinity, -1, null, undefined, 'cincuenta', {}, []]) {
      expect(resolverVolumen([t(50, 10)], basura as never), `basura ${JSON.stringify(basura)}`)
        .toEqual(SIN_VOLUMEN)
    }
  })

  it('una cantidad FRACCIONARIA no alcanza ningun tramo', () => {
    // ⚠️ De un MUTANTE QUE SOBREVIVIO, y aqui NO es un defecto: hoy
    // `cantidadEfectiva` solo devuelve enteros, asi que este camino no se
    // alcanza. Se fija el comportamiento en vez de forzar el mutante, y se
    // elige el lado que NO mueve dinero: media unidad no es una unidad
    // comprada. Si algun dia se venden fracciones, esta prueba es la que
    // obliga a decidirlo a proposito en vez de descubrirlo cobrando de menos.
    expect(resolverVolumen([t(50, 10)], 50.5)).toEqual(SIN_VOLUMEN)
    expect(resolverVolumen([t(50, 10)], 49.9)).toEqual(SIN_VOLUMEN)
  })

  it('un tramo con datos ilegibles se ignora en vez de contaminar el precio', () => {
    expect(resolverVolumen([{ unidad: 'spot', desdeCantidad: NaN, descuentoPct: 10 }], 500))
      .toEqual(SIN_VOLUMEN)
    expect(resolverVolumen([{ unidad: 'spot', desdeCantidad: 50, descuentoPct: NaN }], 500))
      .toEqual(SIN_VOLUMEN)
  })

  it('con datos NO monotonos (anteriores a la validacion) gana igualmente el umbral mayor, de forma estable', () => {
    // Nunca «el descuento mas grande»: el desempate tiene que ser el mismo
    // siempre, o dos lecturas de la misma venta darian dos precios.
    const torcida = [t(50, 20), t(100, 5)]
    expect(resolverVolumen(torcida, 120)).toEqual({ descuentoPct: 5, desdeCantidad: 100 })
  })
})

describe('motivoTramoInvalido — lo que NO se puede guardar', () => {
  it('acepta una escala creciente', () => {
    expect(motivoTramoInvalido(t(100, 15), [t(10, 5), t(50, 10)])).toBeNull()
  })

  it('rechaza un umbral repetido: son dos precios para la misma compra', () => {
    const m = motivoTramoInvalido(t(50, 15), [t(50, 10)])
    expect(m).toMatch(/50/)
    expect(m).toMatch(/ya hay un tramo/i)
  })

  it('el umbral repetido en OTRA unidad no estorba: la escala es por unidad', () => {
    expect(motivoTramoInvalido(t(50, 15, 'mensual'), [t(50, 10, 'spot')])).toBeNull()
  })

  it('rechaza comprar mas y descontar menos', () => {
    expect(motivoTramoInvalido(t(100, 5), [t(50, 10)])).toMatch(/comprar mas/i)
    expect(motivoTramoInvalido(t(20, 30), [t(50, 10)])).toMatch(/comprar mas/i)
  })

  it('rechaza dos umbrales con el MISMO descuento: el segundo no cambia nada', () => {
    expect(motivoTramoInvalido(t(100, 10), [t(50, 10)])).toMatch(/comprar mas/i)
  })

  it('y lo rechaza TAMBIEN por el otro lado, con el tramo nuevo por DEBAJO', () => {
    // ⚠️ De un MUTANTE QUE SOBREVIVIO. La monotonia se comprueba en las dos
    // direcciones y las dos ramas son distintas; la de arriba solo ejercitaba
    // una. Con el empate suelto en esta, «desde 20 → 10 %» convivria con
    // «desde 50 → 10 %» y el segundo no haria absolutamente nada.
    expect(motivoTramoInvalido(t(20, 10), [t(50, 10)])).toMatch(/comprar mas/i)
    expect(motivoTramoInvalido(t(20, 5), [t(50, 10)])).toBeNull()
  })

  it('rechaza «desde 1»: eso no es volumen, es bajar el tarifario entero', () => {
    expect(motivoTramoInvalido(t(1, 10), [])).toMatch(/desde 2/i)
    expect(motivoTramoInvalido(t(0, 10), [])).toMatch(/desde 2/i)
  })

  it('rechaza una cantidad con decimales: no se compran 2.5 spots', () => {
    expect(motivoTramoInvalido(t(2.5, 10), [])).toMatch(/entero/i)
  })

  it('rechaza un descuento de 0 %: es una regla que no hace nada', () => {
    expect(motivoTramoInvalido(t(50, 0), [])).toMatch(/mayor que 0/i)
  })

  it('rechaza un descuento fuera de [0, 100] y lo no numerico', () => {
    expect(motivoTramoInvalido(t(50, 101), [])).toMatch(/100/)
    expect(motivoTramoInvalido(t(50, -5), [])).toMatch(/mayor que 0/i)
    expect(motivoTramoInvalido({ unidad: 'spot', desdeCantidad: 50, descuentoPct: NaN }, []))
      .toMatch(/numero/i)
  })

  it('rechaza una unidad vacia', () => {
    expect(motivoTramoInvalido(t(50, 10, '  '), [])).toMatch(/unidad/i)
  })

  it('no se compara consigo mismo al editar', () => {
    const vivo: TramoVolumen = { id: 'x', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }
    expect(motivoTramoInvalido({ ...vivo, descuentoPct: 12 }, [vivo])).toBeNull()
  })
})

describe('volumenDeLineas — el volumen de una propuesta entera', () => {
  it('sin volumen devuelve exactamente el bruto de hoy', () => {
    const r = volumenDeLineas([
      { precio: 60000, descuentoVolumenPct: 0 },
      { precio: 40000, descuentoVolumenPct: 0 },
    ])
    expect(r).toEqual({
      bruto: 100000,
      descuentoVolumenMonto: 0,
      brutoConVolumen: 100000,
      volumenPctEfectivo: 0,
    })
  })

  it('redondea LINEA A LINEA, como el resto de los precios de lista del sistema', () => {
    const r = volumenDeLineas([{ precio: 1005, descuentoVolumenPct: 10 }])
    expect(r.descuentoVolumenMonto).toBe(101) // round(100.5) = 101
    expect(r.brutoConVolumen).toBe(904)
  })

  it('el porcentaje efectivo de la propuesta es el PONDERADO, no el promedio de los tramos', () => {
    // 100 000 con 20 % y 100 000 sin nada: se regalaron 20 000 de 200 000 = 10 %.
    const r = volumenDeLineas([
      { precio: 100000, descuentoVolumenPct: 20 },
      { precio: 100000, descuentoVolumenPct: 0 },
    ])
    expect(r.descuentoVolumenMonto).toBe(20000)
    expect(r.brutoConVolumen).toBe(180000)
    expect(r.volumenPctEfectivo).toBeCloseTo(10, 10)
  })

  it('una propuesta sin lineas no divide entre cero', () => {
    expect(volumenDeLineas([])).toEqual({
      bruto: 0,
      descuentoVolumenMonto: 0,
      brutoConVolumen: 0,
      volumenPctEfectivo: 0,
    })
  })

  it('un porcentaje ilegible en una linea se lee como SIN descuento, nunca como NaN', () => {
    // `numeric` de Postgres admite NaN y lo propaga: sin esta guarda, una sola
    // fila corrupta convertiria el bruto entero de la propuesta en NaN.
    const r = volumenDeLineas([{ precio: 1000, descuentoVolumenPct: NaN as never }])
    expect(r.descuentoVolumenMonto).toBe(0)
    expect(r.brutoConVolumen).toBe(1000)
  })
})
