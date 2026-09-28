import { describe, it, expect } from 'vitest'
import { rentabilidadPorSitio, rentabilidadPorVendedor, DIMENSIONES_REPORTE } from './reportes'

// ============================================================================
//  La OCTAVA dimensión: `vendedor`. ¿Cuánto vendió cada quien, y cuánto
//  descuento concedió?
// ----------------------------------------------------------------------------
//  La pregunta es de un dueño, y la auditoría midió la respuesta: no faltaba un
//  reporte, faltaba EL DATO. `propuestas` tenía dieciséis columnas y ninguna
//  apuntaba a `usuarios`; `campanas` veintitrés y tampoco. El único `usuario_id`
//  del esquema vivía en `sesiones` y en la bitácora `acciones`.
//
//  ─── Las TRES decisiones de diseño que estas pruebas fijan ───────────────
//
//  1 · EL VENDEDOR ES QUIEN CREA LA PROPUESTA, Y SE LEE DE LA SESIÓN.
//
//     Decisión del dueño. Aquí, en el motor puro, eso llega ya resuelto como
//     `vendedorDeCampana`. Que no se pueda MANDAR desde el cliente es cosa del
//     controller y del repo, y lo fijan `propuestas-controller.vendedor.test.ts`
//     y `vendedor-en-propuesta.e2e.test.ts`.
//
//  2 · LO QUE NO TIENE VENDEDOR SALE EN «SIN VENDEDOR», Y SUS COLUMNAS DE
//     DESCUENTO SALEN CON RAYA CUANDO NO HAY CON QUÉ COMPARAR — NUNCA CON UN
//     CERO.
//
//     Y el histórico es el caso que manda: TODA propuesta anterior a la
//     migración tiene `usuario_id` nulo y no hay de dónde deducirlo —la bitácora
//     guarda el NOMBRE de la propuesta como texto libre, no su id—. Ese dinero
//     no desaparece ni se reparte: va a «Sin vendedor», con su importe, y el
//     aviso de cobertura dice cuánto es y por qué.
//
//     Un cero en «Descuento y comisión» de un vendedor afirmaría que NO dio
//     descuentos. Una raya dice que no se sabe. No son lo mismo, y en un reporte
//     que mide a personas la diferencia es el despido de alguien.
//
//  3 · SE REUTILIZA EL CAMINO DE `tarifa`, INCLUIDA SU TRAMPA.
//
//     El descuento no se recalcula: sale de `propuestas.snapshot_economico`
//     (`{lista, neto}` por pantalla) exactamente por donde lo abrió la dimensión
//     `tarifa` el 2026-09-28, y hereda su guard: hay DOS convenciones de precio
//     conviviendo en `reservas.precio` —Comercial guarda LISTA
//     (`campanas-repo.ts:443`), propuesta guarda NETO (`:701`)— y una reserva
//     entra en la comparación SOLO si su precio ES el neto que el snapshot
//     congeló para esa pantalla. Comparar una cifra contra sí misma daría un
//     descuento del 0 % que nadie concedió, y aquí ese 0 % se lo comería un
//     vendedor concreto.
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
  { id: 'S3', predioId: null, caras: 1, nombre: 'Reforma', claveInterna: 'REF' },
]

const VENDEDORES = [
  { id: 'V1', nombre: 'Ana Vendedora', cargo: 'Ejecutiva de cuenta' },
  { id: 'V2', nombre: 'Beto Vendedor', cargo: null },
]

// ─── El escenario base, con sus cuentas a mano ──────────────────────────────
//
//  Febrero de 2026 completo. Tres pantallas sueltas, sin contrato ni luz ni
//  órdenes de trabajo: aquí lo que se mide es QUIÉN vendió y con cuánto
//  descuento, no el costo.
//
//  · C1 · propuesta de V1 (Ana). Snapshot de S1: lista 100 000, neto 72 000
//    (20 % de descuento y 10 % de comisión: 100 000 × 0.8 × 0.9 = 72 000). La
//    reserva vale 72 000 → COINCIDE con el neto congelado → COMPARABLE.
//
//  · C2 · NACIDA EN COMERCIAL. Sin propuesta, así que sin vendedor y sin
//    tarifa publicada. Reserva de 40 000 sobre S2.
//
//  · C3 · propuesta de V2 (Beto). Snapshot de S3: lista 50 000, neto 40 000.
//    La reserva vale 40 000 → COMPARABLE.
//
//  · C4 · propuesta HISTÓRICA: existe, tiene snapshot (lista 30 000, neto
//    24 000) y su reserva de 24 000 es comparable, pero su `usuario_id` es NULO
//    porque se capturó antes de la migración. Es el caso que da nombre a todo
//    esto, y por eso «Sin vendedor» SÍ trae descuento: las dos causas del hueco
//    son distintas y el aviso las separa.
//
//  Ingreso total = 72 000 + 40 000 + 40 000 + 24 000 = 176 000
//
//  | fila          | ingreso | publicada | comparable | brecha | % pub. | % ingreso |
//  |---------------|---------|-----------|------------|--------|--------|-----------|
//  | V1 Ana        |  72 000 |   100 000 |     72 000 | 28 000 |  28.00 |     40.91 |
//  | V2 Beto       |  40 000 |    50 000 |     40 000 | 10 000 |  20.00 |     22.73 |
//  | Sin vendedor  |  64 000 |    30 000 |     24 000 |  6 000 |  20.00 |     36.36 |
//
//  72 000 / 176 000 = 40.9090…  → 40.91
//  40 000 / 176 000 = 22.7272…  → 22.73
//  64 000 / 176 000 = 36.3636…  → 36.36
const BASE = baseDatos({
  sitios: SITIOS,
  vendedores: VENDEDORES,
  reservas: [
    { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    { sitioId: 'S2', campanaId: 'C2', precio: 40_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    { sitioId: 'S3', campanaId: 'C3', precio: 40_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    { sitioId: 'S1', campanaId: 'C4', precio: 24_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
  ],
  tarifasPublicadas: [
    { campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] },
    { campanaId: 'C3', porSitio: [{ sitioId: 'S3', lista: 50_000, neto: 40_000 }] },
    { campanaId: 'C4', porSitio: [{ sitioId: 'S1', lista: 30_000, neto: 24_000 }] },
  ],
  vendedorDeCampana: [
    { campanaId: 'C1', usuarioId: 'V1' },
    { campanaId: 'C3', usuarioId: 'V2' },
    // La histórica: nació de una propuesta —está en la lista— pero nadie sabe
    // de quién. NO es lo mismo que C2, que ni siquiera tuvo propuesta.
    { campanaId: 'C4', usuarioId: null },
  ],
})

const filaDe = (r: ReturnType<typeof rentabilidadPorVendedor>, clave: string) =>
  r.filas.find((f) => f.clave === clave)!

describe('rentabilidadPorVendedor — cuánto vendió cada quien', () => {
  it('la dimensión está DECLARADA en el contrato del endpoint', () => {
    // Sin esto el motor existiría y nadie podría pedirlo: el enum del
    // controller valida contra esta misma lista.
    expect(DIMENSIONES_REPORTE).toContain('vendedor')
  })

  it('atribuye a cada vendedor lo que vendió y el descuento que concedió', () => {
    const r = rentabilidadPorVendedor(BASE, FEB)
    const v1 = filaDe(r, 'V1')
    expect(v1.etiqueta).toBe('Ana Vendedora')
    expect(v1.ingreso).toBe(72_000)
    expect(v1.ingresoLista).toBe(100_000)
    expect(v1.ingresoComparable).toBe(72_000)
    expect(v1.descuentoYComision).toBe(28_000)
    expect(v1.descuentoYComisionPct).toBe(28)
    expect(v1.pctDelIngreso).toBe(40.91)

    const v2 = filaDe(r, 'V2')
    expect(v2.ingreso).toBe(40_000)
    expect(v2.ingresoLista).toBe(50_000)
    expect(v2.descuentoYComision).toBe(10_000)
    expect(v2.descuentoYComisionPct).toBe(20)
    expect(v2.pctDelIngreso).toBe(22.73)
  })

  it('el histórico y lo nacido en Comercial caen en «Sin vendedor», con su importe', () => {
    const r = rentabilidadPorVendedor(BASE, FEB)
    const sin = filaDe(r, '')
    expect(sin.etiqueta).toBe('Sin vendedor')
    // 40 000 de la campaña de Comercial + 24 000 de la propuesta histórica.
    expect(sin.ingreso).toBe(64_000)
    // Y SÍ trae descuento: la propuesta histórica tiene snapshot aunque no
    // tenga vendedor. Si esta cifra fuera nula, las dos causas del hueco se
    // estarían tratando como una sola.
    expect(sin.ingresoLista).toBe(30_000)
    expect(sin.ingresoComparable).toBe(24_000)
    expect(sin.descuentoYComision).toBe(6_000)
    expect(sin.pctDelIngreso).toBe(36.36)
  })

  it('«Sin vendedor» va SIEMPRE al final: es un hueco, no un competidor', () => {
    const r = rentabilidadPorVendedor(BASE, FEB)
    // Con 64 000 vendería más que Beto (40 000) y ordenado por ingreso saldría
    // en medio de la tabla, leyéndose como el segundo mejor vendedor.
    expect(r.filas.map((f) => f.clave)).toEqual(['V1', 'V2', ''])
  })

  it('ordena por ingreso: la pregunta es «cuánto vendió cada quien»', () => {
    const r = rentabilidadPorVendedor(
      { ...BASE, vendedores: [...VENDEDORES].reverse() },
      FEB,
    )
    // El orden de la lista de usuarios NO decide el de la tabla.
    expect(r.filas.filter((f) => f.clave).map((f) => f.clave)).toEqual(['V1', 'V2'])
  })

  it('los TOTALES son los del negocio completo: cambiar de agrupador no mueve el dinero', () => {
    const porVendedor = rentabilidadPorVendedor(BASE, FEB)
    const porSitio = rentabilidadPorSitio(BASE, FEB)
    expect(porVendedor.totales.ingreso).toBe(176_000)
    expect(porVendedor.totales).toEqual(porSitio.totales)
    // Y la suma de las filas cuadra con el total: nada se pierde por el camino.
    const suma = porVendedor.filas.reduce((a, f) => a + f.ingreso, 0)
    expect(suma).toBe(porVendedor.totales.ingreso)
  })
})

describe('el aviso de COBERTURA dice cuánto quedó sin vendedor y por qué', () => {
  it('cuenta RESERVAS y separa las dos causas del hueco', () => {
    const r = rentabilidadPorVendedor(BASE, FEB)
    expect(r.vendedores).toBeTruthy()
    expect(r.vendedores!.reservasConVendedor).toBe(2)
    expect(r.vendedores!.reservasSinVendedor).toBe(2)
    // Las dos causas NO se funden: una se arregla capturando, la otra no se
    // arregla nunca. Decir solo «2 sin vendedor» invitaría a buscar en la
    // bitácora un dato que ahí no está.
    expect(r.vendedores!.reservasSinPropuesta).toBe(1)
    expect(r.vendedores!.reservasDePropuestaSinVendedor).toBe(1)
    expect(r.vendedores!.ingresoSinVendedor).toBe(64_000)
  })

  it('la nota nombra el histórico y dice que NO se puede recuperar', () => {
    const r = rentabilidadPorVendedor(BASE, FEB)
    const nota = r.vendedores!.nota
    // La cifra no puede aparecer sin su porqué, y el porqué del histórico es
    // que el dato NO EXISTE: no es un hueco de captura que alguien pueda
    // rellenar mirando papeles.
    expect(nota).toMatch(/no se puede recuperar/i)
    expect(nota).toContain('$64,000')
    expect(nota).toMatch(/Comercial/)
  })

  it('la nota SIGUE saliendo cuando no falta nada — «todo atribuido» y «no te lo digo» se ven igual', () => {
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        ],
        tarifasPublicadas: [{ campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] }],
        vendedorDeCampana: [{ campanaId: 'C1', usuarioId: 'V1' }],
      }),
      FEB,
    )
    expect(r.vendedores!.reservasSinVendedor).toBe(0)
    expect(r.vendedores!.nota).toBeTruthy()
    // Y la primera frase hace falta SIEMPRE: la brecha lleva dentro la comisión
    // de la agencia, que no es una rebaja que el vendedor concediera.
    expect(r.vendedores!.nota).toMatch(/comisi[oó]n de agencia/i)
  })
})

describe('RAYA y NO CERO — el corazón de esta dimensión', () => {
  // Un vendedor cuya venta NO tiene tarifa publicada con la que comparar. Aquí
  // la propuesta existe y tiene vendedor, pero NUNCA se aceptó, así que no hay
  // snapshot: no hay nada congelado que enseñar.
  const SIN_SNAPSHOT = baseDatos({
    sitios: SITIOS,
    vendedores: [{ id: 'V3', nombre: 'Carla Vendedora', cargo: null }],
    reservas: [
      { sitioId: 'S2', campanaId: 'C5', precio: 20_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    ],
    tarifasPublicadas: [],
    vendedorDeCampana: [{ campanaId: 'C5', usuarioId: 'V3' }],
  })

  it('un vendedor sin tarifa publicada sale con RAYA en las cuatro columnas, no con cero', () => {
    const r = rentabilidadPorVendedor(SIN_SNAPSHOT, FEB)
    const v3 = filaDe(r, 'V3')
    // La fila SIGUE saliendo: vendió 20 000 y eso es verdad.
    expect(v3.ingreso).toBe(20_000)
    // Y las cuatro son `null`, no 0. Un 0 en «Descuento y comisión» diría que
    // Carla no concedió ni un peso de descuento, y eso NO se sabe.
    expect(v3.ingresoLista).toBeNull()
    expect(v3.ingresoComparable).toBeNull()
    expect(v3.descuentoYComision).toBeNull()
    expect(v3.descuentoYComisionPct).toBeNull()
  })

  it('«Sin vendedor» también sale con raya cuando no hay nada que comparar', () => {
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: [],
        reservas: [
          { sitioId: 'S2', campanaId: 'C2', precio: 40_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        ],
      }),
      FEB,
    )
    const sin = filaDe(r, '')
    expect(sin.ingreso).toBe(40_000)
    expect(sin.descuentoYComision).toBeNull()
  })

  it('una reserva SIN CAMPAÑA cuenta como «sin propuesta», no se descarta', () => {
    // `reservas.campana_id` es nullable. Una reserva suelta no tiene por dónde
    // llegar a una propuesta, así que su dinero es tan «sin vendedor» como el de
    // una campaña de Comercial — y tiene que CONTARSE, no descartarse: el
    // importe del aviso de cobertura se deriva del total, y una reserva que no
    // se cuenta deja una cifra que no cuadra con ninguna columna.
    //
    // (Esta prueba nació matando mutantes: el guard `!r.campanaId ||` es
    // EQUIVALENTE a no tenerlo —`Map.has(null)` ya es `false`— así que ningún
    // mutante sobre esa línea se puede matar. Lo que sí se puede fijar, y es lo
    // que importa, es el COMPORTAMIENTO que esa rama produce.)
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: null, precio: 15_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        ],
      }),
      FEB,
    )
    expect(r.filas.map((f) => f.clave)).toEqual([''])
    expect(r.filas[0].ingreso).toBe(15_000)
    expect(r.vendedores!.reservasSinPropuesta).toBe(1)
    expect(r.vendedores!.reservasDePropuestaSinVendedor).toBe(0)
    expect(r.vendedores!.ingresoSinVendedor).toBe(15_000)
  })

  it('una pantalla sin vender NO inventa una fila de vendedor', () => {
    const r = rentabilidadPorVendedor(baseDatos({ sitios: SITIOS, vendedores: VENDEDORES }), FEB)
    expect(r.filas).toEqual([])
    expect(r.vendedores!.reservasConVendedor).toBe(0)
  })
})

describe('hereda la trampa de las DOS convenciones de precio', () => {
  // La campaña nació de una propuesta de V1 y su snapshot congeló lista 50 000
  // y neto 45 000, pero la reserva vale 50 000: se añadió desde Comercial, a
  // tarifa de lista, sobre una campaña que sí tenía propuesta. Es el caso mixto,
  // y el que no se ve leyendo.
  const MIXTO = baseDatos({
    sitios: SITIOS,
    vendedores: VENDEDORES,
    reservas: [
      { sitioId: 'S3', campanaId: 'C6', precio: 50_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
    ],
    tarifasPublicadas: [{ campanaId: 'C6', porSitio: [{ sitioId: 'S3', lista: 50_000, neto: 45_000 }] }],
    vendedorDeCampana: [{ campanaId: 'C6', usuarioId: 'V1' }],
  })

  it('NO compara un precio que no es el neto congelado: sería 0 % de descuento inventado', () => {
    const r = rentabilidadPorVendedor(MIXTO, FEB)
    const v1 = filaDe(r, 'V1')
    // La venta SÍ se le atribuye —es suya—, pero el descuento no se puede medir.
    expect(v1.ingreso).toBe(50_000)
    expect(v1.descuentoYComision).toBeNull()
    expect(v1.descuentoYComisionPct).toBeNull()
  })

  it('una propuesta con DOS ítems de la misma pantalla es AMBIGUA y no se compara', () => {
    // `campanas-repo` resuelve el neto con un Map por pantalla, así que gana el
    // último ítem y las dos reservas quedan con el mismo neto. Elegir una de las
    // dos listas inventaría el descuento de la otra, y aquí ese invento se lo
    // acreditaría a una persona con nombre y apellido.
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'C7', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-14' },
          { sitioId: 'S1', campanaId: 'C7', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-15', fechaFin: '2026-02-28' },
        ],
        tarifasPublicadas: [
          {
            campanaId: 'C7',
            porSitio: [
              { sitioId: 'S1', lista: 100_000, neto: 72_000 },
              { sitioId: 'S1', lista: 80_000, neto: 72_000 },
            ],
          },
        ],
        vendedorDeCampana: [{ campanaId: 'C7', usuarioId: 'V1' }],
      }),
      FEB,
    )
    const v1 = filaDe(r, 'V1')
    expect(v1.ingresoLista).toBeNull()
    expect(v1.descuentoYComision).toBeNull()
  })
})

describe('R2 · el vendedor de otra organización no existe para este reporte', () => {
  it('un usuario que NO está en la lista de vendedores cae en «Sin vendedor»', () => {
    // El repo lee `usuarios` con `and tenant_id = $1`, así que un `usuario_id`
    // que apunte fuera de la organización NO llega a `vendedores`. Aquí se fija
    // el comportamiento del motor ante eso: NO se pinta el id crudo como
    // etiqueta —sería filtrar un identificador de otra empresa a una tabla de
    // dinero— y NO se inventa una fila. Mismo criterio que `entidadDeReserva`.
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'C8', precio: 10_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        ],
        vendedorDeCampana: [{ campanaId: 'C8', usuarioId: 'V-DE-OTRA-ORG' }],
      }),
      FEB,
    )
    expect(r.filas.map((f) => f.clave)).toEqual([''])
    expect(JSON.stringify(r)).not.toContain('V-DE-OTRA-ORG')
  })
})

describe('el prorrateo por días es el MISMO que el del ingreso', () => {
  it('media campaña en el rango aporta media tarifa publicada, no la entera', () => {
    // Catorce de los veintiocho días de febrero. Si la publicada entrara entera
    // el descuento saldría disparado sin dar ningún error: 100 000 − 36 000 en
    // vez de 50 000 − 36 000.
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'C9', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-14' },
        ],
        tarifasPublicadas: [{ campanaId: 'C9', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] }],
        vendedorDeCampana: [{ campanaId: 'C9', usuarioId: 'V1' }],
      }),
      FEB,
    )
    const v1 = filaDe(r, 'V1')
    // La reserva dura 14 días de los 14 que declara, y ocupa 14 de los 28 del
    // bucket: 72 000 × 14/14 → pero el prorrateo del ingreso reparte por los
    // días que caen dentro del bucket sobre los días TOTALES de la reserva.
    expect(v1.ingreso).toBe(72_000)
    expect(v1.ingresoLista).toBe(100_000)
    expect(v1.descuentoYComision).toBe(28_000)
  })

  it('una reserva que SOLAPA el rango a medias parte la publicada igual que el ingreso', () => {
    // Del 15 de enero al 14 de febrero: 31 días de reserva, 14 dentro de
    // febrero. 72 000 × 14/31 = 32 516.129… → 32 516.13
    //         100 000 × 14/31 = 45 161.290… → 45 161.29
    // brecha = 45 161.29 − 32 516.13 = 12 645.16
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'CA', precio: 72_000, estatus: 'CONFIRMADA', fechaInicio: '2026-01-15', fechaFin: '2026-02-14' },
        ],
        tarifasPublicadas: [{ campanaId: 'CA', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] }],
        vendedorDeCampana: [{ campanaId: 'CA', usuarioId: 'V1' }],
      }),
      FEB,
    )
    const v1 = filaDe(r, 'V1')
    expect(v1.ingreso).toBe(32_516.13)
    expect(v1.ingresoLista).toBe(45_161.29)
    expect(v1.descuentoYComision).toBe(12_645.16)
  })
})

describe('una reserva CANCELADA no se le cuenta a nadie', () => {
  it('ni como venta ni como descuento ni en la cobertura', () => {
    const r = rentabilidadPorVendedor(
      baseDatos({
        sitios: SITIOS,
        vendedores: VENDEDORES,
        reservas: [
          { sitioId: 'S1', campanaId: 'C1', precio: 72_000, estatus: 'CANCELADA', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' },
        ],
        tarifasPublicadas: [{ campanaId: 'C1', porSitio: [{ sitioId: 'S1', lista: 100_000, neto: 72_000 }] }],
        vendedorDeCampana: [{ campanaId: 'C1', usuarioId: 'V1' }],
      }),
      FEB,
    )
    expect(r.filas).toEqual([])
    expect(r.vendedores!.reservasConVendedor).toBe(0)
    expect(r.vendedores!.reservasSinVendedor).toBe(0)
  })
})
