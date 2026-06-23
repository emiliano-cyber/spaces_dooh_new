'use client'

import { useEffect, useState } from 'react'
import { Plug, Cpu, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'

const API = '/spaces-dooh/api/integraciones'

interface Estado {
  clave: string
  nombre: string
  descripcion: string
  envVar: string
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Integraciones</h1>
        <p className="mt-1 text-[13px] text-muted">Conectores externos · listos para enchufar credenciales</p>
      </div>

      <div className="rounded-md border border-[#f59e0b33] bg-[#fff7e9] px-4 py-2.5 text-[12px] text-[#9a6700]">
        Modo demo: sin credenciales, los conectores devuelven datos <b>simulados</b>. Para activar cada
        integración define su variable de entorno y se conecta al proveedor real.
      </div>

      {!items ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <Card key={it.clave} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-info" />
                  <span className="text-[14px] font-medium text-ink">{it.nombre}</span>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    it.configurado
                      ? 'border-[#10b98140] text-[#0f7a55]'
                      : 'border-[#f59e0b40] text-[#9a6700]'
                  }`}
                >
                  {it.configurado ? 'Conectado' : 'Modo demo'}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-muted">{it.descripcion}</p>
              <p className="demo-num mt-2 text-[11px] text-muted">
                Variable: <code className="rounded bg-surface-2 px-1.5 py-0.5">{it.envVar}</code>
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Prueba de AdMobilize (datos simulados) */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-info" />
          <span className="text-[14px] font-medium text-ink">Probar AdMobilize</span>
        </div>
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
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border bg-surface-2 p-3 text-[12px] sm:grid-cols-4">
            <Dato label="Vehículos" valor={String(metricas.vehiculos)} />
            <Dato label="Personas" valor={String(metricas.personas)} />
            <Dato label="Vel. prom." valor={`${metricas.velocidadPromedioKmh} km/h`} />
            <Dato label="Ventana" valor={metricas.ventana} />
            {metricas.simulado && (
              <div className="col-span-2 text-[11px] text-[#9a6700] sm:col-span-4">⚠ Datos simulados (sin credenciales)</div>
            )}
          </div>
        )}
      </Card>
    </div>
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
