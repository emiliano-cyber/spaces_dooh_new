import { describe, it, expect } from 'vitest'
import { AVISO_PANTALLA_DOOHMAIN, mostrarAvisoPantallaDoohmain } from './doohmain-aviso'

// ============================================================================
//  El recordatorio de no tener la pantalla abierta en el sitio de DOOHmain.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: en Campañas, al enviar al dominio y subir
//  el creativo, recordar que no se esté en la pantalla dentro del sitio de
//  DOOHmain, para permitir el proceso. La regla de CUÁNDO se enseña vive aquí y
//  no en el `.tsx`, porque dentro del componente no la comprueba nada.
// ============================================================================

describe('el texto', () => {
  it('dice lo que pidió el dueño: no estar en la pantalla dentro del sitio de DOOHmain', () => {
    expect(AVISO_PANTALLA_DOOHMAIN).toMatch(/no estar en la pantalla/i)
    expect(AVISO_PANTALLA_DOOHMAIN).toMatch(/sitio de DOOHmain/)
    expect(AVISO_PANTALLA_DOOHMAIN).toMatch(/permitir el proceso/)
  })
})

describe('cuándo se enseña', () => {
  const base = { puede: true, requiereCreativos: true, enviadaDominio: false, estatus: 'PENDIENTE' as const }

  it('antes de enviar al dominio', () => {
    expect(mostrarAvisoPantallaDoohmain(base)).toBe(true)
  })

  it('enviada y por aprobar: aprobar es lo que sube el creativo', () => {
    expect(mostrarAvisoPantallaDoohmain({ ...base, enviadaDominio: true })).toBe(true)
  })

  it('aprobada, porque se puede volver a publicar', () => {
    expect(mostrarAvisoPantallaDoohmain({ ...base, enviadaDominio: true, estatus: 'APROBADA' })).toBe(true)
  })

  it('rechazada: se corrige y se reenvía, así que también', () => {
    expect(mostrarAvisoPantallaDoohmain({ ...base, estatus: 'RECHAZADA' })).toBe(true)
  })

  it('NO en una campaña solo OOH: no pasa por DOOHmain', () => {
    expect(mostrarAvisoPantallaDoohmain({ ...base, requiereCreativos: false })).toBe(false)
  })

  it('NO a quien no puede enviar ni aprobar: no tiene botón que pulsar', () => {
    expect(mostrarAvisoPantallaDoohmain({ ...base, puede: false })).toBe(false)
  })
})
