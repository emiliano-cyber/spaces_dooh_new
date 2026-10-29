import { describe, it, expect, vi } from 'vitest'
import { AppError } from './errores'
import { TOPE_MESES_REPORTE, MSJ_TOPE_MESES_REPORTE, excedeTopeDeMeses } from '@/lib/data/reportes'
import { traducirError } from '@/lib/i18n/errores-servidor'

// ============================================================================
//  D6 · decisión del dueño (29/10/2026): TOPE DE 24 MESES por consulta.
// ----------------------------------------------------------------------------
//  El reporte construye una casilla por pantalla y por periodo. Con 500
//  pantallas y cinco años de historia son 30 000, y quien lo pide se queda
//  mirando una pantalla cargando. Hasta hoy el sistema lo permitía sin avisar.
//  El dueño eligió 24 meses (la ficha recomendaba 36): se rechaza con una frase
//  clara ANTES de tocar la base, y la pantalla no deja pedirlo
//  (`components/demo/reportes/consulta.tope-meses.test.ts`).
//
//  Cómo se cuenta: `hasta` tiene que caer ANTES de `desde + 24 meses`. O sea,
//  del 1/ene/2024 al 31/dic/2025 son 24 meses justos y entran; un día más, no.
// ============================================================================

const lecturas: unknown[] = []
vi.mock('./reportes-repo', () => ({
  datosRentabilidad: vi.fn(async (rango: unknown) => {
    lecturas.push(rango)
    return { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [], costosOt: {} }
  }),
}))

const { validarConsultaRentabilidad, rentabilidadCtrl } = await import('./reportes-controller')

const BASE = { dimension: 'sitio', granularidad: 'mes' }

function error(fn: () => unknown): AppError | null {
  try {
    fn()
    return null
  } catch (e) {
    return e instanceof AppError ? e : null
  }
}

describe('D6 · el reporte de rentabilidad no abarca más de 24 meses', () => {
  it('el tope es 24, como decidió el dueño', () => {
    expect(TOPE_MESES_REPORTE).toBe(24)
  })

  it('24 meses JUSTOS entran', () => {
    expect(() => validarConsultaRentabilidad({ ...BASE, desde: '2024-01-01', hasta: '2025-12-31' })).not.toThrow()
  })

  it('NEGATIVO · un día más → 400 con la frase en español, y la base NO se lee', async () => {
    const e = error(() => validarConsultaRentabilidad({ ...BASE, desde: '2024-01-01', hasta: '2026-01-01' }))
    expect(e?.status).toBe(400)
    expect(e?.message).toBe(MSJ_TOPE_MESES_REPORTE)
    lecturas.length = 0
    await rentabilidadCtrl({ ...BASE, desde: '2021-01-01', hasta: '2026-12-31' }).catch(() => {})
    expect(lecturas).toEqual([])
  })

  it('NEGATIVO · cinco años, el caso de la ficha', () => {
    expect(error(() => validarConsultaRentabilidad({ ...BASE, desde: '2021-01-01', hasta: '2025-12-31' }))?.status).toBe(400)
  })

  it('el 29 de febrero no se come un día: 2024-02-29 → 2026-02-28 entra, 2026-03-01 no', () => {
    expect(excedeTopeDeMeses('2024-02-29', '2026-02-28')).toBe(false)
    expect(excedeTopeDeMeses('2024-02-29', '2026-03-01')).toBe(true)
  })

  it('a mitad de mes: 2024-03-15 → 2026-03-14 entra, 2026-03-15 no', () => {
    expect(excedeTopeDeMeses('2024-03-15', '2026-03-14')).toBe(false)
    expect(excedeTopeDeMeses('2024-03-15', '2026-03-15')).toBe(true)
  })

  it('acepta fechas sin cero a la izquierda, igual que el resto del rango', () => {
    expect(excedeTopeDeMeses('2024-1-1', '2025-12-31')).toBe(false)
    expect(excedeTopeDeMeses('2024-1-1', '2026-1-1')).toBe(true)
  })

  it('la frase está traducida al inglés (I18N-05)', () => {
    const en = traducirError(MSJ_TOPE_MESES_REPORTE, 'en')
    expect(en).not.toBe(MSJ_TOPE_MESES_REPORTE)
    expect(en).toMatch(/24 months/)
  })
})
