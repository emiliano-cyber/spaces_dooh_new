'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'

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
}

const AVANCE_PLACEHOLDER = 'Describe los avances, condiciones encontradas, materiales usados, observaciones…'

interface LocalPreview {
  tempId: string
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  file?: File // kept for retry
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
  PENDIENTE: '#9090aa',
  ASIGNADA: '#6c63ff',
  EN_PROCESO: '#fbbf24',
  COMPLETADA: '#b8f000',
  CANCELADA: '#ff5f5f',
}

const PRIORIDAD_C: Record<string, string> = {
  URGENTE: '#ff5f5f',
  ALTA: '#fbbf24',
  NORMAL: '#9090aa',
  BAJA: '#7a7a96',
}

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
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      const attempt = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Canvas toBlob failed')); return }
            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.3) { resolve(blob); return }
            attempt(Math.round((quality - 0.1) * 10) / 10)
          },
          'image/jpeg',
          quality,
        )
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
      background: `${color}22`, color, border: `1px solid ${color}44`,
      padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '1.125rem 1.125rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.875rem',
    }}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OTMovil({ ot, onRefetch }: Props) {
  const router = useRouter()

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

  const fileInputRef = useRef<HTMLInputElement>(null)

  const checklistItems: ChecklistItem[] = Array.isArray(ot.checklistJson) ? ot.checklistJson : []
  const totalItems = checklistItems.length
  const doneItems = checklistItems.filter((i) => i.completado).length

  // Incomplete first, completed at bottom
  const sortedChecklist = [...checklistItems].sort((a, b) => {
    if (a.completado === b.completado) return 0
    return a.completado ? 1 : -1
  })

  const allEvidencias = ot.evidencias
  const hasEvidencias = allEvidencias.length > 0 || localPreviews.some((p) => p.status === 'done')
  const isCompleted = ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA'

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
      // silent — UI will reconcile on next refetch
    }
  }

  // ── Photo upload ──────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const previewUrl = URL.createObjectURL(file)

    setLocalPreviews((prev) => [...prev, { tempId, previewUrl, status: 'uploading', file }])
    setUploadError(null)

    try {
      // 1. Compress
      const compressed = await compressImage(file)

      // 2. Get signed upload URL
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `/ordenes-trabajo/${ot.id}/evidencias/upload-url`,
        { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: 'image/jpeg' }) },
      )

      // 3. PUT to storage (skip for placeholder dev URLs)
      const isPlaceholder = uploadUrl.includes('placeholder.storage')
      if (!isPlaceholder) {
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: compressed,
          headers: { 'Content-Type': 'image/jpeg' },
        })
        if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)
      }

      // 4. Register evidencia in DB
      await apiFetch(`/ordenes-trabajo/${ot.id}/evidencias`, {
        method: 'POST',
        body: JSON.stringify({ storageKey: key }),
      })

      // 5. Mark done — keep previewUrl for display; will be replaced by signed URL on refetch
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
    // reset so same file can be selected again
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
        method: 'PATCH',
        body: JSON.stringify({ notas: notasValue }),
      })
      setNotasSaved(true)
      setTimeout(() => setNotasSaved(false), 2500)
      onRefetch()
    } catch {
      // silent
    } finally {
      setSavingNotas(false)
    }
  }

  // ── Complete OT ───────────────────────────────────────────────────────────────

  async function handleCompletar() {
    setCompleting(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/completar`, {
        method: 'POST',
        body: JSON.stringify({}),
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

  // ── Success screen ────────────────────────────────────────────────────────────

  if (completed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0c0c0f', zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', gap: '1.5rem',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', background: 'rgba(184,240,0,0.15)',
          border: '3px solid #b8f000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.5rem',
          animation: 'ot-pop 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both',
        }}>
          ✓
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#b8f000', marginBottom: '0.5rem' }}>
            Orden completada
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            {ot.folio} · {new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
        <button
          onClick={() => router.push('/operaciones/ordenes')}
          aria-label="Volver a lista de órdenes"
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
            color: 'var(--fg)', cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
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

  const HEADER_H = 68
  const FOOTER_H = isCompleted ? 72 : 80

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

      {/* Full-screen overlay to cover the desktop sidebar/layout */}
      <div style={{
        position: 'fixed', inset: 0, background: '#0c0c0f',
        zIndex: 100, display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ibm-plex-sans), system-ui, sans-serif',
      }}>

        {/* ── STICKY HEADER ────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#0c0c0f', borderBottom: '1px solid var(--border)',
          height: HEADER_H, flexShrink: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '0 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
            <button
              onClick={() => router.back()}
              aria-label="Volver"
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: '1.375rem', padding: '0 0.25rem',
                lineHeight: 1, minWidth: 32, minHeight: 32,
                display: 'flex', alignItems: 'center',
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'monospace', color: 'var(--fg)' }}>
              {ot.folio}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', paddingLeft: '2.5rem', flexWrap: 'wrap' }}>
            <MBadge label={TIPO_LABELS[ot.tipo] ?? ot.tipo} color="#6c63ff" />
            <MBadge label={ot.estatus.replace(/_/g, ' ')} color={ESTATUS_C[ot.estatus] ?? '#9090aa'} />
            {(ot.prioridad === 'URGENTE' || ot.prioridad === 'ALTA') && (
              <MBadge label={ot.prioridad} color={PRIORIDAD_C[ot.prioridad]} />
            )}
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `1rem 1rem ${FOOTER_H + 16}px` }}>

          {/* Network error banner */}
          {uploadError && (
            <div style={{
              background: 'rgba(255,92,115,0.12)', border: '1px solid var(--error)',
              borderRadius: 10, color: 'var(--error)', fontSize: '0.9rem',
              padding: '0.75rem 1rem', marginBottom: '0.875rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{uploadError}</span>
              <button
                onClick={() => setUploadError(null)}
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* ── SECCIÓN 2: Info básica (colapsable) ──────────────────────── */}
            <SectionCard>
              <button
                onClick={() => setInfoOpen((o) => !o)}
                aria-label={infoOpen ? 'Cerrar detalles' : 'Ver detalles'}
                style={{
                  background: 'none', border: 'none', width: '100%', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 0, color: 'var(--fg)',
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Ver detalles</span>
                <span style={{
                  fontSize: '1rem', color: 'var(--muted)',
                  transform: infoOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>▾</span>
              </button>

              {infoOpen && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <InfoRow label="Descripción" value={ot.descripcion} />
                  {ot.instrucciones && <InfoRow label="Instrucciones" value={ot.instrucciones} />}
                  {ot.sitioId && <InfoRow label="Sitio" value={ot.sitioId} />}
                  {ot.fechaProgramada && (
                    <InfoRow label="Fecha programada" value={new Date(ot.fechaProgramada).toLocaleDateString('es-MX', { dateStyle: 'long' })} />
                  )}
                  {ot.notas && <InfoRow label="Notas" value={ot.notas} />}
                </div>
              )}
            </SectionCard>

            {/* ── SECCIÓN 3: Checklist ────────────────────────────────────── */}
            {totalItems > 0 && (
              <SectionCard>
                <SectionTitle>
                  Lista de tareas · {doneItems}/{totalItems} completadas
                </SectionTitle>

                {/* Progress bar */}
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, marginBottom: '1rem', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%`,
                    background: '#b8f000', borderRadius: 3,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {sortedChecklist.map((item) => (
                    <label
                      key={item.id}
                      aria-label={item.texto}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid var(--border)',
                        cursor: isCompleted ? 'default' : 'pointer',
                        opacity: item.completado ? 0.55 : 1,
                        transition: 'opacity 0.25s',
                      }}
                    >
                      {/* Large checkbox */}
                      <div
                        className="ot-cb"
                        role="checkbox"
                        aria-checked={item.completado}
                        onClick={() => !isCompleted && toggleChecklist(item.id, !item.completado)}
                        style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          border: item.completado ? 'none' : '2px solid var(--border)',
                          background: item.completado ? '#b8f000' : 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.125rem', color: '#0c0c0f', fontWeight: 700,
                          transform: poppingItem === item.id ? 'scale(0.82)' : 'scale(1)',
                          transition: 'transform 0.15s ease, background 0.2s, border 0.2s',
                          cursor: isCompleted ? 'default' : 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {item.completado ? '✓' : ''}
                      </div>

                      <span style={{
                        fontSize: '1rem', lineHeight: 1.4,
                        textDecoration: item.completado ? 'line-through' : 'none',
                        color: item.completado ? 'var(--muted)' : 'var(--fg)',
                        flex: 1,
                      }}>
                        {item.texto}
                      </span>
                    </label>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── SECCIÓN 4: Evidencias ───────────────────────────────────── */}
            <SectionCard>
              <SectionTitle>
                Fotografías · {allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length} foto{allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length !== 1 ? 's' : ''}
              </SectionTitle>

              {/* Camera button — full width, 48px+ */}
              {!isCompleted && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Tomar foto con la cámara"
                    style={{
                      width: '100%', minHeight: 52, borderRadius: 12,
                      background: '#b8f000', border: 'none',
                      color: '#0c0c0f', fontSize: '1.0625rem', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '0.5rem',
                      marginBottom: '1rem', letterSpacing: '0.01em',
                      boxShadow: '0 2px 12px rgba(184,240,0,0.25)',
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

              {/* Photos grid — 3 columns */}
              {(allEvidencias.length > 0 || localPreviews.length > 0) && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                }}>
                  {/* Committed evidencias */}
                  {allEvidencias.map((ev) => (
                    <PhotoThumb
                      key={ev.id}
                      src={ev.fotoUrlSigned}
                      alt={ev.tipo}
                      onClick={() => setLightboxUrl(ev.fotoUrlSigned)}
                    />
                  ))}

                  {/* Local previews (uploading / done / error) */}
                  {localPreviews.map((p) => (
                    <UploadingThumb
                      key={p.tempId}
                      preview={p}
                      onRetry={() => retryUpload(p.tempId)}
                    />
                  ))}
                </div>
              )}

              {allEvidencias.length === 0 && localPreviews.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                  Sin fotos — toma la primera 📷
                </div>
              )}
            </SectionCard>

            {/* ── SECCIÓN 5: Notas / Avance ───────────────────────────────── */}
            <SectionCard>
              <SectionTitle>Notas de avance</SectionTitle>
              <textarea
                value={notasValue}
                onChange={(e) => setNotasValue(e.target.value)}
                disabled={isCompleted}
                placeholder={AVANCE_PLACEHOLDER}
                rows={4}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--fg)', fontSize: '0.9375rem',
                  lineHeight: 1.5, padding: '0.75rem', resize: 'vertical',
                  fontFamily: 'var(--font-ibm-plex-sans), system-ui, sans-serif',
                  outline: 'none', boxSizing: 'border-box',
                  opacity: isCompleted ? 0.6 : 1,
                }}
              />
              {!isCompleted && (
                <button
                  onClick={saveNotas}
                  disabled={savingNotas || notasValue === (ot.notas ?? '')}
                  style={{
                    marginTop: '0.625rem', width: '100%', height: 44, borderRadius: 10,
                    background: notasSaved ? 'rgba(184,240,0,0.15)' : 'var(--bg)',
                    border: notasSaved ? '1px solid rgba(184,240,0,0.4)' : '1px solid var(--border)',
                    color: notasSaved ? '#b8f000' : 'var(--fg)',
                    fontSize: '0.9rem', fontWeight: 600, cursor: savingNotas || notasValue === (ot.notas ?? '') ? 'not-allowed' : 'pointer',
                    opacity: notasValue === (ot.notas ?? '') && !notasSaved ? 0.45 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {notasSaved ? '✓ Guardado' : savingNotas ? 'Guardando…' : 'Guardar notas'}
                </button>
              )}
            </SectionCard>

          </div>
        </div>

        {/* ── STICKY BOTTOM ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', bottom: 0, background: '#0c0c0f',
          borderTop: '1px solid var(--border)', padding: '0.875rem 1rem',
          paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))',
          flexShrink: 0,
        }}>
          {isCompleted ? (
            <div style={{
              background: 'rgba(184,240,0,0.1)', border: '1px solid rgba(184,240,0,0.3)',
              borderRadius: 14, padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#b8f000' }}>
                ✓ Orden completada
              </div>
              {ot.fechaCompletada && (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {new Date(ot.fechaCompletada).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                onClick={() => hasEvidencias && setShowConfirm(true)}
                disabled={!hasEvidencias}
                aria-label={hasEvidencias ? 'Completar orden de trabajo' : 'Agrega una foto primero'}
                title={hasEvidencias ? undefined : 'Agrega una foto primero'}
                style={{
                  width: '100%', height: 56, borderRadius: 14,
                  background: hasEvidencias ? '#b8f000' : 'var(--bg-surface)',
                  border: hasEvidencias ? 'none' : '1px solid var(--border)',
                  color: hasEvidencias ? '#0c0c0f' : 'var(--muted)',
                  fontSize: '1rem', fontWeight: 700, cursor: hasEvidencias ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s', letterSpacing: '0.01em',
                  boxShadow: hasEvidencias ? '0 2px 16px rgba(184,240,0,0.2)' : 'none',
                }}
              >
                {hasEvidencias ? 'Completar orden de trabajo' : '🔒 Agrega una foto primero'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Evidencia fotográfica"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Cerrar imagen"
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

      {/* ── CONFIRM MODAL ────────────────────────────────────────────────────── */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
        >
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '20px 20px 14px 14px', padding: '1.5rem 1.25rem',
            width: '100%', maxWidth: 480,
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                ¿Completar la orden?
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                {ot.folio} · {allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length} foto{(allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length) !== 1 ? 's' : ''} registrada{(allEvidencias.length + localPreviews.filter((p) => p.status === 'done').length) !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <button
                onClick={handleCompletar}
                disabled={completing}
                aria-label="Confirmar completar orden"
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  background: '#b8f000', border: 'none', color: '#0c0c0f',
                  fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  opacity: completing ? 0.7 : 1,
                }}
              >
                {completing ? 'Completando…' : 'Sí, completar'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                aria-label="Cancelar"
                style={{
                  width: '100%', height: 48, borderRadius: 12,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--fg)', fontSize: '1rem', cursor: 'pointer',
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
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.9375rem', lineHeight: 1.45 }}>{value}</div>
    </div>
  )
}

function PhotoThumb({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Ver foto: ${alt}`}
      style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
        padding: 0, cursor: 'pointer', aspectRatio: '1', overflow: 'hidden',
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
          const fallback = el.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div style={{ display: 'none', fontSize: '1.5rem', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
        📷
      </div>
    </button>
  )
}

function UploadingThumb({ preview, onRetry }: { preview: LocalPreview; onRetry: () => void }) {
  return (
    <div style={{
      aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative',
      border: `1px solid ${preview.status === 'error' ? 'var(--error)' : 'var(--border)'}`,
    }}>
      <img
        src={preview.previewUrl}
        alt="Vista previa"
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: preview.status === 'uploading' ? 0.45 : 1 }}
      />
      {/* Status overlay */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.35)',
      }}>
        {preview.status === 'uploading' && (
          <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', padding: '0 4px' }}>
            Subiendo…
          </div>
        )}
        {preview.status === 'done' && (
          <div style={{
            background: '#b8f000', color: '#0c0c0f', borderRadius: '50%',
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 700,
          }}>✓</div>
        )}
        {preview.status === 'error' && (
          <button
            onClick={onRetry}
            aria-label="Reintentar subida"
            style={{
              background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 8,
              fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.5rem', cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            ✗ Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
