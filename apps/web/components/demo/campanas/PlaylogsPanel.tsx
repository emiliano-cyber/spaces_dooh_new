'use client'

import { useCallback, useEffect, useState } from 'react'
import { MonitorPlay, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { formatFechaHora } from '@/lib/data/client'
import {
  playlogsDeCampanaApi,
  consultarPlaylogsApi,
  type ConsultaPlay,
  type TipoConsultaPlay,
} from '@/lib/data/playlogs-api'
import { CreativosEnDoohmain } from './CreativosEnDoohmain'

// ============================================================================
//  Proof of play — reproducciones reportadas por DOOHmain.
//
//  Enseña la respuesta TAL CUAL viene. No hay tabla de "reproducciones por día"
//  todavía porque no hemos visto una respuesta con datos: al 16-jul-2026 DOOHmain
//  devuelve `[]` siempre (nada ha salido al aire). Inventarnos aquí unos números
//  sería fabricar la prueba con la que se le cobra al anunciante.
//
//  Cuando llegue la primera respuesta con contenido, se ve aquí en crudo, se
//  conoce su forma y ENTONCES se construye el reporte encima del histórico ya
//  guardado.
// ============================================================================

const inputCls =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PlaylogsPanel({
  campanaId,
  fechaInicio,
  fechaFin,
}: {
  campanaId: string
  fechaInicio?: string | null
  fechaFin?: string | null
}) {
  const [consultas, setConsultas] = useState<ConsultaPlay[] | null>(null)
  const [publicada, setPublicada] = useState(false)
  const [desde, setDesde] = useState((fechaInicio ?? hoy()).slice(0, 10))
  const [hasta, setHasta] = useState(
    // Sin datos del futuro: el tope es hoy aunque la campaña siga corriendo.
    ((fechaFin ?? hoy()).slice(0, 10) > hoy() ? hoy() : (fechaFin ?? hoy()).slice(0, 10)),
  )
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 29/10 · por campaña (get_stats, la prueba de cobro) o por pantalla
  // (get_metrics, todo lo que sonó en ellas). Cada vista enseña SU última
  // consulta: mezclarlas pondría el historial de una pantalla donde se espera
  // la prueba de esta campaña.
  const [tipo, setTipo] = useState<TipoConsultaPlay>('campana')

  const cargar = useCallback(async () => {
    try {
      const d = await playlogsDeCampanaApi(campanaId)
      setConsultas(d.consultas)
      setPublicada(d.publicadaEnDoohmain)
    } catch {
      setConsultas([])
    }
  }, [campanaId])

  useEffect(() => { void cargar() }, [cargar])

  async function consultar() {
    setError(null)
    setCargando(true)
    try {
      await consultarPlaylogsApi(campanaId, desde, hasta, tipo)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar')
    }
    setCargando(false)
  }

  const deEsteTipo = consultas?.filter((c) => (tipo === 'pantallas' ? c.tipo === 'metrics' : c.tipo !== 'metrics'))
  const ultima = deEsteTipo?.[0]

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Cuántas veces se reprodujo el creativo en las pantallas digitales, según lo que reporta
        DOOHmain. Es la prueba que respalda lo que se le cobra al anunciante, así que se muestra
        exactamente lo que responde el proveedor.
      </p>

      {!publicada ? (
        <p className="rounded border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
          Esta campaña no está publicada en DOOHmain, así que no hay reproducciones que consultar.
          Las pantallas fijas se comprueban con las evidencias fotográficas.
        </p>
      ) : (
        <>
          <CreativosEnDoohmain campanaId={campanaId} />

          <div role="tablist" className="inline-flex rounded border border-border p-0.5 text-[12px]">
            {([
              ['campana', 'De esta campaña'],
              ['pantallas', 'Historial de sus pantallas'],
            ] as const).map(([v, etiqueta]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tipo === v}
                onClick={() => setTipo(v)}
                className={`rounded px-2.5 py-1 ${tipo === v ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {tipo === 'pantallas' && (
            <p className="text-[12px] text-muted">
              Todo lo que DOOHmain registró en las pantallas donde se publicó esta campaña, día por día. Incluye
              otras campañas de esas pantallas: sirve para ver que estuvieron reproduciendo, pero{' '}
              <span className="text-ink">no cuenta como prueba de esta campaña</span> ni abre el candado de
              facturación.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Desde</span>
              <input type="date" value={desde} max={hoy()} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Hasta</span>
              <input type="date" value={hasta} max={hoy()} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
            </label>
            <Button size="sm" variant="secondary" onClick={consultar} disabled={cargando}>
              {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Consultar a DOOHmain
            </Button>
          </div>
          {error && <p className="text-[12px] text-error">{error}</p>}

          {consultas === null ? (
            <div className="h-16 animate-pulse rounded bg-surface-2" />
          ) : !ultima ? (
            <p className="text-[12px] text-muted">Aún no se ha consultado. Elige un rango y pregunta.</p>
          ) : (
            <div className="rounded-md border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink">
                  <MonitorPlay className="h-3.5 w-3.5 text-muted" />
                  {ultima.desde} a {ultima.hasta}
                </span>
                <span className="text-[11px] text-muted">
                  Fuente: DOOHmain · consultado {formatFechaHora(ultima.consultadoEn)}
                </span>
              </div>
              <div className="px-3 py-3">
                {ultima.error ? (
                  <p className="inline-flex items-start gap-1.5 text-[12px] text-error">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ultima.error}
                  </p>
                ) : ultima.vacio ? (
                  <p className="text-[13px] text-ink">
                    DOOHmain no reporta reproducciones en ese rango.
                    <span className="mt-1 block text-[12px] text-muted">
                      Es lo esperado mientras la campaña no haya salido al aire. Un cero aquí es lo que
                      dice el proveedor, no una estimación nuestra.
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-[12px] text-ink">
                      DOOHmain devolvió datos. Se muestran sin interpretar: todavía no hemos visto una
                      respuesta con contenido, así que no se convierten en totales para no arriesgar
                      números equivocados en la prueba de cobro.
                    </p>
                    <pre className="demo-num max-h-64 overflow-auto rounded bg-surface-2 p-2 text-[11px] text-ink">
                      {JSON.stringify(ultima.payload, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          {deEsteTipo && deEsteTipo.length > 1 && (
            <details className="text-[12px]">
              <summary className="cursor-pointer text-muted hover:text-ink">
                Consultas anteriores ({deEsteTipo.length - 1})
              </summary>
              <ul className="mt-2 space-y-1">
                {deEsteTipo.slice(1).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-muted">
                    <span>{c.desde} a {c.hasta}</span>
                    <span>{c.error ? 'error' : c.vacio ? 'sin reproducciones' : 'con datos'}</span>
                    <span className="demo-num text-[11px]">{formatFechaHora(c.consultadoEn)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}
