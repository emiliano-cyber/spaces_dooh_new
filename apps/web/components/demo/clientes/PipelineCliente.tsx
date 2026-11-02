'use client'

import { ChevronRight } from 'lucide-react'
import { formatMontoCorto } from '@/lib/data/client'
import type { Campana, Propuesta } from '@/lib/data/types'
import { pipelineCliente, type EtapaClientePipeline } from '@/lib/cliente-pipeline'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// El pipeline COMERCIAL de un cliente: sus propuestas por estatus y, a
// continuación, las campañas que salieron de ellas. Qué significa «pipeline»
// aquí y por qué no es el operativo de Campañas: lib/cliente-pipeline.ts.

// El verde oscuro (#0f7a55) se queda a propósito: `text-success` (#1da850) no
// llega al contraste mínimo sobre el gris de la columna. Es el mismo verde de
// los chips de estatus de Propuestas (`components/demo/propuestas/estatus.ts`).
const TONO: Record<EtapaClientePipeline, string> = {
  BORRADOR: 'text-muted',
  ENVIADA: 'text-info',
  APROBADA: 'text-[#0f7a55]',
  EN_CURSO: 'text-[#0f7a55]',
  TERMINADA: 'text-ink',
}

// Las columnas se nombran con `ETAPA_CLIENTE_LABEL` (`lib/cliente-pipeline.ts`),
// que sigue siendo la verdad en espanol; aqui solo se dice que clave traduce
// cada una, y `textos/clientes.test.ts` exige que el espanol sea IDENTICO.
export const CLAVE_ETAPA_CLIENTE: Record<EtapaClientePipeline, ClaveTexto> = {
  BORRADOR: 'clientes.pipeline.etapa.borrador',
  ENVIADA: 'clientes.pipeline.etapa.enviada',
  APROBADA: 'clientes.pipeline.etapa.aprobada',
  EN_CURSO: 'clientes.pipeline.etapa.en-curso',
  TERMINADA: 'clientes.pipeline.etapa.terminada',
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
  const { t, idioma } = useIdioma()
  const p = pipelineCliente(clienteId, propuestas, campanas)
  const winPct = p.winRate != null ? Math.round(p.winRate * 100) : null

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{t('clientes.pipeline.titulo')}</h3>
        <span className="text-[11px] text-muted">
          {interpolarNodos(t('clientes.pipeline.resumen'), {
            valor: <span className="demo-num font-medium text-ink">{formatMontoCorto(p.valorAbierto, idioma)}</span>,
            tasa: <span className="demo-num font-medium text-ink">{winPct != null ? `${winPct}%` : '—'}</span>,
          })}
        </span>
      </div>

      <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-5">
        {p.columnas.map((c, i) => (
          <li key={c.etapa} className="relative rounded-md border border-border bg-surface-2 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{t(CLAVE_ETAPA_CLIENTE[c.etapa])}</div>
            <div className={`demo-num text-[18px] font-semibold ${c.n === 0 ? 'text-muted' : TONO[c.etapa]}`}>{c.n}</div>
            {/* Una campaña «Sin presupuesto» suma 0: con campañas en la
                columna y monto 0, «$0» afirmaría que valen cero. */}
            <div className="demo-num text-[11px] text-muted" title={c.n > 0 && c.monto === 0 ? t('clientes.pipeline.sin-capturar') : undefined}>
              {c.n > 0 && c.monto === 0 ? t('clientes.pipeline.sin-monto') : formatMontoCorto(c.monto, idioma)}
            </div>
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
          {interpolarNodos(t('clientes.pipeline.fuera'), {
            rechazadas: (
              <span className="text-error">
                {t(p.rechazadas.n === 1 ? 'clientes.pipeline.rechazadas.uno' : 'clientes.pipeline.rechazadas.otros', { n: p.rechazadas.n })}
              </span>
            ),
            monto: formatMontoCorto(p.rechazadas.monto, idioma),
            canceladas: t(p.canceladas.n === 1 ? 'clientes.pipeline.canceladas.uno' : 'clientes.pipeline.canceladas.otros', { n: p.canceladas.n }),
          })}
        </p>
      )}
    </section>
  )
}
