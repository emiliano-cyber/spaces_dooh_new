import { describe, it, expect } from 'vitest'
import { textoDeEstado } from './actualizaciones-ui'

const AL_DIA = {
  modo: 'aprobacion' as const,
  versionInstalada: 'v0.4.1',
  versionDisponible: 'v0.4.1',
  digestDisponible: 'sha256:a',
  migracionesPendientes: 0,
  comprobadoEn: '2026-09-22T10:00:00.000Z',
  aprobadoDigest: null,
  hayNovedad: false,
}
const CON_NOVEDAD = {
  ...AL_DIA, versionDisponible: 'v0.4.2', digestDisponible: 'sha256:b',
  migracionesPendientes: 3, hayNovedad: true,
}

describe('textoDeEstado', () => {
  it('al dia se dice, y en verde', () => {
    const r = textoDeEstado(AL_DIA)
    expect(r.tono).toBe('ok')
    expect(r.texto).toContain('v0.4.1')
  })

  it('con novedad y esperando aprobacion: avisa y NOMBRA la version', () => {
    // Sin el numero de version el aviso no deja decidir nada.
    const r = textoDeEstado(CON_NOVEDAD)
    expect(r.tono).toBe('alerta')
    expect(r.texto).toContain('v0.4.2')
  })

  it('con novedad y en automatica: dice CUANDO entra, no "pronto"', () => {
    const r = textoDeEstado({ ...CON_NOVEDAD, modo: 'automatica' })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/madrugada/i)
  })

  it('NEGATIVO: una aprobacion CADUCA no se pinta como aprobada', () => {
    // El dueno aprobo `sha256:viejo` y desde entonces salio otra. Pintarlo como
    // "ya aprobaste, tranquilo" es la mentira exacta que el ADR 0037 existe
    // para impedir: se quedaria esperando algo que no va a pasar nunca.
    const r = textoDeEstado({ ...CON_NOVEDAD, aprobadoDigest: 'sha256:viejo' })
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/mas nueva|otra version/i)
  })

  it('si nunca se ha comprobado, se dice: no se finge que esta al dia', () => {
    const r = textoDeEstado({ ...AL_DIA, comprobadoEn: null, digestDisponible: null })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/sin comprobar|no se ha comprobado/i)
  })
})
