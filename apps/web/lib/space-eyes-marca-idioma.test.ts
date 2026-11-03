import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { lineasMarca } from './space-eyes-marca'
import { renglonesMarca } from './space-eyes-marca-editor'

// ============================================================================
//  LA MARCA DE LA FOTO NO SE TRADUCE: es la evidencia.
// ----------------------------------------------------------------------------
//  Nombre · fecha · hora que se graban en la foto (al descargarla y en la vista
//  previa de «Ajustar texto») van SIEMPRE en es-MX, sea cual sea el idioma de
//  la pantalla: una foto entregada a un cliente como prueba de exhibicion no
//  puede cambiar de formato segun quien la descargo. El validador del lote del
//  ingles (M6/M7, 2026-11-02) cambio 'es-MX' por 'en-US' en los dos modulos y
//  no cayo ninguna prueba; estas caen.
// ============================================================================

const TOMADA = '2026-11-02T17:55:00.000Z'
const d = new Date(TOMADA)
const FECHA = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
const HORA = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

describe('la marca de la foto va en es-MX, en los dos idiomas', () => {
  it('lineasMarca (lo que se graba al descargar)', () => {
    expect(lineasMarca({ taken_at: TOMADA, device_name: 'X' })).toEqual(['X', FECHA, HORA])
    expect(FECHA).toMatch(/^\d{2}\/\d{2}\/\d{4}$/) // dia/mes/año, no mes/dia
    expect(HORA).toMatch(/[ap]\.\s?m\./) // «a. m.» de es-MX, no «AM»
  })

  it('renglonesMarca (la vista previa de «Ajustar texto»)', () => {
    expect(renglonesMarca('X', TOMADA)).toEqual(['X', FECHA, HORA])
  })

  it('ninguno de los dos modulos sabe de idiomas', () => {
    for (const archivo of ['space-eyes-marca.ts', 'space-eyes-marca-editor.ts']) {
      const fuente = readFileSync(path.join(__dirname, archivo), 'utf8')
      expect(fuente).not.toMatch(/en-US|i18n|idioma/)
      expect(fuente.match(/'es-MX'/g)?.length).toBe(2)
    }
  })
})
