'use client'

import { Printer, AlertTriangle } from 'lucide-react'
import type { Faltante } from '@/lib/contrato-documento'

// Barra de acciones del documento del contrato. Es lo ÚNICO interactivo de la
// página y lleva `doc-no-print`, así que no sale en el papel.
export function BarraDocumento({ faltantes }: { faltantes: Faltante[] }) {
  // Agrupado por SITIO y no como lista suelta: los cuatro datos que faltan hoy
  // se capturan en dos pantallas distintas, y una lista plana obliga a ir
  // buscándolos uno por uno sin saber que tres están juntos.
  const porDonde = faltantes.reduce<Record<string, string[]>>((acc, f) => {
    ;(acc[f.donde] ??= []).push(f.etiqueta)
    return acc
  }, {})
  return (
    <div className="doc-no-print doc-barra">
      <div className="doc-barra-fila">
        <button type="button" onClick={() => window.print()} className="doc-btn">
          <Printer className="h-3.5 w-3.5" /> Imprimir o guardar como PDF
        </button>
        <span className="doc-barra-nota">
          En el diálogo de impresión elige «Guardar como PDF» como destino.
        </span>
      </div>

      {faltantes.length > 0 && (
        <div className="doc-barra-aviso">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <b>Faltan {faltantes.length} dato{faltantes.length === 1 ? '' : 's'} por capturar.</b>{' '}
            El documento los deja marcados en blanco en vez de inventarlos.
            {Object.entries(porDonde).map(([donde, etiquetas]) => (
              <div key={donde} className="doc-barra-grupo">
                <span className="doc-barra-donde">En {donde}:</span>
                <ul className="doc-barra-lista">
                  {etiquetas.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
