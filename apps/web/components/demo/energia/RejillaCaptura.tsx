'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMonto } from '@/lib/data/derive'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import type { ConsumoEnergia } from '@/lib/server/energia-repo'
import {
  etiquetaDeMes,
  filasDelTablero,
  textoDeConfirmacionDeBorrado,
  type TableroUI,
} from './captura'

// ============================================================================
//  La rejilla: un punto de medición por fila, un mes por columna.
// ----------------------------------------------------------------------------
//  LO QUE HACE QUE ESTA PANTALLA VALGA LA PENA: el HUECO se ve.
//
//  Una lista de lo capturado dejaría invisible el mes que nadie tecleó, y ese
//  mes no da error en ninguna parte — sale como un costo de luz de CERO en el
//  reporte de rentabilidad, indistinguible de una pantalla que no gasta luz.
//
//  Por eso la celda vacía NO se pinta como «$0.00» ni se deja en blanco: se
//  pinta con una raya y el fondo de aviso. Un cero AFIRMA que ese mes no se
//  gastó luz; una celda en blanco no dice nada. Lo que hay que decir es que
//  FALTA.
//
//  Toda la lógica —qué es un hueco, cómo se suman dos medidores, cómo se cuenta
//  por fila— está en `captura.ts` con sus pruebas. Aquí solo se pinta.
// ============================================================================

export function RejillaCaptura({
  tablero,
  onBorrar,
}: {
  tablero: TableroUI
  onBorrar: (id: string) => Promise<void>
}) {
  const filas = filasDelTablero(tablero)
  // B32: el borrado pedia confirmacion en el manual y no la pedia en la
  // pantalla. Un clic de mas en un icono sin texto borraba el recibo, y como el
  // sistema rechaza capturar dos veces el mismo, recuperarlo exige volver a
  // teclearlo. Se usa el dialogo de la aplicacion y no `window.confirm`: el
  // texto tiene que caber y decir QUE se va, no solo preguntar.
  const [porBorrar, setPorBorrar] = useState<ConsumoEnergia | null>(null)
  const [borrando, setBorrando] = useState(false)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
            <th className="px-2 py-2 text-left font-normal">Predio o pantalla</th>
            {tablero.meses.map((m) => (
              <th key={m} className="px-2 py-2 text-right font-normal">
                {etiquetaDeMes(m.slice(0, 7))}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-normal">Faltan</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.punto.clave} className="border-b border-border/60">
              <td className="px-2 py-2 align-top">
                <div className="text-ink">{f.punto.nombre}</div>
                <div className="text-[11px] text-muted">
                  {f.punto.tipo === 'predio'
                    ? `${f.punto.pantallas} ${f.punto.pantallas === 1 ? 'pantalla' : 'pantallas'}`
                    : 'Pantalla suelta'}
                </div>
              </td>

              {f.celdas.map((c) => (
                <td
                  key={c.mes}
                  className={cn(
                    'px-2 py-2 text-right align-top tabular-nums',
                    // El hueco se ve. No es decoración: es el único sitio de
                    // todo el producto donde este dato que falta se hace
                    // visible antes de convertirse en un margen falso.
                    c.hueco && 'bg-warning/10 text-warning',
                  )}
                >
                  {c.hueco ? (
                    <span title="Sin recibo capturado: no es un consumo de cero, es un dato que falta">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-ink">{formatMonto(c.importe ?? 0)}</div>
                      <div className="text-[11px] text-muted">
                        {(c.kwh ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })} kWh
                      </div>
                      {/* Cuando hay más de un recibo se dice, con su medidor:
                          un predio con dos medidores tiene dos recibos de
                          verdad, y esconderlo detrás de la suma haría imposible
                          saber cuál se capturó mal. */}
                      {c.recibos.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setPorBorrar(r)}
                          className="flex w-full items-center justify-end gap-1 text-[11px] text-muted hover:text-error"
                          title="Borrar este recibo"
                        >
                          <Trash2 className="h-3 w-3" />
                          {r.medidor ?? 'sin número'}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              ))}

              <td
                className={cn(
                  'px-2 py-2 text-right align-top tabular-nums',
                  f.huecos > 0 ? 'text-warning' : 'text-muted',
                )}
              >
                {f.huecos}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={porBorrar !== null}
        onOpenChange={(v) => !v && setPorBorrar(null)}
        title="Borrar este recibo"
        confirmLabel="Borrar el recibo"
        busy={borrando}
        onConfirm={() => {
          if (!porBorrar) return
          setBorrando(true)
          // El dialogo se cierra pase lo que pase: si el borrado falla, quien
          // lo dice es el aviso de la pantalla, junto a la rejilla y sin
          // taparla (B33). Dejarlo abierto sobre un error invita a reintentar
          // lo que el permiso no va a permitir.
          void onBorrar(porBorrar.id).finally(() => {
            setBorrando(false)
            setPorBorrar(null)
          })
        }}
      >
        {porBorrar ? textoDeConfirmacionDeBorrado(porBorrar) : null}
      </ConfirmDialog>
    </div>
  )
}
