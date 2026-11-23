'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { rutaListaPropuestas } from '@/components/demo/crm/PestanasCrm'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { conteo } from '@/lib/plural'
import { formatMonto, formatFecha, type Propuesta } from '@/lib/data/client'
import type { Cliente } from '@/lib/data/types'
import { cotejoPorCliente, type CotejoCliente } from '@/lib/crm-cotejo'
import { EST, CLAVE_ESTATUS, ORDEN_ESTATUS } from '@/components/demo/propuestas/estatus'
import { useIdioma } from '@/lib/i18n/contexto'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { cifraEnEtiqueta } from '@/lib/i18n/cifra-en-etiqueta'
import { withTrail } from '@/lib/nav-trail'

// ============================================================================
//  El cotejo por cliente (CRM, Fase 1 del ADR 0051, 17/11).
// ----------------------------------------------------------------------------
//  Una fila por cliente con sus cotizaciones, días negociando, dinero en juego
//  y ganado; se despliega para ver cada propuesta y abrirla. Lee la MISMA lista
//  que la vista «Por propuesta» (`usePropuestas`), así que no pide nada al
//  servidor. Las cuentas viven en `lib/crm-cotejo.ts`, que es lo que se prueba.
// ============================================================================

export function CotejoPorCliente({ propuestas, clientes }: { propuestas: Propuesta[]; clientes: Cliente[] | null | undefined }) {
  const { t, idioma } = useIdioma()
  const [abierto, setAbierto] = useState<string | null>(null)
  const grupos = useMemo(() => cotejoPorCliente(propuestas), [propuestas])
  const nombres = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c.nombre])), [clientes])

  const nombreDe = (g: CotejoCliente) =>
    g.clienteId == null ? t('crm.cotejo.sin-cliente') : (nombres.get(g.clienteId) ?? t('crm.cotejo.cliente-desconocido'))

  if (grupos.length === 0) {
    return <p className="py-8 text-center text-[13px] text-muted">{t('crm.cotejo.vacio')}</p>
  }

  return (
    <div>
      <p className="mb-3 text-[12px] text-muted">
        {t('crm.cotejo.subtitulo')} ·{' '}
        <span className="demo-num">{conteo(grupos.length, t('crm.unidad.cliente'), t('crm.unidad.clientes'))}</span>
      </p>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {grupos.map((g) => {
          const clave = g.clienteId ?? '__sin-cliente__'
          const desplegado = abierto === clave
          return (
            <li key={clave} className="py-3">
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? null : clave)}
                aria-expanded={desplegado}
                className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  {desplegado ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-ink">{nombreDe(g)}</span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-px text-[11px]',
                          g.abierta ? 'border-[color-mix(in_srgb,var(--accent)_25%,transparent)] text-info' : 'border-border text-muted',
                        )}
                      >
                        {t(g.abierta ? 'crm.cotejo.estado.abierto' : 'crm.cotejo.estado.cerrado')}
                      </span>
                      {g.vencidas > 0 && (
                        <span className="rounded-full border border-[#f59e0b40] px-2 py-px text-[11px] text-[#a16207]">
                          {t('crm.cotejo.vencidas', { n: g.vencidas })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {t('crm.cotejo.primera', { fecha: formatFecha(g.primeraEn, idioma) })} ·{' '}
                      {t('crm.cotejo.ultima', { fecha: formatFecha(g.ultimaActividadEn, idioma) })}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {t('crm.cotejo.vendedores', {
                        nombres: g.vendedores.length ? g.vendedores.join(', ') : t('crm.cotejo.sin-vendedor'),
                      })}
                    </div>
                  </div>
                </div>

                <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2 pl-6 sm:grid-cols-3 lg:grid-cols-6 lg:pl-0">
                  <Metrica etiqueta={t('crm.cotejo.col.cotizaciones')}>
                    <span className="demo-num">{g.cotizaciones}</span>
                    <span className="ml-1.5 inline-flex gap-1 align-middle">
                      {ORDEN_ESTATUS.filter((e) => g.porEstatus[e] > 0).map((e) => (
                        <span
                          key={e}
                          title={t(CLAVE_ESTATUS[e])}
                          className={cn('demo-num rounded border px-1 text-[10px] font-normal', EST[e].cls)}
                        >
                          {g.porEstatus[e]}
                        </span>
                      ))}
                    </span>
                  </Metrica>
                  <Metrica etiqueta={t('crm.cotejo.col.renegociaciones')}>
                    <span className="demo-num">{g.renegociaciones}</span>
                  </Metrica>
                  <Metrica etiqueta={t('crm.cotejo.col.dias')}>
                    {g.diasNegociando == null ? (
                      <span title={t('crm.cotejo.dias.sin-fecha')}>—</span>
                    ) : (
                      <span className="demo-num">
                        {conteo(g.diasNegociando, t('crm.unidad.dia'), t('crm.unidad.dias'))}
                      </span>
                    )}
                  </Metrica>
                  <Metrica etiqueta={t('crm.cotejo.col.en-juego')} sub={t('crm.cotejo.con-iva')}>
                    <span className="demo-num">{formatMonto(g.enJuego, idioma)}</span>
                  </Metrica>
                  <Metrica etiqueta={t('crm.cotejo.col.ganado')} sub={t('crm.cotejo.con-iva')}>
                    <span className="demo-num text-[#0f7a55]">{formatMonto(g.ganado, idioma)}</span>
                  </Metrica>
                  <Metrica etiqueta={t('crm.cotejo.col.cierre')}>
                    <span className="demo-num">
                      {g.tasaCierre == null
                        ? '—'
                        : porcentajeEnIdioma(cifraEnEtiqueta(Math.round(g.tasaCierre * 100), idioma), idioma)}
                    </span>
                  </Metrica>
                </dl>
              </button>

              {desplegado && (
                <ul className="m-0 mt-3 list-none space-y-1.5 rounded-md bg-surface-2 p-2 pl-8">
                  {g.propuestas.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="demo-num text-muted">{p.folio}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{p.nombre}</span>
                      <span className={cn('rounded-full border px-2 py-px text-[11px]', EST[p.estatus].cls)}>
                        {t(CLAVE_ESTATUS[p.estatus])}
                      </span>
                      <span className="text-muted">{t('crm.cotejo.version', { n: p.version })}</span>
                      <span className="text-muted">{formatFecha(p.creadoEn, idioma)}</span>
                      <span className="demo-num w-28 text-right text-ink">{formatMonto(p.total, idioma)}</span>
                      <Link
                        href={withTrail(`/propuestas/${p.id}`, [{ label: t('propuestas.lista.titulo'), href: rutaListaPropuestas() }])}
                        className="text-[12px] font-medium text-accent hover:underline"
                      >
                        {t('crm.cotejo.ver')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Metrica({ etiqueta, sub, children }: { etiqueta: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[96px]">
      <dt className="text-[10px] uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="m-0 text-[14px] font-semibold text-ink">{children}</dd>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  )
}
