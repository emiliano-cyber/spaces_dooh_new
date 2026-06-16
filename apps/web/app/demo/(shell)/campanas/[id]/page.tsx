'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink, Camera, Printer, ClipboardList } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { PipelineView } from '@/components/demo/campanas/PipelineView'
import { CandadoPanel } from '@/components/demo/campanas/CandadoPanel'
import { EvidenciaGaleria } from '@/components/demo/campanas/EvidenciaGaleria'
import {
  StatusBadge,
  CAMPANA_TONO,
  CAMPANA_LABEL,
  RESERVA_TONO,
  RESERVA_LABEL,
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

  if (c === undefined) {
    return <div className="mx-auto max-w-4xl h-64 animate-pulse rounded-md bg-surface-2" />
  }
  if (c === null) {
    return (
      <div className="mx-auto max-w-4xl">
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
  const misCreas = (creatividades ?? []).filter((x) => x.campanaId === id)
  const misOis = (ois ?? []).filter((x) => x.campanaId === id)
  const misOts = (ots ?? []).filter((x) => x.campanaId === id)
  const misEvid = (evidencias ?? []).filter((e) => misOts.some((o) => o.id === e.otId))

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/demo/campanas" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Campañas
      </Link>

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

      {/* Pipeline (pieza estrella) */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineView campanaId={id} />
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
              <Fila label="Presupuesto bruto" valor={c.presupuestoBruto ? formatMonto(c.presupuestoBruto) : '—'} mono />
              <Fila label="Presupuesto neto" valor={c.presupuestoNeto ? formatMonto(c.presupuestoNeto) : '—'} mono />
              <Fila label="Agencia" valor={c.agencia ?? 'Directo'} />
              <Fila label="OC recibida" valor={c.ocRecibida ? 'Sí' : 'No'} />
            </dl>
          </CardContent>
        </Card>
      </div>

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
                      href={`/demo/m/ot/${o.id}`}
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

      {/* Creatividades */}
      {misCreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Creatividades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {misCreas.map((cr) => (
                <li key={cr.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink">{cr.nombre}</span>
                  <StatusBadge tono={cr.estatusValidacion === 'VALIDADA' ? 'verde' : cr.estatusValidacion === 'RECHAZADA' ? 'rojo' : 'ambar'}>
                    {cr.estatusValidacion === 'VALIDADA' ? 'Validada' : cr.estatusValidacion === 'RECHAZADA' ? 'Rechazada' : 'Pendiente'}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Evidencias */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Camera className="h-4 w-4 text-muted" />
          <CardTitle>Evidencias fotográficas</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenciaGaleria urls={misEvid.map((e) => e.fotoUrl)} />
        </CardContent>
      </Card>
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
