'use client'

import { Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { GestionVolumen } from '@/components/demo/volumen/GestionVolumen'

// ============================================================================
//  /descuentos-por-volumen — «compra 50 spots y pagas 40».  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  POR QUÉ ES UNA PANTALLA PROPIA Y NO UNA SECCIÓN DE «FRANJAS Y TEMPORADAS».
//  Aquélla declara las dimensiones de la tarifa BASE —de dónde sale el precio—;
//  ésta declara un DESCUENTO que se aplica encima. Son dos escalones distintos
//  de la cadena del ADR 0039, y juntarlos haría creer que el volumen es una
//  dimensión más del precio, que es justo lo que no es: el precio de lista no
//  cambia, se descuenta.
//
//  Va en el grupo «patrimonio» y bajo el módulo `inventario`, igual que sus
//  endpoints (`app/api/volumen/escalas/route.ts`). Declararla en otro módulo
//  sería declarar una mentira, y quien marcara esa casilla en la matriz de
//  permisos creería estar concediendo otra cosa.
//
//  LA ESCALA ES DISPERSA. Esta pantalla puede quedarse vacía para siempre y no
//  pasa nada: sin tramos, todo se vende al precio de tarifa — exactamente como
//  funcionaba antes de que existiera.
// ============================================================================
export default function DescuentosPorVolumenPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Layers className="h-5 w-5" />
        <div>
          <h1 className="text-lg font-semibold">Descuentos por volumen</h1>
          <p className="text-xs text-neutral-500">
            Qué descuento gana quien compra mucho. Se captura una vez por unidad de venta y vale
            para todo el inventario.
          </p>
        </div>
      </header>
      <Card>
        <CardContent className="pt-6">
          <GestionVolumen />
        </CardContent>
      </Card>
    </div>
  )
}
