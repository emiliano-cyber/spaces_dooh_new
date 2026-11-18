'use client'

import { useEffect, useMemo, useState } from 'react'
import { ConteoDiarioChart, type PuntoConteo } from '@/components/demo/charts'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { localeDe } from '@/lib/i18n/formato-idioma'
import type { ConteoDiario } from '@/lib/propuestas-por-dia'

// ============================================================================
//  components/demo/inicio/ConteoDiario.tsx — el bloque «Campañas por día» del
//  Dashboard (CONTEO-DIA, 17/11).
// ----------------------------------------------------------------------------
//  Creadas y aprobadas, día por día, de los últimos 30 días. El VENDEDOR ve lo
//  suyo; quien puede aprobar en Comercial ve el total y una fila por vendedor.
//  Quién ve qué lo decide el SERVIDOR (`/api/propuestas/conteo-diario`): la
//  pantalla solo pinta lo que le llega y lee `soloPropio` para el rótulo.
//
//  La tarjeta (título, ojo de «Personalizar», plegado) la pone la página, como
//  a las demás; aquí va solo el contenido.
// ============================================================================

export const DIAS_DEL_BLOQUE = 30

export type EstadoConteo =
  | { fase: 'cargando' }
  | { fase: 'error' }
  | { fase: 'datos'; soloPropio: boolean; conteo: ConteoDiario }

export function useConteoDiario(activo: boolean): EstadoConteo {
  const [v, setV] = useState<EstadoConteo>({ fase: 'cargando' })
  useEffect(() => {
    if (!activo) return
    const control = new AbortController()
    void (async () => {
      try {
        const r = await fetch('/spaces-dooh/api/propuestas/conteo-diario/', { cache: 'no-store', signal: control.signal })
        // `catch` propio: detrás de nginx un 500 puede venir en HTML.
        const d = await r.json().catch(() => null)
        if (control.signal.aborted) return
        setV(r.ok && d?.conteo ? { fase: 'datos', soloPropio: !!d.soloPropio, conteo: d.conteo } : { fase: 'error' })
      } catch {
        if (!control.signal.aborted) setV({ fase: 'error' })
      }
    })()
    return () => control.abort()
  }, [activo])
  return v
}

export function BloqueConteoDiario({ estado }: { estado: EstadoConteo }) {
  const { t, idioma } = useIdioma()
  const puntos: PuntoConteo[] = useMemo(() => {
    if (estado.fase !== 'datos') return []
    const fmt = new Intl.DateTimeFormat(localeDe(idioma), { day: 'numeric', month: 'short', timeZone: 'UTC' })
    const c = estado.conteo
    // El día es una etiqueta AAAA-MM-DD; se pinta a mediodía UTC para que
    // ninguna zona lo corra al día anterior.
    return c.dias.map((d, i) => ({
      label: fmt.format(new Date(`${d}T12:00:00Z`)),
      creadas: c.total.creadas[i] ?? 0,
      aprobadas: c.total.aprobadas[i] ?? 0,
    }))
  }, [estado, idioma])

  if (estado.fase === 'cargando') return <div className="h-[220px] animate-pulse rounded bg-surface-2" />
  if (estado.fase === 'error') return <p className="text-[13px] text-muted">{t('inicio.conteo.error')}</p>

  const { conteo, soloPropio } = estado
  const n = (v: number) => formatNumero(v, 0, idioma)
  const ultimo = conteo.dias.length - 1
  const vacio = conteo.total.totalCreadas === 0 && conteo.total.totalAprobadas === 0
  const ultimos = t('inicio.ultimos', { n: conteo.dias.length })

  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-3 gap-3">
        <Dato label={t('inicio.conteo.creadas')} valor={n(conteo.total.totalCreadas)} sub={ultimos} />
        <Dato label={t('inicio.conteo.aprobadas')} valor={n(conteo.total.totalAprobadas)} sub={ultimos} />
        <Dato
          label={t('inicio.conteo.hoy')}
          valor={`${n(conteo.total.creadas[ultimo] ?? 0)} · ${n(conteo.total.aprobadas[ultimo] ?? 0)}`}
          sub={t('inicio.conteo.hoy-sub')}
        />
      </div>

      {vacio ? (
        <p className="text-muted">{t('inicio.conteo.vacio', { n: conteo.dias.length })}</p>
      ) : (
        <ConteoDiarioChart puntos={puntos} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Leyenda color="#0a66ff" label={t('inicio.conteo.creadas')} />
        <Leyenda color="#10b981" label={t('inicio.conteo.aprobadas')} />
        {soloPropio && <span>{t('inicio.conteo.solo-tuyas')}</span>}
      </div>
      <p className="text-[11px] text-muted">{t('inicio.conteo.ayuda')}</p>

      {/* Solo quien ve a todo el equipo: al vendedor le llega una sola fila, la
          suya, y repetirla debajo del total no dice nada. */}
      {!soloPropio && conteo.porVendedor.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 font-medium text-ink">
            <span>{t('inicio.conteo.por-vendedor')}</span>
            <span className="shrink-0 text-[11px] font-normal text-muted">{t('inicio.conteo.hoy-sub')}</span>
          </div>
          <ul className="space-y-1">
            {conteo.porVendedor.map((v) => (
              <li key={v.id ?? ''} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink">{v.id === null ? t('inicio.sin-vendedor') : (v.nombre ?? t('inicio.sin-vendedor'))}</span>
                <span className="demo-num shrink-0 text-muted">
                  {n(v.totalCreadas)} · {n(v.totalAprobadas)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Dato({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-muted">{label}</div>
      <div className="demo-num mt-0.5 truncate text-[14px] text-ink">{valor}</div>
      <div className="truncate text-[11px] text-muted">{sub}</div>
    </div>
  )
}

// El MISMO color que la barra (`charts.tsx`: INFO y VERDE), como la leyenda del
// mapa: con el token de Tailwind, el verde de la leyenda y el de la barra
// podían no ser el mismo.
function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}
