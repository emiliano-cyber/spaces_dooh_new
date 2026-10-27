'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
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
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { useObligatorios } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { formatNumero } from '@/lib/formato-numero'

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
  // OBLIG-01 · los tres que exige el servidor (`volumen-controller.ts:36-44`).
  // La fila de alta va DENTRO de la tabla y sin etiqueta propia —la etiqueta es
  // la cabecera—, así que no lleva `Campo`: el asterisco va en la cabecera y el
  // rojo lo pone `globals.css` por el `data-falta` de la celda.
  const ob = useObligatorios(nuevo, ['unidad', 'desdeCantidad', 'descuentoPct'])

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
    const completos = ob.validar()
    const candidato = {
      unidad: nuevo.unidad,
      // Se manda lo TECLEADO y no un `Number(...) || 0`: ese respaldo
      // convertiría «abc» en un tramo desde 0, que la validación rechazaría con
      // el mensaje equivocado. Quien valida es `motivoTramoInvalido`.
      desdeCantidad: nuevo.desdeCantidad as unknown as number,
      descuentoPct: nuevo.descuentoPct as unknown as number,
    }
    const motivo = motivoTramoInvalido({ id: '', ...candidato }, tramos)
    if (!completos || motivo) return setError(motivo)
    try {
      await guardarTramoVolumenApi({
        unidad: candidato.unidad,
        desdeCantidad: Number(nuevo.desdeCantidad),
        descuentoPct: Number(nuevo.descuentoPct),
      })
      setNuevo({ ...vacio, unidad: nuevo.unidad })
      ob.reiniciar()
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

  // Esqueleto y no un «Cargando…» en texto (rediseño del 2026-10-26).
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando la escala">
        <div className="h-16 animate-pulse rounded-md bg-surface-2" />
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }

  // Rediseño del 2026-10-26 · la escala se lee POR UNIDAD, como se lee un
  // tarifario: cada unidad es su propia escalera. Es solo cómo se pintan las
  // MISMAS filas —agrupadas en el orden de `UNIDADES` y, dentro, de menor a
  // mayor umbral—; no cambia la petición ni la validación. Una unidad que no
  // esté en `UNIDADES` (no debería) sale al final con su clave, para no
  // esconder un tramo.
  const grupos = [
    ...UNIDADES.map((u) => ({ unidad: u.unidad as string, label: u.label })),
    ...[...new Set(tramos.map((t) => t.unidad))]
      .filter((x) => !UNIDADES.some((u) => u.unidad === x))
      .map((x) => ({ unidad: x, label: x })),
  ]
    .map((g) => ({
      ...g,
      tramos: tramos
        .filter((t) => t.unidad === g.unidad)
        .sort((a, b) => Number(a.desdeCantidad) - Number(b.desdeCantidad)),
    }))
    .filter((g) => g.tramos.length > 0)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-soft px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}

      {/* El aviso con la franja ámbar del proyecto (tokens del Dashboard y de
          `StatusBadge`), el MISMO texto y las mismas negritas. Sigue fuera de
          la tarjeta plegable. */}
      <div className="rounded-md border border-[#f59e0b40] bg-warning-soft px-3 py-2 text-[12px] text-[#9a6700]">
        <b>El descuento se aplica sobre TODAS las unidades, no solo sobre las que pasan del
        umbral.</b>{' '}
        «A partir de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 %
        menos. Consecuencia: quien compra 49 paga más que quien compra 50, y el salto puede ser
        mayor que el precio de una unidad.
        <br />
        Y se <b>compone</b> con el descuento comercial: un 20 % aquí y un 20 % en la propuesta
        dejan al cliente pagando el <b>64 %</b>, no el 60 %.
      </div>

      {/* PLEG-02 · la escala se pliega; el aviso de arriba no, porque es lo
          que hay que leer antes de capturar un tramo. Lo tecleado en la fila de
          alta vive en el estado de este componente: plegar no lo borra. */}
      <CardColapsable
        id="descuentos-por-volumen.tramos"
        titulo="Tramos por unidad de venta"
        subtitulo="Cada unidad tiene su propia escala"
        // El modelo con su nombre corto, como lo llama Stripe en su selector
        // de precios («volume» frente a «graduated»): el aviso de arriba
        // explica qué quiere decir.
        resumen={
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted" title="El descuento del tramo alcanzado se aplica a TODAS las unidades">
            Escala plana (volumen)
          </span>
        }
        contentClassName="space-y-3"
      >
        <p className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
          Cada unidad tiene su propia escala, porque 50 spots y 50 meses no son la misma compra.
          Los tramos tienen que <b>crecer</b>: comprar más nunca puede descontar menos.
        </p>
        <div className="relative overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Unidad<Asterisco /></th>
              <th className="px-3 py-2 text-right font-medium">A partir de<Asterisco /></th>
              <th className="px-3 py-2 text-right font-medium">Descuento<Asterisco /></th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tramos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-muted">
                  Todavía no hay ninguno. Sin tramos, todo se vende al precio de tarifa — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {grupos.map((g) => (
              <Fragment key={g.unidad}>
                <tr>
                  <td colSpan={4} className="px-3 pb-1 pt-3 text-[12px] font-medium text-ink">
                    {g.label}
                    <span className="font-normal text-muted"> · {g.tramos.length} tramo{g.tramos.length === 1 ? '' : 's'}</span>
                  </td>
                </tr>
                {g.tramos.map((t, i) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 pl-6 text-[12px] text-muted">Escalón {i + 1}</td>
                    <td className="demo-num whitespace-nowrap px-3 py-2 text-right text-ink">
                      desde {formatNumero(t.desdeCantidad)} {unidadCorta(t.unidad, t.desdeCantidad)}
                    </td>
                    <td className="demo-num whitespace-nowrap px-3 py-2 text-right font-medium text-ink">→ {t.descuentoPct} %</td>
                    <td className="px-3 py-2 text-right">
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
              </Fragment>
            ))}
            {/* La fila de ALTA, con fondo propio para que no se lea como un
                tramo más; los ejemplos dicen «p. ej.» y van en gris para que
                no parezcan un valor ya capturado. */}
            <tr className="bg-surface-2">
              <td className="px-3 py-2.5" data-falta={ob.falta('unidad') || undefined}>
                <select
                  aria-label="Unidad de venta"
                  className={CAMPO}
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
              <td className="px-3 py-2.5 text-right" data-falta={ob.falta('desdeCantidad') || undefined}>
                {/* Entera, con coma de miles. Lo que no se entiende llega como
                    'NaN' y `motivoTramoInvalido` lo rechaza como siempre. */}
                <CampoCifra
                  aria-label="A partir de qué cantidad"
                  decimales={0}
                  mostrarError={false}
                  className={`${CAMPO} demo-num w-28 text-right`}
                  placeholder="p. ej. 50"
                  valor={nuevo.desdeCantidad}
                  onCambio={(crudo) => setNuevo({ ...nuevo, desdeCantidad: crudo })}
                />
              </td>
              <td className="px-3 py-2.5 text-right" data-falta={ob.falta('descuentoPct') || undefined}>
                <input
                  aria-label="Descuento por ciento"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className={`${CAMPO} demo-num w-28 text-right`}
                  placeholder="p. ej. 10"
                  value={nuevo.descuentoPct}
                  onChange={(e) => setNuevo({ ...nuevo, descuentoPct: e.target.value })}
                />
              </td>
              <td className="px-3 py-2.5 text-right">
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
        </div>
      </CardColapsable>
    </div>
  )
}

// Campos del alto y el borde del resto de los formularios (rediseño del
// 2026-10-26); el `placeholder` en gris para que no se lea como un valor.
const CAMPO =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'

/** OBLIG-01 · el asterisco de una cabecera de columna obligatoria. */
function Asterisco() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-error">*</span>
      <span className="sr-only"> (obligatorio)</span>
    </>
  )
}
