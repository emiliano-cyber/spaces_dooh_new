'use client'

import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, UserCircle2, LogOut, Bell, CheckCheck, Menu } from 'lucide-react'
import { apiLogout } from '@/lib/auth-real'
import { rolLabel } from './nav'
import { useSesionCtx } from './SesionContext'
import { useMenuMovil } from './MenuMovilContext'
import { useNotificaciones } from '@/lib/data/client'
import { marcarNotificacionLeidaApi, marcarTodasNotificacionesApi } from '@/lib/data/estado-api'

export function Topbar() {
  const router = useRouter()
  const { alternar } = useMenuMovil()
  const { sesion, refrescar } = useSesionCtx()
  const usuario = sesion?.usuario
  const notificaciones = useNotificaciones() ?? []
  const noLeidas = notificaciones.filter((n) => !n.leida).length

  async function cerrar() {
    await apiLogout()
    await refrescar()
    router.push('/demo/login')
  }

  async function abrirNotif(id: string, link: string | null) {
    try { await marcarNotificacionLeidaApi(id) } catch { /* noop */ }
    if (link) router.push(link)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <button
          type="button"
          onClick={alternar}
          aria-label="Abrir menú"
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {usuario ? (
          <span>
            Vista de <span className="font-medium text-ink">{rolLabel(usuario.rol)}</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Centro de notificaciones */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              {noLeidas > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
                  {noLeidas > 9 ? '9+' : noLeidas}
                </span>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 max-h-[420px] w-80 overflow-y-auto rounded-md border border-border bg-surface p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[13px] font-medium text-ink">Notificaciones</span>
                {noLeidas > 0 && (
                  <button
                    type="button"
                    onClick={() => marcarTodasNotificacionesApi()}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-info transition-colors hover:bg-[#0a66ff14]"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                  </button>
                )}
              </div>
              <div className="my-1 h-px bg-border" />
              {notificaciones.length === 0 ? (
                <p className="px-2 py-4 text-center text-[12px] text-muted">Sin notificaciones</p>
              ) : (
                notificaciones.slice(0, 30).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrirNotif(n.id, n.link)}
                    className={`block w-full rounded px-2 py-2 text-left outline-none hover:bg-surface-2 ${n.leida ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          n.nivel === 'ok' ? 'bg-[#10b981]' : n.nivel === 'warn' ? 'bg-[#f59e0b]' : 'bg-info'
                        } ${n.leida ? 'opacity-0' : ''}`}
                      />
                      <span className="text-[13px] font-medium text-ink">{n.titulo}</span>
                    </div>
                    {n.detalle && <div className="ml-4 truncate text-[12px] text-muted">{n.detalle}</div>}
                  </button>
                ))
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Menú de usuario */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <UserCircle2 className="h-4 w-4 text-muted" strokeWidth={1.75} />
              {usuario?.nombre ?? 'Cuenta'}
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-[220px] rounded-md border border-border bg-surface p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              {usuario && (
                <div className="px-2 py-1.5">
                  <div className="text-[13px] font-medium text-ink">{usuario.nombre}</div>
                  <div className="text-[11px] text-muted">{usuario.cargo ?? rolLabel(usuario.rol)}</div>
                  <div className="demo-num mt-0.5 text-[11px] text-muted">{usuario.email}</div>
                </div>
              )}
              <div className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={cerrar}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <LogOut className="h-4 w-4 text-muted" /> Cerrar sesión
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
