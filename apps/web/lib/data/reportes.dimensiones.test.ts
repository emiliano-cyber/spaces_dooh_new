import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  rentabilidadPorTrimestre,
  rentabilidadPorOperacion,
  rentabilidadPorM2,
  DIMENSIONES_REPORTE,
} from './reportes'
import { medioLabel } from './derive'
import { COSTOS_OT_RESPALDO } from '../costos-ot'

// ============================================================================
//  Las tres dimensiones que devolvían 501.
// ----------------------------------------------------------------------------
//  `GET /api/reportes/rentabilidad` declaró desde el día uno las cuatro
//  dimensiones de su contrato —`sitio`, `trimestre`, `operacion`, `m2`— y solo
//  la primera tenía motor. Aquí se cierran las otras tres.
//
//  Cada una contesta una PREGUNTA DISTINTA, y por eso ninguna es un `group by`
//  intercambiable del mismo cálculo:
//
//   · `trimestre`  → ¿cómo evoluciona el negocio en el tiempo?
//   · `operacion`  → ¿en qué pantallas se nos come el dinero en visitas?
//   · `m2`         → ¿qué superficie estática rinde y cuál no?
//
//  Todas las cifras están calculadas A MANO en los comentarios.
// ============================================================================

function baseDatos(over: Record<string, unknown>): any {
  const vacio = { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [] }
  return { ...vacio, ...over }
}

const ARRENDADORES = [{ id: 'A1', nombre: 'Arrendador Uno' }]

// Contrato de pantalla SUELTA (sin predio): la renta es íntegra de esa pantalla,
// así no hay que arrastrar la atribución por caras en cada cuenta a mano.
function contrato(sitioId: string, monto: number, over: Record<string, unknown> = {}) {
  return {
    id: `C-${sitioId}`, sitioId, predioId: null, arrendadorId: 'A1',
    montoRenta: monto, periodicidad: 'MENSUAL', estatus: 'VIGENTE',
    fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
    ...over,
  }
}

function reserva(sitioId: string, precio: number, over: Record<string, unknown> = {}) {
  return {
    sitioId, precio, estatus: 'CONFIRMADA',
    fechaInicio: '2026-02-01', fechaFin: '2026-02-28',
    ...over,
  }
}

const Q1 = { desde: '2026-01-01', hasta: '2026-03-31' }

// ════════════════════════════════════════════════════════════════════════════
//  1 · `trimestre` — la serie en el tiempo
// ════════════════════════════════════════════════════════════════════════════

// S1 con 12 000 de renta al mes y una campaña de 50 000 en febrero.
// S2 con 3 000 de renta al mes y ninguna campaña.
const SERIE = baseDatos({
  sitios: [
    { id: 'S1', predioId: null, caras: 1, nombre: 'Uno', claveInterna: 'K1' },
    { id: 'S2', predioId: null, caras: 1, nombre: 'Dos', claveInterna: 'K2' },
  ],
  contratos: [contrato('S1', 12000), contrato('S2', 3000)],
  arrendadores: ARRENDADORES,
  reservas: [reserva('S1', 50000)],
})

const SEMESTRE = { desde: '2026-01-01', hasta: '2026-06-30' }

describe('dimension trimestre — una fila por trimestre, sumando todas las pantallas', () => {
  // ─── Cuenta a mano, primer semestre de 2026 ───────────────────────────────
  //  Renta de las dos pantallas = 12 000 + 3 000 = 15 000 al mes
  //  T1 = 15 000 × 3 = 45 000 de costo de espacio; ingreso 50 000 (febrero)
  //      margen = 50 000 − 45 000 = 5 000 → margenPct = 5 000/50 000 = 10 %
  //  T2 = 45 000 de costo, 0 de ingreso → margen = −45 000, margenPct = null
  it('agrega TODAS las pantallas dentro de cada trimestre', () => {
    const r = rentabilidadPorTrimestre(SERIE, { ...SEMESTRE, granularidad: 'trimestre' })
    expect(r.dimension).toBe('trimestre')
    expect(r.filas.map((f) => f.clave)).toEqual(['2026-T1', '2026-T2'])
    const [t1, t2] = r.filas
    expect(t1.ingreso).toBe(50000)
    expect(t1.costoEspacio).toBe(45000)
    expect(t1.margen).toBe(5000)
    expect(t1.margenPct).toBe(10)
    expect(t2.ingreso).toBe(0)
    expect(t2.costoEspacio).toBe(45000)
    expect(t2.margenPct).toBeNull()
  })

  // Una serie de tiempo ORDENADA POR MARGEN es ilegible: la pregunta de esta
  // dimensión es «¿cómo va el año?», no «¿qué trimestre fue el peor?». Es la
  // única dimensión del módulo que NO ordena por peor margen primero, y se
  // comprueba con un escenario donde los dos órdenes dan resultados distintos:
  // T2 (−45 000) iría antes que T1 (+5 000).
  it('las filas van en orden CRONOLOGICO, no por peor margen', () => {
    const r = rentabilidadPorTrimestre(SERIE, { ...SEMESTRE, granularidad: 'trimestre' })
    expect(r.filas.map((f) => f.clave)).toEqual(['2026-T1', '2026-T2'])
    expect(r.filas[0].margen).toBeGreaterThan(r.filas[1].margen)
  })

  it('la etiqueta es la MISMA que pinta la grafica de ocupacion', () => {
    // `etiquetaBucket` se exporta justamente para que no haya dos etiquetados
    // del mismo bucket diciendo «T1» en una pantalla y «1er trimestre» en otra.
    const r = rentabilidadPorTrimestre(SERIE, { ...SEMESTRE, granularidad: 'trimestre' })
    expect(r.filas.map((f) => f.etiqueta)).toEqual(['T1 2026', 'T2 2026'])
  })

  it('con granularidad mes, cada trimestre trae sus tres meses desglosados', () => {
    const r = rentabilidadPorTrimestre(SERIE, { ...SEMESTRE, granularidad: 'mes' })
    const t1 = r.filas[0]
    expect(t1.periodos.map((p) => p.clave)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(t1.periodos.map((p) => p.ingreso)).toEqual([0, 50000, 0])
    expect(t1.periodos.map((p) => p.costoEspacio)).toEqual([15000, 15000, 15000])
    // El desglose cuadra con su fila.
    expect(t1.periodos.reduce((a, p) => a + p.costoEspacio, 0)).toBe(t1.costoEspacio)
  })

  it('los totales del reporte son la suma de los trimestres', () => {
    const r = rentabilidadPorTrimestre(SERIE, { ...SEMESTRE, granularidad: 'trimestre' })
    expect(r.totales.ingreso).toBe(50000)
    expect(r.totales.costoEspacio).toBe(90000)
    expect(r.totales.margen).toBe(-40000)
  })

  // NEGATIVO: un trimestre sin movimiento SÍ sale en una serie de tiempo, al
  // contrario que una pantalla sin movimiento. Un hueco en una serie se lee
  // como «faltan datos»; un cero se lee como «no pasó nada», que es la verdad.
  it('un trimestre sin movimiento aparece EN CERO, no se salta', () => {
    const r = rentabilidadPorTrimestre(
      baseDatos({ sitios: SERIE.sitios, arrendadores: ARRENDADORES, contratos: [] }),
      { desde: '2026-01-01', hasta: '2026-06-30', granularidad: 'trimestre' },
    )
    expect(r.filas.map((f) => f.clave)).toEqual(['2026-T1', '2026-T2'])
    expect(r.filas.every((f) => f.ingreso === 0 && f.costoTotal === 0)).toBe(true)
  })

  it('un rango que cruza el anio no mezcla trimestres de anios distintos', () => {
    const r = rentabilidadPorTrimestre(SERIE, {
      desde: '2026-11-01', hasta: '2027-02-28', granularidad: 'trimestre',
    })
    expect(r.filas.map((f) => f.clave)).toEqual(['2026-T4', '2027-T1'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  2 · `operacion` — visitas contra el dinero que produce el sitio
// ════════════════════════════════════════════════════════════════════════════

// El ejemplo TEXTUAL del dueño, que este reporte tiene que poder enseñar:
//
//   «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las
//    mismas campañas, pero a una van a cada rato a arreglarla.»
//
// Mismas campañas (30 000 cada una en febrero), misma renta (5 000 al mes), y
// la diferencia entera está en las visitas: cuatro contra una.
const OPERACION = baseDatos({
  sitios: [
    { id: 'TLA', predioId: null, caras: 1, nombre: 'Tlalpan G500', claveInterna: 'TLA-01' },
    { id: 'SMO', predioId: null, caras: 1, nombre: 'G500 Santa Monica', claveInterna: 'SMO-01' },
    // La pantalla que DISCRIMINA los dos órdenes posibles: margen pésimo por una
    // renta carísima y CERO visitas. Por peor margen saldría primera; en un
    // reporte de operación no tiene nada que decir, y si saliera arriba taparía
    // justamente las que sí son un problema de operación.
    { id: 'CAR', predioId: null, caras: 1, nombre: 'Renta Cara', claveInterna: 'CAR-01' },
  ],
  contratos: [contrato('TLA', 5000), contrato('SMO', 5000), contrato('CAR', 50000)],
  arrendadores: ARRENDADORES,
  reservas: [reserva('TLA', 30000), reserva('SMO', 30000), reserva('CAR', 30000)],
  ordenesTrabajo: [
    // A Tlalpan van a cada rato: tres correctivos y una herrería. Dos de ellas
    // con duración real medida (2 h y 3 h).
    { sitioId: 'TLA', tipo: 'MANTENIMIENTO_CORRECTIVO', estatus: 'COMPLETADA', fechaCompletada: '2026-02-03', duracionSeg: 7200 },
    { sitioId: 'TLA', tipo: 'MANTENIMIENTO_CORRECTIVO', estatus: 'COMPLETADA', fechaCompletada: '2026-02-14', duracionSeg: 10800 },
    { sitioId: 'TLA', tipo: 'MANTENIMIENTO_CORRECTIVO', estatus: 'COMPLETADA', fechaCompletada: '2026-03-02', duracionSeg: null },
    { sitioId: 'TLA', tipo: 'HERRERIA', estatus: 'COMPLETADA', fechaCompletada: '2026-03-20', duracionSeg: null },
    // A Santa Mónica fueron una vez, de inspección.
    { sitioId: 'SMO', tipo: 'INSPECCION', estatus: 'COMPLETADA', fechaCompletada: '2026-02-10', duracionSeg: null },
  ],
})

describe('dimension operacion — el reporte del ejemplo del dueno', () => {
  // ─── Cuenta a mano, T1 2026 ───────────────────────────────────────────────
  //  Las dos: ingreso 30 000, costo de espacio 5 000 × 3 = 15 000
  //  TLA: 4 OT × 1 500 (respaldo) = 6 000 → margen = 30 000 − 15 000 − 6 000 = 9 000
  //  SMO: 1 OT × 1 500          = 1 500 → margen = 30 000 − 15 000 − 1 500 = 13 500
  //  margenPct TLA = 9 000/30 000 = 30 % · SMO = 13 500/30 000 = 45 %
  it('con las MISMAS campanas, la que se visita mas es menos rentable', () => {
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'trimestre' })
    const tla = r.filas.find((f) => f.clave === 'TLA')!
    const smo = r.filas.find((f) => f.clave === 'SMO')!
    expect(tla.ingreso).toBe(smo.ingreso) // «han tenido las mismas campañas»
    expect(tla.visitas).toBe(4)
    expect(smo.visitas).toBe(1)
    expect(tla.costoOperacion).toBe(4 * COSTOS_OT_RESPALDO.MANTENIMIENTO_CORRECTIVO)
    expect(smo.costoOperacion).toBe(COSTOS_OT_RESPALDO.INSPECCION)
    expect(tla.margen).toBe(9000)
    expect(smo.margen).toBe(13500)
    // La frase del dueño, en una aserción.
    expect(tla.margenPct!).toBeLessThan(smo.margenPct!)
  })

  // La pregunta de esta dimensión no es «¿qué pantalla gana menos?» sino «¿en
  // qué pantallas se nos va el dinero en visitas?». Por eso ordena por costo de
  // operación descendente y no por peor margen: una pantalla con margen
  // horrible por renta cara no es un problema de operación.
  it('ordena por costo de operacion DESCENDENTE, no por peor margen', () => {
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.map((f) => f.clave)).toEqual(['TLA', 'SMO', 'CAR'])
    // CAR tiene el peor margen de las tres, con diferencia: 30 000 de ingreso
    // contra 50 000 × 3 = 150 000 de renta → −120 000. Por peor margen iría
    // primera, y no tiene una sola visita que explicar.
    const car = r.filas.find((f) => f.clave === 'CAR')!
    expect(car.margen).toBe(-120000)
    expect(car.visitas).toBe(0)
    expect(r.filas[r.filas.length - 1].clave).toBe('CAR')
  })

  it('dice QUE PROPORCION del ingreso se come la operacion', () => {
    // 6 000/30 000 = 20 % en Tlalpan · 1 500/30 000 = 5 % en Santa Mónica.
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.find((f) => f.clave === 'TLA')!.costoOperacionPct).toBe(20)
    expect(r.filas.find((f) => f.clave === 'SMO')!.costoOperacionPct).toBe(5)
  })

  it('desglosa las visitas POR TIPO: no es lo mismo inspeccionar que reparar', () => {
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.find((f) => f.clave === 'TLA')!.visitasPorTipo).toEqual({
      MANTENIMIENTO_CORRECTIVO: 3,
      HERRERIA: 1,
    })
    expect(r.filas.find((f) => f.clave === 'SMO')!.visitasPorTipo).toEqual({ INSPECCION: 1 })
  })

  it('suma las horas REALES de las OT que las tienen medidas', () => {
    // 7 200 + 10 800 = 18 000 s = 5 h. Las otras dos OT de Tlalpan no tienen
    // las dos marcas de tiempo, así que no se inventan: solo cuentan las dos
    // que sí, y el reporte dice cuántas fueron.
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'trimestre' })
    const tla = r.filas.find((f) => f.clave === 'TLA')!
    expect(tla.horasEnSitio).toBe(5)
    expect(tla.visitasConDuracion).toBe(2)
    // Sin ninguna duración medida es `null`, NO 0: «no lo sabemos» y «fueron y
    // no tardaron nada» son cosas distintas.
    expect(r.filas.find((f) => f.clave === 'SMO')!.horasEnSitio).toBeNull()
  })

  it('las visitas se desglosan por periodo, para ver si empeora', () => {
    const r = rentabilidadPorOperacion(OPERACION, { ...Q1, granularidad: 'mes' })
    const tla = r.filas.find((f) => f.clave === 'TLA')!
    // enero 0 · febrero 2 · marzo 2
    expect(tla.periodos.map((p) => p.visitas)).toEqual([0, 2, 2])
  })

  describe('NEGATIVOS', () => {
    it('una OT CANCELADA no es una visita ni cuesta', () => {
      const datos = baseDatos({
        ...OPERACION,
        ordenesTrabajo: [
          { sitioId: 'TLA', tipo: 'HERRERIA', estatus: 'CANCELADA', fechaCompletada: '2026-02-03', duracionSeg: null },
        ],
      })
      const tla = rentabilidadPorOperacion(datos, { ...Q1, granularidad: 'trimestre' }).filas
        .find((f) => f.clave === 'TLA')!
      expect(tla.visitas).toBe(0)
      expect(tla.costoOperacion).toBe(0)
    })

    it('una OT sin sitio no se le carga a ninguna pantalla', () => {
      // `ordenes_trabajo.sitio_id` es nullable (on delete set null). Una OT
      // huérfana no puede aparecer atribuida a una pantalla cualquiera.
      const datos = baseDatos({
        ...OPERACION,
        ordenesTrabajo: [
          { sitioId: null, tipo: 'HERRERIA', estatus: 'COMPLETADA', fechaCompletada: '2026-02-03', duracionSeg: null },
        ],
      })
      const r = rentabilidadPorOperacion(datos, { ...Q1, granularidad: 'trimestre' })
      expect(r.filas.every((f) => f.visitas === 0)).toBe(true)
      expect(r.totales.costoOperacion).toBe(0)
    })

    it('una pantalla con visitas y SIN ingreso aparece: es el peor caso', () => {
      const datos = baseDatos({
        sitios: [{ id: 'X', predioId: null, caras: 1, nombre: 'Sin vender', claveInterna: 'X-1' }],
        arrendadores: ARRENDADORES,
        contratos: [],
        reservas: [],
        ordenesTrabajo: [
          { sitioId: 'X', tipo: 'HERRERIA', estatus: 'COMPLETADA', fechaCompletada: '2026-02-03', duracionSeg: null },
        ],
      })
      const r = rentabilidadPorOperacion(datos, { ...Q1, granularidad: 'trimestre' })
      expect(r.filas.map((f) => f.clave)).toEqual(['X'])
      expect(r.filas[0].costoOperacionPct).toBeNull()
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  3 · `m2` — rendimiento por metro cuadrado, SOLO estáticas
// ════════════════════════════════════════════════════════════════════════════

function estatica(id: string, nombre: string, ancho: number | null, alto: number | null, over: Record<string, unknown> = {}) {
  return {
    id, nombre, claveInterna: `${id}-1`, predioId: null, caras: 1,
    tipoMedio: 'VALLA', exhibicion: 'fijo', esRotativo: false,
    ancho, alto, ...over,
  }
}

const SUPERFICIE = baseDatos({
  sitios: [
    // 6 × 3 = 18 m² por cara, y tiene DOS caras: 36 m². Las dos caras están
    // puestas a propósito, porque es el caso que distingue las dos convenciones
    // posibles (18 vs 36) — y desde el 2026-09-18 la que manda es 36, por
    // decisión del dueño. Ver `MULTIPLICAR_M2_POR_CARAS` en `reportes.ts`.
    estatica('SE1', 'Espectacular Norte', 6, 3, { tipoMedio: 'ESPECTACULAR', caras: 2 }),
    estatica('SE2', 'Valla Sur', 4, 2),
    // Digital por tipo de medio.
    estatica('SD1', 'Pantalla LED', 9.6, 5.4, { tipoMedio: 'PANTALLA_DIGITAL', exhibicion: 'digital' }),
    // Estructura estática pero ROTATIVA: también vende rotación, no metros.
    estatica('SR1', 'Rotativo Centro', 6, 3, { esRotativo: true, exhibicion: 'rotativo' }),
    // Estática sin ancho capturado.
    estatica('SX1', 'Sin medidas', null, 3),
    // Estática con medidas y SIN movimiento en el rango: no es una fila y
    // tampoco es una exclusión.
    estatica('SN1', 'Quieta', 5, 2),
  ],
  contratos: [
    contrato('SE1', 6000), contrato('SE2', 1000), contrato('SD1', 2000),
    contrato('SR1', 2000), contrato('SX1', 1000),
  ],
  arrendadores: ARRENDADORES,
  reservas: [
    reserva('SE1', 36000), reserva('SE2', 8000), reserva('SD1', 50000),
    reserva('SR1', 10000), reserva('SX1', 5000),
  ],
})

describe('dimension m2 — solo estaticas, y diciendo a quien dejo fuera', () => {
  // ─── Cuenta a mano, T1 2026 ───────────────────────────────────────────────
  //  SE1: ingreso 36 000 · espacio 6 000 × 3 = 18 000 · margen 18 000
  //       superficie = 6 × 3 × 2 caras = 36 m²
  //       ingreso/m² = 36 000/36 = 1 000 · margen/m² = 18 000/36 = 500
  //  SE2: ingreso 8 000 · espacio 1 000 × 3 = 3 000 · margen 5 000
  //       superficie = 4 × 2 × 1 cara = 8 m²
  //       ingreso/m² = 8 000/8 = 1 000 · margen/m² = 5 000/8 = 625
  it('calcula el rendimiento por metro cuadrado de las estaticas', () => {
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    const se1 = r.filas.find((f) => f.clave === 'SE1')!
    const se2 = r.filas.find((f) => f.clave === 'SE2')!
    expect(se1.m2).toBe(36)
    expect(se1.ingresoPorM2).toBe(1000)
    expect(se1.margenPorM2).toBe(500)
    expect(se2.m2).toBe(8)
    expect(se2.ingresoPorM2).toBe(1000)
    expect(se2.margenPorM2).toBe(625)
  })

  // ─── DECISIÓN DEL DUEÑO, 2026-09-18 — esta prueba la FIJA ─────────────────
  // «Los m2 los define cada pantalla igual que cada cara»: cada pantalla aporta
  // la superficie de TODAS sus caras. Estuvo abierta desde la mañana de ese
  // mismo día, y mientras no había respuesta se contaba UNA CARA.
  //
  // Esta prueba estaba escrita al revés —fijaba las 18— y eso es lo que la hace
  // valer: al invertir la bandera se puso en rojo con
  // `expected 36 to be 18`, junto con las otras tres de este bloque. Una
  // convención que nadie fija se invierte sin que nada se queje.
  it('la superficie suma TODAS las caras: 6 x 3 con dos caras son 36 m2, no 18', () => {
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.find((f) => f.clave === 'SE1')!.m2).toBe(36)
    expect(r.filas.find((f) => f.clave === 'SE1')!.m2).not.toBe(18)
  })

  // Lo literal de la decisión: las caras salen de CADA PANTALLA (`sitios.caras`)
  // y no de una regla global. Con un multiplicador fijo —«×2 para todas», que
  // es la lectura perezosa de «multiplica por caras»— la de una cara y la de
  // tres darían la misma superficie y nadie lo vería: el reporte seguiría
  // calculando y el ranking sería otro.
  it('cada pantalla multiplica por SUS caras, no por un numero fijo', () => {
    const datos = baseDatos({
      sitios: [
        estatica('C1', 'Una cara', 5, 2, { caras: 1 }),
        estatica('C2', 'Dos caras', 5, 2, { caras: 2 }),
        estatica('C3', 'Tres caras', 5, 2, { caras: 3 }),
        // `caras` es nullable en la base: sin dato se cuenta UNA, que es no
        // inventar superficie. Un `null × 10` daría 0 m² y una división por
        // cero más abajo.
        estatica('C0', 'Sin caras', 5, 2, { caras: null }),
      ],
      contratos: [contrato('C1', 1000), contrato('C2', 1000), contrato('C3', 1000), contrato('C0', 1000)],
      arrendadores: ARRENDADORES,
      reservas: [reserva('C1', 1000), reserva('C2', 1000), reserva('C3', 1000), reserva('C0', 1000)],
    })
    const r = rentabilidadPorM2(datos, { ...Q1, granularidad: 'trimestre' })
    const m2De = (clave: string) => r.filas.find((f) => f.clave === clave)!.m2
    expect(m2De('C1')).toBe(10)
    expect(m2De('C2')).toBe(20)
    expect(m2De('C3')).toBe(30)
    expect(m2De('C0')).toBe(10)
  })

  it('el reporte DICE que convencion de superficie uso', () => {
    // Un número por metro cuadrado sin decir qué cuenta como metro cuadrado es
    // una cifra que no se puede conciliar con nada.
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    expect(r.convencionM2).toBe('todas-las-caras')
  })

  // El guard que sobrevive a la decisión, y el que de verdad importa: lo que el
  // reporte DECLARA tiene que ser lo que CALCULÓ. Vale para las dos
  // convenciones, así que sigue vigilando el día que la bandera vuelva atrás —
  // declarar una y aplicar la otra es una cifra por metro que no es de nadie, y
  // no da ningún error.
  it('la convencion declarada coincide con la superficie calculada', () => {
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    const se1 = r.filas.find((f) => f.clave === 'SE1')! // 6 × 3, dos caras
    const unaCara = 6 * 3
    expect(se1.m2).toBe(r.convencionM2 === 'todas-las-caras' ? unaCara * 2 : unaCara)
  })

  it('ordena por PEOR margen por m2 primero', () => {
    // 500 (SE1) antes que 625 (SE2). Ojo: por margen ABSOLUTO el orden sería el
    // contrario —peor primero serían los 5 000 de SE2 contra los 18 000 de
    // SE1—, así que el caso sigue discriminando entre los dos órdenes después de
    // la decisión del 18/09, igual que antes de ella.
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    expect(r.filas.map((f) => f.clave)).toEqual(['SE1', 'SE2'])
    expect(r.filas[0].margen).toBeGreaterThan(r.filas[1].margen)
  })

  describe('las exclusiones, que son la mitad del reporte', () => {
    // Para una pantalla digital el denominador correcto son SPOTS, no metros:
    // meterla en un ranking por m² produce un orden sin sentido —y sin error.
    it('las digitales NO son filas, aunque tengan ingreso de sobra', () => {
      const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
      expect(r.filas.map((f) => f.clave)).not.toContain('SD1')
      expect(r.filas.map((f) => f.clave)).not.toContain('SR1')
      // 50 000 es el mayor ingreso del escenario: si se colara, se colaría arriba.
      expect(r.totales.ingreso).not.toBe(36000 + 8000 + 50000)
    })

    it('las estaticas sin ancho o sin alto tampoco son filas', () => {
      const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
      expect(r.filas.map((f) => f.clave)).not.toContain('SX1')
    })

    // Un reporte que esconde filas SIN DECIRLO se lee como el inventario
    // completo. El número de exclusiones va en la respuesta, a la vista.
    it('la respuesta dice CUANTAS quedaron fuera y por que', () => {
      const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
      expect(r.excluidas).toMatchObject({ digitales: 2, sinMedidas: 1 })
      expect(r.excluidas!.nota).toMatch(/digital/i)
      expect(r.excluidas!.nota).toMatch(/spots/i)
      expect(r.excluidas!.nota).toMatch(/ancho/i)
    })

    // Solo se cuenta como excluida la que TENDRÍA fila: si no, un catálogo con
    // trescientas digitales sin actividad diría «excluí 300» en un reporte
    // donde eso no significa nada.
    it('una estatica sin movimiento no es una exclusion: no tenia fila', () => {
      const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
      expect(r.filas.map((f) => f.clave)).not.toContain('SN1')
      expect(r.excluidas!.sinMedidas).toBe(1) // SX1, no SN1
    })

    it('sin nada que excluir, los contadores van en cero y la nota lo dice', () => {
      const soloEstaticas = baseDatos({
        sitios: [estatica('SE2', 'Valla Sur', 4, 2)],
        contratos: [contrato('SE2', 1000)],
        arrendadores: ARRENDADORES,
        reservas: [reserva('SE2', 8000)],
      })
      const r = rentabilidadPorM2(soloEstaticas, { ...Q1, granularidad: 'trimestre' })
      expect(r.excluidas).toMatchObject({ digitales: 0, sinMedidas: 0 })
      expect(r.excluidas!.nota).toMatch(/no se excluy/i)
    })
  })

  it('los totales son los de las filas QUE SE VEN', () => {
    // 36 000 + 8 000 de ingreso · 18 000 + 3 000 de espacio.
    const r = rentabilidadPorM2(SUPERFICIE, { ...Q1, granularidad: 'trimestre' })
    expect(r.totales.ingreso).toBe(44000)
    expect(r.totales.costoEspacio).toBe(21000)
    expect(r.totales.margen).toBe(23000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  4 · Guards: lo que no se puede reimplementar ni confundir
// ════════════════════════════════════════════════════════════════════════════

// Normaliza los finales de línea ANTES de mirar. Es la lección del 2026-09-18:
// el `.` de JavaScript no cruza `\r`, así que `//.*$` no llega al final de una
// línea CRLF, el comentario NO se quita y sobreviven las propias advertencias
// que citan lo prohibido. Verde en el árbol de quien lo escribió y rojo en el de
// todos los demás. Un guard que solo funciona con un final de línea no es un
// guard.
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('`precio_m2` de la base NO es el metro cuadrado de este reporte', () => {
  // LA TRAMPA. `sitios.precio_m2` ya existe y significa OTRA COSA: es el costo
  // de IMPRESIÓN por m² (`lib/server/sitios-repo.ts`, de donde sale
  // `tarifa_impresion = ancho × alto × precio_m2`). Reusarlo aquí —o ponerle un
  // nombre parecido— haría que un reporte de rentabilidad por superficie se
  // leyera como si dijera algo del negocio cuando habla del proveedor de lonas.
  const MOTOR = sinComentarios(readFileSync(join(__dirname, 'reportes.ts'), 'utf8'))
  const REPO = sinComentarios(
    readFileSync(join(__dirname, '..', 'server', 'reportes-repo.ts'), 'utf8'),
  )

  it('el motor no toca precioM2 ni tarifaImpresion', () => {
    expect(MOTOR).not.toMatch(/precioM2|precio_m2|tarifaImpresion|tarifa_impresion/)
  })

  it('el repo no los lee de la base', () => {
    expect(REPO).not.toMatch(/precio_m2|tarifa_impresion/)
  })

  it('el guard mira codigo y no prosa (control del propio guard)', () => {
    // Si `sinComentarios` dejara de quitar comentarios, los dos casos de arriba
    // se pondrían rojos por los comentarios que explican esta trampa — y el
    // arreglo fácil sería borrar la explicación.
    //
    // El ancla es `precio_m2` DENTRO DE UN COMENTARIO, que es exactamente lo
    // que este guard protege: mientras la advertencia exista, el archivo en
    // crudo la trae y el archivo sin comentarios no. Antes el ancla era el
    // título «DECISIÓN DE NEGOCIO» de otro comentario del mismo archivo, y eso
    // lo hacía frágil por una razón que se cobró el 2026-09-18: al cerrarse la
    // decisión del m² por caras ese título pasó a «DECISIÓN DEL DUEÑO» y el
    // control se puso rojo **sin que nada del guard ni de la trampa hubiera
    // cambiado**. Un control positivo que se rompe al reescribir un
    // encabezado no mide el guard: mide la redacción.
    const CRUDO = readFileSync(join(__dirname, 'reportes.ts'), 'utf8')
    expect(CRUDO, 'la advertencia sobre precio_m2 desaparecio del motor').toMatch(/precio_m2/)
    expect(MOTOR, 'sinComentarios dejo de quitar comentarios').not.toMatch(/precio_m2/)
  })
})

describe('la regla de «digital» del m2 no puede divergir de la de la UI', () => {
  // Hay DOS reglas de «digital» en este repo y difieren A PROPÓSITO
  // (`derive.ts:1373`): la de BOOKING (`esDigital`, solo PANTALLA_DIGITAL,
  // S0-3) y la de PRESENTACIÓN (`medioLabel`, que además cuenta rotativos y
  // exhibición digital).
  //
  // Para el m² manda la de PRESENTACIÓN, porque la pregunta es QUÉ VENDE la
  // pantalla: un rotativo sobre estructura estática vende rotación, y su
  // denominador tampoco son metros. Se comprueba contra `medioLabel` en toda la
  // matriz de combinaciones para que las dos no se separen en silencio.
  it('coincide con medioLabel en las 24 combinaciones posibles', () => {
    const casos: any[] = []
    for (const tipoMedio of ['PANTALLA_DIGITAL', 'ESPECTACULAR', 'VALLA']) {
      for (const esRotativo of [true, false]) {
        for (const exhibicion of ['fijo', 'digital', 'rotativo', '']) {
          casos.push({ tipoMedio, esRotativo, exhibicion })
        }
      }
    }
    expect(casos.length).toBe(24)
    for (const c of casos) {
      const datos = baseDatos({
        sitios: [{ ...estatica('Z', 'Z', 4, 2), ...c }],
        contratos: [contrato('Z', 1000)],
        arrendadores: ARRENDADORES,
        reservas: [reserva('Z', 8000)],
      })
      const r = rentabilidadPorM2(datos, { ...Q1, granularidad: 'trimestre' })
      const excluidaPorDigital = r.excluidas!.digitales === 1
      expect(
        excluidaPorDigital,
        `${JSON.stringify(c)} → medioLabel dice ${medioLabel(c)}`,
      ).toBe(medioLabel(c) === 'Digital')
    }
  })
})

describe('las dimensiones se declaran UNA sola vez', () => {
  it('DIMENSIONES_REPORTE es la lista del contrato del endpoint', () => {
    // El controller valida con zod contra ESTA lista. Declararla dos veces
    // —una en el motor puro y otra en el controller— dejaría un enum que acepta
    // una dimensión sin motor, o un motor que nadie puede pedir.
    //
    // `luz` entra el 2026-09-18 con el consumo electrico, y es la quinta.
    expect(DIMENSIONES_REPORTE).toEqual([
      'sitio',
      'trimestre',
      'operacion',
      'm2',
      'luz',
      // La SEXTA, del 2026-09-18. No la pidio el jefe: sale de la frase del
      // ADR 0034 —el dueno quiere ver sus razones sociales JUNTAS— y la
      // pregunta siguiente de esa frase es cuanto pasa por cada una.
      'entidad',
    ])
  })
})
