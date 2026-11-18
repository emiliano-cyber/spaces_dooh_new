'use client'

import Link from 'next/link'
import { useTexto } from '@/lib/i18n/contexto'

// ============================================================================
//  Las cuatro pestañas del CRM (ADR 0051 §7): Embudo · Oportunidades ·
//  Prospectos · Propuestas.
// ----------------------------------------------------------------------------
//  Son ENLACES y no un estado: la de Propuestas lleva a `/propuestas`, que no
//  cambió de dirección (la liga, los marcadores y los enlaces de otras
//  pantallas siguen sirviendo), y la pinta también arriba de su lista para que
//  se lea como parte del CRM. Las otras tres viven en `/crm?vista=…`.
// ============================================================================

export type PestanaCrm = 'embudo' | 'oportunidades' | 'prospectos' | 'propuestas'

const PESTANAS: { clave: PestanaCrm; href: string }[] = [
  { clave: 'embudo', href: '/crm' },
  { clave: 'oportunidades', href: '/crm?vista=oportunidades' },
  { clave: 'prospectos', href: '/crm?vista=prospectos' },
  { clave: 'propuestas', href: '/propuestas' },
]

export function PestanasCrm({ activa }: { activa: PestanaCrm }) {
  const t = useTexto()
  return (
    <nav aria-label={t('crm.pestanas')} className="flex flex-wrap gap-1.5">
      {PESTANAS.map((p) => (
        <Link
          key={p.clave}
          href={p.href}
          aria-current={activa === p.clave ? 'page' : undefined}
          className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
            activa === p.clave
              ? 'border-accent bg-accent-soft font-medium text-ink'
              : 'border-border bg-transparent text-muted hover:text-ink'
          }`}
        >
          {t(`crm.pestana.${p.clave}`)}
        </Link>
      ))}
    </nav>
  )
}
