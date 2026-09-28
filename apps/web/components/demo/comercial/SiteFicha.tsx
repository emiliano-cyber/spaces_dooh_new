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
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
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
import { actualizarSitioApi, actualizarModalidadesApi, borrarSitioApi, pausarSitioLegalApi, reanudarSitioLegalApi, reubicarSitioApi } from '@/lib/data/sitios-api'
import { useCandado, PasoContrasena } from '@/components/demo/ui/candado'
import { RejillaDialog } from '@/components/demo/rejilla/RejillaDialog'
// Las mismas reglas que aplica el importador y que impone el servidor: qué
// unidades existen y cuáles admite esta pantalla. Se importan en vez de
// repetirse — dos copias de la misma regla divergen (ver `lib/modalidades.ts`).
import { UNIDADES_VENTA, motivoModalidadInvalida } from '@/lib/modalidades'
import {
  useReservas,
  useIncidencias,
  useContratos,
  useArrendadores,
  usePagosRenta,
  usePredios,
  useMargenPorSitio,
  useConfigNegocio,
  formatMonto,
  formatFecha,
  type Sitio,
  type TipoMedio,
} from '@/lib/data/client'
import type { FotoMeta } from '@/lib/data/types'
import { periodicidadLabel } from '@/lib/renta-periodicidad'
import { ubicacion } from '@/lib/ubicacion'
import { etiquetaTipoMedio, TIPO_MEDIO_LABEL } from '@/lib/tipo-medio'

const CMS_LABEL: Record<string, string> = {
  BROADSIGN: 'Broadsign',
  INVIDIS: 'Invidis',
  DOOHMAIN: 'Doohmain',
  OTRO: 'Otros',
}

// Periodicidad de pago al propietario ("cada cuándo se le paga"): la tabla de
// etiquetas vive en lib/renta-periodicidad.ts, junto al enum que las define.

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
  // Costo del espacio para la ficha: la MISMA renta atribuida que usa el P&L,
  // no un `costoCompra` propio (ADR 0006).
  const margenes = useMargenPorSitio()
  // `undefined` = todavía no monta el cliente, que NO es lo mismo que "no hay
  // contrato". Sin distinguirlos, la ficha afirmaba «Sin contrato activo» durante
  // la hidratación y se corregía sola un instante después: un dato falso.
  const cargandoMargen = margenes === undefined
  const margenSitio = sitio ? margenes?.find((m) => m.sitioId === sitio.id) : undefined
  const rentaMensual = margenSitio?.rentaMensual ?? 0
  const puedeEditar = usePuede('comercial', 'crear')
  // Las tarifas por unidad se guardan con `inventario.crear`, NO con
  // `comercial.crear` — es el permiso que exige `PATCH
  // /api/sitios/:id/modalidades`, igual que el resto de la escritura de
  // inventario desde el ADR 0010 («vender no debería implicar poder
  // reestructurar el activo que se vende»). Se pregunta por el permiso REAL del
  // endpoint y no por el de la ficha: enseñar el botón a quien va a comerse un
  // 403 es el encierro que este repositorio ya documentó dos veces.
  const puedeTocarInventario = usePuede('inventario', 'crear')
  // Pausa legal: acción del dominio Arrendadores (situaciones legales).
  const puedePausar = usePuede('arrendadores', 'crear')
  const modalidades = sitio?.modalidadesDetalle ?? []
  const [fotos, setFotos] = useState<FotoMeta[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [modalidadesOpen, setModalidadesOpen] = useState(false)
  // REJILLA-01 · el cuadro de tarifas por franja y temporada (ADR 0039, Fase 1).
  const [rejillaOpen, setRejillaOpen] = useState(false)
  // Cuántas combinaciones tiene capturadas esta pantalla. Vacía es lo normal, y
  // la tarjeta lo dice con esas palabras para que no parezca un dato que falta.
  const rejillaFilas = (sitio?.rejilla ?? []).length
  const [borrando, setBorrando] = useState(false)
  const [borrarOpen, setBorrarOpen] = useState(false)
  const [pausaOpen, setPausaOpen] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const [pausando, setPausando] = useState(false)
  const predios = usePredios()
  const [reubicarOpen, setReubicarOpen] = useState(false)
  const [predioDestino, setPredioDestino] = useState('')
  const [reubicando, setReubicando] = useState(false)
  // B38 · `DELETE /api/sitios/:id` exige desbloqueo SIEMPRE
  // (`app/api/sitios/[id]/route.ts:47-48`). Y era peor de lo que parecía: el
  // `toast.error` que hay escrito abajo NO se disparaba nunca, porque
  // `borrarSitioApi` ni miraba `r.ok` y el 403 no llegaba al `catch`. El
  // resultado era un botón «Eliminar» que cerraba el cuadro y dejaba la pantalla
  // donde estaba, sin decir nada. La contraseña se pide DENTRO del
  // `ConfirmDialog`, que ya es el cuadro donde se confirma.
  const candado = useCandado()

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
    setBorrando(true)
    const r = await candado.ejecutar({
      guardar: () => borrarSitioApi(sitio.id),
      alLograr: () => onOpenChange(false),
      alFallar: (m) => toast.error(m),
      mensajeSiFalla: 'No se pudo eliminar la pantalla',
    })
    setBorrando(false)
    // El cuadro de confirmar se queda ABIERTO si el servidor pidió la
    // contraseña: es donde vive el campo. Cerrarlo dejaría la clave pedida y
    // ningún sitio donde teclearla, que es el defecto de B38 otra vez.
    if (r?.estado !== 'pedir-contrasena') setBorrarOpen(false)
  }

  // La galería se PIDE al abrir la ficha; ya no viene en el store. Las fotos
  // son data URLs base64 y viajaban en `/api/estado` —1.0 MB en doce pantallas,
  // por duplicado— para pintar tablas y un mapa que no enseñan ninguna. Aquí es
  // donde de verdad se ven, así que aquí se cargan.
  //
  // El `cancelado` no es ceremonia: cambiar de pantalla rápido lanza dos
  // peticiones y la primera puede volver después, pisando la galería de la
  // segunda con la de la anterior.
  useEffect(() => {
    setFotos([])
    if (!sitio?.id || !sitio.tieneFotos) return
    let cancelado = false
    ;(async () => {
      try {
        const r = await fetch(`/spaces-dooh/api/sitios/${sitio.id}/media/`)
        if (!r.ok || cancelado) return
        const d = (await r.json()) as { fotos?: string[] }
        if (cancelado) return
        setFotos((d.fotos ?? []).map((url) => ({ url, tomadaEn: '', subidaEn: '' })))
      } catch {
        // Sin galería se sigue viendo la ficha entera: el resto de la
        // información no depende de las fotos, y un error aquí no debe dejar la
        // pantalla en blanco.
      }
    })()
    return () => {
      cancelado = true
    }
  }, [sitio?.id, sitio?.tieneFotos])

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
      subtitle={ubicacion([sitio.claveInterna, ubicacion([sitio.alcaldia, sitio.ciudad])], ' · ')}
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
            {/* B7: «Eliminar» era un botón rojo sólido al lado de «Editar», con el
                mismo peso visual que la acción más inocua de la ficha. Borrar una
                pantalla no se deshace, así que se separa del grupo (`ml-auto`) y
                baja a discreto: el rojo se reserva para el texto, no para un
                bloque que atrae el clic. La confirmación es tipada. */}
            {puedeEditar && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-error hover:bg-error-soft"
                disabled={borrando}
                onClick={() => setBorrarOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {borrando ? 'Eliminando…' : 'Eliminar'}
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
            <Caracteristica icon={<MapPin className="h-4 w-4" />} label="Tipo" valor={etiquetaTipoMedio(sitio.tipoMedio)} />
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
            {/* El costo es la renta ATRIBUIDA a esta pantalla, la misma cifra que
                usa el P&L (`rentaAtribuidaPorSitio`, vía useMargenPorSitio). Antes
                aquí se restaba `costoCompra`, que nadie más usaba: la ficha y el
                P&L mostraban dos márgenes distintos del mismo espacio (ADR 0006). */}
            <DatoComercial
              label="Renta al arrendador (mensual)"
              valor={
                cargandoMargen ? '—' : margenSitio?.tieneContrato ? formatMonto(rentaMensual) : 'Sin contrato activo'
              }
            />
            {(() => {
              if (cargandoMargen) return null
              if (!margenSitio?.tieneContrato) {
                return (
                  <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                    Sin contrato de arrendamiento activo no se puede calcular el margen: falta saber
                    qué se paga por el espacio. Complétalo en <b className="text-ink">Arrendadores</b>.
                  </div>
                )
              }
              const margen = sitio.tarifaPublicada - rentaMensual
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

          {/* Tarifas por unidad de venta (`sitio_modalidades`).
              Hasta el 2026-09-28 esto era SOLO lectura y la única forma de poner
              una tarifa de spoteo era importar un CSV. Ahora se editan aquí.
              La sección se pinta aunque no haya ninguna, para que una pantalla
              sin modalidades tenga por dónde empezar: si solo apareciera cuando
              ya hay alguna, el caso de la primera no tendría puerta. */}
          {(modalidades.length > 0 || puedeTocarInventario) && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink">
                  Tarifas por unidad {modalidades.length > 0 && `(${modalidades.length})`}
                </span>
                {puedeTocarInventario && (
                  <button
                    type="button"
                    onClick={() => setModalidadesOpen(true)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
              {modalidades.length > 0 ? (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {modalidades.map((m, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                      <span className="capitalize text-ink">{m.unidad}</span>
                      <span className="demo-num text-muted">{formatMonto(m.tarifaPublicada)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                  Sin tarifas por unidad. Se vende solo con la tarifa publicada de
                  arriba; para cotizar por spot, hora o programático hay que
                  añadirlas aquí.
                </div>
              )}
            </div>
          )}

          {/* REJILLA-01 · tarifas por FRANJA y TEMPORADA (ADR 0039, Fase 1).
              Solo se ofrece a quien puede tocar inventario, igual que el cuadro
              de arriba, y el texto de cuando está vacía dice que eso es NORMAL:
              «sin capturar» aquí no es un dato que falte, es la pantalla
              vendiéndose como se ha vendido siempre. */}
          {puedeTocarInventario && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink">
                  Tarifas por franja {rejillaFilas > 0 && `(${rejillaFilas})`}
                </span>
                <button
                  type="button"
                  onClick={() => setRejillaOpen(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              </div>
              {rejillaFilas === 0 && (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                  Sin rejilla: esta pantalla se vende con las tarifas de arriba a
                  cualquier hora y en cualquier época. Añade una solo si el prime
                  o una temporada cuestan distinto.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Propietario y renta (cada cuándo se le paga) */}
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-ink">Arrendador y renta</h4>
          {tienePropRenta ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{propietarioEfectivo?.nombre ?? 'Arrendador sin asignar'}</div>
                  <div className="text-[11px] text-muted">
                    {[propietarioEfectivo?.telefono, propietarioEfectivo?.email].filter(Boolean).join(' · ') || 'Arrendador del predio / pantalla'}
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
                  <Caracteristica icon={<CalendarClock className="h-4 w-4" />} label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${contrato.fechaFin ? formatFecha(contrato.fechaFin) : 'por definir'}`} mono />
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
                      Próximo: <span className="text-ink">{formatFecha(proximoPago.periodo)}</span>
                      <StatusBadge tono={PAGO_TONO[proximoPago.estatus]}>{PAGO_LABEL[proximoPago.estatus]}</StatusBadge>
                    </span>
                  ) : (
                    <span className="text-muted">Sin pagos pendientes</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted">Sin arrendador ni renta registrados para este espacio.</p>
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

      <ModalidadesDialog
        sitio={sitio}
        open={modalidadesOpen}
        onClose={() => setModalidadesOpen(false)}
      />

      {/* REJILLA-01 · las tarifas por franja y temporada, en su propio cuadro y
          con su propio candado. Aparte del de arriba a propósito: `sitio_
          modalidades` se PISA al reimportar y `sitio_tarifas` NUNCA se pisa en
          bloque, y un solo formulario obligaría a que un botón sirviera para las
          dos semánticas. Ver la cabecera de `RejillaDialog`. */}
      <RejillaDialog
        sitio={sitio}
        open={rejillaOpen}
        onClose={() => setRejillaOpen(false)}
      />

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

      {/* B7 · borrar una pantalla no se deshace: se escribe su nombre para
          confirmar. No es fricción por gusto — obliga a LEER cuál es, que es
          justo lo que un clic reflejo sobre un botón rojo no hace. */}
      <ConfirmDialog
        open={borrarOpen}
        onOpenChange={(v) => {
          // Cerrarlo OLVIDA lo tecleado. Si no, reabrirlo para otra pantalla
          // llegaría con la contraseña puesta de la vez anterior.
          if (!v) candado.olvidar()
          setBorrarOpen(v)
        }}
        title={`Eliminar ${sitio.nombre}`}
        confirmLabel={candado.reautenticando ? 'Confirmar y eliminar' : 'Eliminar pantalla'}
        busy={borrando || candado.enviando}
        // Confirmar REPITE el borrado pendiente en vez de armar otro: `eliminar`
        // volvería a entrar sin contraseña y chocaría otra vez con el candado.
        onConfirm={candado.reautenticando ? () => void candado.reintentar() : eliminar}
        confirmDeshabilitado={candado.reautenticando && !candado.pass}
        confirmarEscribiendo={sitio.nombre}
      >
        Se elimina la pantalla y deja de poder reservarse. Sus reservas y su historial
        quedan como estén: <span className="text-ink">esta acción no se puede deshacer</span>.
        {/* B38 · el campo va AQUÍ, dentro del cuadro que ya existía, y no en uno
            nuevo encima: lo que se confirma —el nombre tecleado y el aviso de que
            no se puede deshacer— tiene que seguir a la vista mientras se teclea
            la contraseña. */}
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
      </ConfirmDialog>
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

// ============================================================================
//  Las tarifas por UNIDAD DE VENTA de una pantalla, editables desde la ficha.
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-28 `sitio_modalidades` solo se escribía importando un
//  archivo: la ficha las ENSEÑABA y ningún formulario las mandaba. Para poner
//  una tarifa de spoteo había que preparar un CSV, que es una respuesta que no
//  se le puede dar a un dueño que pregunta «¿puedo vender por spot?».
//
//  TRES DECISIONES QUE NO SON DE ADORNO:
//
//  1 · Se manda un DIFF (`guardar` + `quitar`), no la lista entera. El servidor
//      no borra lo que no viene (`actualizarModalidades`, `sitios-repo.ts`), así
//      que mandar solo lo tocado evita que dos personas editando la misma
//      pantalla se pisen las tarifas que ninguna de las dos cambió.
//  2 · Quitar viaja como BAJA, no como tarifa en cero. Un 0 no es «ya no se
//      vende así»: es «se regala», y la pantalla seguiría ofreciéndose.
//  3 · El selector de «añadir» solo ofrece lo que esta pantalla ADMITE y no
//      tiene todavía. La regla de la pantalla fija la impone el servidor
//      (`lib/modalidades.ts`, la misma que el importador); aquí solo se evita
//      ofrecer algo que va a ser rechazado.
//
//  La contraseña va DENTRO del cuadro, que es la regla de `ui/candado.tsx`: la
//  acción tiene cuadro propio, así que no hace falta que el 403 abra otro.
// ============================================================================
function ModalidadesDialog({ sitio, open, onClose }: { sitio: Sitio; open: boolean; onClose: () => void }) {
  const previas = sitio.modalidadesDetalle ?? []
  // Las tarifas se editan como TEXTO y no como número: un `<input type=number>`
  // controlado con `Number('')` convierte un campo vacío en 0, y un 0 aquí es un
  // precio. Se convierte al construir el diff.
  const [tarifas, setTarifas] = useState<Record<string, string>>({})
  const [quitadas, setQuitadas] = useState<string[]>([])
  const [nuevas, setNuevas] = useState<{ unidad: string; tarifa: string }[]>([])
  const [porAnadir, setPorAnadir] = useState('')
  const [enviando, setEnviando] = useState(false)
  const candado = useCandado()

  // Las que esta pantalla admite: el mismo criterio que el servidor, importado
  // del módulo compartido para que no puedan divergir.
  const admitidas = (UNIDADES_VENTA as readonly string[]).filter(
    (u) => !motivoModalidadInvalida(u, sitio.exhibicion),
  )

  // Reinicia al abrir o al cambiar de pantalla: reabrir no debe traer puesto lo
  // que se tecleó y no se guardó la vez anterior.
  useEffect(() => {
    const t: Record<string, string> = {}
    for (const m of sitio.modalidadesDetalle ?? []) t[m.unidad] = String(m.tarifaPublicada ?? 0)
    setTarifas(t)
    setQuitadas([])
    setNuevas([])
    setPorAnadir('')
    candado.olvidar()
    // `candado` se recrea en cada render; meterlo en las dependencias volvería a
    // limpiar el formulario en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitio.id, open])

  // Lo que ya está puesto (o a punto de estarlo) no se vuelve a ofrecer: el
  // índice `unique (sitio_id, unidad)` lo impediría y el servidor rechaza la
  // unidad repetida, pero ofrecerla sería invitar a un error evitable.
  const yaPuestas = new Set([...previas.map((m) => m.unidad), ...nuevas.map((n) => n.unidad)])
  const disponibles = admitidas.filter((u) => !yaPuestas.has(u))

  function anadir() {
    if (!porAnadir) return
    setNuevas((n) => [...n, { unidad: porAnadir, tarifa: '' }])
    setPorAnadir('')
  }

  async function guardar() {
    setEnviando(true)
    // Bloque sin `try`: `candado.ejecutar` DEVUELVE el fallo en vez de lanzarlo
    // (lo entrega por `alFallar`). Mismo criterio que `EditarSitioDialog`.
    {
      const guardarLista: { unidad: string; tarifaPublicada: number }[] = []
      // Solo las que de verdad cambiaron: reescribir una tarifa con su mismo
      // valor deja su fila en `registrarAccion` y el historial pasaría a decir
      // que se tocó algo que nadie tocó.
      for (const m of previas) {
        if (quitadas.includes(m.unidad)) continue
        const texto = (tarifas[m.unidad] ?? '').trim()
        if (texto === '') continue
        const valor = Number(texto)
        if (!Number.isFinite(valor)) continue
        if (valor !== m.tarifaPublicada) guardarLista.push({ unidad: m.unidad, tarifaPublicada: valor })
      }
      for (const n of nuevas) {
        const valor = Number(n.tarifa.trim())
        if (!n.unidad || n.tarifa.trim() === '' || !Number.isFinite(valor)) continue
        guardarLista.push({ unidad: n.unidad, tarifaPublicada: valor })
      }

      if (!guardarLista.length && !quitadas.length) {
        onClose()
        setEnviando(false)
        return
      }
      // El diff se arma UNA vez y `useCandado` se lo queda: confirmar con la
      // contraseña repite ESTE cambio en vez de releer el formulario, que el
      // usuario pudo tocar mientras tecleaba.
      await candado.ejecutar({
        guardar: () => actualizarModalidadesApi(sitio.id, { guardar: guardarLista, quitar: quitadas }),
        alLograr: () => {
          toast.success('Tarifas por unidad guardadas')
          onClose()
        },
        alFallar: (m) => toast.error(m),
        mensajeSiFalla: 'No se pudieron guardar las tarifas',
      })
    }
    setEnviando(false)
  }

  const nuevaSinTarifa = nuevas.some((n) => n.tarifa.trim() === '' || !Number.isFinite(Number(n.tarifa)))

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          candado.olvidar()
          onClose()
        }
      }}
      title="Tarifas por unidad de venta"
      subtitle={sitio.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={candado.enviando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={
              enviando ||
              candado.enviando ||
              nuevaSinTarifa ||
              (candado.reautenticando && !candado.pass)
            }
            onClick={candado.reautenticando ? () => void candado.reintentar() : guardar}
          >
            {enviando || candado.enviando
              ? 'Guardando…'
              : candado.reautenticando
                ? 'Confirmar y guardar'
                : 'Guardar tarifas'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />

        <p className="text-[12px] text-muted">
          Una tarifa por cada forma de vender esta pantalla. Es lo que usa el
          cotizador de Propuestas: sin una tarifa de «spot» no se puede cotizar
          por spot.
          {!admitidas.includes('spot') && (
            <>
              {' '}
              Esta pantalla es <b className="text-ink">fija</b>, así que solo se
              vende por mensual o catorcenal.
            </>
          )}
        </p>

        {previas.length === 0 && nuevas.length === 0 && (
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
            Todavía no hay ninguna. Añade la primera abajo.
          </div>
        )}

        {previas.map((m) => {
          const quitada = quitadas.includes(m.unidad)
          return (
            <div key={m.unidad} className="flex items-center gap-2">
              <span className={`w-28 shrink-0 text-[13px] capitalize ${quitada ? 'text-muted line-through' : 'text-ink'}`}>
                {m.unidad}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tarifas[m.unidad] ?? ''}
                disabled={quitada}
                onChange={(e) => setTarifas((t) => ({ ...t, [m.unidad]: e.target.value }))}
                className={`${inputCls} flex-1 disabled:opacity-50`}
              />
              <button
                type="button"
                title={quitada ? 'Conservar esta unidad' : 'Dejar de vender por esta unidad'}
                onClick={() =>
                  setQuitadas((q) => (q.includes(m.unidad) ? q.filter((u) => u !== m.unidad) : [...q, m.unidad]))
                }
                className="shrink-0 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              >
                {quitada ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          )
        })}

        {nuevas.map((n, i) => (
          <div key={`nueva-${n.unidad}`} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[13px] capitalize text-ink">{n.unidad}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              placeholder="Tarifa"
              value={n.tarifa}
              onChange={(e) =>
                setNuevas((prev) => prev.map((x, j) => (j === i ? { ...x, tarifa: e.target.value } : x)))
              }
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              title="Quitar"
              onClick={() => setNuevas((prev) => prev.filter((_, j) => j !== i))}
              className="shrink-0 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {disponibles.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <select
              value={porAnadir}
              onChange={(e) => setPorAnadir(e.target.value)}
              className={`${inputCls} flex-1`}
            >
              <option value="">Añadir unidad…</option>
              {disponibles.map((u) => (
                <option key={u} value={u} className="capitalize">{u}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={anadir} disabled={!porAnadir}>
              Añadir
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

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
  const [estatusComercial, setEstatusComercial] = useState(sitio.estatusComercial)
  const [vista, setVista] = useState(sitio.vista ?? '')
  const [arrendadorSel, setArrendadorSel] = useState(sitio.arrendadorId ?? '')
  const [slots, setSlots] = useState(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
  // ADR 0008 · cupo de clientes de ESTA pantalla. Vacío = sin cupo propio, cae
  // al default global (que se muestra como placeholder para no editar a ciegas).
  const [cupoClientes, setCupoClientes] = useState(sitio.maxClientes != null ? String(sitio.maxClientes) : '')
  const cupoGlobal = useConfigNegocio()?.maxClientesPantalla ?? null
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
  // B38 · el `guardar` de abajo manda un DIFF, así que solo dispara el candado
  // cuando el diff toca tarifa, costo o arrendador (`CAMPOS_SENSIBLES` en
  // `app/api/sitios/[id]/route.ts:15-19`). Cuando lo disparaba, el 403 salía por
  // un `toast.error` —efímero— y el cuadro se quedaba abierto con todo el
  // formulario lleno y ningún sitio donde teclear la clave. El campo va DENTRO,
  // que es la regla, y el toast se queda para lo demás.
  const candado = useCandado()

  // Reinicia el formulario al abrir o cambiar de sitio.
  useEffect(() => {
    setNombre(sitio.nombre)
    setTipoMedio(sitio.tipoMedio)
    setAlcaldia(sitio.alcaldia ?? '')
    setDireccionComercial(sitio.direccionComercial ?? '')
    setTarifa(String(sitio.tarifaPublicada ?? 0))
    setEstatusComercial(sitio.estatusComercial)
    setVista(sitio.vista ?? '')
    setArrendadorSel(sitio.arrendadorId ?? '')
    setSlots(sitio.totalSpots != null ? String(sitio.totalSpots) : '')
    setCupoClientes(sitio.maxClientes != null ? String(sitio.maxClientes) : '')
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
    // Bloque sin `try`: era uno, y el `catch` se retiró porque `candado.ejecutar`
    // DEVUELVE el fallo en vez de lanzarlo (lo enseña `alFallar`). Se conserva
    // como bloque a secas para no reindentar cien líneas de diff.
    {
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
      // `costoCompra` ya NO se edita aquí (ADR 0006). Era la puerta lateral del
      // costo: se movía con permiso de Comercial y sin candado, mientras que la
      // renta —el mismo dinero— exige el candado ESTRICTO del ADR 0001. El costo
      // del espacio se cambia donde vive: el contrato de arrendamiento.
      // Propietario/arrendador. La renta NO se edita aquí (vive en el contrato).
      if ((arrendadorSel || null) !== (sitio.arrendadorId ?? null)) cambios.arrendadorId = arrendadorSel || null

      // ADR 0008 · cupo de clientes. Vacío = quitar el cupo propio (vuelve al
      // global), NO cero: un cupo de 0 dejaría la pantalla invendible, y para
      // eso ya está el estatus BLOQUEADO.
      const cupoNum = cupoClientes.trim() === '' ? null : Math.max(1, Math.round(Number(cupoClientes) || 1))
      if (cupoNum !== (sitio.maxClientes ?? null)) cambios.maxClientes = cupoNum

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
        setEnviando(false)
        return
      }
      // El diff se arma UNA vez y `useCandado` se lo queda: confirmar con la
      // contraseña repite ESTE cambio, no vuelve a leer el formulario.
      await candado.ejecutar({
        guardar: () => actualizarSitioApi(sitio.id, cambios),
        alLograr: onClose,
        alFallar: (m) => toast.error(m),
        mensajeSiFalla: 'No se pudo guardar',
      })
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          // Cerrar OLVIDA lo tecleado: reabrir la ficha no debe traer la
          // contraseña puesta de la vez anterior.
          candado.olvidar()
          onClose()
        }
      }}
      title="Editar pantalla"
      subtitle={sitio.codigoProveedor}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          {/* Confirmar REPITE el diff pendiente en vez de recalcularlo: `guardar`
              volvería a leer el formulario, que el usuario pudo tocar mientras
              tecleaba la contraseña. */}
          <Button
            size="sm"
            disabled={
              enviando ||
              candado.enviando ||
              !nombre.trim() ||
              (candado.reautenticando && !candado.pass)
            }
            onClick={candado.reautenticando ? () => void candado.reintentar() : guardar}
          >
            {enviando || candado.enviando
              ? 'Guardando…'
              : candado.reautenticando
                ? 'Confirmar y guardar'
                : 'Guardar cambios'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* B38 · el campo, dentro del cuadro que ya existía. Arriba del todo a
            propósito: el formulario es largo y el pie está lejos. */}
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
        <CampoEdit label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
        </CampoEdit>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoEdit label="Tipo de medio">
            <select value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)} className={inputCls}>
              {TIPOS.map((t) => <option key={t} value={t}>{TIPO_MEDIO_LABEL[t]}</option>)}
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

        <div className="grid grid-cols-1 gap-3">
          <CampoEdit label="Tarifa publicada (mensual)">
            <input type="number" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={`demo-num ${inputCls}`} />
          </CampoEdit>
        </div>

        {/* Propietario/arrendador de la pantalla. La RENTA no se edita aquí: vive
            en el contrato del predio (módulo Arrendadores), que es su única
            fuente para el P&L. */}
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 text-[12px] font-medium text-ink">Arrendador</div>
          <CampoEdit label="Arrendador">
            <select value={arrendadorSel} onChange={(e) => setArrendadorSel(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {(arrendadores ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </CampoEdit>
          <p className="mt-2 text-[11px] text-muted">
            La renta y su periodicidad viven en el contrato, no en la pantalla. El importe se puede
            corregir desde la tabla de Inventario; la periodicidad y la vigencia, en Arrendadores.
          </p>
        </div>
        {/* ADR 0008 · cupo de clientes. Fuera del bloque DOOH a propósito: aplica
            también a las fijas (una fija con cupo 1 no cambia de comportamiento,
            ya es exclusiva por fechas). No es capacidad técnica —eso son los
            slots— sino política comercial: cuántos anunciantes conviven. */}
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 text-[12px] font-medium text-ink">Cupo de clientes</div>
          <CampoEdit label="Máximo de clientes distintos">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={cupoClientes}
              onChange={(e) => setCupoClientes(e.target.value)}
              placeholder={cupoGlobal != null ? `Global: ${cupoGlobal}` : 'Sin límite'}
              className={`demo-num ${inputCls}`}
            />
          </CampoEdit>
          <p className="mt-2 text-[11px] text-muted">
            Cuántos anunciantes distintos pueden compartir esta pantalla a la vez. Vacío ={' '}
            {cupoGlobal != null
              ? `usa el valor global (${cupoGlobal}), que se fija en Administración.`
              : 'sin límite (no hay valor global configurado).'}{' '}
            Un cliente que ya está en la pantalla puede seguir metiendo campañas mientras queden slots.
            {sitio.clientesActivos != null && sitio.clientesActivos > 0 && (
              <> Ahora mismo tiene <span className="demo-num font-medium text-ink">{sitio.clientesActivos}</span>.</>
            )}
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
