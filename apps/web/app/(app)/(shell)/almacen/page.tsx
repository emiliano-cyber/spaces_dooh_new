'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  TIPOS_ACTIVO,
  ETIQUETA_TIPO_ACTIVO,
  ETIQUETA_CAMPO,
  camposDelTipo,
  contarPorTipo,
  etiquetaTipoActivo,
  filtrarPorTipo,
  type CampoTipo,
  type TipoActivo,
} from '@/lib/almacen-tipos'

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
  // El filtro es de pantalla, sobre la lista completa: así las pastillas dan
  // su cuenta sin una petición por tipo. Cuenta y filtro usan la MISMA regla
  // (`tipoDeFiltro`) que el `?tipo=` del servidor.
  const [filtroTipo, setFiltroTipo] = useState<TipoActivo | null>(null)
  const cuentas = useMemo(() => contarPorTipo(activos ?? []), [activos])
  const visibles = useMemo(() => filtrarPorTipo(activos ?? [], filtroTipo), [activos, filtroTipo])

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
            <p className="mt-1 text-[13px] text-muted">Vehículos, herramientas, pantallas, cámaras y demás artículos, y sus traslados.</p>
          </div>
        </div>
        {puedeEditar && (
          <Button size="sm" onClick={() => setAltaOpen(true)}><Plus className="h-3.5 w-3.5" /> Registrar artículo</Button>
        )}
      </div>

      {activos && activos.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          <PastillaTipo activa={filtroTipo === null} onClick={() => setFiltroTipo(null)} label="Todos" cuenta={activos.length} />
          {TIPOS_ACTIVO.filter((t) => cuentas[t] > 0).map((t) => (
            <PastillaTipo key={t} activa={filtroTipo === t} onClick={() => setFiltroTipo(t)} label={ETIQUETA_TIPO_ACTIVO[t]} cuenta={cuentas[t]} />
          ))}
        </div>
      )}

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
                  <th className="px-4 py-2 font-medium">Datos</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Ubicación</th>
                  {puedeEditar && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibles.map((a) => (
                  <tr key={a.id}>
                    <td className="demo-num px-4 py-2.5 font-medium text-ink">{a.etiqueta}</td>
                    <td className="px-4 py-2.5 text-muted">{a.descripcion}</td>
                    <td className="px-4 py-2.5 text-muted">{etiquetaTipoActivo(a.tipoActivo)}</td>
                    <td className="px-4 py-2.5 text-muted">{datosDelArticulo(a)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO[a.estado].cls}`}>
                        {ESTADO[a.estado].label}
                      </span>
                    </td>
                    {/* Instalado → la pantalla donde está; si no, dónde se guarda (bodega). */}
                    <td className="px-4 py-2.5 text-muted">{a.estado === 'INSTALADO' ? nombreSitio(a.sitioId) : a.ubicacion ?? '—'}</td>
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
  const [tipoActivo, setTipoActivo] = useState<TipoActivo>('PANTALLA')
  const [notas, setNotas] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [datos, setDatos] = useState<Record<CampoTipo, string>>({ marca: '', modelo: '', numeroSerie: '', placas: '' })
  const [busy, setBusy] = useState(false)
  const campos = camposDelTipo(tipoActivo)

  async function guardar() {
    if (!etiqueta.trim() || !descripcion.trim()) { toast.error('Etiqueta y descripción son obligatorias'); return }
    setBusy(true)
    try {
      // Solo los campos que pide el tipo ELEGIDO: si alguien teclea placas y
      // luego cambia a «Cámara», el servidor rechazaría unas placas que ya no
      // se ven en pantalla.
      const propios = Object.fromEntries(campos.map((c) => [c, datos[c].trim() || null]))
      await crearActivoApi({
        etiqueta: etiqueta.trim(),
        descripcion: descripcion.trim(),
        tipoActivo,
        notas: notas.trim() || null,
        ubicacion: ubicacion.trim() || null,
        ...propios,
      })
      toast.success('Activo registrado en almacén')
      onCreado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar')
    }
    setBusy(false)
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Registrar artículo" subtitle="Entra al almacén"
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
        <Campo label="Descripción"><input className={inputCls} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Camioneta Nissan NP300 / Pantalla LED 4x3 m" /></Campo>
        <Campo label="Tipo">
          <select className={inputCls} value={tipoActivo} onChange={(e) => setTipoActivo(e.target.value as TipoActivo)}>
            {TIPOS_ACTIVO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_ACTIVO[t]}</option>)}
          </select>
        </Campo>
        {campos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <Campo key={c} label={`${c === 'numeroSerie' && tipoActivo === 'VEHICULO' ? 'Número de serie (VIN)' : ETIQUETA_CAMPO[c]} (opcional)`}>
                <input
                  className={inputCls}
                  value={datos[c]}
                  maxLength={c === 'placas' ? 20 : 120}
                  onChange={(e) => setDatos((d) => ({ ...d, [c]: e.target.value }))}
                  placeholder={PLACEHOLDER_CAMPO[c]}
                />
              </Campo>
            ))}
          </div>
        )}
        <Campo label="Dónde se guarda (opcional)"><input className={inputCls} value={ubicacion} maxLength={200} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej. Bodega norte, anaquel 3" /></Campo>
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

const PLACEHOLDER_CAMPO: Record<CampoTipo, string> = {
  marca: 'Ej. Nissan / Hikvision',
  modelo: 'Ej. NP300 / DS-2DE4425',
  numeroSerie: 'Ej. 3N6AD33A1KK123456',
  placas: 'Ej. ABC-1234',
}

// Lo que distingue a este artículo de otro igual, en una línea: marca y
// modelo, serie y placas. Solo lo que se capturó; nada → «—».
function datosDelArticulo(a: Activo): string {
  const partes = [
    [a.marca, a.modelo].filter(Boolean).join(' '),
    a.numeroSerie ? `S/N ${a.numeroSerie}` : '',
    a.placas ? `Placas ${a.placas}` : '',
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : '—'
}

function PastillaTipo({ activa, onClick, label, cuenta }: { activa: boolean; onClick: () => void; label: string; cuenta: number }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${
        activa ? 'border-ink bg-ink text-surface' : 'border-border-strong bg-surface text-ink hover:bg-surface-2'
      }`}
    >
      {label} <span className={activa ? 'opacity-80' : 'text-muted'}>{cuenta}</span>
    </button>
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
