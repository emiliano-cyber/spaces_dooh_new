import { describe, it, expect } from 'vitest'
import { accionDoohmain, estadoDeCampanaRemota, ETIQUETA_ESTADO_REMOTO } from './doohmain-estado'

// ============================================================================
//  El estado de un creativo EN DOOHmain (`get_campaigns`) y la acción de
//  pausarlo o reanudarlo (`update_campaign` con `status`).
//
//  La forma de la respuesta de `get_campaigns` NO está documentada más allá de
//  «objeto key,value; el key es el auth». Por eso el intérprete solo afirma lo
//  que ve: si no encuentra el auth o un `status` reconocible, dice «no se sabe»
//  en vez de inventarse un estado — mismo criterio que el proof of play.
// ============================================================================

describe('estadoDeCampanaRemota', () => {
  it('lee el status del objeto indexado por auth', () => {
    const p = { AUTH1: { name: 'X', status: 'active', start_date: '2026-10-01', end_date: '2026-10-31' } }
    expect(estadoDeCampanaRemota(p, 'AUTH1')).toEqual({
      estado: 'active',
      inicio: '2026-10-01',
      fin: '2026-10-31',
    })
  })

  it('acepta la envoltura `success`, igual que create_campaign', () => {
    const p = { success: { AUTH1: { status: 'pause' } } }
    expect(estadoDeCampanaRemota(p, 'AUTH1').estado).toBe('pause')
  })

  it('normaliza mayúsculas y espacios del status', () => {
    expect(estadoDeCampanaRemota({ A: { status: ' Finished ' } }, 'A').estado).toBe('finished')
  })

  it('un status que no es de los cuatro documentados NO se adivina', () => {
    expect(estadoDeCampanaRemota({ A: { status: 'algo-raro' } }, 'A').estado).toBeNull()
  })

  it('sin el auth en la respuesta: no se sabe (no «activa» por omisión)', () => {
    expect(estadoDeCampanaRemota({ OTRO: { status: 'active' } }, 'A')).toEqual({ estado: null, inicio: null, fin: null })
    expect(estadoDeCampanaRemota([], 'A').estado).toBeNull()
    expect(estadoDeCampanaRemota(null, 'A').estado).toBeNull()
  })

  it('no confunde el auth de una campaña con el de otra', () => {
    const p = { A: { status: 'pause' }, B: { status: 'active' } }
    expect(estadoDeCampanaRemota(p, 'B').estado).toBe('active')
  })

  it('cada estado tiene su etiqueta en español', () => {
    expect(ETIQUETA_ESTADO_REMOTO.active).toBe('Al aire')
    expect(ETIQUETA_ESTADO_REMOTO.pause).toBe('En pausa')
  })
})

describe('accionDoohmain', () => {
  it('solo acepta pausar o reanudar, y devuelve el status de DOOHmain', () => {
    expect(accionDoohmain({ accion: 'pausar' })).toBe('pause')
    expect(accionDoohmain({ accion: 'reanudar' })).toBe('active')
  })

  it('rechaza cualquier otra cosa — en particular `finished`, que no tiene vuelta', () => {
    expect(accionDoohmain({ accion: 'finalizar' })).toBeNull()
    expect(accionDoohmain({ accion: 'finished' })).toBeNull()
    expect(accionDoohmain({ accion: 'active' })).toBeNull()
    expect(accionDoohmain({})).toBeNull()
    expect(accionDoohmain(null)).toBeNull()
  })
})
