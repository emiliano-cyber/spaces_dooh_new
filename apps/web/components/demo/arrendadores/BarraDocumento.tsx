'use client'

import { Printer, AlertTriangle } from 'lucide-react'

// Barra de acciones del documento del contrato. Es lo ÚNICO interactivo de la
// página y lleva `doc-no-print`, así que no sale en el papel.
export function BarraDocumento({ faltantes }: { faltantes: string[] }) {
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
            El documento los deja marcados en blanco en vez de inventarlos:
            <ul className="doc-barra-lista">
              {faltantes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
