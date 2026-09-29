'use client'

import { Ticket } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { GestionCodigos } from '@/components/demo/codigos/GestionCodigos'

// ============================================================================
//  /codigos-promocionales — «usa este código y ten un 20 % adicional».
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  POR QUÉ ES UNA PANTALLA PROPIA. «Franjas y temporadas» declara de dónde sale
//  el precio y «Descuentos por volumen» una regla interna que se aplica sola.
//  Un código es otra cosa: es **lo único de la cadena que se le promete a
//  alguien de fuera de la casa**, con su nombre, su fecha de caducidad y su
//  cupo. Meterlo dentro de otra pantalla haría creer que es una regla más del
//  tarifario, y no lo es: es una campaña.
//
//  Va en el grupo «patrimonio» y bajo el módulo `inventario`, igual que sus
//  endpoints (`app/api/codigos-promocionales/route.ts`). Declararla en otro
//  módulo sería declarar una mentira en la matriz de permisos.
//
//  ⚠️ CREAR UN CUPÓN Y APLICARLO SON DOS PERMISOS DISTINTOS. Esto es
//  Administración; aplicarlo se hace desde la propuesta, con `comercial.crear`.
//  Si fueran el mismo, quien vende podría crearse su propio cupón del 50 % —
//  y es también la razón por la que un cupón no cuenta contra el tope de
//  descuento comercial: lo autoriza otra persona.
//
//  EL CATÁLOGO ES DISPERSO. Esta pantalla puede quedarse vacía para siempre y
//  no pasa nada: sin códigos, todo se vende exactamente como hoy.
// ============================================================================
export default function CodigosPromocionalesPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Ticket className="h-5 w-5" />
        <div>
          <h1 className="text-lg font-semibold">Códigos promocionales</h1>
          <p className="text-xs text-neutral-500">
            Códigos con vencimiento y cupo que un vendedor aplica a una cotización. Los pone esta
            empresa y no se comparten con nadie más.
          </p>
        </div>
      </header>
      <Card>
        <CardContent className="pt-6">
          <GestionCodigos />
        </CardContent>
      </Card>
    </div>
  )
}
