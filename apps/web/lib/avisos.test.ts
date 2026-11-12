import { describe, it, expect } from 'vitest'
import { TIPOS_AVISO, CANALES_AVISO, normalizarTelefono, validarPreferencias, MSG_AVISO } from './avisos'

// ============================================================================
//  AVISOS-CANAL (12/11) · que avisos quiere cada quien, y por donde.
// ============================================================================

describe('TIPOS_AVISO', () => {
  it('son los tipos que escribe notificar(), y nada mas', () => {
    expect([...TIPOS_AVISO].sort()).toEqual(['CAMPANA', 'COBRANZA', 'FACTURA', 'ODC', 'OT', 'PAGO', 'PROPUESTA'])
  })
  it('los canales son correo y whatsapp, en ese orden', () => {
    expect(CANALES_AVISO).toEqual(['correo', 'whatsapp'])
  })
})

describe('normalizarTelefono', () => {
  it('quita espacios, guiones, puntos y parentesis', () => {
    expect(normalizarTelefono('+52 (55) 1234-5678')).toBe('+525512345678')
    expect(normalizarTelefono('+52.55.1234.5678')).toBe('+525512345678')
  })
  it('vacio o solo espacios es null: «no lo dio»', () => {
    expect(normalizarTelefono('')).toBeNull()
    expect(normalizarTelefono('   ')).toBeNull()
    expect(normalizarTelefono(null)).toBeNull()
    expect(normalizarTelefono(undefined)).toBeNull()
  })
  it('sin «+» y codigo de pais NO vale: WhatsApp no adivina el pais', () => {
    expect(normalizarTelefono('55 1234 5678')).toBe(false)
    expect(normalizarTelefono('+0 55 1234 5678')).toBe(false)
  })
  it('ni muy corto ni mas de 15 cifras (E.164)', () => {
    expect(normalizarTelefono('+5212345')).toBe(false)
    expect(normalizarTelefono('+5212345678901234')).toBe(false)
    expect(normalizarTelefono('+52123456')).toBe('+52123456')
  })
  it('letras no', () => {
    expect(normalizarTelefono('+52 55 TAXI 123')).toBe(false)
  })
  it('lo que no es texto no vale', () => {
    expect(normalizarTelefono(5512345678 as unknown)).toBe(false)
  })
})

describe('validarPreferencias', () => {
  const soloCorreo = ['correo'] as const

  it('acepta los tipos conocidos por correo y quita repetidos', () => {
    const r = validarPreferencias(
      { activos: [{ tipo: 'FACTURA', canal: 'correo' }, { tipo: 'FACTURA', canal: 'correo' }, { tipo: 'OT', canal: 'correo' }], telefono: '' },
      soloCorreo,
    )
    expect(r).toEqual({ ok: true, activos: [{ tipo: 'FACTURA', canal: 'correo' }, { tipo: 'OT', canal: 'correo' }], telefono: null })
  })
  it('un tipo desconocido es un 400, no se ignora', () => {
    expect(validarPreferencias({ activos: [{ tipo: 'CONTRATO', canal: 'correo' }] }, soloCorreo)).toEqual({ ok: false, error: MSG_AVISO.tipo })
  })
  it('WhatsApp se rechaza mientras no este disponible', () => {
    expect(validarPreferencias({ activos: [{ tipo: 'PAGO', canal: 'whatsapp' }] }, soloCorreo)).toEqual({ ok: false, error: MSG_AVISO.whatsapp })
  })
  it('y se acepta el dia que este disponible', () => {
    const r = validarPreferencias({ activos: [{ tipo: 'PAGO', canal: 'whatsapp' }], telefono: '+52 55 1234 5678' }, ['correo', 'whatsapp'])
    expect(r).toEqual({ ok: true, activos: [{ tipo: 'PAGO', canal: 'whatsapp' }], telefono: '+525512345678' })
  })
  it('un canal inventado es un 400', () => {
    expect(validarPreferencias({ activos: [{ tipo: 'PAGO', canal: 'sms' }] }, soloCorreo)).toEqual({ ok: false, error: MSG_AVISO.canal })
  })
  it('el telefono se guarda aunque WhatsApp este apagado: es lo «sembrado»', () => {
    expect(validarPreferencias({ activos: [], telefono: '+52 1 55 1234 5678' }, soloCorreo)).toEqual({ ok: true, activos: [], telefono: '+5215512345678' })
  })
  it('un telefono mal escrito es un 400 con el ejemplo', () => {
    expect(validarPreferencias({ activos: [], telefono: '5512345678' }, soloCorreo)).toEqual({ ok: false, error: MSG_AVISO.telefono })
  })
  it('sin cuerpo, o activos que no son lista, es un 400', () => {
    expect(validarPreferencias(null, soloCorreo).ok).toBe(false)
    expect(validarPreferencias({ activos: 'FACTURA' }, soloCorreo).ok).toBe(false)
    expect(validarPreferencias({ activos: [null] }, soloCorreo).ok).toBe(false)
  })
  it('no se puede mandar una lista enorme', () => {
    const muchos = Array.from({ length: 200 }, () => ({ tipo: 'PAGO', canal: 'correo' }))
    expect(validarPreferencias({ activos: muchos }, soloCorreo).ok).toBe(false)
  })
})

describe('MSG_AVISO · los mensajes llegan traducidos', () => {
  it('cada mensaje tiene su ingles, italiano y portugues en errores-servidor', async () => {
    const { traducirError } = await import('./i18n/errores-servidor')
    for (const m of Object.values(MSG_AVISO)) {
      for (const idioma of ['en', 'it', 'pt'] as const) {
        expect(traducirError(m, idioma), `${idioma}: ${m}`).not.toBe(m)
      }
    }
  })
})
