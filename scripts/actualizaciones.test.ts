import { describe, it, expect } from 'vitest'
import { decidirActualizacion, MODOS } from './actualizaciones.mjs'

const BASE = {
  modo: 'aprobacion',
  corrida: 'comprobar',
  digestInstalado: 'sha256:viejo',
  digestDisponible: 'sha256:nuevo',
  aprobadoDigest: null,
}

describe('decidirActualizacion', () => {
  it('sin nada disponible no se actualiza', () => {
    const r = decidirActualizacion({ ...BASE, digestDisponible: null })
    expect(r).toEqual({ actualizar: false, motivo: 'sin-disponible' })
  })

  it('si lo disponible ya es lo instalado, no hay nada que hacer', () => {
    const r = decidirActualizacion({ ...BASE, digestDisponible: 'sha256:viejo' })
    expect(r).toEqual({ actualizar: false, motivo: 'sin-cambios' })
  })

  it('en automatica, la corrida programada actualiza', () => {
    const r = decidirActualizacion({ ...BASE, modo: 'automatica', corrida: 'programada' })
    expect(r).toEqual({ actualizar: true, motivo: 'automatica' })
  })

  it('NEGATIVO: en automatica, la corrida frecuente NO actualiza', () => {
    // Su trabajo no es meter un corte de servicio a media manana. Si esto se
    // pone en verde devolviendo `actualizar: true`, se perdio la garantia de
    // que los cortes automaticos son de madrugada.
    const r = decidirActualizacion({ ...BASE, modo: 'automatica', corrida: 'comprobar' })
    expect(r).toEqual({ actualizar: false, motivo: 'automatica-espera-madrugada' })
  })

  it('una aprobacion que cuadra actualiza, en cualquiera de las dos corridas', () => {
    for (const corrida of ['comprobar', 'programada']) {
      const r = decidirActualizacion({ ...BASE, corrida, aprobadoDigest: 'sha256:nuevo' })
      expect(r, corrida).toEqual({ actualizar: true, motivo: 'aprobada' })
    }
  })

  it('NEGATIVO: una aprobacion para OTRO digest no actualiza', () => {
    // El corazon del ADR 0037. El dueno aprobo lo que vio; si la etiqueta del
    // canal se movio despues, instalar seria poner algo que nunca miro.
    const r = decidirActualizacion({ ...BASE, aprobadoDigest: 'sha256:el-que-vio-ayer' })
    expect(r).toEqual({ actualizar: false, motivo: 'aprobacion-caduca' })
  })

  it('NEGATIVO: en automatica, una aprobacion caduca NO frena la actualizacion', () => {
    // Una aprobacion vieja colgando no puede congelar a quien eligio automatica.
    const r = decidirActualizacion({
      ...BASE, modo: 'automatica', corrida: 'programada', aprobadoDigest: 'sha256:viejisimo',
    })
    expect(r).toEqual({ actualizar: true, motivo: 'automatica' })
  })

  it('sin aprobacion y en modo aprobacion, se espera', () => {
    expect(decidirActualizacion(BASE)).toEqual({
      actualizar: false, motivo: 'esperando-aprobacion',
    })
  })

  it('NEGATIVO: un modo que no se reconoce NO actualiza', () => {
    // Fail-closed. Un modo corrupto o de una version futura no puede
    // interpretarse como "adelante": actualizar es lo irreversible.
    const r = decidirActualizacion({ ...BASE, modo: 'loquesea', corrida: 'programada' })
    expect(r).toEqual({ actualizar: false, motivo: 'modo-desconocido' })
  })

  it('los dos modos validos, declarados una sola vez', () => {
    expect(MODOS).toEqual(['automatica', 'aprobacion'])
  })
})
