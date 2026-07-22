'use client'

import { toast } from 'sonner'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, Calendar, User, Camera, ArrowRight, Plus, AlertTriangle } from 'lucide-react'
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
import { withTrail } from '@/lib/nav-trail'
import { crearOTApi } from '@/lib/data/estado-api'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  useOrdenesTrabajo,
  useSitios,
  useCampanas,
  useEvidencias,
  useReservas,
  useUsuarios,
  formatFecha,
  estadoSLAOT,
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

// Tipos de tarea aplicables según el tipo de pantalla. Una DIGITAL no lleva
// montaje de lona ni herrería (no hay lona ni estructura de espectacular), y
// TAMPOCO montaje digital: el arte se sube por "Subir a producción" (DOOHmain)
// desde la campaña, no por una OT de montaje. Una FIJA no lleva montaje digital.
// El resto (desmontaje, mantenimiento, eléctrico, inspección) aplica a ambas.
const TIPO_OT_DIGITAL: TipoOT[] = ['DESMONTAJE', 'MANTENIMIENTO_PREVENTIVO', 'MANTENIMIENTO_CORRECTIVO', 'ELECTRICO', 'INSPECCION', 'OTRO']
const TIPO_OT_FIJA: TipoOT[] = ['MONTAJE_LONA', 'DESMONTAJE', 'MANTENIMIENTO_PREVENTIVO', 'MANTENIMIENTO_CORRECTIVO', 'HERRERIA', 'ELECTRICO', 'INSPECCION', 'OTRO']
const TODOS_TIPOS_OT = Object.keys(TIPO_OT_LABEL) as TipoOT[]

function esSitioDigital(s?: { tipoMedio?: string; esRotativo?: boolean; exhibicion?: string } | null): boolean {
  if (!s) return false
  return s.tipoMedio === 'PANTALLA_DIGITAL' || !!s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
}
// Tipos disponibles: filtrados por pantalla si hay sitio; todos si aún no se elige.
function tiposParaSitio(digital: boolean | null): TipoOT[] {
  if (digital == null) return TODOS_TIPOS_OT
  return digital ? TIPO_OT_DIGITAL : TIPO_OT_FIJA
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
  const usuarios = useUsuarios()
  const nombreAsignado = (id?: string | null) =>
    (id && usuarios?.find((u) => u.id === id)?.nombre) || CUADRILLA[id ?? ''] || 'Sin asignar'
  const puedeCrear = usePuede('operaciones', 'crear')
  const [filtro, setFiltro] = useState<EstOT | ''>('')
  const [nuevaOpen, setNuevaOpen] = useState(false)

  const lista = (ots ?? []).filter((o) => !filtro || o.estatus === filtro)
  const vencidas = (ots ?? []).filter((o) => estadoSLAOT(o) === 'VENCIDA')
  const porVencer = (ots ?? []).filter((o) => estadoSLAOT(o) === 'POR_VENCER')

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

      {/* Banner de SLA: OT vencidas (compromiso pasado, aún abiertas) */}
      {(vencidas.length > 0 || porVencer.length > 0) && (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]',
            vencidas.length > 0
              ? 'border-[#ef444440] bg-[#ef44440d] text-error'
              : 'border-[#f59e0b40] bg-[#f59e0b0d] text-[#9a6700]',
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <div className="text-ink">
            {vencidas.length > 0 && (
              <span className="font-medium text-error">
                {vencidas.length} OT vencida{vencidas.length === 1 ? '' : 's'}
              </span>
            )}
            {vencidas.length > 0 && porVencer.length > 0 && <span className="text-muted"> · </span>}
            {porVencer.length > 0 && (
              <span className="font-medium text-[#9a6700]">
                {porVencer.length} por vencer
              </span>
            )}
            <span className="text-muted">
              {' '}
              — una OT abierta que pasó su fecha compromiso frena el candado de facturación.
            </span>
          </div>
        </div>
      )}

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
            const sla = estadoSLAOT(o)
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      {sla === 'VENCIDA' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#ef444440] px-2 py-0.5 text-[10px] font-semibold text-error">
                          <AlertTriangle className="h-3 w-3" /> Vencida
                        </span>
                      )}
                      {sla === 'POR_VENCER' && (
                        <span className="rounded-full border border-[#f59e0b40] px-2 py-0.5 text-[10px] font-semibold text-[#9a6700]">
                          Por vencer
                        </span>
                      )}
                      <StatusBadge tono={OT_TONO[o.estatus]}>{OT_LABEL[o.estatus]}</StatusBadge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> {nombreAsignado(o.asignadoAUserId)}
                    </span>
                    {o.fechaProgramada && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          sla === 'VENCIDA' && 'font-medium text-error',
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" /> {formatFecha(o.fechaProgramada)}
                        {sla === 'VENCIDA' && ' · vencida'}
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
                      href={withTrail(`/demo/operaciones/ot/${o.id}`, [{ label: 'Operaciones', href: '/demo/operaciones' }])}
                      className="inline-flex items-center gap-1.5 rounded border border-border-strong px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      {abierta ? 'Abrir OT' : 'Ver OT'}
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
  sitios: { id: string; nombre: string; tipoMedio?: string; esRotativo?: boolean; exhibicion?: string }[]
  campanas: { id: string; nombre: string }[]
  reservas: { campanaId: string; sitioId: string }[]
}) {
  const [tipo, setTipo] = useState<TipoOT>('INSPECCION')
  const [descripcion, setDescripcion] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [campanaId, setCampanaId] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('NORMAL')
  const [fechaProg, setFechaProg] = useState('')
  const [asignado, setAsignado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const usuarios = useUsuarios()
  // Responsables sugeridos: usuarios con rol de Operaciones (o cualquiera si no hay).
  const responsables = (usuarios ?? []).filter((u) => u.rol === 'OPERACIONES' || u.rol === 'DUENO')
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

  // Tipo de pantalla del sitio elegido → tipos de tarea válidos. Una pantalla
  // digital no puede llevar montaje de lona; una fija no lleva montaje digital.
  const sitioSel = opcionesSitio.find((s) => s.id === sitioId)
  const digital = sitioId ? esSitioDigital(sitioSel) : null
  const tiposDisponibles = tiposParaSitio(digital)

  // Si el tipo elegido deja de ser válido al cambiar de pantalla, cae al primero
  // disponible (p. ej. de "Montaje de lona" a "Montaje digital" en una digital).
  useEffect(() => {
    if (!tiposDisponibles.includes(tipo)) setTipo(tiposDisponibles[0])
  }, [tiposDisponibles, tipo])

  async function crear() {
    if (!descripcion.trim() || !fechaProg) return
    setEnviando(true)
    try {
      await crearOTApi({
        tipo,
        descripcion: descripcion.trim(),
        sitioId: sitioId || null,
        campanaId: campanaId || null,
        prioridad,
        fechaProgramada: fechaProg,
        asignadoA: asignado || null,
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
      setFechaProg('')
      setAsignado('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la OT')
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
          <Button size="sm" disabled={!descripcion.trim() || !fechaProg || enviando} onClick={crear}>
            {enviando ? 'Creando…' : 'Crear OT'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 1) Primero la campaña y su pantalla: de ahí depende qué tareas se pueden elegir. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Campaña</span>
            <select className={sel} value={campanaId} onChange={(e) => onCampana(e.target.value)}>
              <option value="">— Sin campaña —</option>
              {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Pantalla
              {campanaId && <span className="text-[10px] font-normal text-muted">(auto por campaña)</span>}
            </span>
            <select className={sel} value={sitioId} onChange={(e) => setSitioId(e.target.value)}>
              <option value="">— Sin pantalla —</option>
              {opcionesSitio.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} {esSitioDigital(s) ? '· Digital' : '· Fija'}
                </option>
              ))}
            </select>
            {campanaId && sitiosDeCampana?.length === 0 && (
              <span className="mt-1 block text-[11px] text-muted">Esta campaña no tiene sitios reservados.</span>
            )}
          </label>
        </div>
        {/* 2) Tipo de tarea, ya filtrado por el tipo de pantalla. */}
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
            Tipo de tarea
            {sitioId && (
              <span className="text-[10px] font-normal text-muted">
                (opciones de pantalla {digital ? 'digital' : 'fija'})
              </span>
            )}
          </span>
          <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOT)}>
            {tiposDisponibles.map((k) => <option key={k} value={k}>{TIPO_OT_LABEL[k]}</option>)}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Prioridad</span>
            <select className={sel} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
              {Object.entries(PRIORIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">
              Fecha compromiso <span className="text-error">*</span>
            </span>
            <input type="date" className={sel} value={fechaProg} onChange={(e) => setFechaProg(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Asignar a (responsable)</span>
          <select className={sel} value={asignado} onChange={(e) => setAsignado(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {responsables.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  )
}
