import { describe, it, expect } from 'vitest'
import { rentabilidadPorSitio, rentabilidadPorTarifa, DIMENSIONES_REPORTE } from './reportes'

// ============================================================================
//  La SÉPTIMA dimensión: `tarifa`. ¿Cuánto separa la tarifa PUBLICADA de lo
//  que de verdad entra?
// ----------------------------------------------------------------------------
//  La pregunta es literal de un dueño: «¿puedo comparar tarifa publicada contra
//  tarifa neta?». Las dos cifras YA ESTÁN ESCRITAS —congeladas y por pantalla—
//  en `propuestas.snapshot_economico` desde el 08/07 (`porSitio: [{sitioId,
//  lista, neto}]`), y hasta hoy el reporte de rentabilidad no las miraba: leía
//  de `reservas` seis columnas y ninguna era la tarifa de lista.
//
//  ─── Las DOS decisiones de diseño que estas pruebas fijan ────────────────
//
//  1 · NO SE INVENTA UNA TARIFA PUBLICADA QUE NO EXISTE.
//
//     Una campaña creada desde Comercial no tiene `propuesta_id`, así que no
//     tiene snapshot y no hay tarifa de lista congelada que enseñar. Esa fila
//     sale con `null` —una RAYA en pantalla—, nunca con un cero: un cero en la
//     columna «Tarifa publicada» se lee como «se regaló la tarifa entera», que
//     es lo contrario de «no se sabe». Misma regla que `margenPct` y que
//     `costoPorKwh`.
//
//  2 · SOLO SE COMPARA LO QUE ES COMPARABLE, Y SE COMPARA CONTRA SÍ MISMO.
//
//     Hay DOS convenciones de precio conviviendo en `reservas.precio`, y es un
//     defecto conocido que NO se arregla aquí porque toca dinero:
//
//       · reserva nacida en Comercial  → guarda la TARIFA DE LISTA
//         (`campanas-repo.ts:443`, `tarifa_mensual`, sin descuento ni comisión)
//       · reserva nacida de propuesta  → guarda el NETO
//         (`campanas-repo.ts:701`, tras `factorDesc × divisor`)
//
//     Pintar «lista vs neto» sobre una reserva de Comercial compararía una
//     cifra CONTRA SÍ MISMA y daría un descuento del 0 % que nadie concedió.
//     El guard es exacto y medible: una reserva entra en la comparación **solo
//     si su `precio` coincide con el `neto` que el snapshot congeló para esa
//     pantalla**. Si no coincide, no se sabe qué convención lleva → se declara.
//
//     Eso cubre también el caso mixto, que es el que no se ve: una campaña que
//     SÍ nació de una propuesta y a la que luego se le añadieron pantallas desde
//     Comercial, a tarifa de lista.
//
//  Y una consecuencia que vale por las dos: la parte NO comparable se compara
//  contra sí misma NUNCA. El descuento de una fila es siempre
//  `ingresoLista − ingresoComparable` —el neto de ESAS MISMAS reservas—, jamás
//  `ingresoLista − ingreso`, porque el ingreso de la fila puede traer dentro
//  reservas sin tarifa publicada y el resultado saldría hasta negativo.
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
  }
  return { ...vacio, ...over }
}

const FEB = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

const SITIOS = [
  { id: 'S1', predioId: null, caras: 1, nombre: 'Tlalpan', claveInterna: 'TLA' },
  { id: 'S2', predioId: null, caras: 1, nombre: 'Santa Monica', claveInterna: 'SMO' },
  { id: 'S3', predioId: null, caras: 1, nombre: 'Reforma', claveInterna: 'REF' },
]

// ─── El escenario base, con sus cuentas a mano ──────────────────────────────
//
//  Febrero de 2026 completo. Tres pantallas sueltas, sin contrato ni luz ni
//  órdenes de trabajo: aquí lo que se mide es la tarifa, no el costo.
//
//  · S1 · campaña C1, NACIDA DE PROPUESTA. El snapshot congeló para S1
//    lista 100 000 y neto 72 000 (20 % de descuento y 10 % de comisión:
//    100 000 × 0.8 × 0.9 = 72 000). La reserva vale 72 000 → COINCIDE con el
//    neto congelado → ES COMPARABLE.
//      publicada 100 000 · neto 72 000 · descuento+comisión 28 000 · 28.0 %
//
//  · S2 · campaña C2, NACIDA EN COMERCIAL. No tiene propuesta, así que no hay
//    snapshot: su precio de 40 000 YA ES la tarifa de lista. NO se compara.
//      publicada — · descuento — (RAYA, no cero)
//
//  · S3 · campaña C3, nacida de propuesta (snapshot: lista 50 000, neto 45 000)
//    pero la reserva vale 50 000, que NO es el neto congelado: se añadió desde
//    Comercial a tarifa de lista sobre una campaña que sí tenía propuesta. Es
//    el caso mixto, y el guard lo saca de la comparación.
//      publicada — · descuento —
//
//  Ingreso total del periodo = 72 000 + 40 000 + 50 000 = 162 000
//  Comparable = 72 000 · Sin tarifa publicada = 90 000
const BASE = baseDatos({
  sitios: SITIOS,
  reservas: [
    { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    { sitioId: 'S2', campanaId: 'C2', precio: 40_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    { sitioId: 'S3', campanaId: 'C3', precio: 50_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
  ],
  tarifasPublicadas: [
    { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
    { campanaId: 'C3', porSitio: [{ sitioId: 'S3', lista: 50_000, neto: 45_000 }] },
  ],
})

const filaDe = (r: ReturnType<typeof rentabilidadPorTarifa>, clave: string) =>
  r.filas.find((f) => f.clave === clave)!

describe('rentabilidadPorTarifa — publicada contra neta', () => {
  it('la dimensión está DECLARADA en el contrato del endpoint', () => {
    // Sin esto el motor existiría y nadie podría pedirlo: el enum del
    // controller valida contra esta misma lista.
    expect(DIMENSIONES_REPORTE).toContain('tarifa')
  })

  it('compara la tarifa publicada con el neto cuando el snapshot la congeló', () => {
    const r = rentabilidadPorTarifa(BASE, FEB)
    const s1 = filaDe(r, 'S1')
    expect(s1.ingreso).toBe(72_000)
    expect(s1.ingresoLista).toBe(100_000)
    expect(s1.ingresoComparable).toBe(72_000)
    expect(s1.descuentoYComision).toBe(28_000)
    expect(s1.descuentoYComisionPct).toBe(28)
  })

  it('NEGATIVA · sin snapshot no hay tarifa publicada: RAYA, nunca cero', () => {
    // La campaña de Comercial no tiene propuesta. Un 0 en «Tarifa publicada»
    // afirmaría que la tarifa de lista era cero, o —peor— que se regaló entera.
    const r = rentabilidadPorTarifa(BASE, FEB)
    const s2 = filaDe(r, 'S2')
    expect(s2.ingreso).toBe(40_000)
    expect(s2.ingresoLista).toBeNull()
    expect(s2.ingresoComparable).toBeNull()
    expect(s2.descuentoYComision).toBeNull()
    expect(s2.descuentoYComisionPct).toBeNull()
  })

  it('NEGATIVA · las DOS convenciones: si el precio no es el neto congelado, no se compara', () => {
    // S3 tiene snapshot, pero su reserva vale la LISTA (50 000) y no el neto
    // (45 000). Compararla daría «publicada 50 000 · neto 50 000 · descuento
    // 0 %», una cifra contra sí misma. Es el defecto de las dos convenciones, y
    // el guard lo declara en vez de arreglarlo: arreglarlo toca dinero.
    const r = rentabilidadPorTarifa(BASE, FEB)
    const s3 = filaDe(r, 'S3')
    expect(s3.ingreso).toBe(50_000)
    expect(s3.ingresoLista).toBeNull()
    expect(s3.descuentoYComision).toBeNull()
  })

  it('NEGATIVA · una pantalla con snapshot NO arrastra a las otras de la misma campaña', () => {
    // El snapshot es por pantalla. Una campaña con dos pantallas donde solo una
    // está en `porSitio` no puede prestarle su tarifa a la otra.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        { sitioId: 'S2', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    const r = rentabilidadPorTarifa(datos, FEB)
    expect(filaDe(r, 'S1').ingresoLista).toBe(100_000)
    expect(filaDe(r, 'S2').ingresoLista).toBeNull()
  })

  it('NEGATIVA · una pantalla REPETIDA en el snapshot no es comparable', () => {
    // Una propuesta puede traer dos ítems de la MISMA pantalla (dos periodos), y
    // entonces `porSitio` la lleva dos veces con dos tarifas de lista distintas.
    // Cuál corresponde a cuál reserva no lo dice el dato, así que se declara:
    // elegir una inventaría el descuento de la otra.
    //
    // EL CASO ESTÁ ESCRITO PARA QUE SOLO LO SALVE EL CENTINELA DE AMBIGÜEDAD, y
    // esa precisión hizo falta: con dos `neto` distintos, el guard del precio ya
    // rechazaba la fila por su cuenta y quitar el centinela no cambiaba nada —
    // un mutante vivo. Aquí las DOS reservas valen 27 000 porque eso es lo que
    // `campanas-repo` escribe de verdad: su `netoDeSnap` es un Map por pantalla,
    // así que con la pantalla repetida GANA LA ÚLTIMA y las dos reservas se
    // guardan con el neto del segundo ítem.
    //
    // Sin el centinela, las dos casarían con esa última entrada y la tarifa
    // publicada saldría 60 000 (2 × 30 000) cuando la verdad es 90 000: un
    // descuento inventado, sin ningún error.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 27_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-14' },
        { sitioId: 'S1', campanaId: 'C1', precio: 27_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-15', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        {
          campanaId: 'C1',
          porSitio: [
            { sitioId: 'S1', lista: 60_000, neto: 27_000 },
            { sitioId: 'S1', lista: 30_000, neto: 27_000 },
          ],
        },
      ],
    })
    const r = rentabilidadPorTarifa(datos, FEB)
    const s1 = filaDe(r, 'S1')
    expect(s1.ingreso).toBe(54_000)
    expect(s1.ingresoLista).toBeNull()
    expect(s1.descuentoYComision).toBeNull()
    // Y las dos reservas cuentan como SIN tarifa, no como una.
    expect(r.tarifas!.reservasConTarifa).toBe(0)
    expect(r.tarifas!.reservasSinTarifa).toBe(2)
    expect(r.tarifas!.ingresoSinTarifa).toBe(54_000)
  })

  it('NEGATIVA · una reserva sin campaña no puede tener tarifa publicada', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: null, precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    expect(filaDe(rentabilidadPorTarifa(datos, FEB), 'S1').ingresoLista).toBeNull()
  })

  it('NEGATIVA · una reserva CANCELADA no aporta ni ingreso ni tarifa publicada', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CANCELADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    const r = rentabilidadPorTarifa(datos, FEB)
    expect(r.filas).toHaveLength(0)
    expect(r.tarifas!.reservasConTarifa).toBe(0)
    expect(r.tarifas!.ingresoLista).toBe(0)
  })

  it('la tarifa publicada se PRORRATEA por días, igual que el ingreso', () => {
    // Reserva del 15/01 al 14/02 = 31 días (17 en enero, 14 en febrero).
    //   neto  31 000 → enero 31 000 × 17/31 = 17 000 · febrero 14 000
    //   lista 62 000 → enero 62 000 × 17/31 = 34 000 · febrero 28 000
    // Si la lista NO se prorrateara, entraría entera en cada bucket y el
    // descuento de un reporte de dos meses saldría del doble.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 31_000, estatus: 'CONFIRMADA', fechaInicio: '2026-01-15', fechaFin: '2026-02-14' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 62_000, neto: 31_000 }] },
      ],
    })
    const enero = rentabilidadPorTarifa(datos, { desde: '2026-01-01', hasta: '2026-01-31', granularidad: 'mes' })
    const febrero = rentabilidadPorTarifa(datos, { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' })
    expect(filaDe(enero, 'S1').ingresoLista).toBe(34_000)
    expect(filaDe(enero, 'S1').ingresoComparable).toBe(17_000)
    expect(filaDe(febrero, 'S1').ingresoLista).toBe(28_000)
    expect(filaDe(febrero, 'S1').ingresoComparable).toBe(14_000)

    // Y los dos meses juntos suman EXACTAMENTE la reserva entera: ni se pierde
    // ni se inventa tarifa al partir el rango.
    const ambos = rentabilidadPorTarifa(datos, { desde: '2026-01-01', hasta: '2026-02-28', granularidad: 'mes' })
    expect(filaDe(ambos, 'S1').ingresoLista).toBe(62_000)
    expect(filaDe(ambos, 'S1').ingresoComparable).toBe(31_000)
    expect(filaDe(ambos, 'S1').descuentoYComision).toBe(31_000)
  })

  it('NEGATIVA · con cobertura PARCIAL el descuento se calcula contra el neto comparable, no contra el ingreso', () => {
    // La MISMA pantalla, dos reservas en febrero: una de propuesta (comparable)
    // y otra de Comercial (no). Si el descuento se calculara como
    // `ingresoLista − ingreso` daría 100 000 − 102 000 = −2 000: un descuento
    // NEGATIVO, que se leería como que se cobró por encima de la tarifa.
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        { sitioId: 'S1', campanaId: 'C2', precio: 30_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    const s1 = filaDe(rentabilidadPorTarifa(datos, FEB), 'S1')
    expect(s1.ingreso).toBe(102_000)
    expect(s1.ingresoComparable).toBe(72_000)
    expect(s1.ingresoLista).toBe(100_000)
    expect(s1.descuentoYComision).toBe(28_000)
    expect(s1.descuentoYComisionPct).toBe(28)
  })

  it('ordena por el dinero que separa la publicada del neto, y las filas sin tarifa van al final', () => {
    const r = rentabilidadPorTarifa(BASE, FEB)
    // Solo S1 tiene comparación; S2 y S3 no compiten en el ranking.
    expect(r.filas.map((f) => f.clave)[0]).toBe('S1')
    expect(r.filas.slice(1).every((f) => f.descuentoYComision == null)).toBe(true)
  })

  it('DECLARA lo que no se pudo comparar, con su importe', () => {
    const r = rentabilidadPorTarifa(BASE, FEB)
    expect(r.tarifas).toBeDefined()
    expect(r.tarifas!.reservasConTarifa).toBe(1)
    expect(r.tarifas!.reservasSinTarifa).toBe(2)
    expect(r.tarifas!.ingresoLista).toBe(100_000)
    expect(r.tarifas!.ingresoComparable).toBe(72_000)
    // 162 000 del periodo − 72 000 comparables
    expect(r.tarifas!.ingresoSinTarifa).toBe(90_000)
  })

  it('la nota dice que la brecha es descuento MÁS comisión, y cuánto quedó sin comparar', () => {
    const nota = rentabilidadPorTarifa(BASE, FEB).tarifas!.nota
    // La brecha NO es solo el descuento: `neto = lista × (1−desc) × (1−comisión)`
    // y el snapshot no las separa por pantalla. Llamarla «descuento» a secas
    // haría leer la comisión de la agencia como una rebaja concedida.
    expect(nota).toMatch(/descuento comercial/i)
    expect(nota).toMatch(/comisi[oó]n de agencia/i)
    // Y el hueco, con su dinero y su motivo.
    expect(nota).toMatch(/2 de las 3 reservas/i)
    expect(nota).toContain('$90,000')
    expect(nota).toMatch(/Comercial/)
  })

  it('cuando TODO es comparable la nota no inventa un hueco', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
      tarifasPublicadas: [
        { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
      ],
    })
    const c = rentabilidadPorTarifa(datos, FEB).tarifas!
    expect(c.reservasSinTarifa).toBe(0)
    expect(c.ingresoSinTarifa).toBe(0)
    expect(c.nota).not.toMatch(/reservas del periodo no tienen/i)
  })

  it('los TOTALES son los del negocio completo: cambiar de dimensión no cambia las cifras de arriba', () => {
    // Misma propiedad que ya protege `entidad`: los cuatro indicadores grandes
    // son el mismo periodo y el mismo dinero, se agrupe como se agrupe.
    const porTarifa = rentabilidadPorTarifa(BASE, FEB)
    const porSitio = rentabilidadPorSitio(BASE, FEB)
    expect(porTarifa.totales).toEqual(porSitio.totales)
    expect(porTarifa.totales.ingreso).toBe(162_000)
  })

  it('NEGATIVA · el motor de `sitio` NO gana columnas de tarifa', () => {
    // La comparación es una dimensión propia. Si `sitio` las trajera, su tabla
    // pasaría de ocho columnas a once y ninguna prueba lo vería.
    const s1 = rentabilidadPorSitio(BASE, FEB).filas.find((f) => f.clave === 'S1')!
    expect(s1.ingresoLista).toBeUndefined()
    expect(s1.descuentoYComision).toBeUndefined()
  })

  it('sin ninguna tarifa publicada el reporte sigue saliendo, con todas las filas en raya', () => {
    const datos = baseDatos({
      sitios: SITIOS,
      reservas: [
        { sitioId: 'S2', campanaId: 'C2', precio: 40_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
      ],
    })
    const r = rentabilidadPorTarifa(datos, FEB)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].ingresoLista).toBeNull()
    expect(r.tarifas!.ingresoSinTarifa).toBe(40_000)
  })
})
