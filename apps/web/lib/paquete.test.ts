import { describe, it, expect } from 'vitest'
import {
  repartirPaquete,
  avisoPaqueteIncompleto,
  motivoPaqueteInvalido,
  paqueteDeFila,
  AVISO_PAQUETE_PRECIO_CERRADO,
  type SitioDelPaquete,
} from './paquete'

// ============================================================================
//  El REPARTO es lo que decide si esta fase está bien hecha.
//  ADR 0039, Fase 4. La invariante que se prueba hasta el cansancio es UNA:
//  **Σ partes === precio del paquete**, exactamente, sin un peso de diferencia.
// ============================================================================

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('repartirPaquete · la suma cuadra AL PESO', () => {
  it('reparte a prorrata de la tarifa de lista', () => {
    // 100 000 entre dos pantallas de 60 000 y 40 000 de lista.
    expect(repartirPaquete([60_000, 40_000], 100_000)).toEqual([60_000, 40_000])
  })

  it('con pesos iguales reparte por partes iguales', () => {
    expect(repartirPaquete([100, 100, 100], 180_000)).toEqual([60_000, 60_000, 60_000])
  })

  it('EL CASO QUE DUELE: 180 000 entre 7 pantallas iguales suma exacto', () => {
    // 180000/7 = 25714.2857… Ninguna división entera cuadra: el resto son 2
    // pesos que tienen que aterrizar en alguna parte, y en una sola.
    const partes = repartirPaquete([1, 1, 1, 1, 1, 1, 1], 180_000)
    expect(suma(partes)).toBe(180_000)
    expect(partes).toHaveLength(7)
    // Nadie se lleva más de un peso de diferencia con su vecino.
    expect(Math.max(...partes) - Math.min(...partes)).toBeLessThanOrEqual(1)
  })

  it('el resto va a las partes con MAYOR fracción, no a la primera', () => {
    // 10 entre pesos 1 y 2: exactos 3.333… y 6.666…  → base 3 y 6, resto 1.
    // La fracción mayor es la segunda (.666 > .333), así que se lleva el peso.
    expect(repartirPaquete([1, 2], 10)).toEqual([3, 7])
  })

  it('es DETERMINISTA: dos lecturas de la misma venta dan el mismo reparto', () => {
    const pesos = [3, 3, 3, 3, 3]
    const a = repartirPaquete(pesos, 180_001)
    const b = repartirPaquete(pesos, 180_001)
    expect(a).toEqual(b)
    expect(suma(a)).toBe(180_001)
  })

  it('PROPIEDAD: suma exacta sobre 500 repartos al azar', () => {
    let semilla = 20260928
    const azar = () => {
      // LCG: reproducible a propósito. Un fallo aquí tiene que poder repetirse.
      semilla = (semilla * 1103515245 + 12345) % 2147483648
      return semilla / 2147483648
    }
    for (let caso = 0; caso < 500; caso++) {
      const n = 1 + Math.floor(azar() * 12)
      const pesos = Array.from({ length: n }, () => Math.floor(azar() * 500_000))
      const total = Math.floor(azar() * 5_000_000)
      const partes = repartirPaquete(pesos, total)
      expect(partes).toHaveLength(n)
      expect(suma(partes)).toBe(total)
      // Y ninguna parte es negativa: un renglón en negativo en una cotización
      // se lee como una nota de crédito que nadie emitió.
      expect(partes.every((p) => p >= 0)).toBe(true)
    }
  })

  it('con TODAS las listas en cero cae a partes iguales, y sigue cuadrando', () => {
    // 0/0 no es un reparto. El respaldo es equitativo, nunca un NaN.
    const partes = repartirPaquete([0, 0, 0], 100)
    expect(suma(partes)).toBe(100)
    expect(partes.every((p) => Number.isFinite(p))).toBe(true)
  })

  it('una lista ilegible (NaN, negativa, texto) pesa CERO, no envenena el reparto', () => {
    const partes = repartirPaquete([NaN as any, -50, 100, 'x' as any], 100)
    expect(suma(partes)).toBe(100)
    // Solo la línea legible tiene peso, así que se lleva todo.
    expect(partes[2]).toBe(100)
  })

  it('sin líneas devuelve un reparto vacío, no revienta', () => {
    expect(repartirPaquete([], 180_000)).toEqual([])
  })

  it('un total de cero reparte ceros', () => {
    expect(repartirPaquete([1, 2, 3], 0)).toEqual([0, 0, 0])
  })

  it('un total ilegible se lee como CERO, nunca como NaN', () => {
    // `numeric` de Postgres ADMITE NaN y lo propaga. Un NaN aquí dejaría el
    // neto de la propuesta en NaN con la petición contestando 200 OK.
    expect(repartirPaquete([1, 1], NaN as any)).toEqual([0, 0])
    expect(repartirPaquete([1, 1], 'abc' as any)).toEqual([0, 0])
  })

  it('un total con centavos se redondea a pesos ANTES de repartir', () => {
    // Todo el dinero de este repositorio son pesos enteros (`Math.round`).
    // Repartir centavos produciría partes con decimales que no cuadran.
    const partes = repartirPaquete([1, 1], 101.4)
    expect(suma(partes)).toBe(101)
  })
})

describe('avisoPaqueteIncompleto · quitar una pantalla NO baja el precio', () => {
  const composicion = ['a', 'b', 'c', 'd', 'e']

  it('con las mismas pantallas no hay nada que avisar', () => {
    expect(avisoPaqueteIncompleto(composicion, ['e', 'd', 'c', 'b', 'a'], 'Periférico', 180_000))
      .toBeNull()
  })

  it('si falta una pantalla lo DICE, y dice que el precio no baja', () => {
    const aviso = avisoPaqueteIncompleto(composicion, ['a', 'b', 'c', 'd'], 'Periférico', 180_000)
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('Periferico')
    expect(aviso).toContain('5')
    expect(aviso).toContain('4')
    // Lo que de verdad importa que se lea: el precio cerrado no se mueve.
    expect(aviso).toContain('NO baja')
  })

  it('si sobra una pantalla también lo dice', () => {
    const aviso = avisoPaqueteIncompleto(composicion, [...composicion, 'f'], 'Periférico', 180_000)
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('6')
  })

  it('sin composición congelada no inventa un aviso', () => {
    expect(avisoPaqueteIncompleto(null, ['a'], 'Periférico', 180_000)).toBeNull()
    expect(avisoPaqueteIncompleto([], ['a'], 'Periférico', 180_000)).toBeNull()
  })

  it('cambiar una pantalla por otra SIN cambiar el número también se avisa', () => {
    // Es el caso que no se ve contando: cinco siguen siendo cinco.
    const aviso = avisoPaqueteIncompleto(composicion, ['a', 'b', 'c', 'd', 'z'], 'Periférico', 180_000)
    expect(aviso).toBeTruthy()
  })

  it('la constante del precio cerrado dice lo suyo sin rodeos', () => {
    expect(AVISO_PAQUETE_PRECIO_CERRADO).toContain('cerrado')
  })
})

describe('motivoPaqueteInvalido · lo que no se puede guardar', () => {
  const ok = { nombre: 'Periferico', precioCerrado: 180_000, sitios: ['a', 'b'] }

  it('un paquete bien formado no tiene motivo', () => {
    expect(motivoPaqueteInvalido(ok)).toBeNull()
  })

  it('sin nombre, no', () => {
    expect(motivoPaqueteInvalido({ ...ok, nombre: '   ' })).toMatch(/nombre/i)
  })

  it('un precio de cero o negativo, no: eso no es un paquete', () => {
    expect(motivoPaqueteInvalido({ ...ok, precioCerrado: 0 })).toMatch(/precio/i)
    expect(motivoPaqueteInvalido({ ...ok, precioCerrado: -1 })).toMatch(/precio/i)
  })

  it('un precio con centavos, no: el reparto es en pesos enteros', () => {
    expect(motivoPaqueteInvalido({ ...ok, precioCerrado: 180_000.5 })).toMatch(/entero/i)
  })

  it('un precio ilegible, no', () => {
    expect(motivoPaqueteInvalido({ ...ok, precioCerrado: NaN })).toMatch(/precio/i)
    expect(motivoPaqueteInvalido({ ...ok, precioCerrado: 'mucho' as any })).toMatch(/precio/i)
  })

  it('MENOS DE DOS PANTALLAS no es un paquete: es una tarifa', () => {
    expect(motivoPaqueteInvalido({ ...ok, sitios: [] })).toMatch(/pantalla/i)
    expect(motivoPaqueteInvalido({ ...ok, sitios: ['a'] })).toMatch(/pantalla/i)
  })

  it('la misma pantalla dos veces, no', () => {
    expect(motivoPaqueteInvalido({ ...ok, sitios: ['a', 'a'] })).toMatch(/repetida|dos veces/i)
  })
})

describe('paqueteDeFila · leer el congelado de una propuesta', () => {
  const FILA = {
    paquete_nombre: 'Periferico',
    paquete_precio: '180000.00',
    paquete_admite_codigo: false,
    paquete_aplicado_en: new Date('2026-09-28T18:00:00.000Z'),
    paquete_composicion: ['a', 'b'],
  }

  it('lee el bloque completo, con el `numeric` que `pg` entrega como CADENA', () => {
    const p = paqueteDeFila(FILA)!
    expect(p.nombre).toBe('Periferico')
    expect(p.precio).toBe(180_000)
    expect(p.admiteCodigo).toBe(false)
    expect(p.aplicadoEn).toBe('2026-09-28T18:00:00.000Z')
    expect(p.composicion).toEqual(['a', 'b'])
  })

  it('sin nombre es SIN PAQUETE', () => {
    expect(paqueteDeFila({ ...FILA, paquete_nombre: null })).toBeNull()
    expect(paqueteDeFila({})).toBeNull()
  })

  it('un precio ilegible o ≤ 0 se lee como SIN PAQUETE, nunca como NaN', () => {
    // `numeric` de Postgres ADMITE NaN y lo propaga. Sin esta guarda, el neto
    // de la propuesta entera saldría NaN con un 200 OK.
    expect(paqueteDeFila({ ...FILA, paquete_precio: NaN })).toBeNull()
    expect(paqueteDeFila({ ...FILA, paquete_precio: 'NaN' })).toBeNull()
    expect(paqueteDeFila({ ...FILA, paquete_precio: 0 })).toBeNull()
    expect(paqueteDeFila({ ...FILA, paquete_precio: -5 })).toBeNull()
  })

  it('LA BANDERA NACE APAGADA: solo un `true` de verdad la enciende', () => {
    // Regla 2 del ADR 0039. Con `!!` en vez de `=== true`, la CADENA `'false'`
    // —que es lo que llega de un formulario mal serializado, o de un JSON
    // congelado con el campo en texto— ENCENDERÍA la regla, y un cupón
    // descontaría un 20 % encima de un precio que se vendió como final.
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: 'false' })!.admiteCodigo).toBe(false)
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: 0 })!.admiteCodigo).toBe(false)
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: null })!.admiteCodigo).toBe(false)
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: undefined })!.admiteCodigo).toBe(false)
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: 1 })!.admiteCodigo).toBe(false)
    // Y las DOS formas que sí la encienden: el booleano y el texto 'true' — que
    // es como viaja en un snapshot ya congelado que pasó por JSON.
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: true })!.admiteCodigo).toBe(true)
    expect(paqueteDeFila({ ...FILA, paquete_admite_codigo: 'true' })!.admiteCodigo).toBe(true)
  })

  it('una composición que no es un arreglo se lee como AUSENTE, no se inventa', () => {
    expect(paqueteDeFila({ ...FILA, paquete_composicion: 'a,b' })!.composicion).toBeNull()
    expect(paqueteDeFila({ ...FILA, paquete_composicion: null })!.composicion).toBeNull()
  })
})

describe('SitioDelPaquete · el tipo existe para que el reparto no reciba cualquier cosa', () => {
  it('compila', () => {
    const s: SitioDelPaquete = { sitioId: 'a', parte: 1 }
    expect(s.parte).toBe(1)
  })
})
