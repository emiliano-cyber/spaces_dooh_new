'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Arrendador {
  id: string
  nombre: string
  rfc: string | null
  telefono: string | null
  email: string | null
  notas: string | null
  creadoEn: string
  contratos?: { id: string }[]
}

const inp: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px',
  color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none', width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function ArrendadoresPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Arrendador | null>(null)
  const [form, setForm] = useState({ nombre: '', rfc: '', telefono: '', email: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const params = new URLSearchParams()
  if (search) params.set('search', search)

  const { data: arrendadores = [], isLoading } = useQuery<Arrendador[]>({
    queryKey: ['arrendadores', search],
    queryFn: () => apiFetch(`/arrendadores?${params}`),
  })

  function openNew() {
    setForm({ nombre: '', rfc: '', telefono: '', email: '', notas: '' })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/arrendadores', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          rfc: form.rfc || undefined,
          telefono: form.telefono || undefined,
          email: form.email || undefined,
          notas: form.notas || undefined,
        }),
      })
      qc.invalidateQueries({ queryKey: ['arrendadores'] })
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Modal nuevo */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Nuevo arrendador</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Nombre / Razón social *">
                <input style={inp} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo o razón social" autoFocus />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="RFC">
                  <input style={inp} value={form.rfc} onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value }))} placeholder="RFC" />
                </Field>
                <Field label="Teléfono">
                  <input style={inp} value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="55 0000 0000" />
                </Field>
              </div>
              <Field label="Email">
                <input type="email" style={inp} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Notas">
                <textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones adicionales…" />
              </Field>
              {error && <p style={{ fontSize: '0.8125rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1, padding: '0.625rem 1.25rem', marginTop: '0.25rem' }}>
                {saving ? 'Guardando…' : 'Crear arrendador'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Panel detalle */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{selected.nombre}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
            </div>
            {[
              { label: 'RFC', value: selected.rfc },
              { label: 'Teléfono', value: selected.telefono },
              { label: 'Email', value: selected.email },
              { label: 'Contratos', value: selected.contratos ? String(selected.contratos.length) : '—' },
              { label: 'Registro', value: new Date(selected.creadoEn).toLocaleDateString('es-MX') },
            ].filter((r) => r.value).map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--muted)', width: 90, flexShrink: 0 }}>{label}</span>
                <span>{value}</span>
              </div>
            ))}
            {selected.notas && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--muted)', fontStyle: 'italic' }}>{selected.notas}</div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <input
          style={{ ...inp, width: 240, height: 34 }}
          placeholder="Buscar arrendador…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={openNew} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}>
          + Nuevo arrendador
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {isLoading ? 'Cargando…' : `${arrendadores.length} arrendador${arrendadores.length !== 1 ? 'es' : ''}`}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'RFC', 'Teléfono', 'Email', 'Notas'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arrendadores.length === 0 && !isLoading ? (
                <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {search ? 'Sin resultados' : 'Sin arrendadores registrados'}
                </td></tr>
              ) : arrendadores.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{a.nombre}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{a.rfc ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{a.telefono ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {a.email
                      ? <a href={`mailto:${a.email}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{a.email}</a>
                      : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.notas ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
