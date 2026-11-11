import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Historial por PANTALLA (`get_metrics`) frente a reproducciones por CAMPAÑA
//  (`get_stats`).
//
//  La diferencia que importa: las métricas de una pantalla incluyen todo lo que
//  sonó en ella, de cualquier campaña. Sirven para ver que la pantalla estuvo
//  reproduciendo, pero NO prueban que salió ESTA campaña. Por eso, a diferencia
//  de `get_stats`, una consulta por pantalla con datos NUNCA enciende la
//  evidencia digital (`reporte_publicacion`) ni mueve la campaña a facturar.
// ============================================================================

const sqls: { sql: string; params: unknown[] }[] = []
vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params: unknown[]) => {
    sqls.push({ sql, params })
    if (sql.includes('insert into doohmain_consultas_play')) {
      return [{
        id: 'x', tipo: params[1], campana_id: params[2], auths: null, pantallas: params[3],
        desde: params[4], hasta: params[5], payload: JSON.parse(String(params[6])), vacio: params[7],
        error: params[8], consultado_en: new Date('2026-10-29T12:00:00Z'),
      }]
    }
    if (sql.includes('doohmain_remote_lists')) return [{ screen_name: 'PANT-1' }, { screen_name: 'PANT-2' }]
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'tenant-1') }))

const metricas = vi.fn()
vi.mock('./doohmain', () => ({
  consultarStats: vi.fn(),
  consultarMetrics: (...a: unknown[]) => metricas(...a),
}))

const { consultarYGuardarMetricas, pantallasDeCampana } = await import('./playlogs-repo')

beforeEach(() => {
  sqls.length = 0
  metricas.mockReset()
})

describe('consultarYGuardarMetricas', () => {
  it('guarda la respuesta como tipo `metrics` con las pantallas consultadas', async () => {
    metricas.mockResolvedValue({ ok: true, payload: { metrics: [] } })
    const c = await consultarYGuardarMetricas({
      campanaId: 'c1', pantallas: ['PANT-1'], desde: '2026-10-01', hasta: '2026-10-28',
    })
    expect(metricas).toHaveBeenCalledWith(['PANT-1'], '2026-10-01', '2026-10-28')
    expect(c).toMatchObject({ tipo: 'metrics', pantallas: ['PANT-1'], vacio: true })
  })

  it('con datos, NO enciende la evidencia digital de la campaña', async () => {
    metricas.mockResolvedValue({ ok: true, payload: { metrics: [{ algo: 1 }] } })
    const c = await consultarYGuardarMetricas({
      campanaId: 'c1', pantallas: ['PANT-1'], desde: '2026-10-01', hasta: '2026-10-28',
    })
    expect(c.vacio).toBe(false)
    expect(sqls.some((s) => /update\s+campanas/i.test(s.sql))).toBe(false)
  })

  it('un error de DOOHmain se guarda como error, no como «sin datos»', async () => {
    metricas.mockResolvedValue({ ok: false, payload: {}, error: 'DOOHmain no respondió' })
    const c = await consultarYGuardarMetricas({
      campanaId: 'c1', pantallas: ['PANT-1'], desde: '2026-10-01', hasta: '2026-10-28',
    })
    expect(c.error).toBe('DOOHmain no respondió')
  })
})

describe('pantallasDeCampana', () => {
  it('filtra por la organización a mano: las tablas del SDK no tienen RLS', async () => {
    const p = await pantallasDeCampana('c1')
    expect(p).toEqual(['PANT-1', 'PANT-2'])
    const s = sqls.find((x) => x.sql.includes('doohmain_remote_lists'))!
    expect(s.sql).toMatch(/c\.tenant_id\s*=\s*\$2/)
    expect(s.params).toEqual(['c1', 'tenant-1'])
  })
})
