'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const NAV = [
  { href: '/inmuebles', label: 'Dashboard', icon: '▦' },
  { href: '/inmuebles/sitios', label: 'Sitios', icon: '◈' },
  { href: '/inmuebles/alertas', label: 'Alertas', icon: '⚡' },
]

export default function InmueblesLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/auth/login'); return }
    const ok =
      user.rol === 'owner' ||
      user.rol === 'admin' ||
      (user.permisos as string[]).includes('*') ||
      user.permisos.includes('sitios:read')
    if (!ok) router.replace('/auth/login')
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Cargando…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 0',
      }}>
        <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Spaces DOOH
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--fg)' }}>Inmuebles</div>
        </div>

        <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {NAV.map(({ href, label, icon }) => {
            const isActive = pathname === href || (href !== '/inmuebles' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--fg)' : 'var(--muted)',
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  transition: 'all 0.15s',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.rol}
          </div>
          <button
            onClick={logout}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.375rem 0.75rem', width: '100%', transition: 'all 0.15s' }}
          >
            Salir
          </button>
        </div>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          height: 52,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--fg)' }}>
            {NAV.find((n) => pathname === n.href || (n.href !== '/inmuebles' && pathname.startsWith(n.href)))?.label ?? 'Inmuebles'}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{user.id.slice(0, 8)}…</span>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>{children}</main>
      </div>
    </div>
  )
}
