'use client'

import Link from 'next/link'
import { Lock, LockOpen, ArrowRight } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useCampanasResumen,
  ETAPA_LABEL,
  formatMonto,
  formatFecha,
} from '@/lib/data/client'

export default function CampanasPage() {
  const campanas = useCampanasResumen()

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Campañas</h1>
        <p className="mt-1 text-[13px] text-muted">
          Cada campaña viaja sola por la empresa · pipeline en vivo
        </p>
      </div>

      {!campanas ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {campanas.map(({ campana: c, clienteNombre, etapa, index, totalPasos, candado }) => {
            const hilo = c.id === 'camp-telco'
            return (
              <li key={c.id}>
                <Link href={`/demo/campanas/${c.id}`}>
                  <Card
                    className={cn(
                      'p-4 transition-colors duration-150 hover:border-border-strong',
                      hilo && 'border-accent/60 bg-[#f59e0b08]',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-ink">{c.nombre}</h3>
                          {hilo && (
                            <span className="rounded-full border border-accent/50 bg-[#f59e0b1a] px-2 py-0.5 text-[10px] font-medium text-[#9a6700]">
                              hilo conductor
                            </span>
                          )}
                        </div>
                        <div className="demo-num mt-0.5 text-[12px] text-muted">
                          {c.folio} · {clienteNombre} ·{' '}
                          {formatFecha(c.fechaInicio)}–{formatFecha(c.fechaFin)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge tono={CAMPANA_TONO[c.estadoComercial]}>
                          {CAMPANA_LABEL[c.estadoComercial]}
                        </StatusBadge>
                        {candado ? (
                          <LockOpen className="h-4 w-4 text-success" strokeWidth={1.75} />
                        ) : (
                          <Lock className="h-4 w-4 text-muted" strokeWidth={1.75} />
                        )}
                      </div>
                    </div>

                    {/* Progreso del pipeline */}
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[12px]">
                        <span className="font-medium text-ink">{ETAPA_LABEL[etapa]}</span>
                        <span className="demo-num text-muted">
                          {index + 1}/{totalPasos}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-300"
                          style={{ width: `${((index + 1) / totalPasos) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="demo-num text-[13px] text-muted">
                        {c.presupuestoBruto ? formatMonto(c.presupuestoBruto) : 'Sin presupuesto'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-info">
                        Ver pipeline <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
