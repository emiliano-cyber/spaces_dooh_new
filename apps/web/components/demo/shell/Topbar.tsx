'use client'

import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, RotateCcw, UserCircle2, Users, LogOut } from 'lucide-react'
import { useUsuario, useCerrarSesion, useReiniciarDemo } from '@/lib/data/client'
import { rolLabel } from './nav'

export function Topbar() {
  const router = useRouter()
  const usuario = useUsuario()
  const cerrarSesion = useCerrarSesion()
  const reiniciar = useReiniciarDemo()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="text-[13px] text-muted">
        {usuario ? (
          <>
            Vista de <span className="font-medium text-ink">{rolLabel(usuario.rol)}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
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
                  <div className="text-[11px] text-muted">{usuario.cargo}</div>
                  <div className="demo-num mt-0.5 text-[11px] text-muted">{usuario.email}</div>
                </div>
              )}
              <div className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => router.push('/demo/login')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <Users className="h-4 w-4 text-muted" /> Cambiar de usuario
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  cerrarSesion()
                  router.push('/demo/login')
                }}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <LogOut className="h-4 w-4 text-muted" /> Cerrar sesión
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Reiniciar demo */}
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex h-9 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Restablecer todos los datos de la demo y cerrar sesión"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Reiniciar demo
        </button>
      </div>
    </header>
  )
}
