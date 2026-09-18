'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarSearch, CheckCircle2, Info, ServerCrash, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/demo/ui/Card'
import { EmptyState } from '@/components/demo/EmptyState'
import { FormularioRecibo } from '@/components/demo/energia/FormularioRecibo'
import { RejillaCaptura } from '@/components/demo/energia/RejillaCaptura'
import {
  RANGO_DE_APERTURA,
  RUTA_CONSUMOS,
  construirConsulta,
  motivoInvalido,
  resumenDeCobertura,
  rutaDeBorrado,
  type RangoCaptura,
  type ReciboEnFormulario,
  type TableroUI,
} from '@/components/demo/energia/captura'

// ============================================================================
//  /energia — Captura mensual del recibo de luz, por predio.
// ----------------------------------------------------------------------------
//  Quién teclea esto y cada cuánto lo decidió el dueño el 2026-09-18: «El
//  medidor suele ser del predio, no de la pantalla, así que se captura una vez
//  por predio y por mes y se reparte entre sus pantallas igual que la renta. Es
//  lo más realista y reusa el reparto que ya existe y está probado». Y quién:
//  «la hace operaciones» — de ahí el permiso `operaciones` del endpoint, y no
//  `finanzas`.
//
//  LA PANTALLA TIENE DOS TRABAJOS, Y EL SEGUNDO ES EL QUE IMPORTA:
//
//   1. Que capturar sea RÁPIDO. Quien la usa tiene un recibo en la mano y no
//      tiene tiempo: una línea de campos, en el orden del papel, y Enter.
//
//   2. QUE SE VEA LO QUE FALTA. Sin esto el módulo entero es peor que no
//      existir: un predio sin recibo de un mes sale en el reporte de
//      rentabilidad con un costo de luz de CERO, que es indistinguible de un
//      predio que no gasta luz. El reporte sumaría solo lo capturado y lo
//      presentaría como el total de la energía —mintiendo sin dar error—, y
//      nadie tendría dónde enterarse. Por eso lo primero que se ve es la
//      rejilla de punto de medición × mes con sus huecos, y no una lista de lo
//      que hay.
//
//  Toda la lógica que puede equivocarse vive en
//  `components/demo/energia/captura.ts`: `vitest.config.ts` no monta jsdom a
//  propósito, así que lo que se escribe dentro de un `.tsx` no lo prueba nadie.
// ============================================================================

export default function EnergiaPage() {
  const [rango, setRango] = useState<RangoCaptura>(() => RANGO_DE_APERTURA(new Date()))
  const [cargando, setCargando] = useState(false)
  const [tablero, setTablero] = useState<TableroUI | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cambia a mano para forzar una recarga tras guardar o borrar, sin duplicar
  // la lógica del efecto en dos sitios.
  const [version, setVersion] = useState(0)

  const motivo = motivoInvalido(rango)

  useEffect(() => {
    if (motivo) return
    // `AbortController`: dos cambios de rango seguidos dejan dos peticiones en
    // vuelo y la que conteste ÚLTIMA gana el `setState` aunque sea la vieja —
    // una rejilla que no corresponde al rango que se ve, y sin error.
    const control = new AbortController()
    setCargando(true)
    void (async () => {
      try {
        const r = await fetch(construirConsulta(rango), { cache: 'no-store', signal: control.signal })
        // Cuerpo con `catch` propio: un 500 detrás de nginx devuelve HTML y
        // `r.json()` revienta. Sin esto, un error del servidor saldría por el
        // `catch` de red con un mensaje falso.
        const cuerpo = (await r.json().catch(() => null)) as (TableroUI & { error?: string }) | null
        if (control.signal.aborted) return
        if (!r.ok) {
          setTablero(null)
          setError(cuerpo?.error ?? 'No se pudo cargar la captura de consumos')
          return
        }
        setTablero(cuerpo)
        setError(null)
      } catch {
        if (control.signal.aborted) return
        setTablero(null)
        setError('No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.')
      } finally {
        // En el `finally`: es lo que impide el spinner infinito pase lo que pase.
        if (!control.signal.aborted) setCargando(false)
      }
    })()
    return () => control.abort()
  }, [rango, motivo, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  const guardar = useCallback(
    async (recibo: ReciboEnFormulario) => {
      const [tipo, id] = recibo.punto.split(':')
      const r = await fetch(RUTA_CONSUMOS, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // El anclaje se deshace aquí, del `P:`/`S:` de la clave a las dos
          // columnas excluyentes de la tabla. La clave existe porque es la
          // MISMA que usa el motor del reporte para contar los huecos.
          predioId: tipo === 'P' ? id : null,
          sitioId: tipo === 'S' ? id : null,
          periodo: recibo.periodo,
          medidor: recibo.medidor?.trim() || null,
          kwh: recibo.kwh,
          importe: recibo.importe,
        }),
      })
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null
        // El 409 del índice único llega con su mensaje: capturar dos veces el
        // mismo recibo duplicaría el costo de la luz de ese mes sin dar error.
        throw new Error(cuerpo?.error ?? 'No se pudo guardar el recibo')
      }
      recargar()
    },
    [recargar],
  )

  const borrar = useCallback(
    async (id: string) => {
      const r = await fetch(rutaDeBorrado(id), { method: 'DELETE' })
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null
        setError(cuerpo?.error ?? 'No se pudo borrar el recibo')
        return
      }
      recargar()
    },
    [recargar],
  )

  const resumen = useMemo(() => (tablero ? resumenDeCobertura(tablero) : null), [tablero])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#f59e0b1a] text-warning">
          <Zap className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl text-ink">Consumo de luz</h1>
          <p className="text-[13px] text-muted">
            Un recibo por predio y por mes. Se reparte entre sus pantallas igual que la renta.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 grid grid-cols-2 gap-2 lg:w-1/3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted" htmlFor="desde">
                Desde
              </label>
              <input
                id="desde"
                type="date"
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-ink"
                value={rango.desde}
                onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted" htmlFor="hasta">
                Hasta
              </label>
              <input
                id="hasta"
                type="date"
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-ink"
                value={rango.hasta}
                onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
              />
            </div>
          </div>
          {motivo ? <p className="text-[12px] text-error">{motivo}</p> : null}

          {tablero && tablero.puntos.length > 0 ? (
            <FormularioRecibo
              puntos={tablero.puntos}
              mesInicial={(tablero.meses[tablero.meses.length - 1] ?? '').slice(0, 7)}
              onGuardar={guardar}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Qué está capturado y qué falta</CardTitle>
          {tablero ? (
            <span className="text-[11px] uppercase tracking-wide text-muted">
              {tablero.meses.length} {tablero.meses.length === 1 ? 'mes' : 'meses'}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* El resumen va ARRIBA de la rejilla, no debajo: dice si las cifras
              que se están mirando son el total o solo una parte, y eso llega
              tarde puesto después de la tabla. */}
          {resumen ? (
            <ul className="space-y-1.5 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
              <li
                className={cn(
                  'flex items-start gap-1.5',
                  resumen.tono === 'alerta' && 'font-medium text-warning',
                  resumen.tono === 'ok' && 'text-success',
                )}
              >
                {resumen.tono === 'alerta' ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : resumen.tono === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{resumen.texto}</span>
              </li>
              {/* Los huérfanos van en su propia línea y solo cuando los hay:
                  están capturados y su dinero NO llega a ninguna fila del
                  reporte, así que desaparecerían sin que nada lo dijera. */}
              {resumen.huerfanos ? (
                <li className="flex items-start gap-1.5 font-medium text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{resumen.huerfanos}</span>
                </li>
              ) : null}
            </ul>
          ) : null}

          {cargando ? (
            <div className="h-48 w-full animate-pulse rounded-md bg-surface-2" />
          ) : error ? (
            <EmptyState icon={ServerCrash} titulo="No se pudo cargar la captura" detalle={error} />
          ) : motivo ? (
            <EmptyState icon={CalendarSearch} titulo="Revisa el periodo" detalle={motivo} />
          ) : tablero && tablero.puntos.length === 0 ? (
            /* Vacío HONESTO: se dice POR QUÉ está vacío y qué hacer, en vez de
               un «no hay datos» que deja sin saber si el problema es el rango o
               el inventario. */
            <EmptyState
              icon={Zap}
              titulo="Todavía no hay dónde capturar"
              detalle="Un recibo de luz cuelga de un predio con pantallas, o de una pantalla sin predio. Da de alta el inventario y esta pantalla se llena sola."
            />
          ) : tablero ? (
            <RejillaCaptura tablero={tablero} onBorrar={borrar} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
