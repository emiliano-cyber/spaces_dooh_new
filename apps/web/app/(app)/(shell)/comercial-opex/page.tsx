import { Handshake } from 'lucide-react'
import { ComercialOpex } from '@/components/demo/comercial-opex/ComercialOpex'

// ============================================================================
//  Comercial OPEX · prospección de arrendadores. MAQUETA.
// ----------------------------------------------------------------------------
//  Pedido por Jochelo el 2026-09-30 desde un prototipo suyo: «por ahora solo
//  será html sin funciones» y «el mapa ese no lo añadas». Así que aquí NO hay
//  formularios, NO hay guardado, NO hay llamadas a la API y NO hay mapa.
//
//  Ese mismo día pidió «acomódalo de mejor manera»: la pantalla pasó a dos
//  columnas —lista de espacios y detalle del elegido— en
//  `components/demo/comercial-opex/ComercialOpex.tsx`. Elegir cuál mirar no
//  guarda nada. Las cuentas siguen en `lib/comercial-opex.ts`, con pruebas.
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
          <h1 className="text-lg font-semibold text-ink">Comercial OPEX</h1>
          <p className="text-[12px] text-muted">
            Prospección de arrendadores: los espacios que se están persiguiendo, quién manda en cada
            uno y cómo va la negociación de su renta.
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          <strong>Maqueta</strong> · datos de ejemplo, no se guarda nada
        </span>
      </header>
      <ComercialOpex hoyIso={new Date().toISOString()} />
    </div>
  )
}
