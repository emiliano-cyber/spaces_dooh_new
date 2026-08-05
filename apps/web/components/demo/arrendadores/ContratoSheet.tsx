'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Building2, FileText, Paperclip, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Modal } from '@/components/demo/ui/Modal'
import { LicenciasCard } from '@/components/demo/arrendadores/LicenciasCard'
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
  useRazonesSociales,
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
  editarContratoApi,
} from '@/lib/data/estado-api'
import { PERIODICIDADES, periodicidadLabel } from '@/lib/renta-periodicidad'

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
  const [completarOpen, setCompletarOpen] = useState(false)
  // Pago cuyo modal está abierto (registrar el pago o adjuntar sus documentos).
  const [pagoActivo, setPagoActivo] = useState<PagoRenta | null>(null)

  if (!contrato) return null
  const arrendador = arrendadores?.find((a) => a.id === contrato.arrendadorId)
  const sitio = sitios?.find((s) => s.id === contrato.sitioId)
  const misPagos = (pagos ?? []).filter((p) => p.contratoId === contrato.id)
  const dias = contrato.fechaFin ? diasHasta(contrato.fechaFin) : 0

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
            {/* ADR 0001: un contrato INCOMPLETO no se renueva (no hay acuerdo
                que extender). Además su `dias` es 0 por no tener fecha de fin,
                así que `dias <= 60` lo colaba aquí y el servidor respondía con
                un error de base de datos. */}
            {contrato.estatus !== 'INCOMPLETO' &&
              (contrato.estatus === 'POR_VENCER' || dias <= 60) && contrato.estatus !== 'RENOVADO' && (
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
          {contrato.estatus === 'INCOMPLETO' && (
            <div className="rounded border border-warning/40 bg-warning-soft p-2.5 text-[12.5px] text-ink">
              <p>
                Este contrato se abrió automáticamente al vender la pantalla, para que no
                quedara sin registro. Falta capturar el arrendador, el importe de la renta,
                la periodicidad y la fecha de fin. Mientras tanto no cuenta como costo en el
                P&amp;L ni genera calendario de pagos.
              </p>
              {/* El aviso decía qué faltaba pero no dejaba hacer nada al
                  respecto: había que salir a buscar dónde se editaba. La acción
                  va aquí, pegada al problema que describe. */}
              <Button size="sm" className="mt-2" onClick={() => setCompletarOpen(true)}>
                <FileText className="h-3.5 w-3.5" /> Completar información
              </Button>
            </div>
          )}
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
              {/* Contrato INCOMPLETO (ADR 0001): estos campos aún no existen.
                  Se marcan como pendientes en vez de mostrar 0 o una fecha
                  inventada, que se leerían como dato real. */}
              <Fila label="Renta mensual" valor={contrato.montoRenta != null ? formatMonto(contrato.montoRenta) : 'Por definir'} mono />
              <Fila label="Periodicidad" valor={contrato.periodicidad ? contrato.periodicidad.toLowerCase() : 'Por definir'} />
              <Fila label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${contrato.fechaFin ? formatFecha(contrato.fechaFin) : 'por definir'}`} mono />
              <Fila
                label="Tiempo restante"
                valor={!contrato.fechaFin ? '—' : dias < 0 ? 'Vencido' : `${dias} días`}
              />
              <Fila label="Renovación automática" valor={contrato.autoRenovable ? 'Sí' : 'No'} />
            </dl>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* Documento REDACTADO por el sistema a partir del expediente.
                  Se abre en pestaña nueva porque vive fuera del shell (sin
                  navegación) para poder imprimirse limpio. */}
              <a
                href={`/spaces-dooh/contrato/${contrato.id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[12px] text-info hover:bg-surface-2"
              >
                <FileText className="h-3.5 w-3.5" /> Generar contrato
              </a>
              {/* Documento FIRMADO que se subió, si lo hay. Es otra cosa: uno es
                  el borrador que produce el sistema, el otro el papel firmado. */}
              {contrato.documentoUrl && (
                <a
                  href={contrato.documentoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="contrato.pdf"
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[12px] text-info hover:bg-surface-2"
                >
                  <FileText className="h-3.5 w-3.5" /> Ver documento firmado (PDF)
                </a>
              )}
            </div>
          </div>

          {/* Licencias y permisos del emplazamiento. Se anclan igual que el
              contrato: al predio si la pantalla pertenece a uno —y entonces
              amparan a todas sus hermanas— o a la pantalla suelta. */}
          <LicenciasCard
            predioId={contrato.predioId ?? null}
            sitioId={contrato.predioId ? null : contrato.sitioId}
            onToast={onToast}
          />

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
                      {/* `periodo` es una fecha YYYY-MM-DD, no un nombre de mes: se imprimía
                          cruda («2026-07-16») junto a otras vistas que ya usaban
                          dd/mm/aaaa (M8). El `capitalize` sobraba — era de cuando
                          esto guardaba «agosto 2026». */}
                      <div className="text-[13px] text-ink">{formatFecha(p.periodo)}</div>
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

      <CompletarContratoModal
        open={completarOpen}
        onOpenChange={setCompletarOpen}
        contrato={contrato}
        onHecho={onToast}
      />
    </>
  )
}

// ── Completar un contrato INCOMPLETO (ADR 0001) ─────────────────────────────
//
// El contrato nace sin arrendador, importe, periodicidad ni fecha de fin: lo
// abre el sistema al dar de alta o vender la pantalla, para dejar constancia de
// que hay un espacio del que alguien cobra renta. Este formulario es el que
// cierra ese pendiente, y pide EXACTAMENTE esos cuatro datos porque son los que
// exige el CHECK `contrato_completo_ck` para cualquier estatus que afirme un
// acuerdo real.
//
// No es un editor general del contrato: la fecha de inicio, la moneda o el PDF
// se editan en otro sitio. Mezclarlo todo aquí convertiría "completa lo que
// falta" en "revisa doce campos", que es justo la fricción por la que estos
// contratos se quedaban sin completar.
function CompletarContratoModal({
  open,
  onOpenChange,
  contrato,
  onHecho,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contrato: ContratoArrendamiento
  onHecho: (msg: string) => void
}) {
  const arrendadores = useArrendadores()
  const razones = useRazonesSociales()
  // Se prellena con lo que YA tenga: un contrato puede estar incompleto por
  // faltarle solo la fecha de fin, y volver a pedir el resto sería absurdo.
  const [arrendadorId, setArrendadorId] = useState(contrato.arrendadorId ?? '')
  const [monto, setMonto] = useState(contrato.montoRenta != null ? String(contrato.montoRenta) : '')
  const [periodicidad, setPeriodicidad] = useState(contrato.periodicidad ?? 'MENSUAL')
  const [fechaFin, setFechaFin] = useState(contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : '')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Datos del arrendador ELEGIDO. El selector solo mostraba su nombre, y el
  // nombre no dice si se le va a poder pagar: la renta se factura contra una
  // razón social con RFC y régimen, y eso vive en `arrendador_razon_social`, no
  // en el arrendador. Quien completa el contrato aquí es quien puede ir a
  // pedir el dato que falte, y después ya no vuelve a pasar por esta pantalla.
  const elegido = (arrendadores ?? []).find((a) => a.id === arrendadorId) ?? null
  const razonesDelElegido = (razones ?? []).filter((r) => r.arrendadorId === arrendadorId)
  const razonPrincipal = razonesDelElegido[0] ?? null
  // Falta = no se podrá emitir el pago de la renta. NO bloquea: el contrato es
  // un acuerdo real aunque el dato fiscal se capture después, y bloquear aquí
  // devolvería estos contratos al limbo del que este formulario los saca.
  const faltaFiscal = elegido
    ? [
        !razonPrincipal ? 'razón social' : null,
        !(razonPrincipal?.rfc ?? elegido.rfc) ? 'RFC' : null,
        !razonPrincipal?.regimen ? 'régimen fiscal' : null,
      ].filter(Boolean) as string[]
    : []

  const inicio = contrato.fechaInicio.slice(0, 10)
  const montoNum = Number(monto)
  // El servidor valida esto igual (zod + CHECK en la BD); aquí solo se avisa
  // antes de gastar un viaje, y se deshabilita el botón para que no parezca que
  // guardar "no hizo nada".
  const faltante =
    !arrendadorId ? 'Elige el arrendador: es de quien se renta el espacio.'
    : !monto || !Number.isFinite(montoNum) || montoNum <= 0 ? 'Captura un importe de renta mayor que cero.'
    : !fechaFin ? 'Captura hasta cuándo va el contrato.'
    : fechaFin < inicio ? `La fecha de fin no puede ser anterior al inicio (${formatFecha(inicio)}).`
    : null

  async function guardar() {
    if (faltante) return
    setEnviando(true)
    setError(null)
    try {
      await editarContratoApi(contrato.id, {
        arrendadorId,
        montoRenta: montoNum,
        periodicidad,
        fechaFin,
      })
      // Al quedar completo el servidor recalcula el estatus por fechas y genera
      // el calendario de pagos, así que conviene decirlo: es la consecuencia
      // visible que el usuario va a buscar después.
      onHecho('Contrato completado · se generó su calendario de pagos')
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el contrato')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Completar contrato de arrendamiento"
      subtitle="Los cuatro datos que faltan para que cuente como acuerdo real"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={enviando || !!faltante}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar contrato
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Arrendador</span>
          <select
            className={inputCls}
            value={arrendadorId}
            onChange={(e) => setArrendadorId(e.target.value)}
          >
            <option value="">Elige el arrendador…</option>
            {(arrendadores ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>

        {/* Ficha del arrendador elegido: se ve ANTES de guardar, que es cuando
            todavía se puede cambiar de opinión o ir a capturar lo que falte. */}
        {elegido && (
          <div className="rounded-md border border-border bg-surface-2 p-2.5 text-[12px]">
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              <DatoArrendador etiqueta="Razón social" valor={razonPrincipal?.razonSocial} />
              <DatoArrendador etiqueta="RFC" valor={razonPrincipal?.rfc ?? elegido.rfc} mono />
              <DatoArrendador etiqueta="Régimen fiscal" valor={razonPrincipal?.regimen} />
              <DatoArrendador etiqueta="Correo" valor={elegido.email} />
              <DatoArrendador etiqueta="Teléfono" valor={elegido.telefono} />
            </div>
            {razonesDelElegido.length > 1 && (
              <p className="mt-1.5 text-[11px] text-muted">
                Tiene {razonesDelElegido.length} razones sociales; se muestra la primera.
                Cuál factura este contrato se elige en su ficha.
              </p>
            )}
            {faltaFiscal.length > 0 && (
              <p className="mt-2 flex gap-1.5 border-t border-border pt-2 text-[11px] text-[#9a6700]">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Le falta {faltaFiscal.join(', ')}. Puedes guardar el contrato igual, pero
                  sin eso no se le podrá facturar la renta cuando toque pagarle.
                </span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Importe de la renta</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Cada cuándo se paga</span>
            <select
              className={inputCls}
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value)}
            >
              {PERIODICIDADES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Desde</span>
            {/* La fecha de inicio ya existe (la puso el sistema al abrir el
                contrato) y NO se toca aquí: moverla recalcularía todo el
                calendario de pagos. Se muestra para que la de fin se capture
                con referencia. */}
            <div className="demo-num flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">
              {formatFecha(inicio)}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Hasta</span>
            <input
              type="date"
              min={inicio}
              className={inputCls}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </label>
        </div>

        <p className="rounded border border-border bg-surface-2 p-2 text-[12px] text-muted">
          Al guardar, el contrato deja de estar incompleto: empieza a contar como costo de
          renta en el P&amp;L y se genera su calendario de pagos
          {periodicidad ? ` ${periodicidadLabel(periodicidad).toLowerCase()}` : ''}.
        </p>

        {/* El aviso de lo que falta es informativo mientras se captura; el error
            del servidor (p. ej. sesión bloqueada por control de cambios) manda. */}
        {error ? (
          <p className="text-[12px] text-error">{error}</p>
        ) : faltante ? (
          <p className="text-[12px] text-muted">{faltante}</p>
        ) : null}
      </div>
    </Modal>
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
      subtitle={`${formatFecha(pago.periodo)} · ${formatMonto(pago.monto)}`}
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

// Un dato del arrendador en la ficha de «Completar contrato». El guión medio no
// es decorativo: distingue «no lo tiene capturado» de que el campo no exista.
function DatoArrendador({
  etiqueta, valor, mono = false,
}: { etiqueta: string; valor?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{etiqueta}</span>
      <span className={cn('text-right text-ink', mono && 'demo-num', !valor && 'text-muted')}>
        {valor || '—'}
      </span>
    </div>
  )
}
