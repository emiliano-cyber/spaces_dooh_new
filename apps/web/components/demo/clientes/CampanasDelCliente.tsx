'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { StatusBadge, CAMPANA_TONO } from '@/components/demo/StatusBadge'
import { formatFecha, formatMonto, type CampanaResumen } from '@/lib/data/client'
import { CLAVE_ESTADO_CAMPANA, CLAVE_ETAPA } from '@/components/demo/campanas/etiquetas'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Propuesta } from '@/lib/data/types'
import { campanasDelCliente } from '@/lib/cliente-pipeline'

// Las campañas de UN cliente. Cada fila lleva a `/campanas/<id>`, que es la
// misma ruta a la que lleva la lista de Campañas: es una ruta dinámica de Next
// (app/(app)/(shell)/campanas/[id]), así que el enlace aguanta una recarga y
// se puede copiar y mandar.
export function CampanasDelCliente({
  clienteId,
  resumen,
  propuestas,
  onNavegar,
}: {
  clienteId: string
  resumen: CampanaResumen[]
  propuestas: Propuesta[]
  // El modal que la contiene se cierra al navegar; si no, quedaría encima de
  // la pantalla de la campaña.
  onNavegar?: () => void
}) {
  const { t, idioma } = useIdioma()
  const suyas = campanasDelCliente(resumen.map((r) => r.campana), clienteId, propuestas)
  const porId = new Map(resumen.map((r) => [r.campana.id, r]))

  return (
    <section>
      <h3 className="mb-2 text-[13px] font-semibold text-ink">
        {t('clientes.campanas.titulo')} <span className="demo-num font-normal text-muted">({suyas.length})</span>
      </h3>
      {suyas.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted">
          {t('clientes.campanas.vacia')}
        </p>
      ) : (
        <ul className="m-0 list-none divide-y divide-border rounded-md border border-border p-0">
          {suyas.map((c) => {
            const r = porId.get(c.id)
            return (
              <li key={c.id}>
                <Link
                  href={`/campanas/${c.id}`}
                  onClick={onNavegar}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{c.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {c.folio ? <>{c.folio} · </> : null}{formatFecha(c.fechaInicio, idioma)}–{formatFecha(c.fechaFin, idioma)}
                      {r ? <> · {t(CLAVE_ETAPA[r.etapa])}</> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="demo-num text-[12px] text-ink">
                      {c.presupuestoBruto ? formatMonto(c.presupuestoBruto, idioma) : t('clientes.campanas.sin-presupuesto')}
                    </span>
                    <StatusBadge tono={CAMPANA_TONO[c.estadoComercial]}>
                      {t(CLAVE_ESTADO_CAMPANA[c.estadoComercial])}
                    </StatusBadge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
