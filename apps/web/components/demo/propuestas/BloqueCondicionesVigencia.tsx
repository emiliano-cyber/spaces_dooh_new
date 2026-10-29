'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/demo/ui/Button'
import { actualizarPropuestaApi } from '@/lib/data/estado-api'
import { formatFecha } from '@/lib/data/client'

// ============================================================================
//  Condiciones y vigencia de UNA propuesta (PROP-COMPLETA, decisión del dueño
//  del 29/10).
//
//  · Las condiciones nacen copiadas de la plantilla de la organización
//    (Administración) y aquí se ajustan para este cliente. Salen en el
//    documento imprimible y en la liga pública.
//  · La vigencia la pone el servidor al ENVIAR (hoy + los días de la
//    organización). Aquí se puede alargar o acortar; vencida, la liga no deja
//    aceptar, y la manera de reabrirla es poner otra fecha o volver a enviarla.
//
//  Ninguno de los dos cambia el precio, así que no suben la versión. Una
//  propuesta APROBADA es inmutable y aquí solo se leen.
// ============================================================================

const cls =
  'rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function BloqueCondicionesVigencia({
  propuestaId,
  condiciones,
  vigenteHasta,
  vencida,
  editable,
}: {
  propuestaId: string
  condiciones: string | null
  vigenteHasta: string | null
  vencida: boolean
  editable: boolean
}) {
  const [texto, setTexto] = useState(condiciones ?? '')
  const [fecha, setFecha] = useState(vigenteHasta ?? '')
  const [guardando, setGuardando] = useState(false)
  // Si otro guardado (o un refresco del estado) trae valores nuevos, el
  // formulario los recoge; lo tecleado y sin guardar se perdería igual al salir.
  useEffect(() => setTexto(condiciones ?? ''), [condiciones])
  useEffect(() => setFecha(vigenteHasta ?? ''), [vigenteHasta])

  const cambioTexto = texto.trim() !== (condiciones ?? '').trim()
  const cambioFecha = fecha !== (vigenteHasta ?? '')

  async function guardar() {
    setGuardando(true)
    try {
      await actualizarPropuestaApi(propuestaId, {
        ...(cambioTexto ? { condiciones: texto.trim() || null } : {}),
        ...(cambioFecha ? { vigenteHasta: fecha || null } : {}),
      })
      toast.success('Condiciones y vigencia guardadas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-3 text-[13px]">
      <div>
        <div className="text-[12px] font-medium text-ink">Vigencia</div>
        <p className="mt-0.5 text-[11px] text-muted">
          {vigenteHasta
            ? vencida
              ? `Venció el ${formatFecha(vigenteHasta)}: la liga ya no deja aceptarla. Pon otra fecha o vuelve a enviarla.`
              : `El cliente puede aceptarla hasta el ${formatFecha(vigenteHasta)} (ese día incluido).`
            : 'Se pone sola al enviarla, con los días que tu organización tiene en Administración.'}
        </p>
        {editable && (
          <input
            type="date"
            aria-label="Válida hasta"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`mt-2 h-9 ${cls}`}
          />
        )}
      </div>

      <div>
        <div className="text-[12px] font-medium text-ink">Términos y condiciones</div>
        <p className="mt-0.5 text-[11px] text-muted">
          Salen al final del documento y en la liga del cliente. Nacen de la plantilla de Administración; lo que cambies
          aquí vale solo para esta propuesta.
        </p>
        {editable ? (
          <textarea
            aria-label="Términos y condiciones"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={8000}
            placeholder="Sin condiciones: el documento no lleva este bloque."
            className={`mt-2 w-full py-2 ${cls}`}
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-[12px] text-ink">{condiciones || 'Sin condiciones.'}</p>
        )}
      </div>

      {editable && (
        <Button size="sm" onClick={guardar} disabled={guardando || (!cambioTexto && !cambioFecha)}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </div>
  )
}
