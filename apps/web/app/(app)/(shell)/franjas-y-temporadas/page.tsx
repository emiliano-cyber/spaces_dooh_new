'use client'

import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { GestionRejilla } from '@/components/demo/rejilla/GestionRejilla'

// ============================================================================
//  /franjas-y-temporadas — las dos dimensiones de la tarifa base.
//  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  Hasta hoy el precio de venta era UN número por (pantalla, unidad). Desde
//  aquí el dueño declara las FRANJAS de su día y las TEMPORADAS de su año, y la
//  tarifa de cada combinación se captura en la ficha de cada pantalla.
//
//  Va en el grupo «patrimonio», pegada a Inventario, y bajo el módulo
//  `inventario` igual que sus endpoints: es una dimensión del precio de venta
//  de las pantallas, no una configuración administrativa. Declararla en otro
//  módulo sería declarar una mentira, y quien marcara esa casilla en la matriz
//  de permisos creería estar concediendo otra cosa.
//
//  LA REJILLA ES DISPERSA. Esta pantalla puede quedarse vacía para siempre y no
//  pasa nada: sin franjas ni temporadas, todo se vende con la tarifa base —
//  exactamente como funcionaba antes de que existiera.
// ============================================================================
export default function FranjasYTemporadasPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Clock className="h-5 w-5" />
        <div>
          <h1 className="text-lg font-semibold">Franjas y temporadas</h1>
          <p className="text-xs text-neutral-500">
            Las dos dimensiones de la tarifa: la hora del día y la época del año. Se capturan una
            vez y valen para todo el inventario.
          </p>
        </div>
      </header>
      <Card>
        <CardContent className="pt-6">
          <GestionRejilla />
        </CardContent>
      </Card>
    </div>
  )
}
