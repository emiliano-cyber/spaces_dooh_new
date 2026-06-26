'use client'

import { useEffect, useState } from 'react'
import { Percent, Handshake, ShieldCheck, ShieldAlert, Building2, Users, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useClientes, type Cliente } from '@/lib/data/client'
import { actualizarClienteApi, crearClienteApi } from '@/lib/data/estado-api'

const inputCls =
  'h-8 w-20 rounded border border-border-strong bg-surface px-2 text-right text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const selectCls =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const fieldCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Pantalla de ajuste de comisiones: la comisión es por AGENCIA. Aquí se ajusta
// la comisión de cada agencia (y su negociación) y se asigna la agencia a cada
// cliente directo, que determina la comisión que se le aplica.
export default function ComisionesPage() {
  const clientes = useClientes()
  const puede = usePuede('comercial', 'crear')
  const [nuevaOpen, setNuevaOpen] = useState(false)

  if (!clientes) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }

  const agencias = clientes.filter((c) => c.tipo === 'AGENCIA')
  const directos = clientes.filter((c) => c.tipo !== 'AGENCIA')

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0a66ff1a] text-info">
          <Percent className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl text-ink">Comisiones</h1>
          <p className="text-[13px] text-muted">
            Ajusta la comisión por agencia y la agencia asignada a cada cliente.
          </p>
        </div>
      </div>

      {/* Agencias: comisión + negociación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted" />
            <CardTitle>Agencias y su comisión</CardTitle>
          </div>
          {puede && (
            <Button size="sm" onClick={() => setNuevaOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nueva agencia
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {agencias.length === 0 ? (
            <p className="text-[13px] text-muted">
              Aún no hay agencias. Usa «Nueva agencia» para crear una.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Agencia</th>
                    <th className="px-2 py-2 text-right font-medium">Comisión (%)</th>
                    <th className="px-2 py-2 font-medium">Negociación</th>
                    <th className="px-2 py-2 text-right font-medium">Clientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {agencias.map((a) => (
                    <AgenciaRow
                      key={a.id}
                      agencia={a}
                      clientesAsociados={directos.filter((c) => c.agenciaId === a.id).length}
                      puede={puede}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clientes directos: agencia asignada → comisión aplicada */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <CardTitle>Clientes y su agencia</CardTitle>
        </CardHeader>
        <CardContent>
          {directos.length === 0 ? (
            <p className="text-[13px] text-muted">No hay clientes directos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Cliente</th>
                    <th className="px-2 py-2 font-medium">Agencia</th>
                    <th className="px-2 py-2 text-right font-medium">Comisión aplicada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {directos.map((c) => (
                    <ClienteRow key={c.id} cliente={c} agencias={agencias} puede={puede} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {nuevaOpen && <NuevaAgenciaDialog onClose={() => setNuevaOpen(false)} />}
    </div>
  )
}

// ─── Alta de agencia (cliente tipo AGENCIA) ──────────────────────────────────
function NuevaAgenciaDialog({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [comision, setComision] = useState('0')
  const [tieneNeg, setTieneNeg] = useState(false)
  const [negValidada, setNegValidada] = useState(false)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await crearClienteApi({
        nombre: nombre.trim(),
        tipo: 'AGENCIA',
        comisionAgenciaPct: Number(comision) || 0,
        tieneNegociacion: tieneNeg,
        negociacionValidada: tieneNeg ? negValidada : false,
        negociacionNota: tieneNeg ? (nota.trim() || null) : null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la agencia')
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nueva agencia"
      subtitle="Alta de cliente tipo Agencia con su comisión"
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!nombre.trim() || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Crear agencia'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nombre de la agencia</span>
          <input className={fieldCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="p. ej. Andina Media" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Comisión de la agencia (%)</span>
          <input className={`demo-num ${fieldCls}`} value={comision} onChange={(e) => setComision(e.target.value)} placeholder="0" />
        </label>

        <div className="rounded-md border border-border bg-surface-2 p-3">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={tieneNeg}
              onChange={(e) => { setTieneNeg(e.target.checked); if (!e.target.checked) setNegValidada(false) }}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            ¿Hay negociación con la agencia?
          </label>
          {tieneNeg && (
            <div className="mt-3 space-y-2.5">
              <textarea
                className="min-h-[56px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Términos negociados (comisión especial, condiciones de pago…)"
              />
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" checked={negValidada} onChange={(e) => setNegValidada(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium text-ink">Negociación validada</span>
                  <span className="mt-0.5 block text-[11px] text-muted">Sin validar, no se pueden crear ni aprobar propuestas con esta agencia.</span>
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Fila de agencia: comisión editable + estado de negociación ──────────────
function AgenciaRow({
  agencia,
  clientesAsociados,
  puede,
}: {
  agencia: Cliente
  clientesAsociados: number
  puede: boolean
}) {
  const [comision, setComision] = useState(String(agencia.comisionAgenciaPct ?? 0))
  const [busy, setBusy] = useState(false)
  // Sincroniza el input si el dato cambia tras guardar/refrescar.
  useEffect(() => setComision(String(agencia.comisionAgenciaPct ?? 0)), [agencia.comisionAgenciaPct])

  const cambiado = Number(comision) !== Number(agencia.comisionAgenciaPct ?? 0)

  async function guardar(input: Parameters<typeof actualizarClienteApi>[1]) {
    setBusy(true)
    try {
      await actualizarClienteApi(agencia.id, input)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setBusy(false)
  }

  return (
    <tr className="hover:bg-surface-2">
      <td className="px-2 py-2.5 font-medium text-ink">{agencia.nombre}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <input
            className={`demo-num ${inputCls}`}
            value={comision}
            disabled={!puede || busy}
            onChange={(e) => setComision(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && cambiado) guardar({ comisionAgenciaPct: Number(comision) || 0 }) }}
          />
          {puede && cambiado && (
            <Button size="sm" disabled={busy} onClick={() => guardar({ comisionAgenciaPct: Number(comision) || 0 })}>
              {busy ? '…' : 'Guardar'}
            </Button>
          )}
        </div>
      </td>
      <td className="px-2 py-2.5">
        {!agencia.tieneNegociacion ? (
          <span className="text-[12px] text-muted">Sin negociación</span>
        ) : agencia.negociacionValidada ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[12px] text-[#0f7a55]">
              <ShieldCheck className="h-3.5 w-3.5" /> Validada
            </span>
            {puede && (
              <button
                type="button"
                disabled={busy}
                onClick={() => guardar({ negociacionValidada: false })}
                className="text-[11px] text-muted hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[12px] text-[#9a6700]">
              <ShieldAlert className="h-3.5 w-3.5" /> Sin validar
            </span>
            {puede && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => guardar({ negociacionValidada: true })}>
                <Handshake className="h-3.5 w-3.5" /> Validar
              </Button>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right text-muted">{clientesAsociados}</td>
    </tr>
  )
}

// ─── Fila de cliente: agencia asignada → comisión que se le aplica ───────────
function ClienteRow({
  cliente,
  agencias,
  puede,
}: {
  cliente: Cliente
  agencias: Cliente[]
  puede: boolean
}) {
  const [busy, setBusy] = useState(false)
  const agencia = agencias.find((a) => a.id === cliente.agenciaId)

  async function asignar(agenciaId: string) {
    if (!agenciaId) return
    setBusy(true)
    try {
      await actualizarClienteApi(cliente.id, { agenciaId })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo asignar')
    }
    setBusy(false)
  }

  return (
    <tr className="hover:bg-surface-2">
      <td className="px-2 py-2.5 font-medium text-ink">{cliente.nombre}</td>
      <td className="px-2 py-2.5">
        {puede ? (
          <select
            className={selectCls}
            value={cliente.agenciaId ?? ''}
            disabled={busy || agencias.length === 0}
            onChange={(e) => asignar(e.target.value)}
          >
            <option value="">— Selecciona agencia —</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        ) : (
          <span className="text-muted">{agencia?.nombre ?? 'Directo'}</span>
        )}
      </td>
      <td className="demo-num px-2 py-2.5 text-right text-ink">
        {agencia ? `${agencia.comisionAgenciaPct ?? 0}%` : '—'}
      </td>
    </tr>
  )
}
