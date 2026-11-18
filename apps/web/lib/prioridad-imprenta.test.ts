import { describe, it, expect } from 'vitest'
import { priorizarImpresion, grupoDe, diasEntre, conteoPorGrupo, diaLocal } from './prioridad-imprenta'

const HOY = '2026-11-17'
const oi = (folio: string, inicioCampana: string | null, estatus = 'ARTE_RECIBIDO') => ({
  id: folio,
  folio,
  estatus,
  inicioCampana,
})

describe('diasEntre', () => {
  it('cuenta días de calendario, sin horas ni zona horaria', () => {
    expect(diasEntre(HOY, '2026-11-18')).toBe(1)
    expect(diasEntre(HOY, '2026-11-18T23:59:00.000Z')).toBe(1)
    expect(diasEntre(HOY, '2026-11-17T00:00:00-06:00')).toBe(0)
    expect(diasEntre(HOY, '2026-11-10')).toBe(-7)
  })
  it('cruza el cambio de mes y de año', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1)
  })
  it('una fecha ilegible no inventa un número', () => {
    expect(diasEntre(HOY, 'mañana')).toBeNull()
    expect(diasEntre(HOY, '')).toBeNull()
  })
})

describe('diaLocal', () => {
  it('usa el día del reloj local, no el de UTC', () => {
    // 17/11 a las 23:30 hora local: en UTC-6 ya es 18/11, y aquí sigue siendo 17.
    expect(diaLocal(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17')
    expect(diaLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})

describe('grupoDe', () => {
  it('LISTO_MONTAJE va a LISTA aunque su campaña ya haya arrancado', () => {
    expect(grupoDe('LISTO_MONTAJE', -10)).toBe('LISTA')
  })
  it('ya arrancó y no está lista → ATRASADA', () => {
    expect(grupoDe('IMPRESO', -1)).toBe('ATRASADA')
  })
  it('los bordes: 0 y 7 son esta semana; 8 y 30 este mes; 31 después', () => {
    expect(grupoDe('VALIDADO', 0)).toBe('SEMANA')
    expect(grupoDe('VALIDADO', 7)).toBe('SEMANA')
    expect(grupoDe('VALIDADO', 8)).toBe('MES')
    expect(grupoDe('VALIDADO', 30)).toBe('MES')
    expect(grupoDe('VALIDADO', 31)).toBe('DESPUES')
  })
  it('sin fecha no se esconde como urgente ni como lejana', () => {
    expect(grupoDe('VALIDADO', null)).toBe('SIN_FECHA')
  })
})

describe('priorizarImpresion', () => {
  it('ordena por inicio de campaña, no por orden de alta', () => {
    // Alta en este orden: la de dentro de dos meses primero.
    const r = priorizarImpresion(
      [oi('OI-1', '2027-01-20'), oi('OI-2', '2026-11-19'), oi('OI-3', '2026-12-01')],
      HOY,
    )
    expect(r.map((x) => x.orden.folio)).toEqual(['OI-2', 'OI-3', 'OI-1'])
    expect(r.map((x) => x.lugar)).toEqual([1, 2, 3])
    expect(r.map((x) => x.grupo)).toEqual(['SEMANA', 'MES', 'DESPUES'])
  })

  it('las atrasadas encabezan y las listas cierran, sin lugar en la cola', () => {
    const r = priorizarImpresion(
      [
        oi('OI-L', '2026-11-18', 'LISTO_MONTAJE'),
        oi('OI-S', '2026-11-20'),
        oi('OI-A', '2026-11-15', 'EN_PRODUCCION'),
        oi('OI-N', null),
      ],
      HOY,
    )
    expect(r.map((x) => x.orden.folio)).toEqual(['OI-A', 'OI-S', 'OI-N', 'OI-L'])
    expect(r.map((x) => x.lugar)).toEqual([1, 2, 3, null])
    expect(r[0].dias).toBe(-2)
  })

  it('a igual fecha desempata el folio, y no muta la entrada', () => {
    const entrada = [oi('OI-9', '2026-11-20'), oi('OI-2', '2026-11-20')]
    const r = priorizarImpresion(entrada, HOY)
    expect(r.map((x) => x.orden.folio)).toEqual(['OI-2', 'OI-9'])
    expect(entrada.map((x) => x.folio)).toEqual(['OI-9', 'OI-2'])
  })

  it('conteoPorGrupo trae los seis grupos aunque estén vacíos', () => {
    const c = conteoPorGrupo(priorizarImpresion([oi('OI-1', '2026-11-18')], HOY))
    expect(c).toEqual({ ATRASADA: 0, SEMANA: 1, MES: 0, DESPUES: 0, SIN_FECHA: 0, LISTA: 0 })
  })
})
