import { describe, it, expect } from 'vitest'
import { itemsEnPropuesta, enPropuestaEntre, agruparPorPropuesta } from './en-propuesta'

// ============================================================================
//  TENT-PROP (26/10) · Regla del dueño: «lo tentativo es un spot o una pantalla
//  fija que está en veremos en una propuesta: aún no está aprobada ni creada la
//  campaña». Ya no es un estado de la reserva (la reserva TENTATIVA se retira:
//  ningún flujo la creaba). Y «solo avisa»: no bloquea vender la pantalla a
//  otro cliente; bloquea solo lo confirmado.
// ============================================================================

const clientes = [
  { id: 'K1', nombre: 'Refrescos SA' },
  { id: 'K2', nombre: 'Banco SA' },
]
const item = (sitioId: string, fi: string, ff: string, over: Record<string, unknown> = {}) => ({
  sitioId, fechaInicio: fi, fechaFin: ff, spotsPorDia: null, espaciosComprados: null, ...over,
})
const prop = (id: string, estatus: string, items: unknown[], over: Record<string, unknown> = {}) => ({
  id, folio: `PR-${id}`, estatus, clienteId: 'K1', items, ...over,
})

describe('itemsEnPropuesta · qué está en veremos', () => {
  it('cuenta las pantallas de propuestas en BORRADOR y ENVIADA, con folio, cliente y fechas', () => {
    const r = itemsEnPropuesta(
      [
        prop('1', 'BORRADOR', [item('S1', '2026-11-01', '2026-11-30')]),
        prop('2', 'ENVIADA', [item('S2', '2026-12-01', '2026-12-31')], { clienteId: 'K2' }),
      ] as any,
      clientes,
    )
    expect(r).toEqual([
      { sitioId: 'S1', propuestaId: '1', folio: 'PR-1', estatus: 'BORRADOR', clienteNombre: 'Refrescos SA', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', spots: null },
      { sitioId: 'S2', propuestaId: '2', folio: 'PR-2', estatus: 'ENVIADA', clienteNombre: 'Banco SA', fechaInicio: '2026-12-01', fechaFin: '2026-12-31', spots: null },
    ])
  })

  it('NEGATIVO · una APROBADA (ya es campaña) o una RECHAZADA ya no está en veremos', () => {
    const r = itemsEnPropuesta(
      [prop('1', 'APROBADA', [item('S1', '2026-11-01', '2026-11-30')]), prop('2', 'RECHAZADA', [item('S1', '2026-11-01', '2026-11-30')])] as any,
      clientes,
    )
    expect(r).toEqual([])
  })

  it('en una digital lleva los spots pedidos: los comprados de la calculadora mandan sobre los pases al día', () => {
    const r = itemsEnPropuesta(
      [
        prop('1', 'ENVIADA', [
          item('D1', '2026-11-01', '2026-11-30', { spotsPorDia: 4 }),
          item('D2', '2026-11-01', '2026-11-30', { spotsPorDia: 540, espaciosComprados: 3 }),
        ]),
      ] as any,
      clientes,
    )
    expect(r.map((x) => [x.sitioId, x.spots])).toEqual([['D1', 4], ['D2', 3]])
  })

  it('sin cliente todavía, el cliente es null (no se inventa)', () => {
    const r = itemsEnPropuesta([prop('1', 'BORRADOR', [item('S1', '2026-11-01', '2026-11-30')], { clienteId: null })] as any, clientes)
    expect(r[0].clienteNombre).toBeNull()
  })
})

describe('agruparPorPropuesta · la tarjeta «En propuesta» de Comercial', () => {
  it('una fila por propuesta, pantallas distintas, rango completo, la que empieza antes primero', () => {
    const items = itemsEnPropuesta(
      [
        prop('9', 'ENVIADA', [item('S1', '2026-12-01', '2026-12-31'), item('S2', '2026-12-10', '2027-01-15'), item('S1', '2027-01-01', '2027-01-31')]),
        prop('3', 'BORRADOR', [item('S3', '2026-11-01', '2026-11-30')]),
      ] as any,
      clientes,
    )
    expect(agruparPorPropuesta(items, '2026-10-26')).toEqual([
      { propuestaId: '3', folio: 'PR-3', estatus: 'BORRADOR', clienteNombre: 'Refrescos SA', pantallas: 1, desde: '2026-11-01', hasta: '2026-11-30' },
      { propuestaId: '9', folio: 'PR-9', estatus: 'ENVIADA', clienteNombre: 'Refrescos SA', pantallas: 2, desde: '2026-12-01', hasta: '2027-01-31' },
    ])
  })

  it('NEGATIVO · una propuesta abierta cuyas fechas ya pasaron no aparta nada', () => {
    const items = itemsEnPropuesta([prop('1', 'ENVIADA', [item('S1', '2026-09-01', '2026-09-30')])] as any, clientes)
    expect(agruparPorPropuesta(items, '2026-10-26')).toEqual([])
  })
})

describe('enPropuestaEntre · qué propuestas piden ESTA pantalla en ESTAS fechas', () => {
  const items = itemsEnPropuesta(
    [
      prop('1', 'ENVIADA', [item('S1', '2026-11-01', '2026-11-15')]),
      prop('2', 'BORRADOR', [item('S1', '2026-11-10', '2026-11-30')], { clienteId: 'K2' }),
      prop('3', 'ENVIADA', [item('S2', '2026-11-01', '2026-11-30')]),
    ] as any,
    clientes,
  )

  it('dos propuestas de clientes distintos compiten por la misma pantalla: salen las dos', () => {
    expect(enPropuestaEntre(items, 'S1', '2026-11-12', '2026-11-12').map((x) => x.folio)).toEqual(['PR-1', 'PR-2'])
  })

  it('el cruce es por día de calendario, inclusive en los dos extremos', () => {
    expect(enPropuestaEntre(items, 'S1', '2026-11-15', '2026-11-15').map((x) => x.folio)).toEqual(['PR-1', 'PR-2'])
    expect(enPropuestaEntre(items, 'S1', '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('NEGATIVO · otra pantalla no cuenta', () => {
    expect(enPropuestaEntre(items, 'S9', '2026-11-01', '2026-11-30')).toEqual([])
  })

  it('una propuesta con la MISMA pantalla en dos líneas sale una vez', () => {
    const dobles = itemsEnPropuesta(
      [prop('7', 'ENVIADA', [item('S1', '2026-11-01', '2026-11-10'), item('S1', '2026-11-11', '2026-11-20')])] as any,
      clientes,
    )
    expect(enPropuestaEntre(dobles, 'S1', '2026-11-01', '2026-11-30').map((x) => x.folio)).toEqual(['PR-7'])
  })
})
