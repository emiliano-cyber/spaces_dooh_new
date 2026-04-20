'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

interface TrafficOrder {
  id: string
  folio: string
  estadoTecnico: string
  referenciaExterna: string | null
  creadoEn: string
  actualizadoEn: string
  campana: {
    id: string
    folio: string
    nombre: string
    cliente: { nombre: string }
  }
  pantalla: {
    id: string
    nombre: string
    ciudad: string
    tipo: string
  } | null
}

function hasPermission(user: any, perm: string): boolean {
  return (
    user?.rol === 'owner' ||
    user?.rol === 'admin' ||
    (user?.permisos as string[])?.includes('*') ||
    (user?.permisos as string[])?.includes(perm)
  )
}

const ESTADO_META: Record<string, { label: string; color: string; bg: string; order: number }> = {
  ERROR:          { label: 'Error',          color: '#ff4b4b', bg: 'rgba(255,75,75,0.12)',   order: 0 },
  EN_PUBLICACION: { label: 'En publicación', color: '#b8f000', bg: 'rgba(184,240,0,0.1)',    order: 1 },
  PENDIENTE:      { label: 'Pendiente',      color: '#9090aa', bg: 'rgba(90,90,114,0.12)',   order: 2 },
  PAUSADA:        { label: 'Pausada',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  order: 3 },
  FINALIZADA:     { label: 'Finalizada',     color: '#5a5a72', bg: 'rgba(90,90,114,0.08)',   order: 4 },
  CANCELADA:      { label: 'Cancelada',      color: '#5a5a72', bg: 'rgba(90,90,114,0.08)',   order: 5 },
}

const TRANSITIONS: Record<string, { label: string; to: string }[]> = {
  PENDIENTE:      [{ label: 'Publicar', to: 'EN_PUBLICACION' }],
  EN_PUBLICACION: [{ label: 'Pausar', to: 'PAUSADA' }, { label: 'Finalizar', to: 'FINALIZADA' }],
  PAUSADA:        [{ label: 'Reanudar', to: 'EN_PUBLICACION' }, { label: 'Finalizar', to: 'FINALIZADA' }],
  ERROR:          [{ label: 'Reintentar', to: 'EN_PUBLICACION' }, { label: 'Cancelar', to: 'CANCELADA' }],
  FINALIZADA:     [],
  CANCELADA:      [],
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DigitalTraficoPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (authLoading) return
    if (!user || !hasPermission(user, 'traffic:read')) router.replace('/auth/login')
  }, [user, authLoading, router])

  const { data: tos = [], isLoading } = useQuery<TrafficOrder[]>({
    queryKey: ['traffic-orders'],
    queryFn: () => apiFetch('/traffic-orders'),
    refetchInterval: 30_000,
    enabled: !!user,
  })

  async function transition(id: string, to: string) {
    await apiFetch(`/traffic-orders/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estadoTecnico: to }),
    })
    qc.invalidateQueries({ queryKey: ['traffic-orders'] })
  }

  if (authLoading || !user) return null
  if (isLoading) return <div style={{ color: 'var(--muted)', padding: '2rem' }}>Cargando…</div>

  const enPublicacion = tos.filter((t) => t.estadoTecnico === 'EN_PUBLICACION').length
  const conError      = tos.filter((t) => t.estadoTecnico === 'ERROR').length
  const hoy           = new Date().toDateString()
  const finalizadasHoy = tos.filter(
    (t) => t.estadoTecnico === 'FINALIZADA' && new Date(t.actualizadoEn).toDateString() === hoy,
  ).length
  const campanasDOOH = new Set(
    tos
      .filter((t) => t.estadoTecnico === 'EN_PUBLICACION')
      .map((t) => t.campana.id),
  ).size

  const KPIS = [
    { label: 'En publicación',     value: enPublicacion,  color: '#b8f000', bg: 'rgba(184,240,0,0.08)' },
    { label: 'Con error',          value: conError,       color: '#ff4b4b', bg: 'rgba(255,75,75,0.08)' },
    { label: 'Finalizadas hoy',    value: finalizadasHoy, color: '#9090aa', bg: 'transparent' },
    { label: 'Campañas DOOH activas', value: campanasDOOH, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  ]

  // Group TOs by estado, sorted by order
  const SHOW_STATES = ['ERROR', 'EN_PUBLICACION', 'PENDIENTE', 'PAUSADA', 'FINALIZADA', 'CANCELADA']
  const grouped = SHOW_STATES
    .map((estado) => ({
      estado,
      meta: ESTADO_META[estado],
      items: tos.filter((t) => t.estadoTecnico === estado),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Tráfico Digital</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: 0 }}>
          {tos.length} traffic orders · actualiza cada 30s
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {KPIS.map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Grouped TOs */}
      {grouped.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          Sin traffic orders registradas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {grouped.map(({ estado, meta, items }) => (
            <div key={estado}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
                <span style={{ background: meta.bg, color: meta.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{items.length} TO{items.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map((to) => {
                  const transitions = TRANSITIONS[to.estadoTecnico] ?? []
                  return (
                    <div key={to.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${estado === 'ERROR' ? 'rgba(255,75,75,0.3)' : 'var(--border)'}`, borderRadius: '8px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      {/* Animated indicator */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: meta.color,
                        animation: estado === 'EN_PUBLICACION' ? 'to-pulse 2s ease-in-out infinite' : 'none',
                      }} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)' }}>{to.folio}</span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' }}>
                            {to.campana.nombre}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {to.pantalla && (
                            <span>{to.pantalla.nombre} · {to.pantalla.ciudad}</span>
                          )}
                          <span>{to.campana.cliente.nombre}</span>
                          <span>{fmt(to.actualizadoEn)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {transitions.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                          {transitions.map(({ label, to: nextEstado }) => (
                            <button
                              key={nextEstado}
                              onClick={() => transition(to.id, nextEstado)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.625rem',
                                transition: 'all 0.15s',
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes to-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
