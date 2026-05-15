'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import OTMovil from '@/components/operaciones/OTMovil'

interface ChecklistItem { id: string; texto: string; completado: boolean; completadoEn?: string; completadoPorUserId?: string; notaRealizado?: string | null; notaPendiente?: string | null }
interface Evidencia { id: string; fotoUrl: string; fotoUrlSigned: string; storageKey: string; tipo: string; timestamp: string; lat?: number; lng?: number }
type VisitaTipo = 'MODULOS' | 'ELECTRICO'
interface Visita {
  id: string; tipo: VisitaTipo; contenido: string; fecha: string
  autorUserId: string | null; autorNombre: string | null
  creadoEn: string; actualizadoEn: string
}
interface OT {
  id: string; folio: string; tipo: string; descripcion: string; instrucciones?: string
  prioridad: string; estatus: string; sitioId?: string; sitioNombre?: string; asignadoAUserId?: string
  fechaProgramada?: string; fechaInicio?: string; fechaCompletada?: string
  campanaId?: string; notas?: string; checklistJson: ChecklistItem[]
  evidencias: Evidencia[]; creadoEn: string; actualizadoEn: string
  motivoBloqueo?: string; revisionNotas?: string; revisadoPorUserId?: string; revisadoEn?: string
  tiempoTrabajadoMin?: number | null; requiereRevision?: boolean
  horaLlegada?: string; horaTerminoLabores?: string
  sesionesJson?: Array<{ inicio: string; termino: string | null; userId: string }>
  visitasJson?: Visita[]
}

const VISITA_TIPO_LABEL: Record<VisitaTipo, string> = {
  MODULOS: 'Mantenimiento de módulos',
  ELECTRICO: 'Eléctrico',
}
interface UserItem { id: string; nombre: string; email: string }
interface LocalPreview { tempId: string; previewUrl: string; status: 'uploading' | 'done' | 'error'; file?: File }

const TIPO_LABELS: Record<string, string> = {
  MONTAJE_LONA: 'Montaje de lona', MONTAJE_DIGITAL: 'Montaje digital', DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mtto. preventivo', MANTENIMIENTO_CORRECTIVO: 'Mtto. correctivo',
  HERRERIA: 'Herrería', ELECTRICO: 'Eléctrico', INSPECCION: 'Inspección', OTRO: 'Otro',
}
const PRIORIDAD_C: Record<string, string> = { URGENTE: '#B91C1C', ALTA: '#B45309', NORMAL: '#71717A', BAJA: '#A1A1AA' }
const ESTATUS_C: Record<string, string> = {
  PENDIENTE: '#71717A', ASIGNADA: '#0A66FF', EN_PROCESO: '#B45309',
  BLOQUEADA: '#B91C1C', EN_REVISION: '#7C3AED', COMPLETADA: '#15803D',
  RECHAZADA: '#B45309', CANCELADA: '#71717A',
}
const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', ASIGNADA: 'Asignada', EN_PROCESO: 'En proceso',
  BLOQUEADA: 'Bloqueada', EN_REVISION: 'En revisión', COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
}
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}
function fmt(d?: string | null) { return d ? new Date(d).toLocaleString('es-MX') : '—' }

function parseNotasPorDia(notas: string): Array<{ titulo: string; contenido: string }> {
  const segments: Array<{ titulo: string; contenido: string }> = []
  let current: { titulo: string; lineas: string[] } | null = null
  for (const line of notas.split('\n')) {
    if (/^VISITA\s+\d+\s+-\s+\d{2}\/\d{2}\/\d{4}:?\s*$/.test(line.trim())) {
      if (current) segments.push({ titulo: current.titulo, contenido: current.lineas.join('\n').trim() })
      current = { titulo: line.trim().replace(/:$/, ''), lineas: [] }
    } else if (current) {
      current.lineas.push(line)
    }
  }
  if (current) segments.push({ titulo: current.titulo, contenido: current.lineas.join('\n').trim() })
  return segments
}

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
      const attempt = (q: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          if (blob.size <= maxSizeMB * 1024 * 1024 || q <= 0.3) { resolve(blob); return }
          attempt(Math.round((q - 0.1) * 10) / 10)
        }, 'image/jpeg', q)
      }
      attempt(0.8)
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.8375rem', padding: '0.45rem 0.75rem', outline: 'none', width: '100%' }
const editLbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }

const FOTO_CATEGORIAS = ['ANTES', 'DURANTE', 'INSTALACION', 'PROBLEMA', 'DESPUES'] as const
type FotoCategoria = typeof FOTO_CATEGORIAS[number]

function OTDesktop({ ot, onRefetch }: { ot: OT; onRefetch: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const canAssign = user?.rol === 'owner' || user?.rol === 'admin' ||
    (user?.permisos as string[] | undefined)?.includes('*') ||
    user?.permisos.includes('ots:assign')
  const canComplete = !!(user?.rol === 'owner' || user?.rol === 'admin' ||
    (user?.permisos as string[] | undefined)?.includes('*') ||
    user?.permisos.includes('ots:complete'))

  const isFinal = ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA'
  const isEditable = !isFinal && ot.estatus !== 'EN_REVISION'

  // upload
  const [fotoCategoria, setFotoCategoria] = useState<FotoCategoria>('INSTALACION')
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // notas
  const [notasValue, setNotasValue] = useState(ot.notas ?? '')
  const [savingNotas, setSavingNotas] = useState(false)
  const [notasSaved, setNotasSaved] = useState(false)

  // visitas
  const [visitaTab, setVisitaTab] = useState<VisitaTipo>('MODULOS')
  const [newVisitaContenido, setNewVisitaContenido] = useState('')
  const [savingVisita, setSavingVisita] = useState(false)
  const [visitaError, setVisitaError] = useState<string | null>(null)
  const [editingVisitaId, setEditingVisitaId] = useState<string | null>(null)
  const [editVisitaContenido, setEditVisitaContenido] = useState('')
  const [editVisitaTipo, setEditVisitaTipo] = useState<VisitaTipo>('MODULOS')

  // assign
  const [selectedUser, setSelectedUser] = useState(ot.asignadoAUserId ?? '')
  const [savingAssign, setSavingAssign] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // editar información (descripción, sitio, asignado, fecha programada)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editDescripcion, setEditDescripcion] = useState(ot.descripcion)
  const [editSitioId, setEditSitioId] = useState(ot.sitioId ?? '')
  const [editAsignadoA, setEditAsignadoA] = useState(ot.asignadoAUserId ?? '')
  const [editFecha, setEditFecha] = useState(ot.fechaProgramada ? ot.fechaProgramada.slice(0, 10) : '')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)

  // complete
  const [completing, setCompleting] = useState(false)
  const [completarError, setCompletarError] = useState<string | null>(null)

  // bloquear modal
  const [showBloquearModal, setShowBloquearModal] = useState(false)
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [bloqueando, setBloqueando] = useState(false)
  const [bloquearError, setBloquearError] = useState<string | null>(null)

  // aprobar
  const [aprovando, setAprovando] = useState(false)
  const [notasRevision, setNotasRevision] = useState('')

  // rechazar modal
  const [showRechazarModal, setShowRechazarModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [rechazarError, setRechazarError] = useState<string | null>(null)

  // reabrir
  const [reabriendo, setReabriendo] = useState(false)

  // cancelar modal
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [cancelando, setCancelando] = useState(false)

  // eliminar modal
  const [showEliminarModal, setShowEliminarModal] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // action error
  const [actionError, setActionError] = useState<string | null>(null)

  // checklist inline form
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [pendingRealizado, setPendingRealizado] = useState('')
  const [pendingFalta, setPendingFalta] = useState('')
  const [savingChecklist, setSavingChecklist] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<UserItem[]>('/admin/users'),
    enabled: !!canAssign,
  })

  const { data: sitiosData } = useQuery({
    queryKey: ['sitios-select'],
    queryFn: () => apiFetch<{ data: { id: string; nombre: string; claveInterna: string }[] }>('/sitios?limit=500').then((r) => r.data),
    enabled: !!canAssign,
  })

  const checklistItems: ChecklistItem[] = Array.isArray(ot.checklistJson) ? ot.checklistJson : []
  const totalItems = checklistItems.length
  const doneItems = checklistItems.filter((i) => i.completado).length
  const hasEvidencias = ot.evidencias.length > 0 || localPreviews.some((p) => p.status === 'done')

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
        const putRes = await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' } })
        if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)
      }
      await apiFetch(`/ordenes-trabajo/${ot.id}/evidencias`, {
        method: 'POST',
        body: JSON.stringify({ storageKey: key, tipo: fotoCategoria, tamanoMb: Math.round(sizeMb * 100) / 100 }),
      })
      setLocalPreviews((prev) => prev.map((p) => p.tempId === tempId ? { ...p, status: 'done', previewUrl } : p))
      onRefetch()
    } catch {
      URL.revokeObjectURL(previewUrl)
      setLocalPreviews((prev) => prev.map((p) => p.tempId === tempId ? { ...p, status: 'error' } : p))
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

  function handleCheckboxChange(itemId: string, checked: boolean) {
    if (!checked) {
      apiFetch(`/ordenes-trabajo/${ot.id}/checklist`, {
        method: 'PATCH', body: JSON.stringify({ itemId, completado: false }),
      }).then(() => onRefetch())
      return
    }
    setPendingItemId(itemId)
    setPendingRealizado('')
    setPendingFalta('')
  }

  async function confirmChecklist() {
    if (!pendingItemId) return
    setSavingChecklist(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({
          itemId: pendingItemId,
          completado: true,
          notaRealizado: pendingRealizado.trim() || undefined,
          notaPendiente: pendingFalta.trim() || undefined,
        }),
      })
      setPendingItemId(null)
      onRefetch()
    } finally {
      setSavingChecklist(false)
    }
  }

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
    } finally { setSavingNotas(false) }
  }

  async function handleAssign() {
    if (!selectedUser) return
    setSavingAssign(true); setAssignError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ asignadoAUserId: selectedUser }),
      })
      qc.invalidateQueries({ queryKey: ['ot', ot.id] })
      onRefetch()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Error al asignar')
    } finally { setSavingAssign(false) }
  }

  function startEditInfo() {
    setEditDescripcion(ot.descripcion)
    setEditSitioId(ot.sitioId ?? '')
    setEditAsignadoA(ot.asignadoAUserId ?? '')
    setEditFecha(ot.fechaProgramada ? ot.fechaProgramada.slice(0, 10) : '')
    setInfoError(null)
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    if (!editDescripcion.trim()) {
      setInfoError('La descripción no puede estar vacía')
      return
    }
    setSavingInfo(true); setInfoError(null)
    try {
      const body: Record<string, unknown> = {}
      if (editDescripcion.trim() !== ot.descripcion) body.descripcion = editDescripcion.trim()
      if (editSitioId !== (ot.sitioId ?? '')) body.sitioId = editSitioId
      if (editAsignadoA !== (ot.asignadoAUserId ?? '')) body.asignadoAUserId = editAsignadoA
      const currentFecha = ot.fechaProgramada ? ot.fechaProgramada.slice(0, 10) : ''
      if (editFecha !== currentFecha) {
        body.fechaProgramada = editFecha ? new Date(editFecha + 'T12:00:00').toISOString() : null
      }
      if (Object.keys(body).length > 0) {
        await apiFetch(`/ordenes-trabajo/${ot.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        qc.invalidateQueries({ queryKey: ['ot', ot.id] })
        onRefetch()
      }
      setEditingInfo(false)
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Error al guardar los cambios')
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleCompletar() {
    setCompletarError(null); setCompleting(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/completar`, { method: 'POST', body: JSON.stringify({}) })
      onRefetch()
    } catch (err) {
      setCompletarError(err instanceof Error ? err.message : 'Error al completar la OT')
    } finally { setCompleting(false) }
  }

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
      setBloquearError(err instanceof Error ? err.message : 'Error al bloquear')
    } finally { setBloqueando(false) }
  }

  async function handleAprobar() {
    setAprovando(true); setActionError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/aprobar`, {
        method: 'POST', body: JSON.stringify({ notas: notasRevision || undefined }),
      })
      onRefetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al aprobar')
    } finally { setAprovando(false) }
  }

  async function handleRechazar() {
    if (motivoRechazo.trim().length < 10) return
    setRechazando(true); setRechazarError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/rechazar`, {
        method: 'POST', body: JSON.stringify({ motivo: motivoRechazo }),
      })
      setShowRechazarModal(false)
      onRefetch()
    } catch (err) {
      setRechazarError(err instanceof Error ? err.message : 'Error al rechazar')
    } finally { setRechazando(false) }
  }

  async function handleReabrir() {
    setReabriendo(true); setActionError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/reabrir`, { method: 'POST', body: JSON.stringify({}) })
      onRefetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al reabrir')
    } finally { setReabriendo(false) }
  }

  async function handleCancelar() {
    if (motivoCancelacion.trim().length < 5) return
    setCancelando(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/cancelar`, {
        method: 'POST', body: JSON.stringify({ motivo: motivoCancelacion }),
      })
      setShowCancelarModal(false)
      onRefetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al cancelar la OT')
    } finally { setCancelando(false) }
  }

  async function handleEliminar() {
    setEliminando(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}`, { method: 'DELETE' })
      router.replace('/operaciones/ordenes')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar la OT')
      setShowEliminarModal(false)
    } finally { setEliminando(false) }
  }

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

  async function handleDeleteVisita(visitaId: string) {
    if (!confirm('¿Eliminar esta visita? No se puede deshacer.')) return
    setSavingVisita(true); setVisitaError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/visitas/${visitaId}`, { method: 'DELETE' })
      onRefetch()
    } catch (err) {
      setVisitaError(err instanceof Error ? err.message : 'Error al eliminar visita')
    } finally { setSavingVisita(false) }
  }

  const estatusColor = ESTATUS_C[ot.estatus] ?? '#71717A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
          ← Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'monospace' }}>{ot.folio}</h1>
          <Badge label={ot.tipo.split(',').map((t) => TIPO_LABELS[t.trim()] ?? t.trim()).join(' + ')} color="#0A66FF" />
          <Badge label={ot.prioridad} color={PRIORIDAD_C[ot.prioridad] ?? '#71717A'} />
          <Badge label={ESTATUS_LABEL[ot.estatus] ?? ot.estatus} color={estatusColor} />
        </div>
      </div>

      {/* State banners */}
      {ot.estatus === 'BLOQUEADA' && ot.motivoBloqueo && (
        <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.3)', borderLeft: '3px solid #B91C1C', borderRadius: '8px', padding: '0.875rem 1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#B91C1C', marginBottom: '0.25rem' }}>⚠ OT bloqueada</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg)' }}>{ot.motivoBloqueo}</div>
        </div>
      )}
      {ot.estatus === 'RECHAZADA' && ot.revisionNotas && (
        <div style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.3)', borderLeft: '3px solid #B45309', borderRadius: '8px', padding: '0.875rem 1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#B45309', marginBottom: '0.25rem' }}>✗ Re-trabajo solicitado</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg)' }}>{ot.revisionNotas}</div>
        </div>
      )}
      {ot.estatus === 'EN_REVISION' && (
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderLeft: '3px solid #7C3AED', borderRadius: '8px', padding: '0.875rem 1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7C3AED' }}>✋ Trabajo enviado — pendiente de aprobación del supervisor</div>
        </div>
      )}

      {actionError && (
        <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Two-column: left = content + comunicación, right = all action panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT — contenido + comunicación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Info */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Información</h3>
              {canAssign && !isFinal && !editingInfo && (
                <button onClick={startEditInfo} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.7rem' }}>
                  ✎ Editar
                </button>
              )}
            </div>

            {editingInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {infoError && (
                  <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)', borderRadius: '7px', color: 'var(--error)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>
                    {infoError}
                  </div>
                )}
                <div>
                  <label style={editLbl}>Descripción</label>
                  <textarea rows={3} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={editLbl}>Sitio</label>
                  <select value={editSitioId} onChange={(e) => setEditSitioId(e.target.value)} style={inp}>
                    <option value="">Sin sitio asignado</option>
                    {(sitiosData ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.claveInterna} — {s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={editLbl}>Asignado a</label>
                  <select value={editAsignadoA} onChange={(e) => setEditAsignadoA(e.target.value)} style={inp}>
                    <option value="">Sin asignar</option>
                    {(usersData ?? []).map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={editLbl}>Fecha programada</label>
                  <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleSaveInfo} disabled={savingInfo} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: savingInfo ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '0.5rem 1rem', opacity: savingInfo ? 0.7 : 1 }}>
                    {savingInfo ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditingInfo(false)} disabled={savingInfo} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.5rem 1rem' }}>
                    Cancelar
                  </button>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                  <Row label="Fecha inicio" value={fmt(ot.fechaInicio)} />
                  <Row label="Fecha completada" value={fmt(ot.fechaCompletada)} />
                  {ot.tiempoTrabajadoMin != null && (
                    <Row label="Tiempo trabajado" value={`${Math.floor(ot.tiempoTrabajadoMin / 60)}h ${ot.tiempoTrabajadoMin % 60}min`} />
                  )}
                </div>
              </div>
            ) : (
              <>
                <Row label="Descripción" value={ot.descripcion} />
                {ot.instrucciones && <Row label="Instrucciones" value={<span style={{ color: 'var(--muted)' }}>{ot.instrucciones}</span>} />}
                <Row label="Sitio" value={ot.sitioNombre ?? ot.sitioId ?? '—'} />
                <Row label="Asignado a" value={ot.asignadoAUserId
                  ? (usersData?.find((u) => u.id === ot.asignadoAUserId)?.nombre
                    ?? (ot.asignadoAUserId === user?.id ? (user?.nombre ?? user?.email ?? 'Yo') : ot.asignadoAUserId.slice(0, 8) + '…'))
                  : '—'} />
                <Row label="Fecha programada" value={fmt(ot.fechaProgramada)} />
                <Row label="Fecha inicio" value={fmt(ot.fechaInicio)} />
                <Row label="Fecha completada" value={fmt(ot.fechaCompletada)} />
                {ot.tiempoTrabajadoMin != null && (
                  <Row label="Tiempo trabajado" value={`${Math.floor(ot.tiempoTrabajadoMin / 60)}h ${ot.tiempoTrabajadoMin % 60}min`} />
                )}
              </>
            )}
          </div>

          {/* Checklist */}
          {totalItems > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checklist</h3>
                <span style={{ fontSize: '0.75rem', color: doneItems === totalItems ? '#15803D' : 'var(--muted)' }}>{doneItems}/{totalItems}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%`, background: '#15803D', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {checklistItems.map((item) => {
                  const isPending = pendingItemId === item.id
                  return (
                    <div key={item.id} style={{ borderRadius: '8px', border: isPending ? '1px solid rgba(10,102,255,0.3)' : '1px solid transparent', padding: isPending ? '0.75rem' : 0, transition: 'all 0.15s' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: isFinal || !canComplete ? 'default' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.completado || isPending}
                          disabled={isFinal || !canComplete || (!!pendingItemId && !isPending)}
                          onChange={(e) => handleCheckboxChange(item.id, e.target.checked)}
                          style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.875rem', textDecoration: item.completado ? 'line-through' : 'none', color: item.completado ? 'var(--muted)' : 'var(--fg)' }}>
                            {item.texto}
                          </span>
                          {item.completadoEn && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                              {new Date(item.completadoEn).toLocaleDateString('es-MX')}
                            </span>
                          )}
                          {item.notaRealizado && (
                            <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: '0.25rem', background: 'rgba(21,128,61,0.07)', borderRadius: '5px', padding: '0.3rem 0.5rem' }}>
                              ✓ {item.notaRealizado}
                            </div>
                          )}
                          {item.notaPendiente && (
                            <div style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: '0.25rem', background: 'rgba(180,83,9,0.07)', borderRadius: '5px', padding: '0.3rem 0.5rem' }}>
                              ⚠ Pendiente: {item.notaPendiente}
                            </div>
                          )}
                        </div>
                      </label>

                      {/* Inline form when checking */}
                      {isPending && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>¿Qué se realizó?</div>
                            <textarea
                              value={pendingRealizado}
                              onChange={(e) => setPendingRealizado(e.target.value)}
                              placeholder="Describe lo que se hizo en este punto…"
                              rows={2}
                              autoFocus
                              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--fg)', fontSize: '0.8125rem', padding: '0.4rem 0.625rem', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>¿Falta algo? (opcional)</div>
                            <textarea
                              value={pendingFalta}
                              onChange={(e) => setPendingFalta(e.target.value)}
                              placeholder="Indica qué quedó pendiente o requiere seguimiento…"
                              rows={2}
                              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--fg)', fontSize: '0.8125rem', padding: '0.4rem 0.625rem', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={confirmChecklist}
                              disabled={savingChecklist || !pendingRealizado.trim()}
                              style={{ flex: 1, background: pendingRealizado.trim() ? '#15803D' : 'var(--bg)', border: pendingRealizado.trim() ? 'none' : '1px solid var(--border)', borderRadius: '6px', color: pendingRealizado.trim() ? '#fff' : 'var(--muted)', cursor: pendingRealizado.trim() ? 'pointer' : 'not-allowed', fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 0.75rem', opacity: savingChecklist ? 0.7 : 1 }}
                            >
                              {savingChecklist ? 'Guardando…' : '✓ Confirmar'}
                            </button>
                            <button
                              onClick={() => setPendingItemId(null)}
                              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.45rem 0.75rem' }}
                            >
                              Cancelar
                            </button>
                          </div>
                          {!pendingRealizado.trim() && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>Describe lo que se realizó para confirmar.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Evidencias */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Evidencias ({ot.evidencias.length})
              </h3>
              {canComplete && isEditable && (
                <button onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '0.4rem 0.875rem' }}>
                  📷 Subir foto
                </button>
              )}
            </div>
            {canComplete && isEditable && (
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                {FOTO_CATEGORIAS.map((cat) => (
                  <button key={cat} type="button" onClick={() => setFotoCategoria(cat)} style={{ padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', background: fotoCategoria === cat ? 'rgba(10,102,255,0.12)' : 'transparent', borderColor: fotoCategoria === cat ? 'rgba(10,102,255,0.4)' : 'var(--border)', color: fotoCategoria === cat ? '#0A66FF' : 'var(--muted)' }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {uploadError && (
              <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)', borderRadius: '7px', color: 'var(--error)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>×</button>
              </div>
            )}
            {ot.evidencias.length === 0 && localPreviews.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem' }}>Sin evidencias cargadas</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                {ot.evidencias.map((ev) => (
                  <button key={ev.id} onClick={() => setLightboxUrl(ev.fotoUrlSigned)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: 0, cursor: 'pointer', aspectRatio: '1', overflow: 'hidden', position: 'relative' }}>
                    <img src={ev.fotoUrlSigned} alt={ev.tipo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '2px 5px', fontSize: '0.6rem', color: '#fff', fontWeight: 600, textAlign: 'center' }}>{ev.tipo}</div>
                  </button>
                ))}
                {localPreviews.map((p) => (
                  <div key={p.tempId} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: `1px solid ${p.status === 'error' ? 'var(--error)' : 'var(--border)'}` }}>
                    <img src={p.previewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.status === 'uploading' ? 0.45 : 1 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                      {p.status === 'uploading' && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>Subiendo…</span>}
                      {p.status === 'done' && <span style={{ background: '#15803D', color: '#FAFAFA', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>}
                      {p.status === 'error' && <button onClick={() => retryUpload(p.tempId)} style={{ background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.7rem', padding: '0.25rem 0.4rem', cursor: 'pointer' }}>Reintentar</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visitas de campo */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visitas de campo</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {visitas.length} total · {visitasFiltradas.length} en este tipo
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              {(['MODULOS', 'ELECTRICO'] as const).map((t) => {
                const active = visitaTab === t
                return (
                  <button
                    key={t}
                    onClick={() => { setVisitaTab(t); setEditingVisitaId(null); setVisitaError(null) }}
                    style={{ background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', color: active ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: active ? 600 : 500, padding: '0.5rem 0.875rem', marginBottom: '-1px' }}
                  >
                    {VISITA_TIPO_LABEL[t]}
                    <span style={{ marginLeft: '0.375rem', color: 'var(--muted)', fontWeight: 500 }}>({visitaCountByTipo[t]})</span>
                  </button>
                )
              })}
            </div>

            {visitaError && (
              <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid var(--error)', borderRadius: '7px', color: 'var(--error)', fontSize: '0.75rem', padding: '0.4rem 0.625rem', marginBottom: '0.5rem' }}>
                {visitaError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: canComplete && !isFinal ? '0.875rem' : 0 }}>
              {visitasFiltradas.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '0.875rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                  Sin visitas de este tipo aún
                </div>
              ) : (
                visitasFiltradas.map((v, i) => {
                  const isEditing = editingVisitaId === v.id
                  const canEditThis = canAssign || v.autorUserId === user?.id
                  return (
                    <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(10,102,255,0.06)', borderBottom: '1px solid var(--border)', padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(10,102,255,0.15)', color: '#0A66FF', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>Visita {i + 1}</span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg)' }}>{new Date(v.fecha).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</span>
                          {v.autorNombre && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>· {v.autorNombre}</span>}
                        </div>
                        {!isEditing && ot.estatus !== 'CANCELADA' && (canAssign || (!isFinal && canEditThis)) && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {(canAssign || (canEditThis && !isFinal)) && (
                              <button onClick={() => startEditVisita(v)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}>
                                ✎ Editar
                              </button>
                            )}
                            {canAssign && (
                              <button onClick={() => handleDeleteVisita(v.id)} style={{ background: 'none', border: '1px solid rgba(185,28,28,0.3)', borderRadius: '5px', color: '#B91C1C', cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}>
                                🗑 Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '0.75rem 0.875rem' }}>
                        {isEditing ? (
                          <>
                            <select value={editVisitaTipo} onChange={(e) => setEditVisitaTipo(e.target.value as VisitaTipo)} style={{ ...inp, marginBottom: '0.5rem', width: 'auto' }}>
                              <option value="MODULOS">Mantenimiento de módulos</option>
                              <option value="ELECTRICO">Eléctrico</option>
                            </select>
                            <textarea value={editVisitaContenido} onChange={(e) => setEditVisitaContenido(e.target.value)} rows={4} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.5rem' }} />
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button onClick={handleSaveEditVisita} disabled={savingVisita || !editVisitaContenido.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: savingVisita || !editVisitaContenido.trim() ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.875rem', opacity: savingVisita ? 0.7 : 1 }}>
                                {savingVisita ? 'Guardando…' : 'Guardar cambios'}
                              </button>
                              <button onClick={() => setEditingVisitaId(null)} disabled={savingVisita} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.4rem 0.875rem' }}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.875rem', lineHeight: 1.55, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{v.contenido}</div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {ot.estatus !== 'CANCELADA' && ((canComplete && !isFinal) || canAssign) && editingVisitaId === null && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                  Nueva visita en <strong style={{ color: 'var(--fg)' }}>{VISITA_TIPO_LABEL[visitaTab]}</strong>
                </div>
                <textarea value={newVisitaContenido} onChange={(e) => setNewVisitaContenido(e.target.value)} placeholder="Describe los avances de esta visita…" rows={4} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', fontSize: '0.875rem', lineHeight: 1.5, padding: '0.625rem 0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <button onClick={handleSaveVisita} disabled={savingVisita || !newVisitaContenido.trim()} style={{ marginTop: '0.5rem', background: newVisitaContenido.trim() && !savingVisita ? 'var(--accent)' : 'var(--bg)', border: newVisitaContenido.trim() && !savingVisita ? 'none' : '1px solid var(--border)', borderRadius: '7px', color: newVisitaContenido.trim() && !savingVisita ? '#fff' : 'var(--muted)', cursor: !newVisitaContenido.trim() || savingVisita ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '0.5rem 1rem', opacity: savingVisita ? 0.7 : 1 }}>
                  {savingVisita ? 'Guardando…' : 'Guardar visita'}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT — sticky: todos los paneles de acción */}
        <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Asignar técnico */}
          {canAssign && !isFinal && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>Asignar técnico</h3>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ ...inp, marginBottom: '0.625rem' }}>
                <option value="">— Sin asignar —</option>
                {(usersData ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
              <button onClick={handleAssign} disabled={savingAssign || !selectedUser || selectedUser === ot.asignadoAUserId} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: savingAssign || !selectedUser || selectedUser === ot.asignadoAUserId ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.55rem 1rem', opacity: !selectedUser || selectedUser === ot.asignadoAUserId ? 0.5 : 1 }}>
                {savingAssign ? 'Guardando…' : ot.asignadoAUserId ? 'Reasignar' : 'Asignar'}
              </button>
              {assignError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.375rem' }}>{assignError}</p>}
            </div>
          )}

          {/* Registro de labores */}
          <LaborButtons ot={ot} canComplete={canComplete} onRefetch={onRefetch} />

          {/* Estado */}
          <div style={{ background: 'var(--bg-surface)', border: `1px solid ${ot.estatus === 'EN_REVISION' ? 'rgba(124,58,237,0.4)' : ot.estatus === 'BLOQUEADA' ? 'rgba(185,28,28,0.4)' : 'var(--border)'}`, borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Estado</h3>

            {ot.estatus === 'EN_REVISION' && canAssign && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <p style={{ fontSize: '0.8125rem', color: '#7C3AED', fontWeight: 600, marginBottom: '0.25rem' }}>Trabajo enviado para revisión</p>
                <textarea value={notasRevision} onChange={(e) => setNotasRevision(e.target.value)} placeholder="Notas de revisión (opcional)" rows={2} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.8125rem', padding: '0.45rem 0.75rem', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={handleAprobar} disabled={aprovando} style={{ width: '100%', background: '#15803D', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.625rem 1rem', opacity: aprovando ? 0.7 : 1 }}>
                  {aprovando ? 'Aprobando…' : '✓ Aprobar trabajo'}
                </button>
                <button onClick={() => setShowRechazarModal(true)} style={{ width: '100%', background: 'transparent', border: '1px solid #B91C1C', borderRadius: '7px', color: '#B91C1C', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.55rem 1rem' }}>
                  ✗ Rechazar — pedir re-trabajo
                </button>
              </div>
            )}

            {(ot.estatus === 'BLOQUEADA' || ot.estatus === 'RECHAZADA') && canAssign && (
              <button onClick={handleReabrir} disabled={reabriendo} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1rem', opacity: reabriendo ? 0.7 : 1 }}>
                {reabriendo ? 'Reabriendo…' : '↺ Reabrir OT'}
              </button>
            )}

            {(ot.estatus === 'EN_PROCESO' || ot.estatus === 'ASIGNADA' || ot.estatus === 'RECHAZADA') && canComplete && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <button onClick={handleCompletar} disabled={completing || !hasEvidencias} style={{ width: '100%', background: hasEvidencias ? 'var(--accent)' : 'var(--bg)', border: hasEvidencias ? 'none' : '1px solid var(--border)', borderRadius: '8px', color: hasEvidencias ? '#fff' : 'var(--muted)', cursor: hasEvidencias ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1rem', opacity: completing ? 0.7 : 1 }}>
                  {completing ? 'Completando…' : '✓ Completar OT'}
                </button>
                {!hasEvidencias && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>Se requiere al menos una foto</p>}
                {completarError && <p style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{completarError}</p>}
                <button onClick={() => setShowBloquearModal(true)} style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.45rem 0.75rem' }}>
                  ⚠ Reportar problema
                </button>
              </div>
            )}

            {ot.estatus === 'PENDIENTE' && <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center' }}>Sin técnico asignado</p>}

            {ot.estatus === 'COMPLETADA' && (
              <div style={{ textAlign: 'center', color: '#15803D', fontSize: '0.875rem', padding: '0.5rem', fontWeight: 600 }}>
                ✓ Completada
                {ot.fechaCompletada && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem', fontWeight: 400 }}>{fmt(ot.fechaCompletada)}</div>}
                {ot.tiempoTrabajadoMin != null && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem', fontWeight: 400 }}>{Math.floor(ot.tiempoTrabajadoMin / 60)}h {ot.tiempoTrabajadoMin % 60}min trabajados</div>}
              </div>
            )}

            {ot.estatus === 'CANCELADA' && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem' }}>Cancelada</div>}

            {!isFinal && canAssign && ot.estatus !== 'EN_REVISION' && (
              <button onClick={() => setShowCancelarModal(true)} style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                Cancelar OT
              </button>
            )}
          </div>

          {/* Info metadata */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Info</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>Creada: {fmt(ot.creadoEn)}</div>
              <div>Actualizada: {fmt(ot.actualizadoEn)}</div>
              {ot.campanaId && <div>Campaña: <span style={{ fontFamily: 'monospace' }}>{ot.campanaId.slice(0, 8)}…</span></div>}
              {ot.requiereRevision && <div style={{ color: '#7C3AED', fontWeight: 600 }}>Requiere revisión</div>}
            </div>
            {canAssign && (
              <button
                onClick={() => setShowEliminarModal(true)}
                style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid rgba(185,28,28,0.35)', borderRadius: '7px', color: '#B91C1C', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, padding: '0.35rem 0.75rem', opacity: 0.7 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7' }}
              >
                Eliminar OT
              </button>
            )}
          </div>

          {/* Comunicación pública */}
          <ComentariosPublicos otId={ot.id} userName={user?.nombre ?? user?.email ?? 'Técnico'} />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <img src={lightboxUrl} alt="Evidencia" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: '1.25rem', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}

      {/* Modal — Bloquear */}
      {showBloquearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#B91C1C' }}>⚠ Reportar problema</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1rem' }}>Describe el problema que impide realizar el trabajo. La OT quedará bloqueada hasta que un supervisor la revise.</p>
            <textarea
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value)}
              placeholder="Ej: El acceso al sitio está bloqueado, no hay llaves disponibles…"
              rows={4}
              style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${bloquearError ? 'var(--error)' : 'var(--border)'}`, borderRadius: '8px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.625rem 0.875rem', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '0.75rem', color: motivoBloqueo.trim().length < 10 ? 'var(--muted)' : '#15803D', marginTop: '0.25rem', marginBottom: '1rem' }}>
              {motivoBloqueo.trim().length}/mínimo 10 caracteres
            </div>
            {bloquearError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginBottom: '0.75rem' }}>{bloquearError}</p>}
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowBloquearModal(false); setMotivoBloqueo(''); setBloquearError(null) }} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.55rem 1.25rem' }}>Cancelar</button>
              <button
                onClick={handleBloquear}
                disabled={bloqueando || motivoBloqueo.trim().length < 10}
                style={{ background: '#B91C1C', border: 'none', borderRadius: '7px', color: '#fff', cursor: motivoBloqueo.trim().length < 10 ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.55rem 1.25rem', opacity: motivoBloqueo.trim().length < 10 ? 0.5 : 1 }}
              >
                {bloqueando ? 'Reportando…' : 'Confirmar problema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Rechazar */}
      {showRechazarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#B91C1C' }}>✗ Solicitar re-trabajo</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1rem' }}>El técnico recibirá el motivo y deberá volver a completar la OT.</p>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Indica qué debe corregirse o complementarse…"
              rows={4}
              style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${rechazarError ? 'var(--error)' : 'var(--border)'}`, borderRadius: '8px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.625rem 0.875rem', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '0.75rem', color: motivoRechazo.trim().length < 10 ? 'var(--muted)' : '#15803D', marginTop: '0.25rem', marginBottom: '1rem' }}>
              {motivoRechazo.trim().length}/mínimo 10 caracteres
            </div>
            {rechazarError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginBottom: '0.75rem' }}>{rechazarError}</p>}
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowRechazarModal(false); setMotivoRechazo(''); setRechazarError(null) }} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.55rem 1.25rem' }}>Cancelar</button>
              <button
                onClick={handleRechazar}
                disabled={rechazando || motivoRechazo.trim().length < 10}
                style={{ background: '#B91C1C', border: 'none', borderRadius: '7px', color: '#fff', cursor: motivoRechazo.trim().length < 10 ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.55rem 1.25rem', opacity: motivoRechazo.trim().length < 10 ? 0.5 : 1 }}
              >
                {rechazando ? 'Rechazando…' : 'Rechazar trabajo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Eliminar */}
      {showEliminarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#B91C1C' }}>Eliminar orden de trabajo</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              ¿Estás seguro de que deseas eliminar <strong style={{ color: 'var(--fg)' }}>{ot.folio}</strong>?
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#B91C1C', marginBottom: '1.25rem' }}>Esta acción es permanente y no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEliminarModal(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.55rem 1.25rem' }}>Cancelar</button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                style={{ background: '#B91C1C', border: 'none', borderRadius: '7px', color: '#fff', cursor: eliminando ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.55rem 1.25rem', opacity: eliminando ? 0.7 : 1 }}
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Cancelar */}
      {showCancelarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cancelar OT</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1rem' }}>Esta acción no se puede deshacer.</p>
            <input
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              placeholder="Motivo de cancelación"
              style={{ ...inp, marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCancelarModal(false); setMotivoCancelacion('') }} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.55rem 1.25rem' }}>Volver</button>
              <button
                onClick={handleCancelar}
                disabled={cancelando || motivoCancelacion.trim().length < 5}
                style={{ background: '#B91C1C', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.55rem 1.25rem', opacity: motivoCancelacion.trim().length < 5 ? 0.5 : 1 }}
              >
                {cancelando ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
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

// ── Botones Iniciar / Terminar labores ────────────────────────────────────────
function LaborButtons({ ot, canComplete, onRefetch }: { ot: OT; canComplete: boolean; onRefetch: () => void }) {
  const [loadingInicio, setLoadingInicio] = useState(false)
  const [loadingTermino, setLoadingTermino] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!canComplete) return null
  if (['COMPLETADA', 'CANCELADA'].includes(ot.estatus)) return null

  const sesiones = ot.sesionesJson ?? []
  const openSession = sesiones.find(s => !s.termino)
  const canIniciar = !openSession && ['PENDIENTE', 'ASIGNADA', 'EN_PROCESO'].includes(ot.estatus)
  const canTerminar = !!openSession

  const fmtHora = (d: string) =>
    new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const durMins = (inicio: string, termino: string) =>
    Math.round((new Date(termino).getTime() - new Date(inicio).getTime()) / 60000)

  const totalMins = sesiones
    .filter(s => s.termino)
    .reduce((acc, s) => acc + durMins(s.inicio, s.termino!), 0)

  async function iniciar() {
    setErr(null); setLoadingInicio(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/iniciar-labores`, { method: 'POST', body: JSON.stringify({}) })
      onRefetch()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoadingInicio(false) }
  }

  async function terminar() {
    setErr(null); setLoadingTermino(true)
    try {
      await apiFetch(`/ordenes-trabajo/${ot.id}/terminar-labores`, { method: 'POST', body: JSON.stringify({}) })
      onRefetch()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoadingTermino(false) }
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Registro de labores
        </h3>
        {totalMins > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Total: {Math.floor(totalMins / 60)}h {totalMins % 60}min
          </span>
        )}
      </div>

      {/* Session history */}
      {sesiones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
          {sesiones.map((s, i) => {
            const mins = s.termino ? durMins(s.inicio, s.termino) : null
            const isOpen = !s.termino
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOpen ? 'rgba(180,83,9,0.07)' : 'rgba(21,128,61,0.06)', border: `1px solid ${isOpen ? 'rgba(180,83,9,0.2)' : 'rgba(21,128,61,0.15)'}`, borderRadius: '7px', padding: '0.5rem 0.75rem', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isOpen ? '#B45309' : '#15803D', marginBottom: '0.1rem' }}>
                    {isOpen ? '● En curso' : `Sesión ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--fg)' }}>
                    {fmtHora(s.inicio)}{s.termino ? ` → ${fmtHora(s.termino)}` : '…'}
                  </div>
                </div>
                {mins !== null && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {Math.floor(mins / 60)}h {mins % 60}min
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {canIniciar && (
          <button
            onClick={iniciar}
            disabled={loadingInicio}
            style={{ flex: 1, background: '#15803D', border: 'none', borderRadius: '8px', color: '#fff', cursor: loadingInicio ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1rem', opacity: loadingInicio ? 0.7 : 1 }}
          >
            {loadingInicio ? 'Registrando…' : '▶ Iniciar labores'}
          </button>
        )}
        {canTerminar && (
          <button
            onClick={terminar}
            disabled={loadingTermino}
            style={{ flex: 1, background: '#B45309', border: 'none', borderRadius: '8px', color: '#fff', cursor: loadingTermino ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1rem', opacity: loadingTermino ? 0.7 : 1 }}
          >
            {loadingTermino ? 'Registrando…' : '■ Terminar labores'}
          </button>
        )}
      </div>

      {err && <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: '0.5rem 0 0' }}>{err}</p>}
    </div>
  )
}

// ── Comentarios públicos (staff) ───────────────────────────────────────────────
interface ComentarioP { id: string; texto: string; fotoUrlSigned?: string; timestamp: string; autorTipo: string; autorNombre: string }

function ComentariosPublicos({ otId, userName }: { otId: string; userName: string }) {
  const [comentarios, setComentarios] = useState<ComentarioP[]>([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function load() {
    try {
      const data = await apiFetch<ComentarioP[]>(`/ordenes-trabajo/${otId}/comentarios-publicos`)
      setComentarios(data)
    } catch { /* ignore */ }
  }

  useEffect(() => { if (open) load() }, [open, otId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `/ordenes-trabajo/${otId}/comentarios-publicos/foto-url`,
        { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: 'image/jpeg' }) },
      )
      if (!uploadUrl.includes('placeholder.storage')) {
        const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } })
        if (!res.ok) throw new Error('Error subiendo foto')
      }
      setPendingKey(key)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al subir') }
    finally { setUploading(false) }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() && !pendingKey) return
    setSending(true); setError(null)
    try {
      await apiFetch(`/ordenes-trabajo/${otId}/comentarios-publicos`, {
        method: 'POST',
        body: JSON.stringify({ texto: texto.trim() || '📷 Foto adjunta', storageKey: pendingKey ?? undefined }),
      })
      setTexto(''); setPendingKey(null)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al enviar') }
    finally { setSending(false) }
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', color: 'var(--fg)' }}
      >
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Comunicación con cliente {comentarios.length > 0 ? `(${comentarios.length})` : ''}
        </h3>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0.875rem' }}>
            {comentarios.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '1.5rem' }}>Sin mensajes aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comentarios.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: c.autorTipo === 'cliente' ? 'rgba(10,102,255,0.15)' : 'rgba(52,211,153,0.12)', color: c.autorTipo === 'cliente' ? '#0A66FF' : '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      {c.autorNombre.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.autorTipo === 'cliente' ? '#0A66FF' : '#15803D' }}>{c.autorNombre}</span>
                        <span style={{ fontSize: '0.7rem', background: c.autorTipo === 'cliente' ? 'rgba(10,102,255,0.1)' : 'rgba(52,211,153,0.1)', color: c.autorTipo === 'cliente' ? '#0A66FF' : '#15803D', borderRadius: '4px', padding: '0.1rem 0.3rem' }}>{c.autorTipo === 'cliente' ? 'Cliente' : 'Técnico'}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{new Date(c.timestamp).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                        {c.texto}
                        {c.fotoUrlSigned && <img src={c.fotoUrlSigned} alt="Foto" style={{ display: 'block', marginTop: '0.4rem', maxHeight: 120, borderRadius: '6px', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={send} style={{ borderTop: '1px solid var(--border)', padding: '0.75rem' }}>
            {error && <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginBottom: '0.375rem' }}>{error}</div>}
            {pendingKey && <div style={{ fontSize: '0.75rem', color: '#15803D', marginBottom: '0.375rem' }}>📷 Foto lista para enviar</div>}
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <input style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.8125rem', padding: '0.45rem 0.75rem', outline: 'none' }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder al cliente…" />
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', fontSize: '1rem', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="Adjuntar foto">📷</button>
              <button type="submit" disabled={sending || (!texto.trim() && !pendingKey)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: '0 0.875rem', opacity: sending ? 0.7 : 1, flexShrink: 0 }}>
                {sending ? '…' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
