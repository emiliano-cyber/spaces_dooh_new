'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Plus, FileSignature, Search, X, Download, Trash2, AlertTriangle, Wallet, CalendarClock } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ContratoSheet } from '@/components/demo/arrendadores/ContratoSheet'
import { contratoSeleccionado } from '@/components/demo/arrendadores/seleccion'
import { GestionRazonesSociales } from '@/components/demo/arrendadores/GestionRazonesSociales'
import { PagosRentaCard } from '@/components/demo/arrendadores/PagosRentaCard'
import { ContratoWizard } from '@/components/demo/inventario/ContratoWizard'
import {
  StatusBadge,
  CONTRATO_TONO,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { factorMensual, periodicidadLabel } from '@/lib/renta-periodicidad'
import {
  filtrarArrendadores,
  filtrarContratos,
  filtrarPagos,
  sitiosDeContratos,
  hayFiltro,
  FILTRO_VACIO,
  type FiltroArrendadores,
} from '@/lib/arrendadores-filtro'
import {
  useContratos,
  useArrendadores,
  useSitios,
  usePagosRenta,
  useMargenPorSitio,
  useRazonesSociales,
  usePredios,
  useReservas,
  useCampanas,
  formatMonto,
  formatFecha,
  diasHasta,
  type ContratoArrendamiento,
  type MargenSitio,
} from '@/lib/data/client'
import { registrarPagoRentaApi, crearArrendadorApi, editarArrendadorApi, borrarArrendadorApi, crearRazonSocialApi, DuplicadoError } from '@/lib/data/estado-api'
import { desbloquearApi, esErrorDeDesbloqueo } from '@/lib/data/cambios-api'
import { esRfcValido } from '@/lib/rfc'
import { descargarContratos, ESTATUS_VIGENTES } from '@/lib/contratos-export'
import { ConciliacionCard } from '@/components/demo/arrendadores/ConciliacionCard'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { CLAVE_CONTRATO_ESTATUS } from '@/components/demo/comercial/claves'
import { textoFaltaEnContratos } from '@/components/demo/arrendadores/etiquetas'

export default function ArrendadoresPage() {
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()
  const margenes = useMargenPorSitio()
  const razones = useRazonesSociales()
  const predios = usePredios()
  const reservas = useReservas()
  const campanas = useCampanas()
  const { idioma, t } = useIdioma()

  // Genera el archivo en el navegador (no hay endpoint: los datos ya estan en
  // el store). Si falla —un tenant con miles de contratos agotando memoria— se
  // dice, en vez de dejar un boton que no hace nada.
  function descargarVigentes() {
    try {
      const n = descargarContratos(
        contratos ?? [],
        {
          arrendadores: arrendadores ?? [],
          razones: razones ?? [],
          sitios: sitios ?? [],
          predios: predios ?? [],
        },
        'xlsx',
      )
      setToast(
        n === 0
          ? t('arrendadores.descarga.ninguno')
          : t(n === 1 ? 'arrendadores.descarga.hecha.uno' : 'arrendadores.descarga.hecha.otros', { n }),
      )
    } catch {
      setToast(t('arrendadores.descarga.error'))
    }
  }

  // Solo el ID: la ficha se resuelve contra la lista vigente en cada render
  // (`contratoSeleccionado`). Guardar el objeto dejaba la ficha con una copia
  // vieja tras editar «La paga», ver `components/demo/arrendadores/seleccion.ts`.
  const [selId, setSelId] = useState<string | null>(null)
  const sel = contratoSeleccionado(contratos, selId)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [contratoOpen, setContratoOpen] = useState(false)
  const puedeCrear = usePuede('arrendadores', 'crear')

  // Contratos que facturan a cada razón social. Se calcula aquí y no dentro de
  // la tarjeta para no recorrer los contratos una vez por propietario.
  const contratosPorRazon = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contratos ?? []) {
      if (c.razonSocialId) m.set(c.razonSocialId, (m.get(c.razonSocialId) ?? 0) + 1)
    }
    return m
  }, [contratos])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const nombreArr = (id: string) => arrendadores?.find((a) => a.id === id)?.nombre ?? '—'

  // Filtro ÚNICO del módulo. Las tres listas (arrendadores, contratos y pagos)
  // son la misma realidad vista desde distintos ángulos, y la pregunta habitual
  // es «enséñame todo lo de este arrendador». Con un filtro por tarjeta habría
  // que repetirlo tres veces y era fácil dejar dos desalineadas contando
  // historias distintas.
  const [filtro, setFiltro] = useState<FiltroArrendadores>(FILTRO_VACIO)
  const set = (p: Partial<FiltroArrendadores>) => setFiltro((f) => ({ ...f, ...p }))

  const contratosFiltrados = useMemo(
    () => (contratos ? filtrarContratos(contratos, filtro, nombreArr) : undefined),
    [contratos, filtro, arrendadores],
  )
  // Pantallas cubiertas por los contratos visibles (dos anclajes: predio o
  // pantalla suelta). Lo necesita Rentabilidad, que se lista por pantalla.
  const sitiosVisibles = useMemo(
    () => sitiosDeContratos(contratosFiltrados ?? [], sitios ?? []),
    [contratosFiltrados, sitios],
  )
  const margenesFiltrados = useMemo(
    () => (!margenes || !hayFiltro(filtro) ? margenes : margenes.filter((m) => sitiosVisibles.has(m.sitioId))),
    [margenes, filtro, sitiosVisibles],
  )
  const pagosFiltrados = useMemo(
    () => (pagos ? filtrarPagos(pagos, contratosFiltrados ?? [], filtro) : undefined),
    [pagos, contratosFiltrados, filtro],
  )
  // Depende de los contratos YA filtrados: un arrendador se queda si coincide él
  // o si alguno de sus contratos sobrevivió (ver filtrarArrendadores).
  const arrendadoresFiltrados = useMemo(
    () => (arrendadores ? filtrarArrendadores(arrendadores, filtro, contratosFiltrados ?? []) : undefined),
    [arrendadores, filtro, contratosFiltrados],
  )

  // Las razones sociales siguen a sus arrendadores visibles.
  const razonesFiltradas = useMemo(() => {
    if (!razones || !hayFiltro(filtro)) return razones
    const ids = new Set((arrendadoresFiltrados ?? []).map((a) => a.id))
    return razones.filter((r) => ids.has(r.arrendadorId))
  }, [razones, filtro, arrendadoresFiltrados])

  const sitioDe = (id: string) => sitios?.find((s) => s.id === id)

  // Campañas que tienen vendida esa pantalla. Un contrato incompleto lo creó una
  // venta (ADR 0001), y sin decir CUÁL la fila es irreconocible: se ve el nombre
  // del sitio, no el de la campaña que obliga a capturar el contrato.
  const campanasDelSitio = (sitioId: string) => {
    const ids = new Set(
      (reservas ?? []).filter((r) => r.sitioId === sitioId && r.estatus !== 'CANCELADA').map((r) => r.campanaId),
    )
    return (campanas ?? []).filter((c) => ids.has(c.id))
  }

  const porVencer = (contratos ?? []).filter((c) => c.estatus === 'POR_VENCER').length
  const rentaVencida = (pagos ?? []).filter((p) => p.estatus === 'VENCIDO').length

  // Renta mensual comprometida con los propietarios: suma del equivalente
  // mensual de los contratos activos (un contrato anual de 120 000 cuenta como
  // 10 000/mes). Los INCOMPLETO no suman porque su importe aún se desconoce
  // (ADR 0001) — se cuentan aparte para no dar el total por definitivo.
  const activos = (contratos ?? []).filter(
    (c) => c.estatus === 'VIGENTE' || c.estatus === 'POR_VENCER' || c.estatus === 'RENOVADO',
  )
  const rentaMensual = activos.reduce((s, c) => s + (c.montoMensualEquivalente ?? 0), 0)
  const contratosIncompletos = (contratos ?? []).filter((c) => c.estatus === 'INCOMPLETO')
  const incompletos = contratosIncompletos.length
  const faltaEnIncompletos = textoFaltaEnContratos(contratosIncompletos, t)

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">{t('arrendadores.titulo')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('arrendadores.subtitulo')}</p>
        </div>
        {puedeCrear && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" onClick={() => setNuevoOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {t('arrendadores.nuevo')}
            </Button>
            <Button variant="success" size="sm" onClick={() => setContratoOpen(true)}>
              <FileSignature className="h-3.5 w-3.5" /> {t('arrendadores.nuevo-contrato')}
            </Button>
          </div>
        )}
      </div>

      {/* Filtro compartido: gobierna arrendadores, contratos y pagos a la vez. */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={filtro.texto}
              onChange={(e) => set({ texto: e.target.value })}
              placeholder={t('arrendadores.buscar')}
              className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <select
            value={filtro.arrendadorId}
            onChange={(e) => set({ arrendadorId: e.target.value })}
            className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{t('arrendadores.todos')}</option>
            {(arrendadores ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          <select
            value={filtro.estatus}
            onChange={(e) => set({ estatus: e.target.value })}
            className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{t('arrendadores.contratos-todos')}</option>
            {(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'RENOVADO', 'INCOMPLETO', 'CANCELADO'] as const).map((e) => (
              <option key={e} value={e}>{t(CLAVE_CONTRATO_ESTATUS[e])}</option>
            ))}
          </select>
          {/* Con un filtro puesto, lo que se ve es un subconjunto: sin decirlo,
              un total parcial se lee como el total. */}
          {hayFiltro(filtro) && (
            <>
              <span className="text-[12px] text-muted">
                {t('arrendadores.filtrados', { n: contratosFiltrados?.length ?? 0, total: contratos?.length ?? 0 })}
              </span>
              <button
                type="button"
                onClick={() => setFiltro(FILTRO_VACIO)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> {t('inventario.tabla.limpiar')}
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Resumen — 26/10: `KPICard` en la fila de 4 del Dashboard, en vez de
          la pieza `Mini` en 5 columnas. «Arrendadores» ya no gasta una tarjeta:
          va en la aclaración de «Contratos». Mismas variables, cero cálculo
          nuevo. */}
      <CardColapsable id="arrendadores.indicadores" titulo={t('inventario.indicadores')} contentClassName="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!contratos ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            {/* B4: la salvedad («no incluye N contratos incompletos») estaba solo en
                una nota al pie, así que el número se citaba fuera de contexto como si
                fuera la renta real. Va pegada al propio KPI: quien lo lea de reojo se
                entera igual. */}
            <KPICard
              label={t('arrendadores.comun.renta-mensual')}
              value={formatMonto(rentaMensual, idioma)}
              sub={
                incompletos > 0
                  ? t('arrendadores.kpi.por-capturar', { n: incompletos })
                  : t(activos.length === 1 ? 'arrendadores.kpi.activos.uno' : 'arrendadores.kpi.activos.otros', { n: activos.length })
              }
              tono={incompletos > 0 ? 'ambar' : 'neutro'}
              icon={<Wallet className="h-4 w-4" />}
            />
            <KPICard
              label={t('arrendadores.comun.contratos')}
              value={String(contratos.length)}
              sub={t(arrendadores?.length === 1 ? 'arrendadores.kpi.de-arrendadores.uno' : 'arrendadores.kpi.de-arrendadores.otros', {
                n: arrendadores?.length ?? '—',
              })}
              icon={<FileSignature className="h-4 w-4" />}
            />
            <KPICard
              label={t('arrendadores.kpi.por-vencer')}
              value={String(porVencer)}
              sub={t('arrendadores.kpi.por-vencer.sub')}
              tono={porVencer ? 'ambar' : 'neutro'}
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <KPICard
              label={t('arrendadores.kpi.renta-vencida')}
              value={String(rentaVencida)}
              sub={t('arrendadores.kpi.renta-vencida.sub')}
              tono={rentaVencida ? 'rojo' : 'neutro'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </>
        )}
      </div>
      {incompletos > 0 && (
        // El total de arriba NO es el definitivo mientras haya pendientes: si no
        // se dice, se lee como la renta real y se subestima el costo.
        // 26/10 · en la franja secundaria del Dashboard, dentro de la tarjeta.
        <p className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
          {/* Qué falta se DERIVA de los contratos, no se supone: la mayoría de
              los incompletos llega del alta de la pantalla ya con el importe y
              sin vigencia, y el aviso fijo pedía capturar lo que ya estaba. */}
          {faltaEnIncompletos
            ? t(incompletos === 1 ? 'arrendadores.incompletos.falta.uno' : 'arrendadores.incompletos.falta.otros', {
                n: incompletos,
                falta: faltaEnIncompletos,
              })
            : t(incompletos === 1 ? 'arrendadores.incompletos.uno' : 'arrendadores.incompletos.otros', { n: incompletos })}
        </p>
      )}
      </CardColapsable>

      {/* 26/10 · ORDEN POR USO, como lo ponen los referentes del sector (lo que
          vence y lo que se debe primero, el catálogo después): Contratos →
          Pagos de renta → Cuadre → Rentabilidad → Arrendadores → Razones
          sociales → Por razón social. Solo se movieron bloques: mismas props y
          mismos `id`, así que el plegado que cada persona dejó guardado se
          conserva. */}

      {/* Contratos */}
      <CardColapsable
        id="arrendadores.contratos"
        titulo={t('arrendadores.contratos.titulo')}
        contentClassName="px-0 pb-0"
        accion={
          // Descarga SOLO los vigentes, sin importar el filtro de pantalla: el
          // reporte es «que tengo en curso», y un filtro visual no deberia
          // cambiar lo que significa el archivo. Los INCOMPLETO quedan fuera a
          // proposito (ADR 0001): todavia no son un acuerdo.
          <button
            onClick={descargarVigentes}
            disabled={!contratos}
            className="inline-flex items-center gap-1.5 rounded border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            title={t('arrendadores.contratos.excel-title')}
          >
            <Download className="h-3.5 w-3.5" /> {t('arrendadores.contratos.excel')}
          </button>
        }
      >
          {!contratosFiltrados ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.arrendador')}</th>
                    <th className="px-4 py-2 font-medium">{t('arrendadores.contratos.sitio')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('arrendadores.comun.renta')}</th>
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.cada-cuando')}</th>
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.vence-contrato')}</th>
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.estatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.map((c) => {
                    // Un contrato INCOMPLETO no tiene aún arrendador, importe,
                    // periodicidad ni fecha de fin (ADR 0001): las celdas
                    // muestran «—» en vez de un cero o una fecha inventada.
                    const dias = c.fechaFin ? diasHasta(c.fechaFin) : 0
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSelId(c.id)
                          setOpen(true)
                        }}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5 text-ink">
                          {c.arrendadorId ? nombreArr(c.arrendadorId) : <span className="text-muted">{t('arrendadores.comun.por-definir')}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {sitioDe(c.sitioId)?.nombre ?? '—'}
                          {/* Para un pendiente, la campaña que lo originó es el
                              dato que lo hace reconocible y da la urgencia. */}
                          {c.estatus === 'INCOMPLETO' &&
                            (() => {
                              const cs = campanasDelSitio(c.sitioId)
                              if (!cs.length) return null
                              return (
                                <div className="mt-0.5 text-[11px] text-muted">
                                  {t('arrendadores.contratos.vendida-en', {
                                    lista: cs.map((x) => t('arrendadores.contratos.vendida-item', { nombre: x.nombre })).join(', '),
                                  })}
                                </div>
                              )
                            })()}
                        </td>
                        <td className="demo-num px-4 py-2.5 text-right text-ink">
                          {c.montoRenta != null ? formatMonto(c.montoRenta, idioma) : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted">{periodicidadLabel(c.periodicidad, '—', idioma)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                          {/* 26/10 · fecha y, a su derecha, la pastilla de días que
                              usa el Dashboard. Antes solo POR_VENCER decía cuánto
                              faltaba, como un «(Nd)» pegado. El texto de la
                              pastilla lleva el significado; el color lo refuerza. */}
                          <span className="demo-num">{c.fechaFin ? formatFecha(c.fechaFin, idioma) : '—'}</span>
                          {c.fechaFin && (
                            <span
                              className={cn(
                                'demo-num ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px]',
                                c.estatus === 'VENCIDO'
                                  ? 'border-error bg-error-soft text-error'
                                  : c.estatus === 'POR_VENCER'
                                    ? 'border-warning bg-warning-soft text-[#9a6700]'
                                    : 'border-border text-muted',
                              )}
                            >
                              {dias < 0
                                ? t('comercial.comun.hace.dias', { n: -dias })
                                : dias === 0
                                  ? t('arrendadores.comun.hoy')
                                  : t('arrendadores.comun.en-dias', { n: dias })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge tono={CONTRATO_TONO[c.estatus]}>{t(CLAVE_CONTRATO_ESTATUS[c.estatus])}</StatusBadge>
                            {/* El badge nombra el problema; esto lo resuelve. La
                                fila entera ya abría el detalle, pero eso había
                                que adivinarlo: un contrato podía quedarse meses
                                en «Incompleto» porque nadie sabía dónde se
                                completaba. */}
                            {c.estatus === 'INCOMPLETO' && (
                              <button
                                type="button"
                                className="rounded border border-border px-2 py-0.5 text-[11px] text-info hover:bg-surface-2"
                                onClick={(e) => {
                                  // La fila también abre el sheet; sin esto se
                                  // dispararían los dos manejadores.
                                  e.stopPropagation()
                                  setSelId(c.id)
                                  setOpen(true)
                                }}
                              >
                                {t('arrendadores.comun.completar')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </CardColapsable>

      {/* Pagos de renta (compartido con Finanzas: es a la vez contrato y
          salida de dinero, y no debe divergir entre las dos pantallas) */}
      <PagosRentaCard onToast={notify} contratosVisibles={contratosFiltrados} />

      {/* Cuadre de renta (R3.7): qué se le debe a cada propietario, desglosado
          por emplazamiento. Antes solo se podía saber contrato por contrato. */}
      <ConciliacionCard contratosVisibles={contratosFiltrados} />

      {/* Rentabilidad por pantalla (P&L: ingreso de reservas activas − renta) */}
      <RentabilidadCard margenes={margenesFiltrados} filtrado={hayFiltro(filtro)} />

      {/* Propietarios: lista de arrendadores dados de alta (aparecen aquí aunque
          todavía no tengan contrato) */}
      {/* Contratos SIN filtrar, al contrario que el resto de la pantalla: esta
          tarjeta ya no solo informa, tiene al lado el boton de dar de baja, y
          su cifra responde «¿se puede dar de baja?». Con los filtrados, un
          propietario con contratos vivos podia enseñar 0 y prometer una baja
          que el servidor rechaza. */}
      <PropietariosCard arrendadores={arrendadoresFiltrados} contratos={contratos ?? []} predios={predios} filtrado={hayFiltro(filtro)} onToast={notify} />

      {/* Alta/edición de razones sociales por propietario. Va pegada a la lista
          de propietarios porque es información SUYA; la tarjeta consolidada de
          más abajo es otra cosa: el reporte de lo que se le debe a cada una. */}
      <GestionRazonesSociales
        arrendadores={arrendadoresFiltrados ?? []}
        razones={razonesFiltradas ?? []}
        contratosPorRazon={contratosPorRazon}
        puedeEditar={puedeCrear}
      />

      {/* Consolidado por razón social (un propietario puede tener varias) */}
      <RazonesSocialesCard
        razones={razonesFiltradas ?? []}
        contratos={contratosFiltrados ?? []}
        pagos={pagosFiltrados ?? []}
        nombreArr={nombreArr}
      />

      <ContratoSheet contrato={sel} open={open} onOpenChange={setOpen} onToast={notify} />
      {nuevoOpen && (
        <NuevoPropietarioDialog onClose={() => setNuevoOpen(false)} onToast={notify} />
      )}
      {contratoOpen && (
        <Modal
          open
          onOpenChange={(v) => !v && setContratoOpen(false)}
          size="lg"
          title={t('arrendadores.nuevo-contrato.titulo')}
          subtitle={t('arrendadores.nuevo-contrato.sub')}
        >
          <ContratoWizard
            bare
            onCreado={(s) => {
              notify(t('inventario.toast.contrato-creado', { nombre: s.nombre }))
              setContratoOpen(false)
            }}
          />
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}

// Alta de propietario/arrendador
function NuevoPropietarioDialog({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const inputCls =
    'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
  const { t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [rfc, setRfc] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  // El domicilio NO es un dato de contacto más: el contrato de arrendamiento lo
  // usa dos veces —la declaración de la parte y la cláusula de notificaciones—.
  // No se pedía en ningún formulario, así que el documento salía con dos huecos
  // y el aviso reclamaba un dato que no había dónde teclear.
  const [direccion, setDireccion] = useState('')
  // Datos fiscales: viven en `arrendador_razon_social`, no en el arrendador. Se
  // piden aquí porque es cuando se tienen a la mano; capturarlos después obliga
  // a volver a entrar. Opcionales: el ADR 0001 admite que el contrato nazca
  // pendiente, y exigir el RFC de entrada frenaría altas legítimas.
  const [razonSocial, setRazonSocial] = useState('')
  const [regimen, setRegimen] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Aviso de «ya hay uno que se llama igual» (A5 / INC-07). No bloquea: dos
  // propietarios distintos pueden llamarse igual. Mientras esté puesto, el
  // botón principal pasa a «Crear de todos modos», y se limpia en cuanto se
  // toca el nombre — si lo cambias, el aviso ya no habla de lo que hay escrito.
  const [nombreRepetido, setNombreRepetido] = useState<string | null>(null)

  // El servidor rechaza el RFC mal formado con un 400, pero enterarse después de
  // enviar (y perder el resto del formulario de vista) es peor que verlo al
  // teclear. Misma expresión que usa el servidor: @/lib/rfc.
  const rfcMalo = rfc.trim() !== '' && !esRfcValido(rfc)
  // OBLIG-01: el nombre es el único obligatorio (`crearSchema`,
  // lib/server/arrendadores-controller.ts). Ya no deshabilita el botón: se
  // pulsa, se pinta en rojo y no se manda nada.
  const ob = useObligatorios({ nombre }, ['nombre'])
  // La razón social se guarda aparte, y sin ella el RFC fiscal no tiene dónde ir.
  const puedeGuardar = !rfcMalo && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    if (!ob.validar()) return
    setGuardando(true)
    setError(null)
    try {
      const arr = await crearArrendadorApi({
        nombre: nombre.trim(),
        rfc: rfc.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        // Solo va en `true` si el usuario ya vio el aviso y volvió a pulsar.
        confirmaNombreRepetido: nombreRepetido !== null,
      })
      // La razón social es un segundo registro. Si falla, el arrendador YA se
      // creó: se avisa en vez de tragarse el error, porque quedaría un
      // arrendador sin datos fiscales y nadie sabría que faltó capturarlos.
      if (razonSocial.trim()) {
        try {
          await crearRazonSocialApi({
            arrendadorId: arr.id,
            razonSocial: razonSocial.trim(),
            // El RFC del arrendador y el de su razón social son el mismo dato
            // fiscal cuando solo hay una: se copia para no pedirlo dos veces.
            rfc: rfc.trim() || null,
            regimen: regimen.trim() || null,
          })
        } catch (e) {
          onToast(
            t('arrendadores.alta.razon-fallo', {
              error: e instanceof Error ? e.message : t('arrendadores.alta.error-desconocido'),
            }),
          )
          onClose()
          return
        }
      }
      onToast(t('arrendadores.alta.agregado'))
      onClose()
    } catch (e) {
      // Nombre repetido: NO es un error, es una pregunta. Se pinta como aviso y
      // el botón se convierte en «Crear de todos modos». El RFC repetido sí es
      // un error y cae por la rama de abajo: un RFC es de un solo arrendador y
      // no hay confirmación que valga.
      if (e instanceof DuplicadoError && e.motivo === 'nombre') {
        setNombreRepetido(e.message)
      } else {
        setError(e instanceof Error ? e.message : t('comercial.comun.no-se-pudo-guardar'))
      }
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('arrendadores.nuevo')}
      subtitle={t('arrendadores.alta.sub')}
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
            <Button size="sm" disabled={!puedeGuardar} onClick={guardar}>
              {guardando ? t('comercial.comun.guardando') : nombreRepetido ? t('arrendadores.alta.crear-igual') : t('comun.guardar')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('inventario.wizard.nombre-razon')} obligatorio falta={ob.falta('nombre')}>
          <input
            className={cn(inputCls, nombreRepetido && 'border-accent')}
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setNombreRepetido(null) }}
            autoFocus
          />
        </Campo>
        {nombreRepetido && (
          <div className="flex items-start gap-2 rounded border border-warning bg-warning-soft px-3 py-2 text-[12px] text-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9a6700]" strokeWidth={2} />
            <span>
              {nombreRepetido}
              {' '}
              <span className="text-muted">
                {t('arrendadores.alta.repetido')}
              </span>
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            label={t('inventario.wizard.rfc')}
            error={
              rfcMalo
                ? t('arrendadores.alta.rfc-malo')
                : null
            }
          >
            <input
              className={cn(inputCls, rfcMalo && 'border-error focus-visible:ring-error')}
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
              aria-invalid={rfcMalo}
            />
          </Campo>
          <Campo label={t('inventario.wizard.telefono')}>
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
        </div>
        <Campo label={t('inventario.wizard.correo')}>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@arrendador.com" />
        </Campo>
        <Campo label={t('arrendadores.comun.domicilio')}>
          <input
            className={inputCls}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder={t('arrendadores.alta.domicilio-ph')}
          />
          {/* Se dice para qué sirve: es un campo que se deja en blanco por
              parecer opcional y luego bloquea el envío del contrato a firma. */}
          <span className="mt-1 block text-[11px] text-muted">
            {t('arrendadores.alta.domicilio-ayuda')}
          </span>
        </Campo>

        {/* Datos fiscales — opcionales. Van a `arrendador_razon_social`, que es
            quien factura la renta; un arrendador puede tener varias. */}
        <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3">
          <div>
            <div className="text-[12px] font-medium text-ink">{t('arrendadores.alta.fiscales')}</div>
            <div className="text-[11px] text-muted">
              {t('arrendadores.alta.fiscales-ayuda')}
            </div>
          </div>
          <Campo label={t('arrendadores.comun.razon-social')}>
            <input
              className={inputCls}
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Inmobiliaria Ejemplo SA de CV"
            />
          </Campo>
          <Campo label={t('arrendadores.comun.regimen')}>
            <input
              className={inputCls}
              value={regimen}
              onChange={(e) => setRegimen(e.target.value)}
              placeholder="601 — General de Ley Personas Morales"
              disabled={!razonSocial.trim()}
            />
            {!razonSocial.trim() && regimen.trim() === '' && (
              <span className="mt-1 block text-[11px] text-muted">
                {t('arrendadores.alta.regimen-ayuda')}
              </span>
            )}
          </Campo>
        </div>
      </div>
    </Modal>
  )
}

// Consolidado por razón social: un propietario puede facturar bajo varias
// razones sociales (varias gasolineras/inmuebles). Agrupa sus contratos, predios,
// renta mensual y pagos vencidos.
function RazonesSocialesCard({
  razones, contratos, pagos, nombreArr,
}: {
  razones: { id: string; razonSocial: string; rfc: string | null; arrendadorId: string }[]
  contratos: ContratoArrendamiento[]
  pagos: { contratoId: string; estatus: string }[]
  nombreArr: (id: string) => string
}) {
  const { idioma, t } = useIdioma()
  const esActivo = (e: string) => e === 'VIGENTE' || e === 'POR_VENCER' || e === 'RENOVADO'
  // Un contrato INCOMPLETO aporta 0 al consolidado: su importe aún se desconoce
  // y `esActivo` ya lo excluye, pero el nulo tiene que ser seguro igualmente.
  const aMensual = (monto: number | null, per: string | null) =>
    monto == null ? 0 : monto * factorMensual(per)
  const filaDe = (id: string | null, nombre: string, rfc: string | null, arrId: string | null) => {
    const cs = contratos.filter((c) => (c.razonSocialId ?? null) === id)
    const activos = cs.filter((c) => esActivo(c.estatus))
    const predios = new Set(cs.map((c) => c.predioId).filter(Boolean)).size
    const rentaMensual = activos.reduce((s, c) => s + aMensual(c.montoRenta, c.periodicidad), 0)
    const cids = new Set(cs.map((c) => c.id))
    const vencidos = pagos.filter((p) => cids.has(p.contratoId) && p.estatus === 'VENCIDO').length
    return { id: id ?? 'sin', nombre, rfc, arr: arrId ? nombreArr(arrId) : '—', total: cs.length, activos: activos.length, predios, rentaMensual, vencidos }
  }
  const filas = razones.map((rs) => filaDe(rs.id, rs.razonSocial, rs.rfc, rs.arrendadorId))
  const sinRs = filaDe(null, t('arrendadores.comun.sin-razon'), null, null)
  const todas = sinRs.total > 0 ? [...filas, sinRs] : filas
  // 26/10 · sin datos la tarjeta ya no desaparece: una sección que se esfuma no
  // dice si está vacía o si no cargó. Se queda, con una línea que lo dice.
  return (
    <CardColapsable id="arrendadores.por-razon-social" titulo={t('arrendadores.por-razon.titulo')} contentClassName="px-0 pb-0">
        {todas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">{t('arrendadores.por-razon.vacio')}</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">{t('arrendadores.comun.razon-social')}</th>
                <th className="px-4 py-2 font-medium">{t('arrendadores.comun.arrendador')}</th>
                <th className="px-4 py-2 text-center font-medium">{t('arrendadores.comun.contratos')}</th>
                <th className="px-4 py-2 text-center font-medium">{t('arrendadores.comun.predios')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('arrendadores.comun.renta-mensual')}</th>
                <th className="px-4 py-2 text-center font-medium">{t('arrendadores.por-razon.pagos-vencidos')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{f.nombre}</div>
                    {f.rfc && <div className="demo-num text-[11px] text-muted">{f.rfc}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{f.arr}</td>
                  <td className="px-4 py-2.5 text-center text-muted">
                    <span className="text-ink">{f.activos}</span> / {f.total}
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted">{f.predios}</td>
                  <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(Math.round(f.rentaMensual), idioma)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {f.vencidos > 0 ? (
                      <StatusBadge tono="rojo">{f.vencidos}</StatusBadge>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
    </CardColapsable>
  )
}

// P&L por pantalla: ingreso mensual de reservas activas − renta del arrendador.
function RentabilidadCard({
  margenes,
  filtrado,
}: {
  margenes: MargenSitio[] | undefined
  // Con filtro activo, una lista vacía significa «ninguna coincide», no
  // «no hay pantallas»: son mensajes distintos y confundirlos desorienta.
  filtrado?: boolean
}) {
  const { idioma, t } = useIdioma()
  // Solo pantallas con contrato o con ingreso activo; peores márgenes primero.
  const filas = (margenes ?? [])
    .filter((m) => m.tieneContrato || m.activo)
    .sort((a, b) => a.margenMensual - b.margenMensual)
  const totalIngreso = filas.reduce((s, m) => s + m.ingresoMensual, 0)
  const totalRenta = filas.reduce((s, m) => s + m.rentaMensual, 0)
  const totalMargen = totalIngreso - totalRenta
  return (
    <CardColapsable
      id="arrendadores.rentabilidad"
      titulo={t('arrendadores.rentabilidad.titulo')}
      subtitulo={t('arrendadores.rentabilidad.sub')}
      contentClassName="px-0 pb-0"
    >
        {!margenes ? (
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />)}
          </div>
        ) : filas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">
            {filtrado
              ? t('arrendadores.rentabilidad.sin-filtro')
              : t('arrendadores.rentabilidad.vacio')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* 26/10 · mismo cuerpo (13 px) y misma cabecera en versalitas que
                las demás tablas del módulo. */}
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.pantalla')}</th>
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.arrendador')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('arrendadores.rentabilidad.ingreso')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('arrendadores.rentabilidad.renta')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('arrendadores.rentabilidad.margen')}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.sitioId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink">{m.nombre}</div>
                      {!m.tieneContrato && <span className="text-[10px] text-muted">{t('arrendadores.rentabilidad.sin-contrato')}</span>}
                    </td>
                    <td className="px-4 py-2 text-muted">{m.arrendador ?? '—'}</td>
                    <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(m.ingresoMensual, idioma)}</td>
                    <td className="demo-num px-4 py-2 text-right text-muted">{m.rentaMensual ? formatMonto(m.rentaMensual, idioma) : '—'}</td>
                    <td className={cn('demo-num px-4 py-2 text-right font-semibold', m.margenMensual < 0 ? 'text-error' : m.margenMensual > 0 ? 'text-[#0f7a55]' : 'text-muted')}>
                      {formatMonto(m.margenMensual, idioma)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2/40 font-medium">
                  <td className="px-4 py-2 text-ink" colSpan={2}>{t('campanas.comun.total')}</td>
                  <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(totalIngreso, idioma)}</td>
                  <td className="demo-num px-4 py-2 text-right text-muted">{formatMonto(totalRenta, idioma)}</td>
                  <td className={cn('demo-num px-4 py-2 text-right', totalMargen < 0 ? 'text-error' : 'text-[#0f7a55]')}>{formatMonto(totalMargen, idioma)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </CardColapsable>
  )
}

// Lista de propietarios (arrendadores) dados de alta. Se muestran aquí aunque
// aún no tengan contrato — así un alta reciente es visible de inmediato.
// Input compacto de la edición en línea. Se nombra porque se repite en dos
// celdas y las clases sueltas se desincronizan al primer retoque.
const inputMini =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function PropietariosCard({
  arrendadores,
  contratos,
  predios,
  filtrado,
  onToast,
}: {
  arrendadores: ReturnType<typeof useArrendadores>
  contratos: ContratoArrendamiento[]
  predios: ReturnType<typeof usePredios>
  // Hay un filtro activo: cambia lo que significa una lista vacía.
  filtrado: boolean
  onToast: (m: string) => void
}) {
  // Edición en la propia fila. Antes NO había forma de editar un arrendador ya
  // dado de alta: el endpoint existía (PATCH) pero ninguna pantalla lo usaba, y
  // el domicilio —que el contrato exige— solo podía ponerse al crearlo. Los
  // arrendadores anteriores se quedaban sin manera de completarlo.
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState({ rfc: '', direccion: '' })
  const [guardando, setGuardando] = useState(false)
  const puedeCrear = usePuede('arrendadores', 'crear')
  // Dar de baja pide MÁS que editar, y a propósito: desde la aplicación no hay
  // vuelta atrás. El servidor exige `arrendadores:aprobar` y además la
  // contraseña (`arrendadores/[id]/route.ts:66-72`); aquí solo se le esconde el
  // botón a quien de todas formas recibiría un 403.
  const puedeBorrar = usePuede('arrendadores', 'aprobar')
  const [baja, setBaja] = useState<{ id: string; nombre: string } | null>(null)
  const { t } = useIdioma()

  function abrir(a: { id: string; rfc: string | null; direccion: string | null }) {
    setEditando(a.id)
    setBorrador({ rfc: a.rfc ?? '', direccion: a.direccion ?? '' })
  }

  async function guardar(id: string) {
    if (borrador.rfc.trim() && !esRfcValido(borrador.rfc)) {
      onToast(t('arrendadores.lista.rfc-malo'))
      return
    }
    setGuardando(true)
    try {
      await editarArrendadorApi(id, {
        rfc: borrador.rfc.trim() || null,
        direccion: borrador.direccion.trim() || null,
      })
      onToast(t('arrendadores.lista.actualizado'))
      setEditando(null)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t('comercial.comun.no-se-pudo-guardar'))
    }
    setGuardando(false)
  }

  return (
    <>
      <CardColapsable
        id="arrendadores.lista"
        titulo={t('arrendadores.titulo')}
        subtitulo={t('arrendadores.lista.sub')}
        contentClassName="px-0 pb-0"
      >
          {!arrendadores ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : arrendadores.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">
              {/* Distinguir «no hay ninguno» de «ninguno coincide» importa: el
                  primer mensaje, mostrado con un filtro puesto, afirma algo falso
                  y manda a dar de alta un arrendador que ya existe. */}
              {filtrado
                ? t('arrendadores.lista.sin-filtro')
                : interpolarNodos(t('arrendadores.lista.vacio'), { boton: <b>{t('arrendadores.lista.vacio-boton')}</b> })}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.arrendador')}</th>
                    <th className="px-4 py-2 font-medium">{t('inventario.wizard.rfc')}</th>
                    {/* El domicilio se enseña porque el CONTRATO lo exige: si no
                        se ve, nadie sabe que falta hasta que el documento sale
                        con el hueco en blanco. */}
                    <th className="px-4 py-2 font-medium">{t('arrendadores.comun.domicilio')}</th>
                    <th className="px-4 py-2 font-medium">{t('arrendadores.lista.contacto')}</th>
                    <th className="px-4 py-2 text-center font-medium">{t('arrendadores.comun.contratos')}</th>
                    <th className="px-4 py-2 text-center font-medium">{t('arrendadores.comun.predios')}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {arrendadores.map((a) => {
                    // Las dos cifras que el servidor mira antes de dejar dar de
                    // baja: predios y contratos ACTIVOS
                    // (`arrendadores-repo.ts:1084-1095`). Enseñar el total a secas
                    // mentia en las DOS direcciones: un «3» de contratos vencidos
                    // se lee como bloqueado y se da de baja sin problema, y un «0»
                    // con un predio detras promete una baja que acaba en 409.
                    // `ESTATUS_VIGENTES` se importa y no se copia: ese conjunto ya
                    // vive en cinco sitios del repo, y asi es como una copia se
                    // queda atras el dia que cambie.
                    const suyos = contratos.filter((c) => c.arrendadorId === a.id)
                    const activos = suyos.filter((c) => (ESTATUS_VIGENTES as readonly string[]).includes(c.estatus)).length
                    const nPredios = (predios ?? []).filter((p) => p.arrendadorId === a.id).length
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-ink">{a.nombre}</td>
                        <td className="demo-num px-4 py-2.5 text-muted">
                          {editando === a.id ? (
                            <input
                              className={inputMini + ' w-36'}
                              value={borrador.rfc}
                              onChange={(e) => setBorrador((b) => ({ ...b, rfc: e.target.value.toUpperCase() }))}
                              placeholder="XAXX010101000"
                            />
                          ) : (
                            a.rfc || <StatusBadge tono="ambar">{t('arrendadores.lista.falta')}</StatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {editando === a.id ? (
                            <input
                              className={inputMini + ' w-full min-w-[220px]'}
                              value={borrador.direccion}
                              onChange={(e) => setBorrador((b) => ({ ...b, direccion: e.target.value }))}
                              placeholder={t('arrendadores.lista.domicilio-ph')}
                              autoFocus
                            />
                          ) : (
                            a.direccion || <StatusBadge tono="ambar">{t('arrendadores.lista.falta')}</StatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {a.email || a.telefono ? (
                            <span>{a.email ?? ''}{a.email && a.telefono ? ' · ' : ''}{a.telefono ?? ''}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td
                          className="demo-num px-4 py-2.5 text-center text-muted"
                          title={t('arrendadores.lista.activos-title', { activos, total: suyos.length })}
                        >
                          <span className="text-ink">{activos}</span> / {suyos.length}
                        </td>
                        <td
                          className="demo-num px-4 py-2.5 text-center text-muted"
                          title={t('arrendadores.lista.predios-title')}
                        >
                          {nPredios}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {puedeCrear &&
                              (editando === a.id ? (
                                <>
                                  <Button size="sm" onClick={() => guardar(a.id)}>
                                    {guardando ? t('comercial.comun.guardando') : t('comun.guardar')}
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>
                                    {t('comun.cancelar')}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={!a.rfc || !a.direccion ? 'primary' : 'secondary'}
                                  onClick={() => abrir(a)}
                                >
                                  {!a.rfc || !a.direccion ? t('arrendadores.comun.completar') : t('comercial.comun.editar')}
                                </Button>
                              ))}
                            {/* Fuera del `puedeCrear` a propósito: son dos permisos
                                distintos, y colgar la baja del de editar se la
                                escondería a quien sí puede aprobarla. Y se retira
                                mientras esa fila se edita: pulsarlo ahí tiraría lo
                                tecleado sin avisar. */}
                            {puedeBorrar && editando !== a.id && (
                              <button
                                type="button"
                                onClick={() => setBaja({ id: a.id, nombre: a.nombre })}
                                aria-label={t('arrendadores.baja.aria', { nombre: a.nombre })}
                                title={t('arrendadores.baja.boton')}
                                className="inline-flex items-center gap-1 rounded border border-border-strong px-2 py-1 text-[12px] text-muted hover:border-error hover:text-error"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </CardColapsable>
      {baja && (
        <BajaPropietarioDialog
          arrendador={baja}
          onClose={() => setBaja(null)}
          onToast={onToast}
        />
      )}
    </>
  )
}

// ─── Dar de baja a un propietario ────────────────────────────────────────────
//  Hasta el 2026-08-27 esta pantalla no tenía forma de dar de baja a nadie: el
//  endpoint existía desde antes y se endureció el 26/08 (`ba6fb09`), pero NINGUNA
//  pantalla lo llamaba — no había un solo `DELETE` contra `/arrendadores/` en
//  todo `apps/web`. Esto es la mitad que faltaba.
//
//  ─── Por qué NO dice «no se puede deshacer» y sí dice lo que dice ──────────
//  En la base es un soft-delete: la fila sobrevive con `activo=false` y se lleva
//  su historial entero. Decir «se borrará para siempre» sería falso. Pero el
//  listado esconde a los inactivos y el PATCH no acepta `activo`, así que desde
//  la aplicación NO HAY manera de traerlo de vuelta. Lo honesto es exactamente
//  eso: en la base queda, en la pantalla no vuelve, y para revivirlo hace falta
//  alguien con acceso a la base.
//
//  ─── Los dos caminos del servidor ─────────────────────────────────────────
//   · 403 pidiendo la contraseña → NO es un error, es un paso, y se pide aquí
//     mismo. Igual que al borrar un cliente.
//   · 409 → tiene predios o contratos activos. El mensaje del servidor ya trae
//     las dos cifras, así que se enseña tal cual y no se ofrece ningún botón
//     que insista: no hay forma de insistir. Se sale cancelando.
function BajaPropietarioDialog({
  arrendador,
  onClose,
  onToast,
}: {
  arrendador: { id: string; nombre: string }
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [reautenticando, setReautenticando] = useState(false)
  const [pass, setPass] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { t } = useIdioma()

  async function darDeBaja() {
    setError(null)
    setEnviando(true)
    try {
      if (reautenticando) {
        if (!pass) {
          setError(t('compartidos.candado.falta'))
          setEnviando(false)
          return
        }
        // El orden importa: si la contraseña es la equivocada, `desbloquearApi`
        // lanza ANTES de bajar el estado, así que se sigue en el paso de la
        // contraseña con el error puesto, y no de vuelta a la primera pantalla.
        await desbloquearApi(pass)
        setPass('')
        setReautenticando(false)
      }
      await borrarArrendadorApi(arrendador.id)
      onToast(t('arrendadores.baja.hecha'))
      onClose()
      return
    } catch (e) {
      if (esErrorDeDesbloqueo(e)) setReautenticando(true)
      else setError(e instanceof Error ? e.message : t('arrendadores.baja.error'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('arrendadores.baja.aria', { nombre: arrendador.nombre })}
      subtitle={t('arrendadores.baja.sub')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('comun.cancelar')}
          </Button>
          <Button variant="danger"
            size="sm"
            disabled={enviando || (reautenticando && !pass)}
            onClick={darDeBaja}
          >
            {enviando ? t('arrendadores.baja.dando') : reautenticando ? t('arrendadores.baja.confirmar') : t('arrendadores.baja.boton')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        {reautenticando ? (
          <>
            <p className="text-muted">
              {t('arrendadores.baja.pide-clave')}
            </p>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">{t('arrendadores.baja.tu-clave')}</span>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !enviando && pass && darDeBaja()}
                className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          </>
        ) : (
          <>
            <p className="text-muted">
              {interpolarNodos(t('arrendadores.baja.dejara'), { nombre: <span className="text-ink">{arrendador.nombre}</span> })}
            </p>
            {/* Se dice ANTES de pulsar, no después: sus contratos y pagos
                anteriores no se van a ningún lado, y creer lo contrario es lo
                que hace que nadie se atreva a usar el botón. */}
            <p className="text-muted">
              {t('arrendadores.baja.conserva')}
            </p>
          </>
        )}

        {error && (
          <p className="rounded border border-error/40 bg-error/10 px-3 py-2 text-error">{error}</p>
        )}
      </div>
    </Modal>
  )
}
