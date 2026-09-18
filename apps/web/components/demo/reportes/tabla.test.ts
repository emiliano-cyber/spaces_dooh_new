import { describe, it, expect } from 'vitest'
import {
  COLUMNAS,
  avisosDelReporte,
  formatoPorcentaje,
  ordenInicialDe,
  ordenarFilas,
  siguienteOrden,
  type FilaOrdenable,
} from './tabla'

// ============================================================================
//  El ordenamiento de la tabla y el formato de sus dos columnas raras.
// ----------------------------------------------------------------------------
//  `margenPct` es `number | null`, y ese `null` significa «no hubo ingreso»,
//  NO «0 %». Si se ordena o se pinta como un cero, una pantalla con 15 000 de
//  renta y cero ventas se lee como «no gana ni pierde», que es lo contrario de
//  lo que paso. Es el unico sitio donde el ordenamiento puede MENTIR, y por eso
//  sale del `.tsx`.
// ============================================================================

// La fila de prueba trae TODOS los campos del contrato, incluidos los que solo
// llegan en una dimension: es lo que hace que el guard del bloque 4 se ponga
// rojo cuando el endpoint gana un campo, en vez de dejar una columna muda.
type FilaDePrueba = FilaOrdenable

function fila(p: Partial<FilaOrdenable> & { clave: string }): FilaDePrueba {
  return {
    etiqueta: p.clave,
    ingreso: 0,
    costoEspacio: 0,
    costoOperacion: 0,
    costoEnergia: 0,
    costoTotal: 0,
    margen: 0,
    margenPct: null,
    tieneContrato: true,
    visitas: 0,
    visitasPorTipo: {},
    costoOperacionPct: null,
    horasEnSitio: null,
    visitasConDuracion: 0,
    m2: 0,
    ingresoPorM2: 0,
    margenPorM2: 0,
    kwh: 0,
    costoPorKwh: null,
    ...p,
  }
}

const filas: FilaDePrueba[] = [
  fila({ clave: 'a', etiqueta: 'Periferico Sur', ingreso: 100_000, margen: 40_000, margenPct: 40, costoTotal: 60_000 }),
  fila({ clave: 'b', etiqueta: 'Andes', ingreso: 50_000, margen: -10_000, margenPct: -20, costoTotal: 60_000 }),
  fila({ clave: 'c', etiqueta: 'Ángeles', ingreso: 0, margen: -15_000, margenPct: null, costoTotal: 15_000, tieneContrato: true }),
  fila({ clave: 'd', etiqueta: 'Bosques', ingreso: 20_000, margen: 20_000, margenPct: 100, costoTotal: 0, tieneContrato: false }),
]

describe('1 · el orden por omision es el del servidor: peor margen primero', () => {
  it('en `sitio` el orden inicial es por margen ascendente', () => {
    // La pregunta que contesta este reporte es «¿que pantallas estan perdiendo
    // dinero?». Si la pantalla reordenara al recibir, discutiria con el
    // servidor sobre la misma pregunta. El orden de las otras tres dimensiones
    // —y el CRONOLOGICO de `trimestre`— esta en `tabla.dimensiones.test.ts`.
    expect(ordenInicialDe('sitio')).toEqual({ columna: 'margen', direccion: 'asc' })
    expect(ordenarFilas(filas, ordenInicialDe('sitio'), 'sitio').map((f) => f.etiqueta)).toEqual([
      'Ángeles',
      'Andes',
      'Bosques',
      'Periferico Sur',
    ])
  })
})

describe('2 · el null de margenPct no se ordena como un cero', () => {
  it('va al final ordenando ascendente', () => {
    const r = ordenarFilas(filas, { columna: 'margenPct', direccion: 'asc' }, 'sitio')
    expect(r.map((f) => f.margenPct)).toEqual([-20, 40, 100, null])
  })

  it('y TAMBIEN al final ordenando descendente', () => {
    // Un `null` tratado como 0 se colaria entre -20 y 40 en una direccion y al
    // principio en la otra: la fila sin ingreso saltaria de sitio y parecia que
    // «no gana ni pierde».
    const r = ordenarFilas(filas, { columna: 'margenPct', direccion: 'desc' }, 'sitio')
    expect(r.map((f) => f.margenPct)).toEqual([100, 40, -20, null])
  })
})

describe('3 · lo que un ordenamiento hecho a mano rompe', () => {
  it('no muta el arreglo que recibe', () => {
    // `Array.prototype.sort` ordena EN SITIO. Sobre el arreglo del `useState`
    // de React eso es una mutacion invisible que no vuelve a renderizar.
    const antes = filas.map((f) => f.clave)
    ordenarFilas(filas, { columna: 'ingreso', direccion: 'desc' }, 'sitio')
    expect(filas.map((f) => f.clave)).toEqual(antes)
  })

  it('ordena texto con la regla del español, no por codigo de caracter', () => {
    // 'Á' vale 193 y 'B' 66: por codigo, «Ángeles» iria DESPUES de «Bosques».
    const r = ordenarFilas(filas, { columna: 'etiqueta', direccion: 'asc' }, 'sitio')
    expect(r.map((f) => f.etiqueta)).toEqual(['Andes', 'Ángeles', 'Bosques', 'Periferico Sur'])
  })

  it('las columnas numericas ordenan por numero', () => {
    const r = ordenarFilas(filas, { columna: 'ingreso', direccion: 'desc' }, 'sitio')
    expect(r.map((f) => f.ingreso)).toEqual([100_000, 50_000, 20_000, 0])
  })
})

describe('4 · el clic en la cabecera', () => {
  it('la misma columna invierte la direccion', () => {
    expect(siguienteOrden({ columna: 'ingreso', direccion: 'desc' }, 'ingreso')).toEqual({
      columna: 'ingreso',
      direccion: 'asc',
    })
  })

  it('una columna nueva arranca en SU direccion util, no en la que quedara', () => {
    // Al pasar de «margen ascendente» a «ingreso», lo util es el ingreso mayor
    // primero; heredar el `asc` pondria arriba las pantallas que no vendieron.
    expect(siguienteOrden({ columna: 'margen', direccion: 'asc' }, 'ingreso')).toEqual({
      columna: 'ingreso',
      direccion: 'desc',
    })
    expect(siguienteOrden({ columna: 'ingreso', direccion: 'desc' }, 'etiqueta')).toEqual({
      columna: 'etiqueta',
      direccion: 'asc',
    })
  })

  it('margen y margenPct arrancan por el PEOR, igual que el reporte', () => {
    expect(siguienteOrden({ columna: 'etiqueta', direccion: 'asc' }, 'margen').direccion).toBe('asc')
    expect(siguienteOrden({ columna: 'etiqueta', direccion: 'asc' }, 'margenPct').direccion).toBe('asc')
  })

  it('hay una columna por cada campo ordenable de la fila, y ninguna repetida', () => {
    // Sin esta comprobacion el bucle de abajo pasa en VERDE sobre una lista
    // vacia, que es como un guard se queda verde por accidente. Y si el
    // contrato del endpoint gana un campo, esto se pone rojo en vez de dejar
    // una columna muda.
    // `clave` es la identidad de la fila (la llave de React) y `tieneContrato`
    // es un aviso, no una medida: ninguno de los dos se ordena. `visitasPorTipo`
    // es un objeto —no hay un orden sensato entre dos repartos por tipo— y
    // `visitasConDuracion` es el DENOMINADOR de `horasEnSitio`: una nota al pie
    // de esa celda, no una columna con la que rankear.
    const NO_SON_MEDIDAS = ['clave', 'tieneContrato', 'visitasPorTipo', 'visitasConDuracion']
    const ordenables = Object.keys(fila({ clave: 'x' })).filter((k) => !NO_SON_MEDIDAS.includes(k))
    expect([...COLUMNAS.map((c) => c.clave)].sort()).toEqual(ordenables.sort())
    expect(new Set(COLUMNAS.map((c) => c.clave)).size).toBe(COLUMNAS.length)
  })

  it('toda columna declarada se puede ordenar y tiene etiqueta en español', () => {
    for (const c of COLUMNAS) {
      expect(() => ordenarFilas(filas, { columna: c.clave, direccion: 'asc' }, 'sitio'), c.clave).not.toThrow()
      expect(c.label.length, c.clave).toBeGreaterThan(2)
      expect(c.label, c.clave).not.toBe(c.clave)
    }
  })
})

describe('5 · el porcentaje sin ingreso no se pinta como 0 %', () => {
  it('null es una raya, no un cero', () => {
    expect(formatoPorcentaje(null)).toBe('—')
  })

  it('un porcentaje se pinta con un decimal y su signo', () => {
    expect(formatoPorcentaje(40)).toBe('40.0 %')
    expect(formatoPorcentaje(-20.55)).toBe('-20.6 %')
  })

  it('un cero REAL si se pinta como 0 %', () => {
    // Hubo ingreso y el margen quedo en cero: eso si es «no gana ni pierde».
    expect(formatoPorcentaje(0)).toBe('0.0 %')
  })
})

describe('6 · lo que el reporte deja fuera se ensena, no se esconde', () => {
  // Rango CERRADO: el 18 de septiembre de 2026 el trimestre vivo es jul-sep, y
  // abr-jun ya termino. Se pide asi para que el aviso de «periodo en curso» no
  // se cuele en estas aserciones — si se colara, el `toEqual([])` de abajo se
  // pone rojo, que es justo lo que se quiere. Ese aviso tiene su propio bloque
  // en `tabla.dimensiones.test.ts`.
  const CERRADO = { desde: '2026-04-01', hasta: '2026-06-30', hoy: new Date(2026, 8, 18) }

  it('cuenta las filas sin contrato: su costo de espacio NO esta medido', () => {
    // Sin contrato no hay renta atribuida, asi que su costo de espacio es 0 y
    // su margen sale infladamente bueno. Esconderlo es peor que no tenerlo.
    const a = avisosDelReporte({ ...CERRADO, dimension: 'sitio', filas })
    expect(a.find((x) => x.clave === 'sin-contrato')?.texto).toMatch(/^1 pantalla /)
  })

  it('cuenta las filas sin ingreso en el rango: cuestan y no vendieron', () => {
    const a = avisosDelReporte({ ...CERRADO, dimension: 'sitio', filas })
    expect(a.find((x) => x.clave === 'sin-ingreso')?.texto).toMatch(/^1 pantalla /)
  })

  it('sobre cero filas no inventa advertencias', () => {
    expect(avisosDelReporte({ ...CERRADO, dimension: 'sitio', filas: [] })).toEqual([])
  })
})
