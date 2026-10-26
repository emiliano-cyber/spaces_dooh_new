'use client'

import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { Handshake, ShieldCheck, ShieldAlert, Building2, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { EmptyState } from '@/components/demo/EmptyState'
import { StatusBadge } from '@/components/demo/StatusBadge'
import { ChipConteo } from '@/components/demo/finanzas/ChipConteo'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
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

  const encabezado = (
    // Encabezado con la forma del Dashboard (rediseño 2026-10-26): sin la caja
    // de icono, que llevaba un azul con hex suelto.
    <div>
      <h1 className="text-2xl text-ink">Comisiones</h1>
      <p className="mt-1 text-[13px] text-muted">
        Ajusta la comisión por agencia y la agencia asignada a cada cliente.
      </p>
    </div>
  )

  if (!clientes) {
    // Esqueleto con la forma de lo que va a llegar —la franja de conteos y las
    // dos tarjetas—, no un bloque gris de 256 px sin forma.
    return (
      <div className="w-full space-y-4">
        {encabezado}
        <div className="h-6 w-80 max-w-full animate-pulse rounded bg-surface-2" />
        <div className="h-40 w-full animate-pulse rounded-md bg-surface-2" />
        <div className="h-40 w-full animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }

  const agencias = clientes.filter((c) => c.tipo === 'AGENCIA')
  const directos = clientes.filter((c) => c.tipo !== 'AGENCIA')
  // Conteos para la franja de arriba. Son CONTEOS de lo que ya está en
  // pantalla, no dinero: «sin agencia» es lo mismo que la fila pinta como
  // «Directo» (la agencia asignada no está entre las agencias).
  const sinValidar = agencias.filter((a) => a.tieneNegociacion && !a.negociacionValidada).length
  const sinAgencia = directos.filter((c) => !agencias.some((a) => a.id === c.agenciaId)).length

  return (
    <div className="w-full space-y-4">
      {encabezado}

      {/* Rediseño del 2026-10-26 · lo que el dueño quiere saber antes de bajar
          a las tablas: cuántas agencias hay, cuántas negociaciones faltan por
          validar (bloquean propuestas) y cuántos clientes no tienen agencia.
          Chips del Dashboard y no KPI grandes: aquí no hay dinero que medir. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ChipConteo label="Agencias" n={agencias.length} />
        <ChipConteo
          label="Negociación sin validar"
          n={sinValidar}
          tono={sinValidar > 0 ? 'ambar' : 'neutro'}
          title="Sin validar, no se pueden crear ni aprobar propuestas con esa agencia"
        />
        <ChipConteo label="Clientes sin agencia" n={sinAgencia} />
      </div>

      {/* Agencias: comisión + negociación */}
      {/* PLEG-02 · al plegar se desmontan las filas: un porcentaje tecleado y
          sin guardar en una de ellas se pierde. */}
      <CardColapsable
        id="comisiones.agencias"
        titulo="Agencias y su comisión"
        icono={<Building2 className="h-4 w-4 text-muted" />}
        contentClassName="px-0 pb-0"
        accion={
          puede && (
            <Button variant="success" size="sm" onClick={() => setNuevaOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nueva agencia
            </Button>
          )
        }
      >
          {agencias.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState
                icon={Building2}
                titulo="Aún no hay agencias"
                detalle={puede ? 'Usa «Nueva agencia» para crear una.' : 'Cuando se dé de alta una agencia aparecerá aquí.'}
                className="py-8"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={CABECERA}>
                    <th className="px-4 py-2 font-medium">Agencia</th>
                    <th className="px-4 py-2 text-right font-medium">Comisión</th>
                    <th className="px-4 py-2 font-medium">Negociación</th>
                    <th className="px-4 py-2 text-right font-medium">Clientes</th>
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
      </CardColapsable>

      {/* Clientes directos: agencia asignada → comisión aplicada */}
      <CardColapsable
        id="comisiones.clientes"
        titulo="Clientes y su agencia"
        icono={<Users className="h-4 w-4 text-muted" />}
        contentClassName="px-0 pb-0"
      >
          {directos.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState icon={Users} titulo="No hay clientes directos" className="py-8" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={CABECERA}>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Agencia</th>
                    <th className="px-4 py-2 text-right font-medium">Comisión aplicada</th>
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
      </CardColapsable>

      {nuevaOpen && <NuevaAgenciaDialog onClose={() => setNuevaOpen(false)} />}
    </div>
  )
}

// Cabecera de tabla común (rediseño 2026-10-26), la misma de Finanzas.
const CABECERA = 'border-b border-border text-[11px] uppercase tracking-wide text-muted'

// ─── Alta de agencia (cliente tipo AGENCIA) ──────────────────────────────────
function NuevaAgenciaDialog({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [comision, setComision] = useState('0')
  const [tieneNeg, setTieneNeg] = useState(false)
  const [negValidada, setNegValidada] = useState(false)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // OBLIG-01 · el nombre lo exige el servidor (`clientes-controller.ts:33`); la
  // comisión es el dato que define a una agencia, así que también se pide (un
  // 0 vale: es una comisión de cero, no un hueco).
  // Solo el nombre: la comisión vacía se guarda como 0, como siempre (B53).
  const ob = useObligatorios({ nombre }, ['nombre'])

  async function guardar() {
    if (!ob.validar()) return
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
            <Button variant="success" size="sm" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Crear agencia'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Nombre de la agencia" obligatorio falta={ob.falta('nombre')}>
          <input className={fieldCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="p. ej. Andina Media" />
        </Campo>
        <Campo label="Comisión de la agencia (%)">
          <input className={`demo-num ${fieldCls}`} value={comision} onChange={(e) => setComision(e.target.value)} placeholder="0" />
        </Campo>

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
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setBusy(false)
  }

  return (
    <tr className="hover:bg-surface-2">
      <td className="px-4 py-2.5 font-medium text-ink">{agencia.nombre}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          {/* El «%» va pegado al campo: el número solo no decía en qué unidad
              estaba. Es texto al lado, no parte del valor: lo que se manda
              sigue siendo `Number(comision) || 0`. */}
          <span className="inline-flex items-center gap-1">
            <input
              className={`demo-num ${inputCls}`}
              value={comision}
              aria-label={`Comisión de ${agencia.nombre} (%)`}
              disabled={!puede || busy}
              onChange={(e) => setComision(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && cambiado) guardar({ comisionAgenciaPct: Number(comision) || 0 }) }}
            />
            <span className="text-[12px] text-muted">%</span>
          </span>
          {/* «Guardar» RESERVA su sitio aunque no haya cambios (`invisible`):
              antes aparecía y desaparecía y la fila entera saltaba al teclear.
              Sigue apareciendo solo para quien puede, y solo se pulsa con un
              cambio — igual que cuando no se pintaba. */}
          {puede && (
            <Button
              size="sm"
              disabled={busy || !cambiado}
              aria-hidden={!cambiado}
              tabIndex={cambiado ? undefined : -1}
              className={cn(!cambiado && 'invisible')}
              onClick={() => guardar({ comisionAgenciaPct: Number(comision) || 0 })}
            >
              {busy ? '…' : 'Guardar'}
            </Button>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {/* Rediseño del 2026-10-26 · el estado con el semáforo único de la
            app (`StatusBadge`) en vez de texto con hex sueltos. Las acciones
            son las mismas, a la derecha del chip. */}
        {!agencia.tieneNegociacion ? (
          <StatusBadge tono="neutro">Sin negociación</StatusBadge>
        ) : agencia.negociacionValidada ? (
          <div className="flex items-center gap-2">
            <StatusBadge tono="verde">
              <ShieldCheck className="h-3 w-3" /> Validada
            </StatusBadge>
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
            <StatusBadge tono="ambar">
              <ShieldAlert className="h-3 w-3" /> Sin validar
            </StatusBadge>
            {puede && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => guardar({ negociacionValidada: true })}>
                <Handshake className="h-3.5 w-3.5" /> Validar
              </Button>
            )}
          </div>
        )}
      </td>
      <td className="demo-num px-4 py-2.5 text-right text-muted">{clientesAsociados}</td>
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
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar')
    }
    setBusy(false)
  }

  return (
    <tr className="hover:bg-surface-2">
      <td className="px-4 py-2.5 font-medium text-ink">{cliente.nombre}</td>
      <td className="px-4 py-2.5">
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
      <td className="demo-num whitespace-nowrap px-4 py-2.5 text-right text-ink">
        {/* La raya sola no decía por qué: es un cliente sin agencia, y por eso
            no paga comisión. Misma condición de siempre (`agencia`). */}
        {agencia ? `${agencia.comisionAgenciaPct ?? 0}%` : (
          <span className="text-[12px] text-muted" title="Cliente sin agencia asignada">Directo · sin comisión</span>
        )}
      </td>
    </tr>
  )
}
