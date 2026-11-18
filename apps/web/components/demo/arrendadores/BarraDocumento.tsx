'use client'

import { Printer, AlertTriangle } from 'lucide-react'
import type { Faltante } from '@/lib/contrato-documento'
import { useIdioma } from '@/lib/i18n/contexto'
import { CLAVE_DONDE_DOC, CLAVE_FALTANTE_DOC } from './etiquetas'

// Barra de acciones del documento del contrato. Es lo ÚNICO interactivo de la
// página y lleva `doc-no-print`, así que no sale en el papel.
export function BarraDocumento({ faltantes }: { faltantes: Faltante[] }) {
  // I18N (2026-11-02) · la barra no se imprime: se traduce. QUE falta y DONDE
  // (`f.etiqueta`, `f.donde`) los redacta `lib/contrato-documento.ts`, que no
  // se toca; aqui se pintan con su clave si es uno de los conocidos, y si no
  // tal cual. En espanol, siempre tal cual.
  const { idioma, t } = useIdioma()
  const pinta = (texto: string, mapa: Record<string, Parameters<typeof t>[0]>) =>
    idioma !== 'es' && mapa[texto] ? t(mapa[texto]) : texto
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
                <span className="doc-barra-donde">{t('arrendadores.barra.en', { donde: pinta(donde, CLAVE_DONDE_DOC) })}</span>
                <ul className="doc-barra-lista">
                  {etiquetas.map((e) => (
                    <li key={e}>{pinta(e, CLAVE_FALTANTE_DOC)}</li>
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
