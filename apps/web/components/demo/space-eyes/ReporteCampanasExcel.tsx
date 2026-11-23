'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  Space Eyes → Campañas: «Descargar Excel» de lo que los equipos detectaron.
// ----------------------------------------------------------------------------
//  El libro lo arma el servidor (`/api/space-eyes/campanas/excel`, el porqué en
//  `lib/server/space-eyes-reporte-controller.ts`); aquí solo se eligen los
//  filtros y se baja. Sin fechas, el servidor toma el mes en curso EN LA ZONA
//  del negocio, y la pantalla lo dice antes de pulsar.
//
//  Lo usan las dos caras de la pantalla: la de verdad (`CampanasEyes`, con sus
//  equipos y campañas para filtrar) y la demostración (`DemoSpaceEyes`, solo
//  fechas), donde el archivo sale con datos de ejemplo y lo confiesa dentro.
// ============================================================================

const CAMPO =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ReporteCampanasExcel({
  equipos,
  campanas,
  demostracion = false,
}: {
  equipos?: { id: number; name: string }[]
  campanas?: { id: number; name: string }[]
  demostracion?: boolean
}) {
  const { t } = useIdioma()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [equipo, setEquipo] = useState('')
  const [campana, setCampana] = useState('')
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descargar = async () => {
    setBajando(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (desde) q.set('desde', desde)
      if (hasta) q.set('hasta', hasta)
      if (equipo) q.set('equipo', equipo)
      if (campana) q.set('campana', campana)
      const consulta = q.toString()
      const r = await fetch(`/spaces-dooh/api/space-eyes/campanas/excel/${consulta ? `?${consulta}` : ''}`, { cache: 'no-store' })
      if (!r.ok) {
        let motivo = `HTTP ${r.status}`
        try {
          const cuerpo = (await r.json()) as { error?: string }
          if (cuerpo?.error) motivo = cuerpo.error
        } catch {
          /* sin cuerpo JSON: queda el código */
        }
        setError(t('spaceeyes.reporte.error', { motivo }))
        return
      }
      // El nombre lo pone el servidor (lleva el rango y, si toca, «demostracion»).
      const nombre = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'space-eyes.xlsx'
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = nombre
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(t('spaceeyes.reporte.error', { motivo: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBajando(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-start gap-2">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">{t('spaceeyes.reporte.panel')}</div>
          <p className="text-[12px] text-muted">{t('spaceeyes.reporte.panel.texto')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] text-muted">
          {t('spaceeyes.reporte.desde')}
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-muted">
          {t('spaceeyes.reporte.hasta')}
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={CAMPO} />
        </label>
        {equipos && equipos.length > 0 && (
          <select aria-label={t('spaceeyes.reporte.col.equipo')} value={equipo} onChange={(e) => setEquipo(e.target.value)} className={CAMPO}>
            <option value="">{t('spaceeyes.reporte.equipo.todos')}</option>
            {equipos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {campanas && campanas.length > 0 && (
          <select aria-label={t('spaceeyes.reporte.col.campana')} value={campana} onChange={(e) => setCampana(e.target.value)} className={CAMPO}>
            <option value="">{t('spaceeyes.reporte.campana.todas')}</option>
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {/* Neutro: descargar no añade ni acepta nada (convenciones.md, «Color de los botones»). */}
        <Button variant="secondary" size="sm" onClick={() => void descargar()} disabled={bajando}>
          {bajando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
          {bajando ? t('spaceeyes.reporte.generando') : t('spaceeyes.reporte.boton')}
        </Button>
      </div>
      {!desde && !hasta && <p className="mt-1.5 text-[11px] text-muted">{t('spaceeyes.reporte.sin-rango')}</p>}
      {demostracion && <p className="mt-1 text-[11px] text-[#7c3aed]">{t('spaceeyes.reporte.demo')}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  )
}
