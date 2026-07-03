'use client'

import { toast } from 'sonner'
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
  Pencil,
  Trash2,
  UserRound,
  Wallet,
  CalendarClock,
} from 'lucide-react'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { FotoUploaderMock } from '@/components/demo/FotoUploaderMock'
import { CalendarioDisponibilidad } from '@/components/demo/CalendarioDisponibilidad'
import {
  StatusBadge,
  SITIO_TONO,
  SITIO_LABEL,
  CONTRATO_TONO,
  CONTRATO_LABEL,
  PAGO_TONO,
  PAGO_LABEL,
} from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { actualizarSitioApi, borrarSitioApi } from '@/lib/data/sitios-api'
import {
  useReservas,
  useIncidencias,
  useContratos,
  useArrendadores,
  usePagosRenta,
  formatMonto,
  formatFecha,
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

// Imagen de muestra de la detección por Computer Vision (vive en /public; el
// basePath /spaces-dooh la sirve aquí). Solo se usa en el demo.
const IA_DEMO_IMG = '/spaces-dooh/demo/ia-deteccion.jpg'

const CMS_LABEL: Record<string, string> = {
  BROADSIGN: 'Broadsign',
  INVIDIS: 'Invidis',
  DOOHMAIN: 'Doohmain',
  OTRO: 'Otros',
}

// Periodicidad de pago al propietario ("cada cuándo se le paga").
const PERIODICIDAD_LABEL: Record<string, string> = {
  SEMANAL: 'Semanal',
  CATORCENAL: 'Catorcenal (cada 14 días)',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
}
const periodicidadLabel = (p: string) =>
  PERIODICIDAD_LABEL[p?.toUpperCase()] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '—')

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
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const pagos = usePagosRenta()
  const puedeEditar = usePuede('comercial', 'crear')
  const [fotos, setFotos] = useState<FotoMeta[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [verIA, setVerIA] = useState(false)

  async function eliminar() {
    if (!sitio) return
    if (!window.confirm(`¿Eliminar la pantalla "${sitio.nombre}"? Esta acción no se puede deshacer.`)) return
    setBorrando(true)
    try {
      await borrarSitioApi(sitio.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la pantalla')
    }
    setBorrando(false)
  }

  // Reinicia la galería local al cambiar de sitio. Las fotos sembradas (string)
  // se adaptan a FotoMeta sin fechas conocidas.
  useEffect(() => {
    setFotos((sitio?.fotos ?? []).map((url) => ({ url, tomadaEn: '', subidaEn: '' })))
  }, [sitio?.id])

  // Guarda la galería en el sitio (fotos como data URLs base64; la 1ª es la
  // imagen principal). Persiste al agregar o quitar una foto, así se ve después.
  async function guardarFotos(next: FotoMeta[]) {
    setFotos(next) // update optimista
    if (!sitio) return
    const urls = next.map((f) => f.url)
    try {
      await actualizarSitioApi(sitio.id, { fotos: urls, imagenPromocional: urls[0] ?? null })
      toast.success('Galería guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la imagen')
    }
  }

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

  // Propietario y renta del sitio: contrato preferentemente vigente; si no, el
  // más reciente. De ahí salen el propietario, la renta y la periodicidad de pago.
  const PRIORIDAD_CONTRATO: Record<string, number> = { VIGENTE: 0, POR_VENCER: 1, RENOVADO: 2, VENCIDO: 3, CANCELADO: 4 }
  const contrato = (contratos ?? [])
    .filter((c) => c.sitioId === sitio.id)
    .sort((a, b) => (PRIORIDAD_CONTRATO[a.estatus] ?? 9) - (PRIORIDAD_CONTRATO[b.estatus] ?? 9))[0]
  const propietario = arrendadores?.find((a) => a.id === contrato?.arrendadorId)
  const pagosContrato = (pagos ?? []).filter((p) => p.contratoId === contrato?.id)
  const ultimoPago = pagosContrato
    .filter((p) => p.fechaPago)
    .sort((a, b) => (b.fechaPago ?? '').localeCompare(a.fechaPago ?? ''))[0]
  const proximoPago = pagosContrato
    .filter((p) => p.estatus !== 'PAGADO')
    .sort((a, b) => (a.periodo ?? '').localeCompare(b.periodo ?? ''))[0]

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

        {/* Acciones de administración del sitio */}
        {puedeEditar && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button size="sm" variant="danger" disabled={borrando} onClick={eliminar}>
              <Trash2 className="h-3.5 w-3.5" /> {borrando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        )}

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
          <FotoUploaderMock fotos={fotos} onChange={guardarFotos} label="Agregar foto" />
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
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Total de slots" valor={sitio.totalSpots != null ? String(sitio.totalSpots) : '—'} mono />
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Slots disponibles" valor={sitio.spotsDisponibles != null ? String(sitio.spotsDisponibles) : '—'} mono />
              <Caracteristica icon={<Monitor className="h-4 w-4" />} label="Slots por hora" valor={sitio.spotsPorHora != null ? String(sitio.spotsPorHora) : '—'} mono />
              <Caracteristica icon={<Clock className="h-4 w-4" />} label="Duración por slot" valor={sitio.duracionSpotSeg != null ? `${sitio.duracionSpotSeg} s` : '—'} mono />
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

        {/* Inteligencia artificial (Computer Vision / AdMobilize) */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Inteligencia artificial</h4>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tono={sitio.computerVision ? 'verde' : 'rojo'}>
              {sitio.computerVision ? 'Computer Vision On' : 'Sin Computer Vision'}
            </StatusBadge>
            {sitio.computerVision && sitio.admobilizeId && (
              <span className="demo-num text-[12px] text-muted">ID {sitio.admobilizeId}</span>
            )}
          </div>
          {sitio.computerVision && (
            <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => setVerIA(true)}>
              <Eye className="h-4 w-4" /> Ver imagen de detección IA
            </Button>
          )}
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

          {/* Modalidades por fila (importadas agrupadas por código) */}
          {sitio.modalidadesDetalle && sitio.modalidadesDetalle.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[12px] font-medium text-ink">
                Modalidades ({sitio.modalidadesDetalle.length})
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {sitio.modalidadesDetalle.map((m, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                    <span className="capitalize text-ink">{m.unidad}</span>
                    <span className="demo-num text-muted">{formatMonto(m.tarifaPublicada)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Propietario y renta (cada cuándo se le paga) */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Propietario y renta</h4>
          {contrato ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{propietario?.nombre ?? 'Propietario sin asignar'}</div>
                  <div className="text-[11px] text-muted">
                    {[propietario?.telefono, propietario?.email].filter(Boolean).join(' · ') || 'Dueño del predio / pantalla'}
                  </div>
                </div>
                <StatusBadge tono={CONTRATO_TONO[contrato.estatus]} className="ml-auto shrink-0">
                  {CONTRATO_LABEL[contrato.estatus]}
                </StatusBadge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                <Caracteristica icon={<Wallet className="h-4 w-4" />} label="Renta" valor={formatMonto(contrato.montoRenta)} mono />
                <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Cada cuándo se paga" valor={periodicidadLabel(contrato.periodicidad)} />
                <Caracteristica icon={<CalendarClock className="h-4 w-4" />} label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${formatFecha(contrato.fechaFin)}`} mono />
                <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Renovación" valor={contrato.autoRenovable ? 'Automática' : 'Manual'} />
              </dl>

              {/* Estado de pagos */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[12px]">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  Último pago
                  <span className="demo-num text-ink">{ultimoPago?.fechaPago ? formatFecha(ultimoPago.fechaPago) : '—'}</span>
                </span>
                {proximoPago ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    Próximo: <span className="text-ink">{proximoPago.periodo}</span>
                    <StatusBadge tono={PAGO_TONO[proximoPago.estatus]}>{PAGO_LABEL[proximoPago.estatus]}</StatusBadge>
                  </span>
                ) : (
                  <span className="text-muted">Sin pagos pendientes</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted">Sin contrato de arrendamiento registrado para este espacio.</p>
          )}
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

      <EditarSitioDialog sitio={sitio} open={editOpen} onClose={() => setEditOpen(false)} />

      <Modal
        open={verIA}
        onOpenChange={setVerIA}
        size="xl"
        title="Detección por Computer Vision"
        subtitle={`${sitio.nombre} · conteo de vehículos y personas (AdMobilize)`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IA_DEMO_IMG}
          alt="Detección de vehículos y personas por IA"
          className="w-full rounded border border-border object-contain"
        />
        <p className="mt-2 text-[11px] text-muted">
          Las cajas y métricas (velocidad, conteo por zona) las genera el módulo de Computer Vision en tiempo real.
        </p>
      </Modal>
    </Sheet>
  )
}

const TIPOS: TipoMedio[] = [
  'ESPECTACULAR', 'PANTALLA_DIGITAL', 'PUENTE_PEATONAL', 'MOBILIARIO_URBANO', 'MURAL', 'VALLA', 'OTRO',
]
const ESTATUS: { v: string; label: string }[] = [
  { v: 'DISPONIBLE', label: 'Disponible' },
  { v: 'RESERVADO', label: 'Reservado' },
  { v: 'OCUPADO', label: 'Ocupado' },
  { v: 'BLOQUEADO', label: 'Bloqueado' },
]
const inputCls =
  'w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function EditarSitioDialog({ sitio, open, onClose }: { sitio: Sitio; open: boolean; onClose: () => void }) {
  // Una pantalla digital tiene inventario de slots editable.
  const digital =
    sitio.esRotativo ||
    sitio.exhibicion === 'digital' ||
    sitio.exhibicion === 'rotativo' ||
    sitio.tipoMedio === 'PANTALLA_DIGITAL'
  const [nombre, setNombre] = useState(sitio.nombre)
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>(sitio.tipoMedio)
  const [alcaldia, setAlcaldia] = useState(sitio.alcaldia ?? '')
  const [direccionComercial, setDireccionComercial] = useState(sitio.direccionComercial ?? '')
  const [tarifa, setTarifa] = useState(String(sitio.tarifaPublicada ?? 0))
  const [costoCompra, setCostoCompra] = useState(String(sitio.costoCompra ?? 0))
  const [estatusComercial, setEstatusComercial] = useState(sitio.estatusComercial)
  const [slots, setSlots] = useState(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
  const [duracionSlot, setDuracionSlot] = useState(sitio.duracionSpotSeg != null ? String(sitio.duracionSpotSeg) : '')
  const [notas, setNotas] = useState(sitio.notas ?? '')
  const [enviando, setEnviando] = useState(false)

  // Reinicia el formulario al abrir o cambiar de sitio.
  useEffect(() => {
    setNombre(sitio.nombre)
    setTipoMedio(sitio.tipoMedio)
    setAlcaldia(sitio.alcaldia ?? '')
    setDireccionComercial(sitio.direccionComercial ?? '')
    setTarifa(String(sitio.tarifaPublicada ?? 0))
    setCostoCompra(String(sitio.costoCompra ?? 0))
    setEstatusComercial(sitio.estatusComercial)
    setSlots(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
    setDuracionSlot(sitio.duracionSpotSeg != null ? String(sitio.duracionSpotSeg) : '')
    setNotas(sitio.notas ?? '')
  }, [sitio.id, open])

  async function guardar() {
    setEnviando(true)
    try {
      const tarifaNum = Number(tarifa) || 0
      const cambios: Record<string, unknown> = {
        nombre: nombre.trim(),
        tipoMedio,
        alcaldia: alcaldia.trim(),
        direccionComercial: direccionComercial.trim(),
        // La tarifa publicada y la mensual se mantienen sincronizadas (igual que en el alta).
        tarifaPublicada: tarifaNum,
        tarifaMensual: tarifaNum,
        costoCompra: Number(costoCompra) || 0,
        estatusComercial,
        notas: notas.trim() || null,
      }
      // Cantidad de slots (solo digitales): ajusta los disponibles conservando
      // los ya reservados (reservados = total anterior − disponibles anteriores).
      if (digital && slots.trim() !== '') {
        const nuevoTotal = Math.max(0, Math.round(Number(slots) || 0))
        const reservados = Math.max(0, (sitio.totalSpots ?? 0) - (sitio.spotsDisponibles ?? 0))
        cambios.totalSpots = nuevoTotal
        cambios.spotsDisponibles = Math.max(0, nuevoTotal - reservados)
        const dur = Math.max(0, Math.round(Number(duracionSlot) || 0))
        if (dur > 0) cambios.duracionSpotSeg = dur
      }
      await actualizarSitioApi(sitio.id, cambios)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Editar pantalla"
      subtitle={sitio.codigoProveedor}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={enviando || !nombre.trim()} onClick={guardar}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <CampoEdit label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
        </CampoEdit>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoEdit label="Tipo de medio">
            <select value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)} className={inputCls}>
              {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </CampoEdit>
          <CampoEdit label="Disponibilidad">
            <select value={estatusComercial} onChange={(e) => setEstatusComercial(e.target.value as Sitio['estatusComercial'])} className={inputCls}>
              {ESTATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </CampoEdit>
        </div>
        <CampoEdit label="Distrito / alcaldía">
          <input value={alcaldia} onChange={(e) => setAlcaldia(e.target.value)} className={inputCls} />
        </CampoEdit>
        <CampoEdit label="Dirección comercial">
          <input value={direccionComercial} onChange={(e) => setDireccionComercial(e.target.value)} className={inputCls} />
        </CampoEdit>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoEdit label="Tarifa publicada (mensual)">
            <input type="number" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={`demo-num ${inputCls}`} />
          </CampoEdit>
          <CampoEdit label="Costo de compra">
            <input type="number" inputMode="decimal" value={costoCompra} onChange={(e) => setCostoCompra(e.target.value)} className={`demo-num ${inputCls}`} />
          </CampoEdit>
        </div>
        {digital && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoEdit label="Cantidad de slots">
              <input type="number" inputMode="numeric" min={0} value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="Ej. 12" className={`demo-num ${inputCls}`} />
            </CampoEdit>
            <CampoEdit label="Duración por slot (s)">
              <input type="number" inputMode="numeric" min={0} value={duracionSlot} onChange={(e) => setDuracionSlot(e.target.value)} placeholder="Ej. 20" className={`demo-num ${inputCls}`} />
            </CampoEdit>
          </div>
        )}
        <CampoEdit label="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={inputCls} />
        </CampoEdit>
      </div>
    </Modal>
  )
}

function CampoEdit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
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
