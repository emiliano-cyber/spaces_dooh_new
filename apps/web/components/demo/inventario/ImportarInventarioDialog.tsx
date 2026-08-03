'use client'

import { toast } from 'sonner'
import { useMemo, useState } from 'react'
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Image as ImageIcon,
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
import { pantallasFueraDelGrupo } from '@/lib/predio-cercania'
import { importarSitiosApi } from '@/lib/data/sitios-api'
import {
  useSitios,
  useArrendadores,
  usePredios,
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
  onImportado,
  inline = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  // Se llama al terminar una importación. Recibe el resumen para que quien
  // contiene el diálogo decida qué hacer (p. ej. saltar al inventario si no
  // hubo errores, o quedarse para que se lea el detalle si los hubo).
  onImportado?: (resumen: ImportSummary) => void
  // En `inline` se renderiza dentro de la página (sin modal/overlay).
  inline?: boolean
}) {
  const sitios = useSitios()
  const arrendadores = useArrendadores()
  const predios = usePredios()
  const [arrendadorId, setArrendadorId] = useState('')
  // Predio del lote (opcional): SOLO un nombre. Antes había una casilla «todas
  // están en el mismo predio» más un selector; se pedía al operador que
  // AFIRMARA algo que el propio archivo ya dice. Ahora se escribe el nombre y
  // la coherencia se comprueba contra las direcciones del Excel (más abajo).
  // Vacío = pantallas sueltas, cada una con su contrato.
  const [predioNombre, setPredioNombre] = useState('')
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

  // Un predio pertenece a UN arrendador, así que solo se ofrecen los suyos.
  const prediosDelArrendador = (predios ?? []).filter((p) => p.arrendadorId === arrendadorId)
  // El nombre escrito puede ser uno que YA existe: entonces se reutiliza en vez
  // de dar de alta un duplicado. La comparación ignora mayúsculas y espacios,
  // que es como la gente escribe el mismo nombre dos veces.
  const predioExistente = prediosDelArrendador.find(
    (p) => p.nombre.trim().toLowerCase() === predioNombre.trim().toLowerCase(),
  )
  // Payload de predio: null = pantallas sueltas (una con su contrato cada una).
  const predioDelLote = !predioNombre.trim()
    ? null
    : predioExistente
      ? { id: predioExistente.id }
      : { nombre: predioNombre.trim(), direccion: null }

  // ¿Todas las pantallas del archivo están de verdad en el mismo sitio? Solo
  // importa si se pidió agruparlas en un predio. Se avisa, no se bloquea: sin
  // coordenadas en el Excel —el caso más común— la única evidencia es cómo está
  // escrita la dirección, y eso no da para rechazar un archivo. El servidor sí
  // bloquea cuando hay coordenadas y una pantalla está a más de 250 m.
  // Depende de SI se agrupa en predio, no del texto: si no, cada tecla del
  // nombre recorría el archivo entero de nuevo sin que el resultado cambiara.
  const agrupaEnPredio = !!predioNombre.trim()
  const fueraDelGrupo = useMemo(() => {
    if (!agrupaEnPredio || !filas) return []
    return pantallasFueraDelGrupo(
      filas
        .filter((f) => f.datos)
        .map((f) => ({
          clave: f.datos!.nombre || f.codigo_proveedor || 'sin nombre',
          lat: f.datos!.latitud,
          lng: f.datos!.longitud,
          direccion: f.datos!.direccion,
          // Las filas con coordenadas por defecto se marcan pendientes: usarlas
          // diría que todas están en el mismo punto exacto.
          coordsFiables: !f.datos!.pendienteVerificacion,
        })),
    )
  }, [filas, agrupaEnPredio])

  // El precio de impresión por m² solo aplica a pantallas ESTÁTICAS. Preguntarlo
  // cuando el archivo trae solo digitales es pedir un dato que no se va a usar.
  const hayFijas = (filas ?? []).some((f) => f.datos?.exhibicion === 'fijo')

  const listoParaImportar = !!filas && !!arrendadorId

  function reset() {
    setFilas(null)
    setArchivoNombre('')
    setImagenes({})
    setSummary(null)
    setModo('ACTUALIZAR')
    setArrendadorId('')
    setPredioNombre('')
  }

  async function procesarArchivo(f: File) {
    setLeyendo(true)
    setArchivoNombre(f.name)
    try {
      setFilas(await validarArchivo(f))
    } catch {
      toast.error('No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.')
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
    e.target.value = ''
    // Se leen como data URL (base64) para que persistan; el blob URL se perdería.
    Promise.all(
      files.map(
        (f) =>
          new Promise<[string, string] | null>((res) => {
            if (f.size > 5 * 1024 * 1024) return res(null)
            const reader = new FileReader()
            reader.onload = () => res([f.name, reader.result as string])
            reader.onerror = () => res(null)
            reader.readAsDataURL(f)
          }),
      ),
    ).then((pares) => {
      setImagenes((prev) => {
        const map = { ...prev }
        for (const par of pares) if (par) map[par[0]] = par[1]
        return map
      })
    })
  }

  async function procesar() {
    if (!filas) return
    setProcesando(true)
    // Envía las imágenes por nombre de archivo (sin extensión, minúsculas). El
    // servidor las asocia por nomenclatura: "codigo" (principal) o "codigo-N"
    // (imagen N). Ej.: "S-ABC123.jpg", "S-ABC123-2.jpg" → sitio "S-ABC123".
    const imagenesPorArchivo: Record<string, string> = {}
    for (const [fn, dataUrl] of Object.entries(imagenes)) {
      const clave = fn.replace(/\.[^.]+$/, '').trim().toLowerCase()
      if (clave) imagenesPorArchivo[clave] = dataUrl
    }
    // importarSitiosApi lanza si la respuesta no es ok. Sin try/finally el throw
    // se escapaba y `procesando` quedaba en true: el botón se quedaba en
    // "Procesando…" para siempre y el usuario no veía el motivo del fallo.
    try {
      const res = await importarSitiosApi({
        filas,
        arrendadorId,
        predio: predioDelLote,
        modoDuplicado: modo,
        precioM2: precioM2 ? Number(precioM2) : null,
        imagenes: Object.keys(imagenesPorArchivo).length ? imagenesPorArchivo : undefined,
      })
      setSummary(res)
      onImportado?.(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar')
    } finally {
      setProcesando(false)
    }
  }

  const totalImagenes = Object.keys(imagenes).length

  const footer = (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted">
        {filas && !arrendadorId
          ? 'Falta elegir el arrendador'
          : filas
            ? `${filas.length} filas leídas`
            : 'Sin archivo'}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => { reset(); if (!inline) onOpenChange(false) }}>
          {inline ? 'Limpiar' : 'Cerrar'}
        </Button>
        <Button size="sm" disabled={!listoParaImportar || procesando || !!summary} onClick={procesar}>
          {procesando ? 'Procesando…' : 'Procesar importación'}
        </Button>
      </div>
    </div>
  )
  const cuerpo = (
    <>
      <div className={inline ? 'space-y-3 pr-1' : 'max-h-[64vh] space-y-3 overflow-y-auto pr-1'}>
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

        {/* Arrendador de las pantallas (obligatorio — ADR 0002) */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <div>
            <div className="text-[13px] font-medium text-ink">Arrendador de estas pantallas</div>
            <div className="text-[12px] text-muted">
              {predioNombre.trim()
                ? 'El predio y su contrato se abrirán a nombre de este arrendador'
                : 'A cada pantalla se le abrirá un contrato pendiente con este arrendador'}
            </div>
          </div>
          <select
            value={arrendadorId}
            onChange={(e) => setArrendadorId(e.target.value)}
            className={cn(inputCls, 'w-56', !arrendadorId && 'border-[#f59e0b]')}
          >
            <option value="">Elige un arrendador…</option>
            {(arrendadores ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>

        {/* Aviso ámbar: falta el arrendador (requisito del ADR 0002). */}
        {!arrendadorId && arrendadores && arrendadores.length > 0 && (
          <div className="flex gap-2.5 rounded-md border border-[#f59e0b40] bg-warning-soft p-3 text-[12px] text-[#9a6700]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              <b>Se requiere el arrendador.</b> Elige el arrendador de estas pantallas
              para poder importarlas: sin él no se puede abrir su contrato de
              arrendamiento, y una pantalla sin contrato no se puede vender.
            </p>
          </div>
        )}

        {/* Predio del lote (OPCIONAL — ADR 0004). Solo el nombre: que estén de
            verdad en el mismo sitio lo comprueba el archivo, no una casilla. */}
        <div className="rounded-md border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-ink">
                Predio <span className="font-normal text-muted">(opcional)</span>
              </div>
              <div className="text-[12px] text-muted">
                {predioNombre.trim()
                  ? predioExistente
                    ? 'Se añadirán al predio que ya existe, bajo su contrato.'
                    : 'Se creará el predio y todas compartirán UN solo contrato.'
                  : 'Sin nombre entran como pantallas sueltas, cada una con su contrato.'}
              </div>
            </div>
            <input
              value={predioNombre}
              onChange={(e) => setPredioNombre(e.target.value)}
              disabled={!arrendadorId}
              list="predios-del-arrendador"
              placeholder="Nombre del predio"
              className={cn(inputCls, 'w-56')}
            />
            {/* Sugiere los que ya tiene este arrendador para no duplicarlos. */}
            <datalist id="predios-del-arrendador">
              {prediosDelArrendador.map((p) => (
                <option key={p.id} value={p.nombre} />
              ))}
            </datalist>
          </div>

          {/* Aviso de coherencia: se calcula al cargar el archivo. */}
          {fueraDelGrupo.length > 0 && (
            <div className="mt-2.5 flex gap-2.5 border-t border-border pt-2.5 text-[12px] text-[#9a6700]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p>
                  <b>
                    {fueraDelGrupo.length === 1
                      ? 'Una pantalla no parece estar en este predio.'
                      : `${fueraDelGrupo.length} pantallas no parecen estar en este predio.`}
                  </b>{' '}
                  Un predio es un solo inmueble y su renta se reparte entre sus
                  pantallas, así que una que está lejos abarataría a las demás.
                  Puedes continuar si sabes que es correcto.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {fueraDelGrupo.slice(0, 6).map((f) => (
                    <li key={f.clave}>· <b className="text-ink">{f.clave}</b>: {f.motivo}</li>
                  ))}
                  {fueraDelGrupo.length > 6 && <li>· …y {fueraDelGrupo.length - 6} más</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {arrendadores && arrendadores.length === 0 && (
          <div className="flex gap-2.5 rounded-md border border-[#9a670033] bg-[#9a67000a] p-3 text-[12px] text-muted">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
            <p>
              No hay arrendadores dados de alta. Crea al menos uno en{' '}
              <b className="text-ink">Arrendadores</b> antes de importar inventario: sin
              arrendador no se puede abrir el contrato de la pantalla.
            </p>
          </div>
        )}

        {/* Precio de impresión por m². Solo si el archivo trae estáticas: la
            impresión es de la lona, y una pantalla digital no lleva lona. Antes
            se preguntaba siempre y en un archivo solo-digital era un campo que
            no se usaba, invitando a capturar un número que no iba a ninguna
            parte. Aparece al cargar el archivo, que es cuando se sabe. */}
        {hayFijas && (
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
        )}

        {/* Info limpieza de encabezados */}
        <div className="flex gap-2.5 rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3 text-[12px] text-muted">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <p>
            Sube el archivo usando la hoja <b className="text-ink">Sitios</b> de la plantilla. El
            sistema lee solo esa hoja, <b className="text-ink">limpia automáticamente los encabezados</b>{' '}
            y <b className="text-ink">agrupa por código de proveedor</b>: una fila por modalidad de
            venta → un sitio con varias modalidades. Requeridos: nombre, exhibición, unidad y tarifa.
          </p>
        </div>

        {/* Aviso central del ADR 0006: una pantalla tiene UN costo. Sin esto, quien
            trae la plantilla vieja no entiende por qué su "costo de compra"
            aparece como renta, y quien trae la nueva no sabe que la columna existe. */}
        <div className="flex gap-2.5 rounded-md border border-border bg-surface-2 p-3 text-[12px] text-muted">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p>
            El costo de una pantalla es <b className="text-ink">uno solo</b>: la columna{' '}
            <b className="text-ink">renta_arrendador</b>, lo que se le paga al dueño del espacio. No
            es la tarifa, que es lo que se le cobra al cliente. Si tu archivo trae la columna vieja{' '}
            <b className="text-ink">costo_compra</b>, su importe se registra como la renta —es el
            mismo dinero— y se te avisa fila por fila. Si no viene ninguna de las dos, el contrato
            queda pendiente de completar en Arrendadores y la pantalla no se podrá reservar.
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
          <p className="mt-1 text-[11px] text-muted">
            Nombra cada archivo con el <b className="text-ink">código de proveedor</b>: <code>codigo.jpg</code> (principal)
            o <code>codigo-1.jpg</code>, <code>codigo-2.jpg</code>… para varias por pantalla.
          </p>
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
