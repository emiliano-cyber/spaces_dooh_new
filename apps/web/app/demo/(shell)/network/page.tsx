'use client'

import { useState } from 'react'
import { Network, Share2, Cpu, CheckCircle2 } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import {
  StatusBadge,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { toggleNetworkApi } from '@/lib/data/sitios-api'
import { useSitios, type CMS } from '@/lib/data/client'

const CMS_LABEL: Record<CMS, string> = {
  BROADSIGN: 'Broadsign',
  INVIDIS: 'Invidis',
  DOOHMAIN: 'Doohmain',
  OTRO: 'Otros',
}

export default function NetworkPage() {
  const sitios = useSitios()
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  const total = sitios?.length ?? 0
  const enNetwork = sitios?.filter((s) => s.enNetwork) ?? []
  const programaticos = sitios?.filter((s) => s.comercializacion === 'PROGRAMATICO').length ?? 0
  const tradicionales = sitios?.filter((s) => s.comercializacion === 'TRADICIONAL').length ?? 0

  // Conteo por CMS (solo de los compartidos a la Network).
  const porCms = new Map<CMS, number>()
  for (const s of enNetwork) {
    if (s.cms) porCms.set(s.cms, (porCms.get(s.cms) ?? 0) + 1)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Network</h1>
        <p className="mt-1 text-[13px] text-muted">
          Inventario sin vender compartible a la Network · decides qué espacios incluir
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!sitios ? (
          <>
            <KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard label="Espacios totales" value={String(total)} sub={`${enNetwork.length} en la Network`} tono="azul" icon={<Network className="h-4 w-4" />} />
            <KPICard label="En la Network" value={String(enNetwork.length)} sub="compartidos" tono="verde" icon={<Share2 className="h-4 w-4" />} />
            <KPICard label="Programáticos" value={String(programaticos)} sub="venta automatizada" tono="ambar" icon={<Cpu className="h-4 w-4" />} />
            <KPICard label="Tradicionales" value={String(tradicionales)} sub="venta directa" tono="neutro" icon={<Cpu className="h-4 w-4" />} />
          </>
        )}
      </div>

      {/* CMS utilizado */}
      <Card>
        <CardHeader>
          <CardTitle>CMS utilizado en la Network</CardTitle>
        </CardHeader>
        <CardContent>
          {!sitios ? (
            <div className="h-10 animate-pulse rounded bg-surface-2" />
          ) : porCms.size === 0 ? (
            <p className="text-[13px] text-muted">Ningún espacio digital compartido aún.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(['BROADSIGN', 'INVIDIS', 'DOOHMAIN', 'OTRO'] as CMS[])
                .filter((c) => porCms.get(c))
                .map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-[13px] text-ink">
                    <Cpu className="h-3.5 w-3.5 text-muted" /> {CMS_LABEL[c]}
                    <span className="demo-num font-semibold">{porCms.get(c)}</span>
                  </span>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventario y reglas de comercialización */}
      <Card>
        <CardHeader>
          <CardTitle>Reglas de comercialización por pantalla</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!sitios ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Pantalla</th>
                    <th className="px-4 py-2 font-medium">Comercialización</th>
                    <th className="px-4 py-2 font-medium">CMS</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                    <th className="px-4 py-2 text-center font-medium">En Network</th>
                  </tr>
                </thead>
                <tbody>
                  {sitios.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-ink">{s.nombre}</div>
                        <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'rounded-full border px-2 py-0.5 text-[12px] font-medium',
                          s.comercializacion === 'PROGRAMATICO' ? 'border-[#f59e0b40] text-[#9a6700]' : 'border-border text-muted',
                        )}>
                          {s.comercializacion === 'PROGRAMATICO' ? 'Programático' : 'Tradicional'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{s.cms ? CMS_LABEL[s.cms] : '—'}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tono={SITIO_TONO[s.estatusComercial]}>{SITIO_LABEL[s.estatusComercial]}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={s.enNetwork}
                          onClick={async () => {
                            await toggleNetworkApi(s.id)
                            notify(s.enNetwork ? `${s.nombre} quitada de la Network` : `${s.nombre} compartida a la Network`)
                          }}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150',
                            s.enNetwork ? 'bg-success' : 'bg-border-strong',
                          )}
                        >
                          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150', s.enNetwork ? 'translate-x-4' : 'translate-x-0.5')} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {toast}</span>
        </div>
      )}
    </div>
  )
}
