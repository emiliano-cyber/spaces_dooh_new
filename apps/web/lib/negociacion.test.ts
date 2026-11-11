import { describe, it, expect } from 'vitest'
import {
  VISIBILIDADES,
  CANALES,
  ESTADOS_OFERTA,
  ETAPAS_RESPONSABLE,
  motivoEtapaResponsable,
  motivoQuitarLegal,
  motivoPresupuesto,
  motivoCambioOferta,
  motivoEdicion,
  areaM2,
  siguienteVersion,
  estadoEspacio,
  diasDesde,
} from './negociacion'

// ============================================================================
//  NEG-01 · Las reglas de Comercial negociación, sin base ni red.
// ----------------------------------------------------------------------------
//  Viven fuera del `.tsx` y fuera del repo por lo mismo que `lib/captacion.ts`:
//  la pantalla las usa para no ofrecer lo que el servidor negaría, y el
//  servidor las vuelve a aplicar con la fila bloqueada. Una regla escrita dos
//  veces diverge.
// ============================================================================

describe('las listas cerradas', () => {
  it('la visibilidad es cercana, media o lejana — el pedido del dueño, tal cual', () => {
    expect(VISIBILIDADES).toEqual(['CERCANA', 'MEDIA', 'LEJANA'])
  })

  it('cinco etapas de encontrar al responsable, y la última es quien firma', () => {
    expect(ETAPAS_RESPONSABLE).toHaveLength(5)
    expect(ETAPAS_RESPONSABLE[4]).toBe('Responsable legal confirmado')
  })

  it('canales y estados de oferta con los valores del CHECK de la migración', () => {
    expect(CANALES).toEqual(['LLAMADA', 'VISITA', 'REUNION', 'CORREO', 'WHATSAPP', 'OTRO'])
    expect(ESTADOS_OFERTA).toEqual(['ENVIADA', 'CONTRAOFERTA', 'RECHAZADA', 'ACEPTADA'])
  })
})

describe('la búsqueda del responsable', () => {
  it('las etapas 1 a 4 no piden nada', () => {
    for (const e of [1, 2, 3, 4]) expect(motivoEtapaResponsable(e, [])).toBeNull()
  })

  it('la 5 exige un contacto marcado como quien firma: si no, la etapa miente', () => {
    expect(motivoEtapaResponsable(5, [{ esLegal: false }])).toMatch(/firma/)
    expect(motivoEtapaResponsable(5, [])).toMatch(/firma/)
    expect(motivoEtapaResponsable(5, [{ esLegal: false }, { esLegal: true }])).toBeNull()
  })

  it('fuera de 1..5 no existe', () => {
    expect(motivoEtapaResponsable(0, [])).not.toBeNull()
    expect(motivoEtapaResponsable(6, [{ esLegal: true }])).not.toBeNull()
    expect(motivoEtapaResponsable(2.5, [])).not.toBeNull()
  })

  it('no se le quita la firma al ÚNICO legal de un espacio en la etapa 5', () => {
    const contactos = [{ id: 'a', esLegal: true }, { id: 'b', esLegal: false }]
    expect(motivoQuitarLegal(5, contactos, 'a')).toMatch(/firma/)
    // Con otro legal, sí.
    expect(motivoQuitarLegal(5, [...contactos, { id: 'c', esLegal: true }], 'a')).toBeNull()
    // En otra etapa, sí.
    expect(motivoQuitarLegal(4, contactos, 'a')).toBeNull()
    // Quitar a uno que no firma nunca estorba.
    expect(motivoQuitarLegal(5, contactos, 'b')).toBeNull()
  })
})

describe('el presupuesto', () => {
  it('vacío o con un solo extremo vale', () => {
    expect(motivoPresupuesto(null, null)).toBeNull()
    expect(motivoPresupuesto(1000, null)).toBeNull()
    expect(motivoPresupuesto(null, 2000)).toBeNull()
  })

  it('el mínimo no puede pasar del máximo', () => {
    expect(motivoPresupuesto(3000, 2000)).toMatch(/mínimo/)
    expect(motivoPresupuesto(2000, 2000)).toBeNull()
  })
})

describe('las ofertas al dueño', () => {
  it('la versión siguiente es la mayor más uno, y la primera es 1', () => {
    expect(siguienteVersion([])).toBe(1)
    expect(siguienteVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toBe(4)
  })

  it('aceptada y rechazada son finales', () => {
    expect(motivoCambioOferta('ACEPTADA', 'RECHAZADA')).not.toBeNull()
    expect(motivoCambioOferta('RECHAZADA', 'ACEPTADA')).not.toBeNull()
  })

  it('una enviada o una contraoferta pueden pasar a cualquier otro estado', () => {
    expect(motivoCambioOferta('ENVIADA', 'CONTRAOFERTA')).toBeNull()
    expect(motivoCambioOferta('ENVIADA', 'ACEPTADA')).toBeNull()
    expect(motivoCambioOferta('CONTRAOFERTA', 'RECHAZADA')).toBeNull()
    expect(motivoCambioOferta('CONTRAOFERTA', 'ENVIADA')).toBeNull()
  })

  it('dejarla en el mismo estado no es un cambio y siempre vale (corregir la nota)', () => {
    expect(motivoCambioOferta('ACEPTADA', 'ACEPTADA')).toBeNull()
  })
})

describe('cuándo se puede tocar un espacio', () => {
  it('perdido es historia: ni ficha, ni contactos, ni ofertas', () => {
    expect(motivoEdicion('PERDIDO', 'ficha')).not.toBeNull()
    expect(motivoEdicion('PERDIDO', 'hijos')).not.toBeNull()
  })

  it('en revisión no se mueve la ficha (cambiaría lo que se revisa), lo demás sí', () => {
    expect(motivoEdicion('EN_REVISION', 'ficha')).not.toBeNull()
    expect(motivoEdicion('EN_REVISION', 'hijos')).toBeNull()
  })

  it('un espacio activo (aprobado) sigue admitiendo contactos y ofertas', () => {
    expect(motivoEdicion('APROBADO', 'hijos')).toBeNull()
  })

  it('las notas no pasan por aquí: se pueden añadir siempre', () => {
    for (const e of ['PROSPECTO', 'EN_REVISION', 'APROBADO', 'PERDIDO'] as const) {
      expect(motivoEdicion(e, 'notas')).toBeNull()
    }
  })
})

describe('las cuentas de la pantalla', () => {
  it('el área es ancho por alto, con dos decimales', () => {
    expect(areaM2(12.9, 7.2)).toBe(92.88)
    expect(areaM2(8, 5)).toBe(40)
  })

  it('sin una de las dos medidas NO hay área: null, no cero', () => {
    expect(areaM2(null, 5)).toBeNull()
    expect(areaM2(8, null)).toBeNull()
  })

  it('el estado del espacio sale de la etapa de venta', () => {
    expect(estadoEspacio('APROBADO')).toBe('activo')
    expect(estadoEspacio('PERDIDO')).toBe('inactivo')
    expect(estadoEspacio('NEGOCIACION')).toBe('negociacion')
    expect(estadoEspacio('EN_REVISION')).toBe('negociacion')
  })

  it('días desde un instante, y null —no 0— cuando nunca hubo contacto', () => {
    const hoy = new Date('2026-10-22T18:00:00Z')
    expect(diasDesde(null, hoy)).toBeNull()
    expect(diasDesde('2026-10-22T09:00:00Z', hoy)).toBe(0)
    expect(diasDesde('2026-09-20T18:00:00Z', hoy)).toBe(32)
  })
})
