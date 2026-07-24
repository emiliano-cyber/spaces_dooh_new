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
  Route,
  Repeat,
  Monitor,
  Clock,
  Network,
  Share2,
  Pencil,
  Trash2,
  Gavel,
  Undo2,
  ArrowLeftRight,
  UserRound,
  Wallet,
  CalendarClock,
} from 'lucide-react'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { FotoUploaderMock } from '@/components/demo/FotoUploaderMock'
import { CalendarioDisponibilidad } from '@/components/demo/CalendarioDisponibilidad'
import { SpaceEyeVision } from '@/components/demo/comercial/SpaceEyeVision'
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
import { actualizarSitioApi, borrarSitioApi, pausarSitioLegalApi, reanudarSitioLegalApi, reubicarSitioApi } from '@/lib/data/sitios-api'
import {
  useReservas,
  useIncidencias,
  useContratos,
  useArrendadores,
  usePagosRenta,
  usePredios,
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
  // Pausa legal: acción del dominio Arrendadores (situaciones legales).
  const puedePausar = usePuede('arrendadores', 'crear')
  const [fotos, setFotos] = useState<FotoMeta[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [pausaOpen, setPausaOpen] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const [pausando, setPausando] = useState(false)
  const predios = usePredios()
  const [reubicarOpen, setReubicarOpen] = useState(false)
  const [predioDestino, setPredioDestino] = useState('')
  const [reubicando, setReubicando] = useState(false)

  async function reubicar() {
    if (!sitio || !predioDestino) return
    setReubicando(true)
    try {
      const { otFolio } = await reubicarSitioApi(sitio.id, predioDestino)
      toast.success(otFolio ? `Pantalla reubicada · OT ${otFolio} generada` : 'Pantalla reubicada')
      setReubicarOpen(false)
      setPredioDestino('')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reubicar')
    }
    setReubicando(false)
  }

  async function pausar() {
    if (!sitio || !motivoPausa.trim()) return
    setPausando(true)
    try {
      await pausarSitioLegalApi(sitio.id, motivoPausa.trim())
      setPausaOpen(false)
      setMotivoPausa('')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo pausar')
    }
    setPausando(false)
  }
  async function reanudar() {
    if (!sitio) return
    if (!window.confirm(`¿Reanudar "${sitio.nombre}"? Volverá a estar disponible comercialmente.`)) return
    try {
      await reanudarSitioLegalApi(sitio.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reanudar')
    }
  }

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

  // Contrato del que sale la renta: el del PREDIO de la pantalla (varias pantallas
  // comparten el predio y su contrato). Los contratos antiguos, anteriores al
  // predio, se siguen encontrando por sitioId. Preferentemente el vigente; si no,
  // el más reciente.
  const PRIORIDAD_CONTRATO: Record<string, number> = { VIGENTE: 0, POR_VENCER: 1, RENOVADO: 2, VENCIDO: 3, CANCELADO: 4 }
  const contrato = (contratos ?? [])
    .filter((c) => (sitio.predioId ? c.predioId === sitio.predioId : c.sitioId === sitio.id))
    .sort((a, b) => (PRIORIDAD_CONTRATO[a.estatus] ?? 9) - (PRIORIDAD_CONTRATO[b.estatus] ?? 9))[0]
  const propietario = arrendadores?.find((a) => a.id === contrato?.arrendadorId)
  const propietarioDirecto = sitio.arrendadorId
    ? arrendadores?.find((a) => a.id === sitio.arrendadorId)
    : undefined
  const propietarioEfectivo = propietarioDirecto ?? propietario
  // La renta sale SOLO del contrato: los campos directos del sitio están
  // deprecados (Fase 1.7) y ya no se leen.
  const rentaEfectiva = contrato?.montoRenta ?? null
  const periodicidadEfectiva = contrato?.periodicidad ?? null
  const tienePropRenta = !!propietarioEfectivo || rentaEfectiva != null || !!contrato
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
        {(puedeEditar || puedePausar) && (
          <div className="flex flex-wrap gap-2">
            {puedeEditar && (
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {puedeEditar && (
              <Button size="sm" variant="danger" disabled={borrando} onClick={eliminar}>
                <Trash2 className="h-3.5 w-3.5" /> {borrando ? 'Eliminando…' : 'Eliminar'}
              </Button>
            )}
            {puedePausar && !sitio.pausaLegal && (
              <Button size="sm" variant="secondary" onClick={() => setPausaOpen(true)}>
                <Gavel className="h-3.5 w-3.5" /> Pausar por situación legal
              </Button>
            )}
            {puedePausar && (
              <Button size="sm" variant="secondary" onClick={() => setReubicarOpen(true)}>
                <ArrowLeftRight className="h-3.5 w-3.5" /> Reubicar
              </Button>
            )}
          </div>
        )}

        {/* Pausa legal activa */}
        {sitio.pausaLegal && (
          <div className="flex gap-2.5 rounded-md border border-[#ef444440] bg-[#ef44440d] p-3">
            <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink">Pausada por situación legal</div>
              <p className="mt-0.5 text-[12px] text-muted">
                {sitio.motivoPausaLegal}
                {sitio.pausaLegalEn ? ` · desde ${formatFecha(sitio.pausaLegalEn)}` : ''}
              </p>
              <p className="text-[11px] text-muted">No disponible comercialmente mientras esté en pausa.</p>
            </div>
            {puedePausar && (
              <Button size="sm" variant="secondary" onClick={reanudar}>
                <Undo2 className="h-3.5 w-3.5" /> Reanudar
              </Button>
            )}
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
            {/* Vista = hacia dónde ve la pantalla (dirección cardinal). Reemplaza
                a "Orientación", que se retiró. */}
            <Caracteristica icon={<Compass className="h-4 w-4" />} label="Vista" valor={sitio.vista || '—'} />
            <Caracteristica icon={<Route className="h-4 w-4" />} label="Tramo" valor={sitio.tramo} />
            <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Exhibición" valor={`${sitio.exhibicion}${sitio.esRotativo ? ' · rotativo' : ''}`} />
            <Caracteristica icon={<Lightbulb className="h-4 w-4" />} label="Iluminado" valor={sitio.iluminado ? 'Sí' : 'No'} />
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

        {/* Inteligencia artificial — cámara real de Space Eye (reemplaza la
            imagen de demostración). Se sincroniza por codigo_proveedor. */}
        <SpaceEyeVision sitioId={sitio.id} sitioNombre={sitio.nombre} />

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
          <h4 className="mb-2 text-[13px] font-medium text-ink">Arrendatario y renta</h4>
          {tienePropRenta ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{propietarioEfectivo?.nombre ?? 'Arrendatario sin asignar'}</div>
                  <div className="text-[11px] text-muted">
                    {[propietarioEfectivo?.telefono, propietarioEfectivo?.email].filter(Boolean).join(' · ') || 'Dueño del predio / pantalla'}
                  </div>
                </div>
                {contrato && (
                  <StatusBadge tono={CONTRATO_TONO[contrato.estatus]} className="ml-auto shrink-0">
                    {CONTRATO_LABEL[contrato.estatus]}
                  </StatusBadge>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                <Caracteristica icon={<Wallet className="h-4 w-4" />} label="Renta" valor={rentaEfectiva != null ? formatMonto(rentaEfectiva) : '—'} mono />
                <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Cada cuándo se paga" valor={periodicidadEfectiva ? periodicidadLabel(periodicidadEfectiva) : '—'} />
                {contrato && (
                  <Caracteristica icon={<CalendarClock className="h-4 w-4" />} label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${formatFecha(contrato.fechaFin)}`} mono />
                )}
                {contrato && (
                  <Caracteristica icon={<Repeat className="h-4 w-4" />} label="Renovación" valor={contrato.autoRenovable ? 'Automática' : 'Manual'} />
                )}
              </dl>

              {/* Estado de pagos (solo si hay contrato con calendario de pagos) */}
              {contrato && (
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
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted">Sin arrendatario ni renta registrados para este espacio.</p>
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
        open={pausaOpen}
        onOpenChange={(v) => { if (!v) { setPausaOpen(false); setMotivoPausa('') } }}
        title="Pausar por situación legal"
        subtitle={sitio.nombre}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setPausaOpen(false); setMotivoPausa('') }}>Cancelar</Button>
            <Button variant="danger" size="sm" disabled={pausando || !motivoPausa.trim()} onClick={pausar}>
              {pausando ? 'Pausando…' : 'Pausar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-[12px] text-muted">
            La pantalla saldrá de la disponibilidad comercial (queda bloqueada) hasta que la reanudes.
          </p>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Motivo</span>
            <textarea
              value={motivoPausa}
              onChange={(e) => setMotivoPausa(e.target.value)}
              rows={3}
              placeholder="Ej. Litigio del predio, permiso suspendido, orden de autoridad…"
              className={inputCls}
              autoFocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={reubicarOpen}
        onOpenChange={(v) => { if (!v) { setReubicarOpen(false); setPredioDestino('') } }}
        title="Reubicar pantalla"
        subtitle={sitio.nombre}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setReubicarOpen(false); setPredioDestino('') }}>Cancelar</Button>
            <Button size="sm" disabled={reubicando || !predioDestino} onClick={reubicar}>
              {reubicando ? 'Reubicando…' : 'Reubicar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-[12px] text-muted">
            Mueve la pantalla a otro predio. Se generará una OT de reubicación en Operaciones.
          </p>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Predio destino</span>
            <select value={predioDestino} onChange={(e) => setPredioDestino(e.target.value)} className={inputCls}>
              <option value="">— Elige el predio —</option>
              {(predios ?? [])
                .filter((p) => p.id !== sitio.predioId)
                .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        </div>
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
// Vista = dirección cardinal hacia la que apunta la pantalla (reemplaza a
// "Orientación"). Los ocho rumbos de la rosa de los vientos.
const VISTAS_CARDINALES = [
  'Norte', 'Sur', 'Este', 'Oeste', 'Noreste', 'Noroeste', 'Sureste', 'Suroeste',
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
  const arrendadores = useArrendadores()
  const [nombre, setNombre] = useState(sitio.nombre)
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>(sitio.tipoMedio)
  const [alcaldia, setAlcaldia] = useState(sitio.alcaldia ?? '')
  const [direccionComercial, setDireccionComercial] = useState(sitio.direccionComercial ?? '')
  const [tarifa, setTarifa] = useState(String(sitio.tarifaPublicada ?? 0))
  const [costoCompra, setCostoCompra] = useState(String(sitio.costoCompra ?? 0))
  const [estatusComercial, setEstatusComercial] = useState(sitio.estatusComercial)
  const [vista, setVista] = useState(sitio.vista ?? '')
  const [arrendadorSel, setArrendadorSel] = useState(sitio.arrendadorId ?? '')
  const [slots, setSlots] = useState(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
  const [duracionSlot, setDuracionSlot] = useState(sitio.duracionSpotSeg != null ? String(sitio.duracionSpotSeg) : '')
  const [notas, setNotas] = useState(sitio.notas ?? '')
  // Detalles técnicos (características físicas + specs DOOH). Editables con las
  // mismas restricciones: permiso comercial/crear; la renta sigue fuera (contrato).
  const [ancho, setAncho] = useState(sitio.ancho != null ? String(sitio.ancho) : '')
  const [alto, setAlto] = useState(sitio.alto != null ? String(sitio.alto) : '')
  const [caras, setCaras] = useState(sitio.caras != null ? String(sitio.caras) : '')
  const [tipoEstructura, setTipoEstructura] = useState(sitio.tipoEstructura ?? '')
  const [tramo, setTramo] = useState(sitio.tramo ?? '')
  const [iluminado, setIluminado] = useState(sitio.iluminado)
  const [resolucionPx, setResolucionPx] = useState(sitio.resolucionPx ?? '')
  const [tipoContenido, setTipoContenido] = useState<string>(sitio.tipoContenido ?? '')
  const [spotsPorHora, setSpotsPorHora] = useState(sitio.spotsPorHora != null ? String(sitio.spotsPorHora) : '')
  const [horario, setHorario] = useState(sitio.horario ?? '')
  const [cms, setCms] = useState<string>(sitio.cms ?? '')
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
    setVista(sitio.vista ?? '')
    setArrendadorSel(sitio.arrendadorId ?? '')
    setSlots(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
    setDuracionSlot(sitio.duracionSpotSeg != null ? String(sitio.duracionSpotSeg) : '')
    setNotas(sitio.notas ?? '')
    setAncho(sitio.ancho != null ? String(sitio.ancho) : '')
    setAlto(sitio.alto != null ? String(sitio.alto) : '')
    setCaras(sitio.caras != null ? String(sitio.caras) : '')
    setTipoEstructura(sitio.tipoEstructura ?? '')
    setTramo(sitio.tramo ?? '')
    setIluminado(sitio.iluminado)
    setResolucionPx(sitio.resolucionPx ?? '')
    setTipoContenido(sitio.tipoContenido ?? '')
    setSpotsPorHora(sitio.spotsPorHora != null ? String(sitio.spotsPorHora) : '')
    setHorario(sitio.horario ?? '')
    setCms(sitio.cms ?? '')
  }, [sitio.id, open])

  async function guardar() {
    setEnviando(true)
    try {
      // Se manda SOLO lo que cambió (diff). Así, editar un detalle no financiero
      // no arrastra los campos de dinero y no dispara el candado del Dueño (que
      // solo aplica a tarifa/costo/arrendador). Restricciones intactas.
      const cambios: Record<string, unknown> = {}

      // Identidad / ubicación / estado
      if (nombre.trim() !== sitio.nombre) cambios.nombre = nombre.trim()
      if (tipoMedio !== sitio.tipoMedio) cambios.tipoMedio = tipoMedio
      if (alcaldia.trim() !== (sitio.alcaldia ?? '')) cambios.alcaldia = alcaldia.trim()
      if (direccionComercial.trim() !== (sitio.direccionComercial ?? '')) cambios.direccionComercial = direccionComercial.trim()
      if (estatusComercial !== sitio.estatusComercial) cambios.estatusComercial = estatusComercial
      if ((vista || null) !== (sitio.vista || null)) cambios.vista = vista || null
      if ((notas.trim() || null) !== (sitio.notas ?? null)) cambios.notas = notas.trim() || null

      // Características físicas
      const anchoNum = ancho.trim() === '' ? null : Number(ancho)
      if (anchoNum !== (sitio.ancho ?? null)) cambios.ancho = anchoNum
      const altoNum = alto.trim() === '' ? null : Number(alto)
      if (altoNum !== (sitio.alto ?? null)) cambios.alto = altoNum
      if (caras.trim() !== '') {
        const carasNum = Math.max(0, Math.round(Number(caras) || 0))
        if (carasNum !== sitio.caras) cambios.caras = carasNum
      }
      if (tipoEstructura.trim() !== (sitio.tipoEstructura ?? '')) cambios.tipoEstructura = tipoEstructura.trim()
      if (tramo.trim() !== (sitio.tramo ?? '')) cambios.tramo = tramo.trim()
      if (iluminado !== sitio.iluminado) cambios.iluminado = iluminado

      // Dinero (dispara el desbloqueo del Dueño): solo si de verdad cambió.
      const tarifaNum = Number(tarifa) || 0
      if (tarifaNum !== sitio.tarifaPublicada) {
        // Publicada y mensual sincronizadas (igual que en el alta).
        cambios.tarifaPublicada = tarifaNum
        cambios.tarifaMensual = tarifaNum
      }
      const costoNum = Number(costoCompra) || 0
      if (costoNum !== sitio.costoCompra) cambios.costoCompra = costoNum
      // Propietario/arrendador. La renta NO se edita aquí (vive en el contrato).
      if ((arrendadorSel || null) !== (sitio.arrendadorId ?? null)) cambios.arrendadorId = arrendadorSel || null

      // Specs DOOH (solo digitales)
      if (digital) {
        if (slots.trim() !== '') {
          const nuevoTotal = Math.max(0, Math.round(Number(slots) || 0))
          if (nuevoTotal !== (sitio.totalSpots ?? null)) {
            // Ajusta los disponibles conservando los ya reservados.
            const reservados = Math.max(0, (sitio.totalSpots ?? 0) - (sitio.spotsDisponibles ?? 0))
            cambios.totalSpots = nuevoTotal
            cambios.spotsDisponibles = Math.max(0, nuevoTotal - reservados)
          }
        }
        if (duracionSlot.trim() !== '') {
          const dur = Math.max(0, Math.round(Number(duracionSlot) || 0))
          if (dur > 0 && dur !== (sitio.duracionSpotSeg ?? null)) cambios.duracionSpotSeg = dur
        }
        if ((resolucionPx.trim() || null) !== (sitio.resolucionPx ?? null)) cambios.resolucionPx = resolucionPx.trim() || null
        if ((tipoContenido || null) !== (sitio.tipoContenido ?? null)) cambios.tipoContenido = tipoContenido || null
        if (spotsPorHora.trim() !== '') {
          const sph = Math.max(0, Math.round(Number(spotsPorHora) || 0))
          if (sph !== (sitio.spotsPorHora ?? null)) cambios.spotsPorHora = sph
        }
        if ((horario.trim() || null) !== (sitio.horario ?? null)) cambios.horario = horario.trim() || null
        if ((cms || null) !== (sitio.cms ?? null)) cambios.cms = cms || null
      }

      if (Object.keys(cambios).length === 0) {
        onClose()
        return
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
          <CampoEdit label="Vista (dirección)">
            <select value={vista} onChange={(e) => setVista(e.target.value)} className={inputCls}>
              <option value="">— Sin definir —</option>
              {VISTAS_CARDINALES.map((d) => <option key={d} value={d}>{d}</option>)}
              {/* Conserva un valor previo que no esté en la rosa de los vientos */}
              {vista && !VISTAS_CARDINALES.includes(vista) && <option value={vista}>{vista}</option>}
            </select>
          </CampoEdit>
        </div>
        <CampoEdit label="Distrito / alcaldía">
          <input value={alcaldia} onChange={(e) => setAlcaldia(e.target.value)} className={inputCls} />
        </CampoEdit>
        <CampoEdit label="Dirección comercial">
          <input value={direccionComercial} onChange={(e) => setDireccionComercial(e.target.value)} className={inputCls} />
        </CampoEdit>

        {/* Características físicas de la pantalla (detalles editables) */}
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 text-[12px] font-medium text-ink">Características</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <CampoEdit label="Ancho (m)">
              <input type="number" inputMode="decimal" min={0} value={ancho} onChange={(e) => setAncho(e.target.value)} className={`demo-num ${inputCls}`} />
            </CampoEdit>
            <CampoEdit label="Alto (m)">
              <input type="number" inputMode="decimal" min={0} value={alto} onChange={(e) => setAlto(e.target.value)} className={`demo-num ${inputCls}`} />
            </CampoEdit>
            <CampoEdit label="Caras">
              <input type="number" inputMode="numeric" min={0} value={caras} onChange={(e) => setCaras(e.target.value)} className={`demo-num ${inputCls}`} />
            </CampoEdit>
            <CampoEdit label="Estructura">
              <input value={tipoEstructura} onChange={(e) => setTipoEstructura(e.target.value)} placeholder="unipolar, mupi…" className={inputCls} />
            </CampoEdit>
            <CampoEdit label="Tramo">
              <input value={tramo} onChange={(e) => setTramo(e.target.value)} className={inputCls} />
            </CampoEdit>
            <CampoEdit label="Iluminado">
              <select value={iluminado ? 'si' : 'no'} onChange={(e) => setIluminado(e.target.value === 'si')} className={inputCls}>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </CampoEdit>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoEdit label="Tarifa publicada (mensual)">
            <input type="number" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={`demo-num ${inputCls}`} />
          </CampoEdit>
          <CampoEdit label="Costo de compra">
            <input type="number" inputMode="decimal" value={costoCompra} onChange={(e) => setCostoCompra(e.target.value)} className={`demo-num ${inputCls}`} />
          </CampoEdit>
        </div>

        {/* Propietario/arrendador de la pantalla. La RENTA no se edita aquí: vive
            en el contrato del predio (módulo Arrendadores), que es su única
            fuente para el P&L. */}
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 text-[12px] font-medium text-ink">Arrendatario</div>
          <CampoEdit label="Arrendatario">
            <select value={arrendadorSel} onChange={(e) => setArrendadorSel(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {(arrendadores ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </CampoEdit>
          <p className="mt-2 text-[11px] text-muted">
            La renta y su periodicidad se editan en el contrato del predio, en el módulo de Arrendadores.
          </p>
        </div>
        {digital && (
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-2 text-[12px] font-medium text-ink">Especificaciones DOOH</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoEdit label="Cantidad de slots">
                <input type="number" inputMode="numeric" min={0} value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="Ej. 12" className={`demo-num ${inputCls}`} />
              </CampoEdit>
              <CampoEdit label="Duración por slot (s)">
                <input type="number" inputMode="numeric" min={0} value={duracionSlot} onChange={(e) => setDuracionSlot(e.target.value)} placeholder="Ej. 20" className={`demo-num ${inputCls}`} />
              </CampoEdit>
              <CampoEdit label="Slots por hora">
                <input type="number" inputMode="numeric" min={0} value={spotsPorHora} onChange={(e) => setSpotsPorHora(e.target.value)} placeholder="Ej. 180" className={`demo-num ${inputCls}`} />
              </CampoEdit>
              <CampoEdit label="Resolución (px)">
                <input value={resolucionPx} onChange={(e) => setResolucionPx(e.target.value)} placeholder="1920x1080" className={inputCls} />
              </CampoEdit>
              <CampoEdit label="Contenido">
                <select value={tipoContenido} onChange={(e) => setTipoContenido(e.target.value)} className={inputCls}>
                  <option value="">— Sin definir —</option>
                  <option value="VIDEO">Video</option>
                  <option value="IMAGEN">Imagen</option>
                </select>
              </CampoEdit>
              <CampoEdit label="CMS">
                <select value={cms} onChange={(e) => setCms(e.target.value)} className={inputCls}>
                  <option value="">— Sin definir —</option>
                  {Object.entries(CMS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </CampoEdit>
              <CampoEdit label="Horario">
                <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ej. 06:00–24:00" className={inputCls} />
              </CampoEdit>
            </div>
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
