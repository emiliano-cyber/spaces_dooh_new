'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  TrendingUp,
  Wallet,
  Gauge,
  HandCoins,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import { useAlertasVisibles, TIPOS_ALERTA } from '@/lib/alertas-visibles'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { OcupacionChart, ReservasChart } from '@/components/demo/charts'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import {
  SITIO_TONO,
  SITIO_LABEL,
  pinTono,
  CAMPANA_TONO,
  CAMPANA_LABEL,
  type Tono,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useDashboard,
  useOcupacionSerie,
  useSitios,
  useCampanas,
  useConfigNegocio,
  formatMonto,
  formatFecha,
  diasHasta,
  type Granularidad,
} from '@/lib/data/client'

function margenTono(pct: number): Tono {
  if (pct >= 30) return 'verde'
  if (pct >= 10) return 'neutro'
  return 'rojo'
}

const GRANS: { value: Granularidad; label: string }[] = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]

export default function DashboardPage() {
  const m = useDashboard()
  const sitios = useSitios()
  const [gran, setGran] = useState<Granularidad>('semana')
  const serie = useOcupacionSerie(gran)
  const campanas = useCampanas()
  const cfg = useConfigNegocio()
  const alertasCfg = useAlertasVisibles()

  // Encabezado: razón social y nombre comercial salen de config_negocio
  // (Administración → Configuración). Solo se muestra el dato que esté cargado.
  const subtitulo = [
    cfg?.razonSocial ? `Razón social: ${cfg.razonSocial}` : null,
    cfg?.nombreComercial ? `Nombre comercial: ${cfg.nombreComercial}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const puntos: MapPoint[] =
    sitios?.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      tono: pinTono(s),
      label: s.nombre,
    })) ?? []

  // Campañas que finalizan/finalizaron en una ventana corta (revisión de ingresos).
  const porFinalizar = (campanas ?? [])
    .map((c) => ({ c, dias: diasHasta(c.fechaFin) }))
    .filter((x) => x.dias >= -7 && x.dias <= 14 && x.c.estadoComercial !== 'CANCELADA')
    .sort((a, b) => a.dias - b.dias)

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl text-ink">Dashboard</h1>
        {subtitulo && <p className="mt-1 text-[13px] text-muted">{subtitulo}</p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!m ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Ingreso contratado del mes"
              value={formatMonto(m.ingresoMes)}
              sub={`${m.reservasConfirmadas} reservas confirmadas`}
              tono="azul"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              label="Margen"
              value={`${m.margenPct.toFixed(0)}%`}
              sub={`${formatMonto(m.margen)} · costo ${formatMonto(m.costoTotalMes)}`}
              tono={margenTono(m.margenPct)}
              icon={<Wallet className="h-4 w-4" />}
            />
            <KPICard
              label="Por cobrar"
              value={formatMonto(m.porCobrar)}
              sub="facturas emitidas pendientes"
              tono="ambar"
              icon={<HandCoins className="h-4 w-4" />}
            />
            <KPICard
              label="Ocupación de la red"
              value={`${m.ocupacionPct.toFixed(0)}%`}
              sub={`${m.sitiosOcupados} de ${m.sitiosTotales} sitios`}
              tono="azul"
              icon={<Gauge className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Desglose del costo del mes (motor de costos: espacios + impresión + operación) */}
      {m && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
          <span className="font-medium text-ink">Costos del mes</span>
          <CostoItem label="Espacios" valor={formatMonto(m.costoEspaciosMes)} />
          <CostoItem label="Impresión" valor={formatMonto(m.costoImpresionMes)} />
          <CostoItem label="Operación" valor={formatMonto(m.costoOperacionMes)} />
          <CostoItem label="Total" valor={formatMonto(m.costoTotalMes)} fuerte />
        </div>
      )}

      {/* Ocupación + Reservas vs confirmaciones */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ocupación</CardTitle>
              {serie && (
                <p className="mt-0.5 text-[12px] text-muted">
                  {serie.diasOcupados.toLocaleString('es-PE')} días ocupados de{' '}
                  {serie.diasDisponibles.toLocaleString('es-PE')} disponibles
                </p>
              )}
            </div>
            <Segmented value={gran} onChange={setGran} />
          </CardHeader>
          <CardContent>
            {!serie ? (
              <div className="h-[180px] animate-pulse rounded bg-surface-2" />
            ) : (
              <OcupacionChart puntos={serie.puntos} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservas: tentativas vs confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            {!m ? (
              <div className="h-[150px] animate-pulse rounded bg-surface-2" />
            ) : (
              <>
                <ReservasChart tentativo={m.valorTentativo} confirmado={m.valorConfirmado} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <Leyenda color="#f59e0b" label="Tentativas" valor={formatMonto(m.valorTentativo)} />
                  <Leyenda color="#10b981" label="Confirmadas" valor={formatMonto(m.valorConfirmado)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas + Mini-mapa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alertas</CardTitle>
            <ConfigAlertas cfg={alertasCfg} />
          </CardHeader>
          <CardContent>
            {(() => {
              // Solo los tipos que el usuario dejó encendidos (todos por default).
              const visibles = (m?.alertas ?? []).filter((al) => alertasCfg.esVisible(al.tipo))
              if (!m) return <div className="h-32 animate-pulse rounded bg-surface-2" />
              if (visibles.length === 0) {
                return (
                  <p className="text-[13px] text-muted">
                    {m.alertas.length === 0
                      ? 'Sin alertas activas.'
                      : 'No hay alertas de los tipos que elegiste mostrar.'}
                  </p>
                )
              }
              return (
              <ul className="space-y-2.5">
                {visibles.slice(0, 6).map((al) => (
                  <li key={al.id} className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        al.nivel === 'rojo' ? 'text-error' : 'text-warning',
                      )}
                      strokeWidth={1.75}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">{al.titulo}</div>
                      <div className="text-[12px] text-muted">{al.detalle}</div>
                    </div>
                  </li>
                ))}
              </ul>
              )
            })()}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tu red en el mapa</CardTitle>
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
            >
              Ver comercial <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-[460px] w-full overflow-hidden rounded border border-border">
              {sitios ? (
                <MapView points={puntos} zoom={10.4} />
              ) : (
                <div className="h-full w-full animate-pulse bg-surface-2" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
              <LeyendaPin color="#0a66ff" label="Digital" />
              <LeyendaPin color="#10b981" label="Disponible" />
              <LeyendaPin color="#ef4444" label="Ocupado" />
              <LeyendaPin color="#f59e0b" label={SITIO_LABEL.RESERVADO} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campañas por finalizar / recién finalizadas (revisión de ingresos) */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas por finalizar</CardTitle>
        </CardHeader>
        <CardContent>
          {!campanas ? (
            <div className="h-20 animate-pulse rounded bg-surface-2" />
          ) : porFinalizar.length === 0 ? (
            <p className="text-[13px] text-muted">Ninguna campaña finaliza en los próximos días.</p>
          ) : (
            <ul className="divide-y divide-border">
              {porFinalizar.map(({ c, dias }) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/campanas/${c.id}`} className="truncate text-[13px] text-ink hover:underline">
                      {c.nombre}
                    </Link>
                    <div className="demo-num text-[11px] text-muted">
                      Finaliza {formatFecha(c.fechaFin)} ·{' '}
                      {dias < 0 ? `terminó hace ${Math.abs(dias)} d` : dias === 0 ? 'hoy' : `en ${dias} d`}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[12px] font-medium',
                      CAMPANA_TONO[c.estadoComercial] === 'verde' && 'border-[#10b98140] text-[#0f7a55]',
                      CAMPANA_TONO[c.estadoComercial] === 'azul' && 'border-[#0a66ff40] text-info',
                      CAMPANA_TONO[c.estadoComercial] === 'ambar' && 'border-[#f59e0b40] text-[#9a6700]',
                      CAMPANA_TONO[c.estadoComercial] === 'neutro' && 'border-border text-muted',
                    )}
                  >
                    {CAMPANA_LABEL[c.estadoComercial]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Menú para elegir qué tipos de alerta se muestran en pantalla. Todas encendidas
// por default; la preferencia se guarda por navegador (localStorage).
function ConfigAlertas({ cfg }: { cfg: ReturnType<typeof useAlertasVisibles> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Configurar alertas"
          title="Elegir qué alertas ver"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-border-strong bg-white text-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
          {cfg.listo && cfg.ocultos > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
              {cfg.ocultos}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-md border border-border bg-surface p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="px-2 py-1.5 text-[12px] font-medium text-ink">Alertas a mostrar</div>
          <div className="my-1 h-px bg-border" />
          {TIPOS_ALERTA.map((t) => {
            const activo = cfg.esVisible(t.tipo)
            return (
              <DropdownMenu.Item
                key={t.tipo}
                onSelect={(e) => {
                  e.preventDefault() // no cerrar el menú al alternar
                  cfg.alternar(t.tipo)
                }}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    activo ? 'border-accent bg-accent text-white' : 'border-border-strong bg-white',
                  )}
                >
                  {activo && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {t.label}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Segmented({
  value,
  onChange,
}: {
  value: Granularidad
  onChange: (g: Granularidad) => void
}) {
  return (
    <div className="inline-flex rounded border border-border p-0.5">
      {GRANS.map((g) => (
        <button
          key={g.value}
          type="button"
          onClick={() => onChange(g.value)}
          className={cn(
            'rounded px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
            value === g.value ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}

function Leyenda({ color, label, valor }: { color: string; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="demo-num ml-auto text-ink">{valor}</span>
    </div>
  )
}

function LeyendaPin({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function CostoItem({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <span className={`demo-num ${fuerte ? 'font-semibold text-ink' : 'text-ink'}`}>{valor}</span>
    </span>
  )
}
