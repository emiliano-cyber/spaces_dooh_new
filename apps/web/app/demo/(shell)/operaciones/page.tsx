'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Smartphone, Calendar, User, Camera, ArrowRight, Plus } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import {
  StatusBadge,
  OT_TONO,
  OT_LABEL,
  type Tono,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { crearOTApi } from '@/lib/data/estado-api'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  useOrdenesTrabajo,
  useSitios,
  useCampanas,
  useEvidencias,
  useReservas,
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
  const campanas = useCampanas()
  const evidencias = useEvidencias()
  const reservas = useReservas()
  const puedeCrear = usePuede('operaciones', 'crear')
  const [filtro, setFiltro] = useState<EstOT | ''>('')
  const [nuevaOpen, setNuevaOpen] = useState(false)

  const lista = (ots ?? []).filter((o) => !filtro || o.estatus === filtro)

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Operaciones</h1>
          <p className="mt-1 text-[13px] text-muted">Tareas de cuadrilla · seguimiento de campo</p>
        </div>
        {puedeCrear && (
          <Button size="sm" onClick={() => setNuevaOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva OT
          </Button>
        )}
      </div>

      <NuevaOTModal
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        sitios={sitios ?? []}
        campanas={campanas ?? []}
        reservas={reservas ?? []}
      />

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

// ─── Modal Nueva OT ─────────────────────────────────────────────────────────
function NuevaOTModal({
  open,
  onOpenChange,
  sitios,
  campanas,
  reservas,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sitios: { id: string; nombre: string }[]
  campanas: { id: string; nombre: string }[]
  reservas: { campanaId: string; sitioId: string }[]
}) {
  const [tipo, setTipo] = useState<TipoOT>('MONTAJE_LONA')
  const [descripcion, setDescripcion] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [campanaId, setCampanaId] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('NORMAL')
  const [enviando, setEnviando] = useState(false)
  const sel =
    'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

  // Sitios reservados por la campaña elegida (null = sin campaña → libre).
  const sitiosDeCampana = useMemo(() => {
    if (!campanaId) return null
    const ids = new Set(reservas.filter((r) => r.campanaId === campanaId).map((r) => r.sitioId))
    return sitios.filter((s) => ids.has(s.id))
  }, [campanaId, reservas, sitios])

  // Al elegir campaña, el sitio se autoselecciona desde su reserva.
  function onCampana(id: string) {
    setCampanaId(id)
    if (!id) return
    const ids = [...new Set(reservas.filter((r) => r.campanaId === id).map((r) => r.sitioId))]
    setSitioId(ids[0] ?? '')
  }
  // Opciones del select de sitio: las de la campaña si hay, si no todas.
  const opcionesSitio = sitiosDeCampana ?? sitios

  async function crear() {
    if (!descripcion.trim()) return
    setEnviando(true)
    try {
      await crearOTApi({
        tipo,
        descripcion: descripcion.trim(),
        sitioId: sitioId || null,
        campanaId: campanaId || null,
        prioridad,
        checklist: [
          { label: 'Inspección de estructura y herrajes', hecho: false },
          { label: 'Montaje / ejecución', hecho: false },
          { label: 'Foto comprobatoria con geolocalización', hecho: false },
        ],
      })
      onOpenChange(false)
      setDescripcion('')
      setSitioId('')
      setCampanaId('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo crear la OT')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva orden de trabajo"
      subtitle="Asigna una tarea a cuadrilla"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={!descripcion.trim() || enviando} onClick={crear}>
            {enviando ? 'Creando…' : 'Crear OT'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Tipo de tarea</span>
          <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOT)}>
            {Object.entries(TIPO_OT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Descripción</span>
          <textarea
            className="min-h-[70px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="p. ej. Montaje de lona en espectacular…"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Campaña</span>
            <select className={sel} value={campanaId} onChange={(e) => onCampana(e.target.value)}>
              <option value="">— Sin campaña —</option>
              {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Sitio
              {campanaId && <span className="text-[10px] font-normal text-muted">(auto por campaña)</span>}
            </span>
            <select className={sel} value={sitioId} onChange={(e) => setSitioId(e.target.value)}>
              <option value="">— Sin sitio —</option>
              {opcionesSitio.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            {campanaId && sitiosDeCampana?.length === 0 && (
              <span className="mt-1 block text-[11px] text-muted">Esta campaña no tiene sitios reservados.</span>
            )}
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Prioridad</span>
          <select className={sel} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
            {Object.entries(PRIORIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  )
}
