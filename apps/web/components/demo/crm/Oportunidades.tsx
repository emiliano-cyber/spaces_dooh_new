'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Target, Trophy, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/client'
import { withTrail } from '@/lib/nav-trail'
import type { Crumb } from '@/components/demo/ui/Breadcrumbs'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import {
  cambiarEtapaApi,
  oportunidadesApi,
  type Oportunidad,
  type PaginaOportunidades,
} from '@/lib/data/oportunidades-api'
import {
  ETAPAS_ABIERTAS,
  ETAPAS_OPORTUNIDAD,
  agruparEmbudo,
  etapaOportunidadCerrada,
  montoReferencia,
  type EtapaOportunidad,
} from '@/lib/crm'
import { FormOportunidad } from './FormOportunidad'
import { COLOR_ETAPA, claveEtapa } from './etiquetas'

// ============================================================================
//  El embudo y la lista de oportunidades, como pestañas de Propuestas.
//  ADR 0051 §7, Fase 4; rehecho el 18/11 para que se parezca a Propuestas.
// ----------------------------------------------------------------------------
//  Las dos vistas leen lo mismo (`GET /api/oportunidades`) y el servidor ya
//  filtra por vendedor: aquí no se decide quién ve qué.
//
//  Mismo orden que la lista de Propuestas (rediseño del 26/10): KPIs con la
//  `KPICard` del Dashboard → la tarjeta plegable con su contenido → chips de
//  filtro dentro de ella. El botón «Nueva oportunidad» NO vive aquí: va en el
//  encabezado de la página, en el mismo sitio que «Nueva propuesta», y la
//  página nos pasa si el formulario está abierto.
//
//  En el embudo se puede mover una tarjeta a otra etapa abierta o a GANADA;
//  a PERDIDA no, porque exige el motivo y eso se escribe en la ficha.
// ============================================================================

// El rastro dice «Propuestas › Oportunidades»: la ficha vive en /crm/… por
// dentro, pero quien la abre llegó desde Propuestas y ahí vuelve.
const enlaceFicha = (o: Oportunidad, rastro: Crumb[]) => withTrail(`/crm/oportunidades/${o.id}`, rastro)

const sumaMontos = (ops: Oportunidad[]) =>
  ops.reduce((s, o) => s + (montoReferencia(o.presupuestoMin, o.presupuestoMax) ?? 0), 0)

export function Oportunidades({
  vista,
  inicial = null,
  nuevaAbierta = false,
  onCerrarNueva = () => {},
}: {
  vista: 'embudo' | 'oportunidades'
  /** Solo para pruebas: lo que se pinta antes de que llegue la API. */
  inicial?: PaginaOportunidades | null
  /** El formulario de alta, que se abre desde el encabezado de la página. */
  nuevaAbierta?: boolean
  onCerrarNueva?: () => void
}) {
  const { t, idioma, dinero } = useIdioma()
  const [pagina, setPagina] = useState<PaginaOportunidades | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EtapaOportunidad | 'todas'>('todas')

  const cargar = useCallback(() => {
    oportunidadesApi({ porPagina: 100 })
      .then((p) => { setPagina(p); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(cargar, [cargar])

  const ops = useMemo(() => pagina?.oportunidades ?? [], [pagina])
  const columnas = useMemo(() => agruparEmbudo(ops), [ops])
  const filtradas = filtro === 'todas' ? ops : ops.filter((o) => o.etapa === filtro)
  const rastro: Crumb[] = [
    { label: t('propuestas.lista.titulo'), href: '/propuestas' },
    { label: t(vista === 'embudo' ? 'crm.pestana.embudo' : 'crm.pestana.oportunidades'), href: `/propuestas?vista=${vista}` },
  ]

  // Los conteos salen de `porEtapa`, que el servidor cuenta sobre TODAS; los
  // montos, de las que llegaron (las primeras 100), que es lo que hay.
  const cuenta = (e: EtapaOportunidad) => pagina?.porEtapa[e] ?? 0
  const abiertas = ETAPAS_ABIERTAS.reduce((s, e) => s + cuenta(e), 0)
  const enJuego = sumaMontos(ops.filter((o) => !etapaOportunidadCerrada(o.etapa)))
  const ganado = sumaMontos(ops.filter((o) => o.etapa === 'GANADA'))
  const cotizaciones = ops.reduce((s, o) => s + o.cotizaciones, 0)

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
  const badge = (e: EtapaOportunidad) => (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', COLOR_ETAPA[e])}>{t(claveEtapa(e))}</span>
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!pagina ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label={t('crm.kpi.abiertas')}
              value={String(abiertas)}
              sub={t('crm.kpi.abiertas.sub')}
              tono={abiertas > 0 ? 'azul' : 'neutro'}
              icon={<Target className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.kpi.en-juego')}
              value={dinero(enJuego)}
              sub={t('crm.kpi.en-juego.sub')}
              tono="ambar"
              icon={<Wallet className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.kpi.ganadas')}
              value={dinero(ganado)}
              sub={t('crm.kpi.ganadas.sub', { ganadas: cuenta('GANADA'), perdidas: cuenta('PERDIDA') })}
              tono="verde"
              icon={<Trophy className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.cotejo.col.cotizaciones')}
              value={String(cotizaciones)}
              sub={t('crm.kpi.cotizaciones.sub')}
              icon={<FileText className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {error && <p className="text-[13px] text-error">{error}</p>}
      {!pagina && !error && <div className="h-40 animate-pulse rounded-md bg-surface-2" aria-label={t('crm.cargando')} />}
      {pagina && ops.length === 0 && <p className="py-10 text-center text-[13px] text-muted">{t('crm.vacio')}</p>}

      {pagina && ops.length > 0 && vista === 'embudo' && (
        <CardColapsable
          id="propuestas.embudo"
          titulo={t('crm.pestana.embudo')}
          resumen={pagina.veTodas ? undefined : <span className="text-[12px] text-muted">{t('crm.solo-tuyas')}</span>}
        >
          <div className="grid items-start gap-3 md:grid-cols-3 xl:grid-cols-6">
            {columnas.map((c) => (
              <section key={c.etapa} aria-label={t(claveEtapa(c.etapa))} className="rounded-md border border-border bg-surface-2 p-2">
                <header className="mb-2 px-1">
                  <div className="flex items-center justify-between gap-2">
                    {badge(c.etapa)}
                    <span className="demo-num text-[12px] text-muted">{c.oportunidades.length}</span>
                  </div>
                  <p className="demo-num mt-1 text-[11px] text-muted">{t('crm.embudo.total', { monto: dinero(c.total) })}</p>
                </header>
                {/* `list-none` explícito: el proyecto no usa el preflight de Tailwind. */}
                <ul className="m-0 list-none space-y-2 p-0">
                  {c.oportunidades.length === 0 && <li className="px-1 text-[12px] text-muted">{t('crm.embudo.vacio-columna')}</li>}
                  {c.oportunidades.map((o) => (
                    <li key={o.id} className="rounded-md border border-border bg-surface p-2.5 text-[12px]">
                      <Link href={enlaceFicha(o, rastro)} className="text-[13px] font-medium text-ink hover:underline">{o.nombre}</Link>
                      <p className="text-muted">{cliente(o)}</p>
                      <p className={montoReferencia(o.presupuestoMin, o.presupuestoMax) == null ? 'text-muted' : 'demo-num font-medium text-ink'}>{monto(o)}</p>
                      {o.fechaDecision && (
                        <p className="text-muted">{t('crm.decide', { fecha: formatFecha(o.fechaDecision, idioma) })}</p>
                      )}
                      {!etapaOportunidadCerrada(o.etapa) && (
                        <select aria-label={t('crm.ficha.etapa')} className="mt-1.5 h-7 w-full rounded border border-border-strong bg-surface px-1 text-[12px] text-ink"
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
        </CardColapsable>
      )}

      {pagina && ops.length > 0 && vista === 'oportunidades' && (
        <CardColapsable
          id="propuestas.oportunidades"
          titulo={t('crm.pestana.oportunidades')}
          resumen={
            <span className="text-[12px] text-muted">
              {t('crm.lista.resumen', { n: filtradas.length, total: pagina.total })}
              {pagina.veTodas ? '' : ` · ${t('crm.solo-tuyas')}`}
            </span>
          }
          contentClassName="px-0 pb-0"
        >
          {/* Chips de filtro como los de estatus en la lista de propuestas. */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3" role="group" aria-label={t('crm.col.etapa')}>
            {(['todas', ...ETAPAS_OPORTUNIDAD] as const).map((e) => (
              <button key={e} type="button" aria-pressed={filtro === e} onClick={() => setFiltro(e)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors',
                  filtro === e ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-surface text-muted hover:text-ink',
                )}>
                {e === 'todas' ? t('crm.filtro.todas') : t(claveEtapa(e))}{' '}
                <span className="demo-num">{e === 'todas' ? pagina.total : cuenta(e)}</span>
              </button>
            ))}
          </div>
          {/* Tabla con el estilo de Clientes (26/10): cabecera pequeña en
              mayúsculas, celdas con `px-4` y bordes del token. */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">{t('crm.col.nombre')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('crm.col.cliente')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('crm.col.etapa')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('crm.col.presupuesto')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('crm.col.decision')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('crm.cotejo.col.cotizaciones')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('crm.col.vendedor')}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5"><Link href={enlaceFicha(o, rastro)} className="font-medium text-ink hover:underline">{o.nombre}</Link></td>
                    <td className="px-4 py-2.5 text-muted">{cliente(o)}</td>
                    <td className="px-4 py-2.5">{badge(o.etapa)}</td>
                    <td className={`px-4 py-2.5 text-right ${montoReferencia(o.presupuestoMin, o.presupuestoMax) == null ? 'text-muted' : 'demo-num'}`}>{monto(o)}</td>
                    <td className="px-4 py-2.5 text-muted">{o.fechaDecision ? formatFecha(o.fechaDecision, idioma) : '—'}</td>
                    <td className="demo-num px-4 py-2.5 text-right">{o.cotizaciones}</td>
                    <td className="px-4 py-2.5 text-muted">{o.vendedorNombre ?? t('crm.cotejo.sin-vendedor')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardColapsable>
      )}

      {/* Fuera de la tarjeta (convenciones): plegada, el botón del encabezado
          seguiría abriendo el formulario. */}
      <FormOportunidad abierto={nuevaAbierta} onCerrar={onCerrarNueva} onGuardada={cargar} />
    </>
  )
}
