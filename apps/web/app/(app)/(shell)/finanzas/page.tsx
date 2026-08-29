'use client'

import { toast } from 'sonner'
import { Fragment, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, FileText, Lock, Receipt } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { EmptyState } from '@/components/demo/EmptyState'
import type { Cobranza, Factura, EstCobranza } from '@/lib/data/types'
import {
  StatusBadge,
  COBRANZA_TONO,
  COBRANZA_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { generarFacturaApi, recordarCobranzaApi, pagarCobranzaApi } from '@/lib/data/estado-api'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { PagosRentaCard } from '@/components/demo/arrendadores/PagosRentaCard'
import { CompromisoRentaCard } from '@/components/demo/arrendadores/CompromisoRentaCard'
import {
  repartirCuotas, PERIODICIDAD_LABEL, duracionMeses, opcionesParcialidad,
  type PeriodicidadCuota,
} from '@/lib/finanzas-calculo'
import {
  useCampanasResumen,
  useFacturas,
  useCobranzas,
  useClientes,
  useConfigNegocio,
  estadoCobranza,
  saldoCobranza,
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
  const [pagoCob, setPagoCob] = useState<{ id: string; folio: string; saldo: number } | null>(null)

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

  // ─── Cobranza agrupada por factura (M7) ────────────────────────────────────
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const alternar = (id: string) =>
    setExpandidas((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const grupos = useMemo(() => {
    if (!cobranzas || !facturas) return []
    // Índice por id: `facturas.find(...)` dentro del map recorría el arreglo
    // entero por cada cuota — con 12 cuotas de 30 facturas son 360 barridos.
    const porId = new Map(facturas.map((fx) => [fx.id, fx]))
    const acc = new Map<string, { factura: typeof facturas[number] | undefined; cuotas: typeof cobranzas }>()
    for (const c of cobranzas) {
      const g = acc.get(c.facturaId) ?? { factura: porId.get(c.facturaId), cuotas: [] }
      g.cuotas.push(c)
      acc.set(c.facturaId, g)
    }
    return [...acc.values()]
      .map((g) => {
        const cuotas = [...g.cuotas].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
        const pendientes = cuotas.filter((c) => estadoCobranza(c) !== 'PAGADA')
        // El estado del grupo es el PEOR de sus cuotas: una factura con once
        // cuotas al corriente y una vencida está vencida, y mostrarla en verde
        // sería justo el semáforo mentiroso que la auditoría reprocha.
        const estados = cuotas.map(estadoCobranza)
        const estado: EstCobranza = estados.includes('VENCIDA') ? 'VENCIDA'
          : estados.includes('POR_VENCER') ? 'POR_VENCER'
          : estados.every((e) => e === 'PAGADA') ? 'PAGADA'
          : 'AL_CORRIENTE'
        return {
          factura: g.factura,
          cuotas,
          estado,
          total: cuotas.reduce((a, c) => a + (c.monto ?? g.factura?.monto ?? 0), 0),
          pagadas: cuotas.length - pendientes.length,
          proxima: pendientes[0]?.fechaVencimiento ?? null,
        }
      })
      // Primero lo que vence antes; las totalmente pagadas, al final.
      .sort((a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999'))
  }, [cobranzas, facturas])


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
        <p className="mt-1 text-[13px] text-muted">Facturación, cobranza y renta a arrendadores</p>
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
                  {/* M7: la misma factura salía repetida una vez por cuota —la
                      auditoría contó F001-CDE401E1 doce veces—, así que la tabla
                      no dejaba ver cuántas facturas hay realmente. Ahora una
                      fila por FACTURA, y sus cuotas se despliegan al pulsarla.
                      Una factura de cuota única no se agrupa: sería un
                      desplegable de un solo elemento. */}
                  {grupos.map((g) => {
                    const abierta = expandidas.has(g.factura?.id ?? '')
                    if (g.cuotas.length === 1) {
                      return <FilaCuota key={g.cuotas[0].id} cob={g.cuotas[0]} fac={g.factura} cliNombre={cliNombre} puedeCobrar={puedeCobrar} recordando={recordando} onPagar={setPagoCob} onRecordar={recordar} />
                    }
                    return (
                      <Fragment key={g.factura?.id ?? g.cuotas[0].id}>
                        <tr
                          className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                          onClick={() => alternar(g.factura?.id ?? '')}
                        >
                          <td className="demo-num px-4 py-2.5 text-ink">
                            <span className="inline-flex items-center gap-1.5">
                              <ChevronRight className={cn('h-3.5 w-3.5 text-muted transition-transform', abierta && 'rotate-90')} />
                              {g.factura?.folio ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="demo-num text-[10px] leading-tight text-muted" title={g.factura?.folioFiscal ?? ''}>
                              {g.factura?.folioFiscal ? `${g.factura.folioFiscal.slice(0, 13)}…` : '—'}
                            </div>
                            {g.factura?.rfc && <div className="demo-num text-[10px] text-muted">{g.factura.rfc}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-muted">{g.factura ? cliNombre(g.factura.clienteId) : '—'}</td>
                          <td className="demo-num px-4 py-2.5 text-right text-ink">
                            {formatMonto(g.total)}
                            <div className="text-[10px] text-muted">
                              {g.pagadas} de {g.cuotas.length} cuotas pagadas
                            </div>
                          </td>
                          <td className="demo-num px-4 py-2.5 text-muted">{g.cuotas[0].plazoDias} días</td>
                          <td className="demo-num px-4 py-2.5 text-muted">
                            {/* La fecha del GRUPO es la de la próxima cuota sin
                                pagar: es la que dice cuándo hay que actuar. */}
                            {g.proxima ? formatFecha(g.proxima) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge tono={COBRANZA_TONO[g.estado]}>{COBRANZA_LABEL[g.estado]}</StatusBadge>
                          </td>
                        </tr>
                        {abierta && g.cuotas.map((c) => <FilaCuota key={c.id} cob={c} fac={g.factura} sangrada cliNombre={cliNombre} puedeCobrar={puedeCobrar} recordando={recordando} onPagar={setPagoCob} onRecordar={recordar} />)}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lo COMPROMETIDO: cuánto se paga por cada pantalla y cada cuánto, con
          todo normalizado a mes para poder compararlo y sumarlo. Va antes que
          las cuotas porque responde la pregunta de arriba: cuánto cuesta la
          renta al mes. */}
      <CompromisoRentaCard />

      {/* Renta a los propietarios: la otra mitad del flujo de caja. Cobranza
          es lo que ENTRA; esto es lo que SALE y cuándo vence. Mismo componente
          que en Arrendadores para que las reglas no diverjan; aquí se listan
          solo las pendientes, que es lo que Finanzas tiene que programar. */}
      <PagosRentaCard
        soloPendientes
        titulo="Renta por pagar a propietarios"
        onToast={notify}
      />

      <GenerarFacturaDialog
        campana={facturar}
        onClose={() => setFacturar(null)}
        onDone={() => notify('Factura generada')}
      />

      {pagoCob && (
        <PagoModal
          cob={pagoCob}
          onClose={() => setPagoCob(null)}
          onDone={(msg) => { notify(msg); setPagoCob(null) }}
        />
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
  // CFG-01 · los plazos los pone la ORGANIZACIÓN, no el código. Estaban a fuego
  // (`([60, 90, 120] as const).map(...)`) mientras Administración dejaba
  // capturarlos: quien configuraba 45 días no veía el botón, y si llegaba a
  // mandarlo el servidor se lo rechazaba. Se arreglan los dos lados a la vez —
  // dejar solo el servidor daría una pantalla que sigue sin ofrecer lo suyo.
  //
  // El respaldo cuando la lista viene vacía y la regla del plazo por omisión son
  // LOS MISMOS del servidor (`lib/server/config-repo.ts` →
  // `PLAZOS_COBRANZA_RESPALDO` / `plazoPorDefecto`). Están duplicados aquí a
  // propósito: aquel módulo es `server-only` y no se puede importar desde un
  // componente de cliente. Si uno cambia, cambia el otro — o la pantalla vuelve
  // a ofrecer un plazo que el servidor rechaza.
  const config = useConfigNegocio()
  const plazos = useMemo(() => {
    const suyos = (config?.plazosCobranza ?? [])
      .map(Number)
      .filter((p) => Number.isFinite(p) && p >= 0)
    return suyos.length ? suyos : [60, 90, 120]
  }, [config])
  const [plazoElegido, setPlazoElegido] = useState<number | null>(null)
  // No se guarda el default en el useState: `useConfigNegocio()` devuelve
  // `undefined` hasta que hidrata, así que un estado inicial se quedaría con el
  // valor de la semilla aunque después llegara la config de verdad.
  const plazo =
    plazoElegido != null && plazos.includes(plazoElegido)
      ? plazoElegido
      : plazos.includes(90)
        ? 90
        : Math.min(...plazos)
  const [enviando, setEnviando] = useState(false)
  // Cobro en parcialidades. Apagado por defecto: el comportamiento de siempre es
  // una sola exhibición, y activarlo tiene que ser una decisión explícita.
  const [enCuotas, setEnCuotas] = useState(false)
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadCuota | ''>('')
  const [primerVenc, setPrimerVenc] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  // Duración de la campaña → qué reparto admite. Sin campaña aún, nada.
  const meses = campana ? duracionMeses(campana.fechaInicio, campana.fechaFin) : 0
  const opciones = opcionesParcialidad(meses)
  const nCuotas = opciones.find((o) => o.periodicidad === periodicidad)?.cuotas ?? 0

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
                await generarFacturaApi(
                  campana.id,
                  // El cast es de tipos, no de valor: `generarFacturaApi` aún
                  // declara la unión `60 | 90 | 120` heredada de cuando la
                  // lista estaba a fuego, y ensancharla toca `estado-api.ts` y
                  // `lib/data/types.ts`, que no son de este cambio. El plazo
                  // que viaja ya salió de la configuración del tenant y el
                  // servidor lo vuelve a validar contra ella.
                  plazo as 60 | 90 | 120,
                  enCuotas && periodicidad ? { periodicidad, primerVencimiento: primerVenc } : null,
                )
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
        {/* Cobro en parcialidades. Las opciones y el nº de cuotas se DERIVAN de
            la duración de la campaña: solo se ofrece lo que da un número entero
            de cuotas y al menos 2. Cobrar en "una parcialidad" no es fraccionar
            nada — eso es el cobro único, que es no marcar la casilla. */}
        <div className="rounded-md border border-border px-3 py-2.5">
          {opciones.length === 0 ? (
            <p className="text-[12px] text-muted">
              Esta campaña dura {meses} {meses === 1 ? 'mes' : 'meses'}: no admite un
              reparto en cuotas iguales, así que se cobra en una sola exhibición.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={enCuotas}
                  onChange={(e) => {
                    setEnCuotas(e.target.checked)
                    if (e.target.checked && !periodicidad) setPeriodicidad(opciones[0].periodicidad)
                  }}
                />
                Cobrar en parcialidades
                <span className="text-[11px] text-muted">· campaña de {meses} {meses === 1 ? 'mes' : 'meses'}</span>
              </label>
              {enCuotas && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={periodicidad}
                      onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadCuota)}
                      className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink"
                    >
                      {opciones.map((o) => (
                        <option key={o.periodicidad} value={o.periodicidad}>
                          {o.cuotas} cuotas {PERIODICIDAD_LABEL[o.periodicidad]}
                        </option>
                      ))}
                    </select>
                    <span className="text-[12px] text-muted">desde</span>
                    <input
                      type="date" value={primerVenc}
                      onChange={(e) => setPrimerVenc(e.target.value)}
                      className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink"
                    />
                  </div>
                  {campana.presupuestoBruto != null && nCuotas > 0 && (
                    <p className="text-[12px] text-muted">
                      {nCuotas} cuotas de{' '}
                      <span className="demo-num font-medium text-ink">
                        {formatMonto(repartirCuotas(campana.presupuestoBruto, nCuotas)[0])}
                      </span>
                      {' '}(la última ajusta el redondeo) · suman{' '}
                      <span className="demo-num text-ink">{formatMonto(campana.presupuestoBruto)}</span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-ink">
            Plazo de cobranza{enCuotas ? ' (informativo con parcialidades)' : ''}
          </span>
          {/* `flex-wrap` porque la lista ya no son tres botones fijos: una
              organización puede tener seis plazos capturados y sin esto se
              salen del diálogo. `min-w` mantiene legible el que quede solo. */}
          <div className="flex flex-wrap gap-2">
            {plazos.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlazoElegido(p)}
                className={cn(
                  'min-w-[5rem] flex-1 rounded border px-3 py-2 text-[13px] font-medium transition-colors duration-150',
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

// S0-2: registrar pago/abono sobre una cobranza (parcial o total) con saldo.
function PagoModal({
  cob,
  onClose,
  onDone,
}: {
  cob: { id: string; folio: string; saldo: number }
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [monto, setMonto] = useState(String(Math.round(cob.saldo * 100) / 100))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const num = Number(monto)
  const excede = num > cob.saldo + 0.005

  async function pagar(total: boolean) {
    setGuardando(true)
    setError(null)
    try {
      // total → liquida el saldo; parcial → el monto ingresado (el backend lo acota al saldo)
      await pagarCobranzaApi(cob.id, total ? undefined : num)
      onDone(total || num >= cob.saldo ? 'Cobranza liquidada' : 'Abono registrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Registrar pago"
      subtitle={`${cob.folio} · saldo ${formatMonto(cob.saldo)}`}
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="secondary" size="sm" disabled={guardando} onClick={() => pagar(true)}>
              Liquidar total
            </Button>
            <Button size="sm" disabled={guardando || !num || num <= 0} onClick={() => pagar(false)}>
              {guardando ? 'Guardando…' : 'Registrar abono'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Monto del abono</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {excede && (
          <p className="text-[12px] text-warning">
            ⚠ El monto excede el saldo ({formatMonto(cob.saldo)}). Solo se aplicará el saldo pendiente.
          </p>
        )}
        <p className="text-[11px] text-muted">
          Al cubrir el saldo total, la cobranza pasa a <b>Pagada</b> y se detienen los recordatorios.
        </p>
      </div>
    </Modal>
  )
}

// Una fila de CUOTA: las mismas celdas de siempre, con sangría si va dentro de
// una factura desplegada.
//
// Va en el nivel SUPERIOR del módulo, no dentro de FinanzasPage. Definida
// dentro, React ve un tipo de componente nuevo en cada render del padre y
// desmonta y vuelve a montar TODAS las filas — el DOM entero de la tabla, en
// cada tecla del filtro. Sería justo lo contrario de lo que busca M7. Cuesta
// cinco props y las vale.
function FilaCuota({
cob, fac, sangrada, cliNombre, puedeCobrar, recordando, onPagar, onRecordar,
}: {
cob: Cobranza
fac?: Factura
sangrada?: boolean
cliNombre: (id: string) => string
puedeCobrar: boolean
recordando: string | null
onPagar: (c: { id: string; folio: string; saldo: number }) => void
onRecordar: (id: string) => void
}) {
  const est = estadoCobranza(cob)
  const dias = diasHasta(cob.fechaVencimiento)
  return (
    <tr className={cn('border-b border-border last:border-0', sangrada && 'bg-surface-2/40')}>
      <td className={cn('demo-num px-4 py-2.5 text-ink', sangrada && 'pl-10 text-muted')}>
        {sangrada ? `Cuota ${cob.numero ?? '—'} de ${cob.totalCuotas ?? '—'}` : fac?.folio ?? '—'}
      </td>
      <td className="px-4 py-2.5">
        {!sangrada && (
          <>
            <div className="demo-num text-[10px] leading-tight text-muted" title={fac?.folioFiscal ?? ''}>
              {fac?.folioFiscal ? `${fac.folioFiscal.slice(0, 13)}…` : '—'}
            </div>
            {fac?.rfc && <div className="demo-num text-[10px] text-muted">{fac.rfc}</div>}
          </>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted">{!sangrada && (fac ? cliNombre(fac.clienteId) : '—')}</td>
      <td className="demo-num px-4 py-2.5 text-right text-ink">
        {/* Con parcialidades, el importe de la fila es el de LA CUOTA, no el
            de la factura entera. */}
        {cob.monto != null ? formatMonto(cob.monto) : fac ? formatMonto(fac.monto) : '—'}
        {cob.montoPagado > 0 && est !== 'PAGADA' && fac && (
          <div className="text-[10px] text-warning">saldo {formatMonto(saldoCobranza(cob, fac))}</div>
        )}
      </td>
      <td className="demo-num px-4 py-2.5 text-muted">{cob.plazoDias} días</td>
      <td className="demo-num px-4 py-2.5 text-muted">
        {/* El espacio es un carácter de verdad, no solo el margen: `ml-1`
            separa a la vista pero al copiar la celda salía «27/08/2026(24d)»
            pegado, que es lo que reportó M8. */}
        {formatFecha(cob.fechaVencimiento)}{' '}
        <span className={cn('text-[11px]', dias < 0 ? 'text-error' : dias <= 30 ? 'text-warning' : 'text-muted')}>
          ({dias < 0 ? `${Math.abs(dias)}d vencida` : `${dias}d`})
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge tono={COBRANZA_TONO[est]}>{COBRANZA_LABEL[est]}</StatusBadge>
          {est !== 'PAGADA' && puedeCobrar && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPagar({ id: cob.id, folio: fac?.folio ?? cob.id, saldo: saldoCobranza(cob, fac) })}
                className="rounded border border-[#10b98155] bg-[#10b9810d] px-2 py-0.5 text-[11px] font-medium text-[#0f7a55] hover:bg-[#10b9811a]"
              >
                Registrar pago
              </button>
              <button
                type="button"
                onClick={() => onRecordar(cob.id)}
                disabled={recordando === cob.id}
                className="rounded border border-border-strong px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2 disabled:opacity-50"
              >
                {recordando === cob.id ? 'Enviando…' : 'Recordar'}
              </button>
              {cob.recordatoriosEnviados > 0 && (
                <span className="text-[10px] text-muted" title={cob.recordatorioEn ? `Último: ${formatFecha(cob.recordatorioEn)}` : ''}>
                  {cob.recordatoriosEnviados} enviado{cob.recordatoriosEnviados === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
