import { describe, it, expect } from 'vitest'
import { rentabilidadPorSitio, rentabilidadPorEntidad, DIMENSIONES_REPORTE } from './reportes'

// ============================================================================
//  La SEXTA dimensión: `entidad`. ¿Cuánto factura y cuánta renta paga cada
//  razón social?
// ----------------------------------------------------------------------------
//  No la pidió el jefe — pidió cinco y son cinco. Sale de la frase del ADR
//  0034, que es el porqué del módulo entero: **el dueño no quiere separar sus
//  razones sociales, quiere verlas juntas.** La pregunta siguiente de esa frase
//  es «¿y cuánto deja cada una?», y hasta hoy el dato estaba capturado y no
//  había dónde mirarlo.
//
//  ─── La decisión de diseño, y es la que estas pruebas fijan ──────────────
//
//  Se atribuye SOLO LO QUE EL DATO DICE, y lo que no se puede atribuir se
//  DECLARA. Dos de los cinco papeles mueven dinero hoy:
//
//    · `ARRENDAMIENTOS` → `contratos_arrendamiento.entidad_id` dice quién paga
//      esa renta. Es un dato, no una derivación.
//    · `VENTAS` → `facturas.entidad_emisora_id` dice quién emitió el
//      comprobante de esa campaña, y una reserva pertenece a una campaña.
//
//  Y tres NO tienen dónde:
//
//    · la OPERACIÓN no se atribuye: ninguna columna de `ordenes_trabajo` dice a
//      nombre de quién se paga una visita;
//    · la LUZ tampoco: `consumos_energia` se ancla a predio o a pantalla, nunca
//      a una razón social;
//    · y los activos y las licencias no existen como módulo.
//
//  **Por eso esta dimensión NO PINTA MARGEN.** Un «margen» que fuera
//  `ingreso − renta` saldría MEJOR QUE EL REAL, porque le faltarían dos de las
//  cuatro fuentes de costo — y un número que miente es peor que no tenerlo. Es
//  la misma regla que ya obliga a declarar los recibos que faltan
//  (`CoberturaEnergia`) y las pantallas sin medidas (`ExclusionesM2`).
//
//  Lo que sí pinta es el SALDO ATRIBUIDO, con ese nombre para que no se pueda
//  confundir con un margen.
//
//  ─── La propiedad que de verdad protege esto ─────────────────────────────
//
//  El ingreso de esta dimensión tiene que SUMAR EXACTAMENTE el de `sitio`. Si
//  no, habría dos reportes dando dos facturaciones distintas del mismo periodo,
//  que es el error de raíz que este repositorio documenta
//  (`lib/server/tenant.ts:87-89`) y el que más caro sale: nada falla.
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
  }
  return { ...vacio, ...over }
}

const ENTIDADES = [
  { id: 'E1', razonSocial: 'Publicidad Uno, S.A. de C.V.', papeles: ['Vende publicidad'] },
  { id: 'E2', razonSocial: 'Inmuebles Dos, S.A. de C.V.', papeles: ['Paga las rentas a los arrendadores', 'Compra los activos y el equipo'] },
]

// ─── El escenario base, con sus cuentas a mano ──────────────────────────────
//
//  Predio P1 con DOS pantallas de una cara → la renta se parte por mitades.
//  Contrato del predio: 10 000 al mes, y lo paga E2.
//    espacio S1 = 5 000 · espacio S2 = 5 000 → total 10 000, todo de E2.
//
//  Febrero de 2026, dos reservas del mes completo:
//    · R1 en S1, 30 000, campaña C1 → su comprobante lo emite E1
//    · R2 en S2, 20 000, campaña C2 → su comprobante NO tiene emisora
//    ingreso total = 50 000, de los cuales E1 se lleva 30 000 y 20 000 se
//    quedan SIN ASIGNAR. No se pierden: se enseñan en su fila.
//
//  Una OT de inspección en S1 y un recibo de luz del predio: los dos son costo
//  real del periodo y NINGUNO se puede repartir entre sociedades.
const BASE = baseDatos({
  sitios: [
    { id: 'S1', predioId: 'P1', caras: 1, nombre: 'Tlalpan', claveInterna: 'TLA' },
    { id: 'S2', predioId: 'P1', caras: 1, nombre: 'Santa Monica', claveInterna: 'SMO' },
  ],
  contratos: [
    {
      id: 'C-P1',
      sitioId: null,
      predioId: 'P1',
      arrendadorId: 'A1',
      montoRenta: 10000,
      periodicidad: 'MENSUAL',
      estatus: 'VIGENTE',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      entidadId: 'E2',
    },
  ],
  arrendadores: [{ id: 'A1', nombre: 'Arrendador Uno' }],
  reservas: [
    {
      sitioId: 'S1',
      campanaId: 'C1',
      precio: 30000,
      estatus: 'CONFIRMADA',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-02-28',
    },
    {
      sitioId: 'S2',
      campanaId: 'C2',
      precio: 20000,
      estatus: 'CONFIRMADA',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-02-28',
    },
  ],
  ordenesTrabajo: [
    { sitioId: 'S1', tipo: 'INSPECCION', estatus: 'COMPLETADA', fechaCompletada: '2026-02-10' },
  ],
  consumosEnergia: [
    { predioId: 'P1', sitioId: null, periodo: '2026-02-01', kwh: 1000, importe: 2000 },
  ],
  entidades: ENTIDADES,
  facturas: [
    { campanaId: 'C1', entidadEmisoraId: 'E1' },
    { campanaId: 'C2', entidadEmisoraId: null },
  ],
})

const FEBRERO = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

describe('la dimension entidad esta DECLARADA en el contrato del endpoint', () => {
  it('`entidad` es una de las dimensiones del reporte', () => {
    expect([...DIMENSIONES_REPORTE]).toContain('entidad')
  })
})

describe('atribuye solo lo que el dato dice', () => {
  it('el ingreso va a la razon social que EMITIO el comprobante de esa campania', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    const e1 = r.filas.find((f) => f.clave === 'E1')
    expect(e1?.etiqueta).toBe('Publicidad Uno, S.A. de C.V.')
    expect(e1?.ingreso).toBe(30000)
    // No paga rentas: no se le atribuye nada de espacio.
    expect(e1?.costoEspacio).toBe(0)
  })

  it('la renta va a la razon social del CONTRATO, y suma las dos pantallas del predio', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    const e2 = r.filas.find((f) => f.clave === 'E2')
    // 10 000 del predio = 5 000 de S1 + 5 000 de S2. La fraccion de caras es la
    // MISMA que usa `sitio`: no se reinventa el reparto.
    expect(e2?.costoEspacio).toBe(10000)
    expect(e2?.ingreso).toBe(0)
  })

  it('lo que no tiene emisora NO desaparece: sale en su propia fila', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    const sin = r.filas.find((f) => f.clave === '')
    expect(sin?.etiqueta).toBe('Sin asignar')
    expect(sin?.ingreso).toBe(20000)
  })

  it('«Sin asignar» va SIEMPRE al final, aunque facture mas que una sociedad', () => {
    // No es un competidor del ranking: es un hueco de captura. Ordenarlo por
    // importe lo pondria primero y se leeria como la sociedad que mas factura.
    const r = rentabilidadPorEntidad(
      {
        ...BASE,
        facturas: [
          { campanaId: 'C1', entidadEmisoraId: null },
          { campanaId: 'C2', entidadEmisoraId: 'E1' },
        ],
      },
      FEBRERO,
    )
    const ultima = r.filas[r.filas.length - 1]
    expect(ultima.clave).toBe('')
    expect(ultima.ingreso).toBe(30000)
  })

  it('pinta los papeles ETIQUETADOS, no los codigos: los lee una persona', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    expect(r.filas.find((f) => f.clave === 'E2')?.papeles).toEqual([
      'Paga las rentas a los arrendadores',
      'Compra los activos y el equipo',
    ])
  })
})

describe('DECLARA lo que no puede atribuir — y por eso no pinta margen', () => {
  it('no reparte la operacion ni la luz, y dice cuanto dinero es', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    // La OT de inspeccion y el recibo de 2 000 son costo real del periodo y no
    // tienen a quien cargarse.
    expect(r.atribucion?.costoEnergiaSinRepartir).toBe(2000)
    expect(r.atribucion?.costoOperacionSinRepartir).toBeGreaterThan(0)
  })

  it('ninguna fila trae margen: seria un numero mejor que el real', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    for (const f of r.filas) {
      expect(f.margenPct).toBeNull()
    }
  })

  it('cuenta las reservas sin emisora y los contratos sin razon social', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    expect(r.atribucion?.reservasSinEmisora).toBe(1)
    expect(r.atribucion?.contratosSinEntidad).toBe(0)
  })

  it('la nota nombra las dos fuentes que no se reparten, y la palabra margen', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    expect(r.atribucion?.nota).toMatch(/operaci[oó]n/i)
    expect(r.atribucion?.nota).toMatch(/luz/i)
    expect(r.atribucion?.nota).toMatch(/margen/i)
  })

  it('un contrato SIN razon social se cuenta, y su renta sale en «Sin asignar»', () => {
    const datos = { ...BASE, contratos: [{ ...BASE.contratos[0], entidadId: null }] }
    const r = rentabilidadPorEntidad(datos, FEBRERO)
    expect(r.atribucion?.contratosSinEntidad).toBe(1)
    expect(r.filas.find((f) => f.clave === '')?.costoEspacio).toBe(10000)
  })
})

describe('no puede divergir de las otras dimensiones', () => {
  it('el ingreso total es EXACTAMENTE el de `sitio` — el mismo periodo, el mismo dinero', () => {
    const porSitio = rentabilidadPorSitio(BASE, FEBRERO)
    const porEntidad = rentabilidadPorEntidad(BASE, FEBRERO)
    expect(porEntidad.totales.ingreso).toBe(porSitio.totales.ingreso)
    expect(porEntidad.totales.ingreso).toBe(50000)
  })

  it('el costo del espacio total es EXACTAMENTE el de `sitio`', () => {
    const porSitio = rentabilidadPorSitio(BASE, FEBRERO)
    const porEntidad = rentabilidadPorEntidad(BASE, FEBRERO)
    expect(porEntidad.totales.costoEspacio).toBe(porSitio.totales.costoEspacio)
    expect(porEntidad.totales.costoEspacio).toBe(10000)
  })

  it('las filas suman el total: no se pierde ni se inventa dinero', () => {
    const r = rentabilidadPorEntidad(BASE, FEBRERO)
    const suma = r.filas.reduce((a, f) => a + f.ingreso, 0)
    expect(suma).toBe(r.totales.ingreso)
  })
})

describe('sin razones sociales dadas de alta', () => {
  it('no explota: todo cae en «Sin asignar» y los totales siguen cuadrando', () => {
    const r = rentabilidadPorEntidad({ ...BASE, entidades: [], facturas: [] }, FEBRERO)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].clave).toBe('')
    expect(r.filas[0].ingreso).toBe(50000)
    expect(r.filas[0].costoEspacio).toBe(10000)
  })
})
