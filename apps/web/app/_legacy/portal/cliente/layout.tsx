'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getPortalToken, getPortalNombre, clearPortalSession } from '@/lib/portal-cliente-api'

export default function PortalClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nombre, setNombre] = useState<string | null>(null)
  const isLoginPage = pathname === '/portal/cliente/login'

  useEffect(() => {
    const token = getPortalToken()
    if (!token && !isLoginPage) {
      router.replace('/portal/cliente/login')
      return
    }
    setNombre(getPortalNombre())
  }, [isLoginPage, router])

  function logout() {
    clearPortalSession()
    router.push('/portal/cliente/login')
  }

  if (isLoginPage) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }}>
      {/* Navbar */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div
          onClick={() => router.push('/portal/cliente/sitios')}
          style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', letterSpacing: '-0.01em' }}
        >
          Portal Clientes
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {nombre && <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>{nombre}</span>}
          <button
            onClick={logout}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.35rem 0.875rem' }}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        {children}
      </main>
    </div>
  )
}
