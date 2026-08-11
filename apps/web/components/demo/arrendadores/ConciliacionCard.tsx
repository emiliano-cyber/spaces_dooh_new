'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Scale } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import {
  useContratos,
  usePagosRenta,
  usePredios,
  useSitios,
  useArrendadores,
  formatMonto,
  type ContratoArrendamiento,
} from '@/lib/data/client'
import { conciliacionRenta, type ConciliacionArrendador } from '@/lib/data/derive'

// ============================================================================
//  Cuadre de renta: qué se le debe a cada propietario y qué ya se le pagó.
//
//  Antes esto solo se podía saber contrato por contrato. La información estaba,
//  pero había que sumarla a mano y nadie lo hacía, así que en la práctica no se
//  sabía cuánto se le debía a un propietario con varios predios.
//
//  Se abre por propietario y se despliega por emplazamiento —el predio con todas
//  sus caras, o la pantalla suelta—, que es la unidad en la que se negocia.
//
//  Ordenado por deuda vencida: arriba está lo que hay que resolver hoy.
// ============================================================================

function Importe({ monto, n, tono }: { monto: number; n: number; tono?: 'error' | 'warn' }) {
  if (!n) return <span className="text-muted">—</span>
  const color = tono === 'error' ? 'text-error' : tono === 'warn' ? 'text-[#9a6700]' : 'text-ink'
  return (
    <span className={color}>
      <span className="demo-num">{formatMonto(Math.round(monto))}</span>
      <span className="ml-1 text-[11px] text-muted">({n})</span>
    </span>
  )
}

export function ConciliacionCard({
  // Contratos que sobrevivieron al filtro de la página. `undefined` = sin
  // filtro. El cuadre se DERIVA de los contratos y sus pagos, así que acotarlos
  // acota la tarjeta entera sin tocar su lógica.
  contratosVisibles,
}: {
  contratosVisibles?: ContratoArrendamiento[]
} = {}) {
  // Se piden solo las cinco listas que el cuadre necesita, en vez de todo el
  // store: así la tabla no se vuelve a dibujar cada vez que cambia cualquier
  // otra cosa del estado global.
  const todosLosContratos = useContratos()
  const pagosRenta = usePagosRenta()
  const predios = usePredios()
  const sitios = useSitios()
  const arrendadores = useArrendadores()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  // `undefined` mientras el estado no ha hidratado: sin esto la tarjeta se
  // pintaría vacía un instante y parecería que no hay nada que cobrar.
  if (!todosLosContratos || !pagosRenta) return null
  const contratos = contratosVisibles ?? todosLosContratos

  const filas: ConciliacionArrendador[] = conciliacionRenta({
    contratos,
    pagosRenta,
    predios: predios ?? [],
    sitios: sitios ?? [],
    arrendadores: arrendadores ?? [],
  } as any)
  if (!filas.length) return null

  const alternar = (k: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev)
      s.has(k) ? s.delete(k) : s.add(k)
      return s
    })

  const tot = filas.reduce(
    (a, f) => ({
      pagado: a.pagado + f.pagado.monto,
      pendiente: a.pendiente + f.pendiente.monto,
      vencido: a.vencido + f.vencido.monto,
    }),
    { pagado: 0, pendiente: 0, vencido: 0 },
  )

  return (
    <CardColapsable
      titulo="Cuadre de renta por arrendador"
      icono={<Scale className="h-4 w-4 text-muted" />}
      subtitulo="Qué se le debe a cada uno y qué ya se le pagó. Primero quien tiene vencidos."
      contentClassName="px-0 pb-0"
    >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Arrendador / emplazamiento</th>
                <th className="px-4 py-2 text-right font-medium">Vencido</th>
                <th className="px-4 py-2 text-right font-medium">Pendiente</th>
                <th className="px-4 py-2 text-right font-medium">Pagado</th>
                <th className="px-4 py-2 text-center font-medium">Próximo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((f) => {
                const k = f.arrendadorId ?? 'sin'
                const abierto = abiertos.has(k)
                return (
                  <>
                    <tr
                      key={k}
                      className="cursor-pointer hover:bg-surface-2"
                      onClick={() => alternar(k)}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-left font-medium text-ink"
                          aria-expanded={abierto}
                        >
                          {abierto ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted" />
                          )}
                          {f.arrendador}
                        </button>
                        <div className="ml-4.5 text-[11px] text-muted">
                          {f.emplazamientos.length}{' '}
                          {f.emplazamientos.length === 1 ? 'emplazamiento' : 'emplazamientos'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Importe monto={f.vencido.monto} n={f.vencido.n} tono="error" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Importe monto={f.pendiente.monto} n={f.pendiente.n} tono="warn" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Importe monto={f.pagado.monto} n={f.pagado.n} />
                      </td>
                      <td className="px-4 py-2.5 text-center capitalize text-muted">
                        {f.proximoPeriodo ?? '—'}
                      </td>
                    </tr>

                    {abierto &&
                      f.emplazamientos.map((e) => (
                        <tr key={`${k}-${e.id}`} className="bg-surface-2/40">
                          <td className="py-2 pl-10 pr-4">
                            <div className="text-[12.5px] text-ink">{e.nombre}</div>
                            <div className="text-[11px] text-muted">
                              {e.tipo === 'PREDIO' ? 'Predio' : 'Pantalla suelta'} ·{' '}
                              {e.contratos} {e.contratos === 1 ? 'contrato' : 'contratos'}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Importe monto={e.vencido.monto} n={e.vencido.n} tono="error" />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Importe monto={e.pendiente.monto} n={e.pendiente.n} tono="warn" />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Importe monto={e.pagado.monto} n={e.pagado.n} />
                          </td>
                          <td className="px-4 py-2 text-center capitalize text-muted">
                            {e.proximoPeriodo ?? '—'}
                          </td>
                        </tr>
                      ))}
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong bg-surface-2 text-[12.5px] font-medium">
                <td className="px-4 py-2.5 text-ink">Total</td>
                <td className="demo-num px-4 py-2.5 text-right text-error">
                  {formatMonto(Math.round(tot.vencido))}
                </td>
                <td className="demo-num px-4 py-2.5 text-right text-[#9a6700]">
                  {formatMonto(Math.round(tot.pendiente))}
                </td>
                <td className="demo-num px-4 py-2.5 text-right text-ink">
                  {formatMonto(Math.round(tot.pagado))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
    </CardColapsable>
  )
}
