'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Smartphone, Calendar, User, Camera, ArrowRight } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import {
  StatusBadge,
  OT_TONO,
  OT_LABEL,
  type Tono,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useOrdenesTrabajo,
  useSitios,
  useEvidencias,
  formatFecha,
  type TipoOT,
  type Prioridad,
  type EstOT,
} from '@/lib/data/client'

const TIPO_OT_LABEL: Record<TipoOT, string> = {
  MONTAJE_LONA: 'Montaje de lona',
  MONTAJE_DIGITAL: 'Montaje digital',
  DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mantenimiento preventivo',
  MANTENIMIENTO_CORRECTIVO: 'Mantenimiento correctivo',
  HERRERIA: 'Herrería',
  ELECTRICO: 'Eléctrico',
  INSPECCION: 'Inspección',
  OTRO: 'Otro',
}

const PRIORIDAD_TONO: Record<Prioridad, Tono> = {
  BAJA: 'neutro',
  NORMAL: 'azul',
  ALTA: 'ambar',
  URGENTE: 'rojo',
}
const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}

const CUADRILLA: Record<string, string> = {
  'user-cuadrilla-1': 'Cuadrilla A · Luis Paredes',
  'user-cuadrilla-2': 'Cuadrilla B · Rosa Inga',
}

const FILTROS: { value: EstOT | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'ASIGNADA', label: 'Asignadas' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'COMPLETADA', label: 'Completadas' },
]

export default function OperacionesPage() {
  const ots = useOrdenesTrabajo()
  const sitios = useSitios()
  const evidencias = useEvidencias()
  const [filtro, setFiltro] = useState<EstOT | ''>('')

  const lista = (ots ?? []).filter((o) => !filtro || o.estatus === filtro)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Operaciones</h1>
        <p className="mt-1 text-[13px] text-muted">Tareas de cuadrilla · seguimiento de campo</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-150',
              filtro === f.value
                ? 'border-ink bg-ink text-white'
                : 'border-border-strong text-muted hover:bg-surface-2',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!ots ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">No hay órdenes con ese filtro.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((o) => {
            const sitio = sitios?.find((s) => s.id === o.sitioId)
            const nEvid = (evidencias ?? []).filter((e) => e.otId === o.id).length
            const abierta = o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA'
            return (
              <li key={o.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="demo-num text-[12px] text-muted">{o.folio}</span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            PRIORIDAD_TONO[o.prioridad] === 'rojo' && 'border-[#ef444440] text-error',
                            PRIORIDAD_TONO[o.prioridad] === 'ambar' && 'border-[#f59e0b40] text-[#9a6700]',
                            PRIORIDAD_TONO[o.prioridad] === 'azul' && 'border-[#0a66ff40] text-info',
                            PRIORIDAD_TONO[o.prioridad] === 'neutro' && 'border-border text-muted',
                          )}
                        >
                          {PRIORIDAD_LABEL[o.prioridad]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[14px] font-medium text-ink">
                        {TIPO_OT_LABEL[o.tipo]}
                      </div>
                      <div className="text-[12px] text-muted">{sitio?.nombre ?? '—'}</div>
                    </div>
                    <StatusBadge tono={OT_TONO[o.estatus]}>{OT_LABEL[o.estatus]}</StatusBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> {CUADRILLA[o.asignadoAUserId ?? ''] ?? 'Sin asignar'}
                    </span>
                    {o.fechaProgramada && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> {formatFecha(o.fechaProgramada)}
                      </span>
                    )}
                    {nEvid > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Camera className="h-3.5 w-3.5" /> {nEvid} evidencia{nEvid === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/demo/m/ot/${o.id}`}
                      className="inline-flex items-center gap-1.5 rounded border border-border-strong px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      {abierta ? 'Abrir OT móvil' : 'Ver OT'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
