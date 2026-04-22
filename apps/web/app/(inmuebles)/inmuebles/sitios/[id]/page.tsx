'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/api-client'
import type { GeoJSONFeatureCollection } from '@/components/maps/SitiosMap'

const SitiosMap = dynamic(() => import('@/components/maps/SitiosMap'), { ssr: false })

type Tab = 'info' | 'contratos' | 'licencias' | 'incidencias'

type ModalType =
  | { type: 'contrato' }
  | { type: 'licencia' }
  | { type: 'incidencia' }
  | { type: 'resolve'; incidenciaId: string }
  | null

const ESTATUS_COMERCIAL_COLORS: Record<string, string> = {
  DISPONIBLE: '#b8f000', RESERVADO: '#fbbf24', OCUPADO: '#ff5f5f',
  BLOQUEADO: '#9090aa', EN_MANTENIMIENTO: '#9090aa', BAJA: '#9090aa',
}
const ESTATUS_LEGAL_COLORS: Record<string, string> = {
  EN_ORDEN: '#b8f000', PERMISO_VENCIDO: '#ff5f5f', EN_TRAMITE: '#fbbf24',
  SUSPENDIDO: '#ff5f5f', SIN_PERMISO: '#ff5f5f',
}
const ESTATUS_OP_COLORS: Record<string, string> = {
  ACTIVO: '#b8f000', EN_MANTENIMIENTO: '#fbbf24', APAGADO: '#9090aa',
  DAÑADO: '#ff5f5f', BAJA: '#9090aa',
}

const inp: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '7px',
  color: 'var(--fg)',
  fontSize: '0.875rem',
  padding: '0.5rem 0.75rem',
  outline: 'none',
  width: '100%',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>×</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function SubmitBtn({ loading, label }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: loading ? 0.6 : 1, padding: '0.625rem 1.25rem', marginTop: '0.5rem' }}
    >
      {loading ? 'Guardando…' : (label ?? 'Guardar')}
    </button>
  )
}

function ContratoModal({ sitioId, onClose, onSaved }: { sitioId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ arrendadorId: '', fechaInicio: '', fechaFin: '', montoRenta: '', periodicidad: 'MENSUAL', moneda: 'MXN', autoRenovable: false })
  const [newArrendador, setNewArrendador] = useState({ nombre: '', rfc: '', telefono: '', email: '' })
  const [showNewArr, setShowNewArr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const { data: arrendadores = [] } = useQuery<any[]>({
    queryKey: ['arrendadores'],
    queryFn: () => apiFetch('/arrendadores'),
  })

  async function handleCreateArrendador() {
    if (!newArrendador.nombre.trim()) return
    setSaving(true)
    try {
      const a = await apiFetch<{ id: string }>('/arrendadores', { method: 'POST', body: JSON.stringify(newArrendador) })
      qc.invalidateQueries({ queryKey: ['arrendadores'] })
      setForm((f) => ({ ...f, arrendadorId: a.id }))
      setShowNewArr(false)
      setNewArrendador({ nombre: '', rfc: '', telefono: '', email: '' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.arrendadorId || !form.fechaInicio || !form.fechaFin || !form.montoRenta) {
      setError('Completa los campos requeridos')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/sitios/${sitioId}/contratos`, {
        method: 'POST',
        body: JSON.stringify({
          arrendadorId: form.arrendadorId,
          fechaInicio: new Date(form.fechaInicio).toISOString(),
          fechaFin: new Date(form.fechaFin).toISOString(),
          montoRenta: Number(form.montoRenta),
          periodicidad: form.periodicidad,
          moneda: form.moneda,
          autoRenovable: form.autoRenovable,
        }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Nuevo contrato de arrendamiento" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="Arrendador *">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select style={{ ...inp, flex: 1 }} value={form.arrendadorId} onChange={(e) => setForm((f) => ({ ...f, arrendadorId: e.target.value }))}>
              <option value="">Seleccionar arrendador…</option>
              {arrendadores.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <button type="button" onClick={() => setShowNewArr((v) => !v)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
              + Nuevo
            </button>
          </div>
        </Field>

        {showNewArr && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', margin: 0 }}>Crear arrendador nuevo</p>
            <Field label="Nombre *">
              <input style={inp} value={newArrendador.nombre} onChange={(e) => setNewArrendador((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo o razón social" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="RFC">
                <input style={inp} value={newArrendador.rfc} onChange={(e) => setNewArrendador((f) => ({ ...f, rfc: e.target.value }))} placeholder="RFC" />
              </Field>
              <Field label="Teléfono">
                <input style={inp} value={newArrendador.telefono} onChange={(e) => setNewArrendador((f) => ({ ...f, telefono: e.target.value }))} placeholder="10 dígitos" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" style={inp} value={newArrendador.email} onChange={(e) => setNewArrendador((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
            </Field>
            <button type="button" onClick={handleCreateArrendador} disabled={saving || !newArrendador.nombre.trim()} style={{ alignSelf: 'flex-start', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '0.4rem 0.875rem' }}>
              Crear arrendador
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Fecha inicio *">
            <input type="date" style={inp} value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
          </Field>
          <Field label="Fecha fin *">
            <input type="date" style={inp} value={form.fechaFin} onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <Field label="Monto renta *">
            <input type="number" min="0" step="0.01" style={inp} value={form.montoRenta} onChange={(e) => setForm((f) => ({ ...f, montoRenta: e.target.value }))} placeholder="0.00" />
          </Field>
          <Field label="Periodicidad">
            <select style={inp} value={form.periodicidad} onChange={(e) => setForm((f) => ({ ...f, periodicidad: e.target.value }))}>
              {['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Moneda">
            <select style={inp} value={form.moneda} onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value }))}>
              {['MXN', 'USD'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.autoRenovable} onChange={(e) => setForm((f) => ({ ...f, autoRenovable: e.target.checked }))} />
          Auto-renovable
        </label>

        {error && <p style={{ fontSize: '0.8125rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
        <SubmitBtn loading={saving} />
      </form>
    </ModalOverlay>
  )
}

function LicenciaModal({ sitioId, onClose, onSaved }: { sitioId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ tipo: '', folio: '', autoridad: '', fechaInicio: '', fechaVencimiento: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo || !form.fechaInicio || !form.fechaVencimiento) {
      setError('Completa tipo y fechas')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/sitios/${sitioId}/licencias`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: form.tipo,
          folio: form.folio || undefined,
          autoridad: form.autoridad || undefined,
          fechaInicio: new Date(form.fechaInicio).toISOString(),
          fechaVencimiento: new Date(form.fechaVencimiento).toISOString(),
          notas: form.notas || undefined,
        }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Nueva licencia / permiso" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="Tipo de licencia *">
          <input style={inp} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} placeholder="ej. Permiso SEMOVI, Licencia municipal, Permiso SEDESOL…" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Folio / No. permiso">
            <input style={inp} value={form.folio} onChange={(e) => setForm((f) => ({ ...f, folio: e.target.value }))} placeholder="Número de folio" />
          </Field>
          <Field label="Autoridad emisora">
            <input style={inp} value={form.autoridad} onChange={(e) => setForm((f) => ({ ...f, autoridad: e.target.value }))} placeholder="Dependencia" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Fecha inicio *">
            <input type="date" style={inp} value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
          </Field>
          <Field label="Fecha vencimiento *">
            <input type="date" style={inp} value={form.fechaVencimiento} onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))} />
          </Field>
        </div>
        <Field label="Notas">
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones adicionales" />
        </Field>
        {error && <p style={{ fontSize: '0.8125rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
        <SubmitBtn loading={saving} />
      </form>
    </ModalOverlay>
  )
}

function IncidenciaModal({ sitioId, onClose, onSaved }: { sitioId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ tipo: 'MANTENIMIENTO', descripcion: '', impactaComercial: false, fechaInicio: new Date().toISOString().split('T')[0], notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const TIPOS_INCIDENCIA = ['CLIMA', 'MANTENIMIENTO', 'LEGAL', 'VANDALISMO', 'SUSPENSION_OPERATIVA', 'ACCIDENTE', 'OTRO']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) { setError('La descripción es requerida'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/sitios/${sitioId}/incidencias`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: form.tipo,
          descripcion: form.descripcion,
          impactaComercial: form.impactaComercial,
          fechaInicio: new Date(form.fechaInicio).toISOString(),
          notas: form.notas || undefined,
        }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Reportar incidencia" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="Tipo de incidencia *">
          <select style={inp} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
            {TIPOS_INCIDENCIA.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
        <Field label="Descripción *">
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Describe qué ocurrió…" />
        </Field>
        <Field label="Fecha de inicio *">
          <input type="date" style={inp} value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.impactaComercial} onChange={(e) => setForm((f) => ({ ...f, impactaComercial: e.target.checked }))} />
          <span>Impacta comercialmente <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>(bloquea el sitio para nuevas campañas)</span></span>
        </label>
        <Field label="Notas adicionales">
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Información adicional…" />
        </Field>
        {error && <p style={{ fontSize: '0.8125rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
        <SubmitBtn loading={saving} label="Reportar incidencia" />
      </form>
    </ModalOverlay>
  )
}

function ResolveIncidenciaModal({ sitioId, incidenciaId, onClose, onSaved }: { sitioId: string; incidenciaId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ notas: '', fechaResolucion: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch(`/sitios/${sitioId}/incidencias/${incidenciaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notas: form.notas || undefined, fechaResolucion: new Date(form.fechaResolucion).toISOString() }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Resolver incidencia" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="Fecha de resolución">
          <input type="date" style={inp} value={form.fechaResolucion} onChange={(e) => setForm((f) => ({ ...f, fechaResolucion: e.target.value }))} />
        </Field>
        <Field label="Notas de resolución">
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Describe cómo se resolvió la incidencia…" />
        </Field>
        <SubmitBtn loading={saving} label="Marcar como resuelta" />
      </form>
    </ModalOverlay>
  )
}

export default function SitioPage() {
  const params = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const id = params?.id as string
  const [tab, setTab] = useState<Tab>('info')
  const [modal, setModal] = useState<ModalType>(null)

  const { data: sitio, isLoading, error } = useQuery({
    queryKey: ['sitio', id],
    queryFn: () => apiFetch<any>(`/sitios/${id}`),
  })

  function closeModal() { setModal(null) }
  function savedAndRefresh() {
    qc.invalidateQueries({ queryKey: ['sitio', id] })
    closeModal()
  }

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Cargando…</div>
  if (error || !sitio) return <div style={{ padding: '2rem', color: 'var(--error)' }}>Error al cargar el sitio.</div>

  const geoJson: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(sitio.lng), Number(sitio.lat)] },
      properties: {
        id: sitio.id, nombre: sitio.nombre, claveInterna: sitio.claveInterna,
        tipoMedio: sitio.tipoMedio, estatusComercial: sitio.estatusComercial,
        estatusLegal: sitio.estatusLegal, estatusOperativo: sitio.estatusOperativo,
      },
    }],
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'contratos', label: `Contratos (${sitio.contratos?.length ?? 0})` },
    { key: 'licencias', label: `Licencias (${sitio.licencias?.length ?? 0})` },
    { key: 'incidencias', label: `Incidencias (${sitio.incidencias?.length ?? 0})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Modals */}
      {modal?.type === 'contrato' && (
        <ContratoModal sitioId={id} onClose={closeModal} onSaved={savedAndRefresh} />
      )}
      {modal?.type === 'licencia' && (
        <LicenciaModal sitioId={id} onClose={closeModal} onSaved={savedAndRefresh} />
      )}
      {modal?.type === 'incidencia' && (
        <IncidenciaModal sitioId={id} onClose={closeModal} onSaved={savedAndRefresh} />
      )}
      {modal?.type === 'resolve' && (
        <ResolveIncidenciaModal sitioId={id} incidenciaId={modal.incidenciaId} onClose={closeModal} onSaved={savedAndRefresh} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', justifyContent: 'space-between' }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
            ← Volver
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.375rem' }}>{sitio.nombre}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge label={sitio.estatusComercial} color={ESTATUS_COMERCIAL_COLORS[sitio.estatusComercial] ?? '#9090aa'} />
            <Badge label={sitio.estatusLegal} color={ESTATUS_LEGAL_COLORS[sitio.estatusLegal] ?? '#9090aa'} />
            <Badge label={sitio.estatusOperativo} color={ESTATUS_OP_COLORS[sitio.estatusOperativo] ?? '#9090aa'} />
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.3rem 0.625rem', borderRadius: '6px' }}>
          {sitio.claveInterna}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === key ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: tab === key ? 600 : 400, marginBottom: -1, padding: '0.625rem 1.25rem', transition: 'all 0.15s' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Info ──────────────────────────────────────────────────────────────── */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--muted)' }}>DATOS GENERALES</h3>
            <Row label="Tipo de medio" value={sitio.tipoMedio.replace(/_/g, ' ')} />
            <Row label="Dirección" value={sitio.direccion} />
            <Row label="Alcaldía / Municipio" value={sitio.alcaldia} />
            <Row label="Ciudad" value={sitio.ciudad} />
            <Row label="Estado" value={sitio.estado} />
            <Row label="País" value={sitio.pais} />
            <Row label="Coordenadas" value={`${sitio.lat}, ${sitio.lng}`} />
            <Row label="Dimensiones" value={sitio.alto && sitio.ancho ? `${sitio.alto}m × ${sitio.ancho}m` : undefined} />
            <Row label="Iluminado" value={sitio.iluminado ? 'Sí' : 'No'} />
            <Row label="Orientación" value={sitio.orientacion} />
            {sitio.notas && <Row label="Notas" value={<span style={{ color: 'var(--muted)' }}>{sitio.notas}</span>} />}
          </div>
          <div>
            <SitiosMap sitios={geoJson} onSitioClick={() => {}} height="350px" />
          </div>
        </div>
      )}

      {/* ── Contratos ─────────────────────────────────────────────────────────── */}
      {tab === 'contratos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => setModal({ type: 'contrato' })} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              + Nuevo contrato
            </button>
          </div>
          {(sitio.contratos?.length ?? 0) === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>Sin contratos registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.contratos.map((c: any) => (
                <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{c.arrendador?.nombre ?? 'Arrendador'}</span>
                    <Badge label={c.estatus} color={c.estatus === 'VIGENTE' ? '#b8f000' : '#fbbf24'} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>{new Date(c.fechaInicio).toLocaleDateString('es-MX')} – {new Date(c.fechaFin).toLocaleDateString('es-MX')}</span>
                    <span>${Number(c.montoRenta).toLocaleString('es-MX')} {c.moneda}/{c.periodicidad}</span>
                    {c.autoRenovable && <span style={{ color: '#b8f000' }}>Auto-renovable</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Licencias ─────────────────────────────────────────────────────────── */}
      {tab === 'licencias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => setModal({ type: 'licencia' })} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              + Nueva licencia
            </button>
          </div>
          {(sitio.licencias?.length ?? 0) === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>Sin licencias registradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.licencias.map((l: any) => (
                <div key={l.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{l.tipo}</span>
                    <Badge label={l.estatus} color={l.estatus === 'VIGENTE' ? '#b8f000' : '#ff5f5f'} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {l.folio && <span>Folio: {l.folio}</span>}
                    {l.autoridad && <span>{l.autoridad}</span>}
                    <span>Vence: {new Date(l.fechaVencimiento).toLocaleDateString('es-MX')}</span>
                  </div>
                  {l.notas && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.375rem' }}>{l.notas}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Incidencias ───────────────────────────────────────────────────────── */}
      {tab === 'incidencias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => setModal({ type: 'incidencia' })} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              + Reportar incidencia
            </button>
          </div>
          {(sitio.incidencias?.length ?? 0) === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>Sin incidencias activas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.incidencias.map((i: any) => (
                <div key={i.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{i.tipo.replace(/_/g, ' ')}</span>
                      {i.impactaComercial && (
                        <span style={{ marginLeft: '0.625rem', background: 'rgba(255,95,95,0.12)', color: '#ff5f5f', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>
                          Impacta comercial
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Badge label={i.estatus} color={i.estatus === 'ABIERTA' ? '#ff5f5f' : i.estatus === 'EN_PROCESO' ? '#fbbf24' : '#b8f000'} />
                      {(i.estatus === 'ABIERTA' || i.estatus === 'EN_PROCESO') && (
                        <button
                          onClick={() => setModal({ type: 'resolve', incidenciaId: i.id })}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.625rem' }}
                        >
                          Resolver
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{i.descripcion}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(i.fechaInicio).toLocaleDateString('es-MX')}</div>
                  {i.notas && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.375rem', fontStyle: 'italic' }}>{i.notas}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
