'use client'

import { Target } from 'lucide-react'
import { Captacion } from '@/components/demo/captacion/Captacion'

// CAP-01 · la bitácora de captación: cómo va cada cliente, arrendador, predio o
// pantalla que se está intentando traer. El vendedor ve lo suyo; quien tiene
// `captacion.aprobar` ve a todo el equipo y decide.
export default function CaptacionPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Target className="h-5 w-5" />
        <div>
          <h1 className="text-lg font-semibold">Captación</h1>
          <p className="text-xs text-neutral-500">
            Clientes, arrendadores, predios y pantallas que se están trabajando, con la bitácora de
            cada uno. Cuando uno está listo se envía a revisión, y al aprobarlo se da de alta.
          </p>
        </div>
      </header>
      {/* Sin tarjeta envolvente desde el 20/10: la tabla de prospectos es ahora
          su propia tarjeta plegable dentro de `Captacion`, y una tarjeta dentro
          de otra se leía como dos marcos. Pestañas y «Nuevo prospecto» quedan
          a la vista, como en las demás pantallas. */}
      <Captacion />
    </div>
  )
}
