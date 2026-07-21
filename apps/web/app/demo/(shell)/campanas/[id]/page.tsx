'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Camera, Printer, ClipboardList, Cpu, MonitorPlay } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Breadcrumbs, type Crumb } from '@/components/demo/ui/Breadcrumbs'
import { withTrail, trailFromLocation } from '@/lib/nav-trail'
import { PipelineView } from '@/components/demo/campanas/PipelineView'
import { CampanasNav } from '@/components/demo/campanas/CampanasNav'
import { CandadoPanel } from '@/components/demo/campanas/CandadoPanel'
import { DatosFacturacion } from '@/components/demo/campanas/DatosFacturacion'
import { ValidacionPanel } from '@/components/demo/campanas/ValidacionPanel'
import { EvidenciaGaleria } from '@/components/demo/campanas/EvidenciaGaleria'
import { PlaylogsPanel } from '@/components/demo/campanas/PlaylogsPanel'
import { AgregarCreativo } from '@/components/demo/campanas/AgregarCreativo'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
  RESERVA_TONO,
  RESERVA_LABEL,
  CREATIVIDAD_TONO,
  CREATIVIDAD_LABEL,
  IMPRESION_TONO,
  IMPRESION_LABEL,
  OT_TONO,
  OT_LABEL,
} from '@/components/demo/StatusBadge'
import {
  useCampana,
  useReservas,
  useSitios,
  useCreatividades,
  useOrdenesImpresion,
  useOrdenesTrabajo,
  useEvidencias,
  useMargenCampana,
  useOrdenesCompra,
  useReporteCampana,
  formatMonto,
  formatFecha,
} from '@/lib/data/client'

export default function CampanaDetallePage({ params }: { params: { id: string } }) {
  const id = params.id
  const c = useCampana(id)
  const reservas = useReservas()
  const sitios = useSitios()
  const creatividades = useCreatividades()
  const ois = useOrdenesImpresion()
  const ots = useOrdenesTrabajo()
  const evidencias = useEvidencias()
  const margen = useMargenCampana(id)
  const ordenesCompra = useOrdenesCompra()
  const reporte = useReporteCampana(id)

  // Rastro de cómo se llegó a esta campaña (param `from`); por defecto, Campañas.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const t = trailFromLocation()
    setTrail(t.length ? t : [{ label: 'Campañas', href: '/demo/campanas' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Campañas', href: '/demo/campanas' }
  // Rastro a propagar hacia las OT de esta campaña (incluye la campaña actual).
  const trailHaciaOT: Crumb[] = [...trail, { label: c && 'nombre' in c ? c.nombre : 'Campaña', href: `/demo/campanas/${id}` }]

  if (c === undefined) {
    return <div className="w-full h-64 animate-pulse rounded-md bg-surface-2" />
  }
  if (c === null) {
    return (
      <div className="w-full">
        <p className="text-[13px] text-muted">Campaña no encontrada.</p>
        <Link href="/demo/campanas" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a campañas
        </Link>
      </div>
    )
  }

  const misReservas = (reservas ?? []).filter((r) => r.campanaId === id)
  const misSitios = misReservas
    .map((r) => ({ reserva: r, sitio: (sitios ?? []).find((s) => s.id === r.sitioId) }))
    .filter((x) => x.sitio)
  // Pantallas de la campaña con IA / Computer Vision (AdMobilize) activada.
  const sitiosIA = misSitios.map((x) => x.sitio!).filter((s) => s.computerVision)
  // Orden de compra del cliente (ODC) de esta campaña, si ya se registró.
  const odc = (ordenesCompra ?? []).find((o) => o.campanaId === id)
  const misCreas = (creatividades ?? []).filter((x) => x.campanaId === id)
  const misOis = (ois ?? []).filter((x) => x.campanaId === id)
  const misOts = (ots ?? []).filter((x) => x.campanaId === id)
  const misEvid = (evidencias ?? []).filter((e) => misOts.some((o) => o.id === e.otId))

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Menú lateral: saltar a las demás campañas sin volver al listado */}
        <CampanasNav activeId={id} />

        <div className="min-w-0 flex-1 space-y-4">
      {/* Migas: de dónde vengo y cómo llegué a esta campaña */}
      <div className="flex flex-wrap items-center gap-2">
        {volver.href && (
          <Link href={volver.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
          </Link>
        )}
        <span className="text-muted/50">·</span>
        <Breadcrumbs items={[...trail, { label: c.nombre }]} />
      </div>

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">{c.nombre}</h1>
          <p className="demo-num mt-1 text-[12px] text-muted">
            {c.folio} · {c.marca ?? ''} · {formatFecha(c.fechaInicio)}–{formatFecha(c.fechaFin)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tono={CAMPANA_TONO[c.estadoComercial]}>
            {CAMPANA_LABEL[c.estadoComercial]}
          </StatusBadge>
          {c.portalActivo && c.portalToken && (
            <Link
              href={`/demo/portal/${c.portalToken}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded border border-border-strong px-2.5 py-1 text-[12px] font-medium text-info hover:bg-surface-2"
            >
              Portal del cliente <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Aviso: pantallas con IA / medición de audiencia */}
      {sitiosIA.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3">
          <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div className="text-[12px]">
            <div className="text-[13px] font-medium text-ink">
              Esta campaña incluye {sitiosIA.length} pantalla{sitiosIA.length === 1 ? '' : 's'} con IA · medición de audiencia (AdMobilize)
            </div>
            <div className="mt-0.5 text-muted">
              {sitiosIA
                .map((s) => s.nombre + (s.admobilizeId ? ` (${s.admobilizeId})` : ''))
                .join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline (pieza estrella) */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineView campanaId={id} />
        </CardContent>
      </Card>

      {/* Validación de publicación (verificar anuncios antes de salir al aire) */}
      <Card>
        <CardHeader>
          <CardTitle>Validación de publicación</CardTitle>
        </CardHeader>
        <CardContent>
          <ValidacionPanel campanaId={id} />
        </CardContent>
      </Card>

      {/* Candado + presupuesto */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CandadoPanel campanaId={id} />
        <Card>
          <CardHeader>
            <CardTitle>Comercial</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              <Fila label="Subtotal (neto)" valor={c.presupuestoNeto ? formatMonto(c.presupuestoNeto) : '—'} mono />
              <Fila
                label={`IVA (${c.presupuestoNeto ? Math.round(((c.presupuestoBruto ?? 0) - c.presupuestoNeto) / c.presupuestoNeto * 100) : 16}%)`}
                valor={c.presupuestoNeto != null && c.presupuestoBruto != null ? formatMonto(c.presupuestoBruto - c.presupuestoNeto) : '—'}
                mono
              />
              <Fila label="Total" valor={c.presupuestoBruto ? formatMonto(c.presupuestoBruto) : '—'} mono />
              <Fila label="Agencia" valor={c.agencia ?? 'Directo'} />
              <Fila label="OC recibida" valor={c.ocRecibida ? 'Sí' : 'No'} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Datos de facturación: fiscales del cliente (auto-llenados) + contrato */}
      <DatosFacturacion campana={c} />

      {/* Rentabilidad (motor de costos: espacios + impresión + operación) */}
      {margen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rentabilidad</CardTitle>
            <span className={`text-[13px] font-semibold ${margen.margen >= 0 ? 'text-[#0f7a55]' : 'text-error'}`}>
              Margen {margen.margenPct.toFixed(0)}%
            </span>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              {c.presupuestoBruto ? (
                <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                  <dt className="flex items-center gap-1.5 text-muted">
                    Total contratado (cliente)
                    <span
                      className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted"
                      title="Snapshot económico congelado en la aceptación — igual al total de la propuesta y de la factura (IVA incluido)"
                    >
                      snapshot
                    </span>
                  </dt>
                  <dd className="demo-num font-medium text-ink">{formatMonto(c.presupuestoBruto)}</dd>
                </div>
              ) : null}
              <Fila label="Ingreso del medio (neto)" valor={formatMonto(margen.ingreso)} mono />
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted">
                  − Costo de espacios
                  {margen.costoEspacios > 0 && (
                    <span
                      className="rounded-full border border-[#f59e0b55] px-1.5 py-0.5 text-[9px] font-medium text-[#9a6700]"
                      title="Costo de compra interno estimado — no está ligado a un contrato de arrendador vigente"
                    >
                      estimado
                    </span>
                  )}
                </dt>
                <dd className="demo-num text-ink">{formatMonto(margen.costoEspacios)}</dd>
              </div>
              <Fila label="− Costo de impresión" valor={formatMonto(margen.costoImpresion)} mono />
              <Fila label="− Costo de operación" valor={formatMonto(margen.costoOperacion)} mono />
              <div className="mt-1 border-t border-border pt-2">
                <Fila label="Margen" valor={formatMonto(margen.margen)} mono />
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Reporte de cumplimiento (contratado vs entregado + testigos) */}
      {reporte && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reporte de cumplimiento</CardTitle>
            <span className={`text-[13px] font-semibold ${reporte.cumplimientoPct >= 100 ? 'text-[#0f7a55]' : 'text-[#9a6700]'}`}>
              {reporte.cumplimientoPct.toFixed(0)}% entregado
            </span>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
              <Fila label="Sitios contratados" valor={String(reporte.sitiosContratados)} mono />
              <Fila label="Sitios entregados" valor={String(reporte.sitiosEntregados)} mono />
              <Fila label="Testigos (fotos)" valor={String(reporte.testigos)} mono />
              <Fila label="Días contratados" valor={String(reporte.diasContratados)} mono />
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Orden de compra del cliente (ODC) */}
      {odc && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Orden de compra</CardTitle>
            <span className="rounded-full border border-[#10b98140] px-2 py-0.5 text-[11px] font-medium text-[#0f7a55]">
              {odc.estatus === 'RECIBIDA' ? 'Recibida' : odc.estatus === 'PENDIENTE' ? 'Pendiente' : 'Cancelada'}
            </span>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              <Fila label="Folio ODC" valor={odc.folio} mono />
              {odc.numeroOc && <Fila label="Número de OC (cliente)" valor={odc.numeroOc} mono />}
              <Fila label="Monto" valor={formatMonto(odc.monto)} mono />
              <Fila label="Fecha" valor={formatFecha(odc.fecha)} />
              {odc.documentoUrl && <Fila label="Documento" valor={odc.documentoUrl} />}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Sitios */}
      <Card>
        <CardHeader>
          <CardTitle>Sitios de la campaña</CardTitle>
        </CardHeader>
        <CardContent>
          {misSitios.length === 0 ? (
            <p className="text-[13px] text-muted">Sin sitios asignados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {misSitios.map(({ reserva, sitio }) => (
                <li key={reserva.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{sitio!.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {sitio!.alcaldia} · {formatMonto(reserva.precio)}/mes
                    </div>
                  </div>
                  <StatusBadge tono={RESERVA_TONO[reserva.estatus]}>
                    {RESERVA_LABEL[reserva.estatus]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Producción: creatividades + imprenta + OT */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Printer className="h-4 w-4 text-muted" />
            <CardTitle>Imprenta</CardTitle>
          </CardHeader>
          <CardContent>
            {misOis.length === 0 ? (
              <p className="text-[13px] text-muted">Sin órdenes de impresión.</p>
            ) : (
              <ul className="space-y-2">
                {misOis.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="demo-num truncate text-[12px] text-ink">{o.folio}</div>
                      <div className="text-[11px] text-muted">{o.material}</div>
                    </div>
                    <StatusBadge tono={IMPRESION_TONO[o.estatus]}>{IMPRESION_LABEL[o.estatus]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted" />
            <CardTitle>Órdenes de trabajo</CardTitle>
          </CardHeader>
          <CardContent>
            {misOts.length === 0 ? (
              <p className="text-[13px] text-muted">Sin órdenes de trabajo.</p>
            ) : (
              <ul className="space-y-1">
                {misOts.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={withTrail(`/demo/operaciones/ot/${o.id}`, trailHaciaOT)}
                      className="-mx-1 flex items-center justify-between rounded px-1 py-1.5 hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <div className="demo-num truncate text-[12px] text-ink">{o.folio}</div>
                        <div className="text-[11px] text-muted">{o.descripcion}</div>
                      </div>
                      <StatusBadge tono={OT_TONO[o.estatus]}>{OT_LABEL[o.estatus]}</StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creatividades — siempre visible para poder subir desde aquí, sin ir a
          la pantalla de Creativos. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Creatividades</CardTitle>
          <Link
            href={withTrail('/demo/creativos', trail)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
          >
            Gestionar <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {misCreas.length > 0 ? (
            <ul className="space-y-2">
              {misCreas.map((cr) => (
                <li key={cr.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink">{cr.nombre}</span>
                  <StatusBadge tono={CREATIVIDAD_TONO[cr.estatusValidacion]}>
                    {CREATIVIDAD_LABEL[cr.estatusValidacion]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Aún no hay creativos. Súbelos aquí mismo.</p>
          )}
          <AgregarCreativo campanaId={id} />
        </CardContent>
      </Card>

      {/* Evidencias */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Camera className="h-4 w-4 text-muted" />
          <CardTitle>Evidencias fotográficas</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenciaGaleria
            fotos={misEvid.map((e) => ({ url: e.fotoUrl, tomadaEn: e.tomadaEn, subidaEn: e.timestamp }))}
          />
        </CardContent>
      </Card>

      {/* Proof of play: la prueba de los medios DIGITALES, equivalente a las
          evidencias fotográficas de los fijos. */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <MonitorPlay className="h-4 w-4 text-muted" />
          <CardTitle>Reproducciones (proof of play)</CardTitle>
        </CardHeader>
        <CardContent>
          <PlaylogsPanel campanaId={id} fechaInicio={c.fechaInicio} fechaFin={c.fechaFin} />
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  )
}

function Fila({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? 'demo-num text-ink' : 'text-ink'}>{valor}</dd>
    </div>
  )
}
