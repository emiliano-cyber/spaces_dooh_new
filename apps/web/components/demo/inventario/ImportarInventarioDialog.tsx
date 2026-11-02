'use client'

import { toast } from 'sonner'
import { simboloMoneda } from '@/lib/i18n/dinero'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { CLAVE_ESTADO_FILA } from './etiquetas'
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
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { CRUDO_INVALIDO } from '@/lib/captura-cifra'
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
  const { idioma, t } = useIdioma()
  const [arrendadorId, setArrendadorId] = useState('')
  // v0.12.3 · el lote son pantallas PROPIAS: sin arrendador ni contrato.
  const [propio, setPropio] = useState(false)
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
  // Un lugar PROPIO no tiene arrendador (v0.12.3): en un lote propio se ofrecen esos.
  const prediosDelArrendador = (predios ?? []).filter((p) =>
    propio ? !p.arrendadorId : p.arrendadorId === arrendadorId,
  )
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

  // Un precio por m² que no se entiende llega como 'NaN' (CampoCifra) y
  // `Number` lo mandaría como NaN, que JSON convierte en null: el lote se
  // importaría SIN precio sin que nadie lo pidiera.
  const precioM2Invalido = precioM2 === CRUDO_INVALIDO
  // OBLIG-01: el arrendador y el archivo son obligatorios (`importSchema` en
  // `lib/server/sitios-controller.ts:184-191`: `filas` min 1 y `arrendadorId`
  // uuid). El botón ya no se apaga por ellos: se pulsa y se pinta el que falta.
  const ob = useObligatorios({ arrendadorId, filas }, [{ campo: 'arrendadorId', si: !propio }, 'filas'])

  function reset() {
    ob.reiniciar()
    setFilas(null)
    setArchivoNombre('')
    setImagenes({})
    setSummary(null)
    setModo('ACTUALIZAR')
    setArrendadorId('')
    setPropio(false)
    setPredioNombre('')
  }

  async function procesarArchivo(f: File) {
    setLeyendo(true)
    setArchivoNombre(f.name)
    try {
      setFilas(await validarArchivo(f))
    } catch {
      toast.error(t('inventario.carga.no-leer'))
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
    if (!ob.validar() || !filas) return
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
        propio,
        arrendadorId: propio ? null : arrendadorId,
        predio: predioDelLote,
        modoDuplicado: modo,
        precioM2: precioM2 ? Number(precioM2) : null,
        imagenes: Object.keys(imagenesPorArchivo).length ? imagenesPorArchivo : undefined,
      })
      setSummary(res)
      onImportado?.(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('inventario.carga.no-importar'))
    } finally {
      setProcesando(false)
    }
  }

  const totalImagenes = Object.keys(imagenes).length

  const footer = (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted">
        {filas && !propio && !arrendadorId
          ? t('inventario.carga.falta-arrendador')
          : filas
            ? t(filas.length === 1 ? 'inventario.carga.filas.uno' : 'inventario.carga.filas.otros', { n: filas.length })
            : t('inventario.carga.sin-archivo')}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => { reset(); if (!inline) onOpenChange(false) }}>
          {inline ? t('inventario.tabla.limpiar') : t('inventario.carga.cerrar')}
        </Button>
        <Button size="sm" disabled={precioM2Invalido || procesando || !!summary} onClick={procesar}>
          {procesando ? t('inventario.carga.procesando') : t('inventario.carga.procesar')}
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
            <div className="text-[13px] font-medium text-ink">{t('inventario.carga.primera-vez')}</div>
            <div className="text-[12px] text-muted">{t('inventario.carga.descarga-plantilla')}</div>
          </div>
          <a
            href={PLANTILLA_URL}
            download
            className="inline-flex h-8 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-2"
          >
            <Download className="h-3.5 w-3.5" /> {t('inventario.carga.descargar-plantilla')}
          </a>
        </div>

        {/* v0.12.3 · ¿son pantallas propias? Entonces no hay arrendador que elegir. */}
        <label className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] text-ink">
          <input type="checkbox" className="mt-0.5" checked={propio} onChange={(e) => setPropio(e.target.checked)} />
          <span>
            <span className="font-medium">{t('inventario.carga.propias')}</span>
            <span className="block text-[12px] text-muted">
              {t('inventario.carga.propias-ayuda')}
            </span>
          </span>
        </label>

        {!propio && (<>
        {/* Arrendador de las pantallas (obligatorio — ADR 0002) */}
        {/* No es un `Campo` porque el bloque es tarjeta (título a la izquierda,
            selector a la derecha) y meterlo en uno lo rediseñaría. Lleva el
            mismo asterisco y el mismo `data-falta`, que es lo que pinta el
            <select> de rojo en `globals.css`. */}
        <div
          data-falta={ob.falta('arrendadorId') ? 'true' : undefined}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
        >
          <div>
            <div className={cn('text-[13px] font-medium', ob.falta('arrendadorId') ? 'text-error' : 'text-ink')}>
              {t('inventario.carga.arrendador')}
              <span aria-hidden="true" className="ml-0.5 text-error">*</span>
              <span className="sr-only">{t('comercial.comun.obligatorio')}</span>
            </div>
            <div className="text-[12px] text-muted">
              {predioNombre.trim()
                ? t('inventario.carga.arrendador-predio')
                : t('inventario.carga.arrendador-sueltas')}
            </div>
          </div>
          <select
            value={arrendadorId}
            onChange={(e) => setArrendadorId(e.target.value)}
            className={cn(inputCls, 'w-56', !arrendadorId && 'border-[#f59e0b]')}
          >
            <option value="">{t('inventario.alta.elige-arrendador')}</option>
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
              {interpolarNodos(t('inventario.carga.requiere'), { titulo: <b>{t('inventario.carga.requiere-titulo')}</b> })}
            </p>
          </div>
        )}
        </>)}

        {/* Predio del lote (OPCIONAL — ADR 0004). Solo el nombre: que estén de
            verdad en el mismo sitio lo comprueba el archivo, no una casilla. */}
        <div className="rounded-md border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-ink">
                {t('inventario.carga.predio')}
              </div>
              <div className="text-[12px] text-muted">
                {predioNombre.trim()
                  ? predioExistente
                    ? t('inventario.carga.predio-existente')
                    : t('inventario.carga.predio-nuevo')
                  : t('inventario.carga.predio-sin')}
              </div>
            </div>
            <input
              value={predioNombre}
              onChange={(e) => setPredioNombre(e.target.value)}
              disabled={!arrendadorId}
              list="predios-del-arrendador"
              placeholder={t('inventario.carga.predio-ph')}
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
                      ? t('inventario.carga.lejos-una')
                      : t('inventario.carga.lejos-varias', { n: formatNumero(fueraDelGrupo.length) })}
                  </b>{' '}
                  {t('inventario.carga.lejos-explica')}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {fueraDelGrupo.slice(0, 6).map((f) => (
                    <li key={f.clave}>· <b className="text-ink">{f.clave}</b>: {f.motivo}</li>
                  ))}
                  {fueraDelGrupo.length > 6 && <li>{t('inventario.carga.lejos-mas', { n: fueraDelGrupo.length - 6 })}</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {arrendadores && arrendadores.length === 0 && (
          <div className="flex gap-2.5 rounded-md border border-[#9a670033] bg-[#9a67000a] p-3 text-[12px] text-muted">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
            <p>
              {interpolarNodos(t('inventario.carga.sin-arrendadores'), {
                arrendadores: <b className="text-ink">{t('inventario.carga.arrendadores')}</b>,
              })}
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
            <div className="text-[13px] font-medium text-ink">{t('inventario.carga.precio-m2')}</div>
            <div className="text-[12px] text-muted">{t('inventario.carga.precio-m2-ayuda')}</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted">{simboloMoneda(idioma)}</span>
            <CampoCifra
              valor={precioM2}
              onCambio={(crudo) => setPrecioM2(crudo)}
              mostrarError={false}
              placeholder="65"
              className="h-9 w-20 rounded border border-border-strong bg-surface px-2 text-right text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent demo-num"
            />
            <span className="text-[13px] text-muted">/m²</span>
          </div>
        </div>
        )}
        {precioM2Invalido && (
          <p className="text-[11px] text-error">
            {t('inventario.carga.precio-m2-ilegible')}
          </p>
        )}

        {/* Info limpieza de encabezados */}
        <div className="flex gap-2.5 rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3 text-[12px] text-muted">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <p>
            {/* «Sitios» es el NOMBRE de la hoja de la plantilla: no se traduce. */}
            {interpolarNodos(t('inventario.carga.hoja'), {
              hoja: <b className="text-ink">Sitios</b>,
              limpia: <b className="text-ink">{t('inventario.carga.hoja-limpia')}</b>,
              agrupa: <b className="text-ink">{t('inventario.carga.hoja-agrupa')}</b>,
            })}
          </p>
        </div>

        {/* Aviso central del ADR 0006: una pantalla tiene UN costo. Sin esto, quien
            trae la plantilla vieja no entiende por qué su "costo de compra"
            aparece como renta, y quien trae la nueva no sabe que la columna existe. */}
        <div className="flex gap-2.5 rounded-md border border-border bg-surface-2 p-3 text-[12px] text-muted">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p>
            {/* Los nombres de las columnas son los de la plantilla: no se traducen. */}
            {interpolarNodos(t('inventario.carga.costo'), {
              uno: <b className="text-ink">{t('inventario.carga.costo-uno')}</b>,
              renta: <b className="text-ink">renta_arrendador</b>,
              costo: <b className="text-ink">costo_compra</b>,
            })}
          </p>
        </div>

        {/* Codificación */}
        <Campo label={t('inventario.carga.codificacion')}>
          <select className={inputCls} value={codificacion} onChange={(e) => setCodificacion(e.target.value)}>
            <option value="utf-8">UTF-8 (Universal)</option>
            <option value="latin1">Latin-1 / ISO-8859-1</option>
            <option value="windows-1252">Windows-1252</option>
          </select>
          <span className="mt-1 block text-[11px] text-muted">
            {t('inventario.carga.codificacion-ayuda')}
          </span>
        </Campo>

        {/* Zona drag-drop. El archivo es obligatorio; su <input> va oculto, así
            que el rojo de `[data-falta]` se pinta en el borde de la zona. */}
        <Campo label={t('inventario.carga.archivo')} obligatorio falta={ob.falta('filas')} como="div">
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
            arrastrando
              ? 'border-accent bg-[#f59e0b0a]'
              : ob.falta('filas')
                ? 'border-error hover:bg-surface-2'
                : 'border-border-strong hover:bg-surface-2',
          )}
        >
          <Upload className="h-6 w-6 text-muted" />
          <span className="text-[13px] text-ink">
            {leyendo ? t('inventario.carga.leyendo') : archivoNombre || t('inventario.carga.arrastra')}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t('inventario.carga.formatos')}
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onArchivo} className="hidden" />
        </label>
        </Campo>

        {/* Imágenes en bulk */}
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">{t('inventario.carga.imagenes')}</span>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border-strong px-3 py-2 text-[13px] text-muted hover:bg-surface-2">
            <ImageIcon className="h-4 w-4" />
            {totalImagenes > 0
              ? t(totalImagenes === 1 ? 'inventario.carga.imagenes-cargadas.uno' : 'inventario.carga.imagenes-cargadas.otros', {
                  n: totalImagenes,
                })
              : t('inventario.carga.subir-imagenes')}
            <input type="file" accept="image/jpeg,image/png" multiple onChange={onImagenes} className="hidden" />
          </label>
          <p className="mt-1 text-[11px] text-muted">
            {interpolarNodos(t('inventario.carga.nombra'), {
              codigo: <b className="text-ink">{t('inventario.carga.codigo-proveedor')}</b>,
              a: <code>codigo.jpg</code>,
              b: <code>codigo-1.jpg</code>,
              c: <code>codigo-2.jpg</code>,
            })}
          </p>
        </div>

        {/* Duplicados */}
        {filas && duplicados.length > 0 && !summary && (
          <div className="rounded-md border border-[#f59e0b40] bg-[#f59e0b0a] p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t('inventario.carga.duplicados', { n: duplicados.length })}
            </div>
            <p className="mb-2 text-[12px] text-muted">{t('inventario.carga.como-proceder')}</p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="radio" name="modo" checked={modo === 'ACTUALIZAR'} onChange={() => setModo('ACTUALIZAR')} className="mt-0.5 accent-[var(--accent)]" />
                <span>{interpolarNodos(t('inventario.carga.actualizar'), { accion: <b>{t('inventario.carga.actualizar-accion')}</b> })}</span>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="radio" name="modo" checked={modo === 'NUEVA_VERSION'} onChange={() => setModo('NUEVA_VERSION')} className="mt-0.5 accent-[var(--accent)]" />
                <span>{interpolarNodos(t('inventario.carga.nueva'), { accion: <b>{t('inventario.carga.nueva-accion')}</b> })}</span>
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
              <Resumen label={t('campanas.comun.total')} n={summary.total_filas} />
              <Resumen label={t('inventario.carga.resumen.creadas')} n={summary.creadas} tono="verde" />
              <Resumen label={t('inventario.carga.resumen.actualizadas')} n={summary.actualizadas} tono="azul" />
              <Resumen label={t('inventario.carga.resumen.advertencias')} n={summary.con_advertencias} tono="ambar" />
              <Resumen label={t('inventario.carga.resumen.errores')} n={summary.errores} tono="rojo" />
            </div>
            {sitiosAfectados.length > 0 && (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setVerInfo(true)}>
                <Eye className="h-3.5 w-3.5" /> {t('inventario.carga.ver-info', { n: sitiosAfectados.length })}
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
        title={t('inventario.carga.titulo')}
        subtitle={t('inventario.carga.sub')}
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
      title={t('inventario.carga.titulo')}
      subtitle={t('inventario.carga.sub')}
      footer={footer}
    >
      {cuerpo}
    </Modal>
  )
}

function FilasTabla({ filas }: { filas: FilaValidada[] }) {
  const { t } = useIdioma()
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        {t('inventario.carga.vista-previa')}
      </div>
      <ul className="max-h-40 overflow-y-auto">
        {filas.map((f, i) => (
          <li key={i} className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[12px] last:border-0">
            <span className="demo-num truncate text-ink">{f.codigo_proveedor}</span>
            <span className={cn('shrink-0 font-medium', STATUS_STYLE[f.status === 'ok' ? 'creado' : f.status])}>
              {t(CLAVE_ESTADO_FILA[f.status])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultadoTabla({ detalle }: { detalle: ImportSummary['detalle'] }) {
  const { t } = useIdioma()
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <ul className="max-h-48 overflow-y-auto">
        {detalle.map((d, i) => (
          <li key={i} className="border-b border-border px-3 py-1.5 text-[12px] last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="demo-num truncate text-ink">{d.codigo_proveedor}</span>
              <span className={cn('shrink-0 font-medium', STATUS_STYLE[d.status])}>{t(CLAVE_ESTADO_FILA[d.status])}</span>
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
