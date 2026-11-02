'use client'

import { Printer, AlertTriangle } from 'lucide-react'
import type { Faltante } from '@/lib/contrato-documento'
import { useTexto } from '@/lib/i18n/contexto'

// Barra de acciones del documento del contrato. Es lo ÚNICO interactivo de la
// página y lleva `doc-no-print`, así que no sale en el papel.
export function BarraDocumento({ faltantes }: { faltantes: Faltante[] }) {
  // I18N (2026-11-02) · la barra no se imprime: se traduce. QUE falta y DONDE
  // (`f.etiqueta`, `f.donde`) los redacta `lib/contrato-documento.ts`, el
  // redactor del contrato, y siguen en espanol.
  const t = useTexto()
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
          <Printer className="h-3.5 w-3.5" /> {t('propuestas.documento.imprimir')}
        </button>
        <span className="doc-barra-nota">
          {t('arrendadores.barra.nota')}
        </span>
      </div>

      {faltantes.length > 0 && (
        <div className="doc-barra-aviso">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <b>{t(faltantes.length === 1 ? 'arrendadores.barra.faltan.uno' : 'arrendadores.barra.faltan.otros', { n: faltantes.length })}</b>{' '}
            {t('arrendadores.barra.en-blanco')}
            {Object.entries(porDonde).map(([donde, etiquetas]) => (
              <div key={donde} className="doc-barra-grupo">
                <span className="doc-barra-donde">{t('arrendadores.barra.en', { donde })}</span>
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
