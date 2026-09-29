import { describe, it, expect } from 'vitest'
import { rentabilidadPorTarifa, rentabilidadPorVendedor } from './reportes'

// ============================================================================
//  UN PAQUETE CERRADO SALE DE LA COMPARACIÓN «PUBLICADA vs NETA» — CON RAYA.
//  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  ─── POR QUÉ SE SACA, Y NO ES UNA RENDICIÓN ──────────────────────────────
//
//  El reporte compara `porSitio[].lista` contra `porSitio[].neto` y llama a la
//  diferencia «el descuento comercial MÁS la comisión de agencia». Esa frase es
//  verdad para todo lo que este producto ha vendido hasta hoy, porque el neto
//  SIEMPRE salía de multiplicar la lista por factores.
//
//  Con un paquete NO sale de ahí. El neto de una pantalla es su parte de un
//  precio de conjunto repartida a prorrata, y ese precio lo puso una persona
//  mirando el trato entero. Meterlo en la comparación afirmaría un descuento
//  comercial que nadie concedió — exactamente lo que este módulo se niega a
//  hacer con el centinela de ambigüedad y con las dos convenciones de precio.
//
//  Y hay un caso que lo cierra sin discusión: **un paquete se puede vender POR
//  ENCIMA de la suma de las listas.** Un conjunto premium —«las cinco de
//  Periférico, exclusivas, sin competencia»— vale más que sus partes. Ahí
//  `neto > lista` y el «descuento» saldría NEGATIVO, que se lee como haber
//  cobrado por encima de la tarifa publicada. Un reporte de dinero no puede
//  enseñar eso.
//
//  La consecuencia hay que decirla, y el reporte la dice: el ingreso de un
//  paquete cuenta en `ingreso` y en `ingresoSinTarifa`, así que la cobertura
//  BAJA cuando se venden paquetes. Es correcto: hay menos venta comparable.
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
    entidades: [],
    facturas: [],
    tarifasPublicadas: [],
    vendedores: [],
    vendedorDeCampana: [],
  }
  return { ...vacio, ...over }
}

const FEB = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

const SITIOS = [
  { id: 'S1', predioId: null, caras: 1, nombre: 'Tlalpan', claveInterna: 'TLA' },
  { id: 'S2', predioId: null, caras: 1, nombre: 'Santa Monica', claveInterna: 'SMO' },
]

const reserva = (sitioId: string, campanaId: string, precio: number) => ({
  sitioId, campanaId, precio, estatus: 'CONFIRMADA',
  fechaInicio: '2026-02-01', fechaFin: '2026-02-28',
})

// ─── El escenario ──────────────────────────────────────────────────────────
//
//  · S1 · campaña C1, venta NORMAL de propuesta. Lista 100 000, neto 72 000.
//    Comparable: descuento+comisión 28 000 (28 %).
//  · S2 · campaña C2, venta de PAQUETE. Su lista es 60 000 y su neto 43 200
//    —la parte del paquete—, pero ese 43 200 no sale de descontar 60 000: sale
//    de repartir 180 000 entre cinco pantallas. NO comparable.
const BASE = baseDatos({
  sitios: SITIOS,
  reservas: [reserva('S1', 'C1', 72_000), reserva('S2', 'C2', 43_200)],
  tarifasPublicadas: [
    { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
    { campanaId: 'C2', porSitio: [{ sitioId: 'S2', lista: 60_000, neto: 43_200, dePaquete: true }] },
  ],
})

const filaDe = (r: any, clave: string) => r.filas.find((f: any) => f.clave === clave)!

describe('1 · el paquete sale con RAYA de publicada vs neta', () => {
  it('la venta normal SÍ se compara', () => {
    const s1 = filaDe(rentabilidadPorTarifa(BASE, FEB), 'S1')
    expect(s1.ingresoLista).toBe(100_000)
    expect(s1.descuentoYComision).toBe(28_000)
  })

  it('NEGATIVA · la venta de PAQUETE no se compara: raya, nunca un número', () => {
    const s2 = filaDe(rentabilidadPorTarifa(BASE, FEB), 'S2')
    // El ingreso sí cuenta: la venta existió y entró dinero.
    expect(s2.ingreso).toBe(43_200)
    // Pero no hay nada con qué compararlo honestamente.
    expect(s2.ingresoLista).toBeNull()
    expect(s2.ingresoComparable).toBeNull()
    expect(s2.descuentoYComision).toBeNull()
    expect(s2.descuentoYComisionPct).toBeNull()
  })

  it('la COBERTURA lo cuenta y lo DICE, en vez de esconderlo', () => {
    const r: any = rentabilidadPorTarifa(BASE, FEB)
    expect(r.tarifas.reservasConTarifa).toBe(1)
    expect(r.tarifas.reservasSinTarifa).toBe(1)
    expect(r.tarifas.ingresoSinTarifa).toBe(43_200)
    expect(r.tarifas.ingresoComparable).toBe(72_000)
  })

  it('EL CASO QUE LO DECIDE: un paquete vendido POR ENCIMA de la lista no da un descuento negativo', () => {
    // Conjunto premium: la parte del paquete (80 000) supera la lista (60 000).
    // Sin el guard, `descuentoYComision` sería −20 000 y el reporte afirmaría
    // que se cobró por encima de la tarifa publicada.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [reserva('S2', 'C2', 80_000)],
      tarifasPublicadas: [
        { campanaId: 'C2', porSitio: [{ sitioId: 'S2', lista: 60_000, neto: 80_000, dePaquete: true }] },
      ],
    })
    const s2 = filaDe(rentabilidadPorTarifa(datos, FEB), 'S2')
    expect(s2.descuentoYComision).toBeNull()
    expect(s2.ingresoLista).toBeNull()
  })

  it('una campaña MIXTA no contamina: la pantalla normal sigue comparándose', () => {
    // La marca es POR PANTALLA, no por campaña. Si fuera por campaña, una sola
    // línea de paquete sacaría de la comparación a todas sus hermanas.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [reserva('S1', 'C1', 72_000), reserva('S2', 'C1', 43_200)],
      tarifasPublicadas: [
        {
          campanaId: 'C1',
          porSitio: [
            { sitioId: 'S1', lista: 100_000, neto: 72_000 },
            { sitioId: 'S2', lista: 60_000, neto: 43_200, dePaquete: true },
          ],
        },
      ],
    })
    const r = rentabilidadPorTarifa(datos, FEB)
    expect(filaDe(r, 'S1').ingresoLista).toBe(100_000)
    expect(filaDe(r, 'S2').ingresoLista).toBeNull()
  })
})

describe('2 · la dimensión por VENDEDOR hereda el mismo guard', () => {
  const DATOS = baseDatos({
    sitios: SITIOS,
    reservas: [reserva('S1', 'C1', 72_000), reserva('S2', 'C2', 43_200)],
    tarifasPublicadas: BASE.tarifasPublicadas,
    vendedores: [{ id: 'U1', nombre: 'Ana', cargo: null }],
    vendedorDeCampana: [
      { campanaId: 'C1', usuarioId: 'U1' },
      { campanaId: 'C2', usuarioId: 'U1' },
    ],
  })

  it('al vendedor NO se le atribuye un descuento que el paquete no concedió', () => {
    // Sin esto, a Ana se le cargaría un 28 % de descuento en la venta normal y
    // otro 28 % inventado en la de paquete — y la tabla que mide su mano
    // mediría una decisión del dueño.
    const r: any = rentabilidadPorVendedor(DATOS, FEB)
    const ana = r.filas.find((f: any) => f.clave === 'U1')!
    expect(ana.ingreso).toBe(115_200)
    expect(ana.ingresoLista).toBe(100_000)
    expect(ana.ingresoComparable).toBe(72_000)
    expect(ana.descuentoYComision).toBe(28_000)
  })
})

describe('3 · la marca solo saca lo marcado', () => {
  it('sin la marca, todo se comporta EXACTAMENTE como antes de esta fase', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [reserva('S1', 'C1', 72_000)],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    const s1 = filaDe(rentabilidadPorTarifa(datos, FEB), 'S1')
    expect(s1.ingresoLista).toBe(100_000)
    expect(s1.descuentoYComision).toBe(28_000)
  })

  it('`dePaquete: false` explícito NO saca nada', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [reserva('S1', 'C1', 72_000)],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000, dePaquete: false }] },
      ],
    })
    expect(filaDe(rentabilidadPorTarifa(datos, FEB), 'S1').ingresoLista).toBe(100_000)
  })
})
