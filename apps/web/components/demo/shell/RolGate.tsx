'use client'

import Link from 'next/link'
import { Lock, ExternalLink } from 'lucide-react'
import { useRol, TOKEN_TELCO } from '@/lib/data/client'

// Si el rol activo es Cliente externo, el shell NO renderiza módulos internos:
// sólo se le ofrece su portal (regla SET — lo que el rol no ve, no existe).
export function RolGate({ children }: { children: React.ReactNode }) {
  const rol = useRol()

  if (rol === 'CLIENTE') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm rounded-md border border-border bg-surface p-8 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-muted">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-ink">Acceso de cliente externo</h2>
          <p className="mt-1 text-[13px] text-muted">
            Como cliente externo sólo tienes acceso al portal público de tu campaña, sin datos
            internos ni financieros.
          </p>
          <Link
            href={`/demo/portal/${TOKEN_TELCO}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-[13px] font-medium text-accent-fg hover:opacity-90"
          >
            Abrir mi portal <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
