'use client'

import { GestionPaquetes } from '@/components/demo/paquetes/GestionPaquetes'

// ============================================================================
//  /paquetes — «estas cinco pantallas, prime, un mes: 180 000».
//  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  POR QUÉ ES UNA PANTALLA PROPIA Y NO UNA SECCIÓN DE «DESCUENTOS POR VOLUMEN».
//  Porque un paquete NO es un descuento. El volumen y el código promocional
//  multiplican un precio ya resuelto; un paquete lo SUSTITUYE. Juntarlos haría
//  creer que el precio de lista sigue mandando y que el paquete es una rebaja
//  sobre él, que es justo lo que no es — y esa confusión se pagaría al leer un
//  reporte de descuentos donde el paquete no aparece.
//
//  Va en el grupo «patrimonio» y bajo el módulo `inventario`, igual que sus
//  endpoints (`app/api/paquetes/route.ts`). Declararla en otro módulo sería
//  declarar una mentira, y quien marcara esa casilla en la matriz de permisos
//  creería estar concediendo otra cosa.
//
//  EL CATÁLOGO PUEDE QUEDARSE VACÍO PARA SIEMPRE y no pasa nada: sin paquetes,
//  todo se vende al precio de tarifa — exactamente como funcionaba antes de que
//  existiera esta pantalla.
// ============================================================================
export default function PaquetesPage() {
  return (
    <div className="w-full space-y-4">
      {/* Encabezado con la forma del Dashboard (rediseño 2026-10-26): título
          de 2xl y subtítulo en `text-muted`, sin el icono suelto ni la paleta
          `neutral` de Tailwind, que no son tokens del proyecto. */}
      <header>
        <div>
          <h1 className="text-2xl text-ink">Paquetes cerrados</h1>
          <p className="mt-1 text-[13px] text-muted">
            Un conjunto de pantallas con un precio del conjunto. Sustituye la suma de sus tarifas
            de lista; no la descuenta.
          </p>
        </div>
      </header>
      {/* PLEG-02 · sin tarjeta envolvente: la lista trae la suya, plegable. */}
      <GestionPaquetes />
    </div>
  )
}
