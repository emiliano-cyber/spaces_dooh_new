'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Ruler, Plus, ChevronRight } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { EmptyState } from '@/components/demo/EmptyState'
import { Stepper } from '@/components/demo/Stepper'
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

  async function avanzar(id: string) {
    setAvanzando(id)
    try {
      await avanzarOrdenImpresionApi(id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo avanzar la orden')
    }
    setAvanzando(null)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl text-ink">Imprenta</h1>
          <p className="mt-1 text-[13px] text-muted">Órdenes de impresión · del arte al montaje</p>
        </div>
        {puedeCrear && (
          <Button size="sm" onClick={() => setNueva(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva orden
          </Button>
        )}
      </div>

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
        />
      ) : (
        <ul className="space-y-3">
          {oisVisibles.map((o) => {
            const camp = campanas?.find((c) => c.id === o.campanaId)
            const sitio = sitios?.find((s) => s.id === o.sitioId)
            const idx = PROCESO.indexOf(o.estatus)
            const pasos = PROCESO.map((p) => ({ key: p, label: IMPRESION_LABEL[p] }))
            const digital = o.alto === 0 && o.ancho === 0
            const enFinal = idx >= PROCESO.length - 1
            return (
              <li key={o.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="demo-num text-[12px] text-muted">{o.folio}</div>
                      <div className="mt-0.5 text-[14px] font-medium text-ink">{o.material || 'Sin material'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5" />
                          {digital ? 'Contenido digital' : `${o.ancho} × ${o.alto} m`}
                        </span>
                        {sitio && <span>{sitio.nombre}</span>}
                        {o.proveedor && <span>· {o.proveedor}</span>}
                      </div>
                    </div>
                    <StatusBadge tono={IMPRESION_TONO[o.estatus]}>
                      {IMPRESION_LABEL[o.estatus]}
                    </StatusBadge>
                  </div>

                  {/* Proceso */}
                  <div className="mt-4">
                    <Stepper pasos={pasos} actualIndex={idx} />
                  </div>

                  {/* Prueba de color (probatorio) */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                    <span className="flex items-center gap-2 text-[12px] text-ink">
                      Prueba de color:
                      <span className={o.pruebaColorAprobada ? 'font-medium text-[#0f7a55]' : 'text-muted'}>
                        {o.pruebaColorAprobada ? 'Aprobada' : 'Pendiente'}
                      </span>
                    </span>
                    {puedeCrear && !o.pruebaColorAprobada && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try { await aprobarPruebaColorApi(o.id, true) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
                        }}
                      >
                        Aprobar prueba de color
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    {camp ? (
                      puedeVerCampanas ? (
                        <Link
                          href={`/demo/campanas/${camp.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                        >
                          Campaña: {camp.nombre} <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-[12px] text-muted">Campaña: {camp.nombre}</span>
                      )
                    ) : (
                      <span className="text-[12px] text-muted">Sin campaña</span>
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
                </Card>
              </li>
            )
          })}
        </ul>
      )}

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

  async function guardar() {
    if (!campanaId) return
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
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo crear la orden')
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
          <Button size="sm" disabled={enviando || !campanaId} onClick={guardar}>
            {enviando ? 'Creando…' : 'Crear orden'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Campaña">
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
        <Campo label="Sitio (opcional)">
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
        <Campo label="Proveedor (opcional)">
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
