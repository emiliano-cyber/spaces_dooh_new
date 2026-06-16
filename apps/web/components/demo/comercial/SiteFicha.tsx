'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  MapPin,
  Ruler,
  Lightbulb,
  Compass,
  Hash,
  Layers,
  Building2,
  Eye,
  Route,
  Repeat,
  Monitor,
  Clock,
  Network,
  Share2,
} from 'lucide-react'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Button } from '@/components/demo/ui/Button'
import { FotoUploaderMock } from '@/components/demo/FotoUploaderMock'
import { CalendarioDisponibilidad } from '@/components/demo/CalendarioDisponibilidad'
import {
  StatusBadge,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import {
  useReservas,
  useIncidencias,
  formatMonto,
  type Sitio,
  type TipoMedio,
} from '@/lib/data/client'
import type { FotoMeta } from '@/lib/data/types'

const TIPO_LABEL: Record<TipoMedio, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

const CMS_LABEL: Record<string, string> = {
  BROADSIGN: 'Broadsign',
  INVIDIS: 'Invidis',
  DOOHMAIN: 'Doohmain',
  OTRO: 'Otros',
}

const OPERATIVO_LABEL: Record<string, string> = {
  ACTIVO: 'Operativo',
  EN_MANTENIMIENTO: 'En mantenimiento',
  APAGADO: 'Apagado',
  DAÑADO: 'Dañado',
  BAJA: 'Baja',
}
const LEGAL_LABEL: Record<string, string> = {
  EN_ORDEN: 'Permiso en orden',
  PERMISO_VENCIDO: 'Permiso vencido',
  EN_TRAMITE: 'Permiso en trámite',
  SUSPENDIDO: 'Permiso suspendido',
  SIN_PERMISO: 'Sin permiso',
}

export function SiteFicha({
  sitio,
  open,
  onOpenChange,
  onReservar,
}: {
  sitio: Sitio | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onReservar?: (sitioId: string) => void
}) {
  const reservas = useReservas()
  const incidencias = useIncidencias()
  const [fotos, setFotos] = useState<FotoMeta[]>([])

  // Reinicia la galería local al cambiar de sitio. Las fotos sembradas (string)
  // se adaptan a FotoMeta sin fechas conocidas.
  useEffect(() => {
    setFotos((sitio?.fotos ?? []).map((url) => ({ url, tomadaEn: '', subidaEn: '' })))
  }, [sitio?.id])

  if (!sitio) return null

  const rangos =
    reservas
      ?.filter((r) => r.sitioId === sitio.id && r.estatus !== 'CANCELADA')
      .map((r) => ({
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        estatus: r.estatus === 'CONFIRMADA' ? ('CONFIRMADA' as const) : ('TENTATIVA' as const),
      })) ?? []

  const incidencia = incidencias?.find(
    (i) => i.sitioId === sitio.id && (i.estatus === 'ABIERTA' || i.estatus === 'EN_PROCESO'),
  )

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={sitio.nombre}
      subtitle={`${sitio.claveInterna} · ${sitio.alcaldia}, ${sitio.ciudad}`}
      footer={
        sitio.estatusComercial === 'DISPONIBLE' && onReservar ? (
          <Button className="w-full" onClick={() => onReservar(sitio.id)}>
            Reservar este sitio
          </Button>
        ) : (
          <p className="text-center text-[12px] text-muted">
            Sitio {SITIO_LABEL[sitio.estatusComercial].toLowerCase()} · no disponible para reservar
          </p>
        )
      }
    >
      <div className="space-y-5">
        {/* Estatus */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge tono={SITIO_TONO[sitio.estatusComercial]}>
            {SITIO_LABEL[sitio.estatusComercial]}
          </StatusBadge>
          <StatusBadge tono={sitio.estatusOperativo === 'ACTIVO' ? 'verde' : 'ambar'}>
            {OPERATIVO_LABEL[sitio.estatusOperativo]}
          </StatusBadge>
          <StatusBadge tono={sitio.estatusLegal === 'EN_ORDEN' ? 'verde' : 'rojo'}>
            {LEGAL_LABEL[sitio.estatusLegal]}
          </StatusBadge>
        </div>

        {/* Incidencia explicada */}
        {incidencia && (
          <div className="flex gap-2.5 rounded-md border border-[#ef444440] bg-[#ef44440d] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={1.75} />
            <div>
              <div className="text-[13px] font-medium text-ink">Incidencia activa</div>
              <p className="mt-0.5 text-[12px] text-muted">{incidencia.descripcion}</p>
            </div>
          </div>
        )}

        {/* Galería */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Galería</h4>
          <FotoUploaderMock fotos={fotos} onChange={setFotos} label="Agregar foto" />
        </div>

        {/* Características técnicas */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Características</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <Caracteristica icon={<Hash className="h-4 w-4" />} label="Código proveedor" valor={sitio.codigoProveedor} mono />
            <Caracteristica icon={<MapPin className="h-4 w-4" />} label="Tipo" valor={TIPO_LABEL[sitio.tipoMedio]} />
            <Caracteristica
              icon={<Ruler className="h-4 w-4" />}
              label="Medidas"
              valor={sitio.alto && sitio.ancho ? `${sitio.ancho} × ${sitio.alto} m` : '—'}
              mono
            />
            <Caracteristica icon={<Layers className="h-4 w-4" />} label="Caras" valor={String(sitio.caras)} mono />
            <Caracteristica icon={<Building2 className="h-4 w-4" />} label="Estructura" valor={sitio.tipoEstructura} />
            <Caracteristica icon={<Eye className="h-4 w-4" />} label="Vista" valor={sitio.vista} />
            <Caracteristica icon={<Route className="h-4 w-4" />} label="Tramo" valor={sitio.tramo} />
            <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Exhibición" valor={`${sitio.exhibicion}${sitio.esRotativo ? ' · rotativo' : ''}`} />
            <Caracteristica icon={<Lightbulb className="h-4 w-4" />} label="Iluminado" valor={sitio.iluminado ? 'Sí' : 'No'} />
            <Caracteristica icon={<Compass className="h-4 w-4" />} label="Orientación" valor={sitio.orientacion ?? '—'} />
          </dl>

          {/* Datos DOOH solo si aplica */}
          {sitio.esRotativo && (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-2.5 text-[13px]">
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Resolución" valor={sitio.resolucionPx ?? '—'} mono />
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Contenido" valor={sitio.tipoContenido === 'VIDEO' ? 'Video' : sitio.tipoContenido === 'IMAGEN' ? 'Imagen' : '—'} />
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Spots por hora" valor={sitio.spotsPorHora != null ? String(sitio.spotsPorHora) : '—'} mono />
              <Caracteristica icon={<Clock className="h-4 w-4" />} label="Duración spot" valor={sitio.duracionSpotSeg != null ? `${sitio.duracionSpotSeg} s` : '—'} mono />
              <Caracteristica icon={<Clock className="h-4 w-4" />} label="Horario" valor={sitio.horario ?? '—'} mono />
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="CMS" valor={sitio.cms ? CMS_LABEL[sitio.cms] : '—'} />
            </dl>
          )}

          {/* Comercialización (Network) */}
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-2.5 text-[13px]">
            <Caracteristica
              icon={<Network className="h-4 w-4" />}
              label="Comercialización"
              valor={sitio.comercializacion === 'PROGRAMATICO' ? 'Programático' : 'Tradicional'}
            />
            <Caracteristica icon={<Share2 className="h-4 w-4" />} label="En Network" valor={sitio.enNetwork ? 'Sí' : 'No'} />
          </dl>
        </div>

        {/* Datos comerciales (interno — el portal no muestra financieros) */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Datos comerciales</h4>
          <div className="space-y-2">
            <DatoComercial label={`Tarifa publicada (${sitio.unidad})`} valor={formatMonto(sitio.tarifaPublicada)} />
            <DatoComercial label="Costo de compra" valor={formatMonto(sitio.costoCompra)} />
            {(() => {
              const margen = sitio.tarifaPublicada - sitio.costoCompra
              const pct = sitio.tarifaPublicada > 0 ? (margen / sitio.tarifaPublicada) * 100 : 0
              const color = pct >= 30 ? 'text-success' : pct >= 10 ? 'text-ink' : 'text-error'
              return (
                <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
                  <span className="text-[12px] text-muted">Margen</span>
                  <span className={`demo-num text-sm font-semibold ${color}`}>
                    {formatMonto(margen)} · {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Dirección */}
        <div>
          <h4 className="mb-1.5 text-[13px] font-medium text-ink">Ubicación</h4>
          <dl className="space-y-1.5 text-[13px]">
            <div>
              <dt className="text-[11px] text-muted">Dirección comercial</dt>
              <dd className="text-ink">{sitio.direccionComercial}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Dirección del predio</dt>
              <dd className="text-ink">{sitio.direccionPredio}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Coordenadas</dt>
              <dd className="demo-num text-ink">{sitio.lat.toFixed(4)}, {sitio.lng.toFixed(4)}</dd>
            </div>
          </dl>
        </div>

        {/* Disponibilidad por fechas */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Disponibilidad</h4>
          <CalendarioDisponibilidad rangos={rangos} />
        </div>
      </div>
    </Sheet>
  )
}

function DatoComercial({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 text-[13px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="demo-num text-ink">{valor}</span>
    </div>
  )
}

function Caracteristica({
  icon,
  label,
  valor,
  mono,
}: {
  icon: React.ReactNode
  label: string
  valor: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div>
        <dt className="text-[11px] text-muted">{label}</dt>
        <dd className={mono ? 'demo-num text-ink' : 'text-ink'}>{valor}</dd>
      </div>
    </div>
  )
}
