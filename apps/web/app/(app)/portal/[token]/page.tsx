'use client'

import { useEffect, useState } from 'react'
import { Radio, MapPin, CalendarDays, CircleHelp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { PipelineView } from '@/components/demo/campanas/PipelineView'
import { EvidenciaGaleria } from '@/components/demo/campanas/EvidenciaGaleria'
import { hidratarPortalPublico, type OrgPortal } from '@/lib/data/estado-api'
import {
  useCampanas,
  useReservas,
  useSitios,
  useOrdenesTrabajo,
  useEvidencias,
  usePipeline,
  formatFecha,
} from '@/lib/data/client'
import { ubicacion } from '@/lib/ubicacion'
import { etiquetaTipoMedio } from '@/lib/tipo-medio'

export default function PortalPage({ params }: { params: { token: string } }) {
  const campanas = useCampanas()
  const reservas = useReservas()
  const sitios = useSitios()
  const ots = useOrdenesTrabajo()
  const evidencias = useEvidencias()

  // Liga pública: hidrata el store SOLO con los datos de esta campaña (por token,
  // sin sesión), así cualquiera puede verla sin haber iniciado sesión.
  const [cargando, setCargando] = useState(true)
  // El membrete NO va al store: el store es del shell, y aquí no hay shell.
  const [org, setOrg] = useState<OrgPortal | null>(null)
  useEffect(() => {
    hidratarPortalPublico(params.token)
      .then(setOrg)
      .finally(() => setCargando(false))
  }, [params.token])

  const campana = campanas?.find((c) => c.portalToken === params.token && c.portalActivo) ?? null
  const pipeline = usePipeline(campana?.id ?? '')

  if (cargando) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-64 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }

  if (!campana) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <CircleHelp className="mb-3 h-8 w-8 text-muted" />
        <h1 className="text-xl text-ink">Enlace no válido</h1>
        <p className="mt-1 text-[13px] text-muted">
          Este enlace de portal no corresponde a ninguna campaña activa.
        </p>
      </div>
    )
  }

  const misReservas = (reservas ?? []).filter((r) => r.campanaId === campana.id)
  const misSitios = misReservas
    .map((r) => (sitios ?? []).find((s) => s.id === r.sitioId))
    .filter(Boolean)
  const misOts = (ots ?? []).filter((o) => o.campanaId === campana.id)
  const misEvid = (evidencias ?? []).filter((e) => misOts.some((o) => o.id === e.otId))

  return (
    <div className="min-h-screen bg-bg">
      {/* Header público */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          {/* El logo de quien presta el servicio, no el de la plataforma: este
              portal lo abre el CLIENTE. Si la organización no tiene logo se
              queda la marca genérica, que es lo que había — nunca peor. */}
          <div className="flex items-center gap-2.5">
            {org?.orgLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.orgLogoUrl}
                alt={org.orgNombre ?? ''}
                className="h-10 w-10 shrink-0 rounded object-contain"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-accent text-accent-fg">
                <Radio className="h-5 w-5" />
              </span>
            )}
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold text-ink">
                {org?.orgNombre || 'Spaces'}
              </div>
              <div className="text-[10px] text-muted">Portal del cliente</div>
            </div>
          </div>
          <span className="text-[12px] text-muted">Seguimiento de campaña</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* Resumen */}
        <div>
          <h1 className="text-2xl text-ink">{campana.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatFecha(campana.fechaInicio)} – {formatFecha(campana.fechaFin)}
            </span>
            {pipeline && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {pipeline.pasos[pipeline.index]?.label}
              </span>
            )}
          </div>
        </div>

        {/* Pipeline (sin financieros) */}
        <Card>
          <CardHeader>
            <CardTitle>Avance de tu campaña</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineView campanaId={campana.id} />
          </CardContent>
        </Card>

        {/* Ubicaciones (sin precios) */}
        <Card>
          <CardHeader>
            <CardTitle>Ubicaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {misSitios.map((s) => (
                <li key={s!.id} className="flex items-center gap-2.5 py-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{s!.nombre}</div>
                    <div className="text-[11px] text-muted">
                      {ubicacion([etiquetaTipoMedio(s!.tipoMedio), ubicacion([s!.alcaldia, s!.ciudad])], ' · ')}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Evidencias */}
        <Card>
          <CardHeader>
            <CardTitle>Evidencias de instalación</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenciaGaleria
              fotos={misEvid.map((e) => ({ url: e.fotoUrl, tomadaEn: e.tomadaEn, subidaEn: e.timestamp }))}
            />
          </CardContent>
        </Card>

        <p className="pb-4 text-center text-[11px] text-muted">
          {/* Llevaba «RGB Catorce S de RL de CV (PIXELED)» fijo, así que el
              portal de un cliente de OTRA organización le mostraba el nombre de
              una empresa que no es su proveedor (M5). Al corregirlo se dejó
              genérico —correcto pero mudo—; ahora dice el nombre de VERDAD, que
              es el de quien le presta el servicio a quien está leyendo. */}
          {org?.orgNombre || 'Spaces'} · portal de seguimiento
        </p>
      </main>
    </div>
  )
}
