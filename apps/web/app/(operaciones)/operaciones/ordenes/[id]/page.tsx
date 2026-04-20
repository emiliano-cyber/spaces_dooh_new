'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import OTMovil from '@/components/operaciones/OTMovil'

interface ChecklistItem { id: string; texto: string; completado: boolean; completadoEn?: string }
interface Evidencia { id: string; fotoUrl: string; fotoUrlSigned: string; storageKey: string; tipo: string; timestamp: string; lat?: number; lng?: number }
interface OT {
  id: string; folio: string; tipo: string; descripcion: string; instrucciones?: string
  prioridad: string; estatus: string; sitioId?: string; asignadoAUserId?: string
  fechaProgramada?: string; fechaInicio?: string; fechaCompletada?: string
  campanaId?: string; notas?: string; checklistJson: ChecklistItem[]
  evidencias: Evidencia[]; creadoEn: string; actualizadoEn: string
}

const TIPO_LABELS: Record<string, string> = {
  MONTAJE_LONA: 'Montaje de lona', MONTAJE_DIGITAL: 'Montaje digital', DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mtto. preventivo', MANTENIMIENTO_CORRECTIVO: 'Mtto. correctivo',
  HERRERIA: 'Herrería', ELECTRICO: 'Eléctrico', INSPECCION: 'Inspección', OTRO: 'Otro',
}

const PRIORIDAD_C: Record<string, string> = { URGENTE: '#ff5f5f', ALTA: '#fbbf24', NORMAL: '#9090aa', BAJA: '#7a7a96' }
const ESTATUS_C: Record<string, string> = { PENDIENTE: '#9090aa', ASIGNADA: '#6c63ff', EN_PROCESO: '#fbbf24', COMPLETADA: '#b8f000', CANCELADA: '#ff5f5f' }

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{label.replace(/_/g, ' ')}</span>
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 150, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}

function fmt(d?: string | null) { return d ? new Date(d).toLocaleString('es-MX') : '—' }

function OTDesktop({ ot, onRefetch }: { ot: OT; onRefetch: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const [completing, setCompleting] = useState(false)
  const [completarError, setCompletarError] = useState<string | null>(null)

  const canAssign = user?.rol === 'owner' || user?.rol === 'admin' ||
    (user?.permisos as string[] | undefined)?.includes('*') ||
    user?.permisos.includes('ots:assign')

  const canComplete = user?.rol === 'owner' || user?.rol === 'admin' ||
    (user?.permisos as string[] | undefined)?.includes('*') ||
    user?.permisos.includes('ots:complete')

  async function toggleChecklist(itemId: string, completado: boolean) {
    await apiFetch(`/ordenes-trabajo/${ot.id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ itemId, completado }),
    })
    onRefetch()
  }

  async function handleCompletar() {
    setCompletarError(null)
    setCompleting(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/completar`, { method: 'POST', body: JSON.stringify({}) })
      onRefetch()
    } catch (err) {
      setCompletarError(err instanceof Error ? err.message : 'Error al completar la OT')
    } finally {
      setCompleting(false)
    }
  }

  const checklistItems: ChecklistItem[] = Array.isArray(ot.checklistJson) ? ot.checklistJson : []
  const totalItems = checklistItems.length
  const doneItems = checklistItems.filter((i) => i.completado).length
  const hasEvidencias = ot.evidencias.length > 0
  const isCompleted = ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
          ← Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'monospace' }}>{ot.folio}</h1>
          <Badge label={TIPO_LABELS[ot.tipo] ?? ot.tipo} color="#6c63ff" />
          <Badge label={ot.prioridad} color={PRIORIDAD_C[ot.prioridad] ?? '#9090aa'} />
          <Badge label={ot.estatus.replace('_', ' ')} color={ESTATUS_C[ot.estatus] ?? '#9090aa'} />
        </div>
      </div>

      {/* Two-column layout 70 / 30 */}
      <div style={{ display: 'grid', gridTemplateColumns: '70% 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT — Info + Checklist + Evidencias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Info */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Información</h3>
            <Row label="Descripción" value={ot.descripcion} />
            {ot.instrucciones && <Row label="Instrucciones" value={<span style={{ color: 'var(--muted)' }}>{ot.instrucciones}</span>} />}
            <Row label="Sitio" value={ot.sitioId ?? '—'} />
            <Row label="Asignado a" value={ot.asignadoAUserId ?? '—'} />
            <Row label="Fecha programada" value={fmt(ot.fechaProgramada)} />
            <Row label="Fecha inicio" value={fmt(ot.fechaInicio)} />
            <Row label="Fecha completada" value={fmt(ot.fechaCompletada)} />
            {ot.notas && <Row label="Notas" value={<span style={{ color: 'var(--muted)' }}>{ot.notas}</span>} />}
          </div>

          {/* Checklist */}
          {totalItems > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checklist</h3>
                <span style={{ fontSize: '0.75rem', color: doneItems === totalItems ? '#b8f000' : 'var(--muted)' }}>{doneItems}/{totalItems}</span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%`, background: '#b8f000', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {checklistItems.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: isCompleted ? 'default' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={item.completado}
                      disabled={isCompleted || !canComplete}
                      onChange={(e) => toggleChecklist(item.id, e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, cursor: isCompleted || !canComplete ? 'default' : 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.875rem', textDecoration: item.completado ? 'line-through' : 'none', color: item.completado ? 'var(--muted)' : 'var(--fg)' }}>
                      {item.texto}
                    </span>
                    {item.completadoEn && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(item.completadoEn).toLocaleDateString('es-MX')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Evidencias */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
              Evidencias fotográficas ({ot.evidencias.length})
            </h3>
            {ot.evidencias.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem' }}>Sin evidencias cargadas</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                {ot.evidencias.map((ev) => (
                  <a key={ev.id} href={ev.fotoUrlSigned} target="_blank" rel="noopener noreferrer" title={ev.storageKey}>
                    <div style={{ aspectRatio: '1', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      <img
                        src={ev.fotoUrlSigned}
                        alt={ev.tipo}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex' }}
                      />
                      <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'var(--muted)', fontSize: '0.75rem', width: '100%', height: '100%', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.5rem' }}>📷</span>
                        <span>{ev.tipo}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Sticky actions */}
        <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Status card */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Acciones</h3>

            {canAssign && !isCompleted && (
              <button
                onClick={() => router.push(`/operaciones/ordenes/${ot.id}/asignar`)}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: '0.625rem 1rem', marginBottom: '0.625rem', transition: 'all 0.15s', textAlign: 'left' }}
              >
                👤 {ot.asignadoAUserId ? 'Reasignar técnico' : 'Asignar técnico'}
              </button>
            )}

            {canComplete && !isCompleted && (
              <div>
                <button
                  onClick={handleCompletar}
                  disabled={completing || !hasEvidencias}
                  style={{ width: '100%', background: hasEvidencias ? 'var(--accent)' : 'var(--bg)', border: hasEvidencias ? 'none' : '1px solid var(--border)', borderRadius: '8px', color: hasEvidencias ? '#fff' : 'var(--muted)', cursor: hasEvidencias ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1rem', opacity: completing ? 0.7 : 1, transition: 'all 0.15s' }}
                >
                  {completing ? 'Completando…' : '✓ Completar OT'}
                </button>
                {!hasEvidencias && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem', textAlign: 'center' }}>
                    Se requiere al menos una evidencia
                  </p>
                )}
                {completarError && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.375rem' }}>{completarError}</p>
                )}
              </div>
            )}

            {isCompleted && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem' }}>
                OT {ot.estatus.toLowerCase()}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Info</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>Creada: {fmt(ot.creadoEn)}</div>
              <div>Actualizada: {fmt(ot.actualizadoEn)}</div>
              {ot.campanaId && <div>Campaña: <span style={{ fontFamily: 'monospace' }}>{ot.campanaId.slice(0, 8)}…</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OTDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const isMobile = useIsMobile()

  const { data: ot, isLoading, error, refetch } = useQuery({
    queryKey: ['ot', id],
    queryFn: () => apiFetch<OT>(`/ordenes-trabajo/${id}`),
  })

  if (isLoading || isMobile === null) return <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem' }}>Cargando…</div>
  if (error || !ot) return <div style={{ color: 'var(--error)', padding: '2rem' }}>Error al cargar la OT.</div>

  if (isMobile) return <OTMovil ot={ot} onRefetch={refetch} />

  return <OTDesktop ot={ot} onRefetch={refetch} />
}
