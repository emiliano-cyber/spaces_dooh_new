'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Camera, Printer, ClipboardList, Cpu, MonitorPlay, ChevronDown, Check } from 'lucide-react'
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
  useClientes,
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
  const clientes = useClientes()
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
    setTrail(t.length ? t : [{ label: 'Campañas', href: '/campanas' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Campañas', href: '/campanas' }
  // Rastro a propagar hacia las OT de esta campaña (incluye la campaña actual).
  const trailHaciaOT: Crumb[] = [...trail, { label: c && 'nombre' in c ? c.nombre : 'Campaña', href: `/campanas/${id}` }]

  if (c === undefined) {
    return <div className="w-full h-64 animate-pulse rounded-md bg-surface-2" />
  }
  if (c === null) {
    return (
      <div className="w-full">
        <p className="text-[13px] text-muted">Campaña no encontrada.</p>
        <Link href="/campanas" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info">
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

  // ─── Estado de cada sección: se abren las PENDIENTES y se minimizan las que ya
  //     están completas o que no aplican al tipo de campaña. (clientes se lee
  //     arriba, junto con los demás hooks, para no romper el orden de hooks.) ──
  const tieneDigital = c.tipoCampana === 'DOOH' || c.tipoCampana === 'HIBRIDA'
  const tieneFija = c.tipoCampana === 'OOH' || c.tipoCampana === 'HIBRIDA'
  const candadoHecho = c.ocRecibida && c.fotosComprobatorias && c.reportePublicacion
  const validacionAplica = tieneDigital && c.enviadaDominio
  const validacionHecha = c.validacionEstatus === 'APROBADA'
  const creativosHecho = misCreas.length > 0 && misCreas.every((cr) => cr.estatusValidacion === 'VALIDADA')
  const otsPendientes = misOts.length === 0 || misOts.some((o) => !['COMPLETADA', 'CANCELADA', 'RECHAZADA'].includes(o.estatus))
  const cliFiscal = (clientes ?? []).find((x) => x.id === c.clienteId)
  const fiscalHecho = !!cliFiscal?.rfc && !!cliFiscal?.razonSocial

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
              href={`/portal/${c.portalToken}`}
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

      {/* Secciones plegables. Flex + `order` para subir las pendientes. */}
      <div className="flex flex-col gap-4">
      {/* Validación de publicación (verificar anuncios antes de salir al aire) */}
      <Seccion
        titulo="Validación de publicación"
        estado={!validacionAplica ? 'na' : validacionHecha ? 'hecho' : 'pendiente'}
      >
        <ValidacionPanel campanaId={id} />
      </Seccion>

      {/* Candado de facturación */}
      <Seccion titulo="Candado de facturación" estado={candadoHecho ? 'hecho' : 'pendiente'}>
        <CandadoPanel campanaId={id} />
      </Seccion>

      {/* Comercial (referencia) */}
      <Seccion titulo="Comercial" estado="hecho">
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
      </Seccion>

      {/* Datos de facturación: fiscales del cliente (auto-llenados) + contrato */}
      <Seccion titulo="Datos de facturación" estado={fiscalHecho ? 'hecho' : 'pendiente'}>
        <DatosFacturacion campana={c} sinCard />
      </Seccion>

      {/* Rentabilidad (motor de costos: espacios + impresión + operación) */}
      {margen && (
        <Seccion
          titulo="Rentabilidad"
          estado="hecho"
          accion={
            <span className={`text-[13px] font-semibold ${margen.margen >= 0 ? 'text-[#0f7a55]' : 'text-error'}`}>
              Margen {margen.margenPct.toFixed(0)}%
            </span>
          }
        >
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
        </Seccion>
      )}

      {/* Reporte de cumplimiento (contratado vs entregado + testigos) */}
      {reporte && (
        <Seccion
          titulo="Reporte de cumplimiento"
          estado="hecho"
          accion={
            <span className={`text-[13px] font-semibold ${reporte.cumplimientoPct >= 100 ? 'text-[#0f7a55]' : 'text-[#9a6700]'}`}>
              {reporte.cumplimientoPct.toFixed(0)}% entregado
            </span>
          }
        >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
              <Fila label="Sitios contratados" valor={String(reporte.sitiosContratados)} mono />
              <Fila label="Sitios entregados" valor={String(reporte.sitiosEntregados)} mono />
              <Fila label="Testigos (fotos)" valor={String(reporte.testigos)} mono />
              <Fila label="Días contratados" valor={String(reporte.diasContratados)} mono />
            </dl>
        </Seccion>
      )}

      {/* Orden de compra del cliente (ODC) */}
      {odc && (
        <Seccion titulo="Orden de compra" estado="hecho">
            <dl className="space-y-2 text-[13px]">
              <Fila label="Folio ODC" valor={odc.folio} mono />
              {odc.numeroOc && <Fila label="Número de OC (cliente)" valor={odc.numeroOc} mono />}
              <Fila label="Monto" valor={formatMonto(odc.monto)} mono />
              <Fila label="Fecha" valor={formatFecha(odc.fecha)} />
              {odc.documentoUrl && <Fila label="Documento" valor={odc.documentoUrl} />}
            </dl>
        </Seccion>
      )}

      {/* Sitios (referencia) */}
      <Seccion titulo="Sitios de la campaña" estado="hecho">
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
      </Seccion>

      {/* Imprenta — solo para campañas con medios fijos (OOH/híbrida). */}
      <Seccion
        titulo="Imprenta"
        icono={<Printer className="h-4 w-4 text-muted" />}
        estado={!tieneFija ? 'na' : misOis.length > 0 ? 'hecho' : 'pendiente'}
      >
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
      </Seccion>

      {/* Órdenes de trabajo */}
      <Seccion
        titulo="Órdenes de trabajo"
        icono={<ClipboardList className="h-4 w-4 text-muted" />}
        estado={otsPendientes ? 'pendiente' : 'hecho'}
      >
            {misOts.length === 0 ? (
              <p className="text-[13px] text-muted">Sin órdenes de trabajo.</p>
            ) : (
              <ul className="space-y-1">
                {misOts.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={withTrail(`/operaciones/ot/${o.id}`, trailHaciaOT)}
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
      </Seccion>

      {/* Creatividades — se pueden subir desde aquí, sin ir a Creativos. */}
      <Seccion
        titulo="Creatividades"
        estado={creativosHecho ? 'hecho' : 'pendiente'}
        accion={
          <Link
            href={withTrail('/creativos', trail)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
          >
            Gestionar <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <div className="space-y-3">
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
        </div>
      </Seccion>

      {/* Evidencias fotográficas — de los medios FIJOS. */}
      <Seccion
        titulo="Evidencias fotográficas"
        icono={<Camera className="h-4 w-4 text-muted" />}
        estado={!tieneFija ? 'na' : misEvid.length > 0 ? 'hecho' : 'pendiente'}
      >
        <EvidenciaGaleria
          fotos={misEvid.map((e) => ({ url: e.fotoUrl, tomadaEn: e.tomadaEn, subidaEn: e.timestamp }))}
        />
      </Seccion>

      {/* Proof of play — la prueba de los medios DIGITALES. */}
      <Seccion
        titulo="Reproducciones (proof of play)"
        icono={<MonitorPlay className="h-4 w-4 text-muted" />}
        estado={!tieneDigital ? 'na' : c.validacionEstatus === 'APROBADA' ? 'hecho' : 'pendiente'}
      >
        <PlaylogsPanel campanaId={id} fechaInicio={c.fechaInicio} fechaFin={c.fechaFin} />
      </Seccion>
      </div>
        </div>
      </div>
    </div>
  )
}

// Sección colapsable de la ficha. Arranca abierta o minimizada según su estado
// (las pendientes abiertas, las hechas o que no aplican minimizadas). El usuario
// puede abrir/cerrar con clic en el encabezado.
type EstadoSeccion = 'pendiente' | 'hecho' | 'na'
function Seccion({
  titulo,
  icono,
  estado,
  accion,
  children,
}: {
  titulo: string
  icono?: React.ReactNode
  estado: EstadoSeccion
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(estado === 'pendiente')
  const chip =
    estado === 'hecho'
      ? { txt: 'Completo', cls: 'border-[#10b98140] text-[#0f7a55]' }
      : estado === 'na'
        ? { txt: 'No aplica', cls: 'border-border text-muted' }
        : { txt: 'Pendiente', cls: 'border-[#f59e0b40] text-[#9a6700]' }
  // Orden visual: las pendientes suben, luego las completas y al final las que no
  // aplican (solo reordena la vista; el DOM/JSX no cambia).
  const orden = estado === 'pendiente' ? 'order-1' : estado === 'hecho' ? 'order-2' : 'order-3'
  return (
    <Card className={orden}>
      <CardHeader
        className="flex cursor-pointer select-none flex-row items-center justify-between gap-2"
        onClick={() => setAbierto((v) => !v)}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icono}
          <CardTitle>{titulo}</CardTitle>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}>
            {estado === 'hecho' && <Check className="h-2.5 w-2.5" />}
            {chip.txt}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {accion}
          <button type="button" aria-label={abierto ? 'Minimizar' : 'Expandir'} onClick={() => setAbierto((v) => !v)} className="text-muted hover:text-ink">
            <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </CardHeader>
      {abierto && <CardContent>{children}</CardContent>}
    </Card>
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
