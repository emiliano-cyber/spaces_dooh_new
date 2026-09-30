'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, CalendarClock } from 'lucide-react'
import { AvisoFranjaCMS } from './AvisoFranjaCMS'
import {
  programacionApi,
  programarFranjaApi,
  type CampanaProgramacionUI,
  type FranjaProgramacionUI,
} from '@/lib/data/programacion-api'
import { etiquetaFranja } from '@/lib/franja-programada'

// ============================================================================
//  «Horario de transmisión»: junto a cada franja, qué campañas salen en ella.
//  PROG-01 · decisión del dueño del 2026-09-30.
// ----------------------------------------------------------------------------
//  ESTO NO CAMBIA NINGÚN PRECIO. «El precio ya debe de estar en la campaña
//  después de la propuesta»: lo vendido está en las reservas y congelado en el
//  snapshot. Aquí solo se dice en qué horario se TRANSMITE.
//
//  CADA BOTÓN ES UNA OPERACIÓN ATÓMICA, y por eso hay dos gestos y no un
//  «guardar» que calcule altas y bajas. Un guardado con altas y bajas son dos
//  peticiones: si la segunda falla, la primera ya quedó, y la pantalla no puede
//  decir con honestidad qué pasó. Así, «Programar en Prime» con diez campañas
//  marcadas es UNA petición —todo o nada— y la × de una campaña es otra.
//
//  El aviso «se vendió como X y se programa en Y» NO se calcula aquí: llega ya
//  calculado del servidor (`avisosDeProgramacion`), para que esta pantalla y el
//  detalle de la campaña no puedan decir cosas distintas.
// ============================================================================

// Una campaña cancelada o terminada no se va a transmitir: ofrecerla sería
// ruido. Si ya tenía franja, se sigue viendo en su chip para poder quitarla.
const NO_PROGRAMABLES = new Set(['CANCELADA', 'COMPLETADA'])

const nombreCampana = (c: CampanaProgramacionUI) => (c.folio ? `${c.folio} · ${c.nombre}` : c.nombre)

export function ProgramacionPorFranja() {
  const [franjas, setFranjas] = useState<FranjaProgramacionUI[]>([])
  const [campanas, setCampanas] = useState<CampanaProgramacionUI[]>([])
  const [marcadas, setMarcadas] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      const d = await programacionApi()
      setFranjas(d.franjas)
      setCampanas(d.campanas)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la programación')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const porId = useMemo(() => new Map(franjas.map((f) => [f.id, f])), [franjas])

  async function operar(franjaId: string | null, ids: string[], despues?: () => void) {
    if (!ids.length) return
    setOcupado(true)
    try {
      await programarFranjaApi(franjaId, ids)
      despues?.()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo programar')
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) return <p className="text-sm text-neutral-500">Cargando la programación…</p>

  const activas = franjas.filter((f) => f.activo)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" /> Horario de transmisión
        </h2>
        <p className="text-xs text-neutral-500">
          En qué franja <b>se transmite</b> cada campaña. No cambia ningún precio: lo vendido ya
          está en la campaña desde la propuesta. Puedes marcar varias campañas y programarlas de
          una vez; si alguna no se puede, no se programa ninguna.
        </p>
      </div>

      <AvisoFranjaCMS />

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {activas.length === 0 && (
        <p className="text-sm text-neutral-500">
          Da de alta al menos una franja arriba para poder programar campañas en ella.
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {activas.map((f) => {
          const suyas = campanas.filter((c) => c.franjaProgramadaId === f.id)
          const ofrecibles = campanas.filter(
            (c) => c.franjaProgramadaId !== f.id && !NO_PROGRAMABLES.has(c.estadoComercial),
          )
          const sel = marcadas[f.id] ?? []
          return (
            <li key={f.id} className="space-y-2 p-3">
              <div className="text-sm font-medium">{etiquetaFranja(f)}</div>

              {suyas.length === 0 ? (
                <p className="text-xs text-neutral-500">Ninguna campaña se transmite en esta franja.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {suyas.map((c) => (
                    <li
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                    >
                      {nombreCampana(c)}
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void operar(null, [c.id])}
                        aria-label={`Quitar ${nombreCampana(c)} de ${f.nombre}`}
                        title="Quitar de esta franja (no toca lo vendido)"
                        className="text-neutral-500 hover:text-red-700 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {suyas.flatMap((c) =>
                c.avisos.map((a) => (
                  <p
                    key={`${c.id}-${a.franjaContratadaId}`}
                    role="note"
                    className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900"
                  >
                    {nombreCampana(c)}: {a.texto}
                  </p>
                )),
              )}

              {ofrecibles.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer select-none text-neutral-600">
                    Programar campañas en {f.nombre}
                    {sel.length ? ` (${sel.length} marcada${sel.length === 1 ? '' : 's'})` : ''}
                  </summary>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded border p-2">
                    {ofrecibles.map((c) => {
                      const hoy = c.franjaProgramadaId ? porId.get(c.franjaProgramadaId) : null
                      return (
                        <label key={c.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sel.includes(c.id)}
                            onChange={(e) =>
                              setMarcadas({
                                ...marcadas,
                                [f.id]: e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id),
                              })
                            }
                          />
                          <span>{nombreCampana(c)}</span>
                          {hoy && <span className="text-neutral-400">(hoy en {hoy.nombre})</span>}
                        </label>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={ocupado || sel.length === 0}
                    onClick={() => void operar(f.id, sel, () => setMarcadas({ ...marcadas, [f.id]: [] }))}
                    className="mt-2 rounded border px-2 py-1 font-medium hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Programar {sel.length || ''} en {f.nombre}
                  </button>
                </details>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
