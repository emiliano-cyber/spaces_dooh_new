'use client'

import { toast } from 'sonner'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { fechaLocalISO } from '@/lib/fecha-local'
import { Calendar, User, Camera, Plus, AlertTriangle, ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/demo/EmptyState'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatNumero } from '@/lib/formato-numero'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
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
  otAbierta,
  type Prioridad,
  type EstOT,
} from '@/lib/data/client'
import { TIPO_OT_LABEL, tiposOtPara } from '@/lib/tipos-ot'
import type { TipoOT } from '@/lib/data/types'

// Las etiquetas y la aplicabilidad por tipo de pantalla viven en
// @/lib/tipos-ot, que es lo que el servidor aplica al crear la OT. Estaban
// duplicadas aquí y en `ot-repo`, diciendo la misma regla de dos formas
// distintas — y el catálogo de Configuración decía una tercera cosa (M15).

function esSitioDigital(s?: { tipoMedio?: string; esRotativo?: boolean; exhibicion?: string } | null): boolean {
  if (!s) return false
  return s.tipoMedio === 'PANTALLA_DIGITAL' || !!s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
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

// Filas a la vista antes de «Ver todas (N)» (patrón del Dashboard): con 114 OT
// la lista medía casi 20 000 px de alto.
const OT_A_LA_VISTA = 25

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
  const [verTodas, setVerTodas] = useState(false)

  const lista = (ots ?? []).filter((o) => !filtro || o.estatus === filtro)
  const vencidas = (ots ?? []).filter((o) => estadoSLAOT(o) === 'VENCIDA')
  const porVencer = (ots ?? []).filter((o) => estadoSLAOT(o) === 'POR_VENCER')
  const abiertas = (ots ?? []).filter(otAbierta)
  const sinAsignar = abiertas.filter((o) => !o.asignadoAUserId)
  const enProceso = abiertas.filter((o) => o.estatus === 'EN_PROCESO').length
  // Conteo por estatus para los chips del filtro («Pendientes (3)», Jobber).
  const porEstatus = new Map<string, number>()
  for (const o of ots ?? []) porEstatus.set(o.estatus, (porEstatus.get(o.estatus) ?? 0) + 1)

  // Orden de PRESENTACIÓN, sobre una copia (`.filter` ya la hizo): el store
  // llega con las más viejas primero, y lo urgente quedaba enterrado bajo las
  // completadas de 2025. Primero las abiertas, por fecha compromiso ascendente
  // (lo vencido arriba; sin fecha al final de las abiertas); después las
  // cerradas, de la más reciente a la más vieja. Mismo criterio que el
  // listado de Campañas: el orden se decide en la pantalla, no en el store.
  const ordenada = lista.sort((a, b) => {
    const aa = otAbierta(a)
    const ab = otAbierta(b)
    if (aa !== ab) return aa ? -1 : 1
    if (aa) {
      if (!a.fechaProgramada || !b.fechaProgramada) {
        return a.fechaProgramada ? -1 : b.fechaProgramada ? 1 : a.folio.localeCompare(b.folio)
      }
      return a.fechaProgramada.localeCompare(b.fechaProgramada) || a.folio.localeCompare(b.folio)
    }
    const fa = a.fechaProgramada ?? a.creadoEn
    const fb = b.fechaProgramada ?? b.creadoEn
    return fb.localeCompare(fa) || b.folio.localeCompare(a.folio)
  })
  const aLaVista = verTodas ? ordenada : ordenada.slice(0, OT_A_LA_VISTA)
  const filtroLabel = FILTROS.find((f) => f.value === filtro)?.label ?? ''

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Operaciones</h1>
          <p className="mt-1 text-[13px] text-muted">Tareas de cuadrilla · seguimiento de campo</p>
        </div>
        {puedeCrear && (
          <Button variant="success" size="sm" onClick={() => setNuevaOpen(true)}>
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

      {/* Indicadores (lenguaje del Dashboard). Todo sale de `ots`, que ya está
          cargado; «Sin asignar» es la bandeja Unassigned de ServiceTitan: lo
          que no tiene responsable se ve sin buscarlo. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!ots ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Abiertas"
              value={formatNumero(abiertas.length)}
              sub={`${formatNumero(enProceso)} en proceso`}
            />
            <KPICard
              label="Vencidas"
              value={formatNumero(vencidas.length)}
              sub="frenan el candado de facturación"
              tono={vencidas.length > 0 ? 'rojo' : 'neutro'}
            />
            <KPICard
              label="Por vencer"
              value={formatNumero(porVencer.length)}
              sub="compromiso en 2 días o menos"
              tono={porVencer.length > 0 ? 'ambar' : 'neutro'}
            />
            <KPICard
              label="Sin asignar"
              value={formatNumero(sinAsignar.length)}
              sub="abiertas sin responsable"
              tono={sinAsignar.length > 0 ? 'ambar' : 'neutro'}
            />
          </>
        )}
      </div>

      {/* Banner de SLA: OT vencidas (compromiso pasado, aún abiertas) */}
      {(vencidas.length > 0 || porVencer.length > 0) && (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-md border border-transparent px-3 py-2.5 text-[13px]',
            vencidas.length > 0
              ? 'bg-error-soft text-error'
              : 'bg-warning-soft text-[#9a6700]',
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

      {/* PLEG-01 · la lista de OT se pliega entera, como las secciones de
          Arrendadores. Los filtros van DENTRO porque solo filtran esta lista;
          el aviso de SLA queda fuera, que es una alerta y no debe esconderse.
          El filtro elegido vive en la página: sobrevive al plegado. */}
      <CardColapsable
        id="operaciones.lista"
        titulo="Órdenes de trabajo"
        contentClassName="space-y-4"
        resumen={
          ots ? (
            <span className="demo-num text-[12px] text-muted">
              {lista.length} de {ots.length}
            </span>
          ) : undefined
        }
      >
      {/* Filtros, con el conteo de cada estado (mismos valores y mismo
          `setFiltro` de siempre). */}
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
            {ots && (
              <span className="demo-num ml-1 opacity-80">
                ({formatNumero(f.value ? porEstatus.get(f.value) ?? 0 : ots.length)})
              </span>
            )}
          </button>
        ))}
      </div>

      {!ots ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        // Dos vacíos distintos: con filtro lo que falla es el filtro; sin OT no
        // hay nada que filtrar y decir «ese filtro» mandaba a revisar uno vacío.
        filtro ? (
          <EmptyState
            icon={ClipboardList}
            titulo={`Ninguna OT en «${filtroLabel}»`}
            detalle="Las demás siguen en «Todas»."
            accion={<Button variant="secondary" onClick={() => setFiltro('')}>Ver todas</Button>}
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            titulo="Todavía no hay órdenes de trabajo"
            detalle="Crea la primera con «Nueva OT»: se liga a una campaña y a su pantalla."
            accion={
              puedeCrear ? (
                <Button variant="success" onClick={() => setNuevaOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nueva OT
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
        {/* Una fila densa por OT, toda ella enlace (antes, una tarjeta de
            ~170 px con un botón «Abrir OT / Ver OT» en su propia fila). La URL
            y el rastro son los mismos de siempre. */}
        <ul className="m-0 list-none divide-y divide-border p-0">
          {aLaVista.map((o) => {
            const sitio = sitios?.find((s) => s.id === o.sitioId)
            const camp = o.campanaId ? campanas?.find((c) => c.id === o.campanaId) : undefined
            const nEvid = (evidencias ?? []).filter((e) => e.otId === o.id).length
            const abierta = o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA'
            const sla = estadoSLAOT(o)
            return (
              <li key={o.id}>
                <Link
                  href={withTrail(`/operaciones/ot/${o.id}`, [{ label: 'Operaciones', href: '/operaciones' }])}
                  title={abierta ? 'Abrir OT' : 'Ver OT'}
                  className="-mx-2 flex flex-col gap-1.5 rounded px-2 py-2.5 hover:bg-surface-2 md:flex-row md:items-center md:justify-between md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{TIPO_OT_LABEL[o.tipo]}</div>
                    <div className="demo-num truncate text-[11px] text-muted">
                      {[o.folio, sitio?.nombre, camp?.nombre].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">
                    {/* La prioridad solo cuando pide atención: «Normal» 114
                        veces no dice nada. */}
                    {(o.prioridad === 'ALTA' || o.prioridad === 'URGENTE') && (
                      <span
                        className={cn(
                          'rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium',
                          PRIORIDAD_TONO[o.prioridad] === 'rojo' ? 'bg-error-soft text-error' : 'bg-warning-soft text-[#9a6700]',
                        )}
                      >
                        {PRIORIDAD_LABEL[o.prioridad]}
                      </span>
                    )}
                    {o.fechaProgramada && (
                      <span
                        className={cn(
                          'demo-num inline-flex items-center gap-1 text-[12px]',
                          sla === 'VENCIDA' ? 'font-medium text-error' : 'text-muted',
                        )}
                        title="Fecha compromiso"
                      >
                        <Calendar className="h-3.5 w-3.5" /> {formatFecha(o.fechaProgramada)}
                      </span>
                    )}
                    {sla === 'VENCIDA' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error">
                        <AlertTriangle className="h-3 w-3" /> Vencida
                      </span>
                    )}
                    {sla === 'POR_VENCER' && (
                      <span className="rounded-full border border-transparent bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-[#9a6700]">
                        Por vencer
                      </span>
                    )}
                    <StatusBadge tono={OT_TONO[o.estatus]}>{OT_LABEL[o.estatus]}</StatusBadge>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <User className="h-3.5 w-3.5" /> {nombreAsignado(o.asignadoAUserId)}
                    </span>
                    {nEvid > 0 && (
                      <span
                        className="demo-num inline-flex items-center gap-1 text-[12px] text-muted"
                        title={`${nEvid} evidencia${nEvid === 1 ? '' : 's'}`}
                      >
                        <Camera className="h-3.5 w-3.5" /> {nEvid}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
        {ordenada.length > OT_A_LA_VISTA && (
          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="bg-transparent text-[12px] font-medium text-info hover:underline"
          >
            {verTodas ? 'Ver menos' : `Ver todas (${ordenada.length})`}
          </button>
        )}
        </>
      )}
      </CardColapsable>
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
  // Hoy por omisión (pedido del 08/10): casi toda OT se programa para el día en
  // que se captura, y en blanco el botón de crear quedaba apagado sin decir por qué.
  const [fechaProg, setFechaProg] = useState(() => fechaLocalISO())
  const [asignado, setAsignado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const usuarios = useUsuarios()
  // Responsables sugeridos: usuarios ACTIVOS con rol de Operaciones o Dueño. La
  // lista llega de /api/estado desde el 08/10; antes venía vacía y este selector
  // solo ofrecía «Sin asignar».
  const responsables = (usuarios ?? []).filter((u) => u.activo && (u.rol === 'OPERACIONES' || u.rol === 'DUENO'))
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
  const tiposDisponibles = tiposOtPara(digital)

  // Si el tipo elegido deja de ser válido al cambiar de pantalla, cae al primero
  // disponible (p. ej. de "Montaje de lona" a "Montaje digital" en una digital).
  useEffect(() => {
    if (!tiposDisponibles.includes(tipo)) setTipo(tiposDisponibles[0])
  }, [tiposDisponibles, tipo])

  // OBLIG-01 · los tres que exige el servidor (`ot-controller.ts:13-17`). El
  // tipo nunca llega vacío (el selector no tiene opción en blanco), pero es
  // obligatorio y lleva su asterisco.
  const ob = useObligatorios(
    { tipo, descripcion, fechaProg },
    ['tipo', 'descripcion', 'fechaProg'],
  )

  async function crear() {
    if (!ob.validar()) return
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
      ob.reiniciar()
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
          <Button variant="success" size="sm" disabled={enviando} onClick={crear}>
            {enviando ? 'Creando…' : 'Crear OT'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 1) Primero la campaña y su pantalla: de ahí depende qué tareas se pueden elegir. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Campaña">
            <select className={sel} value={campanaId} onChange={(e) => onCampana(e.target.value)}>
              <option value="">— Sin campaña —</option>
              {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo
            label={
              <>
                Pantalla
                {campanaId && <span className="ml-1.5 text-[10px] font-normal text-muted">(auto por campaña)</span>}
              </>
            }
          >
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
          </Campo>
        </div>
        {/* 2) Tipo de tarea, ya filtrado por el tipo de pantalla. */}
        <Campo
          label={
            <>
              Tipo de tarea
              {sitioId && (
                <span className="ml-1.5 text-[10px] font-normal text-muted">
                  (opciones de pantalla {digital ? 'digital' : 'fija'})
                </span>
              )}
            </>
          }
          obligatorio
          falta={ob.falta('tipo')}
        >
          <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOT)}>
            {tiposDisponibles.map((k) => <option key={k} value={k}>{TIPO_OT_LABEL[k]}</option>)}
          </select>
        </Campo>
        <Campo label="Descripción" obligatorio falta={ob.falta('descripcion')}>
          <textarea
            className="min-h-[70px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="p. ej. Montaje de lona en espectacular…"
          />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Prioridad">
            <select className={sel} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
              {Object.entries(PRIORIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha compromiso" obligatorio falta={ob.falta('fechaProg')}>
            <input type="date" className={sel} value={fechaProg} onChange={(e) => setFechaProg(e.target.value)} />
          </Campo>
        </div>
        <Campo label="Asignar a (responsable)">
          <select className={sel} value={asignado} onChange={(e) => setAsignado(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {responsables.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </Campo>
      </div>
    </Modal>
  )
}
