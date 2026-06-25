'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Wallet,
  Coins,
  Receipt,
  MapPin,
  Building2,
  Send,
  Check,
  X,
  ChevronRight,
  CalendarDays,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Breadcrumbs, type Crumb } from '@/components/demo/ui/Breadcrumbs'
import { trailFromLocation } from '@/lib/nav-trail'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  cambiarEstatusPropuestaApi,
  aprobarItemPropuestaApi,
  generarCampanaDesdePropuestaApi,
} from '@/lib/data/estado-api'
import {
  usePropuestas,
  useClientes,
  useSitios,
  useContratos,
  useArrendadores,
  formatMonto,
  formatFecha,
  type EstPropuesta,
} from '@/lib/data/client'

const EST: Record<EstPropuesta, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'border-border text-muted' },
  ENVIADA: { label: 'Enviada', cls: 'border-[#0a66ff40] text-info' },
  APROBADA: { label: 'Aprobada', cls: 'border-[#10b98140] text-[#0f7a55]' },
  RECHAZADA: { label: 'Rechazada', cls: 'border-[#ef444440] text-error' },
}

export default function PropuestaDetallePage({ params }: { params: { id: string } }) {
  const id = params.id
  const propuestas = usePropuestas()
  const clientes = useClientes()
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const puedeEditar = usePuede('comercial', 'crear')
  const router = useRouter()
  const [generando, setGenerando] = useState(false)

  // Rastro de navegación (cómo llegué); por defecto, Propuestas.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const t = trailFromLocation()
    setTrail(t.length ? t : [{ label: 'Propuestas', href: '/demo/propuestas' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Propuestas', href: '/demo/propuestas' }

  if (!propuestas) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }
  const p = propuestas.find((x) => x.id === id)
  if (!p) {
    return (
      <div className="w-full">
        <p className="text-[13px] text-muted">Propuesta no encontrada.</p>
        <Link href="/demo/propuestas" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a propuestas
        </Link>
      </div>
    )
  }

  const cliente = clientes?.find((c) => c.id === p.clienteId)
  const agencia = clientes?.find((c) => c.id === p.agenciaId)
  const est = EST[p.estatus]
  const ivaPct = p.bruto ? Math.round((p.iva / p.bruto) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)

  // Fechas de la propuesta (min/max de los items).
  const fechas = p.items.map((i) => i.fechaInicio).filter(Boolean).sort()
  const fines = p.items.map((i) => i.fechaFin).filter(Boolean).sort()
  const desde = fechas[0]
  const hasta = fines.at(-1)

  // Info de renta por sitio: contrato vigente del sitio → arrendador + monto.
  const rentaDe = (sitioId: string) => {
    const con = (contratos ?? []).find((c) => c.sitioId === sitioId)
    if (!con) return null
    const arr = (arrendadores ?? []).find((a) => a.id === con.arrendadorId)
    return { monto: con.montoRenta, periodicidad: con.periodicidad, propietario: arr?.nombre ?? '—' }
  }
  const rentaTotal = p.items.reduce((s, it) => s + (rentaDe(it.sitioId)?.monto ?? 0), 0)

  async function cambiar(estatus: EstPropuesta) {
    try { await cambiarEstatusPropuestaApi(id, estatus) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }
  async function aprobar(itemId: string, aprobado: boolean) {
    try { await aprobarItemPropuestaApi(itemId, aprobado) } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }
  async function generarCampana() {
    setGenerando(true)
    try {
      const camp = await generarCampanaDesdePropuestaApi(id)
      if (camp?.id) router.push(`/demo/campanas/${camp.id}`)
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    setGenerando(false)
  }

  return (
    <div className="w-full space-y-4">
      {/* Migas */}
      <div className="flex flex-wrap items-center gap-2">
        {volver.href && (
          <Link href={volver.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
          </Link>
        )}
        <span className="text-muted/50">·</span>
        <Breadcrumbs items={[...trail, { label: p.nombre }]} />
      </div>

      {/* Encabezado: nombre de la campaña/propuesta + estatus + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl text-ink">{p.nombre}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${est.cls}`}>{est.label}</span>
          </div>
          <p className="demo-num mt-1 text-[12px] text-muted">{p.folio}</p>
        </div>
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

      {/* Barra de metadatos (fechas / anunciante / agencia / comisión) */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Meta icon={<CalendarDays className="h-4 w-4" />} label="Fechas"
            value={desde && hasta ? `${formatFecha(desde)} – ${formatFecha(hasta)}` : '—'} />
          <Meta label="Anunciante" value={cliente?.nombre ?? 'Sin cliente'} />
          <Meta label="Agencia" value={agencia?.nombre ?? 'Directa'} />
          <Meta label="Comisión" value={`${comisionPct}%`} />
        </div>
      </Card>

      {/* Resumen económico (KPIs) */}
      <Card>
        <CardHeader><CardTitle>Resumen económico</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={<Wallet className="h-4 w-4" />} tono="info" label="Total c/IVA" value={formatMonto(p.total)} />
            <Kpi icon={<Coins className="h-4 w-4" />} tono="success" label="Neto propuesto" value={formatMonto(p.neto)} />
            <Kpi icon={<Receipt className="h-4 w-4" />} tono="ambar" label={`IVA ${ivaPct}%`} value={formatMonto(p.iva)} />
            <Kpi icon={<Building2 className="h-4 w-4" />} tono="neutro" label="Sitios" value={`${p.items.length}`} />
          </div>
        </CardContent>
      </Card>

      {/* Sitios y renta (publishers) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sitios y renta</CardTitle>
          <span className="text-[12px] text-muted">
            Renta total ref. <b className="demo-num text-ink">{formatMonto(rentaTotal)}</b>
          </span>
        </CardHeader>
        <CardContent>
          {p.items.length === 0 ? (
            <p className="text-[13px] text-muted">Esta propuesta no tiene sitios.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Sitio</th>
                    <th className="py-2 pr-3 font-medium">Propietario · renta</th>
                    <th className="py-2 pr-3 text-right font-medium">Precio propuesta</th>
                    <th className="py-2 pl-3 text-right font-medium">Aprobado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.items.map((it) => {
                    const s = sitios?.find((x) => x.id === it.sitioId)
                    const renta = rentaDe(it.sitioId)
                    return (
                      <tr key={it.id} className={it.aprobado ? '' : 'opacity-70'}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-ink">{s?.nombre ?? it.sitioId}</div>
                          <div className="inline-flex items-center gap-1 text-[11px] text-muted">
                            <MapPin className="h-3 w-3" /> {s?.alcaldia ?? '—'}{s?.tipoMedio ? ` · ${s.tipoMedio}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {renta ? (
                            <>
                              <div className="text-ink">{renta.propietario}</div>
                              <div className="demo-num text-[11px] text-muted">
                                {formatMonto(renta.monto)} · {renta.periodicidad}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted">Sin contrato de renta</span>
                          )}
                        </td>
                        <td className="demo-num py-2.5 pr-3 text-right text-ink">{formatMonto(it.precio)}</td>
                        <td className="py-2.5 pl-3 text-right">
                          {puedeEditar ? (
                            <input
                              type="checkbox"
                              checked={it.aprobado}
                              onChange={(e) => aprobar(it.id, e.target.checked)}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                          ) : it.aprobado ? (
                            <Check className="ml-auto h-4 w-4 text-success" />
                          ) : (
                            <X className="ml-auto h-4 w-4 text-muted" />
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

      {/* Costo (método del divisor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Costo · método del divisor</CardTitle>
          <span className="text-[12px] text-muted">
            Aprobado {p.itemsAprobados}/{p.items.length} sitios
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Desglose */}
            <dl className="space-y-2 text-[13px]">
              <Fila label="Bruto (tarifa de lista)" valor={formatMonto(p.bruto)} />
              <Fila label={`Comisión de agencia (${comisionPct}%) · divisor ×${p.divisor.toFixed(2)}`} valor={`− ${formatMonto(p.bruto - p.neto)}`} />
              <Fila label="Neto (lo que recibe el medio)" valor={formatMonto(p.neto)} />
              <Fila label={`IVA ${ivaPct}%`} valor={formatMonto(p.iva)} />
              <div className="mt-1 border-t border-border pt-2">
                <Fila label="Total que paga el cliente" valor={formatMonto(p.total)} fuerte />
              </div>
            </dl>
            {/* Aprobado */}
            <div className="rounded-md border border-[#10b98133] bg-[#10b9810d] p-3">
              <div className="mb-2 text-[12px] font-medium text-ink">Sobre lo aprobado</div>
              <dl className="space-y-2 text-[13px]">
                <Fila label="Bruto aprobado" valor={formatMonto(p.brutoAprobado)} />
                <Fila label="Neto aprobado" valor={formatMonto(p.netoAprobado)} />
                <Fila label="Total aprobado" valor={formatMonto(p.totalAprobado)} fuerte />
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Meta({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        {icon}{label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink" title={value}>{value}</div>
    </div>
  )
}

const KPI_TONO: Record<string, string> = {
  info: 'bg-[#0a66ff1a] text-info',
  success: 'bg-[#10b9811a] text-[#0f7a55]',
  ambar: 'bg-[#f59e0b1a] text-[#9a6700]',
  neutro: 'bg-surface-2 text-muted',
}
function Kpi({ icon, tono, label, value }: { icon: React.ReactNode; tono: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${KPI_TONO[tono] ?? KPI_TONO.neutro}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="demo-num truncate text-[16px] font-semibold text-ink">{value}</div>
      </div>
    </div>
  )
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`demo-num ${fuerte ? 'font-semibold text-ink' : 'text-ink'}`}>{valor}</dd>
    </div>
  )
}
