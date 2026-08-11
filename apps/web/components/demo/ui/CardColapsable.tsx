'use client'

import * as React from 'react'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardHeader, CardTitle, CardContent } from './Card'

// ============================================================================
//  Tarjeta con encabezado plegable. Mismo gesto que las secciones de la ficha
//  de campaña: clic en el encabezado abre y cierra.
//
//  Existe como primitiva compartida y no copiada en cada pantalla porque la
//  ficha de campaña ya tenía su propia `Seccion` local: una segunda copia suelta
//  es como divergen dos pantallas que deberían plegarse igual.
//
//  El contenido se DESMONTA al cerrar, no se esconde con CSS. Así una tabla
//  larga deja de pesar en el DOM, que es media razón para poder plegarla. El
//  precio es que su estado interno (la página de un paginador, una fila
//  desplegada) se reinicia al volver a abrir; para estas tarjetas es lo
//  aceptable.
//
//  Accesibilidad: el encabezado entero responde al ratón, pero quien navega con
//  teclado necesita un control REAL — de ahí el botón del galón con
//  `aria-expanded`. Un `div` con onClick no recibe foco ni anuncia su estado, y
//  la sección quedaría inalcanzable sin ratón.
// ============================================================================

export function CardColapsable({
  titulo,
  icono,
  subtitulo,
  resumen,
  accion,
  defaultAbierto = true,
  className,
  headerClassName,
  contentClassName,
  children,
}: {
  titulo: string
  icono?: React.ReactNode
  // Se pliega CON el título: es explicación de la sección, no contenido. Si
  // quedara visible al cerrar, la tarjeta cerrada seguiría ocupando tres
  // líneas y plegarla no ahorraría nada.
  subtitulo?: React.ReactNode
  // Cifras del encabezado («3 vencidas · $12,000 por pagar»). Va DENTRO del
  // área que pliega, al contrario que `accion`: es texto, y pulsar sobre texto
  // esperando que pliegue y que no pase nada es de las cosas que se sienten
  // rotas sin saber por qué.
  resumen?: React.ReactNode
  // Botones propios de la sección (descargar, añadir…). Van fuera del área que
  // pliega: pulsarlos no debe cerrar la tarjeta.
  accion?: React.ReactNode
  defaultAbierto?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(defaultAbierto)
  return (
    <Card className={className}>
      <CardHeader
        className={cn(
          'flex cursor-pointer select-none flex-row flex-wrap items-center justify-between gap-2',
          headerClassName,
        )}
        onClick={() => setAbierto((v) => !v)}
      >
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-1.5">
            {icono}
            {titulo}
          </CardTitle>
          {abierto && subtitulo ? <div className="mt-0.5 text-[12px] text-muted">{subtitulo}</div> : null}
        </div>
        {resumen ? <div className="ml-auto shrink-0">{resumen}</div> : null}
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {accion}
          <button
            type="button"
            aria-expanded={abierto}
            aria-label={`${abierto ? 'Minimizar' : 'Expandir'} ${titulo}`}
            onClick={() => setAbierto((v) => !v)}
            className="rounded text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', abierto && 'rotate-180')} />
          </button>
        </div>
      </CardHeader>
      {abierto && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  )
}
