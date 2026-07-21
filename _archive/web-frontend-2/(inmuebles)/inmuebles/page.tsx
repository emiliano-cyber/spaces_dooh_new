'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Sitio {
  id: string
  nombre: string
  claveInterna: string
  estatusComercial: string
  _count?: { incidencias: number }
}

interface SitioListRes { data: Sitio[]; meta: { total: number } }

interface AlertaItem { id: string; diasRestantes: number; nivel: string; sitio?: { nombre: string; claveInterna: string } }
interface AlertasRes { contratos: AlertaItem[]; licencias: AlertaItem[]; pagos: AlertaItem[] }

function KpiCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem 1.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.875rem', fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

const NIVEL_BADGE: Record<string, { bg: string; color: string }> = {
  critico: { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C' },
  alerta: { bg: 'rgba(251,191,36,0.15)', color: '#B45309' },
  aviso: { bg: 'rgba(21,128,61,0.12)', color: '#15803D' },
}

export default function InmueblesDashboard() {
  const { data: sitiosData, isLoading: loadingSitios } = useQuery({
    queryKey: ['sitios-all'],
    queryFn: () => apiFetch<SitioListRes>('/sitios?limit=1000'),
  })

  const { data: alertasData, isLoading: loadingAlertas } = useQuery({
    queryKey: ['alertas-vencimientos'],
    queryFn: () => apiFetch<AlertasRes>('/alertas/vencimientos?diasUmbral=30'),
  })

  const sitios = sitiosData?.data ?? []
  const totalActivos = sitios.filter((s) => s.estatusComercial !== 'BAJA').length
  const disponibles = sitios.filter((s) => s.estatusComercial === 'DISPONIBLE').length
  const incidenciasAbiertas = sitios.reduce((sum, s) => sum + (s._count?.incidencias ?? 0), 0)
  const alertasProximas = (alertasData?.contratos.length ?? 0) + (alertasData?.licencias.length ?? 0)

  const criticos = [
    ...(alertasData?.contratos.filter((c) => c.nivel === 'critico').map((c) => ({ ...c, tipo: 'Contrato' })) ?? []),
    ...(alertasData?.licencias.filter((l) => l.nivel === 'critico').map((l) => ({ ...l, tipo: 'Licencia' })) ?? []),
  ]

  if (loadingSitios || loadingAlertas) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem' }}>Cargando…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Dashboard</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Resumen del módulo Inmuebles</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <KpiCard label="Sitios activos" value={totalActivos} />
        <KpiCard label="Disponibles" value={disponibles} color="#15803D" />
        <KpiCard label="Incidencias abiertas" value={incidenciasAbiertas} color={incidenciasAbiertas > 0 ? '#B91C1C' : undefined} />
        <KpiCard label="Alertas próximas 30d" value={alertasProximas} color={alertasProximas > 0 ? '#B45309' : undefined} />
      </div>

      {/* Alertas críticas */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Alertas críticas (&lt;7 días)</h2>
        </div>
        {criticos.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin alertas críticas 🎉</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Tipo', 'Sitio', 'Días restantes', 'Nivel'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criticos.map((item) => {
                const badge = NIVEL_BADGE[item.nivel] ?? NIVEL_BADGE.aviso
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.875rem 1.5rem', fontSize: '0.875rem' }}>{(item as any).tipo}</td>
                    <td style={{ padding: '0.875rem 1.5rem', fontSize: '0.875rem' }}>
                      <div>{item.sitio?.nombre ?? '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.sitio?.claveInterna}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#B91C1C' }}>{item.diasRestantes}d</td>
                    <td style={{ padding: '0.875rem 1.5rem' }}>
                      <span style={{ ...badge, padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {item.nivel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
