import { describe, it, expect } from 'vitest'
import { motivoInvalido, type FiltrosReporte } from './consulta'
import { debePedir } from './estado'
import { MSJ_TOPE_MESES_REPORTE } from '@/lib/data/reportes'

// ============================================================================
//  D6 (29/10/2026) · la PANTALLA de Reportes no deja pedir más de 24 meses.
// ----------------------------------------------------------------------------
//  El servidor es la autoridad y rechaza con un 400
//  (`lib/server/reportes-controller.tope-meses.test.ts`). Aquí se avisa ANTES,
//  con la MISMA regla (`excedeTopeDeMeses` de `lib/data/reportes.ts`) y la
//  MISMA frase: `motivoInvalido` la pinta junto a los filtros y `debePedir`
//  deja de mandar la consulta. Dos reglas divergen, y divergir aquí sería
//  rechazar en la pantalla un rango que el servidor acepta, o al revés.
// ============================================================================

const base: FiltrosReporte = { dimension: 'sitio', granularidad: 'mes', desde: '2024-01-01', hasta: '2025-12-31' }

describe('D6 · la pantalla avisa y no pide más de 24 meses', () => {
  it('24 meses justos: sin aviso, y se pide', () => {
    expect(motivoInvalido(base)).toBeNull()
    expect(debePedir(base)).toBe(true)
  })

  it('NEGATIVO · un día más: la frase del servidor, y NO se pide', () => {
    const f = { ...base, hasta: '2026-01-01' }
    expect(motivoInvalido(f)).toBe(MSJ_TOPE_MESES_REPORTE)
    expect(debePedir(f)).toBe(false)
  })

  it('el rango invertido sigue diciendo lo suyo, no el tope', () => {
    expect(motivoInvalido({ ...base, desde: '2026-01-01', hasta: '2020-01-01' })).toMatch(/anterior a la de inicio/)
  })
})
