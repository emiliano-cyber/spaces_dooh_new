'use client'

import { useState } from 'react'
import { Plus, FileText, Send, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  usePropuestas,
  useClientes,
  useSitios,
  formatMonto,
  type Propuesta,
  type EstPropuesta,
} from '@/lib/data/client'
import { crearPropuestaApi, cambiarEstatusPropuestaApi } from '@/lib/data/estado-api'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const EST: Record<EstPropuesta, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'border-border text-muted' },
  ENVIADA: { label: 'Enviada', cls: 'border-[#0a66ff40] text-info' },
  APROBADA: { label: 'Aprobada', cls: 'border-[#10b98140] text-[#0f7a55]' },
  RECHAZADA: { label: 'Rechazada', cls: 'border-[#ef444440] text-error' },
}

export default function PropuestasPage() {
  const propuestas = usePropuestas()
  const puedeEditar = usePuede('comercial', 'crear')
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Propuestas</h1>
          <p className="mt-1 text-[13px] text-muted">Cotizaciones con método del divisor (bruto / neto)</p>
        </div>
        {puedeEditar && (
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva propuesta
          </Button>
        )}
      </div>

      {!propuestas ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : propuestas.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">Aún no hay propuestas.</p>
      ) : (
        <ul className="space-y-3">
          {propuestas.map((p) => (
            <PropuestaCard
              key={p.id}
              p={p}
              abierta={abierta === p.id}
              onToggle={() => setAbierta(abierta === p.id ? null : p.id)}
              puedeEditar={puedeEditar}
            />
          ))}
        </ul>
      )}

      {nuevoOpen && <NuevaPropuestaDialog onClose={() => setNuevoOpen(false)} />}
    </div>
  )
}

function PropuestaCard({
  p, abierta, onToggle, puedeEditar,
}: { p: Propuesta; abierta: boolean; onToggle: () => void; puedeEditar: boolean }) {
  const clientes = useClientes()
  const sitios = useSitios()
  const cliente = clientes?.find((c) => c.id === p.clienteId)
  const est = EST[p.estatus]

  async function cambiar(estatus: EstPropuesta) {
    try { await cambiarEstatusPropuestaApi(p.id, estatus) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
            {abierta ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="demo-num text-[12px] text-muted">{p.folio}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${est.cls}`}>{est.label}</span>
              </div>
              <div className="mt-0.5 text-[14px] font-medium text-ink">{p.nombre}</div>
              <div className="text-[12px] text-muted">{cliente?.nombre ?? 'Sin cliente'} · {p.items.length} sitios</div>
            </div>
          </button>
          <div className="text-right">
            <div className="demo-num text-[15px] font-semibold text-ink">{formatMonto(p.total)}</div>
            <div className="text-[11px] text-muted">total c/IVA</div>
          </div>
        </div>

        {abierta && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {/* Presupuesto (método del divisor) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
              <Dato label="Bruto (lista)" valor={formatMonto(p.bruto)} />
              <Dato label={`Comisión ${(100 - p.divisor * 100).toFixed(0)}% · divisor ${p.divisor.toFixed(2)}`} valor={`× ${p.divisor.toFixed(2)}`} />
              <Dato label="Neto (al medio)" valor={formatMonto(p.neto)} />
              <Dato label="IVA 16%" valor={formatMonto(p.iva)} />
            </div>
            {/* Items */}
            <ul className="divide-y divide-border rounded-md border border-border">
              {p.items.map((it) => {
                const s = sitios?.find((x) => x.id === it.sitioId)
                return (
                  <li key={it.id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                    <span className="truncate text-ink">{s?.nombre ?? it.sitioId}</span>
                    <span className="demo-num text-muted">{formatMonto(it.precio)}</span>
                  </li>
                )
              })}
            </ul>
            {/* Acciones de estatus */}
            {puedeEditar && (
              <div className="flex flex-wrap gap-2">
                {p.estatus === 'BORRADOR' && (
                  <Button size="sm" variant="secondary" onClick={() => cambiar('ENVIADA')}><Send className="h-3.5 w-3.5" /> Enviar</Button>
                )}
                {(p.estatus === 'ENVIADA' || p.estatus === 'BORRADOR') && (
                  <>
                    <Button size="sm" onClick={() => cambiar('APROBADA')}><Check className="h-3.5 w-3.5" /> Aprobar</Button>
                    <Button size="sm" variant="danger" onClick={() => cambiar('RECHAZADA')}><X className="h-3.5 w-3.5" /> Rechazar</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}

// ─── Nueva propuesta (builder con divisor en vivo) ───────────────────────────
function NuevaPropuestaDialog({ onClose }: { onClose: () => void }) {
  const clientes = useClientes()
  const sitios = useSitios()
  const [clienteId, setClienteId] = useState('')
  const [nombre, setNombre] = useState('')
  const [comision, setComision] = useState('0')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const precioDe = (s: any) => Number(s.tarifaPublicada || s.tarifaMensual || 0)
  const seleccionados = (sitios ?? []).filter((s) => sel.has(s.id))
  const bruto = seleccionados.reduce((acc, s) => acc + precioDe(s), 0)
  const divisor = 1 - (Number(comision) || 0) / 100
  const neto = Math.round(bruto * divisor)
  const iva = Math.round(bruto * 0.16)
  const total = bruto + iva
  const valido = !!nombre.trim() && !!fechaInicio && !!fechaFin && sel.size > 0

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    setError(null)
    try {
      await crearPropuestaApi({
        clienteId: clienteId || null,
        nombre: nombre.trim(),
        comisionPct: Number(comision) || 0,
        fechaInicio,
        fechaFin,
        items: seleccionados.map((s) => ({ sitioId: s.id, precio: precioDe(s) })),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear')
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Nueva propuesta"
      subtitle="Selecciona sitios; el método del divisor calcula bruto → neto"
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : (
            <span className="text-[12px] text-muted">Total c/IVA: <b className="demo-num text-ink">{formatMonto(total)}</b></span>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!valido || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Crear propuesta'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre de la propuesta">
            <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo label="Cliente">
            <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Desde"><input type="date" className={inputCls} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Campo>
          <Campo label="Hasta"><input type="date" className={inputCls} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></Campo>
          <Campo label="Comisión agencia (%)"><input className={inputCls} value={comision} onChange={(e) => setComision(e.target.value)} /></Campo>
        </div>

        {/* Selección de sitios */}
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink">Sitios ({sel.size})</span>
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {(sitios ?? []).map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center justify-between border-b border-border px-3 py-1.5 text-[12px] last:border-0 hover:bg-surface-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="text-ink">{s.nombre}</span>
                </span>
                <span className="demo-num text-muted">{formatMonto(precioDe(s))}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Resumen del divisor en vivo */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border bg-surface-2 p-3 text-[12px] sm:grid-cols-4">
          <Dato label="Bruto" valor={formatMonto(bruto)} />
          <Dato label={`Divisor (${comision || 0}%)`} valor={`× ${divisor.toFixed(2)}`} />
          <Dato label="Neto" valor={formatMonto(neto)} />
          <Dato label="IVA 16%" valor={formatMonto(iva)} />
        </div>
      </div>
    </Modal>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="demo-num text-[13px] text-ink">{valor}</div>
    </div>
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
