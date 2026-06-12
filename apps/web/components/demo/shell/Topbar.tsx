'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, RotateCcw, UserCircle2, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useRol, useSetRol, useReiniciarDemo } from '@/lib/data/client'
import { ROLES, rolLabel } from './nav'

export function Topbar() {
  const rol = useRol()
  const setRol = useSetRol()
  const reiniciar = useReiniciarDemo()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="text-[13px] text-muted">
        Vista de <span className="font-medium text-ink">{rolLabel(rol)}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Selector de rol demo */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <UserCircle2 className="h-4 w-4 text-muted" strokeWidth={1.75} />
              {rolLabel(rol)}
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Cambiar rol
              </div>
              {ROLES.map((r) => (
                <DropdownMenu.Item
                  key={r.value}
                  onSelect={() => setRol(r.value)}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
                >
                  {r.label}
                  {rol === r.value ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Reiniciar demo */}
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex h-9 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Restablecer todos los datos de la demo"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Reiniciar demo
        </button>
      </div>
    </header>
  )
}
