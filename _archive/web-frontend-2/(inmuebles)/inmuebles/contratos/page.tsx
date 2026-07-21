'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Contrato {
  id: string
  fechaInicio: string
  fechaFin: string
  montoRenta: number
  periodicidad: string
  moneda: string
  estatus: string
  autoRenovable: boolean
  diasRestantes: number
  sitio: { id: string; nombre: string; claveInterna: string }
  arrendador: { nombre: string }
}

const ESTATUS_BADGE: Record<string, { bg: string; color: string }> = {
  VIGENTE:  { bg: 'rgba(21,128,61,0.12)', color: '#15803D' },
  VENCIDO:  { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C' },
  CANCELADO:{ bg: 'rgba(90,90,114,0.15)', color: '#71717A' },
}

const inp: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px',
  color: 'var(--fg)', fontSize: '0.8375rem', padding: '0.45rem 0.75rem', outline: 'none', height: 34,
}

function fmtMXN(v: number, moneda: string) {
  return `$${v.toLocaleString('es-MX')} ${moneda}`
}

export default function ContratosPage() {
  const [umbral, setUmbral] = useState('90')
  const [estatusFilter, setEstatusFilter] = useState('')

  const { data: vencimientos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ['contratos-vencimientos', umbral],
    queryFn: () => apiFetch(`/contratos/vencimientos?diasUmbral=${umbral}`),
  })

  const filtered = estatusFilter
    ? vencimientos.filter((c) => c.estatus === estatusFilter)
    : vencimientos

  const criticos = vencimientos.filter((c) => c.diasRestantes <= 7 && c.estatus === 'VIGENTE').length
  const proximos = vencimientos.filter((c) => c.diasRestantes <= 30 && c.estatus === 'VIGENTE').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Contratos de arrendamiento</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            {criticos > 0 && <span style={{ color: '#B91C1C', fontWeight: 600 }}>{criticos} crítico{criticos !== 1 ? 's' : ''} · </span>}
            {proximos} por vencer en 30 días
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total en periodo', value: vencimientos.length, color: undefined },
          { label: 'Críticos (≤7 días)', value: criticos, color: criticos > 0 ? '#B91C1C' : undefined },
          { label: 'Próximos (≤30 días)', value: proximos, color: proximos > 0 ? '#B45309' : undefined },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <select style={inp} value={umbral} onChange={(e) => setUmbral(e.target.value)}>
          <option value="30">Próximos 30 días</option>
          <option value="60">Próximos 60 días</option>
          <option value="90">Próximos 90 días</option>
          <option value="180">Próximos 180 días</option>
          <option value="365">Próximos 365 días</option>
        </select>
        <select style={inp} value={estatusFilter} onChange={(e) => setEstatusFilter(e.target.value)}>
          <option value="">Todos los estatus</option>
          <option value="VIGENTE">Vigente</option>
          <option value="VENCIDO">Vencido</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {isLoading ? 'Cargando…' : `${filtered.length} contrato${filtered.length !== 1 ? 's' : ''}`}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Sitio', 'Arrendador', 'Monto', 'Vigencia', 'Días rest.', 'Estatus'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !isLoading ? (
                <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin contratos en este periodo</td></tr>
              ) : filtered.map((c) => {
                const bs = ESTATUS_BADGE[c.estatus] ?? ESTATUS_BADGE.VIGENTE
                const daysColor = c.diasRestantes <= 7 ? '#B91C1C' : c.diasRestantes <= 30 ? '#B45309' : 'var(--fg)'
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Link href={`/inmuebles/sitios/${c.sitio.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--fg)' }}>{c.sitio.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{c.sitio.claveInterna}</div>
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>{c.arrendador.nombre}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      {fmtMXN(c.montoRenta, c.moneda)}<br />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.periodicidad}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(c.fechaInicio).toLocaleDateString('es-MX')} –<br />
                      {new Date(c.fechaFin).toLocaleDateString('es-MX')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 700, color: daysColor, lineHeight: 1 }}>{c.diasRestantes}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>días</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ ...bs, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>{c.estatus}</span>
                      {c.autoRenovable && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#15803D' }}>↺</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
