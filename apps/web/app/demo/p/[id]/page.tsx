'use client'

import { useEffect, useState } from 'react'
import { Radio, CalendarDays, Wallet, Coins, Receipt, Building2, MapPin, CircleHelp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { formatMonto, formatFecha } from '@/lib/data/client'

const API = '/spaces-dooh/api'

interface ItemPub {
  sitioNombre: string
  alcaldia: string | null
  tipoMedio: string | null
  lat: number | null
  lng: number | null
  fechaInicio: string
  fechaFin: string
  precio: number
  aprobado: boolean
}
interface PropuestaPub {
  folio: string
  nombre: string
  estatus: string
  clienteNombre: string | null
  agenciaNombre: string | null
  comisionPct: number
  divisor: number
  bruto: number
  neto: number
  iva: number
  total: number
  itemsAprobados: number
  items: ItemPub[]
}

export default function PropuestaPublicaPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PropuestaPub | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    fetch(`${API}/propuestas/publica/${params.id}/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setData(d ?? null))
      .catch(() => vivo && setData(null))
    return () => {
      vivo = false
    }
  }, [params.id])

  if (data === undefined) {
    return (
      <div className="w-full px-6 py-10">
        <div className="h-64 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <CircleHelp className="mb-3 h-8 w-8 text-muted" />
        <h1 className="text-xl text-ink">Enlace no válido</h1>
        <p className="mt-1 text-[13px] text-muted">Esta liga no corresponde a ninguna propuesta.</p>
      </div>
    )
  }

  const p = data
  const ivaPct = p.bruto ? Math.round((p.iva / p.bruto) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)
  const desde = p.items.map((i) => i.fechaInicio).filter(Boolean).sort()[0]
  const hasta = p.items.map((i) => i.fechaFin).filter(Boolean).sort().at(-1)

  // Ubicación de las pantallas en el mapa.
  const puntos: MapPoint[] = p.items
    .filter((it) => it.lat != null && it.lng != null)
    .map((it, i) => ({
      id: `p-${i}`,
      lat: it.lat as number,
      lng: it.lng as number,
      tono: it.tipoMedio === 'PANTALLA_DIGITAL' ? 'azul' : 'verde',
      label: it.sitioNombre,
    }))

  return (
    <div className="min-h-screen bg-bg">
      {/* Header público */}
      <header className="border-b border-border bg-surface">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-fg">
              <Radio className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold text-ink">Spaces</div>
              <div className="text-[10px] text-muted">Propuesta comercial</div>
            </div>
          </div>
          <span className="text-[12px] text-muted">Solo lectura</span>
        </div>
      </header>

      <main className="w-full space-y-4 px-6 py-6">
        {/* Nombre + folio */}
        <div>
          <h1 className="text-2xl text-ink">{p.nombre}</h1>
          <p className="demo-num mt-1 text-[12px] text-muted">{p.folio}</p>
        </div>

        {/* Metadatos */}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <Meta icon={<CalendarDays className="h-4 w-4" />} label="Fechas"
              value={desde && hasta ? `${formatFecha(desde)} – ${formatFecha(hasta)}` : '—'} />
            <Meta label="Anunciante" value={p.clienteNombre ?? 'Sin cliente'} />
            <Meta label="Agencia" value={p.agenciaNombre ?? 'Directa'} />
            <Meta label="Comisión" value={`${comisionPct}%`} />
          </div>
        </Card>

        {/* KPIs */}
        <Card>
          <CardHeader><CardTitle>Resumen económico</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={<Wallet className="h-4 w-4" />} tono="info" label="Total c/IVA" value={formatMonto(p.total)} />
              <Kpi icon={<Coins className="h-4 w-4" />} tono="success" label="Neto" value={formatMonto(p.neto)} />
              <Kpi icon={<Receipt className="h-4 w-4" />} tono="ambar" label={`IVA ${ivaPct}%`} value={formatMonto(p.iva)} />
              <Kpi icon={<Building2 className="h-4 w-4" />} tono="neutro" label="Sitios" value={`${p.items.length}`} />
            </div>
          </CardContent>
        </Card>

        {/* Sitios */}
        <Card>
          <CardHeader><CardTitle>Sitios de la propuesta</CardTitle></CardHeader>
          <CardContent>
            {p.items.length === 0 ? (
              <p className="text-[13px] text-muted">Esta propuesta no tiene sitios.</p>
            ) : (
              <ul className="divide-y divide-border">
                {p.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">{it.sitioNombre}</div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <MapPin className="h-3 w-3" /> {it.alcaldia ?? '—'}{it.tipoMedio ? ` · ${it.tipoMedio}` : ''}
                      </div>
                    </div>
                    <span className="demo-num shrink-0 text-[13px] text-ink">{formatMonto(it.precio)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mapa con la ubicación de las pantallas */}
        {puntos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Ubicación de las pantallas</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[340px] w-full overflow-hidden rounded border border-border">
                <MapView points={puntos} zoom={11} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total */}
        <Card>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              <Fila label="Bruto (tarifa de lista)" valor={formatMonto(p.bruto)} />
              <Fila label={`Comisión de agencia (${comisionPct}%)`} valor={`− ${formatMonto(p.bruto - p.neto)}`} />
              <Fila label="Neto" valor={formatMonto(p.neto)} />
              <Fila label={`IVA ${ivaPct}%`} valor={formatMonto(p.iva)} />
              <div className="mt-1 border-t border-border pt-2">
                <Fila label="Total que paga el cliente" valor={formatMonto(p.total)} fuerte />
              </div>
            </dl>
          </CardContent>
        </Card>

        <p className="pb-4 text-center text-[11px] text-muted">
          Spaces · propuesta comercial · este enlace es de solo lectura
        </p>
      </main>
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
