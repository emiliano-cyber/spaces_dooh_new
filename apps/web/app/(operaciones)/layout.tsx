'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const CAMPO_ROLES = ['field_worker', 'crew_chief']

function buildNav(userRol: string) {
  const isCampo = CAMPO_ROLES.includes(userRol)
  return [
    { href: '/operaciones', label: 'Dashboard OTs', shortLabel: 'Inicio', icon: '◫' },
    { href: '/operaciones/ordenes', label: isCampo ? 'Mis Órdenes' : 'Órdenes de trabajo', shortLabel: 'Órdenes', icon: '≡' },
    { href: '/operaciones/calendario', label: 'Calendario', shortLabel: 'Agenda', icon: '▦' },
    { href: isCampo ? '/operaciones/mis-sitios' : '/inmuebles/sitios', label: isCampo ? 'Mis Sitios' : 'Sitios', shortLabel: 'Sitios', icon: '📍' },
  ]
}

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/auth/login'); return }
    const ok =
      user.rol === 'owner' ||
      user.rol === 'admin' ||
      (user.permisos as string[]).includes('*') ||
      user.permisos.includes('ots:read')
    if (!ok) router.replace('/auth/login')
  }, [user, isLoading, router])

  if (isLoading || !user || isMobile === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Cargando…</div>
      </div>
    )
  }

  const NAV = buildNav(user.rol)
  const currentNav = NAV.find(
    (n) => pathname === n.href || (n.href !== '/operaciones' && (pathname ?? '').startsWith(n.href)),
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)' }}>
            {currentNav?.label ?? 'Operaciones'}
          </span>
          <button
            onClick={logout}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
          >
            Salir
          </button>
        </header>

        <main style={{ flex: 1, padding: '1rem', paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 1rem)' }}>
          {children}
        </main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, display: 'flex', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {NAV.map(({ href, shortLabel, icon }) => {
            const isActive = pathname === href || (href !== '/operaciones' && (pathname ?? '').startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.1875rem', minHeight: 56, padding: '0.5rem 0', textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--muted)' }}
              >
                <span style={{ fontSize: '1.125rem', opacity: isActive ? 1 : 0.85 }}>{icon}</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: isActive ? 600 : 500 }}>{shortLabel}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1.25rem 0' }}>
        <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Spaces DOOH
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--fg)' }}>Operaciones</div>
        </div>

        <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {NAV.map(({ href, label, icon }) => {
            const isActive = pathname === href || (href !== '/operaciones' && (pathname ?? '').startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--fg)' : 'var(--muted)', background: isActive ? 'var(--bg-hover)' : 'transparent', transition: 'all 0.15s', textDecoration: 'none' }}
              >
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
            {user.nombre ?? user.email ?? user.id.slice(0, 8)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
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
        <header style={{ height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1.5rem', justifyContent: 'space-between', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--fg)' }}>
            {currentNav?.label ?? 'Operaciones'}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{user.nombre ?? user.email ?? user.id.slice(0, 8)}</span>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>{children}</main>
      </div>
    </div>
  )
}
