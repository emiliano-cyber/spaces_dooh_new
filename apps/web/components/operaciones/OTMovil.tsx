'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  texto: string
  completado: boolean
  completadoEn?: string
}

interface Evidencia {
  id: string
  fotoUrlSigned: string
  storageKey: string
  tipo: string
  timestamp: string
}

type VisitaTipo = 'MODULOS' | 'ELECTRICO'
interface Visita {
  id: string
  tipo: VisitaTipo
  contenido: string
  fecha: string
  autorUserId: string | null
  autorNombre: string | null
  creadoEn: string
  actualizadoEn: string
}

const VISITA_TIPO_LABEL: Record<VisitaTipo, string> = {
  MODULOS: 'Mantto. módulos',
  ELECTRICO: 'Eléctrico',
}

export interface OTMovilData {
  id: string
  folio: string
  tipo: string
  descripcion: string
  instrucciones?: string
  prioridad: string
  estatus: string
  sitioId?: string
  asignadoAUserId?: string
  fechaProgramada?: string
  fechaCompletada?: string
  notas?: string
  checklistJson: ChecklistItem[]
  evidencias: Evidencia[]
  motivoBloqueo?: string
  revisionNotas?: string
  requiereRevision?: boolean
  visitasJson?: Visita[]
}

interface LocalPreview {
  tempId: string
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  file?: File
}

interface Props {
  ot: OTMovilData
  onRefetch: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  MONTAJE_LONA: 'Montaje de lona',
  MONTAJE_DIGITAL: 'Montaje digital',
  DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mtto. preventivo',
  MANTENIMIENTO_CORRECTIVO: 'Mtto. correctivo',
  HERRERIA: 'Herrería',
  ELECTRICO: 'Eléctrico',
  INSPECCION: 'Inspección',
  OTRO: 'Otro',
}

const ESTATUS_C: Record<string, string> = {
  PENDIENTE:   '#71717A',
  ASIGNADA:    '#0A66FF',
  EN_PROCESO:  '#B45309',
  BLOQUEADA:   '#B91C1C',
  EN_REVISION: '#7C3AED',
  COMPLETADA:  '#15803D',
  RECHAZADA:   '#B45309',
  CANCELADA:   '#71717A',
}

const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', ASIGNADA: 'Asignada', EN_PROCESO: 'En proceso',
  BLOQUEADA: 'Bloqueada', EN_REVISION: 'En revisión', COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
}

const PRIORIDAD_C: Record<string, string> = {
  URGENTE: '#B91C1C', ALTA: '#B45309', NORMAL: '#71717A', BAJA: '#A1A1AA',
}

const FOTO_CATEGORIAS = ['ANTES', 'DURANTE', 'INSTALACION', 'PROBLEMA', 'DESPUES'] as const
type FotoCategoria = typeof FOTO_CATEGORIAS[number]

// ─── Image compression ────────────────────────────────────────────────────────

async function compressImage(file: File, maxSizeMB = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const maxDim = 1920
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else { width = Math.round((width * maxDim) / height); height = maxDim }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      const attempt = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.3) { resolve(blob); return }
          attempt(Math.round((quality - 0.1) * 10) / 10)
        }, 'image/jpeg', quality)
      }
      attempt(0.8)
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}20`, color, border: `1px solid ${color}40`,
      padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '1rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OTMovil({ ot, onRefetch }: Props) {
  const router = useRouter()
  const { user } = useAuth()

  // UI state
  const [infoOpen, setInfoOpen] = useState(false)
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [poppingItem, setPoppingItem] = useState<string | null>(null)
  const [notasValue, setNotasValue] = useState(ot.notas ?? '')
  const [savingNotas, setSavingNotas] = useState(false)
  const [notasSaved, setNotasSaved] = useState(false)
  const [visitaTab, setVisitaTab] = useState<VisitaTipo>('MODULOS')
  const [newVisitaContenido, setNewVisitaContenido] = useState('')
  const [savingVisita, setSavingVisita] = useState(false)
  const [visitaError, setVisitaError] = useState<string | null>(null)
  const [editingVisitaId, setEditingVisitaId] = useState<string | null>(null)
  const [editVisitaContenido, setEditVisitaContenido] = useState('')
  const [editVisitaTipo, setEditVisitaTipo] = useState<VisitaTipo>('MODULOS')
  const [fotoCategoria, setFotoCategoria] = useState<FotoCategoria>('INSTALACION')
  const [showBloquearModal, setShowBloquearModal] = useState(false)
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [bloqueando, setBloqueando] = useState(false)
  const [bloquearError, setBloquearError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const checklistItems: ChecklistItem[] = Array.isArray(ot.checklistJson) ? ot.checklistJson : []
  const totalItems = checklistItems.length
  const doneItems = checklistItems.filter((i) => i.completado).length
  const sortedChecklist = [...checklistItems].sort((a, b) => {
    if (a.completado === b.completado) return 0
    return a.completado ? 1 : -1
  })

  const allEvidencias = ot.evidencias
  const hasEvidencias = allEvidencias.length > 0 || localPreviews.some((p) => p.status === 'done')

  // Statuses where the OT is fully locked
  const isFinal = ['COMPLETADA', 'CANCELADA'].includes(ot.estatus)
  // Statuses where editing (photos, checklist, notas) is locked
  const isReadOnly = isFinal || ['EN_REVISION', 'BLOQUEADA'].includes(ot.estatus)
  // Can submit completion
  const canComplete = ['EN_PROCESO', 'ASIGNADA', 'RECHAZADA'].includes(ot.estatus)
  // Can report a problem (bloquear)
  const canBloquear = ['EN_PROCESO', 'ASIGNADA'].includes(ot.estatus)

  // ── Checklist toggle ─────────────────────────────────────────────────────────

  async function toggleChecklist(itemId: string, completado: boolean) {
    setPoppingItem(itemId)
    setTimeout(() => setPoppingItem(null), 250)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({ itemId, completado }),
      })
      onRefetch()
    } catch {
      // will reconcile on next refetch
    }
  }

  // ── Photo upload ──────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const previewUrl = URL.createObjectURL(file)
    setLocalPreviews((prev) => [...prev, { tempId, previewUrl, status: 'uploading', file }])
    setUploadError(null)

    try {
      const compressed = await compressImage(file)
      const sizeMb = compressed.size / (1024 * 1024)

      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `/ordenes-trabajo/${ot.id}/evidencias/upload-url`,
        { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: 'image/jpeg' }) },
      )

      if (!uploadUrl.includes('placeholder.storage')) {
        const putRes = await fetch(uploadUrl, {
          method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' },
        })
        if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)
      }

      await apiFetch(`/ordenes-trabajo/${ot.id}/evidencias`, {
        method: 'POST',
        body: JSON.stringify({ storageKey: key, tipo: fotoCategoria, tamanoMb: Math.round(sizeMb * 100) / 100 }),
      })

      setLocalPreviews((prev) =>
        prev.map((p) => p.tempId === tempId ? { ...p, status: 'done', previewUrl } : p),
      )
      onRefetch()
    } catch {
      URL.revokeObjectURL(previewUrl)
      setLocalPreviews((prev) =>
        prev.map((p) => p.tempId === tempId ? { ...p, status: 'error' } : p),
      )
      setUploadError('No se pudo subir la foto. Intenta de nuevo.')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  async function retryUpload(tempId: string) {
    const preview = localPreviews.find((p) => p.tempId === tempId)
    if (!preview?.file) return
    setLocalPreviews((prev) => prev.filter((p) => p.tempId !== tempId))
    await uploadFile(preview.file)
  }

  // ── Save notas ────────────────────────────────────────────────────────────────

  async function saveNotas() {
    if (notasValue === (ot.notas ?? '')) return
    setSavingNotas(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/notas`, {
        method: 'PATCH', body: JSON.stringify({ notas: notasValue }),
      })
      setNotasSaved(true)
      setTimeout(() => setNotasSaved(false), 2500)
      onRefetch()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al guardar notas')
    } finally {
      setSavingNotas(false)
    }
  }

  // ── Bloquear ──────────────────────────────────────────────────────────────────

  async function handleBloquear() {
    if (motivoBloqueo.trim().length < 10) return
    setBloqueando(true); setBloquearError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/bloquear`, {
        method: 'POST', body: JSON.stringify({ motivo: motivoBloqueo }),
      })
      setShowBloquearModal(false)
      onRefetch()
    } catch (err) {
      setBloquearError(err instanceof Error ? err.message : 'Error al reportar el problema')
    } finally {
      setBloqueando(false)
    }
  }

  // ── Complete OT ───────────────────────────────────────────────────────────────

  async function handleCompletar() {
    setCompleting(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/completar`, {
        method: 'POST', body: JSON.stringify({}),
      })
      setShowConfirm(false)
      setCompleted(true)
      onRefetch()
    } catch (err) {
      setShowConfirm(false)
      setUploadError(err instanceof Error ? err.message : 'Error al completar la OT')
    } finally {
      setCompleting(false)
    }
  }

  // ── Visitas ────────────────────────────────────────────────────────────────

  const visitas: Visita[] = Array.isArray(ot.visitasJson) ? ot.visitasJson : []
  const visitasFiltradas = visitas
    .filter((v) => v.tipo === visitaTab)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const visitaCountByTipo: Record<VisitaTipo, number> = {
    MODULOS: visitas.filter((v) => v.tipo === 'MODULOS').length,
    ELECTRICO: visitas.filter((v) => v.tipo === 'ELECTRICO').length,
  }

  async function handleSaveVisita() {
    if (!newVisitaContenido.trim()) return
    setSavingVisita(true); setVisitaError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/visitas`, {
        method: 'POST',
        body: JSON.stringify({ tipo: visitaTab, contenido: newVisitaContenido.trim() }),
      })
      setNewVisitaContenido('')
      onRefetch()
    } catch (err) {
      setVisitaError(err instanceof Error ? err.message : 'Error al guardar visita')
    } finally { setSavingVisita(false) }
  }

  function startEditVisita(v: Visita) {
    setEditingVisitaId(v.id)
    setEditVisitaContenido(v.contenido)
    setEditVisitaTipo(v.tipo)
    setVisitaError(null)
  }

  async function handleSaveEditVisita() {
    if (!editingVisitaId || !editVisitaContenido.trim()) return
    setSavingVisita(true); setVisitaError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/visitas/${editingVisitaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tipo: editVisitaTipo, contenido: editVisitaContenido.trim() }),
      })
      setEditingVisitaId(null)
      onRefetch()
    } catch (err) {
      setVisitaError(err instanceof Error ? err.message : 'Error al editar visita')
    } finally { setSavingVisita(false) }
  }

  // ── Success screen ────────────────────────────────────────────────────────────

  if (completed) {
    const sentToReview = ot.requiereRevision
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', gap: '1.5rem',
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: sentToReview ? 'rgba(124,58,237,0.1)' : 'rgba(21,128,61,0.1)',
          border: `3px solid ${sentToReview ? '#7C3AED' : '#15803D'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.25rem',
          animation: 'ot-pop 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both',
        }}>
          {sentToReview ? '✋' : '✓'}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: sentToReview ? '#7C3AED' : '#15803D', marginBottom: '0.5rem' }}>
            {sentToReview ? 'Enviado a revisión' : 'Orden completada'}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            {ot.folio} · {new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
          {sentToReview && (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem', maxWidth: 280 }}>
              Tu supervisor recibirá el reporte y lo aprobará o solicitará correcciones.
            </div>
          )}
        </div>
        <button
          onClick={() => router.push('/operaciones/ordenes')}
          style={{
            background: '#0A0A0A', color: '#FAFAFA', border: 'none', borderRadius: 12,
            cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
            padding: '0.875rem 2rem', minHeight: 48, marginTop: '0.5rem',
          }}
        >
          ← Volver a mis órdenes
        </button>
        <style>{`
          @keyframes ot-pop {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  const tipoLabels = ot.tipo.split(',').map((t) => TIPO_LABELS[t.trim()] ?? t.trim()).join(' + ')
  const estatusColor = ESTATUS_C[ot.estatus] ?? '#71717A'

  return (
    <>
      <style>{`
        @keyframes ot-pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .ot-cb:active { transform: scale(0.82); }
      `}</style>

      {/* Full-screen overlay */}
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
      }}>

        {/* ── STICKY HEADER ────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          flexShrink: 0, padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.25rem',
                lineHeight: 1, minWidth: 32, minHeight: 32,
                display: 'flex', alignItems: 'center',
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--fg)', flex: 1 }}>
              {ot.folio}
            </span>
            <MBadge label={ESTATUS_LABEL[ot.estatus] ?? ot.estatus} color={estatusColor} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', paddingLeft: '2.25rem', flexWrap: 'wrap' }}>
            <MBadge label={tipoLabels} color="#0A66FF" />
            {(ot.prioridad === 'URGENTE' || ot.prioridad === 'ALTA') && (
              <MBadge label={ot.prioridad} color={PRIORIDAD_C[ot.prioridad]} />
            )}
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem 0.875rem 100px' }}>

          {/* Error banner */}
          {uploadError && (
            <div style={{
              background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)',
              borderRadius: 10, color: 'var(--error)', fontSize: '0.875rem',
              padding: '0.75rem 1rem', marginBottom: '0.875rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}>×</button>
            </div>
          )}

          {/* State banners */}
          {ot.estatus === 'BLOQUEADA' && (
            <div style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.25)', borderLeft: '3px solid #B91C1C', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#B91C1C', marginBottom: '0.25rem' }}>⚠ OT bloqueada</div>
              {ot.motivoBloqueo && <div style={{ fontSize: '0.875rem', color: 'var(--fg)' }}>{ot.motivoBloqueo}</div>}
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.375rem' }}>Un supervisor deberá reactivar la orden.</div>
            </div>
          )}
          {ot.estatus === 'EN_REVISION' && (
            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.25)', borderLeft: '3px solid #7C3AED', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7C3AED', marginBottom: '0.25rem' }}>✋ Pendiente de aprobación</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Tu supervisor revisará el trabajo y lo aprobará o solicitará correcciones.</div>
            </div>
          )}
          {ot.estatus === 'RECHAZADA' && (
            <div style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.25)', borderLeft: '3px solid #B45309', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#B45309', marginBottom: '0.25rem' }}>✗ Re-trabajo solicitado</div>
              {ot.revisionNotas && <div style={{ fontSize: '0.875rem', color: 'var(--fg)' }}>{ot.revisionNotas}</div>}
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.375rem' }}>Agrega más evidencias y vuelve a completar la orden.</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* ── Info básica ────────────────────────────────────────────────── */}
            <SectionCard>
              <button
                onClick={() => setInfoOpen((o) => !o)}
                style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, color: 'var(--fg)' }}
              >
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Detalles</span>
                <span style={{ fontSize: '1rem', color: 'var(--muted)', transform: infoOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
              </button>
              {infoOpen && (
                <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <InfoRow label="Descripción" value={ot.descripcion} />
                  {ot.instrucciones && <InfoRow label="Instrucciones" value={ot.instrucciones} />}
                  {ot.sitioId && <InfoRow label="Sitio" value={ot.sitioId} />}
                  {ot.fechaProgramada && <InfoRow label="Fecha programada" value={new Date(ot.fechaProgramada).toLocaleDateString('es-MX', { dateStyle: 'long' })} />}
                </div>
              )}
            </SectionCard>

            {/* ── Checklist ──────────────────────────────────────────────────── */}
            {totalItems > 0 && (
              <SectionCard>
                <SectionTitle>Lista de tareas · {doneItems}/{totalItems}</SectionTitle>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: '0.875rem', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%`,
                    background: '#15803D', borderRadius: 2, transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {sortedChecklist.map((item) => (
                    <label key={item.id} aria-label={item.texto} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0',
                      borderBottom: '1px solid var(--border)', cursor: isReadOnly ? 'default' : 'pointer',
                      opacity: item.completado ? 0.55 : 1, transition: 'opacity 0.25s',
                    }}>
                      <div
                        className="ot-cb"
                        role="checkbox"
                        aria-checked={item.completado}
                        onClick={() => !isReadOnly && toggleChecklist(item.id, !item.completado)}
                        style={{
                          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                          border: item.completado ? 'none' : '2px solid var(--border)',
                          background: item.completado ? '#0A66FF' : 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', color: '#fff', fontWeight: 700,
                          transform: poppingItem === item.id ? 'scale(0.82)' : 'scale(1)',
                          transition: 'transform 0.15s ease, background 0.2s, border 0.2s',
                          cursor: isReadOnly ? 'default' : 'pointer', userSelect: 'none',
                        }}
                      >
                        {item.completado ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: '0.9375rem', lineHeight: 1.4, textDecoration: item.completado ? 'line-through' : 'none', color: item.completado ? 'var(--muted)' : 'var(--fg)', flex: 1 }}>
                        {item.texto}
                      </span>
                    </label>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── Evidencias ─────────────────────────────────────────────────── */}
            <SectionCard>
              <SectionTitle>
                Fotografías · {allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length} foto{(allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length) !== 1 ? 's' : ''}
              </SectionTitle>

              {!isReadOnly && (
                <>
                  {/* Category chips */}
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {FOTO_CATEGORIAS.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFotoCategoria(cat)}
                        style={{
                          padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                          cursor: 'pointer', border: '1px solid',
                          background: fotoCategoria === cat ? 'rgba(10,102,255,0.12)' : 'transparent',
                          borderColor: fotoCategoria === cat ? 'rgba(10,102,255,0.4)' : 'var(--border)',
                          color: fotoCategoria === cat ? '#0A66FF' : 'var(--muted)',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', minHeight: 48, borderRadius: 10,
                      background: '#0A0A0A', border: 'none',
                      color: '#FAFAFA', fontSize: '1rem', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '0.5rem', marginBottom: '0.875rem',
                    }}
                  >
                    📷 Tomar foto
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    aria-hidden="true"
                  />
                </>
              )}

              {(allEvidencias.length > 0 || localPreviews.length > 0) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {allEvidencias.map((ev) => (
                    <PhotoThumb
                      key={ev.id}
                      src={ev.fotoUrlSigned}
                      alt={ev.tipo}
                      label={ev.tipo}
                      onClick={() => setLightboxUrl(ev.fotoUrlSigned)}
                    />
                  ))}
                  {localPreviews.map((p) => (
                    <UploadingThumb key={p.tempId} preview={p} onRetry={() => retryUpload(p.tempId)} />
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '0.75rem 0' }}>
                  Sin fotos — {!isReadOnly ? 'toma la primera 📷' : 'sin evidencias registradas'}
                </div>
              )}
            </SectionCard>

            {/* ── Visitas ───────────────────────────────────────────────────────── */}
            <SectionCard>
              <SectionTitle>Visitas · {visitas.length}</SectionTitle>

              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
                {(['MODULOS', 'ELECTRICO'] as const).map((t) => {
                  const active = visitaTab === t
                  return (
                    <button
                      key={t}
                      onClick={() => { setVisitaTab(t); setEditingVisitaId(null); setVisitaError(null) }}
                      style={{
                        flex: 1, minHeight: 38, borderRadius: 8,
                        background: active ? 'rgba(10,102,255,0.12)' : 'transparent',
                        border: active ? '1px solid rgba(10,102,255,0.4)' : '1px solid var(--border)',
                        color: active ? '#0A66FF' : 'var(--muted)',
                        fontSize: '0.8125rem', fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {VISITA_TIPO_LABEL[t]} ({visitaCountByTipo[t]})
                    </button>
                  )
                })}
              </div>

              {visitaError && (
                <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)', borderRadius: 8, color: 'var(--error)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                  {visitaError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: isReadOnly ? 0 : '0.75rem' }}>
                {visitasFiltradas.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '0.875rem 0', border: '1px dashed var(--border)', borderRadius: 8 }}>
                    Sin visitas en este tipo
                  </div>
                ) : (
                  visitasFiltradas.map((v, i) => {
                    const isEditing = editingVisitaId === v.id
                    const canEditThis = v.autorUserId === user?.id
                    return (
                      <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: 'rgba(10,102,255,0.06)', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(10,102,255,0.18)', color: '#0A66FF', borderRadius: 999, padding: '0.15rem 0.5rem' }}>Visita {i + 1}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{new Date(v.fecha).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</span>
                          </div>
                          {!isReadOnly && !isEditing && canEditThis && (
                            <button onClick={() => startEditVisita(v)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#0A66FF', fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.55rem', cursor: 'pointer' }}>
                              ✎ Editar
                            </button>
                          )}
                        </div>
                        <div style={{ padding: '0.625rem 0.75rem' }}>
                          {isEditing ? (
                            <>
                              <select value={editVisitaTipo} onChange={(e) => setEditVisitaTipo(e.target.value as VisitaTipo)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--fg)', fontSize: '0.875rem', padding: '0.45rem 0.6rem', marginBottom: '0.5rem' }}>
                                <option value="MODULOS">Mantenimiento de módulos</option>
                                <option value="ELECTRICO">Eléctrico</option>
                              </select>
                              <textarea value={editVisitaContenido} onChange={(e) => setEditVisitaContenido(e.target.value)} rows={4} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: '0.9rem', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                <button onClick={handleSaveEditVisita} disabled={savingVisita || !editVisitaContenido.trim()} style={{ flex: 1, height: 40, borderRadius: 8, background: editVisitaContenido.trim() && !savingVisita ? '#0A66FF' : 'var(--bg)', border: editVisitaContenido.trim() && !savingVisita ? 'none' : '1px solid var(--border)', color: editVisitaContenido.trim() && !savingVisita ? '#fff' : 'var(--muted)', fontSize: '0.8125rem', fontWeight: 700, cursor: savingVisita || !editVisitaContenido.trim() ? 'not-allowed' : 'pointer' }}>
                                  {savingVisita ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                                <button onClick={() => setEditingVisitaId(null)} disabled={savingVisita} style={{ flex: 1, height: 40, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{v.contenido}</div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {!isReadOnly && editingVisitaId === null && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Nueva visita en <strong style={{ color: 'var(--fg)' }}>{VISITA_TIPO_LABEL[visitaTab]}</strong>
                  </div>
                  <textarea
                    value={newVisitaContenido}
                    onChange={(e) => setNewVisitaContenido(e.target.value)}
                    placeholder="Describe los avances de esta visita…"
                    rows={4}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: '0.9375rem', lineHeight: 1.5, padding: '0.75rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={handleSaveVisita}
                    disabled={savingVisita || !newVisitaContenido.trim()}
                    style={{
                      marginTop: '0.5rem', width: '100%', height: 46, borderRadius: 10,
                      background: newVisitaContenido.trim() && !savingVisita ? '#0A66FF' : 'var(--bg)',
                      border: newVisitaContenido.trim() && !savingVisita ? 'none' : '1px solid var(--border)',
                      color: newVisitaContenido.trim() && !savingVisita ? '#fff' : 'var(--muted)',
                      fontSize: '0.9375rem', fontWeight: 700,
                      cursor: savingVisita || !newVisitaContenido.trim() ? 'not-allowed' : 'pointer',
                      opacity: savingVisita ? 0.7 : 1,
                    }}
                  >
                    {savingVisita ? 'Guardando…' : 'Guardar visita'}
                  </button>
                </div>
              )}
            </SectionCard>

          </div>
        </div>

        {/* ── STICKY FOOTER ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', bottom: 0, background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)', padding: '0.875rem',
          paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          {isFinal ? (
            <div style={{
              background: ot.estatus === 'COMPLETADA' ? 'rgba(21,128,61,0.08)' : 'rgba(185,28,28,0.06)',
              border: `1px solid ${ot.estatus === 'COMPLETADA' ? 'rgba(21,128,61,0.25)' : 'rgba(185,28,28,0.2)'}`,
              borderRadius: 10, padding: '0.875rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: ot.estatus === 'COMPLETADA' ? '#15803D' : '#B91C1C' }}>
                {ot.estatus === 'COMPLETADA' ? '✓ Orden completada' : '✗ Orden cancelada'}
              </div>
              {ot.fechaCompletada && (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  {new Date(ot.fechaCompletada).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              )}
            </div>
          ) : ot.estatus === 'BLOQUEADA' ? (
            <div style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.2)', borderRadius: 10, padding: '0.875rem', textAlign: 'center', color: '#B91C1C', fontSize: '0.9rem', fontWeight: 600 }}>
              ⚠ OT bloqueada — esperando intervención del supervisor
            </div>
          ) : ot.estatus === 'EN_REVISION' ? (
            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '0.875rem', textAlign: 'center', color: '#7C3AED', fontSize: '0.9rem', fontWeight: 600 }}>
              ✋ Enviado a revisión — pendiente de aprobación
            </div>
          ) : (
            <>
              {canComplete && (
                <button
                  onClick={() => hasEvidencias && setShowConfirm(true)}
                  disabled={!hasEvidencias}
                  style={{
                    width: '100%', height: 52, borderRadius: 12,
                    background: hasEvidencias ? '#0A0A0A' : 'var(--bg-surface-2)',
                    border: hasEvidencias ? 'none' : '1px solid var(--border)',
                    color: hasEvidencias ? '#FAFAFA' : 'var(--muted)',
                    fontSize: '1rem', fontWeight: 700,
                    cursor: hasEvidencias ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {hasEvidencias ? (ot.requiereRevision ? 'Enviar a revisión' : 'Completar orden') : '🔒 Agrega una foto primero'}
                </button>
              )}
              {canBloquear && (
                <button
                  onClick={() => setShowBloquearModal(true)}
                  style={{
                    width: '100%', height: 44, borderRadius: 10,
                    background: 'transparent', border: '1px solid rgba(185,28,28,0.3)',
                    color: '#B91C1C', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ⚠ Reportar problema / Bloquear
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <img src={lightboxUrl} alt="Evidencia fotográfica" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%', color: '#fff', cursor: 'pointer',
              fontSize: '1.25rem', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── COMPLETAR CONFIRM ────────────────────────────────────────────────── */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
        >
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '20px 20px 12px 12px', padding: '1.5rem 1.25rem',
            width: '100%', maxWidth: 480,
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {ot.requiereRevision ? '¿Enviar a revisión?' : '¿Completar la orden?'}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                {ot.folio} · {allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length} foto{(allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length) !== 1 ? 's' : ''} registrada{(allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length) !== 1 ? 's' : ''}
              </div>
              {ot.requiereRevision && (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  El trabajo quedará pendiente de aprobación del supervisor.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleCompletar}
                disabled={completing}
                style={{
                  width: '100%', height: 52, borderRadius: 10,
                  background: '#0A0A0A', border: 'none', color: '#FAFAFA',
                  fontSize: '1rem', fontWeight: 700, cursor: 'pointer', opacity: completing ? 0.7 : 1,
                }}
              >
                {completing ? 'Enviando…' : (ot.requiereRevision ? 'Sí, enviar a revisión' : 'Sí, completar')}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--fg)', fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLOQUEAR MODAL ───────────────────────────────────────────────────── */}
      {showBloquearModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowBloquearModal(false)}
        >
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '20px 20px 12px 12px', padding: '1.5rem 1.25rem',
            width: '100%', maxWidth: 480,
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#B91C1C', marginBottom: '0.375rem' }}>⚠ Reportar problema</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Describe el problema o impedimento para continuar (mínimo 10 caracteres)</div>
            </div>
            <textarea
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value)}
              placeholder="Ej: Falta material, acceso restringido, condiciones climáticas…"
              rows={4}
              style={{
                width: '100%', background: 'var(--bg)', border: `1px solid ${bloquearError ? 'var(--error)' : 'var(--border)'}`,
                borderRadius: 8, color: 'var(--fg)', fontSize: '0.9rem', padding: '0.75rem',
                resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: motivoBloqueo.trim().length < 10 ? 'var(--muted)' : '#15803D', marginBottom: '0.875rem', textAlign: 'right' }}>
              {motivoBloqueo.trim().length}/10 mínimo
            </div>
            {bloquearError && <div style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '0.5rem' }}>{bloquearError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleBloquear}
                disabled={bloqueando || motivoBloqueo.trim().length < 10}
                style={{
                  width: '100%', height: 48, borderRadius: 10,
                  background: motivoBloqueo.trim().length >= 10 ? '#B91C1C' : 'var(--bg-surface-2)',
                  border: 'none', color: motivoBloqueo.trim().length >= 10 ? '#fff' : 'var(--muted)',
                  fontSize: '0.9375rem', fontWeight: 700,
                  cursor: motivoBloqueo.trim().length >= 10 ? 'pointer' : 'not-allowed',
                  opacity: bloqueando ? 0.7 : 1,
                }}
              >
                {bloqueando ? 'Reportando…' : 'Reportar y bloquear'}
              </button>
              <button
                onClick={() => { setShowBloquearModal(false); setMotivoBloqueo(''); setBloquearError(null) }}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--fg)', fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Helper subcomponents ─────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.175rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>{value}</div>
    </div>
  )
}

function PhotoThumb({ src, alt, label, onClick }: { src: string; alt: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Ver foto: ${alt}`}
      style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
        padding: 0, cursor: 'pointer', aspectRatio: '1', overflow: 'hidden',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement
          el.style.display = 'none'
        }}
      />
      {label && label !== 'INSTALACION' && (
        <span style={{
          position: 'absolute', bottom: 3, left: 3,
          background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.55rem',
          fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: 3, letterSpacing: '0.03em',
        }}>
          {label}
        </span>
      )}
    </button>
  )
}

function UploadingThumb({ preview, onRetry }: { preview: LocalPreview; onRetry: () => void }) {
  return (
    <div style={{
      aspectRatio: '1', borderRadius: 8, overflow: 'hidden', position: 'relative',
      border: `1px solid ${preview.status === 'error' ? 'var(--error)' : 'var(--border)'}`,
    }}>
      <img src={preview.previewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: preview.status === 'uploading' ? 0.45 : 1 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
        {preview.status === 'uploading' && (
          <div style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', padding: '0 4px' }}>Subiendo…</div>
        )}
        {preview.status === 'done' && (
          <div style={{ background: '#15803D', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>✓</div>
        )}
        {preview.status === 'error' && (
          <button
            onClick={onRetry}
            style={{ background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', cursor: 'pointer' }}
          >
            ✗ Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
