'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface AlertaItem {
  id: string
  diasRestantes: number
  nivel: 'critico' | 'alerta' | 'aviso'
  sitio?: { nombre: string; claveInterna: string }
  arrendador?: { nombre: string }
  tipo?: string
  folio?: string
  fechaFin?: string
  fechaVencimiento?: string
  periodo?: string
}

interface AlertasRes {
  contratos: AlertaItem[]
  licencias: AlertaItem[]
  pagos: AlertaItem[]
}

const NIVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critico: { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C', label: 'Crítico' },
  alerta: { bg: 'rgba(251,191,36,0.15)', color: '#B45309', label: 'Alerta' },
  aviso: { bg: 'rgba(21,128,61,0.12)', color: '#15803D', label: 'Aviso' },
}

function NivelBadge({ nivel }: { nivel: string }) {
  const style = NIVEL_STYLE[nivel] ?? NIVEL_STYLE.aviso
  return (
    <span style={{ ...style, padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
      {style.label}
    </span>
  )
}

function AlertaRow({ item, extra }: { item: AlertaItem; extra?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
      <NivelBadge nivel={item.nivel} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.2rem' }}>{item.sitio?.nombre ?? '—'}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          {item.sitio?.claveInterna}{extra ? ` · ${extra}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: item.nivel === 'critico' ? '#B91C1C' : item.nivel === 'alerta' ? '#B45309' : '#15803D', lineHeight: 1 }}>
          {item.diasRestantes}d
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>restantes</div>
      </div>
    </div>
  )
}

function Section({ title, items, extra }: { title: string; items: AlertaItem[]; extra?: (item: AlertaItem) => string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{title}</h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{items.length} registro{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '1.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin alertas en este periodo</div>
      ) : (
        items.map((item) => <AlertaRow key={item.id} item={item} extra={extra?.(item)} />)
      )}
    </div>
  )
}

export default function AlertasPage() {
  const [nivelFilter, setNivelFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['alertas-vencimientos'],
    queryFn: () => apiFetch<AlertasRes>('/alertas/vencimientos?diasUmbral=30'),
  })

  const filter = (items: AlertaItem[]) =>
    nivelFilter ? items.filter((i) => i.nivel === nivelFilter) : items

  if (isLoading) return <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem' }}>Cargando…</div>

  const contratos = filter(data?.contratos ?? [])
  const licencias = filter(data?.licencias ?? [])
  const pagos = filter(data?.pagos ?? [])
  const total = contratos.length + licencias.length + pagos.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Alertas de vencimiento</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{total} alerta{total !== 1 ? 's' : ''} en los próximos 30 días</p>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {[['', 'Todos'], ['critico', 'Crítico'], ['alerta', 'Alerta'], ['aviso', 'Aviso']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setNivelFilter(val)}
              style={{
                background: nivelFilter === val ? 'var(--bg-hover)' : 'var(--bg-surface)',
                border: `1px solid ${nivelFilter === val ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '7px',
                color: nivelFilter === val ? 'var(--fg)' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: nivelFilter === val ? 600 : 400,
                padding: '0.4rem 0.875rem',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <Section
        title="Contratos por vencer"
        items={contratos}
        extra={(c) => c.arrendador?.nombre ?? ''}
      />
      <Section
        title="Licencias por vencer"
        items={licencias}
        extra={(l) => (l.tipo ?? '') + (l.folio ? ` · ${l.folio}` : '')}
      />
      <Section
        title="Pagos pendientes"
        items={pagos}
        extra={(p) => p.periodo ?? ''}
      />
    </div>
  )
}
