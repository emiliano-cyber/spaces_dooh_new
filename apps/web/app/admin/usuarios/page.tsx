'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface User { id: string; nombre: string; email: string; rolId: string; activo: boolean; creadoEn: string }
interface Role { id: string; nombre: string; esBuiltin: boolean }

const ROL_STYLE: Record<string, { bg: string; color: string }> = {
  owner:                { bg: 'rgba(10,10,10,0.5)',    color: '#e8e8f0' },
  admin:                { bg: 'rgba(10,10,10,0.5)',    color: '#e8e8f0' },
  super_admin:          { bg: 'rgba(10,10,10,0.5)',    color: '#e8e8f0' },
  comercial_manager:    { bg: 'rgba(108,99,255,0.18)', color: '#6c63ff' },
  seller:               { bg: 'rgba(108,99,255,0.18)', color: '#6c63ff' },
  operaciones_manager:  { bg: 'rgba(251,141,36,0.15)', color: '#fb8d24' },
  crew_chief:           { bg: 'rgba(251,141,36,0.15)', color: '#fb8d24' },
  field_worker:         { bg: 'rgba(251,141,36,0.15)', color: '#fb8d24' },
  trafficker:           { bg: 'rgba(108,99,255,0.18)', color: '#7eb3ff' },
  inmuebles_manager:    { bg: 'rgba(184,240,0,0.12)',  color: '#b8f000' },
  auditor:              { bg: 'rgba(90,90,114,0.2)',   color: '#9090aa' },
}

function rolStyle(rolId: string) { return ROL_STYLE[rolId] ?? { bg: 'rgba(90,90,114,0.15)', color: '#9090aa' } }

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.55rem 0.75rem', outline: 'none', width: '100%' }
const lbl: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', marginBottom: '0.3rem', display: 'block' }
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }

export default function UsuariosPage() {
  const qc = useQueryClient()
  const [slideOpen, setSlideOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState('')

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch('/admin/users'),
  })
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: () => apiFetch('/admin/roles'),
  })

  function openNew() {
    setEditUser(null)
    setNombre(''); setEmail(''); setPassword(''); setRolId(roles[0]?.id ?? '')
    setError(null); setCreatedPassword(null)
    setSlideOpen(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setNombre(u.nombre); setEmail(u.email); setPassword(''); setRolId(u.rolId)
    setError(null); setCreatedPassword(null)
    setSlideOpen(true)
  }

  function close() { setSlideOpen(false); setEditUser(null); setCreatedPassword(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (editUser) {
        await apiFetch(`/admin/users/${editUser.id}`, { method: 'PATCH', body: JSON.stringify({ nombre, rolId }) })
        qc.invalidateQueries({ queryKey: ['admin-users'] })
        close()
      } else {
        await apiFetch('/admin/users', { method: 'POST', body: JSON.stringify({ nombre, email, password, rolId }) })
        qc.invalidateQueries({ queryKey: ['admin-users'] })
        setCreatedPassword(password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(u: User) {
    if (!u.activo) {
      await apiFetch(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ activo: true }) })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      return
    }
    if (!confirm(`¿Desactivar a ${u.nombre}? No podrá iniciar sesión.`)) return
    await apiFetch(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ activo: false }) })
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Usuarios</h1>
        <button onClick={openNew} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem' }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nombre', 'Email', 'Rol', 'Estado', 'Creado', ''].map((h) => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rs = rolStyle(u.rolId)
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{u.nombre}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ background: rs.bg, color: rs.color, padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {roleMap[u.rolId]?.nombre ?? u.rolId}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button onClick={() => toggleActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'} style={{ background: u.activo ? 'rgba(184,240,0,0.12)' : 'rgba(255,95,95,0.12)', border: `1px solid ${u.activo ? 'rgba(184,240,0,0.3)' : 'rgba(255,95,95,0.3)'}`, borderRadius: '999px', color: u.activo ? '#b8f000' : '#ff5f5f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.75rem' }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {new Date(u.creadoEn).toLocaleDateString('es-MX')}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button onClick={() => openEdit(u)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem 0.625rem' }}>Editar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      {slideOpen && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{editUser ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {createdPassword ? (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(184,240,0,0.08)', border: '1px solid rgba(184,240,0,0.25)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#b8f000', marginBottom: '0.5rem' }}>Usuario creado exitosamente</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Esta contraseña no se volverá a mostrar:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.625rem 0.875rem', color: 'var(--fg)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    {createdPassword}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(createdPassword); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
                    {copied ? '✓ Copiada' : '📋 Copiar contraseña'}
                  </button>
                </div>
                <button onClick={close} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem' }}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'auto' }}>
                <div style={fld}>
                  <label style={lbl}>Nombre *</label>
                  <input style={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Juan García" />
                </div>
                {!editUser && (
                  <>
                    <div style={fld}>
                      <label style={lbl}>Email *</label>
                      <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="juan@empresa.com" />
                    </div>
                    <div style={fld}>
                      <label style={lbl}>Contraseña temporal *</label>
                      <input style={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="mínimo 8 caracteres" minLength={8} />
                    </div>
                  </>
                )}
                {editUser && (
                  <div style={{ background: 'rgba(90,90,114,0.1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.625rem 0.875rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Email: {editUser.email} (no editable)
                  </div>
                )}
                <div style={fld}>
                  <label style={lbl}>Rol *</label>
                  <select style={inp} value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                    <option value="">Seleccionar rol…</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                {error && <div style={{ background: 'rgba(255,75,75,0.1)', border: '1px solid var(--error)', borderRadius: '7px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button type="submit" disabled={saving} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Guardando…' : editUser ? 'Guardar cambios' : 'Crear usuario'}
                  </button>
                  <button type="button" onClick={close} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
