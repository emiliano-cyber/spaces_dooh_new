'use client'

import { useState } from 'react'
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Image as ImageIcon,
  Plus,
  Download,
  FileText,
  Eye,
} from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { InlinePanel } from '@/components/demo/ui/InlinePanel'
import { Button } from '@/components/demo/ui/Button'
import { InfoAnadidaModal } from './InfoAnadidaModal'
import { cn } from '@/lib/cn'
import { validarArchivo, type FilaValidada } from '@/lib/inventario-import'
import { importarSitiosApi } from '@/lib/data/sitios-api'
import {
  useSitios,
  type ImportSummary,
  type ImportStatus,
  type ModoDuplicado,
} from '@/lib/data/client'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// La plantilla real vive en /public; el basePath /spaces-dooh la sirve aquí.
const PLANTILLA_URL = '/spaces-dooh/plantilla-sitios-set.xlsx'

const STATUS_STYLE: Record<ImportStatus, string> = {
  creado: 'text-[#0f7a55]',
  actualizado: 'text-info',
  advertencia: 'text-[#9a6700]',
  error: 'text-error',
}

export function ImportarInventarioDialog({
  open,
  onOpenChange,
  onNuevaPantalla,
  inline = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onNuevaPantalla: () => void
  // En `inline` se renderiza dentro de la página (sin modal/overlay).
  inline?: boolean
}) {
  const sitios = useSitios()
  const [precioM2, setPrecioM2] = useState('')
  const [codificacion, setCodificacion] = useState('utf-8')
  const [filas, setFilas] = useState<FilaValidada[] | null>(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [imagenes, setImagenes] = useState<Record<string, string>>({})
  const [modo, setModo] = useState<ModoDuplicado>('ACTUALIZAR')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [verInfo, setVerInfo] = useState(false)

  // Sitios añadidos/actualizados por esta importación (para el mini-modal).
  const codigosAfectados = new Set(
    (summary?.detalle ?? []).filter((d) => d.status !== 'error').map((d) => d.codigo_proveedor),
  )
  const sitiosAfectados = (sitios ?? []).filter((s) => codigosAfectados.has(s.codigoProveedor))

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

  async function procesarArchivo(f: File) {
    setLeyendo(true)
    setArchivoNombre(f.name)
    try {
      setFilas(await validarArchivo(f))
    } catch {
      alert('No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.')
    }
    setLeyendo(false)
    setSummary(null)
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) await procesarArchivo(f)
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
    const res = await importarSitiosApi({
      filas,
      modoDuplicado: modo,
      precioM2: precioM2 ? Number(precioM2) : null,
    })
    setProcesando(false)
    setSummary(res)
  }

  const totalImagenes = Object.keys(imagenes).length

  const footer = (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted">
        {filas ? `${filas.length} filas leídas` : 'Sin archivo'}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => { reset(); if (!inline) onOpenChange(false) }}>
          {inline ? 'Limpiar' : 'Cerrar'}
        </Button>
        <Button size="sm" disabled={!filas || procesando || !!summary} onClick={procesar}>
          {procesando ? 'Procesando…' : 'Procesar importación'}
        </Button>
      </div>
    </div>
  )
  const cuerpo = (
    <>
      <div className={inline ? 'space-y-3 pr-1' : 'max-h-[64vh] space-y-3 overflow-y-auto pr-1'}>
        {/* ¿Solo una pantalla? */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <div>
            <div className="text-[13px] font-medium text-ink">¿Solo una pantalla?</div>
            <div className="text-[12px] text-muted">Agrégala manualmente con el formulario</div>
          </div>
          <Button size="sm" onClick={onNuevaPantalla}>
            <Plus className="h-3.5 w-3.5" /> Nueva pantalla
          </Button>
        </div>

        {/* ¿Primera vez? Descargar plantilla */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <div>
            <div className="text-[13px] font-medium text-ink">¿Primera vez cargando inventario?</div>
            <div className="text-[12px] text-muted">Descarga la plantilla con el formato correcto</div>
          </div>
          <a
            href={PLANTILLA_URL}
            download
            className="inline-flex h-8 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-2"
          >
            <Download className="h-3.5 w-3.5" /> Descargar plantilla
          </a>
        </div>

        {/* Precio de impresión por m² */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <div>
            <div className="text-[13px] font-medium text-ink">Precio de impresión por m² (pantallas estáticas)</div>
            <div className="text-[12px] text-muted">Este valor se aplicará a todas las pantallas estáticas</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted">$</span>
            <input
              value={precioM2}
              onChange={(e) => setPrecioM2(e.target.value)}
              inputMode="numeric"
              placeholder="65"
              className="h-9 w-20 rounded border border-border-strong bg-surface px-2 text-right text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent demo-num"
            />
            <span className="text-[13px] text-muted">/m²</span>
          </div>
        </div>

        {/* Info limpieza de encabezados */}
        <div className="flex gap-2.5 rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3 text-[12px] text-muted">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <p>
            Sube el archivo usando la hoja <b className="text-ink">Sitios</b> de la plantilla. El
            sistema lee solo esa hoja, <b className="text-ink">limpia automáticamente los encabezados</b>{' '}
            y <b className="text-ink">agrupa por código de proveedor</b>: una fila por modalidad de
            venta → un sitio con varias modalidades. Requeridos: nombre, exhibición, unidad, tarifa y costo.
          </p>
        </div>

        {/* Codificación */}
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Codificación del archivo</span>
          <select className={inputCls} value={codificacion} onChange={(e) => setCodificacion(e.target.value)}>
            <option value="utf-8">UTF-8 (Universal)</option>
            <option value="latin1">Latin-1 / ISO-8859-1</option>
            <option value="windows-1252">Windows-1252</option>
          </select>
          <span className="mt-1 block text-[11px] text-muted">
            El sistema intentará detectar automáticamente la codificación correcta si la seleccionada no funciona.
          </span>
        </label>

        {/* Zona drag-drop */}
        <label
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            const f = e.dataTransfer.files?.[0]
            if (f) procesarArchivo(f)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors duration-150',
            arrastrando ? 'border-accent bg-[#f59e0b0a]' : 'border-border-strong hover:bg-surface-2',
          )}
        >
          <Upload className="h-6 w-6 text-muted" />
          <span className="text-[13px] text-ink">
            {leyendo ? 'Leyendo…' : archivoNombre || 'Arrastra un archivo o selecciónalo'}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx o .csv
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onArchivo} className="hidden" />
        </label>

        {/* Imágenes en bulk */}
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">Imágenes (bulk, opcional)</span>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border-strong px-3 py-2 text-[13px] text-muted hover:bg-surface-2">
            <ImageIcon className="h-4 w-4" />
            {totalImagenes > 0 ? `${totalImagenes} imágenes cargadas` : 'Subir imágenes (JPG/PNG ≤5MB)'}
            <input type="file" accept="image/jpeg,image/png" multiple onChange={onImagenes} className="hidden" />
          </label>
          <p className="mt-1 text-[11px] text-muted">Se asocian por código de proveedor (nombre del archivo = código).</p>
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

        {/* Vista previa */}
        {filas && !summary && <FilasTabla filas={filas} />}

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
            {sitiosAfectados.length > 0 && (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setVerInfo(true)}>
                <Eye className="h-3.5 w-3.5" /> Ver información añadida ({sitiosAfectados.length})
              </Button>
            )}
            <ResultadoTabla detalle={summary.detalle} />
            {/* El JSON de salida (contrato con el backend) se mantiene en el
                resultado de importarInventario; se oculta del UI de la demo. */}
          </div>
        )}
      </div>
      <InfoAnadidaModal open={verInfo} onOpenChange={setVerInfo} sitios={sitiosAfectados} />
    </>
  )

  if (inline) {
    return (
      <InlinePanel
        title="Carga masiva de inventario"
        subtitle="Sube tu inventario por archivo o agrega una sola pantalla"
        footer={footer}
      >
        {cuerpo}
      </InlinePanel>
    )
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      size="xl"
      title="Carga masiva de inventario"
      subtitle="Sube tu inventario por archivo o agrega una sola pantalla"
      footer={footer}
    >
      {cuerpo}
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
