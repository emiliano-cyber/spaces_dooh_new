'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Campana {
  id: string; folio: string; nombre: string; tipoCampana: string
  estadoComercial: string; fechaInicio: string; fechaFin: string
  creadoEn: string; actualizadoEn: string
  cliente?: { nombre: string }
  _count?: { lines: number; trafficOrders: number }
}

const ESTADO_C: Record<string, { bg: string; color: string }> = {
  DRAFT:          { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
  COTIZACION:     { bg: 'rgba(108,99,255,0.2)', color: '#6c63ff' },
  CONFIRMADA:     { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
  ACTIVA:         { bg: 'rgba(184,240,0,0.15)', color: '#b8f000' },
  COMPLETADA:     { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
  CANCELADA:      { bg: 'rgba(255,95,95,0.15)', color: '#ff5f5f' },
  LISTA_FACTURAR: { bg: 'rgba(184,240,0,0.25)', color: '#b8f000' },
}

const TIPO_C: Record<string, { bg: string; color: string }> = {
  OOH:    { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' },
  DOOH:   { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  HIBRIDA:{ bg: 'rgba(184,240,0,0.12)',  color: '#b8f000' },
}

function KpiCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem 1.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.875rem', fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

function Badge({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, ...style }}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function ComercialDashboard() {
  const [tick, setTick] = useState(0)

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const { data: activas = [] } = useQuery<Campana[]>({
    queryKey: ['campanas-activas', tick],
    queryFn: () => apiFetch<{ data: Campana[] }>('/campanas?estadoComercial=ACTIVA&limit=100').then(r => r.data),
  })

  const { data: listaFacturar = [] } = useQuery<Campana[]>({
    queryKey: ['campanas-facturar', tick],
    queryFn: () => apiFetch<{ data: Campana[] }>('/campanas?estadoComercial=LISTA_FACTURAR&limit=100').then(r => r.data),
  })

  const { data: cotizacion = [] } = useQuery<Campana[]>({
    queryKey: ['campanas-cotizacion', tick],
    queryFn: () => apiFetch<{ data: Campana[] }>('/campanas?estadoComercial=COTIZACION&limit=100').then(r => r.data),
  })

  const { data: recientes = [] } = useQuery<Campana[]>({
    queryKey: ['campanas-recientes', tick],
    queryFn: () => apiFetch<{ data: Campana[] }>('/campanas?limit=10').then(r => r.data),
  })

  const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0)
  const completadasMes = recientes.filter(
    (c) => c.estadoComercial === 'COMPLETADA' && new Date(c.actualizadoEn) >= mesInicio
  ).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Dashboard Comercial</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Resumen de campañas y pipeline comercial</p>
        </div>
        <Link href="/comercial/campanas/nueva" style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem', textDecoration: 'none', display: 'inline-block' }}>
          + Nueva campaña
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <KpiCard label="Campañas activas" value={activas.length} color="#b8f000" />
        <KpiCard label="Listas para facturar" value={listaFacturar.length} color={listaFacturar.length > 0 ? '#b8f000' : undefined} sub="requieren factura" />
        <KpiCard label="En cotización" value={cotizacion.length} color="#6c63ff" />
        <KpiCard label="Completadas este mes" value={completadasMes} />
      </div>

      {/* Alertas de sitios con incidencias */}
      {activas.some((c) => c._count?.lines) && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.5rem' }}>
            ⚠ Campañas activas con sitios afectados
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Revisa el módulo de Inmuebles para incidencias abiertas que puedan afectar la publicación.
          </div>
        </div>
      )}

      {/* Pipeline reciente */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Pipeline reciente</h2>
          <Link href="/comercial/campanas" style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none' }}>Ver todo →</Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Folio', 'Nombre', 'Cliente', 'Tipo', 'Estado', 'Fechas', ''].map((h) => (
                <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recientes.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin campañas</td></tr>
            ) : recientes.map((c) => {
              const ec = ESTADO_C[c.estadoComercial] ?? ESTADO_C.DRAFT
              const tc = TIPO_C[c.tipoCampana] ?? TIPO_C.OOH
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{c.folio}</td>
                  <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</td>
                  <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{c.cliente?.nombre ?? '—'}</td>
                  <td style={{ padding: '0.625rem 1rem' }}><Badge label={c.tipoCampana} style={{ background: tc.bg, color: tc.color }} /></td>
                  <td style={{ padding: '0.625rem 1rem' }}><Badge label={c.estadoComercial} style={{ background: ec.bg, color: ec.color }} /></td>
                  <td style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(c.fechaInicio)} → {fmt(c.fechaFin)}</td>
                  <td style={{ padding: '0.625rem 1rem' }}>
                    <Link href={`/comercial/campanas/${c.id}`} style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none' }}>Ver →</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
