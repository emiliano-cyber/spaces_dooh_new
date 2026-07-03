'use client'

import Link from 'next/link'
import { Lock, LockOpen, ArrowRight, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useCampanas,
  useCampanasResumen,
  ETAPA_LABEL,
  etapasPipeline,
  formatMonto,
  formatFecha,
} from '@/lib/data/client'

export default function CampanasPage() {
  const campanas = useCampanasResumen()
  const todas = useCampanas()

  // Cola de validación: campañas enviadas al dominio que esperan revisión de la
  // información de los anuncios antes de publicarse.
  const porValidar = (todas ?? []).filter(
    (c) => c.enviadaDominio && c.validacionEstatus === 'PENDIENTE',
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Campañas</h1>
        <p className="mt-1 text-[13px] text-muted">
          Cada campaña viaja sola por la empresa · pipeline en vivo
        </p>
      </div>

      {/* Cola de validación de publicación */}
      {porValidar.length > 0 && (
        <Card className="border-accent/50 bg-[#f59e0b08] p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#9a6700]" strokeWidth={1.75} />
            <h2 className="text-[13px] font-semibold text-ink">
              Por validar ({porValidar.length})
            </h2>
            <span className="text-[12px] text-muted">
              · enviadas al dominio, esperan aprobación antes de publicar
            </span>
          </div>
          <ul className="divide-y divide-border">
            {porValidar.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/demo/campanas/${c.id}`}
                  className="-mx-1 flex items-center justify-between gap-3 rounded px-1 py-2 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{c.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {c.folio} · {c.tipoCampana}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-info">
                    Validar <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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

                    {/* Progreso del pipeline: TODAS las etapas y cómo van */}
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between text-[12px]">
                        <span className="text-muted">
                          Etapa actual: <span className="font-medium text-ink">{ETAPA_LABEL[etapa]}</span>
                        </span>
                        <span className="demo-num text-muted">{index + 1}/{totalPasos}</span>
                      </div>
                      <div className="flex items-start overflow-x-auto pb-1">
                        {etapasPipeline(c).map((e, i, arr) => {
                          const done = i < index
                          const cur = i === index
                          return (
                            <div key={e} className="flex items-start">
                              <div className="flex w-[72px] shrink-0 flex-col items-center text-center">
                                <span
                                  className={cn(
                                    'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                                    done
                                      ? 'border-success bg-success text-white'
                                      : cur
                                        ? 'border-accent bg-[#f59e0b1a] text-[#9a6700]'
                                        : 'border-border bg-surface text-muted',
                                  )}
                                >
                                  {done ? '✓' : i + 1}
                                </span>
                                <span
                                  className={cn(
                                    'mt-1 text-[10px] leading-tight',
                                    cur ? 'font-medium text-ink' : done ? 'text-ink' : 'text-muted',
                                  )}
                                >
                                  {ETAPA_LABEL[e]}
                                </span>
                              </div>
                              {i < arr.length - 1 && (
                                <span className={cn('mt-2.5 h-0.5 w-3 shrink-0 rounded-full', i < index ? 'bg-success' : 'bg-border')} />
                              )}
                            </div>
                          )
                        })}
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
