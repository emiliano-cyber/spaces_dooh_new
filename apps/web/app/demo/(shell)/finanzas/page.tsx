'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { CheckCircle2, FileText, Lock, Receipt } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { EmptyState } from '@/components/demo/EmptyState'
import {
  StatusBadge,
  COBRANZA_TONO,
  COBRANZA_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { generarFacturaApi, recordarCobranzaApi } from '@/lib/data/estado-api'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  useCampanasResumen,
  useFacturas,
  useCobranzas,
  useClientes,
  estadoCobranza,
  formatMonto,
  formatFecha,
  diasHasta,
  type Campana,
} from '@/lib/data/client'

export default function FinanzasPage() {
  const resumen = useCampanasResumen()
  const facturas = useFacturas()
  const cobranzas = useCobranzas()
  const clientes = useClientes()
  const puedeFacturar = usePuede('finanzas', 'facturar')
  const puedeCobrar = usePuede('finanzas', 'crear')

  const [facturar, setFacturar] = useState<Campana | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [recordando, setRecordando] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  async function recordar(id: string) {
    setRecordando(id)
    try {
      await recordarCobranzaApi(id)
      notify('Recordatorio de cobro enviado')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo enviar el recordatorio')
    } finally {
      setRecordando(null)
    }
  }

  const cliNombre = (id: string) => clientes?.find((c) => c.id === id)?.nombre ?? '—'

  // Listas para facturar: candado encendido y sin factura todavía.
  const listas =
    resumen?.filter(
      (r) => r.candado && !(facturas ?? []).some((f) => f.campanaId === r.campana.id),
    ) ?? []

  // Conteo de semáforo de cobranza.
  const cuenta = { AL_CORRIENTE: 0, POR_VENCER: 0, VENCIDA: 0, PAGADA: 0 }
  for (const c of cobranzas ?? []) cuenta[estadoCobranza(c)]++

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Finanzas</h1>
        <p className="mt-1 text-[13px] text-muted">Facturación y cobranza</p>
      </div>

      {/* Listas para facturar */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Lock className="h-4 w-4 text-muted" />
          <CardTitle>Listas para facturar</CardTitle>
        </CardHeader>
        <CardContent>
          {!resumen ? (
            <div className="h-16 animate-pulse rounded bg-surface-2" />
          ) : listas.length === 0 ? (
            <EmptyState
              icon={FileText}
              titulo="Nada por facturar ahora"
              detalle="Cuando una campaña complete su candado (OC + fotos + reporte) aparecerá aquí."
            />
          ) : (
            <ul className="space-y-2">
              {listas.map((r) => (
                <li
                  key={r.campana.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#10b98140] bg-[#10b9810d] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{r.campana.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {r.clienteNombre} ·{' '}
                      {r.campana.presupuestoBruto ? `${formatMonto(r.campana.presupuestoBruto)} · IVA inc.` : '—'}
                    </div>
                  </div>
                  {puedeFacturar ? (
                    <Button size="sm" onClick={() => setFacturar(r.campana)}>
                      <Receipt className="h-3.5 w-3.5" /> Generar factura
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted">Lista · requiere Finanzas</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Cobranza */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cobranza</CardTitle>
          <div className="flex gap-3 text-[11px]">
            <Conteo color="#10b981" label="Al corriente" n={cuenta.AL_CORRIENTE} />
            <Conteo color="#f59e0b" label="Por vencer" n={cuenta.POR_VENCER} />
            <Conteo color="#ef4444" label="Vencida" n={cuenta.VENCIDA} />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!cobranzas || !facturas ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : cobranzas.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">Sin facturas en cobranza.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Folio</th>
                    <th className="px-4 py-2 font-medium">Folio fiscal</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 text-right font-medium">Monto</th>
                    <th className="px-4 py-2 font-medium">Plazo</th>
                    <th className="px-4 py-2 font-medium">Vence</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {cobranzas
                    .slice()
                    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
                    .map((cob) => {
                      const fac = facturas.find((f) => f.id === cob.facturaId)
                      const est = estadoCobranza(cob)
                      const dias = diasHasta(cob.fechaVencimiento)
                      return (
                        <tr key={cob.id} className="border-b border-border last:border-0">
                          <td className="demo-num px-4 py-2.5 text-ink">{fac?.folio ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="demo-num text-[10px] leading-tight text-muted" title={fac?.folioFiscal ?? ''}>
                              {fac?.folioFiscal ? `${fac.folioFiscal.slice(0, 13)}…` : '—'}
                            </div>
                            {fac?.rfc && <div className="demo-num text-[10px] text-muted">{fac.rfc}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-muted">{fac ? cliNombre(fac.clienteId) : '—'}</td>
                          <td className="demo-num px-4 py-2.5 text-right text-ink">
                            {fac ? formatMonto(fac.monto) : '—'}
                            {cob.montoPagado > 0 && est !== 'PAGADA' && fac && (
                              <div className="text-[10px] text-warning">saldo {formatMonto(fac.monto - cob.montoPagado)}</div>
                            )}
                          </td>
                          <td className="demo-num px-4 py-2.5 text-muted">{cob.plazoDias} días</td>
                          <td className="demo-num px-4 py-2.5 text-muted">
                            {formatFecha(cob.fechaVencimiento)}
                            <span
                              className={cn(
                                'ml-1 text-[11px]',
                                dias < 0 ? 'text-error' : dias <= 30 ? 'text-warning' : 'text-muted',
                              )}
                            >
                              ({dias < 0 ? `${Math.abs(dias)}d vencida` : `${dias}d`})
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge tono={COBRANZA_TONO[est]}>{COBRANZA_LABEL[est]}</StatusBadge>
                              {est !== 'PAGADA' && (
                                <div className="flex items-center gap-2">
                                  {puedeCobrar && (
                                    <button
                                      type="button"
                                      onClick={() => recordar(cob.id)}
                                      disabled={recordando === cob.id}
                                      className="rounded border border-border-strong px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2 disabled:opacity-50"
                                    >
                                      {recordando === cob.id ? 'Enviando…' : 'Recordar'}
                                    </button>
                                  )}
                                  {cob.recordatoriosEnviados > 0 && (
                                    <span
                                      className="text-[10px] text-muted"
                                      title={cob.recordatorioEn ? `Último: ${formatFecha(cob.recordatorioEn)}` : ''}
                                    >
                                      {cob.recordatoriosEnviados} enviado{cob.recordatoriosEnviados === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <GenerarFacturaDialog
        campana={facturar}
        onClose={() => setFacturar(null)}
        onDone={() => notify('Factura generada')}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}

function Conteo({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label} <span className="demo-num font-medium text-ink">{n}</span>
    </span>
  )
}

function GenerarFacturaDialog({
  campana,
  onClose,
  onDone,
}: {
  campana: Campana | null
  onClose: () => void
  onDone: (folio: string) => void
}) {
  const [plazo, setPlazo] = useState<60 | 90 | 120>(90)
  const [enviando, setEnviando] = useState(false)
  if (!campana) return null
  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && onClose()}
      title="Generar factura"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true)
              try {
                await generarFacturaApi(campana.id, plazo)
                onDone('generada')
                onClose()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'No se pudo generar la factura')
              }
              setEnviando(false)
            }}
          >
            {enviando ? 'Generando…' : 'Emitir factura'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Subtotal (neto)</span>
            <span className="demo-num text-ink">
              {campana.presupuestoNeto ? formatMonto(campana.presupuestoNeto) : '—'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted">
              IVA ({campana.presupuestoNeto
                ? Math.round((((campana.presupuestoBruto ?? 0) - campana.presupuestoNeto) / campana.presupuestoNeto) * 100)
                : 16}%)
            </span>
            <span className="demo-num text-ink">
              {campana.presupuestoNeto != null && campana.presupuestoBruto != null
                ? formatMonto(campana.presupuestoBruto - campana.presupuestoNeto)
                : '—'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
            <span className="font-medium text-ink">Total</span>
            <span className="demo-num font-semibold text-ink">
              {campana.presupuestoBruto ? formatMonto(campana.presupuestoBruto) : '—'}
            </span>
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-ink">Plazo de cobranza</span>
          <div className="flex gap-2">
            {([60, 90, 120] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlazo(p)}
                className={cn(
                  'flex-1 rounded border px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                  plazo === p
                    ? 'border-accent bg-[#f59e0b1a] text-ink'
                    : 'border-border-strong text-muted hover:bg-surface-2',
                )}
              >
                {p} días
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
