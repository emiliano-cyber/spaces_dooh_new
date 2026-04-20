'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import type { ReadinessStatus } from '@spaces-dooh/types'

interface Props {
  campanaId: string
  estadoComercial: string
}

const TENANT_SLUG =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'test-tenant')
    : 'test-tenant'
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  // Access same in-memory token via a hidden DOM marker set by api-client
  return (window as any).__spacesAccessToken ?? null
}

export default function ReadinessPanel({ campanaId, estadoComercial }: Props) {
  const qc = useQueryClient()
  const pollActive = ['ACTIVA', 'COMPLETADA', 'CONFIRMADA'].includes(estadoComercial)

  const { data: readiness, isLoading } = useQuery<ReadinessStatus>({
    queryKey: ['readiness', campanaId],
    queryFn: () => apiFetch(`/campanas/${campanaId}/readiness`),
    refetchInterval: pollActive ? 30_000 : false,
  })

  const ocInputRef = useRef<HTMLInputElement>(null)
  const reporteInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<'oc' | 'reporte' | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function uploadFile(endpoint: string, file: File, label: 'oc' | 'reporte') {
    setUploading(label)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const token = (window as any).__spacesAccessToken
      const res = await fetch(`${BASE_URL}/campanas/${campanaId}/readiness/${endpoint}`, {
        method: 'POST',
        headers: {
          'x-tenant-slug': TENANT_SLUG,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      qc.invalidateQueries({ queryKey: ['readiness', campanaId] })
      qc.invalidateQueries({ queryKey: ['campana', campanaId] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir archivo')
    } finally {
      setUploading(null)
    }
  }

  if (isLoading || !readiness) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '1rem' }}>Calculando readiness…</div>
  }

  const { listaParaFacturar, items } = readiness

  const criteria = [
    {
      key: 'oc',
      label: 'Orden de compra',
      ok: items.ocRecibida.ok,
      requerida: true,
      detail: items.ocRecibida.ok
        ? items.ocRecibida.url
          ? <a href={items.ocRecibida.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>Ver PDF</a>
          : <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Recibida</span>
        : (
          <button
            onClick={() => ocInputRef.current?.click()}
            disabled={uploading === 'oc'}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            {uploading === 'oc' ? 'Subiendo…' : 'Subir OC'}
          </button>
        ),
    },
    {
      key: 'fotos',
      label: 'Fotografías comprobatorias',
      ok: items.fotosComprobatorias.ok,
      requerida: items.otCompletada.requerida,
      detail: items.fotosComprobatorias.ok
        ? <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{items.fotosComprobatorias.cantidad} foto{items.fotosComprobatorias.cantidad !== 1 ? 's' : ''}</span>
        : <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Se generan al completar la OT</span>,
    },
    {
      key: 'reporte',
      label: 'Reporte de publicación',
      ok: items.reportePublicacion.ok,
      requerida: true,
      detail: items.reportePublicacion.ok
        ? <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Recibido</span>
        : (
          <button
            onClick={() => reporteInputRef.current?.click()}
            disabled={uploading === 'reporte'}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            {uploading === 'reporte' ? 'Subiendo…' : 'Subir reporte'}
          </button>
        ),
    },
    {
      key: 'ot',
      label: 'Orden de trabajo completada',
      ok: items.otCompletada.ok,
      requerida: items.otCompletada.requerida,
      detail: items.otCompletada.otId
        ? <a href={`/operaciones/ordenes/${items.otCompletada.otId}`} style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Ver OT</a>
        : <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{items.otCompletada.requerida ? 'Sin OT asignada' : 'N/A'}</span>,
    },
    {
      key: 'traffic',
      label: 'Tráfico finalizado',
      ok: items.trafficFinalizado.ok,
      requerida: items.trafficFinalizado.requerido,
      detail: items.trafficFinalizado.toId
        ? <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>TO registrada</span>
        : <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{items.trafficFinalizado.requerido ? 'Pendiente' : 'N/A'}</span>,
    },
  ]

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      {/* Hidden inputs */}
      <input ref={ocInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile('oc', f, 'oc') }} />
      <input ref={reporteInputRef} type="file" accept=".pdf,.zip,.jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile('reporte', f, 'reporte') }} />

      {/* Lock header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.875rem', background: listaParaFacturar ? 'rgba(184,240,0,0.06)' : 'transparent' }}>
        <div style={{ fontSize: '2rem', transition: 'all 0.4s', animation: listaParaFacturar ? 'readiness-pop 0.4s ease' : 'none' }}>
          {listaParaFacturar ? '🔒' : '🔓'}
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: listaParaFacturar ? '#b8f000' : 'var(--fg)' }}>
            {listaParaFacturar ? 'Lista para facturar' : 'Pendiente de cierre'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
            {listaParaFacturar ? 'Todos los criterios cumplidos' : 'Completa los criterios para cerrar la campaña'}
          </div>
        </div>
      </div>

      {/* Criteria */}
      <div style={{ padding: '0.75rem' }}>
        {criteria.map((c) => {
          const icon = !c.requerida ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 18, textAlign: 'center', flexShrink: 0 }}>N/A</span>
          ) : c.ok ? (
            <span style={{ color: '#b8f000', fontSize: '0.875rem', width: 18, textAlign: 'center', flexShrink: 0 }}>✓</span>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: '1rem', width: 18, textAlign: 'center', flexShrink: 0 }}>○</span>
          )
          return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.5rem', borderBottom: '1px solid var(--border)', opacity: !c.requerida ? 0.5 : 1 }}>
              {icon}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: c.ok ? 'var(--fg)' : c.requerida ? 'var(--muted)' : 'var(--muted)' }}>{c.label}</div>
                <div style={{ marginTop: '0.125rem' }}>{c.detail}</div>
              </div>
            </div>
          )
        })}
      </div>

      {uploadError && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--error)' }}>{uploadError}</div>
      )}

      <style>{`
        @keyframes readiness-pop {
          0%   { transform: scale(0.8) rotate(-10deg); }
          60%  { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
