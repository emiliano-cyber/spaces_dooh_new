'use client'

import { useAuth } from '@/lib/auth-context'

export default function AdminPage() {
  const { user, logout } = useAuth()

  return (
    <main style={{ padding: '2rem', color: 'var(--fg)' }}>
      <h1 style={{ marginBottom: '1rem' }}>Dashboard</h1>
      {user && (
        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          Bienvenido, {user.rol} · {user.id}
        </p>
      )}
      <button
        onClick={logout}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--fg)', cursor: 'pointer', padding: '0.5rem 1rem' }}
      >
        Cerrar sesión
      </button>
    </main>
  )
}
