'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { formatFecha } from '@/lib/data/client'
import { withTrail } from '@/lib/nav-trail'
import {
  cambiarEtapaApi,
  oportunidadesApi,
  type Oportunidad,
  type PaginaOportunidades,
} from '@/lib/data/oportunidades-api'
import {
  ETAPAS_OPORTUNIDAD,
  agruparEmbudo,
  etapaOportunidadCerrada,
  montoReferencia,
  type EtapaOportunidad,
} from '@/lib/crm'
import { FormOportunidad } from './FormOportunidad'
import { COLOR_ETAPA, claveEtapa } from './etiquetas'

// ============================================================================
//  El embudo y la lista de oportunidades.  ADR 0051 §7, Fase 4.
// ----------------------------------------------------------------------------
//  Las dos vistas leen lo mismo (`GET /api/oportunidades`) y el servidor ya
//  filtra por vendedor: aquí no se decide quién ve qué.
//
//  En el embudo se puede mover una tarjeta a otra etapa abierta o a GANADA;
//  a PERDIDA no, porque exige el motivo y eso se escribe en la ficha.
// ============================================================================

const pct = (n: number, idioma: Parameters<typeof porcentajeEnIdioma>[1]) => porcentajeEnIdioma(String(n), idioma)

const enlaceFicha = (o: Oportunidad, volver: string, href: string) =>
  withTrail(`/crm/oportunidades/${o.id}`, [{ label: volver, href }])

export function Oportunidades({
  vista,
  inicial = null,
}: {
  vista: 'embudo' | 'oportunidades'
  /** Solo para pruebas: lo que se pinta antes de que llegue la API. */
  inicial?: PaginaOportunidades | null
}) {
  const { t, idioma, dinero } = useIdioma()
  const [pagina, setPagina] = useState<PaginaOportunidades | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EtapaOportunidad | 'todas'>('todas')
  const [formAbierto, setFormAbierto] = useState(false)

  const cargar = useCallback(() => {
    oportunidadesApi({ porPagina: 100 })
      .then((p) => { setPagina(p); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(cargar, [cargar])

  const ops = useMemo(() => pagina?.oportunidades ?? [], [pagina])
  const columnas = useMemo(() => agruparEmbudo(ops), [ops])
  const filtradas = filtro === 'todas' ? ops : ops.filter((o) => o.etapa === filtro)
  const volver = t('crm.titulo')
  const hrefVolver = vista === 'embudo' ? '/crm' : '/crm?vista=oportunidades'

  async function mover(o: Oportunidad, etapa: EtapaOportunidad) {
    try {
      await cambiarEtapaApi(o.id, { etapa })
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const cliente = (o: Oportunidad) => o.clienteNombre ?? o.prospectoNombre ?? '—'
  const monto = (o: Oportunidad) => {
    const m = montoReferencia(o.presupuestoMin, o.presupuestoMax)
    return m == null ? t('crm.sin-presupuesto') : dinero(m)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">
          {pagina && !pagina.veTodas ? t('crm.solo-tuyas') : vista === 'embudo' ? t('crm.embudo.ayuda') : ''}
        </p>
        <Button variant="success" onClick={() => setFormAbierto(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t('crm.nueva')}
        </Button>
      </div>

      {error && <p className="text-[13px] text-[#b42318]">{error}</p>}
      {!pagina && !error && <p className="text-[13px] text-muted">{t('crm.cargando')}</p>}
      {pagina && ops.length === 0 && <p className="text-[13px] text-muted">{t('crm.vacio')}</p>}

      {pagina && ops.length > 0 && vista === 'embudo' && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {columnas.map((c) => (
            <section key={c.etapa} aria-label={t(claveEtapa(c.etapa))} className="rounded-lg border border-border bg-surface p-2">
              <header className="mb-2 px-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-medium text-ink">{t(claveEtapa(c.etapa))}</h2>
                  <span className="demo-num text-[12px] text-muted">{c.oportunidades.length}</span>
                </div>
                <p className="demo-num text-[11px] text-muted">{t('crm.embudo.total', { monto: dinero(c.total) })}</p>
                {!etapaOportunidadCerrada(c.etapa) && (
                  <p className="demo-num text-[11px] text-muted">{t('crm.embudo.ponderado', { monto: dinero(c.ponderado) })}</p>
                )}
              </header>
              {/* `list-none` explícito: el proyecto no usa el preflight de Tailwind. */}
              <ul className="m-0 list-none space-y-2 p-0">
                {c.oportunidades.length === 0 && <li className="px-1 text-[12px] text-muted">{t('crm.embudo.vacio-columna')}</li>}
                {c.oportunidades.map((o) => (
                  <li key={o.id} className="rounded border border-border bg-bg p-2 text-[12px]">
                    <Link href={enlaceFicha(o, volver, hrefVolver)} className="font-medium text-ink hover:underline">{o.nombre}</Link>
                    <p className="text-muted">{cliente(o)}</p>
                    <p className={montoReferencia(o.presupuestoMin, o.presupuestoMax) == null ? 'text-muted' : 'demo-num text-ink'}>{monto(o)}</p>
                    <p className="text-muted">
                      {t('crm.prob', { pct: pct(o.probabilidad, idioma) })}
                      {o.fechaDecision ? ` · ${t('crm.decide', { fecha: formatFecha(o.fechaDecision, idioma) })}` : ''}
                    </p>
                    {!etapaOportunidadCerrada(o.etapa) && (
                      <select aria-label={t('crm.ficha.etapa')} className="mt-1 h-7 w-full rounded border border-border-strong bg-surface px-1 text-[12px] text-ink"
                        value="" onChange={(e) => e.target.value && mover(o, e.target.value as EtapaOportunidad)}>
                        <option value="">{t('crm.ficha.etapa')}</option>
                        {ETAPAS_OPORTUNIDAD.filter((x) => x !== o.etapa && x !== 'PERDIDA').map((x) => (
                          <option key={x} value={x}>{t(claveEtapa(x))}</option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pagina && ops.length > 0 && vista === 'oportunidades' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('crm.col.etapa')}>
            {(['todas', ...ETAPAS_OPORTUNIDAD] as const).map((e) => (
              <button key={e} type="button" aria-pressed={filtro === e} onClick={() => setFiltro(e)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${filtro === e ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-transparent text-muted hover:text-ink'}`}>
                {e === 'todas' ? t('crm.filtro.todas') : t(claveEtapa(e))}{' '}
                <span className="demo-num text-muted">{e === 'todas' ? pagina.total : pagina.porEtapa[e] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('crm.col.nombre')}</th>
                  <th className="px-3 py-2 font-medium">{t('crm.col.cliente')}</th>
                  <th className="px-3 py-2 font-medium">{t('crm.col.etapa')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('crm.col.presupuesto')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('crm.col.probabilidad')}</th>
                  <th className="px-3 py-2 font-medium">{t('crm.col.decision')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('crm.cotejo.col.cotizaciones')}</th>
                  <th className="px-3 py-2 font-medium">{t('crm.col.vendedor')}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-3 py-2"><Link href={enlaceFicha(o, volver, hrefVolver)} className="font-medium text-ink hover:underline">{o.nombre}</Link></td>
                    <td className="px-3 py-2 text-muted">{cliente(o)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${COLOR_ETAPA[o.etapa]}`}>{t(claveEtapa(o.etapa))}</span></td>
                    <td className={`px-3 py-2 text-right ${montoReferencia(o.presupuestoMin, o.presupuestoMax) == null ? 'text-muted' : 'demo-num'}`}>{monto(o)}</td>
                    <td className="demo-num px-3 py-2 text-right">{pct(o.probabilidad, idioma)}</td>
                    <td className="px-3 py-2 text-muted">{o.fechaDecision ? formatFecha(o.fechaDecision, idioma) : '—'}</td>
                    <td className="demo-num px-3 py-2 text-right">{o.cotizaciones}</td>
                    <td className="px-3 py-2 text-muted">{o.vendedorNombre ?? t('crm.cotejo.sin-vendedor')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormOportunidad abierto={formAbierto} onCerrar={() => setFormAbierto(false)} onGuardada={cargar} probabilidades={pagina?.probabilidades} />
    </div>
  )
}
