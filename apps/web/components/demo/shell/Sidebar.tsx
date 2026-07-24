'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { TOKEN_TELCO, useConfigNegocio } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'
import { NAV } from './nav'
import { useMenuMovil } from './MenuMovilContext'

// Contenido del sidebar (cabecera + navegación + pie). Se reutiliza para el
// aside estático de desktop y el drawer retráctil de móvil.
function SidebarContent({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname()
  const { sesion } = useSesionCtx()
  const config = useConfigNegocio()
  const rol = sesion?.usuario.rol ?? 'DUENO'

  // Cliente externo: no ve módulos internos, sólo su portal.
  const items = NAV.filter((n) => n.roles.includes(rol))

  // Normaliza el basePath para marcar el activo.
  const norm = (p: string) => p.replace(/\/spaces-dooh/, '').replace(/\/$/, '') || '/'
  const here = norm(pathname ?? '/')
  // Una sección queda activa en su página y en cualquier subruta (detalle), p.
  // ej. /operaciones/ot/123 marca "Operaciones". La raíz ('/') solo coincide
  // exacto para no encenderse en todas las rutas.
  const esActivo = (href: string) => {
    const h = norm(href)
    return here === h || (h !== '/' && here.startsWith(h + '/'))
  }

  return (
    <>
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        {config?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logoUrl} alt="logo" className="h-7 w-7 shrink-0 rounded object-contain" />
        ) : (
          <SpaceOsMark className="h-7 w-7 shrink-0" />
        )}
        <div className="min-w-0 leading-tight">
          <div className="demo-wordmark truncate text-[15px] text-ink">
            {config?.nombreTenant ?? 'Space OS'}
          </div>
          <div className="text-[10px] text-muted">AS SPACE OS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="px-2 py-4">
            <p className="text-[13px] text-muted">
              Como cliente externo sólo tienes acceso a tu portal.
            </p>
            <Link
              href={`/portal/${TOKEN_TELCO}`}
              onClick={onNavegar}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-info hover:underline"
            >
              Abrir portal <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((n) => {
              const active = esActivo(n.href)
              const Icon = n.icon
              return (
                <li key={n.key}>
                  <Link
                    href={n.href}
                    onClick={onNavegar}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded px-3 py-2 text-[13px] transition-colors duration-150',
                      active
                        ? 'bg-accent-soft font-medium text-ink before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-accent'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4', active ? 'text-accent' : '')}
                      strokeWidth={1.75}
                    />
                    {n.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <p className="text-[10px] leading-relaxed text-muted">
          Derechos reservados
        </p>
      </div>
    </>
  )
}

export function Sidebar() {
  const { abierto, cerrar } = useMenuMovil()

  return (
    <>
      {/* Desktop: sidebar estático */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <SidebarContent />
      </aside>

      {/* Móvil: drawer retráctil con backdrop */}
      <div className={cn('md:hidden', abierto ? '' : 'pointer-events-none')} aria-hidden={!abierto}>
        {/* Backdrop */}
        <div
          onClick={cerrar}
          className={cn(
            'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200',
            abierto ? 'opacity-100' : 'opacity-0',
          )}
        />
        {/* Panel */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 flex h-full w-64 max-w-[80%] flex-col border-r border-border bg-surface transition-transform duration-200',
            abierto ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="absolute right-2 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
          <SidebarContent onNavegar={cerrar} />
        </aside>
      </div>
    </>
  )
}
