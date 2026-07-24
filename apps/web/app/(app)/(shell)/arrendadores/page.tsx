'use client'

import { useState } from 'react'
import { CheckCircle2, Plus, FileSignature } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ContratoSheet } from '@/components/demo/arrendadores/ContratoSheet'
import { ContratoWizard } from '@/components/demo/inventario/ContratoWizard'
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
  useMargenPorSitio,
  useRazonesSociales,
  formatMonto,
  formatFecha,
  diasHasta,
  type ContratoArrendamiento,
  type MargenSitio,
} from '@/lib/data/client'
import { registrarPagoRentaApi, crearArrendadorApi } from '@/lib/data/estado-api'

export default function ArrendadoresPage() {
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()
  const margenes = useMargenPorSitio()
  const razones = useRazonesSociales()

  const [sel, setSel] = useState<ContratoArrendamiento | null>(null)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [contratoOpen, setContratoOpen] = useState(false)
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setNuevoOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo propietario
            </Button>
            <Button size="sm" onClick={() => setContratoOpen(true)}>
              <FileSignature className="h-3.5 w-3.5" /> Nuevo contrato
            </Button>
          </div>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Propietarios" valor={`${arrendadores?.length ?? '—'}`} />
        <Mini label="Contratos" valor={`${contratos?.length ?? '—'}`} />
        <Mini label="Por vencer" valor={`${porVencer}`} tono={porVencer ? 'ambar' : undefined} />
        <Mini label="Renta vencida" valor={`${rentaVencida}`} tono={rentaVencida ? 'rojo' : undefined} />
      </div>

      {/* Propietarios: lista de arrendadores dados de alta (aparecen aquí aunque
          todavía no tengan contrato) */}
      <PropietariosCard arrendadores={arrendadores} contratos={contratos ?? []} />

      {/* Rentabilidad por pantalla (P&L: ingreso de reservas activas − renta) */}
      <RentabilidadCard margenes={margenes} />

      {/* Consolidado por razón social (un propietario puede tener varias) */}
      <RazonesSocialesCard
        razones={razones ?? []}
        contratos={contratos ?? []}
        pagos={pagos ?? []}
        nombreArr={nombreArr}
      />

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
      {contratoOpen && (
        <Modal
          open
          onOpenChange={(v) => !v && setContratoOpen(false)}
          size="lg"
          title="Nuevo contrato de arrendamiento"
          subtitle="Arrendatario → contrato (fechas pasadas permitidas) → pantalla"
        >
          <ContratoWizard
            bare
            onCreado={(s) => {
              notify(`Contrato y pantalla "${s.nombre}" creados`)
              setContratoOpen(false)
            }}
          />
        </Modal>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

// Consolidado por razón social: un propietario puede facturar bajo varias
// razones sociales (varias gasolineras/inmuebles). Agrupa sus contratos, predios,
// renta mensual y pagos vencidos.
function RazonesSocialesCard({
  razones, contratos, pagos, nombreArr,
}: {
  razones: { id: string; razonSocial: string; rfc: string | null; arrendadorId: string }[]
  contratos: ContratoArrendamiento[]
  pagos: { contratoId: string; estatus: string }[]
  nombreArr: (id: string) => string
}) {
  const esActivo = (e: string) => e === 'VIGENTE' || e === 'POR_VENCER' || e === 'RENOVADO'
  const aMensual = (monto: number, per: string) => {
    const F: Record<string, number> = { SEMANAL: 30 / 7, CATORCENAL: 30 / 14, QUINCENAL: 2, MENSUAL: 1, BIMESTRAL: 1 / 2, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12 }
    return monto * (F[(per || '').toUpperCase()] ?? 1)
  }
  const filaDe = (id: string | null, nombre: string, rfc: string | null, arrId: string | null) => {
    const cs = contratos.filter((c) => (c.razonSocialId ?? null) === id)
    const activos = cs.filter((c) => esActivo(c.estatus))
    const predios = new Set(cs.map((c) => c.predioId).filter(Boolean)).size
    const rentaMensual = activos.reduce((s, c) => s + aMensual(c.montoRenta, c.periodicidad), 0)
    const cids = new Set(cs.map((c) => c.id))
    const vencidos = pagos.filter((p) => cids.has(p.contratoId) && p.estatus === 'VENCIDO').length
    return { id: id ?? 'sin', nombre, rfc, arr: arrId ? nombreArr(arrId) : '—', total: cs.length, activos: activos.length, predios, rentaMensual, vencidos }
  }
  const filas = razones.map((rs) => filaDe(rs.id, rs.razonSocial, rs.rfc, rs.arrendadorId))
  const sinRs = filaDe(null, 'Sin razón social', null, null)
  const todas = sinRs.total > 0 ? [...filas, sinRs] : filas
  if (todas.length === 0) return null

  return (
    <Card>
      <CardHeader><CardTitle>Por razón social</CardTitle></CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Razón social</th>
                <th className="px-4 py-2 font-medium">Propietario</th>
                <th className="px-4 py-2 text-center font-medium">Contratos</th>
                <th className="px-4 py-2 text-center font-medium">Predios</th>
                <th className="px-4 py-2 text-right font-medium">Renta mensual</th>
                <th className="px-4 py-2 text-center font-medium">Pagos vencidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{f.nombre}</div>
                    {f.rfc && <div className="demo-num text-[11px] text-muted">{f.rfc}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{f.arr}</td>
                  <td className="px-4 py-2.5 text-center text-muted">
                    <span className="text-ink">{f.activos}</span> / {f.total}
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted">{f.predios}</td>
                  <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(Math.round(f.rentaMensual))}</td>
                  <td className="px-4 py-2.5 text-center">
                    {f.vencidos > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-[#ef444440] bg-[#ef44441a] px-2 py-0.5 text-[11px] font-medium text-error">{f.vencidos}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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

// P&L por pantalla: ingreso mensual de reservas activas − renta del arrendador.
function RentabilidadCard({ margenes }: { margenes: MargenSitio[] | undefined }) {
  // Solo pantallas con contrato o con ingreso activo; peores márgenes primero.
  const filas = (margenes ?? [])
    .filter((m) => m.tieneContrato || m.activo)
    .sort((a, b) => a.margenMensual - b.margenMensual)
  const totalIngreso = filas.reduce((s, m) => s + m.ingresoMensual, 0)
  const totalRenta = filas.reduce((s, m) => s + m.rentaMensual, 0)
  const totalMargen = totalIngreso - totalRenta
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rentabilidad por pantalla</CardTitle>
        <p className="mt-0.5 text-[12px] text-muted">
          Margen mensual = ingreso de reservas vigentes − renta del arrendador. Las de margen negativo son candidatas a renegociar o dar de baja.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!margenes ? (
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />)}
          </div>
        ) : filas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">Sin contratos ni reservas activas todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">Pantalla</th>
                  <th className="px-4 py-2 font-medium">Arrendador</th>
                  <th className="px-4 py-2 text-right font-medium">Ingreso/mes</th>
                  <th className="px-4 py-2 text-right font-medium">Renta/mes</th>
                  <th className="px-4 py-2 text-right font-medium">Margen/mes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.sitioId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink">{m.nombre}</div>
                      {!m.tieneContrato && <span className="text-[10px] text-muted">sin contrato de renta</span>}
                    </td>
                    <td className="px-4 py-2 text-muted">{m.arrendador ?? '—'}</td>
                    <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(m.ingresoMensual)}</td>
                    <td className="demo-num px-4 py-2 text-right text-muted">{m.rentaMensual ? formatMonto(m.rentaMensual) : '—'}</td>
                    <td className={cn('demo-num px-4 py-2 text-right font-semibold', m.margenMensual < 0 ? 'text-error' : m.margenMensual > 0 ? 'text-[#0f7a55]' : 'text-muted')}>
                      {formatMonto(m.margenMensual)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2/40 font-medium">
                  <td className="px-4 py-2 text-ink" colSpan={2}>Total</td>
                  <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(totalIngreso)}</td>
                  <td className="demo-num px-4 py-2 text-right text-muted">{formatMonto(totalRenta)}</td>
                  <td className={cn('demo-num px-4 py-2 text-right', totalMargen < 0 ? 'text-error' : 'text-[#0f7a55]')}>{formatMonto(totalMargen)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Lista de propietarios (arrendadores) dados de alta. Se muestran aquí aunque
// aún no tengan contrato — así un alta reciente es visible de inmediato.
function PropietariosCard({
  arrendadores,
  contratos,
}: {
  arrendadores: ReturnType<typeof useArrendadores>
  contratos: ContratoArrendamiento[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Propietarios</CardTitle>
        <p className="mt-0.5 text-[12px] text-muted">Dueños de predio dados de alta.</p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!arrendadores ? (
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : arrendadores.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">
            Aún no hay propietarios. Usa <b>“Nuevo propietario”</b> para dar de alta uno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Propietario</th>
                  <th className="px-4 py-2 font-medium">RFC</th>
                  <th className="px-4 py-2 font-medium">Contacto</th>
                  <th className="px-4 py-2 text-right font-medium">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {arrendadores.map((a) => {
                  const nContratos = contratos.filter((c) => c.arrendadorId === a.id).length
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-ink">{a.nombre}</td>
                      <td className="demo-num px-4 py-2.5 text-muted">{a.rfc || '—'}</td>
                      <td className="px-4 py-2.5 text-muted">
                        {a.email || a.telefono ? (
                          <span>{a.email ?? ''}{a.email && a.telefono ? ' · ' : ''}{a.telefono ?? ''}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="demo-num px-4 py-2.5 text-right text-ink">{nContratos}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
