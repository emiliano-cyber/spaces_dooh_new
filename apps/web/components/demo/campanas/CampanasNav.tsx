'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
} from '@/components/demo/StatusBadge'
import { useCampanas } from '@/lib/data/client'

// Menú lateral de campañas: se muestra dentro del detalle/pipeline de una
// campaña para saltar a las demás sin volver al listado. La campaña activa
// queda resaltada. En pantallas chicas se apila arriba (scroll horizontal/vertical).
export function CampanasNav({ activeId }: { activeId: string }) {
  const campanas = useCampanas()

  if (!campanas) {
    return (
      <aside className="lg:w-64 lg:shrink-0">
        <div className="h-48 animate-pulse rounded-md bg-surface-2" />
      </aside>
    )
  }

  const ordenadas = [...campanas].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="lg:sticky lg:top-4">
        <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Campañas ({campanas.length})
        </div>
        <nav className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface p-1 lg:max-h-[calc(100vh-6rem)]">
          {ordenadas.map((c) => {
            const activa = c.id === activeId
            return (
              <Link
                key={c.id}
                href={`/demo/campanas/${c.id}`}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'block rounded border-l-2 px-2 py-1.5 transition-colors',
                  activa
                    ? 'border-info bg-surface-2'
                    : 'border-transparent hover:bg-surface-2',
                )}
              >
                <div
                  className={cn(
                    'truncate text-[12.5px]',
                    activa ? 'font-medium text-ink' : 'text-ink',
                  )}
                >
                  {c.nombre}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1.5">
                  <span className="demo-num truncate text-[10.5px] text-muted">
                    {c.folio}
                  </span>
                  <StatusBadge tono={CAMPANA_TONO[c.estadoComercial]}>
                    {CAMPANA_LABEL[c.estadoComercial]}
                  </StatusBadge>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
