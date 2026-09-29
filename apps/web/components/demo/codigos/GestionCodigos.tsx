'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import {
  codigosApi,
  guardarCodigoApi,
  borrarCodigoApi,
  type CodigoPromocionalUI,
} from '@/lib/data/codigos-api'
import { motivoCodigoInvalido, normalizarCodigo } from '@/lib/codigo-promocional'

// ============================================================================
//  Los CÓDIGOS PROMOCIONALES de la organización. ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  LA VALIDACIÓN SE HACE AQUÍ **Y** EN EL SERVIDOR, y no es duplicación: la de
//  aquí sirve para que el dueño vea el problema ANTES de mandar, y la del
//  servidor es la que manda. Las dos llaman a la MISMA función de
//  `lib/codigo-promocional.ts`, así que no pueden divergir.
//
//  ⚠️ PERO EL CANJE NO SE VALIDA AQUÍ, Y ES LA DIFERENCIA QUE DEFINE LA FASE.
//  Esta pantalla CREA cupones. Aplicarlos a una venta lo decide el servidor, y
//  solo el servidor: la vigencia se comprueba contra el reloj de Postgres y el
//  tope de usos contra un conteo hecho con la fila del cupón bloqueada. Un
//  contador que viviera aquí no sería un contador.
//
//  LO QUE LA PANTALLA TIENE QUE DECIR CON TODAS LAS LETRAS:
//
//   · **El uso se cuenta al APLICAR el código, no al aprobar la propuesta.** Una
//     cotización abandonada con el código puesto retiene un uso hasta que
//     alguien se lo quite o la borre. Si no se dijera, el dueño vería su cupón
//     de 100 usos agotado con 40 ventas y lo leería como un defecto.
//   · **Se compone con las demás capas**, no se suma.
//   · **No cuenta contra el tope de descuento** (COD-02, preguntado al dueño).
//   · **Borrarlo reinicia la cuenta de usos** si se vuelve a crear igual.
// ============================================================================

const hoy = () => new Date().toISOString().slice(0, 10)

const vacio = {
  codigo: '',
  descuentoPct: '',
  vigenteDesde: hoy(),
  vigenteHasta: '',
  usosMaximos: '',
}

export function GestionCodigos() {
  const [codigos, setCodigos] = useState<CodigoPromocionalUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ ...vacio })

  const cargar = useCallback(async () => {
    try {
      setCodigos(await codigosApi())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los códigos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function anadir() {
    // Se manda lo TECLEADO y no un `Number(...) || 0`: ese respaldo convertiría
    // «abc» en un cupón al 0 %, que la validación rechazaría con el mensaje
    // equivocado. Quien valida es `motivoCodigoInvalido`.
    const candidato = {
      id: '',
      codigo: normalizarCodigo(nuevo.codigo),
      descuentoPct: nuevo.descuentoPct as unknown as number,
      vigenteDesde: nuevo.vigenteDesde,
      vigenteHasta: nuevo.vigenteHasta,
      // Vacío = SIN TOPE, que es distinto de 0 y por eso no cae a 0.
      usosMaximos:
        nuevo.usosMaximos.trim() === '' ? null : (nuevo.usosMaximos as unknown as number),
    }
    const motivo = motivoCodigoInvalido(candidato, codigos)
    if (motivo) return setError(motivo)
    try {
      await guardarCodigoApi({
        codigo: candidato.codigo,
        descuentoPct: Number(nuevo.descuentoPct),
        vigenteDesde: nuevo.vigenteDesde,
        vigenteHasta: nuevo.vigenteHasta,
        usosMaximos: candidato.usosMaximos == null ? null : Number(nuevo.usosMaximos),
      })
      setNuevo({ ...vacio })
      setError(null)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function eliminar(id: string) {
    try {
      await borrarCodigoApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  if (cargando) return <p className="text-sm text-neutral-500">Cargando los códigos…</p>

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <b>El uso se cuenta cuando alguien aplica el código a una cotización, no cuando se cierra
        la venta.</b>{' '}
        Es lo que permite decirle al cliente «sí, tu código vale» en el momento en que lo teclea,
        en vez de descubrir al firmar que ya se había acabado. A cambio, una cotización abandonada
        con el código puesto retiene un uso: quitarle el código, o borrarla, lo devuelve.
        <br />
        Y se <b>compone</b> con las demás capas: un 20 % por volumen, un 20 % comercial y un 20 %
        de código dejan al cliente pagando el <b>51,2 %</b>, no el 40 %.
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Códigos de esta empresa</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Las promociones las pone cada empresa: estos códigos no se comparten con nadie más. Los
          dos extremos de la vigencia son <b>inclusivos</b> — «hasta el 30» incluye el 30. Dejar el
          tope de usos vacío significa <b>sin tope</b>; entonces el único freno es la fecha.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1">Código</th>
              <th>Descuento</th>
              <th>Vigencia</th>
              <th>Usos</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {codigos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-neutral-500">
                  Todavía no hay ninguno. Sin códigos, todo se vende como hoy.
                </td>
              </tr>
            )}
            {codigos.map((c) => {
              const agotado = c.usosMaximos != null && c.usos >= c.usosMaximos
              const vencido = c.vigenteHasta < hoy()
              return (
                <tr key={c.id} className="border-b">
                  <td className="py-1.5 font-mono">{c.codigo}</td>
                  <td>{c.descuentoPct} %</td>
                  <td className={vencido ? 'text-neutral-400' : undefined}>
                    {c.vigenteDesde} → {c.vigenteHasta}
                    {vencido && <span className="ml-1 text-xs">(vencido)</span>}
                  </td>
                  <td className={agotado ? 'text-amber-700' : undefined}>
                    {c.usos} de {c.usosMaximos ?? '∞'}
                    {agotado && <span className="ml-1 text-xs">(agotado)</span>}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => void eliminar(c.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                      title="Eliminar: deja de poder aplicarse. Lo ya cotizado y lo ya aprobado no se mueven, pero su cuenta de usos se pierde: si vuelves a crearlo con el mismo código, empieza de cero."
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="py-2">
                <input
                  aria-label="Código"
                  className="w-32 rounded border px-2 py-1 font-mono uppercase"
                  placeholder="VERANO20"
                  value={nuevo.codigo}
                  onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Descuento por ciento"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-20 rounded border px-2 py-1"
                  placeholder="20"
                  value={nuevo.descuentoPct}
                  onChange={(e) => setNuevo({ ...nuevo, descuentoPct: e.target.value })}
                />
              </td>
              <td className="space-x-1">
                <input
                  aria-label="Vigente desde"
                  type="date"
                  className="rounded border px-2 py-1"
                  value={nuevo.vigenteDesde}
                  onChange={(e) => setNuevo({ ...nuevo, vigenteDesde: e.target.value })}
                />
                <input
                  aria-label="Vigente hasta"
                  type="date"
                  className="rounded border px-2 py-1"
                  value={nuevo.vigenteHasta}
                  onChange={(e) => setNuevo({ ...nuevo, vigenteHasta: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="Tope de usos (vacío = sin tope)"
                  type="number"
                  min={1}
                  step={1}
                  className="w-20 rounded border px-2 py-1"
                  placeholder="sin tope"
                  value={nuevo.usosMaximos}
                  onChange={(e) => setNuevo({ ...nuevo, usosMaximos: e.target.value })}
                />
              </td>
              <td className="text-right">
                <button
                  type="button"
                  onClick={() => void anadir()}
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir código
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
