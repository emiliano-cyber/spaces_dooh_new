'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Target, Trophy, Wallet } from 'lucide-react'
import { cn } from '@/lib/cn'
import { conteo } from '@/lib/plural'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/client'
import { withTrail } from '@/lib/nav-trail'
import type { Crumb } from '@/components/demo/ui/Breadcrumbs'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { oportunidadesApi, type Oportunidad, type PaginaOportunidades } from '@/lib/data/oportunidades-api'
import {
  ETAPAS_ABIERTAS,
  agruparEmbudo,
  diasNegociando,
  etapaOportunidadCerrada,
  montoReferencia,
  type EtapaOportunidad,
} from '@/lib/crm'
import { FormOportunidad } from './FormOportunidad'
import { COLOR_ETAPA, claveEtapa } from './etiquetas'

// ============================================================================
//  Seguimiento — las oportunidades en columnas por etapa (tipo Kanban).
//  ADR 0051 §7; rehecho el 18/11 (segundo pedido del dueño del día).
// ----------------------------------------------------------------------------
//  Hasta el 18/11 por la tarde había dos pestañas, «Embudo» y «Oportunidades»,
//  que enseñaban lo mismo de dos formas. El dueño: quitar Oportunidades por ser
//  casi igual, y que el embudo se llame «Seguimiento» y se vea por columnas.
//  Para que no se pierda nada de la pestaña quitada, su búsqueda y el filtro de
//  vendedor viven aquí arriba.
//
//  Lee `GET /api/oportunidades` y el servidor ya filtra por vendedor (quien no
//  tiene `comercial.aprobar` solo recibe las suyas): aquí no se decide quién ve
//  qué. El filtro de vendedor es solo una comodidad de pantalla, y por eso solo
//  sale cuando `veTodas`.
//
//  Las tarjetas NO mueven de etapa. El embudo traía un <select> en cada
//  tarjeta; aquí la tarjeta entera es el enlace a la ficha (un control dentro
//  de un enlace no se puede pulsar bien en un celular), y la ficha ya tiene
//  «Mover a otra etapa», que además es el único sitio que pide el motivo de
//  una perdida. Arrastrar entre columnas no se pidió.
//
//  «Perdida» va plegada por omisión: es la columna que más crece y la que menos
//  se trabaja. Un chip la enseña como sexta columna.
//
//  En celular las columnas tienen ancho fijo y se desplazan en horizontal
//  DENTRO de su contenedor (`overflow-x-auto`); la página no se ensancha. En
//  pantalla ancha (xl) caben todas en una rejilla sin desplazamiento.
// ============================================================================

const ETAPAS_VISIBLES: EtapaOportunidad[] = ['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA']

// El rastro dice «Propuestas › Seguimiento»: la ficha vive en /crm/… por
// dentro, pero quien la abre llegó desde Propuestas y ahí vuelve.
const RUTA = '/propuestas?vista=seguimiento'

const sumaMontos = (ops: Oportunidad[]) =>
  ops.reduce((s, o) => s + (montoReferencia(o.presupuestoMin, o.presupuestoMax) ?? 0), 0)

// Sin acentos ni mayúsculas: «Jose» encuentra a «José».
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Seguimiento({
  inicial = null,
  nuevaAbierta = false,
  onCerrarNueva = () => {},
  ahora,
}: {
  /** Solo para pruebas: lo que se pinta antes de que llegue la API. */
  inicial?: PaginaOportunidades | null
  /** El formulario de alta, que se abre desde el encabezado de la página. */
  nuevaAbierta?: boolean
  onCerrarNueva?: () => void
  /** Solo para pruebas: la fecha contra la que se cuentan los días. */
  ahora?: Date
}) {
  const { t, idioma, dinero } = useIdioma()
  const [pagina, setPagina] = useState<PaginaOportunidades | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [verPerdidas, setVerPerdidas] = useState(false)

  const cargar = useCallback(() => {
    oportunidadesApi({ porPagina: 100 })
      .then((p) => { setPagina(p); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(cargar, [cargar])

  const ops = useMemo(() => pagina?.oportunidades ?? [], [pagina])
  const cliente = (o: Oportunidad) => o.clienteNombre ?? o.prospectoNombre ?? '—'

  // Los vendedores que aparecen en lo que llegó, para el filtro.
  const vendedores = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of ops) if (o.usuarioId) m.set(o.usuarioId, o.vendedorNombre ?? t('crm.cotejo.sin-vendedor'))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [ops, t])

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return ops.filter(
      (o) =>
        (!vendedor || o.usuarioId === vendedor) &&
        (!q || normalizar(`${o.clienteNombre ?? ''} ${o.prospectoNombre ?? ''} ${o.nombre}`).includes(q)),
    )
  }, [ops, busqueda, vendedor])
  const columnas = useMemo(() => {
    const etapas = verPerdidas ? [...ETAPAS_VISIBLES, 'PERDIDA' as const] : ETAPAS_VISIBLES
    return agruparEmbudo(filtradas).filter((c) => etapas.includes(c.etapa))
  }, [filtradas, verPerdidas])

  const rastro: Crumb[] = [
    { label: t('propuestas.lista.titulo'), href: '/propuestas' },
    { label: t('crm.pestana.seguimiento'), href: RUTA },
  ]

  // Las cifras de arriba son de TODO lo que se ve (no cambian al filtrar): los
  // conteos salen de `porEtapa`, que el servidor cuenta sobre todas; los
  // montos, de las que llegaron (las primeras 100), que es lo que hay.
  const cuenta = (e: EtapaOportunidad) => pagina?.porEtapa[e] ?? 0
  const abiertas = ETAPAS_ABIERTAS.reduce((s, e) => s + cuenta(e), 0)
  const enJuego = sumaMontos(ops.filter((o) => !etapaOportunidadCerrada(o.etapa)))
  const ganado = sumaMontos(ops.filter((o) => o.etapa === 'GANADA'))
  const cotizaciones = ops.reduce((s, o) => s + o.cotizaciones, 0)

  // El rango que dijo el cliente: «$100,000.00 – $200,000.00», o el extremo
  // que haya, o «Sin presupuesto».
  const rango = (o: Oportunidad) => {
    const { presupuestoMin: min, presupuestoMax: max } = o
    if (min == null && max == null) return null
    if (min != null && max != null && min !== max) return `${dinero(min)} – ${dinero(max)}`
    return dinero((max ?? min) as number)
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

      {pagina && ops.length > 0 && (
        <CardColapsable
          id="propuestas.seguimiento"
          titulo={t('crm.pestana.seguimiento')}
          resumen={
            <span className="text-[12px] text-muted">
              {t('crm.lista.resumen', { n: filtradas.length, total: pagina.total })}
              {pagina.veTodas ? '' : ` · ${t('crm.solo-tuyas')}`}
            </span>
          }
        >
          {/* Filtros en una fila, como en la lista de propuestas: el chip de
              perdidas a la izquierda; vendedor y búsqueda a la derecha. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={verPerdidas}
              onClick={() => setVerPerdidas((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors',
                verPerdidas ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-surface text-muted hover:text-ink',
              )}
            >
              {t('crm.seguimiento.perdidas')} <span className="demo-num">{cuenta('PERDIDA')}</span>
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {pagina.veTodas && vendedores.length > 0 && (
                <select
                  aria-label={t('crm.col.vendedor')}
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">{t('crm.seguimiento.vendedores')}</option>
                  {vendedores.map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              )}
              <input
                type="search"
                aria-label={t('crm.seguimiento.buscar')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t('crm.seguimiento.buscar')}
                className="h-8 w-56 max-w-full rounded border border-border-strong bg-surface px-2.5 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          {filtradas.length === 0 && (
            <p className="mb-3 text-[13px] text-muted">{t('crm.seguimiento.sin-resultados')}</p>
          )}

          {/* Las columnas. El desplazamiento horizontal vive aquí y no en la
              página: `min-w-0` en el contenedor y ancho fijo por columna. */}
          <div className="min-w-0 overflow-x-auto pb-1">
            <div
              className={cn(
                'flex items-start gap-3 xl:grid',
                verPerdidas ? 'xl:grid-cols-6' : 'xl:grid-cols-5',
              )}
            >
              {columnas.map((c) => (
                <section
                  key={c.etapa}
                  aria-label={t(claveEtapa(c.etapa))}
                  className="w-64 shrink-0 rounded-md border border-border bg-surface-2 p-2 xl:w-auto xl:min-w-0"
                >
                  <header className="mb-2 px-1">
                    <div className="flex items-center justify-between gap-2">
                      {badge(c.etapa)}
                      <span className="demo-num text-[12px] font-medium text-ink">{c.oportunidades.length}</span>
                    </div>
                    <p className="demo-num mt-1 text-[11px] text-muted">{t('crm.embudo.total', { monto: dinero(c.total) })}</p>
                  </header>
                  {/* `list-none` explícito: el proyecto no usa el preflight de Tailwind. */}
                  <ul className="m-0 list-none space-y-2 p-0">
                    {c.oportunidades.length === 0 && (
                      <li className="px-1 py-2 text-[12px] text-muted">{t('crm.embudo.vacio-columna')}</li>
                    )}
                    {c.oportunidades.map((o) => {
                      const r = rango(o)
                      const dias = diasNegociando(o, ahora)
                      return (
                        <li key={o.id}>
                          <Link
                            href={withTrail(`/crm/oportunidades/${o.id}`, rastro)}
                            className="block rounded-md border border-border bg-surface p-2.5 text-[12px] no-underline transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <p className="truncate text-[13px] font-medium text-ink" title={cliente(o)}>{cliente(o)}</p>
                            <p className="truncate text-muted" title={o.nombre}>{o.nombre}</p>
                            <p className={cn('mt-1', r == null ? 'text-muted' : 'demo-num font-medium text-ink')}>
                              {r ?? t('crm.sin-presupuesto')}
                            </p>
                            <p className="mt-1 text-muted">
                              <span className="demo-num">{conteo(o.cotizaciones, t('crm.unidad.cotizacion'), t('crm.unidad.cotizaciones'))}</span>
                              {' · '}
                              <span className="demo-num">
                                {t('crm.seguimiento.dias', { dias: conteo(dias, t('crm.unidad.dia'), t('crm.unidad.dias')) })}
                              </span>
                            </p>
                            {o.fechaDecision && !etapaOportunidadCerrada(o.etapa) && (
                              <p className="text-muted">{t('crm.decide', { fecha: formatFecha(o.fechaDecision, idioma) })}</p>
                            )}
                            <p className="mt-1 truncate border-t border-border pt-1 text-muted">
                              {o.vendedorNombre ?? t('crm.cotejo.sin-vendedor')}
                            </p>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </CardColapsable>
      )}

      {/* Fuera de la tarjeta (convenciones): plegada, el botón del encabezado
          seguiría abriendo el formulario. */}
      <FormOportunidad abierto={nuevaAbierta} onCerrar={onCerrarNueva} onGuardada={cargar} />
    </>
  )
}
