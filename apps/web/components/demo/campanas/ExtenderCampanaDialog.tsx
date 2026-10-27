'use client'

import { useState } from 'react'
import { CalendarClock, MapPin } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { extenderCampanaApi } from '@/lib/data/estado-api'

// ============================================================================
//  ExtenderCampanaDialog — alargar la fecha de fin de una campaña (FOLIO-VENTA:
//  cada extensión le suma un tramo al folio, .1, .2…).
// ----------------------------------------------------------------------------
//  Vivía DENTRO de `comercial/page.tsx`, montado desde la tarjeta «Reservas
//  tentativas». Esa tarjeta se retiró con TENT-PROP (26/10) y, como solo
//  aparecía con reservas TENTATIVA —que ningún flujo creaba—, este diálogo ya
//  era INALCANZABLE desde la interfaz aunque la API (`/api/campanas/[id]/
//  extender`) funcione. Se mueve aquí sin cambiarle nada para que el dueño
//  decida dónde ofrecerlo (lo natural es el detalle de la campaña).
// ============================================================================

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function ExtenderCampanaDialog({
  campana,
  onClose,
  onDone,
}: {
  campana: { id: string; nombre: string } | null
  onClose: () => void
  onDone: (nombre: string) => void
}) {
  const [fin, setFin] = useState(isoDate(60))
  // OBLIG-01 · la nueva fecha de fin es todo lo que pide el diálogo. Vacía,
  // `new Date('')` reventaba al pasarla a ISO sin decir por qué.
  const ob = useObligatorios({ fin }, ['fin'])
  if (!campana) return null
  function cerrar() {
    ob.reiniciar()
    onClose()
  }
  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && cerrar()}
      title="Extender campaña"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              if (!ob.validar()) return
              await extenderCampanaApi(campana.id, new Date(fin).toISOString())
              onDone(campana.nombre)
              cerrar()
            }}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Extender
          </Button>
        </div>
      }
    >
      <Campo
        label={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted" /> Nueva fecha de fin
          </span>
        }
        obligatorio
        falta={ob.falta('fin')}
      >
        <input
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Campo>
    </Modal>
  )
}
