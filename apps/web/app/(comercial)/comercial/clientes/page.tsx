'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Cliente {
  id: string
  nombre: string
  rfc: string | null
  tipo: string | null
  contactoJson: Record<string, string> | null
  creadoEn: string
  _count?: { campanas: number }
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

const TIPO_BADGE: Record<string, { bg: string; color: string }> = {
  ANUNCIANTE: { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' },
  AGENCIA: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  DIRECTO: { bg: 'rgba(184,240,0,0.12)', color: '#b8f000' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function ClientesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ nombre: '', rfc: '', tipo: 'ANUNCIANTE', email: '', telefono: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const params = new URLSearchParams()
  if (search) params.set('search', search)

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes', search],
    queryFn: () => apiFetch(`/clientes?${params}`),
  })

  function openNew() {
    setForm({ nombre: '', rfc: '', tipo: 'ANUNCIANTE', email: '', telefono: '' })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')
    try {
      const contactoJson: Record<string, string> = {}
      if (form.email) contactoJson.email = form.email
      if (form.telefono) contactoJson.telefono = form.telefono

      await apiFetch('/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          rfc: form.rfc || undefined,
          tipo: form.tipo || undefined,
          contactoJson: Object.keys(contactoJson).length ? contactoJson : undefined,
        }),
      })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Nuevo cliente</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Nombre / Razón social *">
                <input style={inp} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Empresa o persona" autoFocus />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="RFC">
                  <input style={inp} value={form.rfc} onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value }))} placeholder="RFC" />
                </Field>
                <Field label="Tipo">
                  <select style={inp} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                    <option value="ANUNCIANTE">Anunciante</option>
                    <option value="AGENCIA">Agencia</option>
                    <option value="DIRECTO">Directo</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Email">
                  <input type="email" style={inp} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
                </Field>
                <Field label="Teléfono">
                  <input style={inp} value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="55 0000 0000" />
                </Field>
              </div>
              {error && <p style={{ fontSize: '0.8125rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
              <button
                type="submit"
                disabled={saving}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1, padding: '0.625rem 1.25rem', marginTop: '0.25rem' }}
              >
                {saving ? 'Guardando…' : 'Crear cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Panel detalle */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{selected.nombre}</h2>
                {selected.tipo && (() => {
                  const s = TIPO_BADGE[selected.tipo] ?? TIPO_BADGE.ANUNCIANTE
                  return <span style={{ ...s, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>{selected.tipo}</span>
                })()}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {selected.rfc && (
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>RFC</span>
                  <span style={{ fontFamily: 'monospace' }}>{selected.rfc}</span>
                </div>
              )}
              {selected.contactoJson?.email && (
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Email</span>
                  <a href={`mailto:${selected.contactoJson.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{selected.contactoJson.email}</a>
                </div>
              )}
              {selected.contactoJson?.telefono && (
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Tel.</span>
                  <span>{selected.contactoJson.telefono}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Campañas</span>
                <span style={{ fontWeight: 600 }}>{selected._count?.campanas ?? 0}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Registro</span>
                <span>{new Date(selected.creadoEn).toLocaleDateString('es-MX')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            style={{ ...inp, width: 240 }}
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openNew} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {isLoading ? 'Cargando…' : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}`}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'RFC', 'Tipo', 'Email', 'Teléfono', 'Campañas', 'Registro'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 && !isLoading ? (
                <tr><td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {search ? 'Sin resultados para la búsqueda' : 'Sin clientes registrados'}
                </td></tr>
              ) : clientes.map((c) => {
                const ts = c.tipo ? (TIPO_BADGE[c.tipo] ?? TIPO_BADGE.ANUNCIANTE) : null
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{c.nombre}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{c.rfc ?? '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {ts ? (
                        <span style={{ ...ts, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>{c.tipo}</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {c.contactoJson?.email
                        ? <a href={`mailto:${c.contactoJson.email}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{c.contactoJson.email}</a>
                        : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{c.contactoJson?.telefono ?? '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: (c._count?.campanas ?? 0) > 0 ? 'var(--fg)' : 'var(--muted)' }}>{c._count?.campanas ?? 0}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(c.creadoEn).toLocaleDateString('es-MX')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
