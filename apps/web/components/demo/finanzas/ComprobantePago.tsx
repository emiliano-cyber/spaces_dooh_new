'use client'

import { useEffect, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { formatMonto, formatFecha } from '@/lib/data/client'
import {
  listarAbonosApi,
  adjuntarComprobanteAbonoApi,
  urlComprobanteAbono,
  type AbonoCobranzaUI,
} from '@/lib/data/estado-api'

// ============================================================================
//  COB-COMP · el comprobante de un pago de cliente (recibo, transferencia).
//
//  Dos piezas: el campo para elegir el archivo, que usa el cuadro «Registrar
//  pago», y la lista de pagos de una cobranza, donde se ve cada comprobante y
//  se sube el que llegó después. Los límites son los del comprobante de un pago
//  de renta (`ContratoSheet.tsx`); el servidor los vuelve a validar, esto es
//  solo para avisar rápido.
// ============================================================================

const MAX_MB = 5
const TIPOS_OK = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

function leerArchivo(
  e: React.ChangeEvent<HTMLInputElement>,
  alLeer: (dataUrl: string, nombre: string) => void,
  alFallar: (msg: string) => void,
) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  if (!TIPOS_OK.includes(f.type)) return alFallar('Debe ser un PDF o una imagen (PNG, JPG o WebP)')
  if (f.size > MAX_MB * 1024 * 1024) return alFallar(`El archivo supera ${MAX_MB} MB`)
  const reader = new FileReader()
  reader.onload = () => alLeer(reader.result as string, f.name)
  reader.onerror = () => alFallar('No se pudo leer el archivo')
  reader.readAsDataURL(f)
}

/** El campo «Comprobante de pago» del cuadro de registrar pago. Opcional. */
export function CampoComprobante({
  nombre,
  disabled,
  onCambio,
  onQuitar,
}: {
  /** Nombre del archivo elegido; null = ninguno. */
  nombre: string | null
  disabled?: boolean
  onCambio: (dataUrl: string, nombre: string) => void
  onQuitar: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-ink">
        Comprobante de pago
      </span>
      {nombre ? (
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-2.5 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="truncate">{nombre}</span>
          </span>
          {!disabled && (
            <button type="button" onClick={onQuitar} className="shrink-0 text-muted hover:text-ink" aria-label="Quitar">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={
            'inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[12px] text-ink ' +
            (disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2')
          }
        >
          <Paperclip className="h-3.5 w-3.5 text-muted" />
          Adjuntar PDF o imagen
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            disabled={disabled}
            onChange={(e) => {
              setErr(null)
              leerArchivo(e, onCambio, setErr)
            }}
            className="hidden"
          />
        </label>
      )}
      {err && <p className="mt-1 text-[11px] text-error">{err}</p>}
    </div>
  )
}

/** Los pagos de una cobranza, cada uno con su comprobante. */
export function PagosCobranzaModal({
  cobranzaId,
  folio,
  puedeAdjuntar,
  onClose,
}: {
  cobranzaId: string
  folio: string
  /** `finanzas.crear`: quien puede registrar pagos puede subir su comprobante. */
  puedeAdjuntar: boolean
  onClose: () => void
}) {
  const [abonos, setAbonos] = useState<AbonoCobranzaUI[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<string | null>(null)

  async function cargar() {
    try {
      setAbonos(await listarAbonosApi(cobranzaId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos')
    }
  }
  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobranzaId])

  async function subir(abonoId: string, dataUrl: string) {
    setSubiendo(abonoId)
    setError(null)
    try {
      await adjuntarComprobanteAbonoApi(cobranzaId, abonoId, dataUrl)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el comprobante')
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Pagos recibidos"
      subtitle={folio}
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      {abonos === null ? (
        <p className="text-[12px] text-muted">{error ? '' : 'Cargando…'}</p>
      ) : abonos.length === 0 ? (
        <p className="text-[12px] text-muted">Esta cobranza aún no tiene pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {abonos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="demo-num text-[13px] text-ink">{formatMonto(a.monto)}</div>
                <div className="text-[11px] text-muted">
                  {/* Lo rescatado por la migración del 08/10 es aproximado: un
                      solo renglón por lo ya cobrado, y a veces sin fecha. */}
                  {a.fecha ? formatFecha(a.fecha) : 'Sin fecha'}
                  {a.origen === 'historico' ? ' · cobrado antes del 08/10 (aproximado)' : ''}
                  {a.registradoPor ? ` · ${a.registradoPor}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.tieneComprobante ? (
                  <a
                    href={urlComprobanteAbono(cobranzaId, a.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-info hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> Comprobante
                  </a>
                ) : (
                  <span className="text-[11px] text-muted">Sin comprobante</span>
                )}
                {puedeAdjuntar && (
                  <label
                    className={
                      'inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-ink ' +
                      (subiendo ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2')
                    }
                  >
                    <Paperclip className="h-3 w-3 text-muted" />
                    {subiendo === a.id ? 'Subiendo…' : a.tieneComprobante ? 'Reemplazar' : 'Adjuntar'}
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      disabled={!!subiendo}
                      onChange={(e) => leerArchivo(e, (url) => void subir(a.id, url), setError)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
