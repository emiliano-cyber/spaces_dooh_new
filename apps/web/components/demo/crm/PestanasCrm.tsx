'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import { useTexto } from '@/lib/i18n/contexto'

// ============================================================================
//  Las pestañas de Propuestas (ADR 0051 §7): Propuestas · Seguimiento ·
//  Prospectos.
// ----------------------------------------------------------------------------
//  18/11, pedido del dueño: «en el CRM no se debe de llamar CRM sino
//  Propuestas; además corrígelo porque debe de ser similar al que ya existía
//  de Propuestas». Así que el módulo dejó de ser una pantalla aparte (`/crm`)
//  con Propuestas como cuarta pestaña, y pasó a ser al revés: Propuestas es la
//  pantalla, su lista es lo PRIMERO que se ve, y lo del ADR 0051 son pestañas
//  dentro de ella (`/propuestas?vista=…`). `/crm` solo redirige aquí.
//
//  Son ENLACES y no un estado: así la vista vive en la dirección, y volver
//  desde la ficha de una oportunidad cae en la pestaña de la que se salió.
//
//  El dibujo es el de `ui/Tabs` (subrayado del activo, 13 px), y no chips: los
//  chips en Propuestas ya son los FILTROS de la lista, y unas pestañas con la
//  misma forma que un filtro se leían como otro filtro más.
//
//  18/11, segundo pedido: «Embudo» se llama «Seguimiento» (columnas por etapa)
//  y la pestaña «Oportunidades» se quitó por ser casi igual; su búsqueda y su
//  filtro de vendedor pasaron a Seguimiento.
// ============================================================================

export type PestanaCrm = 'propuestas' | 'seguimiento' | 'prospectos'

const PESTANAS: { clave: PestanaCrm; href: string }[] = [
  { clave: 'propuestas', href: '/propuestas' },
  { clave: 'seguimiento', href: '/propuestas?vista=seguimiento' },
  { clave: 'prospectos', href: '/propuestas?vista=prospectos' },
]

/**
 * La pestaña de una dirección `?vista=`; cualquier otra cosa es la lista de
 * propuestas. `embudo` y `oportunidades` son marcadores de las dos pestañas que
 * existieron entre el 17 y el 18/11: los dos caen en Seguimiento, que es lo que
 * las sustituyó, y no en la lista (que sería otra pantalla).
 */
export function pestanaDeVista(v: string | null | undefined): PestanaCrm {
  if (v === 'seguimiento' || v === 'embudo' || v === 'oportunidades') return 'seguimiento'
  return v === 'prospectos' ? 'prospectos' : 'propuestas'
}

export function PestanasCrm({ activa }: { activa: PestanaCrm }) {
  const t = useTexto()
  return (
    <nav aria-label={t('crm.pestanas')} className="flex flex-wrap gap-1 border-b border-border">
      {PESTANAS.map((p) => (
        <Link
          key={p.clave}
          href={p.href}
          scroll={false}
          aria-current={activa === p.clave ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
            activa === p.clave ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t(`crm.pestana.${p.clave}`)}
        </Link>
      ))}
    </nav>
  )
}
