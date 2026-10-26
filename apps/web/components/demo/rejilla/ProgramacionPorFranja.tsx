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
import { Button } from '@/components/demo/ui/Button'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'

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
  // Lo decide el servidor (`comercial.aprobar`, decisión del dueño del 30/09).
  // Sin él se VE la programación, pero no se ofrecen los controles: ofrecerle
  // al vendedor un botón que el servidor le niega sería el «encierro».
  const [puede, setPuede] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const d = await programacionApi()
      setFranjas(d.franjas)
      setCampanas(d.campanas)
      setPuede(d.puedeProgramar === true)
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

  // Esqueleto y no un «Cargando…» en texto (rediseño del 2026-10-26).
  if (cargando) {
    return <div className="h-32 animate-pulse rounded-md bg-surface-2" aria-busy="true" aria-label="Cargando la programación" />
  }

  const activas = franjas.filter((f) => f.activo)

  return (
    // PLEG-02 · la tarjeta plegable va DENTRO del componente y no alrededor de
    // él en la página: así plegarla no desmonta este estado (las campañas
    // marcadas, la lectura ya hecha) y desplegarla no vuelve a pedirlo todo.
    //
    // Rediseño del 2026-10-26 · subtítulo de una frase y la explicación como
    // primera línea del contenido: con tres renglones de subtítulo el chevrón
    // de plegar se caía debajo del texto.
    <CardColapsable
      id="franjas-y-temporadas.programacion"
      titulo="Horario de transmisión"
      icono={<CalendarClock className="h-4 w-4" />}
      subtitulo="No cambia ningún precio"
      contentClassName="space-y-3"
    >
      <p className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
        En qué franja <b>se transmite</b> cada campaña. No cambia ningún precio: lo vendido ya
        está en la campaña desde la propuesta. Puedes marcar varias campañas y programarlas de
        una vez; si alguna no se puede, no se programa ninguna.
      </p>

      {/* COMPACTO aquí: el completo ya sale arriba, en la gestión de franjas
          de la misma página, y dos avisos grandes iguales seguidos se leían
          como ruido (rediseño 2026-10-26). Sigue pintado, con el mismo texto:
          `rejilla-aviso.test.ts` exige que esta superficie lo lleve. */}
      <AvisoFranjaCMS compacto />

      {!puede && (
        <p className="text-[12px] text-muted">
          Solo el gerente de ventas, el director comercial y la dirección pueden programar el
          horario. Aquí ves cómo está.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-soft px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}

      {activas.length === 0 ? (
        // Sin franjas activas no se pinta la lista: vacía dejaba una raya
        // suelta (el borde de un `ul` sin filas).
        <p className="text-[13px] text-muted">
          Da de alta al menos una franja arriba para poder programar campañas en ella.
        </p>
      ) : (
      <ul className="divide-y divide-border rounded-md border border-border">
        {activas.map((f) => {
          const suyas = campanas.filter((c) => c.franjaProgramadaId === f.id)
          const ofrecibles = campanas.filter(
            (c) => c.franjaProgramadaId !== f.id && !NO_PROGRAMABLES.has(c.estadoComercial),
          )
          const sel = marcadas[f.id] ?? []
          return (
            <li key={f.id} className="space-y-2 px-4 py-3">
              {/* Como las listas del Dashboard: el dato a la izquierda y la
                  pastilla con el conteo a la derecha. */}
              <div className="flex items-center justify-between gap-3">
                <div className="demo-num text-[13px] font-medium text-ink">{etiquetaFranja(f)}</div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                  {suyas.length} campaña{suyas.length === 1 ? '' : 's'}
                </span>
              </div>

              {suyas.length === 0 ? (
                <p className="text-[12px] text-muted">Ninguna campaña se transmite en esta franja.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {suyas.map((c) => (
                    <li
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-ink"
                    >
                      {nombreCampana(c)}
                      {puede && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void operar(null, [c.id])}
                          aria-label={`Quitar ${nombreCampana(c)} de ${f.nombre}`}
                          title="Quitar de esta franja (no toca lo vendido)"
                          className="text-muted hover:text-error disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {suyas.flatMap((c) =>
                c.avisos.map((a) => (
                  <p
                    key={`${c.id}-${a.franjaContratadaId}`}
                    role="note"
                    className="rounded-md border border-[#f59e0b40] bg-warning-soft px-2 py-1 text-[11px] text-[#9a6700]"
                  >
                    {nombreCampana(c)}: {a.texto}
                  </p>
                )),
              )}

              {puede && ofrecibles.length > 0 && (
                <details className="text-[12px]">
                  <summary className="cursor-pointer select-none font-medium text-info">
                    Programar campañas en {f.nombre}
                    {sel.length ? ` (${sel.length} marcada${sel.length === 1 ? '' : 's'})` : ''}
                  </summary>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-surface p-2">
                    {ofrecibles.map((c) => {
                      const hoy = c.franjaProgramadaId ? porId.get(c.franjaProgramadaId) : null
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-ink">
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
                          {hoy && <span className="text-muted">(hoy en {hoy.nombre})</span>}
                        </label>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    disabled={ocupado || sel.length === 0}
                    onClick={() => void operar(f.id, sel, () => setMarcadas({ ...marcadas, [f.id]: [] }))}
                    size="sm"
                    className="mt-2"
                  >
                    Programar {sel.length || ''} en {f.nombre}
                  </Button>
                </details>
              )}
            </li>
          )
        })}
      </ul>
      )}
    </CardColapsable>
  )
}
