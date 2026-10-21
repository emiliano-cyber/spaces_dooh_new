'use client'

import { ChevronRight } from 'lucide-react'
import { formatMontoCorto } from '@/lib/data/client'
import type { Campana, Propuesta } from '@/lib/data/types'
import { pipelineCliente, type EtapaClientePipeline } from '@/lib/cliente-pipeline'

// El pipeline COMERCIAL de un cliente: sus propuestas por estatus y, a
// continuación, las campañas que salieron de ellas. Qué significa «pipeline»
// aquí y por qué no es el operativo de Campañas: lib/cliente-pipeline.ts.

const TONO: Record<EtapaClientePipeline, string> = {
  BORRADOR: 'text-muted',
  ENVIADA: 'text-info',
  APROBADA: 'text-[#0f7a55]',
  EN_CURSO: 'text-[#0f7a55]',
  TERMINADA: 'text-ink',
}

export function PipelineCliente({
  clienteId,
  propuestas,
  campanas,
}: {
  clienteId: string
  propuestas: Propuesta[]
  campanas: Campana[]
}) {
  const p = pipelineCliente(clienteId, propuestas, campanas)
  const winPct = p.winRate != null ? Math.round(p.winRate * 100) : null

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Pipeline</h3>
        <span className="text-[11px] text-muted">
          Montos con IVA · en pipeline{' '}
          <span className="demo-num font-medium text-ink">{formatMontoCorto(p.valorAbierto)}</span>
          {' · '}win rate{' '}
          <span className="demo-num font-medium text-ink">{winPct != null ? `${winPct}%` : '—'}</span>
        </span>
      </div>

      <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-5">
        {p.columnas.map((c, i) => (
          <li key={c.etapa} className="relative rounded-md border border-border bg-surface-2 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{c.label}</div>
            <div className={`demo-num text-[18px] font-semibold ${c.n === 0 ? 'text-muted' : TONO[c.etapa]}`}>{c.n}</div>
            <div className="demo-num text-[11px] text-muted">{formatMontoCorto(c.monto)}</div>
            {i < p.columnas.length - 1 && (
              <ChevronRight
                aria-hidden
                className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-border-strong sm:block"
              />
            )}
          </li>
        ))}
      </ol>

      {(p.rechazadas.n > 0 || p.canceladas.n > 0) && (
        <p className="mt-2 text-[11px] text-muted">
          Fuera del embudo:{' '}
          <span className="text-error">
            {p.rechazadas.n} propuesta{p.rechazadas.n === 1 ? '' : 's'} rechazada{p.rechazadas.n === 1 ? '' : 's'}
          </span>{' '}
          ({formatMontoCorto(p.rechazadas.monto)}) ·{' '}
          {p.canceladas.n} campaña{p.canceladas.n === 1 ? '' : 's'} cancelada{p.canceladas.n === 1 ? '' : 's'}
        </p>
      )}
    </section>
  )
}
