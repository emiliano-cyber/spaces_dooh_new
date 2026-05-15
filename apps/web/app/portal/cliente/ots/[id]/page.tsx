'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { portalFetch, getPortalToken } from '@/lib/portal-cliente-api'

interface Comentario {
  id: string; otId: string; texto: string; fotoUrl?: string; fotoUrlSigned?: string
  timestamp: string; autorTipo: 'cliente' | 'tecnico' | 'sistema'; autorNombre: string
}
interface Evidencia { id: string; fotoUrlSigned: string; tipo: string; timestamp: string }
type VisitaTipo = 'MODULOS' | 'ELECTRICO'
interface Visita {
  id: string; tipo: VisitaTipo; contenido: string; fecha: string
  autorUserId: string | null; autorNombre: string | null
  creadoEn: string; actualizadoEn: string
}
interface OT {
  id: string; folio: string; tipo: string; descripcion: string; instrucciones?: string
  estatus: string; prioridad: string; sitioNombre?: string
  fechaProgramada?: string; fechaInicio?: string; fechaCompletada?: string
  checklistJson: { id: string; texto: string; completado: boolean; completadoEn?: string }[]
  evidencias: Evidencia[]; notas?: string; creadoEn: string
  motivoBloqueo?: string
  visitasJson?: Visita[]
}

const VISITA_TIPO_LABEL: Record<VisitaTipo, string> = {
  MODULOS: 'Mantenimiento de módulos',
  ELECTRICO: 'Eléctrico',
}

const ESTATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: '#b45309', bg: 'rgba(245,158,11,0.1)' },
  ASIGNADA:    { label: 'Asignada',    color: '#1d4ed8', bg: 'rgba(59,130,246,0.1)' },
  EN_PROCESO:  { label: 'En proceso',  color: '#4338ca', bg: 'rgba(99,102,241,0.1)' },
  BLOQUEADA:   { label: 'Bloqueada',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  EN_REVISION: { label: 'En revisión', color: '#c2410c', bg: 'rgba(234,88,12,0.1)' },
  COMPLETADA:  { label: 'Completada',  color: '#15803d', bg: 'rgba(22,163,74,0.1)' },
  RECHAZADA:   { label: 'Rechazada',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  CANCELADA:   { label: 'Cancelada',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

function fmt(d?: string | null, withTime = false) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function parseNotasPorDia(notas: string) {
  const segments: { titulo: string; contenido: string }[] = []
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

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width, height } = img
      if (width > MAX) { height = (height * MAX) / width; width = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

export default function PortalOTDetallePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [ot, setOt] = useState<OT | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  function loadData() {
    return portalFetch<{ ot: OT; comentarios: Comentario[] }>(`/portal/cliente/ots/${id}`)
      .then((d) => { setOt(d.ot); setComentarios(d.comentarios) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    if (comentarios.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comentarios.length])

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setSendError(null)
    try {
      const compressed = await compressImage(file)
      const { uploadUrl, key } = await portalFetch<{ uploadUrl: string; key: string }>(
        `/portal/cliente/ots/${id}/comentarios/foto-url`,
        { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: 'image/jpeg' }) },
      )
      if (!uploadUrl.includes('placeholder.storage')) {
        const res = await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' } })
        if (!res.ok) throw new Error('Error al subir la foto')
      }
      setPendingKey(key)
      setFotoPreview(URL.createObjectURL(compressed))
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al subir foto')
    } finally {
      setUploading(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() && !pendingKey) return
    setSending(true)
    setSendError(null)
    try {
      await portalFetch(`/portal/cliente/ots/${id}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ texto: texto.trim() || '📷 Fotografía adjunta', storageKey: pendingKey ?? undefined }),
      })
      setTexto('')
      setPendingKey(null)
      if (fotoPreview) { URL.revokeObjectURL(fotoPreview); setFotoPreview(null) }
      await loadData()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '4rem' }}>Cargando reporte…</div>
  if (error) return <div style={{ color: '#dc2626', textAlign: 'center', paddingTop: '4rem' }}>{error}</div>
  if (!ot) return null

  const st = ESTATUS_CFG[ot.estatus] ?? { label: ot.estatus, color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
  const checkItems: { id: string; texto: string; completado: boolean; completadoEn?: string }[] =
    Array.isArray(ot.checklistJson) ? ot.checklistJson : []
  const isClosed = ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA'
  const visitas: Visita[] = Array.isArray(ot.visitasJson) ? ot.visitasJson : []
  const visitasOrdenadas = [...visitas].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const visitasModulos = visitasOrdenadas.filter((v) => v.tipo === 'MODULOS')
  const visitasElectrico = visitasOrdenadas.filter((v) => v.tipo === 'ELECTRICO')
  const notaSegmentos = visitas.length === 0 && ot.notas ? parseNotasPorDia(ot.notas) : []

  return (
    <div>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '1.25rem' }}>
        ← Volver
      </button>

      {/* Header */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8' }}>{ot.folio}</span>
              <span style={{ background: st.bg, color: st.color, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.625rem' }}>{st.label}</span>
            </div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>{ot.descripcion}</h1>
            {ot.sitioNombre && <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>{ot.sitioNombre}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
            <div>Reportado {fmt(ot.creadoEn, true)}</div>
            {ot.fechaInicio && <div style={{ marginTop: '0.2rem' }}>Inicio {fmt(ot.fechaInicio, true)}</div>}
            {ot.fechaCompletada && <div style={{ color: '#15803d', marginTop: '0.2rem' }}>✓ Completado {fmt(ot.fechaCompletada, true)}</div>}
          </div>
        </div>

        {ot.instrucciones && (
          <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '7px', color: '#4338ca', fontSize: '0.8125rem', marginTop: '1rem', padding: '0.75rem 1rem' }}>
            {ot.instrucciones}
          </div>
        )}

        {ot.motivoBloqueo && (
          <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '7px', color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.75rem', padding: '0.75rem 1rem' }}>
            Bloqueado: {ot.motivoBloqueo}
          </div>
        )}
      </div>

      {/* Bitácora de visitas estructuradas */}
      {visitas.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Bitácora de visitas ({visitas.length})
            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>
              {visitasModulos.length} módulos · {visitasElectrico.length} eléctrico
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {visitasOrdenadas.map((v, i) => {
              const isElectrico = v.tipo === 'ELECTRICO'
              const tipoColor = isElectrico ? '#B45309' : '#0A66FF'
              const tipoBg = isElectrico ? 'rgba(180,83,9,0.1)' : 'rgba(10,102,255,0.1)'
              return (
                <div key={v.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>Visita {i + 1}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{fmt(v.fecha)}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tipoColor, background: tipoBg, padding: '0.15rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {VISITA_TIPO_LABEL[v.tipo]}
                    </span>
                    {v.autorNombre && (
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>· {v.autorNombre}</span>
                    )}
                  </div>
                  {v.contenido && (
                    <div style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {v.contenido}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bitácora legacy (fallback si no hay visitas estructuradas) */}
      {visitas.length === 0 && notaSegmentos.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Bitácora de visitas ({notaSegmentos.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {notaSegmentos.map((seg, i) => (
              <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0.625rem 1rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{seg.titulo}</span>
                </div>
                {seg.contenido && (
                  <div style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {seg.contenido}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notas sin formato VISITA */}
      {ot.notas && notaSegmentos.length === 0 && visitas.length === 0 && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Notas técnicas</h3>
          <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{ot.notas}</p>
        </div>
      )}

      {/* Checklist */}
      {checkItems.length > 0 && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Checklist — {checkItems.filter((i) => i.completado).length}/{checkItems.length}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {checkItems.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: '0.1rem', color: item.completado ? '#15803d' : '#cbd5e1', fontSize: '0.9rem' }}>
                  {item.completado ? '✓' : '○'}
                </span>
                <div>
                  <span style={{ fontSize: '0.875rem', color: item.completado ? '#15803d' : '#475569', textDecoration: item.completado ? 'line-through' : 'none', opacity: item.completado ? 0.8 : 1 }}>
                    {item.texto}
                  </span>
                  {item.completado && item.completadoEn && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>{fmt(item.completadoEn, true)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidencias fotográficas */}
      {ot.evidencias.length > 0 && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
            Evidencias fotográficas ({ot.evidencias.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
            {ot.evidencias.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setLightbox(ev.fotoUrlSigned)}
                style={{ aspectRatio: '1', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', overflow: 'hidden', padding: 0 }}
              >
                <img
                  src={ev.fotoUrlSigned}
                  alt="Evidencia"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cadena de comunicación */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Cadena de comunicación · {comentarios.length} mensaje{comentarios.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {/* Mensajes */}
        <div style={{ maxHeight: 480, overflowY: 'auto', padding: '1rem' }}>
          {comentarios.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
              Sin mensajes aún. Sé el primero en comentar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {comentarios.map((c) => {
                const isCliente = c.autorTipo === 'cliente'
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: isCliente ? 'row-reverse' : 'row', gap: '0.625rem', alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      flexShrink: 0, width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCliente ? 'rgba(10,102,255,0.1)' : 'rgba(22,163,74,0.1)',
                      color: isCliente ? '#0A66FF' : '#15803d', fontSize: '0.8rem', fontWeight: 700,
                    }}>
                      {c.autorNombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Burbuja */}
                    <div style={{ maxWidth: '72%' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexDirection: isCliente ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isCliente ? '#0A66FF' : '#15803d' }}>{c.autorNombre}</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{fmt(c.timestamp, true)}</span>
                        <span style={{ fontSize: '0.65rem', background: isCliente ? 'rgba(10,102,255,0.08)' : 'rgba(22,163,74,0.08)', color: isCliente ? '#0A66FF' : '#15803d', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>
                          {isCliente ? 'Cliente' : 'Técnico'}
                        </span>
                      </div>
                      <div style={{
                        background: isCliente ? 'rgba(10,102,255,0.06)' : '#f8fafc',
                        border: `1px solid ${isCliente ? 'rgba(10,102,255,0.15)' : '#e2e8f0'}`,
                        borderRadius: isCliente ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        padding: '0.65rem 0.875rem',
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#1e293b', margin: 0, lineHeight: 1.5 }}>{c.texto}</p>
                        {(c.fotoUrlSigned || c.fotoUrl) && (
                          <button
                            onClick={() => setLightbox(c.fotoUrlSigned || c.fotoUrl || null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.5rem', padding: 0, display: 'block' }}
                          >
                            <img
                              src={c.fotoUrlSigned || c.fotoUrl}
                              alt="Foto adjunta"
                              style={{ borderRadius: '6px', maxWidth: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input de comentario */}
        {!isClosed ? (
          <form onSubmit={handleSend} style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.25rem', background: '#f8fafc' }}>
            {fotoPreview && (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
                <img src={fotoPreview} alt="Vista previa" style={{ borderRadius: '8px', maxHeight: 120, maxWidth: 200, objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => { URL.revokeObjectURL(fotoPreview); setFotoPreview(null); setPendingKey(null) }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              </div>
            )}
            {sendError && <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{sendError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un comentario, observación o reporte…"
                rows={2}
                style={{ flex: 1, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '0.875rem', padding: '0.65rem 0.875rem', resize: 'none', outline: 'none', lineHeight: 1.5 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any) } }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', height: 38, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 0.5 : 1 }}
                  title="Adjuntar foto"
                >
                  {uploading ? '…' : '📷'}
                </button>
                <button
                  type="submit"
                  disabled={sending || (!texto.trim() && !pendingKey)}
                  style={{ background: '#0A66FF', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, height: 38, paddingInline: '0.875rem', opacity: sending || (!texto.trim() && !pendingKey) ? 0.5 : 1 }}
                >
                  {sending ? '…' : 'Enviar'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem' }}>Enter para enviar · Shift+Enter nueva línea</div>
          </form>
        ) : (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.875rem 1.25rem', color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center', background: '#f8fafc' }}>
            Este reporte está {ot.estatus === 'COMPLETADA' ? 'completado' : 'cancelado'} — no se aceptan más comentarios.
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <img src={lightbox} alt="Imagen" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: '1.25rem', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}
    </div>
  )
}
