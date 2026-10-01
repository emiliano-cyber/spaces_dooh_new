'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { AvisoFranjaCMS } from './AvisoFranjaCMS'
import {
  catalogoRejillaApi,
  guardarFranjaApi,
  bajaFranjaApi,
  guardarTemporadaApi,
  bajaTemporadaApi,
  type FranjaUI,
  type TemporadaUI,
} from '@/lib/data/rejilla-api'
import { motivoFranjaInvalida, motivoTemporadaInvalida } from '@/lib/rejilla'
import { Button } from '@/components/demo/ui/Button'

// ============================================================================
//  El catálogo de FRANJAS y TEMPORADAS de la organización. ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  LA VALIDACIÓN SE HACE AQUÍ **Y** EN EL SERVIDOR, y no es duplicación: la de
//  aquí sirve para que el usuario vea el choque ANTES de mandar, y la del
//  servidor es la que manda. Las dos llaman a la MISMA función de
//  `lib/rejilla.ts` —`motivoFranjaInvalida`— así que no pueden divergir. Si la
//  regla se escribiera dos veces, un día dirían cosas distintas y ganaría la que
//  el usuario no ve.
//
//  LAS BAJAS SON LÓGICAS. El botón dice «Dar de baja» y no «Eliminar» porque es
//  lo que hace: una franja vendida no se puede borrar
//  (`propuesta_items_franja_fkey` es `on delete restrict`) y lo contratado sigue
//  en pie. Llamarlo «Eliminar» prometería algo que no pasa.
// ============================================================================

const vacioFranja = { nombre: '', horaInicio: '', horaFin: '', orden: 0 }
const vacioTemporada = { nombre: '', desde: '', hasta: '' }

export function GestionRejilla() {
  const [franjas, setFranjas] = useState<FranjaUI[]>([])
  const [temporadas, setTemporadas] = useState<TemporadaUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevaF, setNuevaF] = useState({ ...vacioFranja })
  const [nuevaT, setNuevaT] = useState({ ...vacioTemporada })

  const cargar = useCallback(async () => {
    try {
      const d = await catalogoRejillaApi(true)
      setFranjas(d.franjas)
      setTemporadas(d.temporadas)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el catálogo')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function anadirFranja() {
    // MISMA función que el servidor. Se compara contra TODAS —también las dadas
    // de baja—: si solo mirara las activas, se podría capturar una franja que se
    // solapa con una apagada y el choque saldría el día que alguien la
    // reactivara, sin saber desde cuándo.
    const motivo = motivoFranjaInvalida({ id: '', ...nuevaF }, franjas)
    if (motivo) return setError(motivo)
    try {
      await guardarFranjaApi(nuevaF)
      setNuevaF({ ...vacioFranja })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function anadirTemporada() {
    const motivo = motivoTemporadaInvalida({ id: '', ...nuevaT }, temporadas)
    if (motivo) return setError(motivo)
    try {
      await guardarTemporadaApi(nuevaT)
      setNuevaT({ ...vacioTemporada })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function darDeBaja(tipo: 'franja' | 'temporada', id: string) {
    try {
      if (tipo === 'franja') await bajaFranjaApi(id)
      else await bajaTemporadaApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja')
    }
  }

  if (cargando) return <p className="text-sm text-neutral-500">Cargando el catálogo…</p>

  return (
    <div className="space-y-6">
      {/* Va ARRIBA del todo, antes de que nadie capture nada: el dueño tiene que
          saber qué NO hace el sistema antes de montar su tabla de precios. */}
      <AvisoFranjaCMS />

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold">Franjas horarias</h2>
        <p className="mb-3 text-xs text-neutral-500">
          El fin es <b>exclusivo</b>: 06:00–10:00 y 10:00–14:00 se tocan y no se pisan. Dos franjas
          no pueden solaparse — si pudieran, el precio de un spot a las 09:30 dependería de un
          desempate que nadie decidió.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1">Nombre</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Orden</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {franjas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-neutral-500">
                  Todavía no hay ninguna. Sin franjas, todo se vende con la tarifa base — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {franjas.map((f) => (
              <tr key={f.id} className={'border-b ' + (f.activo ? '' : 'text-neutral-400 line-through')}>
                <td className="py-1.5">{f.nombre}</td>
                <td>{f.horaInicio}</td>
                <td>{f.horaFin}</td>
                <td>{f.orden}</td>
                <td className="text-right">
                  {f.activo && (
                    <Button
                      type="button"
                      onClick={() => void darDeBaja('franja', f.id)}
                      size="sm"
                      variant="ghost"
                      className="text-error hover:text-error"
                      title="Dar de baja: deja de ofrecerse, y lo ya contratado sigue en pie"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2">
                <input
                  aria-label="Nombre de la franja"
                  className="w-full rounded border px-2 py-1"
                  placeholder="Prime"
                  value={nuevaF.nombre}
                  onChange={(e) => setNuevaF({ ...nuevaF, nombre: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Hora de inicio"
                  type="time"
                  className="rounded border px-2 py-1"
                  value={nuevaF.horaInicio}
                  onChange={(e) => setNuevaF({ ...nuevaF, horaInicio: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Hora de fin"
                  type="time"
                  className="rounded border px-2 py-1"
                  value={nuevaF.horaFin}
                  onChange={(e) => setNuevaF({ ...nuevaF, horaFin: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Orden"
                  type="number"
                  className="w-16 rounded border px-2 py-1"
                  value={nuevaF.orden}
                  onChange={(e) => setNuevaF({ ...nuevaF, orden: Number(e.target.value) })}
                />
              </td>
              <td className="text-right">
                <Button
                  type="button"
                  onClick={() => void anadirFranja()}
                  size="sm"
                  variant="success"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Temporadas</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Fechas <b>concretas</b>, con año: «Buen Fin 2026» y «Buen Fin 2027» son dos temporadas,
          porque las fechas cambian cada año. Ambos extremos entran. Tampoco pueden solaparse: si
          «Diciembre» y «Buen Fin» se pisan, hay que decidir qué precio manda esos días.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1">Nombre</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {temporadas.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-neutral-500">
                  Todavía no hay ninguna.
                </td>
              </tr>
            )}
            {temporadas.map((t) => (
              <tr key={t.id} className={'border-b ' + (t.activo ? '' : 'text-neutral-400 line-through')}>
                <td className="py-1.5">{t.nombre}</td>
                <td>{t.desde}</td>
                <td>{t.hasta}</td>
                <td className="text-right">
                  {t.activo && (
                    <Button
                      type="button"
                      onClick={() => void darDeBaja('temporada', t.id)}
                      size="sm"
                      variant="ghost"
                      className="text-error hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2">
                <input
                  aria-label="Nombre de la temporada"
                  className="w-full rounded border px-2 py-1"
                  placeholder="Buen Fin 2026"
                  value={nuevaT.nombre}
                  onChange={(e) => setNuevaT({ ...nuevaT, nombre: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Fecha de inicio"
                  type="date"
                  className="rounded border px-2 py-1"
                  value={nuevaT.desde}
                  onChange={(e) => setNuevaT({ ...nuevaT, desde: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Fecha de fin"
                  type="date"
                  className="rounded border px-2 py-1"
                  value={nuevaT.hasta}
                  onChange={(e) => setNuevaT({ ...nuevaT, hasta: e.target.value })}
                />
              </td>
              <td className="text-right">
                <Button
                  type="button"
                  onClick={() => void anadirTemporada()}
                  size="sm"
                  variant="success"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
