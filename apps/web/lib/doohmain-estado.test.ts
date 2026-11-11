import { describe, it, expect } from 'vitest'
import { accionDoohmain, accionesDoohmain, estadoDeCampanaRemota, ETIQUETA_ESTADO_REMOTO, hoyEnMexico } from './doohmain-estado'

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

  it('lee la respuesta REAL de get_campaigns, envuelta en `campaigns` (29/10, adv_004)', () => {
    // Copiada de DOOHmain, recortada: así contesta de verdad, y no como dice el PDF.
    const p = {
      campaigns: {
        '8377994cd2562c42642b878a3dc208b6': {
          name: 'Cliente local - Prueba SPACE OS', start_date: '2026-10-29',
          end_date: '2026-11-05', status: 'active', cant_day: '0', deleted: '0',
        },
      },
    }
    expect(estadoDeCampanaRemota(p, '8377994cd2562c42642b878a3dc208b6')).toEqual({
      estado: 'active', inicio: '2026-10-29', fin: '2026-11-05',
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
    expect(ETIQUETA_ESTADO_REMOTO.vencida).toBe('Terminó')
    expect(ETIQUETA_ESTADO_REMOTO.programada).toBe('Programada')
    expect(ETIQUETA_ESTADO_REMOTO.eliminada).toBe('Eliminada en DOOHmain')
    expect(ETIQUETA_ESTADO_REMOTO.no_encontrada).toBe('No está en DOOHmain')
  })
})

// 29/10, medido contra adv_004: DOOHmain NO cambia el `status` cuando pasan las
// fechas. Con el fin en el pasado o el inicio en el futuro sigue diciendo
// `active`, y la ficha decía «Al aire» de algo que no se reproduce.
describe('estadoDeCampanaRemota · las fechas mandan sobre un `active`', () => {
  const HOY = '2026-10-29'
  const con = (c: Record<string, string>) => ({ campaigns: { A: { deleted: '0', ...c } } })

  it('active con el fin AYER: terminó, no «al aire»', () => {
    const p = con({ status: 'active', start_date: '2026-10-20', end_date: '2026-10-28' })
    expect(estadoDeCampanaRemota(p, 'A', HOY).estado).toBe('vencida')
  })

  it('el ÚLTIMO día todavía está al aire, y el primero también', () => {
    expect(estadoDeCampanaRemota(con({ status: 'active', start_date: '2026-10-20', end_date: HOY }), 'A', HOY).estado).toBe('active')
    expect(estadoDeCampanaRemota(con({ status: 'active', start_date: HOY, end_date: '2026-11-05' }), 'A', HOY).estado).toBe('active')
  })

  it('active con el inicio en el FUTURO: programada', () => {
    const p = con({ status: 'active', start_date: '2026-11-10', end_date: '2026-11-20' })
    expect(estadoDeCampanaRemota(p, 'A', HOY).estado).toBe('programada')
  })

  it('una pausa sigue siendo pausa aunque esté vencida: lo que se hizo a mano no se tapa', () => {
    const p = con({ status: 'pause', start_date: '2026-10-20', end_date: '2026-10-28' })
    expect(estadoDeCampanaRemota(p, 'A', HOY).estado).toBe('pause')
  })

  it('la finalizada al reemplazar (fechas del 2000) es finalizada, no «terminó»', () => {
    const p = con({ status: 'finished', start_date: '2000-01-01', end_date: '2000-01-02' })
    expect(estadoDeCampanaRemota(p, 'A', HOY).estado).toBe('finished')
  })

  it('sin `hoy` no se deriva nada: queda el status tal cual', () => {
    const p = con({ status: 'active', start_date: '2026-10-20', end_date: '2026-10-28' })
    expect(estadoDeCampanaRemota(p, 'A').estado).toBe('active')
  })

  it('borrada en el panel (`deleted: "1"`) manda sobre cualquier status', () => {
    const p = con({ status: 'active', deleted: '1', start_date: HOY, end_date: '2026-11-05' })
    expect(estadoDeCampanaRemota(p, 'A', HOY).estado).toBe('eliminada')
  })

  it('DOOHmain contestó la lista y el auth NO viene: no está, que no es lo mismo que «no se sabe»', () => {
    expect(estadoDeCampanaRemota({ campaigns: {} }, 'A', HOY).estado).toBe('no_encontrada')
    expect(estadoDeCampanaRemota({ campaigns: [] }, 'A', HOY).estado).toBe('no_encontrada')
    // Una forma que no reconocemos sigue siendo «no se sabe».
    expect(estadoDeCampanaRemota({ otra: {} }, 'A', HOY).estado).toBeNull()
  })
})

describe('accionesDoohmain · qué botones tiene cada estado', () => {
  it('al aire o programada: solo pausar; en pausa: solo reanudar', () => {
    expect(accionesDoohmain('active')).toEqual(['pausar'])
    expect(accionesDoohmain('programada')).toEqual(['pausar'])
    expect(accionesDoohmain('pending')).toEqual(['pausar', 'reanudar'])
    expect(accionesDoohmain('pause')).toEqual(['reanudar'])
  })

  it('lo que ya no puede volver al aire no ofrece nada', () => {
    for (const e of ['finished', 'vencida', 'eliminada', 'no_encontrada'] as const) expect(accionesDoohmain(e)).toEqual([])
  })

  it('sin confirmar (DOOHmain caído) ofrece las dos: no se adivina', () => {
    expect(accionesDoohmain(null)).toEqual(['pausar', 'reanudar'])
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

describe('hoyEnMexico', () => {
  it('a las 21:00 de México ya es mañana en UTC, y el día sigue siendo el de México', () => {
    expect(hoyEnMexico(new Date('2026-10-30T03:00:00Z'))).toBe('2026-10-29')
    expect(hoyEnMexico(new Date('2026-10-30T07:00:00Z'))).toBe('2026-10-30')
  })
})
