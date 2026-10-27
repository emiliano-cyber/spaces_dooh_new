'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  StatusBadge,
  IMPRESION_TONO,
  IMPRESION_LABEL,
  OT_TONO,
  OT_LABEL,
} from '@/components/demo/StatusBadge'
import { withTrail } from '@/lib/nav-trail'
import type { Crumb } from '@/components/demo/ui/Breadcrumbs'
import { estadoSLAOT, formatFecha } from '@/lib/data/client'
import type { OrdenImpresion, OrdenTrabajo } from '@/lib/data/types'

// ============================================================================
//  Las listas de Imprenta y de Órdenes de trabajo de la ficha de campaña, con
//  el patrón de lista del Dashboard: `divide-y`, el dato principal a la
//  izquierda y las pastillas a la derecha, y «Ver todas (N)» en vez de una
//  lista sin fin.
//
//  Viven aquí, y no en `campanas/[id]/page.tsx`, para que esa página cambie lo
//  menos posible: otra rama la está tocando. Reciben lo que la página ya
//  filtró (`misOis`, `misOts`): no deciden qué órdenes son de la campaña.
// ============================================================================

const A_LA_VISTA = 5

function VerTodas({ total, todas, alternar }: { total: number; todas: boolean; alternar: () => void }) {
  if (total <= A_LA_VISTA) return null
  return (
    <button type="button" onClick={alternar} className="mt-2 bg-transparent text-[12px] font-medium text-info hover:underline">
      {todas ? 'Ver menos' : `Ver todas (${total})`}
    </button>
  )
}

export function ListaImpresionCampana({ ordenes }: { ordenes: OrdenImpresion[] }) {
  const [todas, setTodas] = useState(false)
  if (ordenes.length === 0) return <p className="text-[13px] text-muted">Sin órdenes de impresión.</p>
  return (
    <>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {(todas ? ordenes : ordenes.slice(0, A_LA_VISTA)).map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="demo-num truncate text-[12px] text-ink">{o.folio}</div>
              <div className="truncate text-[11px] text-muted">{o.material}</div>
            </div>
            <StatusBadge tono={IMPRESION_TONO[o.estatus]}>{IMPRESION_LABEL[o.estatus]}</StatusBadge>
          </li>
        ))}
      </ul>
      <VerTodas total={ordenes.length} todas={todas} alternar={() => setTodas((v) => !v)} />
    </>
  )
}

export function ListaOTCampana({ ordenes, trail }: { ordenes: OrdenTrabajo[]; trail: Crumb[] }) {
  const [todas, setTodas] = useState(false)
  if (ordenes.length === 0) return <p className="text-[13px] text-muted">Sin órdenes de trabajo.</p>
  return (
    <>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {(todas ? ordenes : ordenes.slice(0, A_LA_VISTA)).map((o) => {
          // La misma regla de SLA que la lista de Operaciones (`estadoSLAOT`):
          // solo las abiertas con fecha pueden ir vencidas.
          const vencida = estadoSLAOT(o) === 'VENCIDA'
          return (
            <li key={o.id}>
              <Link
                href={withTrail(`/operaciones/ot/${o.id}`, trail)}
                className="-mx-1 flex items-center justify-between gap-3 rounded px-1 py-2 hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="demo-num truncate text-[12px] text-ink">{o.folio}</div>
                  <div className="truncate text-[11px] text-muted">{o.descripcion}</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {o.fechaProgramada && (
                    <span
                      className={`demo-num rounded-full border px-2 py-0.5 text-[11px] ${vencida ? 'border-transparent bg-error-soft text-error' : 'border-border text-muted'}`}
                      title="Fecha compromiso"
                    >
                      {formatFecha(o.fechaProgramada)}
                    </span>
                  )}
                  {vencida && (
                    <span className="rounded-full border border-transparent bg-error-soft px-2 py-0.5 text-[11px] font-medium text-error">
                      Vencida
                    </span>
                  )}
                  <StatusBadge tono={OT_TONO[o.estatus]}>{OT_LABEL[o.estatus]}</StatusBadge>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <VerTodas total={ordenes.length} todas={todas} alternar={() => setTodas((v) => !v)} />
    </>
  )
}
