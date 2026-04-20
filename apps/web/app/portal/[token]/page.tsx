'use client'

import { useParams } from 'next/navigation'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'test-tenant'

interface Etapa {
  nombre: string
  completado: boolean
  activo: boolean
}

interface Creatividad {
  id: string
  nombre: string
  formato: string
  pesoMb: number | null
  estatusValidacion: string
  subioPorExterno: boolean
  creadoEn: string
}

interface PortalData {
  campana: {
    folio: string
    nombre: string
    clienteNombre: string
    fechaInicio: string
    fechaFin: string
    estadoComercial: string
    tipoCampana: string
  }
  etapas: Etapa[]
  creatividades: Creatividad[]
}

async function fetchPortal(token: string): Promise<PortalData> {
  const res = await fetch(`${BASE_URL}/portal/${token}`, {
    headers: { 'x-tenant-slug': TENANT_SLUG },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ESTATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PENDIENTE:  { bg: 'rgba(90,90,114,0.18)',  color: '#9090aa', label: 'Pendiente' },
  APROBADO:   { bg: 'rgba(184,240,0,0.14)',  color: '#b8f000', label: 'Aprobado' },
  RECHAZADO:  { bg: 'rgba(255,75,75,0.14)',  color: '#ff4b4b', label: 'Rechazado' },
}

export default function PortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token as string
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: ['portal', token],
    queryFn: () => fetchPortal(token),
    retry: false,
    staleTime: 30_000,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    setUploadProgress(0)

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const form = new FormData()
        form.append('file', file)

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(xhr.responseText))
        })
        xhr.addEventListener('error', () => reject(new Error('Error de red')))

        xhr.open('POST', `${BASE_URL}/portal/${token}/creatividades`)
        xhr.setRequestHeader('x-tenant-slug', TENANT_SLUG)
        xhr.send(form)
      })

      setUploadSuccess(`"${file.name}" recibido correctamente`)
      qc.invalidateQueries({ queryKey: ['portal', token] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && !uploading) handleFileUpload(file)
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0e0e14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#9090aa', fontSize: '0.875rem' }}>Cargando portal…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0e0e14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <div style={{ color: '#9090aa', fontSize: '0.9375rem', textAlign: 'center' }}>
          Este portal no está disponible o el enlace expiró.
        </div>
      </div>
    )
  }

  const { campana, etapas, creatividades } = data
  const completedCount = etapas.filter((e) => e.completado).length

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e14', color: '#e8e8f0' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a38', background: '#16161f', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: '#e8e8f0' }}>
          SPACES
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#9090aa', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campana.nombre}
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Campaign summary */}
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9090aa', marginBottom: '0.25rem' }}>{campana.folio}</div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{campana.nombre}</h1>
              <div style={{ fontSize: '0.875rem', color: '#9090aa', marginTop: '0.25rem' }}>{campana.clienteNombre}</div>
            </div>
            <span style={{ background: 'rgba(184,240,0,0.12)', color: '#b8f000', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {campana.tipoCampana}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8125rem', color: '#9090aa' }}>
            <div>
              <div style={{ color: '#9090aa', marginBottom: '0.125rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inicio</div>
              <div style={{ color: '#e8e8f0' }}>{fmt(campana.fechaInicio)}</div>
            </div>
            <div>
              <div style={{ color: '#9090aa', marginBottom: '0.125rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fin</div>
              <div style={{ color: '#e8e8f0' }}>{fmt(campana.fechaFin)}</div>
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>Estado de la campaña</h2>
            <span style={{ fontSize: '0.75rem', color: '#9090aa' }}>{completedCount} / {etapas.length} etapas</span>
          </div>

          {/* Horizontal pipeline */}
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', gap: 0 }}>
              {etapas.map((etapa, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {/* Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 72 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.875rem', fontWeight: 700, flexShrink: 0,
                      border: etapa.activo ? '2px solid #b8f000' : 'none',
                      background: etapa.completado
                        ? '#b8f000'
                        : etapa.activo
                          ? 'transparent'
                          : '#2a2a38',
                      color: etapa.completado ? '#0e0e14' : etapa.activo ? '#b8f000' : '#5a5a72',
                      animation: etapa.activo ? 'portal-blink 1.4s ease-in-out infinite' : 'none',
                    }}>
                      {etapa.completado ? '✓' : i + 1}
                    </div>
                    <div style={{
                      marginTop: '0.5rem',
                      fontSize: '0.6875rem',
                      textAlign: 'center',
                      color: etapa.completado ? '#e8e8f0' : etapa.activo ? '#b8f000' : '#5a5a72',
                      fontWeight: etapa.activo ? 600 : 400,
                      lineHeight: 1.3,
                      width: 68,
                      wordBreak: 'break-word',
                    }}>
                      {etapa.nombre}
                    </div>
                  </div>

                  {/* Connector line (skip last) */}
                  {i < etapas.length - 1 && (
                    <div style={{
                      width: 28, height: 2, marginTop: 15, flexShrink: 0,
                      background: etapas[i + 1].completado || etapas[i + 1].activo
                        ? '#b8f000'
                        : '#2a2a38',
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Creative upload */}
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 1rem' }}>Subir material creativo</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.mp4,.mov"
            hidden
            onChange={handleFileChange}
          />

          <div
            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '2rem 1rem', borderRadius: '8px',
              border: `2px dashed ${dragOver ? '#b8f000' : uploading ? '#3a3a4a' : '#2a2a38'}`,
              background: dragOver ? 'rgba(184,240,0,0.05)' : uploading ? '#16161f' : 'transparent',
              cursor: uploading ? 'not-allowed' : 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.5rem', opacity: uploading ? 0.4 : 0.7 }}>
              {uploading ? '⏳' : '📎'}
            </span>
            <span style={{ fontSize: '0.875rem', color: dragOver ? '#b8f000' : uploading ? '#5a5a72' : '#9090aa' }}>
              {uploading
                ? `Subiendo… ${uploadProgress}%`
                : dragOver
                  ? 'Suelta el archivo aquí'
                  : 'Arrastra tu archivo aquí o haz clic para seleccionar'}
            </span>
            {!uploading && (
              <span style={{ fontSize: '0.75rem', color: '#5a5a72' }}>
                JPG, PNG, PDF, MP4, MOV — máx. 500 MB
              </span>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div style={{ marginTop: '0.75rem', height: 4, background: '#2a2a38', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#b8f000', borderRadius: 2, transition: 'width 0.15s' }} />
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(255,75,75,0.1)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: '6px', fontSize: '0.8125rem', color: '#ff4b4b' }}>
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(184,240,0,0.08)', border: '1px solid rgba(184,240,0,0.2)', borderRadius: '6px', fontSize: '0.8125rem', color: '#b8f000' }}>
              ✓ {uploadSuccess}
            </div>
          )}

          {/* Uploaded creatives */}
          {creatividades.length > 0 && (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9090aa', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Materiales enviados</div>
              {creatividades.map((c) => {
                const badge = ESTATUS_BADGE[c.estatusValidacion] ?? ESTATUS_BADGE.PENDIENTE
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: '#16161f', border: '1px solid #2a2a38', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', background: '#2a2a38', color: '#9090aa', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {c.formato}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                    </div>
                    <span style={{ background: badge.bg, color: badge.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.75rem', color: '#5a5a72', borderTop: '1px solid #2a2a38' }}>
          Spaces DOOH · Portal del cliente · Este enlace es privado
        </footer>
      </main>

      <style>{`
        @keyframes portal-blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(184,240,0,0.4); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 6px rgba(184,240,0,0); }
        }
      `}</style>
    </div>
  )
}
