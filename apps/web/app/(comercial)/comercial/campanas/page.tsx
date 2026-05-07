'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Campana {
  id: string; folio: string; nombre: string; tipoCampana: string
  estadoComercial: string; fechaInicio: string; fechaFin: string
  cliente?: { nombre: string }
  _count?: { lines: number; trafficOrders: number }
}

const KANBAN_COLS: Array<{ key: string; label: string; color: string }> = [
  { key: 'DRAFT',          label: 'Borrador',         color: '#71717A' },
  { key: 'COTIZACION',     label: 'Cotización',       color: '#0A66FF' },
  { key: 'CONFIRMADA',     label: 'Confirmada',       color: '#B45309' },
  { key: 'ACTIVA',         label: 'Activa',           color: '#15803D' },
  { key: 'COMPLETADA',     label: 'Completada',       color: '#71717A' },
  { key: 'LISTA_FACTURAR', label: 'Lista facturar',   color: '#15803D' },
]

const TIPO_C: Record<string, { bg: string; color: string }> = {
  OOH:    { bg: 'rgba(10,102,255,0.15)', color: '#0A66FF' },
  DOOH:   { bg: 'rgba(251,191,36,0.15)', color: '#B45309' },
  HIBRIDA:{ bg: 'rgba(21,128,61,0.12)',  color: '#15803D' },
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function CampanasKanbanPage() {
  const router = useRouter()

  const { data: campanas = [], isLoading } = useQuery<Campana[]>({
    queryKey: ['campanas-all'],
    queryFn: () => apiFetch<{ data: Campana[] }>('/campanas?limit=500').then(r => r.data),
  })

  const byStatus = (key: string) => campanas.filter((c) => c.estadoComercial === key)

  if (isLoading) {
    return <div style={{ color: 'var(--muted)', padding: '2rem' }}>Cargando…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Pipeline de campañas</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{campanas.length} campañas en total</p>
        </div>
        <button
          onClick={() => router.push('/comercial/campanas/nueva')}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem' }}
        >
          + Nueva campaña
        </button>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'flex-start' }}>
        {KANBAN_COLS.map(({ key, label, color }) => {
          const col = byStatus(key)
          return (
            <div key={key} style={{ width: 240, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {/* Column header */}
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color }}>{label}</span>
                <span style={{ background: `${color}22`, color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{col.length}</span>
              </div>

              {/* Cards */}
              <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 80 }}>
                {col.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem 0.5rem' }}>Sin campañas</div>
                ) : col.map((c) => {
                  const tc = TIPO_C[c.tipoCampana] ?? TIPO_C.OOH
                  return (
                    <Link
                      key={c.id}
                      href={`/comercial/campanas/${c.id}`}
                      style={{ display: 'block', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--muted)' }}>{c.folio}</span>
                        {key === 'LISTA_FACTURAR' && <span style={{ fontSize: '0.875rem' }}>🔒</span>}
                      </div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.cliente?.nombre ?? '—'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: tc.bg, color: tc.color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600 }}>
                          {c.tipoCampana}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                          {fmt(c.fechaInicio)} – {fmt(c.fechaFin)}
                        </span>
                      </div>
                      {(c._count?.lines ?? 0) > 0 && (
                        <div style={{ marginTop: '0.375rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                          {c._count!.lines} sitio{c._count!.lines !== 1 ? 's' : ''}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
