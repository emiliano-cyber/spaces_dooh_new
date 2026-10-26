'use client'

import { useEffect, useState } from 'react'
import { Plug, Cpu, Activity, AlertTriangle, MonitorPlay, Receipt, Compass, ChevronRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/demo/ui/Card'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { formatNumero } from '@/lib/formato-numero'
import { EmptyState } from '@/components/demo/EmptyState'
import { Chip, TONO } from '@/components/demo/admin/Chip'

const API = '/spaces-dooh/api/integraciones'

interface Estado {
  clave: string
  nombre: string
  descripcion: string
  configurado: boolean
}

export default function IntegracionesPage() {
  const [items, setItems] = useState<Estado[] | null>(null)
  const [device, setDevice] = useState('ADM-00123')
  const [metricas, setMetricas] = useState<any>(null)
  const [probando, setProbando] = useState(false)

  useEffect(() => {
    fetch(`${API}/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { integraciones: [] }))
      .then((d) => setItems(d.integraciones ?? []))
      .catch(() => setItems([]))
  }, [])

  async function probarAdmobilize() {
    setProbando(true)
    try {
      const r = await fetch(`${API}/?admobilize=${encodeURIComponent(device)}`, { cache: 'no-store' })
      setMetricas(await r.json())
    } catch {
      setMetricas(null)
    }
    setProbando(false)
  }

  const conectados = items?.filter((it) => it.configurado).length ?? 0
  const sinCredenciales = (items?.length ?? 0) - conectados

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Integraciones</h1>
        <p className="mt-1 text-[13px] text-muted">Conectores externos · listos para enchufar credenciales</p>
      </div>

      {/* El aviso solo aparece si de verdad hay algún conector sin credenciales.
          Antes era fijo, así que un despliegue con todo conectado seguía
          anunciando "Modo demo" (B8). Se enseña el hecho, no la receta para
          arreglarlo: el nombre de cada variable ya no viaja al navegador. */}
      {items?.some((it) => !it.configurado) && (
        <div className={`flex items-start gap-2 rounded-md border px-4 py-2.5 text-[12px] ${TONO.aviso}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
          <span>
            Hay conectores sin credenciales: devuelven datos <b>simulados</b> hasta que se
            configuren en el servidor.
          </span>
        </div>
      )}

      {/* El resumen dice cuántos están conectados sin tener que leer las
          tarjetas una a una. */}
      <CardColapsable
        id="integraciones.conectores"
        titulo="Conectores"
        icono={<Plug className="h-4 w-4 text-muted" />}
        resumen={items && items.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={conectados > 0 ? 'exito' : 'neutro'}>
              <span className="demo-num">{conectados} de {items.length}</span> {conectados === 1 ? 'conectado' : 'conectados'}
            </Chip>
            {sinCredenciales > 0 && (
              <Chip tono="aviso"><span className="demo-num">{sinCredenciales}</span> sin credenciales</Chip>
            )}
          </div>
        ) : undefined}
      >
      {!items ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : items.length === 0 ? (
        // El `catch` de arriba iguala «falló la consulta» con «no hay
        // ninguno» (los dos dejan la lista vacía) y eso no se cambia aquí; por
        // eso la frase cubre los dos casos en vez de afirmar uno.
        <EmptyState
          icon={Plug}
          titulo="No hay conectores que mostrar"
          detalle="Si esperabas verlos, puede que la consulta haya fallado: recarga la página."
          className="py-8"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const Icono = ICONO_CONECTOR[it.clave] ?? Plug
            return (
              <Card key={it.clave} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* El icono distingue el conector, no su estado: va en
                        gris y el estado lo dice el chip, con texto. */}
                    <Icono className="h-4 w-4 shrink-0 text-muted" />
                    <span className="text-[14px] font-medium text-ink">{it.nombre}</span>
                  </div>
                  <Chip tono={it.configurado ? 'exito' : 'aviso'} punto>
                    {it.configurado ? 'Conectado' : 'Sin credenciales'}
                  </Chip>
                </div>
                <p className="mt-1.5 text-[12px] text-muted">{it.descripcion}</p>
                <p className="mt-2 text-[11px] text-muted">
                  {it.configurado
                    ? 'Credenciales cargadas · responde el proveedor real.'
                    : 'Devuelve datos simulados.'}
                </p>
              </Card>
            )
          })}
        </div>
      )}
      </CardColapsable>

      {/* Prueba de AdMobilize (datos simulados). El dispositivo y la última
          consulta viven en la página, así que plegar no los pierde.
          Plegada por omisión: es una herramienta de diagnóstico, no el
          contenido principal, y abierta ocupaba tanto como el catálogo. */}
      <CardColapsable
        id="integraciones.probar-admobilize"
        titulo="Probar AdMobilize"
        icono={<Cpu className="h-4 w-4 text-muted" />}
        subtitulo="Diagnóstico · devuelve datos simulados sin credenciales"
        defaultAbierto={false}
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">ID del dispositivo</span>
            <input
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="h-9 w-48 rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <Button size="sm" variant="secondary" disabled={probando} onClick={probarAdmobilize}>
            <Activity className="h-4 w-4" /> {probando ? 'Consultando…' : 'Consultar métricas'}
          </Button>
        </div>
        {metricas && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
            <Dato label="Vehículos" valor={formatNumero(metricas.vehiculos)} />
            <Dato label="Personas" valor={formatNumero(metricas.personas)} />
            <Dato label="Vel. prom." valor={`${metricas.velocidadPromedioKmh} km/h`} />
            <Dato label="Ventana" valor={metricas.ventana} />
            {metricas.simulado && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink">
                <AlertTriangle className="h-3.5 w-3.5 text-[#9a6700]" /> Datos simulados (sin credenciales)
              </span>
            )}
          </div>
        )}
      </CardColapsable>

      {/* Quien busca DOOHmain o las actualizaciones en Integraciones no
          encontraba ni una pista: viven en otras pantallas a propósito y no se
          mueven. Solo enlaces a rutas que ya existen; ningún dato nuevo. */}
      <CardColapsable id="integraciones.donde-esta" titulo="Dónde está lo demás" icono={<Compass className="h-4 w-4 text-muted" />}>
        <ul className="m-0 list-none divide-y divide-border p-0">
          {DONDE_ESTA.map((d) => (
            <li key={d.href}>
              <Link href={d.href} className="flex items-center justify-between gap-3 py-2.5 text-ink no-underline hover:text-accent">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{d.titulo}</span>
                  <span className="block text-[12px] text-muted">{d.detalle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </CardColapsable>
    </div>
  )
}

// Icono por conector (`lib/server/integraciones.ts`). Solo distingue cuál es;
// el estado lo lleva el chip.
const ICONO_CONECTOR: Record<string, LucideIcon> = {
  admobilize: Cpu,
  cms: MonitorPlay,
  cfdi: Receipt,
}

const DONDE_ESTA = [
  { href: '/campanas', titulo: 'Publicación en DOOHmain', detalle: 'Desde la ficha de cada campaña' },
  { href: '/network', titulo: 'CMS de cada pantalla', detalle: 'En Network, pantalla por pantalla' },
  { href: '/administracion', titulo: 'Actualizaciones de SPACE OS', detalle: 'En Administración → Configuración → Instancia' },
]

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="demo-num text-[13px] text-ink">{valor}</div>
    </div>
  )
}
