import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { construirLicencia } from './licencia.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { licenciaConModulo, modulosDe, ordenPara } from './modulo.mjs'

// Activar o desactivar Space Eyes re-firma la licencia vigente con el modulo
// puesto o quitado. Lo que no puede pasar: que al hacerlo cambie el
// vencimiento, el dominio o los avisos de la empresa.
const vigente = construirLicencia({
  instancia: 'pixeled', dominio: 'pixeled.ejemplo.mx', vence: '2027-06-30', avisoDias: 30, graciaDias: 15, emitida: '2026-09-10',
})

describe('licenciaConModulo', () => {
  it('activar: agrega el modulo y conserva todo lo demas', () => {
    const nueva = JSON.parse(licenciaConModulo(vigente, { modulo: 'space-eyes', activar: true, hoy: '2026-10-07' }))
    expect(nueva).toEqual({ ...JSON.parse(vigente), emitida: '2026-10-07', modulos: ['space-eyes'] })
  })

  it('desactivar: lo quita y lo deja ESCRITO como apagado', () => {
    const con = licenciaConModulo(vigente, { modulo: 'space-eyes', activar: true, hoy: '2026-10-07' })
    const sin = licenciaConModulo(con, { modulo: 'space-eyes', activar: false, hoy: '2026-10-08' })
    // Sin el campo la licencia no decidiria y mandaria la configuracion: el
    // modulo seguiria encendido. Apagar es `modulos: []`.
    expect(JSON.parse(sin).modulos).toEqual([])
    expect(JSON.parse(sin).vence).toBe('2027-06-30')
  })

  it('desactivar una licencia de antes (sin el campo) tambien lo escribe', () => {
    const sin = licenciaConModulo(vigente, { modulo: 'space-eyes', activar: false, hoy: '2026-10-08' })
    expect(JSON.parse(sin).modulos).toEqual([])
  })

  it('activar dos veces no lo repite', () => {
    const una = licenciaConModulo(vigente, { modulo: 'space-eyes', activar: true, hoy: '2026-10-07' })
    expect(licenciaConModulo(una, { modulo: 'space-eyes', activar: true, hoy: '2026-10-07' })).toBe(una)
  })

  it('un modulo que no existe se rechaza', () => {
    expect(() => licenciaConModulo(vigente, { modulo: 'spaceyes', activar: true, hoy: '2026-10-07' })).toThrow(/desconocido/)
  })
})

describe('modulosDe y la orden del panel', () => {
  it('lee lo encendido de la licencia de cada instancia en el padre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mod-'))
    mkdirSync(join(dir, 'pixeled'))
    writeFileSync(join(dir, 'pixeled', 'licencia.json'), licenciaConModulo(vigente, { modulo: 'space-eyes', activar: true, hoy: '2026-10-07' }))
    expect(modulosDe('pixeled', dir)).toEqual({ licencia: true, modulos: ['space-eyes'] })
    expect(modulosDe('sin-licencia', dir)).toEqual({ licencia: false, modulos: [] })
    // Una licencia de antes no decide: el panel no puede pintarla como «no».
    mkdirSync(join(dir, 'vieja'))
    writeFileSync(join(dir, 'vieja', 'licencia.json'), vigente)
    expect(modulosDe('vieja', dir)).toEqual({ licencia: true, modulos: null })
  })

  it('la orden que muestra el panel es exactamente la que hace el cambio', () => {
    expect(ordenPara('pixeled', 'space-eyes', true)).toBe('node apps/flota/modulo.mjs --instancia pixeled --activar space-eyes')
    expect(ordenPara('pixeled', 'space-eyes', false)).toBe('node apps/flota/modulo.mjs --instancia pixeled --desactivar space-eyes')
  })
})
