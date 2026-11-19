import { describe, it, expect } from 'vitest'
import { armarSeguimiento, avanceImprenta, formatoParaCliente, type DatosSeguimiento } from './seguimiento-campana'

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
    // Corriendo: el «Ahora» en «Al aire» (con su fecha), «terminada» pendiente.
    expect(s.pasoActual).toBe('al_aire')
    expect(s.pasos.find((p) => p.clave === 'al_aire')).toEqual({ clave: 'al_aire', estado: 'actual', fecha: '2026-12-01' })
    expect(s.pasos.find((p) => p.clave === 'finalizada')?.estado).toBe('pendiente')
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

// ENVIO-CLIENTE (18/11) · ¿cuándo enseña la liga «Subir creativo»? Mientras la
// campaña NO esté al aire: en el paso de material, y en el de instalación solo
// si lleva pantallas (todavía no se publica). Nunca cancelada ni terminada.
describe('puedeSubirCreativo', () => {
  it('en el paso de material, sí (OOH y DOOH)', () => {
    expect(armarSeguimiento(base(), '2026-11-10').puedeSubirCreativo).toBe(true)
    expect(armarSeguimiento(base({ tipo: 'DOOH' }), '2026-11-10').puedeSubirCreativo).toBe(true)
  })
  it('DOOH con el creativo aprobado y sin publicar (instalación): sí', () => {
    const s = armarSeguimiento(
      base({ tipo: 'DOOH' }, { creativos: [{ nombre: 'a', formato: null, resolucion: null, estatus: 'VALIDADA', creadoEn: null }] }),
      '2026-11-10',
    )
    expect(s.pasoActual).toBe('instalacion')
    expect(s.puedeSubirCreativo).toBe(true)
  })
  it('DOOH publicada que espera su fecha: sí, hasta que salga al aire', () => {
    const s = armarSeguimiento(base({ tipo: 'DOOH', publicada: true }), '2026-11-10')
    expect(s.pasoActual).toBe('al_aire')
    expect(s.puedeSubirCreativo).toBe(true)
  })
  it('OOH montada que espera su fecha: no, la lona ya está puesta', () => {
    const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')], montajes: [{ estatus: 'COMPLETADA', fechaCompletada: null }] }), '2026-11-10')
    expect(s.pasoActual).toBe('al_aire')
    expect(s.puedeSubirCreativo).toBe(false)
  })
  it('OOH con las lonas impresas (instalación): ya no, la lona está hecha', () => {
    const s = armarSeguimiento(base({}, { imprenta: [oi('IMPRESO')] }), '2026-11-10')
    expect(s.pasoActual).toBe('instalacion')
    expect(s.puedeSubirCreativo).toBe(false)
  })
  it('al aire, terminada o cancelada: no', () => {
    const alAire = armarSeguimiento(base({ tipo: 'DOOH', publicada: true, fechaInicio: '2026-11-01' }), '2026-11-10')
    expect(alAire.pasoActual).toBe('al_aire')
    expect(alAire.puedeSubirCreativo).toBe(false)
    expect(armarSeguimiento(base({ estado: 'CANCELADA' }), '2026-11-10').puedeSubirCreativo).toBe(false)
    // Pasó la fecha de fin sin instalar: el paso actual sigue en material, pero
    // una campaña vencida ya no recibe material.
    expect(armarSeguimiento(base({ fechaFin: '2026-11-05' }), '2026-11-10').puedeSubirCreativo).toBe(false)
    expect(armarSeguimiento(base({ estado: 'COMPLETADA' }), '2026-11-10').puedeSubirCreativo).toBe(false)
  })
  it('pasa las pantallas y los envíos tal cual, y vacíos si no vienen', () => {
    const s0 = armarSeguimiento(base(), '2026-11-10')
    expect(s0.pantallas).toEqual([])
    expect(s0.envios).toEqual([])
    const pant = [{ id: 's1', nombre: 'Reforma', tipoMedio: 'ESPECTACULAR', ancho: 12.9, alto: 7.2, resolucionPx: null }]
    const env = [{ nombre: 'arte.png', estatus: 'RECHAZADO' as const, motivo: 'Falta el logo', creadoEn: '2026-11-09T10:00:00Z', sitioNombre: 'Reforma' }]
    const s = armarSeguimiento(base({}, { pantallas: pant, envios: env }), '2026-11-10')
    expect(s.pantallas).toEqual(pant)
    expect(s.envios).toEqual(env)
  })
})

// Hallazgo A2 (19/11): bajo el anuncio que mandó el cliente salía
// «text/html · 1920x1080». La imagen se guarda envuelta en HTML (`imagenAHtml`)
// para el reproductor, y ese tipo interno no le dice nada al cliente.
describe('formatoParaCliente', () => {
  it('el HTML interno (imagen envuelta) no se enseña: queda solo la medida', () => {
    expect(formatoParaCliente('text/html')).toBeNull()
    expect(formatoParaCliente('TEXT/HTML; charset=utf-8')).toBeNull()
  })
  it('un tipo MIME de imagen, vídeo o PDF se dice con su nombre corto', () => {
    expect(formatoParaCliente('image/png')).toBe('PNG')
    expect(formatoParaCliente('image/jpeg')).toBe('JPG')
    expect(formatoParaCliente('video/mp4')).toBe('MP4')
    expect(formatoParaCliente('application/pdf')).toBe('PDF')
  })
  it('lo que ya es un nombre legible se deja tal cual, y lo vacío es null', () => {
    expect(formatoParaCliente('PDF/X-1a')).toBe('PDF/X-1a')
    expect(formatoParaCliente('VIDEO')).toBe('VIDEO')
    expect(formatoParaCliente(null)).toBeNull()
    expect(formatoParaCliente('  ')).toBeNull()
  })
})
