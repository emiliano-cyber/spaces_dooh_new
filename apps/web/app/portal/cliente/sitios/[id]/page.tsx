'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { portalFetch } from '@/lib/portal-cliente-api'

interface Sitio { id: string; nombre: string; claveInterna: string; ciudad: string; estado: string; direccion: string }
interface OTResumen {
  id: string; folio: string; tipo: string; descripcion: string; estatus: string
  prioridad: string; fechaProgramada?: string; fechaCompletada?: string; creadoEn: string
  totalComentarios: number
}

const ESTATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PENDIENTE:    { label: 'Pendiente',    color: '#b45309', bg: 'rgba(245,158,11,0.1)' },
  ASIGNADA:     { label: 'Asignada',     color: '#1d4ed8', bg: 'rgba(59,130,246,0.1)' },
  EN_PROCESO:   { label: 'En proceso',   color: '#4338ca', bg: 'rgba(99,102,241,0.1)' },
  BLOQUEADA:    { label: 'Bloqueada',    color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  EN_REVISION:  { label: 'En revisión',  color: '#c2410c', bg: 'rgba(234,88,12,0.1)' },
  COMPLETADA:   { label: 'Completada',   color: '#15803d', bg: 'rgba(22,163,74,0.1)' },
  RECHAZADA:    { label: 'Rechazada',    color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  CANCELADA:    { label: 'Cancelada',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortalSitioDetallePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [data, setData] = useState<{ sitio: Sitio; ots: OTResumen[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    portalFetch<{ sitio: Sitio; ots: OTResumen[] }>(`/portal/cliente/sitios/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '4rem' }}>Cargando…</div>
  if (error) return <div style={{ color: '#dc2626', textAlign: 'center', paddingTop: '4rem' }}>{error}</div>
  if (!data) return null

  const { sitio, ots } = data

  return (
    <div>
      <button onClick={() => router.push('/portal/cliente/sitios')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '1.25rem' }}>
        ← Volver a mis sitios
      </button>

      {/* Sitio header */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(10,102,255,0.08)', color: '#0A66FF', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.625rem' }}>
            {sitio.claveInterna}
          </span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>{sitio.nombre}</h1>
        </div>
        <div style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '0.375rem' }}>
          {sitio.direccion} · {sitio.ciudad}, {sitio.estado}
        </div>
      </div>

      {/* OT list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#1e293b' }}>Reportes de servicio</h2>
        <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{ots.length} reporte{ots.length !== 1 ? 's' : ''}</span>
      </div>

      {ots.length === 0 ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          No hay reportes de servicio para este sitio aún.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ots.map((ot) => {
            const st = ESTATUS_CFG[ot.estatus] ?? { label: ot.estatus, color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
            return (
              <button
                key={ot.id}
                onClick={() => router.push(`/portal/cliente/ots/${ot.id}`)}
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', padding: '1rem 1.25rem', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0A66FF'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(10,102,255,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{ot.folio}</span>
                      <span style={{ background: st.bg, color: st.color, borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                        {st.label}
                      </span>
                      {ot.totalComentarios > 0 && (
                        <span style={{ background: 'rgba(99,102,241,0.1)', color: '#4338ca', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                          💬 {ot.totalComentarios}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#1e293b' }}>{ot.descripcion}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {ot.tipo.split(',').join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Creado {fmt(ot.creadoEn)}</div>
                    {ot.fechaCompletada && (
                      <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.2rem' }}>✓ Atendido {fmt(ot.fechaCompletada)}</div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
