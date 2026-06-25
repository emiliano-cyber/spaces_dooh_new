'use client'

import { useMemo, useState } from 'react'
import { Search, Cpu } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { StatusBadge, SITIO_TONO, SITIO_LABEL } from '@/components/demo/StatusBadge'
import {
  useSitios,
  useContratos,
  useArrendadores,
  formatMonto,
  type Sitio,
  type TipoMedio,
} from '@/lib/data/client'

const TIPO_LABEL: Record<TipoMedio, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

const PERIODICIDAD_LABEL: Record<string, string> = {
  SEMANAL: 'Semanal',
  CATORCENAL: 'Catorcenal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
}
const periodicidadLabel = (p?: string) =>
  p ? PERIODICIDAD_LABEL[p.toUpperCase()] ?? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '—'

function esDigital(s: Sitio): boolean {
  return s.tipoMedio === 'PANTALLA_DIGITAL' || s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
}

// Tabla del inventario completo con columnas (incluye propietario, renta y
// periodicidad de pago tomados del contrato vigente de cada sitio).
export function InventarioTabla() {
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState<Sitio | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)

  function abrirFicha(s: Sitio) {
    setActivo(s)
    setFichaOpen(true)
  }

  // sitioId → { propietario, renta, periodicidad } del contrato preferente.
  const rentaPorSitio = useMemo(() => {
    const PR: Record<string, number> = { VIGENTE: 0, POR_VENCER: 1, RENOVADO: 2, VENCIDO: 3, CANCELADO: 4 }
    const arrById = new Map((arrendadores ?? []).map((a) => [a.id, a.nombre]))
    const m = new Map<string, { propietario: string; renta: number; periodicidad: string }>()
    for (const c of (contratos ?? []).slice().sort((a, b) => (PR[a.estatus] ?? 9) - (PR[b.estatus] ?? 9))) {
      if (!m.has(c.sitioId)) {
        m.set(c.sitioId, {
          propietario: arrById.get(c.arrendadorId) ?? '—',
          renta: c.montoRenta,
          periodicidad: c.periodicidad,
        })
      }
    }
    return m
  }, [contratos, arrendadores])

  if (!sitios) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }

  const filtrados = sitios.filter((s) => {
    if (!q) return true
    const t = `${s.nombre} ${s.codigoProveedor} ${s.alcaldia} ${s.ciudad}`.toLowerCase()
    return t.includes(q.toLowerCase())
  })

  return (
    <>
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pantalla, código, distrito…"
            className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <span className="shrink-0 text-[12px] text-muted">{filtrados.length} de {sitios.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Pantalla</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Ubicación</th>
              <th className="px-3 py-2 font-medium">Medio</th>
              <th className="px-3 py-2 text-right font-medium">Tarifa</th>
              <th className="px-3 py-2 font-medium">Estatus</th>
              <th className="px-3 py-2 font-medium">Propietario</th>
              <th className="px-3 py-2 text-right font-medium">Renta</th>
              <th className="px-3 py-2 font-medium">Cada cuándo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted">
                  Ningún sitio coincide con la búsqueda.
                </td>
              </tr>
            ) : (
              filtrados.map((s) => {
                const r = rentaPorSitio.get(s.id)
                return (
                  <tr key={s.id} onClick={() => abrirFicha(s)} className="cursor-pointer hover:bg-surface-2">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <span className="truncate">{s.nombre}</span>
                        {s.computerVision && <Cpu className="h-3.5 w-3.5 shrink-0 text-info" />}
                      </div>
                      <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{TIPO_LABEL[s.tipoMedio]}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {s.alcaldia ?? '—'}{s.ciudad ? `, ${s.ciudad}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{esDigital(s) ? 'Digital' : 'Fija'}</td>
                    <td className="demo-num px-3 py-2.5 text-right text-ink">{formatMonto(s.tarifaMensual)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tono={SITIO_TONO[s.estatusComercial]}>{SITIO_LABEL[s.estatusComercial]}</StatusBadge>
                    </td>
                    <td className="px-3 py-2.5 text-ink">{r?.propietario ?? <span className="text-muted">Sin propietario</span>}</td>
                    <td className="demo-num px-3 py-2.5 text-right text-ink">{r ? formatMonto(r.renta) : '—'}</td>
                    <td className="px-3 py-2.5 text-muted">{r ? periodicidadLabel(r.periodicidad) : '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>

    <SiteFicha sitio={activo} open={fichaOpen} onOpenChange={setFichaOpen} />
    </>
  )
}
