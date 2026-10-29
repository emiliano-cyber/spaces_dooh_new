'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import { Printer, ArrowLeft } from 'lucide-react'
import { MapView, type MapPoint } from '@/components/demo/MapView'

// ============================================================================
//  Las piezas INTERACTIVAS del documento imprimible de la propuesta
//  (PROP-COMPLETA, 29/10). La página es de servidor; esto es lo que necesita el
//  navegador: imprimir, el mapa (MapLibre) y la liga con su QR, que se arma con
//  el origen desde el que se abre (la instancia sabe su nombre; el servidor
//  detrás de nginx, no siempre).
// ============================================================================

export function BarraDocumentoPropuesta({ volverA }: { volverA: string }) {
  return (
    <div className="doc-no-print doc-barra">
      <div className="doc-barra-fila">
        {/* `Link` y no <a>: pone el basePath (/spaces-dooh) solo. */}
        <Link href={volverA} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0a66ff] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a la propuesta
        </Link>
        <button type="button" onClick={() => window.print()} className="doc-btn">
          <Printer className="h-3.5 w-3.5" /> Imprimir o guardar como PDF
        </button>
        <span className="doc-barra-nota">
          En el diálogo de impresión elige «Guardar como PDF». Espera a que cargue el mapa antes de imprimir.
        </span>
      </div>
    </div>
  )
}

export function MapaDocumento({ puntos }: { puntos: MapPoint[] }) {
  return (
    <div className="doc-mapa">
      <MapView points={puntos} zoom={11} imprimible />
    </div>
  )
}

export function LigaConQr({ token, aceptable }: { token: string; aceptable: boolean }) {
  const [liga, setLiga] = useState('')
  useEffect(() => {
    // Con barra final: la app corre con `trailingSlash` (ver `lib/medios-url.ts`).
    setLiga(`${window.location.origin}/spaces-dooh/p/${token}/`)
  }, [token])
  const svg = useMemo(() => {
    if (!liga) return ''
    const q = qrcode(0, 'M')
    q.addData(liga)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true })
  }, [liga])
  if (!liga) return null
  return (
    <div className="doc-qr-caja">
      {/* El SVG lo arma la librería con nuestra propia liga: no hay HTML ajeno. */}
      <div className="doc-qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <p className="doc-p doc-strong">{aceptable ? 'Acéptala en línea' : 'Consúltala en línea'}</p>
        <p className="doc-p doc-chico">
          {aceptable
            ? 'Escanea el código o abre esta dirección para revisar la propuesta y aceptarla:'
            : 'Escanea el código o abre esta dirección para consultar la propuesta:'}
        </p>
        <p className="doc-p doc-chico doc-liga">{liga}</p>
      </div>
    </div>
  )
}
