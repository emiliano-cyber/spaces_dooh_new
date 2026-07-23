'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Warehouse, Plus, ArrowLeftRight, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useSitios } from '@/lib/data/client'
import {
  getAlmacenApi,
  crearActivoApi,
  moverActivoApi,
  type Activo,
  type EstadoActivo,
  type TipoMovAlmacen,
} from '@/lib/data/almacen-api'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const ESTADO: Record<EstadoActivo, { label: string; cls: string }> = {
  EN_ALMACEN: { label: 'En almacén', cls: 'border-border bg-surface-2 text-muted' },
  INSTALADO: { label: 'Instalado', cls: 'border-[#10b98140] bg-[#10b9811a] text-[#0f7a55]' },
  EN_TRASLADO: { label: 'En traslado', cls: 'border-[#f59e0b40] bg-[#f59e0b1a] text-[#9a6700]' },
  BAJA: { label: 'Baja', cls: 'border-[#ef444440] bg-[#ef44441a] text-error' },
}

// Movimientos permitidos según el estado actual del activo.
const MOVS: Record<EstadoActivo, TipoMovAlmacen[]> = {
  EN_ALMACEN: ['SALIDA', 'TRASLADO', 'BAJA'],
  INSTALADO: ['ENTRADA', 'TRASLADO', 'BAJA'],
  EN_TRASLADO: ['ENTRADA', 'SALIDA', 'BAJA'],
  BAJA: [],
}
const MOV_LABEL: Record<TipoMovAlmacen, string> = {
  ENTRADA: 'Regresar a almacén',
  SALIDA: 'Instalar en pantalla',
  TRASLADO: 'Marcar en traslado',
  BAJA: 'Dar de baja',
}

export default function AlmacenPage() {
  const puedeEditar = usePuede('operaciones', 'crear')
  const sitios = useSitios()
  const [activos, setActivos] = useState<Activo[] | null>(null)
  const [altaOpen, setAltaOpen] = useState(false)
  const [mover, setMover] = useState<Activo | null>(null)

  const nombreSitio = useCallback(
    (id: string | null) => (id ? sitios?.find((s) => s.id === id)?.nombre ?? '—' : '—'),
    [sitios],
  )

  const cargar = useCallback(async () => {
    try {
      const d = await getAlmacenApi()
      setActivos(d.activos)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el almacén')
      setActivos([])
    }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
            <Warehouse className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl text-ink">Almacén</h1>
            <p className="mt-1 text-[13px] text-muted">Activos físicos (pantallas, estructuras) y sus traslados.</p>
          </div>
        </div>
        {puedeEditar && (
          <Button size="sm" onClick={() => setAltaOpen(true)}><Plus className="h-3.5 w-3.5" /> Registrar activo</Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {!activos ? (
          <div className="h-40 animate-pulse rounded-md bg-surface-2" />
        ) : activos.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">Aún no hay activos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Etiqueta</th>
                  <th className="px-4 py-2 font-medium">Descripción</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Ubicación</th>
                  {puedeEditar && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activos.map((a) => (
                  <tr key={a.id}>
                    <td className="demo-num px-4 py-2.5 font-medium text-ink">{a.etiqueta}</td>
                    <td className="px-4 py-2.5 text-muted">{a.descripcion}</td>
                    <td className="px-4 py-2.5 text-muted">{a.tipoActivo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO[a.estado].cls}`}>
                        {ESTADO[a.estado].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{a.estado === 'INSTALADO' ? nombreSitio(a.sitioId) : '—'}</td>
                    {puedeEditar && (
                      <td className="px-4 py-2.5 text-right">
                        {MOVS[a.estado].length > 0 && (
                          <button
                            type="button"
                            onClick={() => setMover(a)}
                            className="inline-flex items-center gap-1.5 rounded border border-border-strong px-2 py-1 text-[12px] text-ink hover:bg-surface-2"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-muted" /> Mover
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {altaOpen && <AltaActivoModal onClose={() => setAltaOpen(false)} onCreado={() => { setAltaOpen(false); void cargar() }} />}
      {mover && (
        <MoverModal
          activo={mover}
          sitios={sitios ?? []}
          onClose={() => setMover(null)}
          onHecho={() => { setMover(null); void cargar() }}
        />
      )}
    </div>
  )
}

function AltaActivoModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [etiqueta, setEtiqueta] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoActivo, setTipoActivo] = useState('PANTALLA')
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)

  async function guardar() {
    if (!etiqueta.trim() || !descripcion.trim()) { toast.error('Etiqueta y descripción son obligatorias'); return }
    setBusy(true)
    try {
      await crearActivoApi({ etiqueta: etiqueta.trim(), descripcion: descripcion.trim(), tipoActivo, notas: notas.trim() || null })
      toast.success('Activo registrado en almacén')
      onCreado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar')
    }
    setBusy(false)
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Registrar activo" subtitle="Entra al almacén"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={busy || !etiqueta.trim() || !descripcion.trim()} onClick={guardar}>
            {busy ? 'Guardando…' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Etiqueta / número de inventario"><input className={inputCls} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Ej. INV-0231" autoFocus /></Campo>
        <Campo label="Descripción"><input className={inputCls} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Pantalla LED 4x3 m" /></Campo>
        <Campo label="Tipo">
          <select className={inputCls} value={tipoActivo} onChange={(e) => setTipoActivo(e.target.value)}>
            <option value="PANTALLA">Pantalla</option>
            <option value="ESTRUCTURA">Estructura</option>
            <option value="LONA">Lona</option>
            <option value="OTRO">Otro</option>
          </select>
        </Campo>
        <Campo label="Notas (opcional)"><textarea className={inputCls} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

function MoverModal({
  activo, sitios, onClose, onHecho,
}: { activo: Activo; sitios: { id: string; nombre: string }[]; onClose: () => void; onHecho: () => void }) {
  const opciones = MOVS[activo.estado]
  const [tipo, setTipo] = useState<TipoMovAlmacen>(opciones[0])
  const [motivo, setMotivo] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [busy, setBusy] = useState(false)

  async function guardar() {
    if (tipo === 'SALIDA' && !sitioId) { toast.error('Elige la pantalla destino'); return }
    setBusy(true)
    try {
      await moverActivoApi(activo.id, { tipo, motivo: motivo.trim() || null, sitioId: tipo === 'SALIDA' ? sitioId : null })
      toast.success('Movimiento registrado')
      onHecho()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover')
    }
    setBusy(false)
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Mover activo" subtitle={`${activo.etiqueta} · ${activo.descripcion}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Registrar movimiento'}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Movimiento">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovAlmacen)}>
            {opciones.map((o) => <option key={o} value={o}>{MOV_LABEL[o]}</option>)}
          </select>
        </Campo>
        {tipo === 'SALIDA' && (
          <Campo label="Pantalla destino">
            <select className={inputCls} value={sitioId} onChange={(e) => setSitioId(e.target.value)}>
              <option value="">— Elige —</option>
              {sitios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Motivo / nota (opcional)"><textarea className={inputCls} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Retiro por fin de contrato" /></Campo>
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
