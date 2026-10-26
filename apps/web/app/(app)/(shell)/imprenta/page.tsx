'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Ruler, Plus, ChevronRight } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { EmptyState } from '@/components/demo/EmptyState'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatNumero } from '@/lib/formato-numero'
import {
  StatusBadge,
  IMPRESION_TONO,
  IMPRESION_LABEL,
} from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearOrdenImpresionApi, avanzarOrdenImpresionApi, aprobarPruebaColorApi } from '@/lib/data/estado-api'
import {
  useOrdenesImpresion,
  useCampanas,
  useSitios,
  type EstOrdenImpresion,
} from '@/lib/data/client'

const PROCESO: EstOrdenImpresion[] = [
  'ARTE_RECIBIDO',
  'VALIDADO',
  'EN_PRODUCCION',
  'IMPRESO',
  'LISTO_MONTAJE',
]

export default function ImprentaPage() {
  const ois = useOrdenesImpresion()
  const campanas = useCampanas()
  const sitios = useSitios()
  const puedeCrear = usePuede('imprenta', 'crear')
  const puedeVerCampanas = usePuede('comercial', 'crear')

  const [nueva, setNueva] = useState(false)
  const [avanzando, setAvanzando] = useState<string | null>(null)

  // Imprenta solo aplica a campañas que imprimen: OOH (fija) e HÍBRIDA. Las
  // campañas 100% digitales (DOOH) no llevan impresión, así que sus órdenes no
  // se muestran aquí.
  const oisVisibles = (ois ?? []).filter((o) => {
    const camp = campanas?.find((c) => c.id === o.campanaId)
    return !camp || camp.tipoCampana !== 'DOOH'
  })
  // Conteos para los indicadores y la franja de reparto (solo presentación).
  const conteoPorEtapa = Object.fromEntries(
    PROCESO.map((p) => [p, oisVisibles.filter((o) => o.estatus === p).length]),
  ) as Record<EstOrdenImpresion, number>
  const pruebasPendientes = oisVisibles.filter((o) => !o.pruebaColorAprobada).length

  async function avanzar(id: string) {
    setAvanzando(id)
    try {
      await avanzarOrdenImpresionApi(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo avanzar la orden')
    }
    setAvanzando(null)
  }

  return (
    <div className="w-full space-y-4">
      {/* El botón principal arriba a la derecha, alineado con el título
          (`items-start`), como Operaciones; con `items-end` quedaba descolgado. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-ink">Imprenta</h1>
          <p className="mt-1 text-[13px] text-muted">Órdenes de impresión · del arte al montaje</p>
        </div>
        {puedeCrear && (
          <Button variant="success" size="sm" onClick={() => setNueva(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva orden
          </Button>
        )}
      </div>

      {/* Dónde está el trabajo, de un vistazo (lenguaje del Dashboard). Sale
          de `oisVisibles`, la misma lista de abajo: sin endpoint nuevo. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!ois ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="En proceso"
              value={formatNumero(oisVisibles.filter((o) => o.estatus !== 'LISTO_MONTAJE').length)}
              sub="aún no están listas para montaje"
            />
            <KPICard
              label="Prueba de color pendiente"
              value={formatNumero(pruebasPendientes)}
              sub="sin aprobar"
              tono={pruebasPendientes > 0 ? 'ambar' : 'neutro'}
            />
            <KPICard
              label="En producción"
              value={formatNumero(conteoPorEtapa.EN_PRODUCCION + conteoPorEtapa.IMPRESO)}
              sub="en producción o ya impresas"
            />
            <KPICard
              label="Listas para montaje"
              value={formatNumero(conteoPorEtapa.LISTO_MONTAJE)}
              sub="pasan a una OT"
              tono={conteoPorEtapa.LISTO_MONTAJE > 0 ? 'verde' : 'neutro'}
            />
          </>
        )}
      </div>

      {/* Reparto por etapa: la franja secundaria del Dashboard, con la etiqueta
          y el número en texto. */}
      {ois && oisVisibles.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
          {PROCESO.map((p) => (
            <span key={p} className="text-muted">
              {IMPRESION_LABEL[p]} <span className="demo-num font-medium text-ink">{formatNumero(conteoPorEtapa[p])}</span>
            </span>
          ))}
        </div>
      )}

      {/* PLEG-01 · la página es una sola lista: se pliega entera, como las
          secciones de Arrendadores. */}
      <CardColapsable
        id="imprenta.ordenes"
        titulo="Órdenes de impresión"
        resumen={
          ois ? (
            <span className="demo-num text-[12px] text-muted">
              {oisVisibles.length} orden{oisVisibles.length === 1 ? '' : 'es'}
            </span>
          ) : undefined
        }
      >
      {!ois ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : oisVisibles.length === 0 ? (
        <EmptyState
          icon={Ruler}
          titulo="Sin órdenes de impresión"
          detalle="Crea una orden ligada a una campaña fija (OOH/híbrida) para llevar el proceso del arte al montaje."
          accion={
            puedeCrear ? (
              <Button variant="success" onClick={() => setNueva(true)}>
                <Plus className="h-3.5 w-3.5" /> Nueva orden
              </Button>
            ) : undefined
          }
        />
      ) : (
        // Una fila por orden (`divide-y`), no una tarjeta alta cada una: con
        // veinte órdenes el Stepper completo de cada una era un muro. El
        // progreso queda en una barra de un color con «Paso N de 5» en texto.
        <ul className="m-0 list-none divide-y divide-border p-0">
          {oisVisibles.map((o) => {
            const camp = campanas?.find((c) => c.id === o.campanaId)
            const sitio = sitios?.find((s) => s.id === o.sitioId)
            const idx = PROCESO.indexOf(o.estatus)
            const digital = o.alto === 0 && o.ancho === 0
            const enFinal = idx >= PROCESO.length - 1
            return (
              <li key={o.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                {/* Izquierda: qué se imprime, dónde y para qué campaña. */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="demo-num text-[12px] text-muted">{o.folio}</span>
                    <span className="text-[14px] font-medium text-ink">{o.material || 'Sin material'}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5" />
                      {digital ? 'Contenido digital' : `${o.ancho} × ${o.alto} m`}
                    </span>
                    {sitio && <span>{sitio.nombre}</span>}
                    {o.proveedor && <span>· {o.proveedor}</span>}
                    {camp ? (
                      puedeVerCampanas ? (
                        <Link
                          href={`/campanas/${camp.id}`}
                          className="inline-flex items-center gap-1 font-medium text-info hover:underline"
                        >
                          Campaña: {camp.nombre} <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span>Campaña: {camp.nombre}</span>
                      )
                    ) : (
                      <span>Sin campaña</span>
                    )}
                  </div>
                  {/* Progreso: una barra de un solo color y el paso en texto
                      (el color no carga el significado solo). */}
                  <div className="mt-1.5 flex items-center gap-2" title={PROCESO.map((p) => IMPRESION_LABEL[p]).join(' → ')}>
                    <div className="flex w-28 gap-0.5" aria-hidden>
                      {PROCESO.map((p, i) => (
                        <span key={p} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-info' : 'bg-surface-2'}`} />
                      ))}
                    </div>
                    <span className="demo-num text-[11px] text-muted">
                      Paso {idx + 1} de {PROCESO.length}
                    </span>
                  </div>
                </div>

                {/* Derecha: prueba de color, estado y las acciones de siempre. */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      o.pruebaColorAprobada
                        ? 'border-transparent bg-success-soft text-success'
                        : 'border-border text-muted'
                    }`}
                  >
                    Prueba de color: {o.pruebaColorAprobada ? 'Aprobada' : 'Pendiente'}
                  </span>
                  <StatusBadge tono={IMPRESION_TONO[o.estatus]}>
                    {IMPRESION_LABEL[o.estatus]}
                  </StatusBadge>
                  {puedeCrear && !o.pruebaColorAprobada && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        try { await aprobarPruebaColorApi(o.id, true) } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
                      }}
                    >
                      Aprobar prueba
                    </Button>
                  )}
                  {puedeCrear && !enFinal && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={avanzando === o.id}
                      onClick={() => avanzar(o.id)}
                    >
                      {avanzando === o.id ? 'Avanzando…' : 'Avanzar'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      </CardColapsable>

      <NuevaOrdenDialog open={nueva} onClose={() => setNueva(false)} />
    </div>
  )
}

function NuevaOrdenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const campanas = useCampanas()
  const sitios = useSitios()
  const [campanaId, setCampanaId] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [material, setMaterial] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [enviando, setEnviando] = useState(false)

  // OBLIG-01 · la campaña es lo único que exige el servidor
  // (`impresion-controller.ts:13`).
  const ob = useObligatorios({ campanaId }, ['campanaId'])

  async function guardar() {
    if (!ob.validar()) return
    setEnviando(true)
    try {
      await crearOrdenImpresionApi({
        campanaId,
        sitioId: sitioId || null,
        material: material.trim(),
        ancho: ancho ? Number(ancho) : 0,
        alto: alto ? Number(alto) : 0,
        proveedor: proveedor.trim(),
      })
      setCampanaId(''); setSitioId(''); setMaterial(''); setAncho(''); setAlto(''); setProveedor('')
      ob.reiniciar()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la orden')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Nueva orden de impresión"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="success" size="sm" disabled={enviando} onClick={guardar}>
            {enviando ? 'Creando…' : 'Crear orden'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Campaña" obligatorio falta={ob.falta('campanaId')}>
          <select
            value={campanaId}
            onChange={(e) => setCampanaId(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          >
            <option value="">Selecciona una campaña…</option>
            {(campanas ?? [])
              .filter((c) => c.tipoCampana !== 'DOOH') // digital no imprime
              .map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
          </select>
        </Campo>
        <Campo label="Sitio">
          <select
            value={sitioId}
            onChange={(e) => setSitioId(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          >
            <option value="">—</option>
            {(sitios ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Material">
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Lona front, vinil, contenido digital…"
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Ancho (m)">
            <input
              type="number" inputMode="decimal" value={ancho}
              onChange={(e) => setAncho(e.target.value)} placeholder="0"
              className="demo-num w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            />
          </Campo>
          <Campo label="Alto (m)">
            <input
              type="number" inputMode="decimal" value={alto}
              onChange={(e) => setAlto(e.target.value)} placeholder="0"
              className="demo-num w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            />
          </Campo>
        </div>
        <Campo label="Proveedor">
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Imprenta proveedora"
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          />
        </Campo>
        <p className="text-[11px] text-muted">Deja ancho y alto en 0 para contenido digital.</p>
      </div>
    </Modal>
  )
}
