'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import {
  escalasVolumenApi,
  guardarTramoVolumenApi,
  borrarTramoVolumenApi,
  type TramoVolumenUI,
} from '@/lib/data/volumen-api'
import { motivoTramoInvalido } from '@/lib/volumen'
import { UNIDADES, unidadCorta } from '@/lib/periodos'
import { Button } from '@/components/demo/ui/Button'

// ============================================================================
//  La ESCALA DE DESCUENTO POR VOLUMEN de la organización. ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  LA VALIDACIÓN SE HACE AQUÍ **Y** EN EL SERVIDOR, y no es duplicación: la de
//  aquí sirve para que el dueño vea el choque ANTES de mandar, y la del
//  servidor es la que manda. Las dos llaman a la MISMA función de
//  `lib/volumen.ts` —`motivoTramoInvalido`—, así que no pueden divergir.
//
//  LA ESCALA ES PLANA, Y LA PANTALLA LO DICE CON ESAS PALABRAS. «A partir de 50
//  spots, 10 % sobre TODO» no es lo mismo que «del 51 en adelante», y la
//  diferencia son miles de pesos. Si la pantalla no lo dijera, el dueño
//  capturaría una cosa creyendo otra y lo descubriría en la primera cotización
//  — o peor, no lo descubriría.
//
//  Y DICE EL ESCALÓN, que es lo que cuesta esta decisión: quien compra 49 paga
//  más que quien compra 50. Es el comportamiento estándar de un tarifario por
//  volumen, pero es una consecuencia real y esconderla sería mentir por omisión.
//
//  EL BOTÓN DICE «ELIMINAR» Y NO «DAR DE BAJA», al revés que el de franjas, y
//  es la verdad: nada referencia un tramo —cada línea de propuesta copió su
//  porcentaje y su umbral al capturarla—, así que borrarlo no mueve ni una
//  venta hecha ni una propuesta aprobada.
// ============================================================================

const vacio = { unidad: 'spot', desdeCantidad: '', descuentoPct: '' }

export function GestionVolumen() {
  const [tramos, setTramos] = useState<TramoVolumenUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ ...vacio })

  const cargar = useCallback(async () => {
    try {
      setTramos(await escalasVolumenApi())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la escala')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function anadir() {
    const candidato = {
      unidad: nuevo.unidad,
      // Se manda lo TECLEADO y no un `Number(...) || 0`: ese respaldo
      // convertiría «abc» en un tramo desde 0, que la validación rechazaría con
      // el mensaje equivocado. Quien valida es `motivoTramoInvalido`.
      desdeCantidad: nuevo.desdeCantidad as unknown as number,
      descuentoPct: nuevo.descuentoPct as unknown as number,
    }
    const motivo = motivoTramoInvalido({ id: '', ...candidato }, tramos)
    if (motivo) return setError(motivo)
    try {
      await guardarTramoVolumenApi({
        unidad: candidato.unidad,
        desdeCantidad: Number(nuevo.desdeCantidad),
        descuentoPct: Number(nuevo.descuentoPct),
      })
      setNuevo({ ...vacio, unidad: nuevo.unidad })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function eliminar(id: string) {
    try {
      await borrarTramoVolumenApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  if (cargando) return <p className="text-sm text-neutral-500">Cargando la escala…</p>

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <b>El descuento se aplica sobre TODAS las unidades, no solo sobre las que pasan del
        umbral.</b>{' '}
        «A partir de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 %
        menos. Consecuencia: quien compra 49 paga más que quien compra 50, y el salto puede ser
        mayor que el precio de una unidad.
        <br />
        Y se <b>compone</b> con el descuento comercial: un 20 % aquí y un 20 % en la propuesta
        dejan al cliente pagando el <b>64 %</b>, no el 60 %.
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Tramos por unidad de venta</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Cada unidad tiene su propia escala, porque 50 spots y 50 meses no son la misma compra.
          Los tramos tienen que <b>crecer</b>: comprar más nunca puede descontar menos.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1">Unidad</th>
              <th>A partir de</th>
              <th>Descuento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tramos.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-neutral-500">
                  Todavía no hay ninguno. Sin tramos, todo se vende al precio de tarifa — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {tramos.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-1.5">
                  {UNIDADES.find((u) => u.unidad === t.unidad)?.label ?? t.unidad}
                </td>
                <td>
                  {t.desdeCantidad} {unidadCorta(t.unidad, t.desdeCantidad)}
                </td>
                <td>{t.descuentoPct} %</td>
                <td className="text-right">
                  <Button
                    type="button"
                    onClick={() => void eliminar(t.id)}
                    size="sm"
                    variant="ghost"
                    className="text-error hover:text-error"
                    title="Eliminar: deja de aplicarse a partir de ahora. Lo ya cotizado y lo ya aprobado no se mueven."
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2">
                <select
                  aria-label="Unidad de venta"
                  className="rounded border px-2 py-1"
                  value={nuevo.unidad}
                  onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.unidad} value={u.unidad}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  aria-label="A partir de qué cantidad"
                  type="number"
                  min={2}
                  step={1}
                  className="w-24 rounded border px-2 py-1"
                  placeholder="50"
                  value={nuevo.desdeCantidad}
                  onChange={(e) => setNuevo({ ...nuevo, desdeCantidad: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Descuento por ciento"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-24 rounded border px-2 py-1"
                  placeholder="10"
                  value={nuevo.descuentoPct}
                  onChange={(e) => setNuevo({ ...nuevo, descuentoPct: e.target.value })}
                />
              </td>
              <td className="text-right">
                <Button
                  type="button"
                  onClick={() => void anadir()}
                  size="sm"
                  variant="success"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir tramo
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
