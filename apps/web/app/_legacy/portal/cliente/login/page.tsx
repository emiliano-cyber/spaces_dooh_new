'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { portalFetch, setPortalSession } from '@/lib/portal-cliente-api'

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await portalFetch<{ token: string; nombre: string }>('/portal/cliente/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setPortalSession(res.token, res.nombre)
      router.push('/portal/cliente/sitios')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.02em' }}>Portal Clientes</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.375rem' }}>Ingresa para ver tus reportes</div>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.4rem' }}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@correo.com"
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '0.9375rem', padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.4rem' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '0.9375rem', padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', color: '#dc2626', fontSize: '0.8125rem', padding: '0.65rem 0.875rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#0A66FF', border: 'none', borderRadius: '8px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9375rem', fontWeight: 600, padding: '0.75rem', opacity: loading ? 0.7 : 1, marginTop: '0.25rem' }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
