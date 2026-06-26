'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

// Una miga de la ruta: etiqueta + destino opcional (la última no enlaza).
export interface Crumb {
  label: string
  href?: string
}

// Migas de pan: muestran dónde estás y por dónde llegaste. La última es la
// posición actual (no enlaza). Las anteriores enlazan a su origen.
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null
  return (
    <nav aria-label="Ruta de navegación" className={cn('flex flex-wrap items-center gap-1 text-[12px]', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted/60" />}
            {c.href && !last ? (
              <Link href={c.href} className="text-muted transition-colors hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-ink' : 'text-muted'}>{c.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
