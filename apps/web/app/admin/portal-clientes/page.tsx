'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface PortalCliente { id: string; email: string; nombre: string; activo: boolean; creadoEn: string; sitios: { sitioId: string }[] }
interface SitioOption { id: string; nombre: string; claveInterna: string }

export default function PortalClientesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formNombre, setFormNombre] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editSitios, setEditSitios] = useState<string[]>([])
  const [savingSitios, setSavingSitios] = useState(false)

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['portal-clientes'],
    queryFn: () => apiFetch<PortalCliente[]>('/portal-admin/clientes'),
  })

  const { data: sitios = [] } = useQuery({
    queryKey: ['sitios-select'],
    queryFn: () => apiFetch<{ data: SitioOption[] }>('/sitios?limit=500').then((r) => r.data),
  })

  async function createCliente(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      await apiFetch('/portal-admin/clientes', {
        method: 'POST',
        body: JSON.stringify({ email: formEmail, password: formPassword, nombre: formNombre }),
      })
      qc.invalidateQueries({ queryKey: ['portal-clientes'] })
      setShowForm(false)
      setFormNombre(''); setFormEmail(''); setFormPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setFormLoading(false)
    }
  }

  async function toggleActivo(cliente: PortalCliente) {
    await apiFetch(`/portal-admin/clientes/${cliente.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: !cliente.activo }),
    })
    qc.invalidateQueries({ queryKey: ['portal-clientes'] })
  }

  function startEditSitios(cliente: PortalCliente) {
    setEditId(cliente.id)
    setEditSitios(cliente.sitios.map((s) => s.sitioId))
  }

  async function saveSitios() {
    if (!editId) return
    setSavingSitios(true)
    try {
      await apiFetch(`/portal-admin/clientes/${editId}/sitios`, {
        method: 'PUT',
        body: JSON.stringify({ sitioIds: editSitios }),
      })
      qc.invalidateQueries({ queryKey: ['portal-clientes'] })
      setEditId(null)
    } finally {
      setSavingSitios(false)
    }
  }

  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.9rem', padding: '0.55rem 0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Portal de clientes</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>Gestiona los accesos al portal cliente y sus sitios asignados</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.55rem 1.125rem' }}
        >
          + Nuevo acceso
        </button>
      </div>

      {/* Formulario nuevo cliente */}
      {showForm && (
        <form onSubmit={createCliente} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>Nuevo cliente portal</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Nombre</label>
              <input style={inp} value={formNombre} onChange={(e) => setFormNombre(e.target.value)} required placeholder="Nombre del cliente" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Correo</label>
              <input style={inp} type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required placeholder="cliente@correo.com" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Contraseña inicial</label>
            <input style={{ ...inp, maxWidth: 280 }} type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
          </div>
          {formError && <div style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{formError}</div>}
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button type="submit" disabled={formLoading} style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem', opacity: formLoading ? 0.7 : 1 }}>
              {formLoading ? 'Creando…' : 'Crear acceso'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de clientes */}
      {isLoading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem' }}>Cargando…</div>
      ) : clientes.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
          Sin clientes de portal creados aún.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {clientes.map((c) => (
            <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.125rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                    <span style={{ background: c.activo ? 'rgba(52,211,153,0.12)' : 'rgba(107,114,128,0.1)', color: c.activo ? '#15803D' : 'var(--muted)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: '0.2rem' }}>{c.email}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {c.sitios.length} sitio{c.sitios.length !== 1 ? 's' : ''} asignado{c.sitios.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => startEditSitios(c)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
                  >
                    Editar sitios
                  </button>
                  <button
                    onClick={() => toggleActivo(c)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: c.activo ? 'var(--error)' : '#15803D', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
                  >
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>

              {/* Asignar sitios */}
              {editId === c.id && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.625rem' }}>Sitios con acceso</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: 240, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.625rem' }}>
                    {sitios.map((s) => (
                      <label key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={editSitios.includes(s.id)}
                          onChange={(e) => setEditSitios((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )}
                        />
                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', minWidth: 60 }}>{s.claveInterna}</span>
                        <span>{s.nombre}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      onClick={saveSitios}
                      disabled={savingSitios}
                      style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 1rem', opacity: savingSitios ? 0.7 : 1 }}
                    >
                      {savingSitios ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.45rem 0.875rem' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
