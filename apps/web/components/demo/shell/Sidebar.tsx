'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { ExternalLink, Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { TOKEN_TELCO, useConfigNegocio } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'
import { NAV } from './nav'
import { useMenuMovil } from './MenuMovilContext'

// Globo con el nombre de la opción, para el sidebar colapsado. Va por el portal
// de Radix: un tooltip posicionado dentro del <nav> lo recortaría su
// `overflow-y-auto`. `demo-root` en el contenido porque el portal cuelga de
// <body>, fuera del árbol donde viven las variables de color (mismo patrón que
// los menús del Topbar).
function Globo({
  activo,
  texto,
  children,
}: {
  activo: boolean
  texto: string
  children: React.ReactNode
}) {
  if (!activo) return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={8}
          className="demo-root z-[60] rounded-md border border-border bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {texto}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

// Contenido del sidebar (cabecera + navegación + pie). Se reutiliza para el
// aside de desktop (que puede ir colapsado a modo icono) y el drawer retráctil
// de móvil (siempre expandido).
function SidebarContent({
  onNavegar,
  colapsado = false,
  onAlternarColapso,
}: {
  onNavegar?: () => void
  colapsado?: boolean
  onAlternarColapso?: () => void
}) {
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
    <TooltipPrimitive.Provider delayDuration={150} skipDelayDuration={300}>
      <div
        className={cn(
          'flex h-14 items-center border-b border-border',
          colapsado ? 'justify-center px-0' : 'gap-2.5 px-4',
        )}
      >
        {config?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logoUrl} alt="logo" className="h-7 w-7 shrink-0 rounded object-contain" />
        ) : (
          <SpaceOsMark className="h-7 w-7 shrink-0" />
        )}
        {!colapsado && (
          <div className="min-w-0 leading-tight">
            <div className="demo-wordmark truncate text-[15px] text-ink">
              {config?.nombreTenant ?? 'Space OS'}
            </div>
            <div className="text-[10px] text-muted">AS SPACE OS</div>
          </div>
        )}
      </div>

      {/* `min-h-0` es lo que permite que este nav se encoja por debajo de su
          contenido dentro del flex column; sin él el pie se empujaría fuera de
          la pantalla. El overflow queda como red de seguridad para viewports
          muy bajos (<580px), pero con el interlineado de abajo los 18 módulos
          caben sin scroll en una pantalla de portátil normal. */}
      <nav className={cn('min-h-0 flex-1 overflow-y-auto', colapsado ? 'px-1.5 py-1.5' : 'px-2 py-1.5')}>
        {items.length === 0 ? (
          colapsado ? (
            <Globo activo texto="Abrir portal">
              <Link
                href={`/portal/${TOKEN_TELCO}`}
                onClick={onNavegar}
                className="flex h-10 items-center justify-center rounded text-info hover:bg-surface-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">Abrir portal</span>
              </Link>
            </Globo>
          ) : (
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
          )
        ) : (
          <ul className="space-y-px">
            {items.map((n) => {
              const active = esActivo(n.href)
              const Icon = n.icon
              return (
                <li key={n.key}>
                  <Globo activo={colapsado} texto={n.label}>
                  <Link
                    href={n.href}
                    onClick={onNavegar}
                    aria-current={active ? 'page' : undefined}
                    // Colapsado: el label sigue en el DOM como sr-only para no
                    // dejar el enlace sin nombre accesible. El globo visible lo
                    // pone <Globo>; sin `title` para no encimar el nativo.
                    className={cn(
                      'relative flex items-center rounded text-[13px] leading-none transition-colors duration-150',
                      colapsado ? 'h-9 justify-center' : 'gap-2.5 px-2.5 py-1.5',
                      active
                        ? 'bg-accent-soft font-medium text-ink before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-accent'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')}
                      strokeWidth={1.75}
                    />
                    <span className={cn(colapsado && 'sr-only')}>{n.label}</span>
                  </Link>
                  </Globo>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      {/* Pie anclado al fondo de la pantalla: `shrink-0` evita que el flex lo
          comprima cuando la lista de módulos es larga, así el botón y los
          derechos quedan siempre visibles sin desplazar el menú. */}
      <div className="mt-auto shrink-0 border-t border-border">
        {onAlternarColapso && (
          // Sin etiqueta visible: solo el icono. El nombre de la acción vive en
          // `aria-label` (lectores de pantalla) y en el globo al pasar el ratón.
          <Globo activo texto={colapsado ? 'Expandir menú' : 'Colapsar menú'}>
            <button
              type="button"
              onClick={onAlternarColapso}
              aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!colapsado}
              className={cn(
                'flex h-9 w-full items-center text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                colapsado ? 'justify-center' : 'px-2.5',
              )}
            >
              <Menu className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            </button>
          </Globo>
        )}
        {!colapsado && (
          <p className="border-t border-border px-2.5 py-1.5 text-[10px] leading-none text-muted">
            Derechos reservados
          </p>
        )}
      </div>
    </TooltipPrimitive.Provider>
  )
}

export function Sidebar() {
  const { abierto, cerrar, colapsado, montado, alternarColapso } = useMenuMovil()

  return (
    <>
      {/* Desktop: aside fijo, colapsable a modo icono desde el botón del pie.
          `montado` evita animar el ancho al aplicar la preferencia guardada en
          el primer render. */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-surface md:flex',
          montado && 'transition-[width] duration-200',
          colapsado ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent colapsado={colapsado} onAlternarColapso={alternarColapso} />
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
