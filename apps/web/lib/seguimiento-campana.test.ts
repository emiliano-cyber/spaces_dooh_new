import { describe, it, expect } from 'vitest'
import { armarSeguimiento, avanceImprenta, type DatosSeguimiento } from './seguimiento-campana'

// SEG-CLIENTE (17/11) · la línea de seguimiento que ve el cliente en su liga.

function base(over: Partial<DatosSeguimiento['campana']> = {}, resto: Partial<DatosSeguimiento> = {}): DatosSeguimiento {
  return {
    aceptadoEn: '2026-11-01T15:00:00.000Z',
    campana: {
      folio: 'CAM-2026-0001',
      nombre: 'Lanzamiento',
      tipo: 'OOH',
      estado: 'CONFIRMADA',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-31',
      creadaEn: '2026-11-02T10:00:00.000Z',
      publicada: false,
      publicadaEn: null,
      ...over,
    },
    creativos: [],
    imprenta: [],
    montajes: [],
    ...resto,
  }
}
const oi = (estatus: any, proveedor: string | null = 'Imprenta Norte') => ({
  folio: 'OI-1', sitioNombre: 'Reforma 1', proveedor, material: 'Lona', alto: 3, ancho: 4,
  estatus, pruebaColorAprobada: false, actualizadoEn: '2026-11-05T10:00:00.000Z',
})
const estados = (s: ReturnType<typeof armarSeguimiento>) => s.pasos.map((p) => `${p.clave}:${p.estado}`)

describe('armarSeguimiento', () => {
  it('OOH recién confirmada sin orden de imprenta: espera el arte', () => {
    const s = armarSeguimiento(base(), '2026-11-10')
    expect(s.pasoActual).toBe('material')
    expect(s.mensaje).toBe('material.esperando-arte')
    expect(estados(s)).toEqual([
      'aceptada:hecho', 'confirmada:hecho', 'material:actual', 'instalacion:pendiente', 'al_aire:pendiente', 'finalizada:pendiente',
    ])
    expect(s.pasos[0].fecha).toBe('2026-11-01T15:00:00.000Z')
  })

  it('OOH con UNA lona impresa de dos: sigue en imprenta (avanza con la más atrasada)', () => {
    const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO'), oi('EN_PRODUCCION', 'Gráficos Sur')] }), '2026-11-10')
    expect(s.pasoActual).toBe('material')
    expect(s.mensaje).toBe('material.imprenta')
    expect(s.imprentaListas).toBe(1)
    expect(s.proveedores).toEqual(['Imprenta Norte', 'Gráficos Sur'])
    expect(s.imprenta[1].avance).toBeCloseTo(3 / 5)
  })

  it('OOH impresa, montada y ya en fechas: al aire', () => {
    const s = armarSeguimiento(
      base({}, { imprenta: [oi('LISTO_MONTAJE')], montajes: [{ estatus: 'COMPLETADA', fechaCompletada: '2026-11-28T18:00:00.000Z' }] }),
      '2026-12-05',
    )
    expect(s.pasoActual).toBe('finalizada')
    expect(s.pasos.find((p) => p.clave === 'al_aire')).toEqual({ clave: 'al_aire', estado: 'hecho', fecha: '2026-12-01' })
  })

  it('NEGATIVO · la fecha de fin pasó pero nunca se instaló: NO dice finalizada ni al aire', () => {
    const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')] }), '2027-01-10')
    expect(s.pasoActual).toBe('instalacion')
    expect(s.pasos.find((p) => p.clave === 'finalizada')?.estado).toBe('pendiente')
    expect(s.pasos.find((p) => p.clave === 'al_aire')?.estado).toBe('pendiente')
  })

  it('NEGATIVO · un montaje sin completar no cuenta como instalada', () => {
    const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')], montajes: [{ estatus: 'EN_PROCESO', fechaCompletada: null }] }), '2026-12-05')
    expect(s.pasoActual).toBe('instalacion')
    expect(s.mensaje).toBe('instalacion.montaje')
  })

  it('DOOH con todo el arte rechazado: paso en alerta, y sin datos de imprenta', () => {
    const s = armarSeguimiento(
      base({ tipo: 'DOOH' }, {
        creativos: [{ nombre: 'spot.mp4', formato: 'VIDEO', resolucion: '1920x1080', estatus: 'RECHAZADA', creadoEn: '2026-11-03T00:00:00.000Z' }],
        imprenta: [oi('IMPRESO')],
      }),
      '2026-11-10',
    )
    expect(s.pasos.find((p) => p.clave === 'material')?.estado).toBe('alerta')
    expect(s.mensaje).toBe('material.rechazado')
    expect(s.imprenta).toEqual([])
    expect(s.proveedores).toEqual([])
  })

  it('DOOH con un creativo validado y publicado: pasa la instalación por la publicación', () => {
    const s = armarSeguimiento(
      base({ tipo: 'DOOH', publicada: true, publicadaEn: '2026-11-20T00:00:00.000Z' }, {
        creativos: [{ nombre: 'a.png', formato: 'IMAGEN', resolucion: null, estatus: 'VALIDADA', creadoEn: '2026-11-03T00:00:00.000Z' }],
      }),
      '2026-11-25',
    )
    expect(s.pasoActual).toBe('al_aire')
    expect(s.pasos.find((p) => p.clave === 'instalacion')?.fecha).toBe('2026-11-20T00:00:00.000Z')
  })

  it('HÍBRIDA: el material no está listo hasta que lo están lona Y anuncio', () => {
    const crea = [{ nombre: 'a.png', formato: 'IMAGEN', resolucion: null, estatus: 'VALIDADA' as const, creadoEn: null }]
    const soloCrea = armarSeguimiento(base({ tipo: 'HIBRIDA' }, { creativos: crea, imprenta: [oi('VALIDADO')] }), '2026-11-10')
    expect(soloCrea.pasoActual).toBe('material')
    expect(soloCrea.mensaje).toBe('material.hibrida')
    const ambos = armarSeguimiento(base({ tipo: 'HIBRIDA' }, { creativos: crea, imprenta: [oi('IMPRESO')] }), '2026-11-10')
    expect(ambos.pasoActual).toBe('instalacion')
    expect(ambos.mensaje).toBe('instalacion.hibrida')
  })

  it('corriendo dice «al aire» y no «terminó»; montada antes de su fecha dice «lista»', () => {
    const montada = { imprenta: [oi('IMPRESO')], montajes: [{ estatus: 'COMPLETADA', fechaCompletada: '2026-11-28T18:00:00.000Z' }] }
    expect(armarSeguimiento(base({}, montada), '2026-12-10').mensaje).toBe('al_aire')
    expect(armarSeguimiento(base({}, montada), '2026-11-29').mensaje).toBe('lista')
    expect(armarSeguimiento(base({}, montada), '2027-01-02').mensaje).toBe('finalizada')
  })

  it('retrasada solo si pasó el arranque sin estar al aire (y no por un arte rechazado)', () => {
    expect(armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')] }), '2026-12-03').retrasada).toBe(true)
    expect(armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')] }), '2026-11-30').retrasada).toBe(false)
    const montada = { imprenta: [oi('IMPRESO')], montajes: [{ estatus: 'COMPLETADA', fechaCompletada: null }] }
    expect(armarSeguimiento(base({}, montada), '2026-12-03').retrasada).toBe(false)
  })

  it('cancelada: lo dice el mensaje', () => {
    const s = armarSeguimiento(base({ estado: 'CANCELADA' }), '2026-11-10')
    expect(s.cancelada).toBe(true)
    expect(s.mensaje).toBe('cancelada')
  })

  it('nunca hay más de un paso actual, y nada hecho después de él', () => {
    for (const hoy of ['2026-11-10', '2026-12-10', '2027-02-01']) {
      const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')] }), hoy)
      const i = s.pasos.findIndex((p) => p.estado === 'actual' || p.estado === 'alerta')
      expect(s.pasos.filter((p) => p.estado === 'actual' || p.estado === 'alerta').length).toBeLessThanOrEqual(1)
      if (i >= 0) expect(s.pasos.slice(i + 1).every((p) => p.estado === 'pendiente')).toBe(true)
    }
  })
})

describe('avanceImprenta', () => {
  it('va de 1/5 a 5/5 y no se sale', () => {
    expect(avanceImprenta('ARTE_RECIBIDO')).toBeCloseTo(0.2)
    expect(avanceImprenta('LISTO_MONTAJE')).toBe(1)
    expect(avanceImprenta('OTRO' as any)).toBe(0)
  })
})

import { puedeCambiarImprentaVisible } from './seguimiento-campana'

describe('puedeCambiarImprentaVisible', () => {
  const prop = (usuarioId: string | null, rolCreador: string | null) => ({ usuarioId, rolCreador })
  it('el vendedor que la creó, sí', () => {
    expect(puedeCambiarImprentaVisible({ id: 'v1', rol: 'VENDEDOR' }, prop('v1', 'VENDEDOR'))).toBe(true)
  })
  it('NEGATIVO · otro vendedor, no', () => {
    expect(puedeCambiarImprentaVisible({ id: 'v2', rol: 'VENDEDOR' }, prop('v1', 'VENDEDOR'))).toBe(false)
  })
  it('un superior, sí; uno del mismo rango que no la creó, no', () => {
    expect(puedeCambiarImprentaVisible({ id: 'g1', rol: 'GERENTE_VENTAS' }, prop('v1', 'VENDEDOR'))).toBe(true)
    expect(puedeCambiarImprentaVisible({ id: 'g2', rol: 'GERENTE_VENTAS' }, prop('g1', 'GERENTE_VENTAS'))).toBe(false)
    expect(puedeCambiarImprentaVisible({ id: 'd1', rol: 'DIRECTOR_COMERCIAL' }, prop('g1', 'GERENTE_VENTAS'))).toBe(true)
  })
  it('NEGATIVO · un vendedor no puede sobre la de su gerente', () => {
    expect(puedeCambiarImprentaVisible({ id: 'v1', rol: 'VENDEDOR' }, prop('g1', 'GERENTE_VENTAS'))).toBe(false)
  })
  it('Dueño y Administrador, siempre', () => {
    expect(puedeCambiarImprentaVisible({ id: 'x', rol: 'DUENO' }, prop('y', 'DUENO'))).toBe(true)
    expect(puedeCambiarImprentaVisible({ id: 'x', rol: 'ADMINISTRADOR' }, prop('y', 'DIRECTOR_COMERCIAL'))).toBe(true)
  })
  it('NEGATIVO · roles fuera de venta, nunca (ni siendo el creador)', () => {
    for (const rol of ['OPERACIONES', 'IMPRENTA', 'FINANZAS', 'CLIENTE']) {
      expect(puedeCambiarImprentaVisible({ id: 'u', rol }, prop('u', rol))).toBe(false)
    }
  })
  it('creador borrado: decide un superior a vendedor', () => {
    expect(puedeCambiarImprentaVisible({ id: 'v', rol: 'VENDEDOR' }, prop(null, null))).toBe(false)
    expect(puedeCambiarImprentaVisible({ id: 'g', rol: 'GERENTE_VENTAS' }, prop(null, null))).toBe(true)
  })
})
