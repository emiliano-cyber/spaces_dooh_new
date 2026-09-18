import { describe, it, expect } from 'vitest'
import { rentabilidadPorSitio } from './reportes'

// ============================================================================
//  La atribución del COSTO tiene que ser CONSCIENTE DEL PERIODO.
// ----------------------------------------------------------------------------
//  Es el defecto que hacía deshonesto cualquier reporte de un periodo pasado, y
//  estaba documentado como limitación desde el día uno
//  (`vault/02-Backend/reportes-rentabilidad.md`, «Lo que esta primera versión
//  NO hace», punto 1):
//
//    La atribución se resolvía con `contratoVigentePorSitio()` (derive.ts:1239),
//    que filtra por `contratoActivo()` (derive.ts:1133) — o sea VIGENTE,
//    POR_VENCER o RENOVADO, el estatus DE HOY. Consecuencias, las dos malas:
//
//     1. Un reporte del primer trimestre de 2025 NO VEÍA el contrato que
//        gobernaba ese trimestre y ya venció: la pantalla salía a coste CERO, o
//        no salía en absoluto. Un margen calculado sin su renta no es optimista,
//        es falso.
//     2. Un cambio de renta se aplicaba HACIA ATRÁS: el contrato de hoy, con su
//        importe de hoy, se cobraba en todos los periodos anteriores en los que
//        su vigencia solapaba.
//
//  Lo que este fichero fija: **el contrato que cuenta es el que SOLAPA EL RANGO
//  PEDIDO**, con independencia de su estatus de hoy. Un VENCIDO cuenta en su
//  periodo —está caducado, no es falso—; un CANCELADO y un INCOMPLETO no cuentan
//  en ninguno.
//
//  Todas las cifras están calculadas A MANO en los comentarios. Un reporte de
//  dinero cuyo número esperado sale de correr el propio código no prueba nada.
// ============================================================================

function baseDatos(over: Record<string, unknown>): any {
  const vacio = { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [] }
  return { ...vacio, ...over }
}

const ARRENDADORES = [
  { id: 'AV', nombre: 'Arrendador Viejo' },
  { id: 'AN', nombre: 'Arrendador Nuevo' },
]

// Una pantalla SUELTA (sin predio) para que la renta no se reparta entre caras:
// aquí se mide la consciencia del periodo, no la atribución, que ya está probada
// en `derive.anclaje-contrato.test.ts`.
const SUELTA = [{ id: 'S1', predioId: null, caras: 1, nombre: 'Suelta Uno', claveInterna: 'K1' }]

// Contrato VIEJO: gobernó todo 2025 a 8 000 al mes y HOY está VENCIDO.
const VIEJO = {
  id: 'CV', sitioId: 'S1', predioId: null, arrendadorId: 'AV',
  montoRenta: 8000, periodicidad: 'MENSUAL', estatus: 'VENCIDO',
  fechaInicio: '2025-01-01', fechaFin: '2025-12-31',
}

// Contrato NUEVO: gobierna 2026 a 12 000 al mes y HOY está VIGENTE.
const NUEVO = {
  id: 'CN', sitioId: 'S1', predioId: null, arrendadorId: 'AN',
  montoRenta: 12000, periodicidad: 'MENSUAL', estatus: 'VIGENTE',
  fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
}

const RELEVO = baseDatos({ sitios: SUELTA, contratos: [VIEJO, NUEVO], arrendadores: ARRENDADORES })

const T1_2025 = { desde: '2025-01-01', hasta: '2025-03-31', granularidad: 'trimestre' as const }
const T1_2026 = { desde: '2026-01-01', hasta: '2026-03-31', granularidad: 'trimestre' as const }

function fila(datos: any, opts: any, clave = 'S1') {
  return rentabilidadPorSitio(datos, opts).filas.find((f) => f.clave === clave)
}

describe('el contrato de un periodo PASADO cuenta aunque hoy este VENCIDO', () => {
  // ─── Cuenta a mano ────────────────────────────────────────────────────────
  //  T1 2025 son tres meses naturales completos = 3 meses de renta.
  //  8 000 × 3 = 24 000. Sin ingreso: margen = −24 000.
  //
  //  Antes de este cambio el resultado era CERO —y la fila no aparecía— porque
  //  `contratoActivo()` no acepta VENCIDO: el único contrato que la atribución
  //  veía era el de 2026, cuya vigencia no toca 2025.
  it('un trimestre de 2025 cobra la renta que se pagaba en 2025', () => {
    const f = fila(RELEVO, T1_2025)!
    expect(f.costoEspacio).toBe(24000)
    expect(f.margen).toBe(-24000)
  })

  it('y el arrendador de la fila es el de ESE periodo, no el de hoy', () => {
    // Un reporte que dice el nombre equivocado del arrendador manda a conciliar
    // con quien no cobró: el dato es tan parte del dinero como el importe.
    expect(fila(RELEVO, T1_2025)!.arrendador).toBe('Arrendador Viejo')
    expect(fila(RELEVO, T1_2026)!.arrendador).toBe('Arrendador Nuevo')
    expect(fila(RELEVO, T1_2025)!.tieneContrato).toBe(true)
  })

  // El otro lado de la misma moneda, y el que impide que el arreglo se pase de
  // largo: la renta NUEVA no se cobra en el periodo del contrato VIEJO.
  it('el cambio de renta NO se aplica hacia atras', () => {
    const f = fila(RELEVO, T1_2025)!
    // 12 000 × 3 = 36 000 es lo que habría cobrado el contrato de hoy.
    expect(f.costoEspacio).not.toBe(36000)
    expect(fila(RELEVO, T1_2026)!.costoEspacio).toBe(36000)
  })

  it('un contrato que NO solapa el rango no aporta nada', () => {
    // 2024 está antes de los dos contratos: el reporte queda vacío, no a cero.
    const r = rentabilidadPorSitio(RELEVO, {
      desde: '2024-01-01', hasta: '2024-03-31', granularidad: 'trimestre',
    })
    expect(r.filas).toEqual([])
  })
})

describe('el relevo de contrato cae en el periodo que le toca', () => {
  // VIEJO hasta el 30/06 y NUEVO desde el 01/07, los dos dentro de 2026.
  const relevoAMitadDeAnio = baseDatos({
    sitios: SUELTA,
    arrendadores: ARRENDADORES,
    contratos: [
      { ...VIEJO, fechaInicio: '2026-01-01', fechaFin: '2026-06-30' },
      { ...NUEVO, fechaInicio: '2026-07-01', fechaFin: '2026-12-31' },
    ],
  })

  // ─── Cuenta a mano, los cuatro trimestres de 2026 ─────────────────────────
  //  T1 y T2 los gobierna VIEJO:  8 000 × 3 = 24 000 cada uno
  //  T3 y T4 los gobierna NUEVO: 12 000 × 3 = 36 000 cada uno
  //  Total del año = 24 000 + 24 000 + 36 000 + 36 000 = 120 000
  //
  //  Antes de este cambio salía [0, 0, 36 000, 36 000] = 72 000: los dos
  //  primeros trimestres a cero porque VIEJO ya no está activo. El reporte
  //  escondía 48 000 de renta realmente pagada.
  it('cada trimestre cobra la renta de SU contrato', () => {
    const f = fila(relevoAMitadDeAnio, {
      desde: '2026-01-01', hasta: '2026-12-31', granularidad: 'trimestre',
    })!
    expect(f.periodos.map((p) => p.costoEspacio)).toEqual([24000, 24000, 36000, 36000])
    expect(f.costoEspacio).toBe(120000)
  })

  // El caso fino: el relevo ocurre DENTRO de un mes. Los dos contratos solapan
  // el mismo bucket, así que el bucket se parte por la frontera de vigencia y
  // cada trozo se cobra a su precio. Si el bucket no se partiera, uno de los dos
  // contratos se perdería entero.
  //
  // ─── Cuenta a mano, julio de 2026 (31 días) ──────────────────────────────
  //  VIEJO cubre del 01 al 15 → 15 días →  8 000 × 15/31 = 120 000/31
  //  NUEVO cubre del 16 al 31 → 16 días → 12 000 × 16/31 = 192 000/31
  //  Suma = 312 000/31 = 10 064.516129… → 10 064.52 al redondear al salir
  it('un relevo A MITAD DE MES parte el mes y cobra cada trozo a su precio', () => {
    const aMitadDeMes = baseDatos({
      sitios: SUELTA,
      arrendadores: ARRENDADORES,
      contratos: [
        { ...VIEJO, fechaInicio: '2026-01-01', fechaFin: '2026-07-15' },
        { ...NUEVO, fechaInicio: '2026-07-16', fechaFin: '2026-12-31' },
      ],
    })
    const f = fila(aMitadDeMes, { desde: '2026-07-01', hasta: '2026-07-31', granularidad: 'mes' })!
    expect(f.costoEspacio).toBe(10064.52)
    // Y no es ninguno de los dos meses enteros, que es el error que se evita.
    expect(f.costoEspacio).not.toBe(8000)
    expect(f.costoEspacio).not.toBe(12000)
  })
})

describe('la atribucion entre las caras del predio sigue siendo la de derive', () => {
  // Predio P1 con DOS pantallas de 1 cara (Σ caras = 2): el contrato del predio
  // se reparte a la mitad. Esa lógica NO se rehizo aquí —se reusa
  // `rentaAtribuidaPorSitio()`—, y esta prueba es la que lo demuestra ahora que
  // la selección del contrato es por periodo.
  const predio = baseDatos({
    sitios: [
      { id: 'S1', predioId: 'P1', caras: 1, nombre: 'Cara Uno', claveInterna: 'K1' },
      { id: 'S2', predioId: 'P1', caras: 1, nombre: 'Cara Dos', claveInterna: 'K2' },
    ],
    arrendadores: ARRENDADORES,
    contratos: [
      { ...VIEJO, predioId: 'P1', montoRenta: 10000 },
      { ...NUEVO, predioId: 'P1', montoRenta: 20000 },
    ],
  })

  // 2025: 10 000 × (1/2) = 5 000 al mes por pantalla → 5 000 × 3 = 15 000 en T1
  // 2026: 20 000 × (1/2) = 10 000 al mes por pantalla → 10 000 × 3 = 30 000
  it('el contrato del periodo se reparte entre las caras, no se duplica', () => {
    expect(fila(predio, T1_2025, 'S1')!.costoEspacio).toBe(15000)
    expect(fila(predio, T1_2025, 'S2')!.costoEspacio).toBe(15000)
    expect(fila(predio, T1_2026, 'S1')!.costoEspacio).toBe(30000)
    expect(fila(predio, T1_2026, 'S2')!.costoEspacio).toBe(30000)
  })
})

describe('NEGATIVOS — que un estatus cuente en su periodo no significa que cuenten todos', () => {
  // CANCELADO es un acuerdo DESCARTADO: nunca se pagó, en ningún periodo.
  // Cobrarlo sería inventar un costo, que es peor que esconderlo.
  it('un contrato CANCELADO no cuesta ni en su propio periodo', () => {
    const datos = baseDatos({
      sitios: SUELTA, arrendadores: ARRENDADORES,
      contratos: [{ ...VIEJO, estatus: 'CANCELADO' }],
    })
    expect(rentabilidadPorSitio(datos, T1_2025).filas).toEqual([])
  })

  // INCOMPLETO es un pendiente de CAPTURA (ADR 0001): sus cuatro datos pueden
  // ser nulos. Se excluye aunque traiga importe, porque el acuerdo todavía no
  // está afirmado — el mismo criterio que `sitiosSinContratoCompleto()`
  // (derive.ts), donde INCOMPLETO y CANCELADO son los dos que no acreditan.
  it('un contrato INCOMPLETO no cuesta aunque traiga importe capturado', () => {
    const datos = baseDatos({
      sitios: SUELTA, arrendadores: ARRENDADORES,
      contratos: [{ ...VIEJO, estatus: 'INCOMPLETO' }],
    })
    expect(rentabilidadPorSitio(datos, T1_2025).filas).toEqual([])
  })

  // VENCIDO y RENOVADO son acuerdos REALES en su periodo. VENCIDO es el caso
  // que da nombre a todo esto; RENOVADO se comprueba para que nadie lo saque de
  // la lista pensando que ya no representa un pago.
  it('VENCIDO y RENOVADO cuentan en su periodo', () => {
    for (const estatus of ['VENCIDO', 'RENOVADO', 'VIGENTE', 'POR_VENCER']) {
      const datos = baseDatos({
        sitios: SUELTA, arrendadores: ARRENDADORES, contratos: [{ ...VIEJO, estatus }],
      })
      expect(fila(datos, T1_2025)?.costoEspacio, `estatus ${estatus}`).toBe(24000)
    }
  })

  it('la renta sigue recortada a la vigencia dentro del propio bucket', () => {
    // El contrato arranca el 16/03: el trimestre solo cobra esos 16 días.
    // 8 000 × 16/31 = 128 000/31 = 4 129.032258… → 4 129.03
    const datos = baseDatos({
      sitios: SUELTA, arrendadores: ARRENDADORES,
      contratos: [{ ...VIEJO, fechaInicio: '2025-03-16', fechaFin: '2025-12-31' }],
    })
    expect(fila(datos, T1_2025)!.costoEspacio).toBe(4129.03)
  })

  it('el desglose por periodo sigue cuadrando con el total de la fila', () => {
    // La propiedad que hace usable el reporte: si el desglose no cuadra con su
    // propio total, hay que desconfiar de los dos.
    const f = fila(RELEVO, { desde: '2025-01-01', hasta: '2026-12-31', granularidad: 'mes' })!
    const suma = f.periodos.reduce((a, p) => a + p.costoEspacio, 0)
    expect(Math.round(suma * 100) / 100).toBe(f.costoEspacio)
    // 12 meses a 8 000 + 12 meses a 12 000 = 96 000 + 144 000 = 240 000
    expect(f.costoEspacio).toBe(240000)
  })
})
