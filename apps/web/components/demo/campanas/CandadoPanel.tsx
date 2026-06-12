'use client'

import { Lock, LockOpen, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useReadiness } from '@/lib/data/client'

// Candado de facturación: OC + fotos comprobatorias + reporte. Cuando los tres
// están, el candado se abre y la campaña queda lista para facturar. Para Telco
// Andina se enciende EN VIVO al cerrar la OT móvil con foto (Acto 4).
export function CandadoPanel({ campanaId }: { campanaId: string }) {
  const r = useReadiness(campanaId)
  if (!r) return <div className="h-28 w-full animate-pulse rounded bg-surface-2" />

  const abierto = r.candado

  return (
    <div
      className={cn(
        'rounded-md border p-4',
        abierto ? 'border-[#10b98140] bg-[#10b9810d]' : 'border-border bg-surface',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {abierto ? (
          <LockOpen className="h-4 w-4 text-success" strokeWidth={1.75} />
        ) : (
          <Lock className="h-4 w-4 text-muted" strokeWidth={1.75} />
        )}
        <span className="text-[13px] font-medium text-ink">
          {abierto ? 'Lista para facturar' : 'Candado de facturación'}
        </span>
      </div>
      <ul className="space-y-2">
        <Condicion ok={r.ocRecibida} label="Orden de compra recibida" />
        <Condicion ok={r.fotosComprobatorias} label="Fotografías comprobatorias" />
        <Condicion ok={r.reportePublicacion} label="Reporte de publicación" />
      </ul>
      {!abierto && (
        <p className="mt-3 text-[12px] text-muted">
          El candado se enciende cuando se completan las tres condiciones.
        </p>
      )}
    </div>
  )
}

function Condicion({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full',
          ok ? 'bg-success text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={ok ? 'text-ink' : 'text-muted'}>{label}</span>
    </li>
  )
}
