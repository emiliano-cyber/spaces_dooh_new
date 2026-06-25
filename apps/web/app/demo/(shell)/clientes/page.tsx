'use client'

import { useState } from 'react'
import { Plus, Pencil, Building2, Handshake, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useClientes, type Cliente } from '@/lib/data/client'
import { crearClienteApi, actualizarClienteApi, type ClienteInput } from '@/lib/data/estado-api'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TIPOS = ['DIRECTO', 'AGENCIA'] as const
// Regímenes fiscales más usados (CFDI 4.0). Lista corta para la demo.
const REGIMENES = [
  '601 · General de Ley Personas Morales',
  '612 · Personas Físicas con Actividad Empresarial',
  '626 · RESICO',
  '603 · Personas Morales sin fines de lucro',
]
const USOS_CFDI = ['G03 · Gastos en general', 'G01 · Adquisición de mercancías', 'P01 · Por definir']

export default function ClientesPage() {
  const clientes = useClientes()
  const puedeEditar = usePuede('comercial', 'crear')
  const [editar, setEditar] = useState<Cliente | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Clientes</h1>
          <p className="mt-1 text-[13px] text-muted">Catálogo de clientes y sus datos fiscales</p>
        </div>
        {puedeEditar && (
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo cliente
          </Button>
        )}
      </div>

      {!clientes ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : clientes.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">Aún no hay clientes.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">RFC</th>
                  <th className="px-4 py-2.5">Razón social</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Contacto</th>
                  {puedeEditar && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink">{c.nombre}</td>
                    <td className="demo-num px-4 py-2.5 text-muted">{c.rfc || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{c.razonSocial || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{c.tipo === 'AGENCIA' ? 'Agencia' : 'Directo'}</td>
                    <td className="px-4 py-2.5 text-muted">{c.contacto?.email || '—'}</td>
                    {puedeEditar && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditar(c)}
                          className="inline-flex items-center gap-1 rounded border border-border-strong px-2 py-1 text-[12px] text-ink hover:bg-surface-2"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {nuevoOpen && <ClienteDialog onClose={() => setNuevoOpen(false)} />}
      {editar && <ClienteDialog cliente={editar} onClose={() => setEditar(null)} />}
    </div>
  )
}

// ─── Alta / edición de cliente ───────────────────────────────────────────────
function ClienteDialog({ cliente, onClose }: { cliente?: Cliente; onClose: () => void }) {
  const editando = !!cliente
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [rfc, setRfc] = useState(cliente?.rfc ?? '')
  const [razonSocial, setRazonSocial] = useState(cliente?.razonSocial ?? '')
  const [regimenFiscal, setRegimenFiscal] = useState(cliente?.regimenFiscal ?? '')
  const [cpFiscal, setCpFiscal] = useState(cliente?.cpFiscal ?? '')
  const [usoCfdi, setUsoCfdi] = useState(cliente?.usoCfdi ?? '')
  const [tipo, setTipo] = useState(cliente?.tipo ?? 'DIRECTO')
  const [ivaPct, setIvaPct] = useState(String(cliente?.ivaPct ?? 16))
  const [comisionAgencia, setComisionAgencia] = useState(String(cliente?.comisionAgenciaPct ?? 0))
  const [tieneNegociacion, setTieneNegociacion] = useState(!!cliente?.tieneNegociacion)
  const [negociacionValidada, setNegociacionValidada] = useState(!!cliente?.negociacionValidada)
  const [negociacionNota, setNegociacionNota] = useState(cliente?.negociacionNota ?? '')
  const [email, setEmail] = useState(cliente?.contacto?.email ?? '')
  const [telefono, setTelefono] = useState(cliente?.contacto?.telefono ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    const esAgencia = tipo === 'AGENCIA'
    const input: ClienteInput = {
      nombre: nombre.trim(),
      rfc: rfc.trim() || null,
      razonSocial: razonSocial.trim() || null,
      regimenFiscal: regimenFiscal || null,
      cpFiscal: cpFiscal.trim() || null,
      usoCfdi: usoCfdi || null,
      ivaPct: Number(ivaPct) || 0,
      // La comisión y la negociación solo aplican a la AGENCIA.
      comisionAgenciaPct: esAgencia ? (Number(comisionAgencia) || 0) : 0,
      tieneNegociacion: esAgencia ? tieneNegociacion : false,
      // Si hay negociación, vale lo marcado; si no hay, no aplica (false).
      negociacionValidada: esAgencia && tieneNegociacion ? negociacionValidada : false,
      negociacionNota: esAgencia && tieneNegociacion ? (negociacionNota.trim() || null) : null,
      tipo,
      contacto: { email: email.trim(), telefono: telefono.trim() },
    }
    try {
      if (editando) await actualizarClienteApi(cliente!.id, input)
      else await crearClienteApi(input)
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
      size="lg"
      title={editando ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle="Datos generales y fiscales (para facturar)"
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
        <Campo label="Nombre del cliente">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Tipo">
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t} value={t}>{t === 'AGENCIA' ? 'Agencia' : 'Directo'}</option>)}
            </select>
          </Campo>
          <Campo label="Correo de contacto">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cuentas@cliente.com" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Teléfono">
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
          {/* La comisión es por AGENCIA; no aplica al cliente directo. */}
          {tipo === 'AGENCIA' && (
            <Campo label="Comisión de la agencia (%)">
              <input className={inputCls} value={comisionAgencia} onChange={(e) => setComisionAgencia(e.target.value)} placeholder="0" />
            </Campo>
          )}
        </div>
        <Campo label="IVA (%)">
          <input className={inputCls} value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} placeholder="16" />
          <span className="mt-1 block text-[11px] text-muted">Se aplica al facturar y al presupuesto de sus campañas. México: 16%.</span>
        </Campo>

        {/* Negociación con la agencia (solo agencias) */}
        {tipo === 'AGENCIA' && (
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <Handshake className="h-4 w-4 text-info" /> Negociación con la agencia
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={tieneNegociacion}
                onChange={(e) => {
                  setTieneNegociacion(e.target.checked)
                  if (!e.target.checked) setNegociacionValidada(false)
                }}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              ¿Hay negociación con la agencia?
            </label>

            {tieneNegociacion && (
              <div className="mt-3 space-y-2.5">
                <Campo label="Términos de la negociación">
                  <textarea
                    className="min-h-[60px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={negociacionNota}
                    onChange={(e) => setNegociacionNota(e.target.value)}
                    placeholder="p. ej. comisión especial 18%, condiciones de pago a 60 días…"
                  />
                </Campo>
                <label className="flex items-start gap-2 rounded border border-border bg-surface px-3 py-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={negociacionValidada}
                    onChange={(e) => setNegociacionValidada(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-medium text-ink">Negociación validada</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Mientras no esté validada, no se pueden crear ni aprobar propuestas con esta agencia.
                    </span>
                  </span>
                </label>
                {!negociacionValidada && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#9a6700]">
                    <ShieldAlert className="h-3.5 w-3.5" /> Negociación sin validar
                  </div>
                )}
                {negociacionValidada && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#0f7a55]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Negociación validada
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Building2 className="h-4 w-4 text-info" /> Datos fiscales
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="RFC">
                <input className={inputCls} value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="XAXX010101000" />
              </Campo>
              <Campo label="C.P. fiscal">
                <input className={inputCls} value={cpFiscal} onChange={(e) => setCpFiscal(e.target.value)} placeholder="06700" />
              </Campo>
            </div>
            <Campo label="Razón social">
              <input className={inputCls} value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
            </Campo>
            <Campo label="Régimen fiscal">
              <select className={inputCls} value={regimenFiscal} onChange={(e) => setRegimenFiscal(e.target.value)}>
                <option value="">— Selecciona —</option>
                {REGIMENES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="Uso de CFDI">
              <select className={inputCls} value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)}>
                <option value="">— Selecciona —</option>
                {USOS_CFDI.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Campo>
          </div>
        </div>
      </div>
    </Modal>
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
