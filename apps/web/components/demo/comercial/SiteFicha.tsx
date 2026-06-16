'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, MapPin, Ruler, Lightbulb, Compass } from 'lucide-react'
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

        {/* Características */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Características</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <Caracteristica icon={<MapPin className="h-4 w-4" />} label="Tipo" valor={TIPO_LABEL[sitio.tipoMedio]} />
            <Caracteristica
              icon={<Ruler className="h-4 w-4" />}
              label="Medidas"
              valor={sitio.alto && sitio.ancho ? `${sitio.ancho} × ${sitio.alto} m` : '—'}
              mono
            />
            <Caracteristica
              icon={<Lightbulb className="h-4 w-4" />}
              label="Iluminado"
              valor={sitio.iluminado ? 'Sí' : 'No'}
            />
            <Caracteristica
              icon={<Compass className="h-4 w-4" />}
              label="Orientación"
              valor={sitio.orientacion ?? '—'}
            />
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
            <span className="text-[12px] text-muted">Tarifa de lista (mensual)</span>
            <span className="demo-num text-sm font-semibold text-ink">
              {formatMonto(sitio.tarifaMensual)}
            </span>
          </div>
        </div>

        {/* Dirección */}
        <div>
          <h4 className="mb-1.5 text-[13px] font-medium text-ink">Ubicación</h4>
          <p className="text-[13px] text-muted">{sitio.direccion}</p>
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
