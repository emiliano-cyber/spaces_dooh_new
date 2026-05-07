'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Role { id: string; nombre: string; permisos: string[]; esBuiltin: boolean; tenantId: string }
interface User { rolId: string }

const ALL_PERMISSIONS: { group: string; perms: string[] }[] = [
  { group: 'SITIOS',          perms: ['sitios:read', 'sitios:create', 'sitios:edit'] },
  { group: 'CONTRATOS',       perms: ['contratos:read', 'contratos:create', 'contratos:edit'] },
  { group: 'INCIDENCIAS',     perms: ['incidencias:create', 'incidencias:resolve'] },
  { group: 'CAMPAÑAS',        perms: ['campanas:read', 'campanas:create', 'campanas:confirm', 'campanas:cancel', 'campanas:readiness'] },
  { group: 'INVENTARIO',      perms: ['inventario:read', 'inventario:read_costs'] },
  { group: 'OPERACIONES',     perms: ['ots:read', 'ots:create', 'ots:assign', 'ots:complete'] },
  { group: 'TRÁFICO',         perms: ['traffic:read', 'traffic:manage'] },
  { group: 'PORTAL',          perms: ['portal:manage'] },
  { group: 'ADMINISTRACIÓN',  perms: ['users:read', 'users:manage', 'roles:read', 'roles:manage', 'tenant:manage'] },
  { group: 'AUDITORÍA',       perms: ['audit:read'] },
]

function fmtPerm(p: string) { return p.replace(':', ':').split(':').map((s, i) => i === 0 ? s : s.replace(/_/g, ' ')).join(':') }

export default function RolesPage() {
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: roles = [] } = useQuery<Role[]>({ queryKey: ['admin-roles'], queryFn: () => apiFetch('/admin/roles') })
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['admin-users'], queryFn: () => apiFetch('/admin/users') })

  const userCountByRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.rolId] = (acc[u.rolId] ?? 0) + 1
    return acc
  }, {})

  function selectRole(r: Role) {
    setSelectedRole(r)
    setEditPerms(new Set(r.permisos))
    setError(null)
  }

  function togglePerm(perm: string) {
    setEditPerms((prev) => {
      const next = new Set(prev)
      next.has(perm) ? next.delete(perm) : next.add(perm)
      return next
    })
  }

  async function savePerms() {
    if (!selectedRole) return
    setSaving(true); setError(null)
    try {
      await apiFetch(`/admin/roles/${selectedRole.id}`, { method: 'PATCH', body: JSON.stringify({ permisos: [...editPerms] }) })
      qc.invalidateQueries({ queryKey: ['admin-roles'] })
      setSelectedRole((r) => r ? { ...r, permisos: [...editPerms] } : r)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setSaving(false) }
  }

  async function deleteRole(r: Role) {
    if (!confirm(`¿Eliminar el rol "${r.nombre}"?`)) return
    try {
      await apiFetch(`/admin/roles/${r.id}`, { method: 'DELETE' })
      qc.invalidateQueries({ queryKey: ['admin-roles'] })
      if (selectedRole?.id === r.id) setSelectedRole(null)
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await apiFetch('/admin/roles', { method: 'POST', body: JSON.stringify({ nombre: newNombre, permisos: [...newPerms] }) })
      qc.invalidateQueries({ queryKey: ['admin-roles'] })
      setModalOpen(false); setNewNombre(''); setNewPerms(new Set())
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.55rem 0.75rem', outline: 'none', width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Roles y permisos</h1>
        <button onClick={() => { setModalOpen(true); setNewNombre(''); setNewPerms(new Set()); setError(null) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem' }}>
          + Nuevo rol
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Role list */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {roles.map((r) => {
            const count = userCountByRole[r.id] ?? 0
            const isSelected = selectedRole?.id === r.id
            return (
              <div key={r.id} onClick={() => selectRole(r)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.1s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400 }}>{r.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                    {r.permisos.length} permisos · {count} usuario{count !== 1 ? 's' : ''}
                    {r.esBuiltin && <span style={{ marginLeft: '0.375rem', background: 'rgba(90,90,114,0.2)', color: 'var(--muted)', padding: '0rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>builtin</span>}
                  </div>
                </div>
                {!r.esBuiltin && count === 0 && (
                  <button onClick={(e) => { e.stopPropagation(); deleteRole(r) }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem', opacity: 0.7 }}>✕</button>
                )}
              </div>
            )
          })}
        </div>

        {/* Permissions panel */}
        {selectedRole ? (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{selectedRole.nombre}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{selectedRole.esBuiltin ? 'Rol builtin — solo lectura' : 'Permisos editables'}</div>
              </div>
              {!selectedRole.esBuiltin && (
                <button onClick={savePerms} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              )}
            </div>
            {error && <div style={{ padding: '0.75rem 1.25rem', color: 'var(--error)', fontSize: '0.8125rem' }}>{error}</div>}
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ALL_PERMISSIONS.map(({ group, perms }) => (
                <div key={group}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {perms.map((perm) => {
                      const checked = editPerms.has(perm)
                      const editable = !selectedRole.esBuiltin
                      return (
                        <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: checked ? 'rgba(21,128,61,0.1)' : 'var(--bg)', border: `1px solid ${checked ? 'rgba(21,128,61,0.3)' : 'var(--border)'}`, borderRadius: '6px', cursor: editable ? 'pointer' : 'default', fontSize: '0.75rem', color: checked ? '#15803D' : 'var(--muted)', transition: 'all 0.1s' }}>
                          <input type="checkbox" checked={checked} disabled={!editable} onChange={() => togglePerm(perm)} style={{ margin: 0, cursor: editable ? 'pointer' : 'default', accentColor: '#15803D' }} />
                          {fmtPerm(perm)}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
            Selecciona un rol para ver sus permisos
          </div>
        )}
      </div>

      {/* New role modal */}
      {modalOpen && (
        <>
          <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', zIndex: 201, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Nuevo rol</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>✕</button>
            </div>
            <form onSubmit={createRole} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 1.5rem', overflow: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Nombre del rol *</label>
                <input style={inp} value={newNombre} onChange={(e) => setNewNombre(e.target.value)} required placeholder="ej. Gerente de ventas" />
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem' }}>Permisos</div>
                {ALL_PERMISSIONS.map(({ group, perms }) => (
                  <div key={group} style={{ marginBottom: '0.625rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {perms.map((perm) => {
                        const checked = newPerms.has(perm)
                        return (
                          <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', background: checked ? 'rgba(21,128,61,0.1)' : 'var(--bg)', border: `1px solid ${checked ? 'rgba(21,128,61,0.3)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', color: checked ? '#15803D' : 'var(--muted)' }}>
                            <input type="checkbox" checked={checked} onChange={() => setNewPerms((prev) => { const n = new Set(prev); n.has(perm) ? n.delete(perm) : n.add(perm); return n })} style={{ margin: 0, accentColor: '#15803D' }} />
                            {fmtPerm(perm)}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Creando…' : 'Crear rol'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
