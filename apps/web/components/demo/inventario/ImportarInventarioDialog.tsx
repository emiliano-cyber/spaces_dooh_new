'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { validarArchivo, type FilaValidada } from '@/lib/inventario-import'
import {
  data,
  useSitios,
  type ImportSummary,
  type ImportStatus,
  type ModoDuplicado,
} from '@/lib/data/client'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const STATUS_STYLE: Record<ImportStatus, string> = {
  creado: 'text-[#0f7a55]',
  actualizado: 'text-info',
  advertencia: 'text-[#9a6700]',
  error: 'text-error',
}

export function ImportarInventarioDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const sitios = useSitios()
  const [precioM2, setPrecioM2] = useState('')
  const [filas, setFilas] = useState<FilaValidada[] | null>(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [imagenes, setImagenes] = useState<Record<string, string>>({})
  const [modo, setModo] = useState<ModoDuplicado>('ACTUALIZAR')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)

  // Códigos del archivo que ya existen → duplicados.
  const existentes = new Set((sitios ?? []).map((s) => s.codigoProveedor))
  const duplicados = (filas ?? [])
    .filter((f) => f.datos && existentes.has(f.codigo_proveedor))
    .map((f) => f.codigo_proveedor)

  function reset() {
    setFilas(null)
    setArchivoNombre('')
    setImagenes({})
    setSummary(null)
    setModo('ACTUALIZAR')
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setLeyendo(true)
    setArchivoNombre(f.name)
    try {
      setFilas(await validarArchivo(f))
    } catch {
      alert('No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.')
    }
    setLeyendo(false)
    setSummary(null)
    e.target.value = ''
  }

  function onImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const map = { ...imagenes }
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) continue
      map[f.name] = URL.createObjectURL(f)
    }
    setImagenes(map)
    e.target.value = ''
  }

  async function procesar() {
    if (!filas) return
    setProcesando(true)
    const res = await data.importarInventario({
      filas,
      modoDuplicado: modo,
      precioM2: precioM2 ? Number(precioM2) : null,
      imagenes,
    })
    setProcesando(false)
    setSummary(res)
  }

  const totalImagenes = Object.keys(imagenes).length

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      title="Importar inventario"
      subtitle="Carga masiva desde Excel (.xlsx) o CSV"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">
            {filas ? `${filas.length} filas leídas` : 'Sin archivo'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { reset(); onOpenChange(false) }}>
              Cerrar
            </Button>
            <Button size="sm" disabled={!filas || procesando || !!summary} onClick={procesar}>
              {procesando ? 'Procesando…' : 'Procesar importación'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        {/* Precio m2 */}
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Precio por m² (opcional)</span>
          <input className={inputCls} value={precioM2} onChange={(e) => setPrecioM2(e.target.value)} placeholder="Se aplica a pantallas estáticas: ancho × alto × precio_m2" />
        </label>

        {/* Archivo */}
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">Archivo de inventario</span>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border-strong px-3 py-3 text-[13px] text-muted hover:bg-surface-2">
            <FileSpreadsheet className="h-4 w-4" />
            {leyendo ? 'Leyendo…' : archivoNombre || 'Seleccionar .xlsx o .csv'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onArchivo} className="hidden" />
          </label>
        </div>

        {/* Imágenes en bulk */}
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">Imágenes (bulk, opcional)</span>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border-strong px-3 py-2 text-[13px] text-muted hover:bg-surface-2">
            <ImageIcon className="h-4 w-4" />
            {totalImagenes > 0 ? `${totalImagenes} imágenes cargadas` : 'Subir imágenes (JPG/PNG ≤5MB)'}
            <input type="file" accept="image/jpeg,image/png" multiple onChange={onImagenes} className="hidden" />
          </label>
          <p className="mt-1 text-[11px] text-muted">Se asocian por nombre de archivo o por código de proveedor.</p>
        </div>

        {/* Duplicados */}
        {filas && duplicados.length > 0 && !summary && (
          <div className="rounded-md border border-[#f59e0b40] bg-[#f59e0b0a] p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {duplicados.length} código(s) ya existen
            </div>
            <p className="mb-2 text-[12px] text-muted">Elige cómo proceder antes de importar:</p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="radio" name="modo" checked={modo === 'ACTUALIZAR'} onChange={() => setModo('ACTUALIZAR')} className="mt-0.5 accent-[var(--accent)]" />
                <span><b>Actualizar</b> campos modificados (conserva la imagen anterior si no se sube una nueva)</span>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="radio" name="modo" checked={modo === 'NUEVA_VERSION'} onChange={() => setModo('NUEVA_VERSION')} className="mt-0.5 accent-[var(--accent)]" />
                <span><b>Crear nueva</b> con sufijo -v2, -v3…</span>
              </label>
            </div>
          </div>
        )}

        {/* Vista previa de filas (antes de procesar) */}
        {filas && !summary && (
          <FilasTabla filas={filas} />
        )}

        {/* Resumen */}
        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2 text-center">
              <Resumen label="Total" n={summary.total_filas} />
              <Resumen label="Creadas" n={summary.creadas} tono="verde" />
              <Resumen label="Actualizadas" n={summary.actualizadas} tono="azul" />
              <Resumen label="Advertencias" n={summary.con_advertencias} tono="ambar" />
              <Resumen label="Errores" n={summary.errores} tono="rojo" />
            </div>
            <ResultadoTabla detalle={summary.detalle} />
            <details className="rounded-md border border-border bg-surface-2">
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink">JSON de salida</summary>
              <pre className="demo-num overflow-x-auto px-3 pb-3 text-[11px] text-muted">{JSON.stringify(summary, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </Modal>
  )
}

function FilasTabla({ filas }: { filas: FilaValidada[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        Vista previa
      </div>
      <ul className="max-h-40 overflow-y-auto">
        {filas.map((f, i) => (
          <li key={i} className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[12px] last:border-0">
            <span className="demo-num truncate text-ink">{f.codigo_proveedor}</span>
            <span className={cn('shrink-0 font-medium', STATUS_STYLE[f.status === 'ok' ? 'creado' : f.status])}>
              {f.status === 'ok' ? 'válida' : f.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultadoTabla({ detalle }: { detalle: ImportSummary['detalle'] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <ul className="max-h-48 overflow-y-auto">
        {detalle.map((d, i) => (
          <li key={i} className="border-b border-border px-3 py-1.5 text-[12px] last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="demo-num truncate text-ink">{d.codigo_proveedor}</span>
              <span className={cn('shrink-0 font-medium', STATUS_STYLE[d.status])}>{d.status}</span>
            </div>
            <div className="text-[11px] text-muted">{d.mensaje}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Resumen({ label, n, tono }: { label: string; n: number; tono?: 'verde' | 'azul' | 'ambar' | 'rojo' }) {
  const color =
    tono === 'verde' ? 'text-success' : tono === 'azul' ? 'text-info' : tono === 'ambar' ? 'text-warning' : tono === 'rojo' ? 'text-error' : 'text-ink'
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className={cn('demo-num text-xl font-semibold', color)}>{n}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
