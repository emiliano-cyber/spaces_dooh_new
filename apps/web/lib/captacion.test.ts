import { describe, it, expect } from 'vitest'
import {
  ETAPAS,
  ETAPAS_DE_TRABAJO,
  TIPOS_PROSPECTO,
  etapaCerrada,
  motivoAvanceInvalido,
  motivoDecisionInvalida,
  faltantesParaRevision,
} from './captacion'

// ============================================================================
//  CAP-01 · Las reglas de la bitácora de captación, sin base ni red.
// ----------------------------------------------------------------------------
//  Lo que se fija aquí es QUIÉN puede mover un prospecto A DÓNDE. El servidor
//  lo vuelve a comprobar con la fila bloqueada (`captacion-repo.ts`), pero la
//  regla vive una sola vez, en `lib/captacion.ts`, y la pantalla la usa para
//  no ofrecer un botón que el servidor va a negar.
// ============================================================================

describe('el catálogo', () => {
  it('cuatro tipos de prospecto: lo que se capta', () => {
    expect([...TIPOS_PROSPECTO]).toEqual(['CLIENTE', 'ARRENDADOR', 'PREDIO', 'PANTALLA'])
  })

  it('las etapas, en el orden en que se recorren', () => {
    expect([...ETAPAS]).toEqual([
      'PROSPECTO',
      'CONTACTADO',
      'VISITA',
      'NEGOCIACION',
      'EN_REVISION',
      'APROBADO',
      'RECHAZADO',
      'PERDIDO',
    ])
  })

  it('las de trabajo son las que mueve el vendedor sin pedir permiso a nadie', () => {
    expect([...ETAPAS_DE_TRABAJO]).toEqual(['PROSPECTO', 'CONTACTADO', 'VISITA', 'NEGOCIACION'])
  })

  it('APROBADO y PERDIDO cierran el prospecto; RECHAZADO NO', () => {
    expect(etapaCerrada('APROBADO')).toBe(true)
    expect(etapaCerrada('PERDIDO')).toBe(true)
    // Rechazado vuelve al vendedor para que corrija: no es un final.
    expect(etapaCerrada('RECHAZADO')).toBe(false)
    expect(etapaCerrada('EN_REVISION')).toBe(false)
    expect(etapaCerrada('PROSPECTO')).toBe(false)
  })
})

describe('registrar un avance', () => {
  it('entre etapas de trabajo se avanza Y se retrocede', () => {
    expect(motivoAvanceInvalido('PROSPECTO', 'CONTACTADO')).toBeNull()
    expect(motivoAvanceInvalido('CONTACTADO', 'NEGOCIACION')).toBeNull()
    // Una visita que se cae devuelve a contactado: la bitácora lo cuenta.
    expect(motivoAvanceInvalido('VISITA', 'CONTACTADO')).toBeNull()
  })

  it('quedarse en la misma etapa es solo una nota, y vale', () => {
    expect(motivoAvanceInvalido('NEGOCIACION', 'NEGOCIACION')).toBeNull()
    expect(motivoAvanceInvalido('EN_REVISION', 'EN_REVISION')).toBeNull()
  })

  it('desde cualquier etapa de trabajo se envía a revisión o se da por perdido', () => {
    for (const e of ETAPAS_DE_TRABAJO) {
      expect(motivoAvanceInvalido(e, 'EN_REVISION')).toBeNull()
      expect(motivoAvanceInvalido(e, 'PERDIDO')).toBeNull()
    }
  })

  it('NADIE aprueba ni rechaza por un avance: eso es la decisión', () => {
    expect(motivoAvanceInvalido('NEGOCIACION', 'APROBADO')).toMatch(/revisi/i)
    expect(motivoAvanceInvalido('EN_REVISION', 'APROBADO')).toMatch(/revisi/i)
    expect(motivoAvanceInvalido('EN_REVISION', 'RECHAZADO')).toMatch(/revisi/i)
  })

  it('en revisión el prospecto espera: no se mueve de etapa por un avance', () => {
    expect(motivoAvanceInvalido('EN_REVISION', 'NEGOCIACION')).toMatch(/revisi/i)
    expect(motivoAvanceInvalido('EN_REVISION', 'PERDIDO')).toMatch(/revisi/i)
  })

  it('un rechazado vuelve a trabajarse, se reenvía o se da por perdido', () => {
    expect(motivoAvanceInvalido('RECHAZADO', 'NEGOCIACION')).toBeNull()
    expect(motivoAvanceInvalido('RECHAZADO', 'EN_REVISION')).toBeNull()
    expect(motivoAvanceInvalido('RECHAZADO', 'PERDIDO')).toBeNull()
  })

  it('un prospecto cerrado ya no admite avances, ni siquiera una nota', () => {
    expect(motivoAvanceInvalido('APROBADO', 'APROBADO')).toMatch(/cerrado/i)
    expect(motivoAvanceInvalido('PERDIDO', 'PROSPECTO')).toMatch(/cerrado/i)
  })

  it('una etapa que no existe se rechaza con su nombre', () => {
    expect(motivoAvanceInvalido('PROSPECTO', 'GANADO' as never)).toMatch(/GANADO/)
  })
})

describe('la decisión de quien aprueba', () => {
  it('solo se decide sobre lo que está EN_REVISION', () => {
    expect(motivoDecisionInvalida('EN_REVISION')).toBeNull()
    for (const e of ETAPAS.filter((x) => x !== 'EN_REVISION')) {
      expect(motivoDecisionInvalida(e)).not.toBeNull()
    }
  })

  it('y el motivo dice que ya se decidió cuando se repite', () => {
    // Es la respuesta a un doble clic en «Aprobar»: el segundo no crea nada.
    expect(motivoDecisionInvalida('APROBADO')).toMatch(/ya/i)
  })
})

describe('lo que hace falta para enviar a revisión', () => {
  const base = { nombre: 'X', contacto: {}, direccion: null, datos: {} }

  it('un cliente o un arrendador necesitan cómo contactarlos', () => {
    for (const tipo of ['CLIENTE', 'ARRENDADOR'] as const) {
      expect(faltantesParaRevision({ ...base, tipo })).toEqual([
        'un teléfono o un correo de contacto',
      ])
      expect(
        faltantesParaRevision({ ...base, tipo, contacto: { telefono: '5512345678' } }),
      ).toEqual([])
      expect(faltantesParaRevision({ ...base, tipo, contacto: { email: 'a@b.mx' } })).toEqual([])
    }
  })

  it('un predio necesita dirección y de quién es', () => {
    expect(faltantesParaRevision({ ...base, tipo: 'PREDIO' })).toEqual([
      'la dirección',
      'el dueño: un arrendador existente o el nombre y teléfono del contacto',
    ])
    expect(
      faltantesParaRevision({
        ...base,
        tipo: 'PREDIO',
        direccion: 'Av. Reforma 1',
        contacto: { nombre: 'Don Luis', telefono: '5511112222' },
      }),
    ).toEqual([])
    expect(
      faltantesParaRevision({
        ...base,
        tipo: 'PREDIO',
        direccion: 'Av. Reforma 1',
        datos: { arrendadorId: 'a1' },
      }),
    ).toEqual([])
  })

  it('una pantalla necesita dirección', () => {
    expect(faltantesParaRevision({ ...base, tipo: 'PANTALLA' })).toEqual(['la dirección'])
    expect(
      faltantesParaRevision({ ...base, tipo: 'PANTALLA', direccion: 'Insurgentes 100' }),
    ).toEqual([])
  })

  it('los espacios en blanco no cuentan como dato', () => {
    expect(
      faltantesParaRevision({ ...base, tipo: 'PANTALLA', direccion: '   ' }),
    ).toEqual(['la dirección'])
    expect(
      faltantesParaRevision({ ...base, tipo: 'CLIENTE', contacto: { telefono: ' ' } }),
    ).toEqual(['un teléfono o un correo de contacto'])
  })
})
