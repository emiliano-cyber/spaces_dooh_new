import { describe, it, expect } from 'vitest'
import {
  rentabilidadPorSitio,
  rentabilidadPorLuz,
  DIMENSIONES_REPORTE,
} from './reportes'

// ============================================================================
//  La QUINTA dimensión: `luz`. El consumo eléctrico dentro del margen.
// ----------------------------------------------------------------------------
//  El dueño pidió cinco reportes de rentabilidad y este era el único sin UN
//  SOLO DATO en el sistema: una búsqueda por `kwh`, `consumo`, `energia`,
//  `electric`, `cfe` y `recibo_luz` sobre todo el repositorio devolvía una
//  coincidencia, el valor `'ELECTRICO'` del enum `tipo_ot`.
//
//  Decisión del dueño, 2026-09-18, literal:
//
//    «El medidor suele ser del predio, no de la pantalla, así que se captura
//     una vez por predio y por mes y SE REPARTE ENTRE SUS PANTALLAS IGUAL QUE
//     LA RENTA. Es lo más realista y reusa el reparto que ya existe y está
//     probado.»
//
//  De ahí las dos propiedades que estas pruebas fijan, y que son el reporte:
//
//   1. EL REPARTO NO SE REINVENTA. La renta de un contrato de predio se
//      reparte entre las caras de sus pantallas (`rentaAtribuidaPorSitio`), y
//      el recibo de luz se reparte con esa MISMA fracción de caras. La
//      fracción se declara una sola vez (`fraccionDeCarasPorPredio`, en
//      `derive.ts`) y la usan las dos: dos implementaciones divergirían, y aquí
//      divergir significa que la renta se reparta de una forma y la luz de otra
//      sobre las mismas pantallas.
//
//   2. LO QUE FALTA SE DECLARA. Un consumo ausente NO es un consumo cero. Un
//      reporte de energía que suma solo los recibos capturados y presenta el
//      resultado como el total de la luz MIENTE SIN DAR ERROR, que es
//      exactamente el patrón de fallo que este repositorio persigue.
//
//  Todas las cifras están calculadas A MANO en los comentarios.
// ============================================================================

function baseDatos(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [],
    contratos: [],
    arrendadores: [],
    reservas: [],
    ordenesTrabajo: [],
    consumosEnergia: [],
  }
  return { ...vacio, ...over }
}

const ARRENDADORES = [{ id: 'A1', nombre: 'Arrendador Uno' }]

/** Contrato anclado al PREDIO: su renta se reparte entre las caras del predio. */
function contratoPredio(predioId: string, monto: number, over: Record<string, unknown> = {}) {
  return {
    id: `C-${predioId}`,
    sitioId: null,
    predioId,
    arrendadorId: 'A1',
    montoRenta: monto,
    periodicidad: 'MENSUAL',
    estatus: 'VIGENTE',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    ...over,
  }
}

function recibo(over: Record<string, unknown> = {}) {
  return {
    predioId: 'P1',
    sitioId: null,
    periodo: '2026-02-01',
    medidor: 'M-1',
    kwh: 1500,
    importe: 3000,
    ...over,
  }
}

// ─── El escenario base, con sus cuentas a mano ──────────────────────────────
//
//  Predio P1, un solo contrato de predio de 9 000 al mes y DOS pantallas:
//    · S1 con 2 caras
//    · S2 con 1 cara
//  Σ caras del predio = 3, así que la fracción de caras es 2/3 y 1/3.
//
//  Renta atribuida (lo que ya hacía el reporte):
//    S1 = 9 000 × 2/3 = 6 000      S2 = 9 000 × 1/3 = 3 000
//
//  Recibo de luz de febrero: 3 000 de importe, 1 500 kWh. MISMA fracción:
//    S1 = 3 000 × 2/3 = 2 000      S2 = 3 000 × 1/3 = 1 000
//    S1 = 1 500 × 2/3 = 1 000 kWh  S2 = 1 500 × 1/3 =   500 kWh
//
//  Campaña de 30 000 en febrero, solo en S1.
const PREDIO = baseDatos({
  sitios: [
    { id: 'S1', predioId: 'P1', caras: 2, nombre: 'Tlalpan', claveInterna: 'TLA' },
    { id: 'S2', predioId: 'P1', caras: 1, nombre: 'Santa Monica', claveInterna: 'SMO' },
  ],
  contratos: [contratoPredio('P1', 9000)],
  arrendadores: ARRENDADORES,
  reservas: [
    { sitioId: 'S1', precio: 30000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
  ],
  consumosEnergia: [recibo()],
})

const FEBRERO = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

describe('la dimension luz esta DECLARADA en el contrato del endpoint', () => {
  it('`luz` es una de las dimensiones del reporte', () => {
    // `MOTORES` en el controller es un `Record` EXHAUSTIVO sobre este enum, así
    // que declarar la dimensión sin escribir su motor no compila. Es por lo que
    // no hace falta un 501 — y por lo que no se vuelve a meter uno: se acaba de
    // retirar por inalcanzable.
    expect([...DIMENSIONES_REPORTE]).toContain('luz')
  })
})

describe('el costo de la energia ENTRA EN EL MARGEN, y las cifras cuadran', () => {
  // Esto es lo primero que hay que probar y lo único que no se puede equivocar:
  // hasta hoy el total era `costoEspacio + costoOperacion`. Al añadir una cuarta
  // fuente de costo, TODA cifra del pie y de los KPI tiene que seguir cuadrando.
  // Un `costoTotal` que se quede sin la energía deja un margen optimista sin
  // dar ningún error, y el desglose por periodo dejaría de sumar su fila.

  it('costoTotal = espacio + operacion + ENERGIA, en cada fila', () => {
    const r = rentabilidadPorSitio(PREDIO, FEBRERO)
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    const s2 = r.filas.find((f) => f.clave === 'S2')!

    // S1: espacio 6 000 + energía 2 000 = 8 000 de costo
    expect(s1.costoEspacio).toBe(6000)
    expect(s1.costoEnergia).toBe(2000)
    expect(s1.costoTotal).toBe(8000)
    expect(s1.margen).toBe(22000) // 30 000 − 8 000

    // S2: sin ingreso, espacio 3 000 + energía 1 000 = 4 000
    expect(s2.costoEspacio).toBe(3000)
    expect(s2.costoEnergia).toBe(1000)
    expect(s2.costoTotal).toBe(4000)
    expect(s2.margen).toBe(-4000)
  })

  it('los TOTALES del reporte traen la energia y siguen cuadrando', () => {
    const r = rentabilidadPorSitio(PREDIO, FEBRERO)
    // Ingreso 30 000 · espacio 9 000 · energía 3 000 → costo 12 000
    // margen = 30 000 − 12 000 = 18 000 → 18 000/30 000 = 60 %
    expect(r.totales.costoEspacio).toBe(9000)
    expect(r.totales.costoEnergia).toBe(3000)
    expect(r.totales.costoTotal).toBe(12000)
    expect(r.totales.margen).toBe(18000)
    expect(r.totales.margenPct).toBe(60)
  })

  it('el reparto NO INVENTA NI PIERDE dinero: las fracciones suman el recibo', () => {
    // La propiedad que hace usable el reparto, y la misma que se le exige al
    // prorrateo del ingreso: la suma de lo atribuido es EXACTAMENTE el recibo.
    const r = rentabilidadPorSitio(PREDIO, FEBRERO)
    const suma = r.filas.reduce((a, f) => a + (f.costoEnergia ?? 0), 0)
    expect(suma).toBe(3000)
  })

  it('el desglose por periodo cuadra con su fila, tambien en energia', () => {
    const trimestre = { desde: '2026-01-01', hasta: '2026-03-31', granularidad: 'mes' as const }
    const r = rentabilidadPorSitio(PREDIO, trimestre)
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    // Solo febrero tiene recibo: enero y marzo van a cero.
    expect(s1.periodos.map((p) => p.costoEnergia)).toEqual([0, 2000, 0])
    expect(s1.periodos.reduce((a, p) => a + p.costoEnergia, 0)).toBe(s1.costoEnergia)
    // Y el costoTotal de cada periodo incluye su energía.
    expect(s1.periodos[1].costoTotal).toBe(8000) // 6 000 espacio + 2 000 luz
  })
})

describe('el reparto es el MISMO que el de la renta — no una copia', () => {
  it('la fraccion de caras de la luz es la de la renta', () => {
    const r = rentabilidadPorSitio(PREDIO, FEBRERO)
    const s1 = r.filas.find((f) => f.clave === 'S1')!
    const s2 = r.filas.find((f) => f.clave === 'S2')!
    // renta: 6 000 / 3 000 = 2   ·   luz: 2 000 / 1 000 = 2
    expect(s1.costoEspacio / s2.costoEspacio).toBe(s1.costoEnergia! / s2.costoEnergia!)
  })

  it('un recibo de PANTALLA SUELTA no se reparte: es integro de esa pantalla', () => {
    // Igual que un contrato de pantalla suelta. `sitios.predio_id` es nullable,
    // así que hay pantallas sin predio y su consumo no tendría dónde ir si el
    // anclaje fuera solo al predio.
    const datos = baseDatos({
      sitios: [{ id: 'X1', predioId: null, caras: 2, nombre: 'Suelta', claveInterna: 'SUE' }],
      consumosEnergia: [recibo({ predioId: null, sitioId: 'X1', importe: 800, kwh: 400 })],
    })
    const r = rentabilidadPorSitio(datos, FEBRERO)
    // Las caras NO dividen: son lados de la MISMA pantalla, no pantallas
    // distintas entre las que repartir.
    expect(r.filas.find((f) => f.clave === 'X1')!.costoEnergia).toBe(800)
  })
})

describe('el recibo es MENSUAL y el bucket puede ser medio mes', () => {
  it('un bucket recortado cobra la FRACCION DE DIAS del mes del recibo', () => {
    // Marzo tiene 31 días y el rango corta el 15: 15/31 del recibo.
    //   3 100 × 15/31 = 1 500.00 exactos
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [recibo({ periodo: '2026-03-01', importe: 3100, kwh: 3100 })],
    })
    const r = rentabilidadPorSitio(datos, { desde: '2026-03-01', hasta: '2026-03-15', granularidad: 'mes' })
    expect(r.filas[0].costoEnergia).toBe(1500)
  })

  it('el recibo de un mes FUERA del rango no entra', () => {
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [recibo({ periodo: '2026-05-01' })],
    })
    const r = rentabilidadPorSitio(datos, FEBRERO)
    // Sin ingreso, sin renta, sin OT y sin energía: la pantalla no aparece.
    expect(r.filas).toHaveLength(0)
  })

  it('la energia SOLA basta para que una pantalla aparezca en el reporte', () => {
    // `hayMovimiento` decide quién sale. Una pantalla que solo consumió luz
    // TIENE un costo del periodo: dejarla fuera esconde dinero gastado.
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [recibo()],
    })
    const r = rentabilidadPorSitio(datos, FEBRERO)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].costoEnergia).toBe(3000)
    expect(r.filas[0].margen).toBe(-3000)
  })
})

describe('dimension luz — sus columnas y su orden', () => {
  it('trae kWh y costo por kWh, y ordena por MAS CONSUMO primero', () => {
    // Dos pantallas sueltas: la que más luz se come NO es la de peor margen.
    // Por peor margen saldría primero P2 (renta carísima, nada de luz) y
    // taparía justo a la que es un problema de consumo.
    const datos = baseDatos({
      sitios: [
        { id: 'P1S', predioId: null, caras: 1, nombre: 'Glotona', claveInterna: 'GLO' },
        { id: 'P2S', predioId: null, caras: 1, nombre: 'Cara', claveInterna: 'CAR' },
      ],
      contratos: [
        { id: 'C2', sitioId: 'P2S', predioId: null, arrendadorId: 'A1', montoRenta: 120000,
          periodicidad: 'MENSUAL', estatus: 'VIGENTE', fechaInicio: '2026-01-01', fechaFin: '2026-12-31' },
      ],
      arrendadores: ARRENDADORES,
      consumosEnergia: [
        recibo({ predioId: null, sitioId: 'P1S', importe: 5000, kwh: 2500 }),
        recibo({ predioId: null, sitioId: 'P2S', importe: 100, kwh: 50, medidor: 'M-2' }),
      ],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    expect(r.dimension).toBe('luz')
    expect(r.filas.map((f) => f.clave)).toEqual(['P1S', 'P2S'])
    // La de peor margen es la OTRA: −120 100 contra −5 000.
    expect(r.filas[1].margen).toBeLessThan(r.filas[0].margen)
    // 5 000 / 2 500 kWh = 2.00 por kWh
    expect(r.filas[0].kwh).toBe(2500)
    expect(r.filas[0].costoPorKwh).toBe(2)
  })

  it('costoPorKwh es NULL con cero kWh, no cero', () => {
    // Un «0.00 por kWh» se lee como «la luz es gratis aquí». Sin kWh no hay
    // cociente que calcular, igual que `margenPct` sin ingreso.
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: null, caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      contratos: [
        { id: 'C1', sitioId: 'S1', predioId: null, arrendadorId: 'A1', montoRenta: 1000,
          periodicidad: 'MENSUAL', estatus: 'VIGENTE', fechaInicio: '2026-01-01', fechaFin: '2026-12-31' },
      ],
      arrendadores: ARRENDADORES,
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    expect(r.filas[0].kwh).toBe(0)
    expect(r.filas[0].costoPorKwh).toBeNull()
  })

  it('DOS MEDIDORES en el mismo predio y mes suman: no es un duplicado', () => {
    // Un predio puede tener más de un medidor, y por eso la unicidad de la base
    // lleva el medidor dentro. Si la clave fuera (predio, periodo) a secas, el
    // segundo recibo real sería imposible de capturar.
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [
        recibo({ medidor: 'M-1', importe: 1000, kwh: 500 }),
        recibo({ medidor: 'M-2', importe: 2000, kwh: 900 }),
      ],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    expect(r.filas[0].costoEnergia).toBe(3000)
    expect(r.filas[0].kwh).toBe(1400)
  })
})

describe('LO QUE FALTA SE DECLARA — un consumo ausente no es un consumo cero', () => {
  it('cuenta los PREDIOS-MES sin recibo del rango', () => {
    // Enero a marzo, un solo punto de medición (el predio P1) y recibo solo de
    // febrero: se esperaban 3 pares punto-mes y faltan 2.
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      contratos: [contratoPredio('P1', 9000)],
      arrendadores: ARRENDADORES,
      consumosEnergia: [recibo()],
    })
    const r = rentabilidadPorLuz(datos, { desde: '2026-01-01', hasta: '2026-03-31', granularidad: 'mes' })
    expect(r.cobertura!.esperados).toBe(3)
    expect(r.cobertura!.faltantes).toBe(2)
    expect(r.cobertura!.nota).toMatch(/2 de 3/)
  })

  it('con TODOS los recibos capturados lo dice igual, en vez de callarse', () => {
    // «No falta ninguno» y «no te lo digo» se ven idénticos si no hay texto. Es
    // el hallazgo C1 de la auditoría QA: el silencio indistinguible de la
    // ausencia. Mismo criterio que `notaDeExclusiones` en la dimensión m².
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [recibo()],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    expect(r.cobertura!.faltantes).toBe(0)
    expect(r.cobertura!.nota).toMatch(/[Nn]o falta/)
  })

  it('un recibo de un predio SIN PANTALLAS no se traga en silencio', () => {
    // El reparto no tiene a quién darle ese importe, así que desaparecería del
    // reporte. Es dinero capturado que no se ve en ninguna fila: se declara.
    const datos = baseDatos({
      sitios: [{ id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' }],
      consumosEnergia: [recibo(), recibo({ predioId: 'P9', importe: 777 })],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    expect(r.cobertura!.recibosSinDestino).toBe(1)
    expect(r.cobertura!.importeSinDestino).toBe(777)
    expect(r.cobertura!.nota).toMatch(/777/)
    // Y no se cuela en los totales por otra puerta.
    expect(r.totales.costoEnergia).toBe(3000)
  })

  it('una pantalla SIN PREDIO cuenta como su propio punto de medicion', () => {
    // Si no, el hueco de una pantalla suelta no se contaría y el reporte diría
    // que no falta nada cuando le falta justo esa.
    const datos = baseDatos({
      sitios: [
        { id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' },
        { id: 'X1', predioId: null, caras: 1, nombre: 'Suelta', claveInterna: 'SUE' },
      ],
      contratos: [contratoPredio('P1', 9000)],
      arrendadores: ARRENDADORES,
      consumosEnergia: [recibo()],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    // Dos puntos (el predio P1 y la pantalla suelta X1) × 1 mes = 2 esperados,
    // y solo el predio tiene recibo.
    expect(r.cobertura!.esperados).toBe(2)
    expect(r.cobertura!.faltantes).toBe(1)
  })

  it('un punto de medicion sin NINGUNA fila en el reporte no cuenta como hueco', () => {
    // Mismo criterio que las exclusiones del m²: solo se cuenta lo que TENDRÍA
    // fila. Si no, un catálogo con trescientos predios dormidos diría «faltan
    // 900 recibos» en un reporte donde eso no significa nada.
    const datos = baseDatos({
      sitios: [
        { id: 'S1', predioId: 'P1', caras: 1, nombre: 'Uno', claveInterna: 'K1' },
        { id: 'S2', predioId: 'P2', caras: 1, nombre: 'Dormida', claveInterna: 'K2' },
      ],
      consumosEnergia: [recibo()],
    })
    const r = rentabilidadPorLuz(datos, FEBRERO)
    // S2 no tiene ingreso, ni renta, ni OT, ni luz: no sale en el reporte, así
    // que su predio no es un hueco.
    expect(r.filas.map((f) => f.clave)).toEqual(['S1'])
    expect(r.cobertura!.esperados).toBe(1)
    expect(r.cobertura!.faltantes).toBe(0)
  })
})
