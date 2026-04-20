'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface AuditEntry {
  id: string
  accion: string
  entidadTipo: string
  entidadId: string
  cambiosJson: Record<string, unknown>
  timestamp: string
  usuario: { nombre?: string; email: string }
}
interface AuditResponse { data: AuditEntry[]; meta: { total: number; page: number; pages: number } }
interface User { id: string; nombre: string; email: string }
interface Role { id: string; nombre: string }

function fmt(d: string) {
  return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DiffPanel({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const changes = entry.cambiosJson ?? {}
  const keys = Object.keys(changes)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{entry.accion}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{entry.entidadTipo} · {entry.entidadId.slice(0, 12)}…</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>✕</button>
        </div>
        <div style={{ padding: '1rem 1.5rem', flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {entry.usuario?.email ?? '—'} · {fmt(entry.timestamp)}
          </div>
          {keys.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Sin datos de cambio</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {keys.map((k) => {
                const v = changes[k]
                return (
                  <div key={k} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.375rem 0.625rem', background: 'rgba(90,90,114,0.1)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>{k}</div>
                    <div style={{ padding: '0.5rem 0.625rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--fg)', wordBreak: 'break-all' }}>
                      {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [entidadTipo, setEntidadTipo] = useState('')
  const [userId, setUserId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [selected, setSelected] = useState<AuditEntry | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: '50' })
  if (entidadTipo) params.set('entidadTipo', entidadTipo)
  if (userId) params.set('userId', userId)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)

  const { data } = useQuery<AuditResponse>({
    queryKey: ['audit-log', page, entidadTipo, userId, desde, hasta],
    queryFn: () => apiFetch(`/admin/audit-log?${params}`),
  })
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['admin-users'], queryFn: () => apiFetch('/admin/users') })

  const entries = data?.data ?? []
  const meta = data?.meta ?? { total: 0, page: 1, pages: 1 }

  const ENTITY_TYPES = [...new Set(entries.map((e) => e.entidadTipo))].sort()

  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--fg)', fontSize: '0.8rem', padding: '0.4rem 0.625rem', outline: 'none' }

  function resetFilters() { setEntidadTipo(''); setUserId(''); setDesde(''); setHasta(''); setPage(1) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Audit Log</h1>
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{meta.total.toLocaleString()} entradas</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={entidadTipo} onChange={(e) => { setEntidadTipo(e.target.value); setPage(1) }} style={inp}>
          <option value="">Todas las entidades</option>
          {['Campana','OrdenTrabajo','TrafficOrder','Sitio','Incidencia','Creatividad','CampaignLine'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }} style={inp}>
          <option value="">Todos los usuarios</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>)}
        </select>
        <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1) }} style={inp} title="Desde" />
        <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1) }} style={inp} title="Hasta" />
        {(entidadTipo || userId || desde || hasta) && (
          <button onClick={resetFilters} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Limpiar filtros</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Timestamp', 'Usuario', 'Acción', 'Entidad', 'ID'].map((h) => (
                <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin registros</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} onClick={() => setSelected(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(e.timestamp)}</td>
                <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem' }}>{e.usuario?.email ?? e.usuario?.nombre ?? '—'}</td>
                <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{e.accion}</td>
                <td style={{ padding: '0.625rem 1rem' }}>
                  <span style={{ background: 'rgba(90,90,114,0.15)', color: 'var(--muted)', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{e.entidadTipo}</span>
                </td>
                <td style={{ padding: '0.625rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--muted)' }}>{e.entidadId.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem', padding: '0.375rem 0.875rem', opacity: page === 1 ? 0.5 : 1 }}>← Anterior</button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Página {page} de {meta.pages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} disabled={page === meta.pages} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: page === meta.pages ? 'not-allowed' : 'pointer', fontSize: '0.875rem', padding: '0.375rem 0.875rem', opacity: page === meta.pages ? 0.5 : 1 }}>Siguiente →</button>
        </div>
      )}

      {/* Detail panel */}
      {selected && <DiffPanel entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
