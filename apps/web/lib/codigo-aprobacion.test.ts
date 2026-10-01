import { describe, it, expect } from 'vitest'
import {
  estadoCodigoDeFila,
  codigoVisibleParaCliente,
  filaParaCliente,
  estatusTrasCanje,
  admiteCupon,
  motivoDecisionImposible,
  bloqueaAprobacion,
  MSJ_APROBAR_CON_PENDIENTE,
  etiquetaEstadoCodigo,
  textoReactivacion,
  textoAprobacion,
  textoRechazo,
  textoQuitadoAlAceptar,
  vigentesParaSelector,
} from './codigo-aprobacion'

// ============================================================================
//  COD-03 · el cupón con APROBACIÓN, probado sin base.  Decisiones del dueño
//  del 2026-09-30.
// ----------------------------------------------------------------------------
//  Lo que no puede probar este archivo —y por eso existe
//  `lib/test/codigo-aprobacion.e2e.test.ts`— es que el SERVIDOR aplique estas
//  reglas en cada superficie: que el JSON público no lleve el código, que el
//  canje y el paso a BORRADOR vayan en la misma transacción, que el uso se
//  devuelva de verdad. Aquí solo se fija qué dicen las reglas.
// ============================================================================

describe('1 · el estado leído de la fila', () => {
  it('sin cupón no hay estado, diga lo que diga la columna', () => {
    expect(estadoCodigoDeFila({ codigo_texto: null, codigo_estado: null })).toBeNull()
    expect(estadoCodigoDeFila({ codigo_texto: null, codigo_estado: 'APROBADO' })).toBeNull()
  })

  it('PENDIENTE y APROBADO se leen tal cual', () => {
    expect(estadoCodigoDeFila({ codigo_texto: 'V20', codigo_estado: 'PENDIENTE' })).toBe('PENDIENTE')
    expect(estadoCodigoDeFila({ codigo_texto: 'V20', codigo_estado: 'APROBADO' })).toBe('APROBADO')
  })

  it('⚠️ un estado desconocido o ausente con cupón se lee PENDIENTE, nunca APROBADO', () => {
    // Fail-closed: un valor que no se entiende NO enseña el descuento al
    // cliente. Enseñarlo de más no se arregla; enseñarlo de menos lo arregla un
    // gerente con un clic.
    expect(estadoCodigoDeFila({ codigo_texto: 'V20', codigo_estado: null })).toBe('PENDIENTE')
    expect(estadoCodigoDeFila({ codigo_texto: 'V20', codigo_estado: 'aprobado' })).toBe('PENDIENTE')
    expect(estadoCodigoDeFila({ codigo_texto: 'V20', codigo_estado: 'OTRO' })).toBe('PENDIENTE')
    expect(estadoCodigoDeFila({ codigo_texto: 'V20' })).toBe('PENDIENTE')
  })
})

describe('2 · lo que ve el CLIENTE', () => {
  it('solo un cupón APROBADO es visible', () => {
    expect(codigoVisibleParaCliente('APROBADO')).toBe(true)
    expect(codigoVisibleParaCliente('PENDIENTE')).toBe(false)
    expect(codigoVisibleParaCliente(null)).toBe(false)
  })

  const FILA = {
    id: 'P1',
    total_que_no_se_toca: 1,
    codigo_texto: 'VERANO20',
    codigo_descuento_pct: '20.00',
    codigo_canjeado_en: new Date('2026-09-30T10:00:00Z'),
    codigo_estado: 'PENDIENTE',
    codigo_aprobado_por: null,
    codigo_aprobado_en: null,
  }

  it('con PENDIENTE la fila sale SIN cupón: texto, porcentaje y momento', () => {
    const f = filaParaCliente(FILA)
    expect(f.codigo_texto).toBeNull()
    expect(Number(f.codigo_descuento_pct)).toBe(0)
    expect(f.codigo_canjeado_en).toBeNull()
    expect(f.codigo_estado).toBeNull()
    // Lo demás no se toca.
    expect(f.id).toBe('P1')
    expect(f.total_que_no_se_toca).toBe(1)
  })

  it('no muta la fila recibida — la interna sigue llevando su cupón', () => {
    const copia = { ...FILA }
    filaParaCliente(copia)
    expect(copia.codigo_texto).toBe('VERANO20')
  })

  it('con APROBADO la fila sale IGUAL, con su cupón', () => {
    const f = filaParaCliente({ ...FILA, codigo_estado: 'APROBADO', codigo_aprobado_en: new Date() })
    expect(f.codigo_texto).toBe('VERANO20')
    expect(Number(f.codigo_descuento_pct)).toBe(20)
  })

  it('con estado ilegible, fail-closed: sin cupón', () => {
    const f = filaParaCliente({ ...FILA, codigo_estado: 'raro' })
    expect(f.codigo_texto).toBeNull()
    expect(Number(f.codigo_descuento_pct)).toBe(0)
  })
})

describe('3 · el canje sobre una RECHAZADA la reactiva', () => {
  it('RECHAZADA → BORRADOR; las demás se quedan donde están', () => {
    expect(estatusTrasCanje('RECHAZADA')).toBe('BORRADOR')
    expect(estatusTrasCanje('BORRADOR')).toBe('BORRADOR')
    expect(estatusTrasCanje('ENVIADA')).toBe('ENVIADA')
  })

  it('el cupón se ofrece en BORRADOR, ENVIADA y RECHAZADA, y NUNCA en APROBADA', () => {
    expect(admiteCupon('BORRADOR')).toBe(true)
    expect(admiteCupon('ENVIADA')).toBe(true)
    expect(admiteCupon('RECHAZADA')).toBe(true)
    expect(admiteCupon('APROBADA')).toBe(false)
    expect(admiteCupon('OTRA')).toBe(false)
  })
})

describe('4 · la decisión de un gerente', () => {
  it('solo se decide sobre un cupón PENDIENTE', () => {
    expect(motivoDecisionImposible({ estatus: 'ENVIADA', codigoEstado: 'PENDIENTE' })).toBeNull()
    expect(motivoDecisionImposible({ estatus: 'ENVIADA', codigoEstado: 'APROBADO' })).toMatch(/ya esta aprobado/i)
    expect(motivoDecisionImposible({ estatus: 'ENVIADA', codigoEstado: null })).toMatch(/no tiene/i)
  })

  it('una propuesta APROBADA no admite decisión aunque dijera PENDIENTE', () => {
    // No debería existir —el paso a APROBADA lo impide—, pero si existiera,
    // rechazar el cupón cambiaría un documento firmado.
    expect(
      motivoDecisionImposible({ estatus: 'APROBADA', codigoEstado: 'PENDIENTE' }),
    ).toMatch(/inmutable/i)
  })

  it('aprobar la propuesta con el cupón PENDIENTE está bloqueado, y la frase es la del dueño', () => {
    expect(bloqueaAprobacion('PENDIENTE')).toBe(true)
    expect(bloqueaAprobacion('APROBADO')).toBe(false)
    expect(bloqueaAprobacion(null)).toBe(false)
    expect(MSJ_APROBAR_CON_PENDIENTE).toMatch(/^Primero aprueba o rechaza el código promocional/)
  })
})

describe('5 · lo que dice la pantalla y lo que queda en Actividad', () => {
  it('la etiqueta dice quién aprobó', () => {
    expect(etiquetaEstadoCodigo('PENDIENTE', null)).toBe('Pendiente de aprobación')
    expect(etiquetaEstadoCodigo('APROBADO', 'Ana Gerente')).toBe('Aprobado por Ana Gerente')
    // El backfill: nadie lo aprobó, se veía solo por la regla de antes.
    expect(etiquetaEstadoCodigo('APROBADO', null)).toBe('Aprobado')
    expect(etiquetaEstadoCodigo(null, null)).toBeNull()
  })

  it('la bitácora nombra el código, y el rechazo su motivo', () => {
    expect(textoReactivacion('VERANO20')).toBe('Reactivó la propuesta con el código VERANO20')
    expect(textoAprobacion('VERANO20', 20)).toMatch(/Aprobó el código promocional VERANO20.*20 %/)
    const r = textoRechazo('VERANO20', 'el cliente no califica')
    expect(r).toMatch(/Rechazó el código promocional VERANO20/)
    expect(r).toMatch(/el cliente no califica/)
    expect(textoQuitadoAlAceptar('VERANO20')).toMatch(/sin el código VERANO20/)
  })
})

describe('6 · el selector de cupones existentes', () => {
  const C = (codigo: string, desde: string, hasta: string, usosMaximos: number | null, usos: number) => ({
    id: codigo, codigo, descuentoPct: 10, vigenteDesde: desde, vigenteHasta: hasta, usosMaximos, usos,
  })

  it('ofrece solo los vigentes HOY y con usos, ordenados por código', () => {
    const lista = [
      C('ZETA', '2026-09-01', '2026-10-31', null, 0),
      C('VENCIDO', '2026-08-01', '2026-09-29', null, 0),
      C('FUTURO', '2026-10-01', '2026-10-31', null, 0),
      C('AGOTADO', '2026-09-01', '2026-10-31', 2, 2),
      C('ALFA', '2026-09-30', '2026-09-30', 5, 4),
    ]
    expect(vigentesParaSelector(lista, '2026-09-30').map((c) => c.codigo)).toEqual(['ALFA', 'ZETA'])
  })

  it('sin fecha legible no ofrece nada: la vigencia la decide el servidor de todas formas', () => {
    expect(vigentesParaSelector([C('A', '2026-01-01', '2026-12-31', null, 0)], '')).toEqual([])
  })
})
