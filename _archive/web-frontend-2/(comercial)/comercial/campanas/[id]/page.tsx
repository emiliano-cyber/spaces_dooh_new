'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import ReadinessPanel from '@/components/campanas/ReadinessPanel'
import ReporteVisual from '@/components/campanas/ReporteVisual'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Campana {
  id: string; folio: string; nombre: string; tipoCampana: string
  estadoComercial: string; agencia?: string; marca?: string; moneda: string
  fechaInicio: string; fechaFin: string; presupuestoBruto?: string; presupuestoNeto?: string
  notas?: string; ocRecibida: boolean; reportePublicacion: boolean
  portalToken?: string; portalActivo: boolean; creadoEn: string; actualizadoEn: string
  cliente?: { id: string; nombre: string }
  lines?: CampaignLine[]
  creatividades?: Creatividad[]
  trafficOrders?: TrafficOrder[]
}
interface CampaignLine {
  id: string; sitioId: string; fechaInicio: string; fechaFin: string
  tipoVenta: string; precio: string; cantidad: number; unidad: string; estatus: string
  sitio?: { nombre: string; ciudad: string; tipoMedio: string }
}
interface Creatividad {
  id: string; nombre: string; formato?: string; pesoMb?: string
  estatusValidacion: string; rechazadoMotivo?: string; subioPorExterno: boolean
  archivoUrl?: string; archivoUrlSigned?: string; creadoEn: string
}
interface TrafficOrder {
  id: string; folio: string; estadoTecnico: string; connectorTipo: string
  referenciaExterna?: string; logsJson: unknown[]; creadoEn: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TIPO_C: Record<string, { bg: string; color: string }> = {
  OOH:    { bg: 'rgba(10,102,255,0.15)', color: '#0A66FF' },
  DOOH:   { bg: 'rgba(251,191,36,0.15)', color: '#B45309' },
  HIBRIDA:{ bg: 'rgba(21,128,61,0.12)',  color: '#15803D' },
}
const ESTADO_C: Record<string, { bg: string; color: string }> = {
  DRAFT:          { bg: 'rgba(90,90,114,0.2)',  color: '#71717A' },
  COTIZACION:     { bg: 'rgba(10,102,255,0.2)', color: '#0A66FF' },
  CONFIRMADA:     { bg: 'rgba(251,191,36,0.2)', color: '#B45309' },
  ACTIVA:         { bg: 'rgba(21,128,61,0.15)', color: '#15803D' },
  COMPLETADA:     { bg: 'rgba(90,90,114,0.2)',  color: '#71717A' },
  CANCELADA:      { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C' },
  LISTA_FACTURAR: { bg: 'rgba(21,128,61,0.25)', color: '#15803D' },
}
const TO_ESTADO_C: Record<string, { bg: string; color: string; anim?: string }> = {
  PENDIENTE:      { bg: 'rgba(90,90,114,0.2)',  color: '#71717A' },
  EN_PUBLICACION: { bg: 'rgba(10,102,255,0.2)', color: '#0A66FF', anim: 'pulse-blue 2s infinite' },
  PAUSADA:        { bg: 'rgba(251,191,36,0.2)', color: '#B45309' },
  FINALIZADA:     { bg: 'rgba(21,128,61,0.15)', color: '#15803D' },
  ERROR:          { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C' },
}
const VALID_C: Record<string, { bg: string; color: string }> = {
  PENDIENTE: { bg: 'rgba(90,90,114,0.2)', color: '#71717A' },
  APROBADO:  { bg: 'rgba(21,128,61,0.15)', color: '#15803D' },
  RECHAZADO: { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C' },
}

function Badge({ label, style }: { label: string; style?: React.CSSProperties }) {
  return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, ...style }}>{label.replace(/_/g, ' ')}</span>
}
function fmt(d?: string) { return d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
function fmtMXN(v?: string | number) { return v ? `$${Number(v).toLocaleString('es-MX')} MXN` : '—' }
function hasPermission(user: any, perm: string): boolean {
  return user?.rol === 'owner' || user?.rol === 'admin' || user?.permisos?.includes('*') || user?.permisos?.includes(perm)
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CampanaDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const router = useRouter()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'resumen' | 'inventario' | 'creatividades' | 'trafico' | 'portal' | 'reporte'>('resumen')
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [portalCopied, setPortalCopied] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState('')

  const canCreate = hasPermission(user, 'campanas:create')
  const canReadiness = hasPermission(user, 'campanas:readiness')
  const canTraffic = hasPermission(user, 'traffic:manage')

  const { data: campana, isLoading } = useQuery<Campana>({
    queryKey: ['campana', id],
    queryFn: () => apiFetch(`/campanas/${id}`),
  })

  const { data: incidenciasActivas = [] } = useQuery<any[]>({
    queryKey: ['incidencias-activas', id],
    queryFn: async () => {
      const res = await apiFetch<{ data: any[] }>('/incidencias?estatusResolucion=ABIERTA&limit=100').catch(() => ({ data: [] }))
      if (!campana?.lines?.length) return []
      const sitioIds = new Set(campana.lines.map((l) => l.sitioId))
      return res.data.filter((inc) => sitioIds.has(inc.sitioId))
    },
    enabled: !!campana?.lines?.length,
    staleTime: 60_000,
  })

  const { data: creatividades = [] } = useQuery<Creatividad[]>({
    queryKey: ['creatividades', id],
    queryFn: () => apiFetch(`/campanas/${id}/creatividades`),
    enabled: tab === 'creatividades',
  })

  if (isLoading || !campana) {
    return <div style={{ color: 'var(--muted)', padding: '2rem' }}>Cargando…</div>
  }

  const editable = ['DRAFT', 'COTIZACION'].includes(campana.estadoComercial)
  const showTraffic = ['DOOH', 'HIBRIDA'].includes(campana.tipoCampana)
  const ec = ESTADO_C[campana.estadoComercial] ?? ESTADO_C.DRAFT
  const tc = TIPO_C[campana.tipoCampana] ?? TIPO_C.OOH
  const portalUrl = campana.portalToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${campana.portalToken}`
    : null

  const TABS = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'inventario', label: `Inventario (${campana.lines?.length ?? 0})` },
    { key: 'creatividades', label: `Creatividades (${campana.creatividades?.length ?? 0})` },
    ...(showTraffic ? [{ key: 'trafico', label: `Tráfico (${campana.trafficOrders?.length ?? 0})` }] : []),
    { key: 'portal', label: 'Portal' },
    { key: 'reporte', label: 'Reporte' },
  ]

  async function handleConfirmar() {
    setConfirmError(null); setConfirming(true)
    try {
      await apiFetch(`/campanas/${id}/confirmar`, { method: 'POST', body: '{}' })
      qc.invalidateQueries({ queryKey: ['campana', id] })
    } catch (err) { setConfirmError(err instanceof Error ? err.message : 'Error') }
    finally { setConfirming(false) }
  }

  async function handleCancelar() {
    if (!confirm('¿Cancelar esta campaña?')) return
    await apiFetch(`/campanas/${id}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo: 'Cancelada por usuario' }) })
    qc.invalidateQueries({ queryKey: ['campana', id] })
  }

  async function handleActivarPortal() {
    const res = await apiFetch<{ portalToken: string; url: string }>(`/campanas/${id}/portal-activate`, { method: 'POST', body: '{}' })
    qc.invalidateQueries({ queryKey: ['campana', id] })
  }

  async function handleValidar(creatividadId: string, estatusValidacion: 'APROBADO' | 'RECHAZADO', motivo?: string) {
    await apiFetch(`/campanas/${id}/creatividades/validate`, {
      method: 'POST',
      body: JSON.stringify({ creatividadId, estatusValidacion, motivo }),
    })
    qc.invalidateQueries({ queryKey: ['creatividades', id] })
    qc.invalidateQueries({ queryKey: ['campana', id] })
    setRejectId(null); setRejectMotivo('')
  }

  async function handleToEstado(toId: string, estadoTecnico: string) {
    await apiFetch(`/traffic-orders/${toId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estadoTecnico, nota: '' }),
    })
    qc.invalidateQueries({ queryKey: ['campana', id] })
  }

  async function eliminarLinea(lineId: string) {
    if (!confirm('¿Eliminar esta línea?')) return
    await apiFetch(`/campanas/${id}/lines/${lineId}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['campana', id] })
  }

  const s: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px',
    color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <style>{`@keyframes pulse-blue { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* Back */}
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, alignSelf: 'flex-start' }}>
        ← Volver
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
            <h1 style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700 }}>{campana.folio}</h1>
            <Badge label={campana.tipoCampana} style={{ background: tc.bg, color: tc.color }} />
            <Badge label={campana.estadoComercial} style={{ background: ec.bg, color: ec.color }} />
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--muted)' }}>{campana.nombre}</div>
          {campana.cliente && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{campana.cliente.nombre}</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {editable && canCreate && (
            <button onClick={handleConfirmar} disabled={confirming} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem', opacity: confirming ? 0.7 : 1 }}>
              {confirming ? 'Confirmando…' : 'Confirmar campaña'}
            </button>
          )}
          {campana.estadoComercial === 'ACTIVA' && canCreate && (
            <button onClick={handleCancelar} style={{ background: 'none', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem' }}>
              Cancelar
            </button>
          )}
          {campana.estadoComercial === 'LISTA_FACTURAR' && canReadiness && (
            <button style={{ background: '#0A0A0A', border: 'none', borderRadius: '8px', color: '#FAFAFA', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.625rem 1.25rem' }}>
              🔒 Marcar como facturada
            </button>
          )}
        </div>
      </div>

      {/* Incidents banner */}
      {incidenciasActivas.length > 0 && (
        <div style={{ background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '1rem' }}>⚠</span>
          <span style={{ fontSize: '0.875rem', color: '#ff4b4b', fontWeight: 500 }}>
            {incidenciasActivas.length} incidencia{incidenciasActivas.length > 1 ? 's' : ''} activa{incidenciasActivas.length > 1 ? 's' : ''} en sitios de esta campaña
          </span>
        </div>
      )}

      {confirmError && (
        <div style={{ background: 'rgba(185,28,28,0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.625rem 1rem' }}>{confirmError}</div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as any)} style={{ background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === key ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: tab === key ? 600 : 400, padding: '0.625rem 1rem', transition: 'all 0.15s', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumen ── */}
      {tab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos de la campaña</h3>
              {editable && canCreate && (
                <button onClick={() => router.push(`/comercial/campanas/${id}/editar`)} style={s}>Editar</button>
              )}
            </div>
            {[
              ['Cliente', campana.cliente?.nombre],
              ['Agencia', campana.agencia],
              ['Marca', campana.marca],
              ['Tipo de campaña', campana.tipoCampana],
              ['Fecha inicio', fmt(campana.fechaInicio)],
              ['Fecha fin', fmt(campana.fechaFin)],
              ['Presupuesto bruto', fmtMXN(campana.presupuestoBruto)],
              ['Presupuesto neto', fmtMXN(campana.presupuestoNeto)],
              ['Moneda', campana.moneda],
              ['Notas', campana.notas],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 160, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: '0.875rem' }}>{val}</div>
              </div>
            ))}
          </div>
          <ReadinessPanel campanaId={id} estadoComercial={campana.estadoComercial} />
        </div>
      )}

      {/* ── Tab: Inventario ── */}
      {tab === 'inventario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {editable && canCreate && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => router.push(`/comercial/inventario`)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem' }}>
                + Agregar sitio
              </button>
            </div>
          )}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Sitio', 'Ciudad', 'Tipo', 'Fechas', 'Tipo venta', 'Precio', ''].map((h) => (
                    <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(campana.lines ?? []).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin líneas de campaña</td></tr>
                ) : (campana.lines ?? []).map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{l.sitio?.nombre ?? l.sitioId.slice(0, 8)}</td>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{l.sitio?.ciudad}</td>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>{l.sitio?.tipoMedio?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(l.fechaInicio)} → {fmt(l.fechaFin)}</td>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>{l.tipoVenta.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{fmtMXN(l.precio)}</td>
                    <td style={{ padding: '0.625rem 1rem' }}>
                      {editable && canCreate && (
                        <button onClick={() => eliminarLinea(l.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Creatividades ── */}
      {tab === 'creatividades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
            {!campana.portalActivo ? (
              <button onClick={handleActivarPortal} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                🔗 Compartir portal con cliente
              </button>
            ) : (
              <button
                onClick={() => { navigator.clipboard.writeText(portalUrl ?? ''); setPortalCopied(true); setTimeout(() => setPortalCopied(false), 2000) }}
                style={{ background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.3)', borderRadius: '8px', color: '#15803D', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                {portalCopied ? '✓ Copiado' : '📋 Copiar link del portal'}
              </button>
            )}
          </div>

          {creatividades.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              Sin creatividades — comparte el portal con el cliente para que suba sus materiales
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {creatividades.map((c) => {
                const vc = VALID_C[c.estatusValidacion] ?? VALID_C.PENDIENTE
                return (
                  <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                        {[c.formato, c.pesoMb ? `${Number(c.pesoMb).toFixed(1)} MB` : null, fmt(c.creadoEn), c.subioPorExterno ? 'Subido por cliente' : null].filter(Boolean).join(' · ')}
                      </div>
                      {c.estatusValidacion === 'RECHAZADO' && c.rechazadoMotivo && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>Motivo: {c.rechazadoMotivo}</div>
                      )}
                    </div>
                    <Badge label={c.estatusValidacion} style={{ background: vc.bg, color: vc.color }} />
                    {canCreate && c.estatusValidacion === 'PENDIENTE' && (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button onClick={() => handleValidar(c.id, 'APROBADO')} style={{ background: 'rgba(21,128,61,0.12)', border: '1px solid rgba(21,128,61,0.3)', borderRadius: '6px', color: '#15803D', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Aprobar</button>
                        <button onClick={() => setRejectId(c.id)} style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(185,28,28,0.3)', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Rechazar</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Reject modal */}
          {rejectId && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: 360, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Motivo de rechazo</h3>
                <textarea value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} rows={3} placeholder="Describe el motivo…" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setRejectId(null); setRejectMotivo('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Cancelar</button>
                  <button onClick={() => handleValidar(rejectId, 'RECHAZADO', rejectMotivo)} disabled={!rejectMotivo} style={{ background: 'var(--error)', border: 'none', borderRadius: '7px', color: '#fff', cursor: rejectMotivo ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem', opacity: rejectMotivo ? 1 : 0.5 }}>Rechazar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tráfico ── */}
      {tab === 'trafico' && showTraffic && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(campana.trafficOrders ?? []).length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              Sin traffic orders — se crean al confirmar la campaña DOOH
            </div>
          ) : (campana.trafficOrders ?? []).map((to) => {
            const toc = TO_ESTADO_C[to.estadoTecnico] ?? TO_ESTADO_C.PENDIENTE
            return (
              <div key={to.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700 }}>{to.folio}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{to.connectorTipo} · {fmt(to.creadoEn)}</div>
                </div>
                <span style={{ background: toc.bg, color: toc.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, animation: toc.anim }}>
                  {to.estadoTecnico.replace(/_/g, ' ')}
                </span>
                {canTraffic && (
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {to.estadoTecnico === 'PENDIENTE' && (
                      <button onClick={() => handleToEstado(to.id, 'EN_PUBLICACION')} style={{ background: 'rgba(10,102,255,0.15)', border: '1px solid rgba(10,102,255,0.3)', borderRadius: '6px', color: '#0A66FF', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Publicar</button>
                    )}
                    {to.estadoTecnico === 'EN_PUBLICACION' && (<>
                      <button onClick={() => handleToEstado(to.id, 'PAUSADA')} style={{ background: 'rgba(180,83,9,0.12)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: '6px', color: '#B45309', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Pausar</button>
                      <button onClick={() => handleToEstado(to.id, 'FINALIZADA')} style={{ background: 'rgba(21,128,61,0.12)', border: '1px solid rgba(21,128,61,0.3)', borderRadius: '6px', color: '#15803D', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Finalizar</button>
                    </>)}
                    {to.estadoTecnico === 'PAUSADA' && (<>
                      <button onClick={() => handleToEstado(to.id, 'EN_PUBLICACION')} style={{ background: 'rgba(10,102,255,0.15)', border: '1px solid rgba(10,102,255,0.3)', borderRadius: '6px', color: '#0A66FF', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Reanudar</button>
                      <button onClick={() => handleToEstado(to.id, 'FINALIZADA')} style={{ background: 'rgba(90,90,114,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem' }}>Cancelar</button>
                    </>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Reporte ── */}
      {tab === 'reporte' && (
        <ReporteVisual campanaId={id} />
      )}

      {/* ── Tab: Portal ── */}
      {tab === 'portal' && (
        <div style={{ maxWidth: 560 }}>
          {campana.portalActivo && portalUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(21,128,61,0.06)', border: '1px solid rgba(21,128,61,0.3)', borderRadius: '10px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#15803D', marginBottom: '0.5rem' }}>Portal activo</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--muted)', wordBreak: 'break-all', marginBottom: '0.75rem' }}>{portalUrl}</div>
                <button
                  onClick={() => { navigator.clipboard.writeText(portalUrl); setPortalCopied(true); setTimeout(() => setPortalCopied(false), 2000) }}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem' }}
                >
                  {portalCopied ? '✓ Copiado' : '📋 Copiar link'}
                </button>
              </div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--fg)' }}>Instrucciones para el cliente:</strong><br />
                  Comparte este link para que puedan:<br />
                  • Ver el avance de su campaña en tiempo real<br />
                  • Subir sus materiales creativos (JPG, PNG, PDF, MP4, MOV)<br />
                  • Recibir confirmación al instante
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem' }}>🔗</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Portal del cliente no activado</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Activa el portal para compartir un link seguro con tu cliente</div>
              <button onClick={handleActivarPortal} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.5rem' }}>
                Activar portal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
