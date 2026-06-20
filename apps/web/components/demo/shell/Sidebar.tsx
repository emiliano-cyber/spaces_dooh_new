'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Radio, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TOKEN_TELCO } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'
import { NAV } from './nav'

export function Sidebar() {
  const pathname = usePathname()
  const { sesion } = useSesionCtx()
  const rol = sesion?.usuario.rol ?? 'DUENO'

  // Cliente externo: no ve módulos internos, sólo su portal.
  const items = NAV.filter((n) => n.roles.includes(rol))

  // Normaliza el basePath para marcar el activo.
  const norm = (p: string) => p.replace(/\/spaces-dooh/, '').replace(/\/$/, '') || '/demo'
  const here = norm(pathname ?? '/demo')

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-fg">
          <Radio className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold text-ink">Spaces</div>
          <div className="text-[10px] text-muted">Billboards Perú SA</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="px-2 py-4">
            <p className="text-[13px] text-muted">
              Como cliente externo sólo tienes acceso a tu portal.
            </p>
            <Link
              href={`/demo/portal/${TOKEN_TELCO}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-info hover:underline"
            >
              Abrir portal <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((n) => {
              const active = here === norm(n.href)
              const Icon = n.icon
              return (
                <li key={n.key}>
                  <Link
                    href={n.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-3 py-2 text-[13px] transition-colors duration-150',
                      active
                        ? 'bg-surface-2 font-medium text-ink'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
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
          Demo · datos ficticios · $ MXN
        </p>
      </div>
    </aside>
  )
}
