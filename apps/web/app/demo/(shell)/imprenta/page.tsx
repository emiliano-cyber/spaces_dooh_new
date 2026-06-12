'use client'

import Link from 'next/link'
import { ArrowUpRight, Ruler } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Stepper } from '@/components/demo/Stepper'
import {
  StatusBadge,
  IMPRESION_TONO,
  IMPRESION_LABEL,
} from '@/components/demo/StatusBadge'
import {
  useOrdenesImpresion,
  useCampanas,
  useSitios,
  type EstOrdenImpresion,
} from '@/lib/data/client'

const PROCESO: EstOrdenImpresion[] = [
  'ARTE_RECIBIDO',
  'VALIDADO',
  'EN_PRODUCCION',
  'IMPRESO',
  'LISTO_MONTAJE',
]

export default function ImprentaPage() {
  const ois = useOrdenesImpresion()
  const campanas = useCampanas()
  const sitios = useSitios()

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Imprenta</h1>
        <p className="mt-1 text-[13px] text-muted">Órdenes de impresión · del arte al montaje</p>
      </div>

      {!ois ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {ois.map((o) => {
            const camp = campanas?.find((c) => c.id === o.campanaId)
            const sitio = sitios?.find((s) => s.id === o.sitioId)
            const idx = PROCESO.indexOf(o.estatus)
            const pasos = PROCESO.map((p) => ({ key: p, label: IMPRESION_LABEL[p] }))
            const digital = o.alto === 0 && o.ancho === 0
            return (
              <li key={o.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="demo-num text-[12px] text-muted">{o.folio}</div>
                      <div className="mt-0.5 text-[14px] font-medium text-ink">{o.material}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5" />
                          {digital ? 'Contenido digital' : `${o.ancho} × ${o.alto} m`}
                        </span>
                        {sitio && <span>{sitio.nombre}</span>}
                        {o.proveedor && <span>· {o.proveedor}</span>}
                      </div>
                    </div>
                    <StatusBadge tono={IMPRESION_TONO[o.estatus]}>
                      {IMPRESION_LABEL[o.estatus]}
                    </StatusBadge>
                  </div>

                  {/* Proceso */}
                  <div className="mt-4">
                    <Stepper pasos={pasos} actualIndex={idx} />
                  </div>

                  {camp && (
                    <div className="mt-3 border-t border-border pt-3">
                      <Link
                        href={`/demo/campanas/${camp.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                      >
                        Campaña: {camp.nombre} <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
