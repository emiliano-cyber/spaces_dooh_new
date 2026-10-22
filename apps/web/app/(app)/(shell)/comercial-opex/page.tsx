import { Handshake } from 'lucide-react'
import { ComercialOpex } from '@/components/demo/comercial-opex/ComercialOpex'

// ============================================================================
//  Comercial negociación · prospección de arrendadores.  NEG-01.
// ----------------------------------------------------------------------------
//  Fue MAQUETA del 30/09 al 22/10 («por ahora solo será html sin funciones»).
//  Desde NEG-01 guarda de verdad: cada espacio es un prospecto PREDIO o
//  PANTALLA de Captación, con su ficha, ubicación, contactos, ofertas al dueño,
//  competencia, bitácora y notas. Ver `components/demo/comercial-opex/` y
//  `vault/03-Frontend/comercial-opex.md`.
//
//  Se queda como Server Component para fijar AQUÍ la fecha de hoy: si la
//  calcularan el servidor y el navegador por separado, «hace N días» podía
//  salir distinto a medianoche y React avisaría de una hidratación rota.
// ============================================================================

export default function ComercialOpexPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-start gap-2">
        <Handshake className="mt-0.5 h-5 w-5 text-ink" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink">Comercial negociación</h1>
          <p className="text-[12px] text-muted">
            Prospección de arrendadores: los espacios que se están persiguiendo, quién manda en cada
            uno y cómo va la negociación de su renta.
          </p>
        </div>
      </header>
      <ComercialOpex hoyIso={new Date().toISOString()} />
    </div>
  )
}
