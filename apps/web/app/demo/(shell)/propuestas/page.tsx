'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { withTrail } from '@/lib/nav-trail'
import { crearPropuestaApi, cambiarEstatusPropuestaApi, aprobarItemPropuestaApi, generarCampanaDesdePropuestaApi } from '@/lib/data/estado-api'

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
    <div className="w-full space-y-4">
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
  const agencia = clientes?.find((c) => c.id === p.agenciaId)
  const est = EST[p.estatus]
  const router = useRouter()
  const [generando, setGenerando] = useState(false)

  async function cambiar(estatus: EstPropuesta) {
    try { await cambiarEstatusPropuestaApi(p.id, estatus) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }
  async function generarCampana() {
    setGenerando(true)
    try {
      const camp = await generarCampanaDesdePropuestaApi(p.id)
      if (camp?.id) router.push(`/demo/campanas/${camp.id}`)
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    setGenerando(false)
  }
  async function aprobar(itemId: string, aprobado: boolean) {
    try { await aprobarItemPropuestaApi(itemId, aprobado) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
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
              <div className="text-[12px] text-muted">
                {cliente?.nombre ?? 'Sin cliente'}
                {agencia ? <> · vía <span className="text-ink">{agencia.nombre}</span></> : ''}
                {' '}· {p.items.length} sitios
              </div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="demo-num text-[15px] font-semibold text-ink">{formatMonto(p.total)}</div>
              <div className="text-[11px] text-muted">total c/IVA</div>
            </div>
            <Link
              href={withTrail(`/demo/propuestas/${p.id}`, [{ label: 'Propuestas', href: '/demo/propuestas' }])}
              className="inline-flex items-center gap-1 rounded border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-info hover:bg-surface-2"
            >
              Abrir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {abierta && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {/* Presupuesto (método del divisor) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
              <Dato label="Bruto (lista)" valor={formatMonto(p.bruto)} />
              <Dato label={`Comisión ${(100 - p.divisor * 100).toFixed(0)}% · divisor ${p.divisor.toFixed(2)}`} valor={`× ${p.divisor.toFixed(2)}`} />
              <Dato label="Neto propuesto" valor={formatMonto(p.neto)} />
              <Dato label={`IVA ${p.bruto ? Math.round((p.iva / p.bruto) * 100) : 16}%`} valor={formatMonto(p.iva)} />
            </div>
            {/* Neto vs aprobado (aprobación granular) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#10b98133] bg-[#10b9810d] px-3 py-2 text-[12px]">
              <span className="font-medium text-ink">Aprobado · {p.itemsAprobados}/{p.items.length} sitios</span>
              <span className="text-muted">
                Neto aprobado <b className="demo-num text-[#0f7a55]">{formatMonto(p.netoAprobado)}</b>
                {' '}de {formatMonto(p.neto)} · Total <b className="demo-num text-ink">{formatMonto(p.totalAprobado)}</b>
              </span>
            </div>
            {/* Items con aprobación sitio por sitio */}
            <ul className="divide-y divide-border rounded-md border border-border">
              {p.items.map((it) => {
                const s = sitios?.find((x) => x.id === it.sitioId)
                return (
                  <li key={it.id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                    <label className="flex min-w-0 items-center gap-2">
                      {puedeEditar && (
                        <input
                          type="checkbox"
                          checked={it.aprobado}
                          onChange={(e) => aprobar(it.id, e.target.checked)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      )}
                      <span className={`truncate ${it.aprobado ? 'text-ink' : 'text-muted'}`}>{s?.nombre ?? it.sitioId}</span>
                      {it.aprobado && (
                        <span className="rounded-full border border-[#10b98140] px-1.5 text-[10px] text-[#0f7a55]">aprobado</span>
                      )}
                    </label>
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
                {p.estatus === 'APROBADA' && (
                  <Button size="sm" disabled={generando} onClick={generarCampana}>
                    <ChevronRight className="h-3.5 w-3.5" /> {generando ? 'Generando…' : 'Generar campaña'}
                  </Button>
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
  const [agenciaId, setAgenciaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [comision, setComision] = useState('0')

  // Agencias = clientes tipo AGENCIA (una agencia se asocia a un cliente directo).
  const agencias = (clientes ?? []).filter((c) => c.tipo === 'AGENCIA')

  // La comisión viene de la AGENCIA seleccionada (no del cliente).
  function aplicarAgencia(agId: string) {
    setAgenciaId(agId)
    const ag = clientes?.find((c) => c.id === agId)
    setComision(String(ag?.comisionAgenciaPct ?? 0))
  }
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
  const ivaPctSel = clientes?.find((c) => c.id === clienteId)?.ivaPct ?? 16
  const iva = Math.round(bruto * (ivaPctSel / 100))
  const total = bruto + iva
  // Gate de negociación: si la agencia tiene negociación sin validar, se bloquea.
  const agenciaSel = clientes?.find((c) => c.id === agenciaId)
  const negociacionPendiente = !!agenciaSel?.tieneNegociacion && !agenciaSel?.negociacionValidada
  const valido = !!nombre.trim() && !!fechaInicio && !!fechaFin && sel.size > 0 && !negociacionPendiente

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
        agenciaId: agenciaId || null,
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
        <Campo label="Nombre de la propuesta">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Cliente">
            <select
              className={inputCls}
              value={clienteId}
              onChange={(e) => {
                const id = e.target.value
                setClienteId(id)
                // Precarga la agencia asociada al cliente; la comisión viene de ella.
                const c = clientes?.find((x) => x.id === id)
                if (c?.agenciaId) aplicarAgencia(c.agenciaId)
              }}
            >
              <option value="">— Sin cliente —</option>
              {/* Solo clientes directos como anunciante; las agencias van aparte. */}
              {clientes?.filter((c) => c.tipo !== 'AGENCIA').map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Agencia">
            {agencias.length === 0 ? (
              <div className="flex h-9 items-center rounded border border-dashed border-border-strong px-3 text-[12px] text-muted">
                Crea un cliente tipo «Agencia» para asociarla
              </div>
            ) : (
              <select className={inputCls} value={agenciaId} onChange={(e) => aplicarAgencia(e.target.value)}>
                <option value="">— Sin agencia (directo) —</option>
                {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            )}
          </Campo>
        </div>
        {/* Aviso de negociación sin validar (bloquea crear la propuesta) */}
        {negociacionPendiente && (
          <div className="flex items-start gap-2 rounded-md border border-[#f59e0b40] bg-[#f59e0b0d] p-2.5 text-[12px]">
            <span className="mt-0.5 text-[#9a6700]">⚠</span>
            <div>
              <div className="font-medium text-ink">
                La negociación con «{agenciaSel?.nombre}» no está validada
              </div>
              <div className="text-muted">
                Valida la negociación de la agencia en Clientes para poder crear la propuesta.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Desde"><input type="date" className={inputCls} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Campo>
          <Campo label="Hasta"><input type="date" className={inputCls} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></Campo>
          <Campo label="Comisión de la agencia (%)"><input className={inputCls} value={comision} onChange={(e) => setComision(e.target.value)} /></Campo>
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
          <Dato label={`IVA ${ivaPctSel}%`} valor={formatMonto(iva)} />
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
