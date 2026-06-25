'use client'

import { useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ContratoSheet } from '@/components/demo/arrendadores/ContratoSheet'
import {
  StatusBadge,
  CONTRATO_TONO,
  CONTRATO_LABEL,
  PAGO_TONO,
  PAGO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useContratos,
  useArrendadores,
  useSitios,
  usePagosRenta,
  formatMonto,
  formatFecha,
  diasHasta,
  type ContratoArrendamiento,
} from '@/lib/data/client'
import { registrarPagoRentaApi, crearArrendadorApi } from '@/lib/data/estado-api'

export default function ArrendadoresPage() {
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()

  const [sel, setSel] = useState<ContratoArrendamiento | null>(null)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const puedeCrear = usePuede('arrendadores', 'crear')

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const nombreArr = (id: string) => arrendadores?.find((a) => a.id === id)?.nombre ?? '—'
  const sitioDe = (id: string) => sitios?.find((s) => s.id === id)

  const porVencer = (contratos ?? []).filter((c) => c.estatus === 'POR_VENCER').length
  const rentaVencida = (pagos ?? []).filter((p) => p.estatus === 'VENCIDO').length

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Arrendadores</h1>
          <p className="mt-1 text-[13px] text-muted">El otro lado de la red · contratos, rentas y vencimientos</p>
        </div>
        {puedeCrear && (
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo propietario
          </Button>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Mini label="Contratos" valor={`${contratos?.length ?? '—'}`} />
        <Mini label="Por vencer" valor={`${porVencer}`} tono={porVencer ? 'ambar' : undefined} />
        <Mini label="Renta vencida" valor={`${rentaVencida}`} tono={rentaVencida ? 'rojo' : undefined} />
      </div>

      {/* Contratos */}
      <Card>
        <CardHeader>
          <CardTitle>Contratos de arrendamiento</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!contratos ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Arrendador</th>
                    <th className="px-4 py-2 font-medium">Sitio</th>
                    <th className="px-4 py-2 text-right font-medium">Renta</th>
                    <th className="px-4 py-2 font-medium">Cada cuándo</th>
                    <th className="px-4 py-2 font-medium">Vence</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.map((c) => {
                    const dias = diasHasta(c.fechaFin)
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSel(c)
                          setOpen(true)
                        }}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5 text-ink">{nombreArr(c.arrendadorId)}</td>
                        <td className="px-4 py-2.5 text-muted">{sitioDe(c.sitioId)?.nombre ?? '—'}</td>
                        <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(c.montoRenta)}</td>
                        <td className="px-4 py-2.5 capitalize text-muted">{c.periodicidad ? c.periodicidad.toLowerCase() : '—'}</td>
                        <td className="demo-num px-4 py-2.5 text-muted">
                          {formatFecha(c.fechaFin)}
                          {c.estatus === 'POR_VENCER' && (
                            <span className="ml-1 text-[11px] text-warning">({dias}d)</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge tono={CONTRATO_TONO[c.estatus]}>{CONTRATO_LABEL[c.estatus]}</StatusBadge>
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

      {/* Pagos de renta */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos de renta</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!pagos ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Sitio</th>
                    <th className="px-4 py-2 font-medium">Periodo</th>
                    <th className="px-4 py-2 text-right font-medium">Monto</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                    <th className="px-4 py-2 font-medium">Pago</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => {
                    const con = contratos?.find((c) => c.id === p.contratoId)
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-ink">{con ? sitioDe(con.sitioId)?.nombre : '—'}</td>
                        <td className="px-4 py-2.5 capitalize text-muted">{p.periodo}</td>
                        <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(p.monto)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge tono={PAGO_TONO[p.estatus]}>{PAGO_LABEL[p.estatus]}</StatusBadge>
                        </td>
                        <td className="demo-num px-4 py-2.5 text-muted">
                          {p.fechaPago ? formatFecha(p.fechaPago) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {p.estatus !== 'PAGADO' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                await registrarPagoRentaApi(p.id)
                                notify('Pago registrado')
                              }}
                            >
                              Registrar pago
                            </Button>
                          )}
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

      <ContratoSheet contrato={sel} open={open} onOpenChange={setOpen} onToast={notify} />
      {nuevoOpen && (
        <NuevoPropietarioDialog onClose={() => setNuevoOpen(false)} onToast={notify} />
      )}

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

// Alta de propietario/arrendador
function NuevoPropietarioDialog({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const inputCls =
    'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
  const [nombre, setNombre] = useState('')
  const [rfc, setRfc] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await crearArrendadorApi({
        nombre: nombre.trim(),
        rfc: rfc.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
      })
      onToast('Propietario agregado')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo propietario"
      subtitle="Alta de arrendador (dueño del predio)"
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!nombre.trim() || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nombre / razón social</span>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">RFC</span>
            <input className={inputCls} value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Teléfono</span>
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@propietario.com" />
        </label>
      </div>
    </Modal>
  )
}

function Mini({ label, valor, tono }: { label: string; valor: string; tono?: 'ambar' | 'rojo' }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div
        className={cn(
          'demo-num mt-1 text-2xl font-semibold',
          tono === 'rojo' ? 'text-error' : tono === 'ambar' ? 'text-warning' : 'text-ink',
        )}
      >
        {valor}
      </div>
    </div>
  )
}
