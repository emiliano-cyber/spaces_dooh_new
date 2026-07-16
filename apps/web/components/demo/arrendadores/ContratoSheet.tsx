'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Building2, FileText, Paperclip, X, Loader2 } from 'lucide-react'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import {
  StatusBadge,
  CONTRATO_TONO,
  CONTRATO_LABEL,
  PAGO_TONO,
  PAGO_LABEL,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import {
  useArrendadores,
  useSitios,
  usePagosRenta,
  formatMonto,
  formatFecha,
  diasHasta,
  type ContratoArrendamiento,
  type PagoRenta,
  type TipoIncidencia,
} from '@/lib/data/client'
import {
  registrarPagoRentaApi,
  adjuntarAPagoApi,
  urlAdjuntoPago,
  iniciarRenovacionApi,
  reportarIncidenciaApi,
} from '@/lib/data/estado-api'

const TIPO_INC: { value: TipoIncidencia; label: string }[] = [
  { value: 'LEGAL', label: 'Legal / permiso' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'VANDALISMO', label: 'Vandalismo' },
  { value: 'CLIMA', label: 'Clima' },
  { value: 'SUSPENSION_OPERATIVA', label: 'Suspensión operativa' },
  { value: 'ACCIDENTE', label: 'Accidente' },
  { value: 'OTRO', label: 'Otro' },
]

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ContratoSheet({
  contrato,
  open,
  onOpenChange,
  onToast,
}: {
  contrato: ContratoArrendamiento | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onToast: (msg: string) => void
}) {
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()
  const [incOpen, setIncOpen] = useState(false)
  // Pago cuyo modal está abierto (registrar el pago o adjuntar sus documentos).
  const [pagoActivo, setPagoActivo] = useState<PagoRenta | null>(null)

  if (!contrato) return null
  const arrendador = arrendadores?.find((a) => a.id === contrato.arrendadorId)
  const sitio = sitios?.find((s) => s.id === contrato.sitioId)
  const misPagos = (pagos ?? []).filter((p) => p.contratoId === contrato.id)
  const dias = diasHasta(contrato.fechaFin)

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={arrendador?.nombre ?? 'Contrato'}
        subtitle={sitio ? `${sitio.nombre} · ${sitio.alcaldia}` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIncOpen(true)}>
              <AlertTriangle className="h-4 w-4" /> Reportar incidencia
            </Button>
            {(contrato.estatus === 'POR_VENCER' || dias <= 60) && contrato.estatus !== 'RENOVADO' && (
              <Button
                className="flex-1"
                onClick={async () => {
                  await iniciarRenovacionApi(contrato.id)
                  onToast('Renovación iniciada')
                }}
              >
                <RefreshCw className="h-4 w-4" /> Renovar
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tono={CONTRATO_TONO[contrato.estatus]}>
              {CONTRATO_LABEL[contrato.estatus]}
            </StatusBadge>
            {sitio && (
              <StatusBadge tono={SITIO_TONO[sitio.estatusComercial]}>
                {SITIO_LABEL[sitio.estatusComercial]}
              </StatusBadge>
            )}
          </div>

          {/* Contrato */}
          <div>
            <h4 className="mb-2 text-[13px] font-medium text-ink">Contrato de arrendamiento</h4>
            <dl className="space-y-2 text-[13px]">
              <Fila label="Renta mensual" valor={formatMonto(contrato.montoRenta)} mono />
              <Fila label="Periodicidad" valor={contrato.periodicidad.toLowerCase()} />
              <Fila label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${formatFecha(contrato.fechaFin)}`} mono />
              <Fila
                label="Tiempo restante"
                valor={dias < 0 ? 'Vencido' : `${dias} días`}
              />
              <Fila label="Renovación automática" valor={contrato.autoRenovable ? 'Sí' : 'No'} />
            </dl>
            {contrato.documentoUrl && (
              <a
                href={contrato.documentoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download="contrato.pdf"
                className="mt-2 inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[12px] text-info hover:bg-surface-2"
              >
                <FileText className="h-3.5 w-3.5" /> Ver documento (PDF)
              </a>
            )}
          </div>

          {/* Pagos de renta */}
          <div>
            <h4 className="mb-2 text-[13px] font-medium text-ink">Pagos de renta</h4>
            {misPagos.length === 0 ? (
              <p className="text-[12px] text-muted">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {misPagos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] capitalize text-ink">{p.periodo}</div>
                      <div className="demo-num text-[11px] text-muted">{formatMonto(p.monto)}</div>
                      {/* Qué documentos respaldan el pago (el archivo se pide por su ruta). */}
                      {(p.tieneFactura || p.tieneComprobante) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {p.tieneFactura && (
                            <a
                              href={urlAdjuntoPago(p.id, 'factura')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-info hover:underline"
                            >
                              <FileText className="h-3 w-3" /> Factura
                            </a>
                          )}
                          {p.tieneComprobante && (
                            <a
                              href={urlAdjuntoPago(p.id, 'comprobante')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-info hover:underline"
                            >
                              <FileText className="h-3 w-3" /> Comprobante
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tono={PAGO_TONO[p.estatus]}>{PAGO_LABEL[p.estatus]}</StatusBadge>
                      <Button size="sm" variant="secondary" onClick={() => setPagoActivo(p)}>
                        {p.estatus === 'PAGADO' ? (
                          <><Paperclip className="h-3.5 w-3.5" /> Adjuntos</>
                        ) : (
                          'Registrar'
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Arrendador */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Building2 className="h-3.5 w-3.5 text-muted" /> Arrendador
            </h4>
            <dl className="space-y-2 text-[13px]">
              <Fila label="RUC" valor={arrendador?.rfc ?? '—'} mono />
              <Fila label="Correo" valor={arrendador?.email ?? '—'} />
              <Fila label="Teléfono" valor={arrendador?.telefono ?? '—'} />
            </dl>
          </div>
        </div>
      </Sheet>

      {/* Reportar incidencia → sitio ROJO en Comercial (Acto 2) */}
      {sitio && (
        <ReportarIncidenciaModal
          open={incOpen}
          onOpenChange={setIncOpen}
          sitioNombre={sitio.nombre}
          onSubmit={async (tipo, descripcion) => {
            await reportarIncidenciaApi({ sitioId: sitio.id, tipo, descripcion })
            onToast(`Incidencia reportada · ${sitio.nombre} bloqueado en Comercial`)
            setIncOpen(false)
          }}
        />
      )}

      {pagoActivo && (
        <PagoModal
          open={!!pagoActivo}
          onOpenChange={(v) => !v && setPagoActivo(null)}
          // Se relee del estado para que los adjuntos recién guardados se reflejen.
          pago={(pagos ?? []).find((p) => p.id === pagoActivo.id) ?? pagoActivo}
          onHecho={(msg) => onToast(msg)}
          onError={(msg) => onToast(msg)}
        />
      )}
    </>
  )
}

// ── Adjuntos de pago (factura / comprobante) ────────────────────────────────
// Se mandan como data URL base64, igual que el PDF del contrato. El servidor
// revalida tipo y tamaño: esto es solo para avisar rápido, no es la defensa.
const MAX_ADJUNTO_MB = 5
const TIPOS_OK = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

const METODOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA', 'OTRO']

function AdjuntoInput({
  label,
  valor,
  nombre,
  urlActual,
  onCambio,
  onQuitar,
}: {
  label: string
  valor: string | null            // data URL recién elegido (aún sin guardar)
  nombre: string | null
  urlActual: string | null        // adjunto ya guardado (se abre por su ruta)
  onCambio: (dataUrl: string, nombre: string) => void
  onQuitar: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setErr(null)
    if (!TIPOS_OK.includes(f.type)) {
      setErr('Debe ser un PDF o una imagen (PNG, JPG o WebP)')
      e.target.value = ''
      return
    }
    if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) {
      setErr(`El archivo supera ${MAX_ADJUNTO_MB} MB`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => onCambio(reader.result as string, f.name)
    reader.onerror = () => setErr('No se pudo leer el archivo')
    reader.readAsDataURL(f)
  }
  const hayNuevo = !!valor
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {hayNuevo ? (
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-2.5 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="truncate">{nombre ?? 'Archivo listo'}</span>
          </span>
          <button type="button" onClick={onQuitar} className="shrink-0 text-muted hover:text-ink" aria-label="Quitar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[12px] text-ink hover:bg-surface-2">
            <Paperclip className="h-3.5 w-3.5 text-muted" />
            {urlActual ? 'Reemplazar' : 'Adjuntar'}
            <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" />
          </label>
          {urlActual && (
            <>
              <a
                href={urlActual}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-info hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> Ver
              </a>
              <button
                type="button"
                onClick={onQuitar}
                className="text-[12px] text-muted hover:text-error"
              >
                Quitar
              </button>
            </>
          )}
          {!urlActual && <span className="text-[12px] text-muted">Sin archivo</span>}
        </div>
      )}
      {err && <p className="mt-1 text-[11px] text-error">{err}</p>}
    </div>
  )
}

// Registra un pago (fecha, método y adjuntos) o edita solo los adjuntos de uno
// ya pagado: la factura del arrendador suele llegar días después del pago.
function PagoModal({
  open,
  onOpenChange,
  pago,
  onHecho,
  onError,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pago: PagoRenta
  onHecho: (msg: string) => void
  onError: (msg: string) => void
}) {
  const yaPagado = pago.estatus === 'PAGADO'
  const hoy = new Date().toISOString().slice(0, 10)
  const [fechaPago, setFechaPago] = useState(hoy)
  const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA')
  const [observaciones, setObservaciones] = useState(pago.observaciones ?? '')
  const [factura, setFactura] = useState<{ url: string; nombre: string } | null>(null)
  const [comprobante, setComprobante] = useState<{ url: string; nombre: string } | null>(null)
  // Borrado explícito de un adjunto ya guardado (null en el PATCH).
  const [borrar, setBorrar] = useState<{ factura?: boolean; comprobante?: boolean }>({})
  const [enviando, setEnviando] = useState(false)

  const facturaGuardada = pago.tieneFactura && !borrar.factura ? urlAdjuntoPago(pago.id, 'factura') : null
  const comprobanteGuardado =
    pago.tieneComprobante && !borrar.comprobante ? urlAdjuntoPago(pago.id, 'comprobante') : null

  async function guardar() {
    setEnviando(true)
    try {
      if (yaPagado) {
        await adjuntarAPagoApi(pago.id, {
          // undefined = no tocar; null = borrar.
          facturaUrl: factura ? factura.url : borrar.factura ? null : undefined,
          comprobanteUrl: comprobante ? comprobante.url : borrar.comprobante ? null : undefined,
          observaciones: observaciones.trim() || null,
        })
        onHecho('Adjuntos guardados')
      } else {
        await registrarPagoRentaApi(pago.id, {
          fechaPago,
          metodoPago,
          facturaUrl: factura?.url ?? null,
          comprobanteUrl: comprobante?.url ?? null,
          observaciones: observaciones.trim() || null,
        })
        onHecho('Pago registrado')
      }
      onOpenChange(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={yaPagado ? 'Adjuntos del pago' : 'Registrar pago'}
      subtitle={`${pago.periodo} · ${formatMonto(pago.monto)}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={enviando}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {yaPagado ? 'Guardar adjuntos' : 'Registrar pago'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {yaPagado ? (
          <p className="rounded border border-border bg-surface-2 p-2 text-[12px] text-muted">
            Pagado el {pago.fechaPago ? formatFecha(pago.fechaPago) : '—'}
            {pago.metodoPago ? ` · ${pago.metodoPago.toLowerCase()}` : ''}. Aquí solo se adjuntan los
            documentos: el pago no se vuelve a registrar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink">Fecha de pago</span>
              <input type="date" max={hoy} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink">Método de pago</span>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputCls}>
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <AdjuntoInput
          label="Factura del arrendador"
          valor={factura?.url ?? null}
          nombre={factura?.nombre ?? null}
          urlActual={facturaGuardada}
          onCambio={(url, nombre) => { setFactura({ url, nombre }); setBorrar((b) => ({ ...b, factura: false })) }}
          onQuitar={() => { setFactura(null); setBorrar((b) => ({ ...b, factura: true })) }}
        />
        <AdjuntoInput
          label="Comprobante de pago"
          valor={comprobante?.url ?? null}
          nombre={comprobante?.nombre ?? null}
          urlActual={comprobanteGuardado}
          onCambio={(url, nombre) => { setComprobante({ url, nombre }); setBorrar((b) => ({ ...b, comprobante: false })) }}
          onQuitar={() => { setComprobante(null); setBorrar((b) => ({ ...b, comprobante: true })) }}
        />

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Observaciones</span>
          <textarea
            className="min-h-[60px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Opcional"
            maxLength={500}
          />
        </label>
        <p className="text-[12px] text-muted">PDF o imagen, hasta {MAX_ADJUNTO_MB} MB por archivo.</p>
      </div>
    </Modal>
  )
}

function ReportarIncidenciaModal({
  open,
  onOpenChange,
  sitioNombre,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sitioNombre: string
  onSubmit: (tipo: TipoIncidencia, descripcion: string) => void
}) {
  const [tipo, setTipo] = useState<TipoIncidencia>('LEGAL')
  const [desc, setDesc] = useState('')
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reportar incidencia"
      subtitle={sitioNombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onSubmit(tipo, desc.trim() || 'Incidencia reportada desde Arrendadores.')}
          >
            Reportar y bloquear sitio
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)}>
            {TIPO_INC.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Descripción</span>
          <textarea
            className="min-h-[80px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe la incidencia…"
          />
        </label>
        <p className="text-[12px] text-muted">
          Al reportar, el sitio pasa a <span className="font-medium text-error">bloqueado</span> y
          aparece en rojo en el mapa de Comercial al instante.
        </p>
      </div>
    </Modal>
  )
}

function Fila({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? 'demo-num text-ink' : 'text-ink'}>{valor}</dd>
    </div>
  )
}
