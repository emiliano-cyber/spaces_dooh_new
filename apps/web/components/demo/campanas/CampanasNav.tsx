'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
} from '@/components/demo/StatusBadge'
import { useCampanas } from '@/lib/data/client'
import { useMenuCampanasPlegado } from '@/lib/campanas-menu'
import type { Campana } from '@/lib/data/types'

// Menú lateral de campañas: se muestra dentro del detalle/pipeline de una
// campaña para saltar a las demás sin volver al listado. La campaña activa
// queda resaltada. En pantallas chicas (<lg) se apila arriba del pipeline; en
// escritorio va a la izquierda, fijo al hacer scroll.
//
// Desde el 2026-09-30 se PLIEGA en cualquier ancho (pedido del dueño): antes
// no tenía botón, y en móvil/tableta empujaba el pipeline hasta 60vh hacia
// abajo y en escritorio le quitaba 16rem. Plegado, en escritorio queda una
// tira de 2.25rem con el botón y el pipeline (`flex-1` en la página) se lleva
// el resto; en móvil queda una sola fila «Campañas (N) · Mostrar». La
// preferencia se recuerda por navegador (`lib/campanas-menu.ts`).

const ID_LISTA = 'campanas-menu-lista'

type CampanaDelMenu = Pick<Campana, 'id' | 'nombre' | 'folio' | 'estadoComercial' | 'creadoEn'>

export function CampanasNav({ activeId }: { activeId: string }) {
  const campanas = useCampanas()
  const { plegado, alternar } = useMenuCampanasPlegado()

  if (!campanas) {
    return (
      <aside className={plegado ? 'lg:w-9 lg:shrink-0' : 'lg:w-64 lg:shrink-0'}>
        <div className={plegado ? 'h-9 animate-pulse rounded-md bg-surface-2' : 'h-48 animate-pulse rounded-md bg-surface-2'} />
      </aside>
    )
  }

  return <CampanasNavVista campanas={campanas} activeId={activeId} plegado={plegado} onAlternar={alternar} />
}

/** La parte que se ve, sin estado: se prueba rindiéndola (`CampanasNav.test.ts`). */
export function CampanasNavVista({
  campanas,
  activeId,
  plegado,
  onAlternar,
}: {
  campanas: CampanaDelMenu[]
  activeId: string
  plegado: boolean
  onAlternar: () => void
}) {
  // Más recientes arriba, igual que el listado de Campañas: al saltar entre
  // campañas desde aquí se espera el mismo orden que en la pantalla de la que
  // vienes. Antes era alfabético, que dejaba las campañas nuevas enterradas.
  // Desempate por folio para que el orden no baile entre renders.
  const ordenadas = [...campanas].sort(
    (a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.folio.localeCompare(a.folio),
  )

  const etiqueta = plegado ? 'Mostrar el menú de campañas' : 'Ocultar el menú de campañas'

  return (
    <aside className={cn('lg:shrink-0', plegado ? 'lg:w-9' : 'lg:w-64')}>
      <div className="lg:sticky lg:top-4">
        <div
          className={cn(
            'mb-1.5 flex items-center justify-between gap-2 px-1',
            plegado && 'mb-0 lg:justify-center lg:px-0',
          )}
        >
          {/* Plegado en escritorio solo queda el botón: el título no cabe en la tira. */}
          <span
            className={cn(
              'truncate text-[11px] font-semibold uppercase tracking-wide text-muted',
              plegado && 'lg:sr-only',
            )}
          >
            Campañas ({campanas.length})
          </span>
          {/* El botón se ve en TODOS los anchos: ninguna clase responsive lo esconde. */}
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={!plegado}
            aria-controls={ID_LISTA}
            aria-label={etiqueta}
            title={etiqueta}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-1 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            {/* Menos de lg el menú va ENCIMA del pipeline: se pliega hacia arriba. */}
            <span className="lg:hidden">{plegado ? 'Mostrar' : 'Ocultar'}</span>
            {plegado ? (
              <ChevronDown aria-hidden className="h-3.5 w-3.5 lg:hidden" />
            ) : (
              <ChevronUp aria-hidden className="h-3.5 w-3.5 lg:hidden" />
            )}
            {/* Desde lg va a la IZQUIERDA: se pliega hacia el costado. */}
            {plegado ? (
              <PanelLeftOpen aria-hidden className="hidden h-4 w-4 lg:block" />
            ) : (
              <PanelLeftClose aria-hidden className="hidden h-4 w-4 lg:block" />
            )}
          </button>
        </div>
        {/* `hidden` y no desmontar: la lista sigue existiendo para `aria-controls`. */}
        <nav
          id={ID_LISTA}
          aria-label="Otras campañas"
          hidden={plegado}
          className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface p-1 lg:max-h-[calc(100vh-6rem)]"
        >
          {ordenadas.map((c) => {
            const activa = c.id === activeId
            return (
              <Link
                key={c.id}
                href={`/campanas/${c.id}`}
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
