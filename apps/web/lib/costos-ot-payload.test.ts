import { describe, it, expect } from 'vitest'
import { payloadCostosOt } from './costos-ot-payload'

// ============================================================================
//  payloadCostosOt — qué costosOt viaja en el PATCH de la tarjeta de
//  Administración, y qué NO.
// ----------------------------------------------------------------------------
//  `vitest.config.ts` no monta jsdom (ver CLAUDE.md §4), así que esta decisión
//  —la única no trivial del bloque B11— sale del .tsx a un módulo puro para
//  poder probarla. La tarjeta solo orquesta: state de los inputs y la llamada
//  al PATCH.
//
//  La regla que fija el endpoint (`app/api/config/route.ts:64-67`) es: un
//  importe `null` es QUITAR ese tipo (vuelve al respaldo); un campo que NUNCA
//  se tocó no debe viajar, porque `PATCH /api/config` trata cada clave de
//  `costosOt` presente como una escritura — mandar de vuelta un tipo intacto
//  sería un PATCH parcial que se comporta como PUT completo sobre esa clave.
//
//  La forma de distinguir "nunca lo toqué" de "lo vacié a propósito" sin un
//  Set de "tocados" aparte es comparar el borrador contra el ORIGINAL que
//  trajo el GET: si el texto no cambió, no hay nada que mandar.
// ============================================================================

describe('payloadCostosOt — solo los tipos TOCADOS entran al payload', () => {
  it('un tipo sin cambios no aparece en el payload', () => {
    expect(payloadCostosOt({ HERRERIA: 4200 }, { HERRERIA: '4200' })).toEqual({})
  })

  it('un tipo nunca capturado (sin original y sin borrador) no aparece', () => {
    expect(payloadCostosOt({}, { HERRERIA: '' })).toEqual({})
  })

  it('un tipo vaciado desde un valor existente manda null explícito', () => {
    expect(payloadCostosOt({ HERRERIA: 4200 }, { HERRERIA: '' })).toEqual({ HERRERIA: null })
  })

  it('un tipo capturado por primera vez manda su número', () => {
    expect(payloadCostosOt({}, { INSPECCION: '0' })).toEqual({ INSPECCION: 0 })
  })

  it('un tipo con un número distinto del original manda el número nuevo', () => {
    expect(payloadCostosOt({ HERRERIA: 4200 }, { HERRERIA: '5000' })).toEqual({ HERRERIA: 5000 })
  })

  it('reescribir el MISMO número no cuenta como cambio', () => {
    expect(payloadCostosOt({ ELECTRICO: 1500 }, { ELECTRICO: '1500' })).toEqual({})
  })

  it('un número negativo se descarta: no se manda basura al servidor', () => {
    expect(payloadCostosOt({}, { HERRERIA: '-100' })).toEqual({})
  })

  it('un texto no numérico se descarta', () => {
    expect(payloadCostosOt({}, { HERRERIA: 'mucho' })).toEqual({})
  })

  it('varios tipos a la vez: solo los que de verdad cambiaron entran', () => {
    expect(
      payloadCostosOt(
        { HERRERIA: 4200, ELECTRICO: 1500, INSPECCION: 0 },
        { HERRERIA: '4200', ELECTRICO: '', INSPECCION: '0', DESMONTAJE: '900' },
      ),
    ).toEqual({ ELECTRICO: null, DESMONTAJE: 900 })
  })

  it('un tipo que desaparece del borrador (ni siquiera la clave) también cuenta como vaciado', () => {
    expect(payloadCostosOt({ HERRERIA: 4200 }, {})).toEqual({ HERRERIA: null })
  })
})
