'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, FileText, Upload, X } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { extenderCampanaApi } from '@/lib/data/estado-api'

// ============================================================================
//  ExtenderCampanaDialog — alargar la fecha de fin de una campaña (FOLIO-VENTA:
//  cada extensión le suma un tramo al folio, .1, .2…).
// ----------------------------------------------------------------------------
//  Vivía DENTRO de `comercial/page.tsx`, montado desde la tarjeta «Reservas
//  tentativas», que se retiró con TENT-PROP (26/10) y lo dejó inalcanzable.
//
//  EXT-CONTRATO (29/10, regla del dueño): vuelve a ofrecerse, en la ficha de la
//  campaña (`ExtensionesCampana`), y una campaña NO se extiende sin un contrato
//  nuevo: el PDF firmado de la extensión es obligatorio EN ESTE MISMO PASO. El
//  servidor lo exige igual (422) — esto solo evita el viaje de ida y vuelta.
//
//  La subida es la de «Contrato del cliente» (`DatosFacturacion`): el archivo se
//  lee en el navegador como data URL y va en el cuerpo, con el tope de 10 MB.
//  Aquí solo PDF, que es lo único que el servidor acepta como contrato.
// ============================================================================

const MAX_MB = 10

// La fecha de fin propuesta: un mes después de la actual (si se conoce), que
// es lo más común; nunca hoy, que casi siempre acortaría.
function finPropuesto(fechaFin?: string | null): string {
  const base = fechaFin ? new Date(`${fechaFin.slice(0, 10)}T12:00:00`) : new Date()
  base.setDate(base.getDate() + 30)
  return base.toISOString().slice(0, 10)
}

export function ExtenderCampanaDialog({
  campana,
  onClose,
  onDone,
}: {
  campana: { id: string; nombre: string; fechaFin?: string | null } | null
  onClose: () => void
  onDone: (nombre: string) => void
}) {
  const [fin, setFin] = useState(() => finPropuesto(campana?.fechaFin))
  const [contrato, setContrato] = useState<{ nombre: string; url: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // OBLIG-01 · la fecha y, desde EXT-CONTRATO, el contrato. Si falta alguno, el
  // campo se marca en rojo y dice cuál, en vez de mandar y esperar el 422.
  const ob = useObligatorios({ fin, contrato: contrato?.url ?? '' }, ['fin', 'contrato'])
  if (!campana) return null

  function cerrar() {
    ob.reiniciar()
    setContrato(null)
    onClose()
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.type && f.type !== 'application/pdf') {
      toast.error('El contrato tiene que ser un PDF')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`El contrato supera ${MAX_MB} MB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setContrato({ nombre: f.name, url: reader.result as string })
    reader.onerror = () => toast.error('No se pudo leer el archivo')
    reader.readAsDataURL(f)
  }

  async function extender() {
    if (!campana || !ob.validar() || !contrato) return
    setEnviando(true)
    try {
      // La fecha va tal cual (AAAA-MM-DD): pasarla por `toISOString` la movía de
      // día según la zona horaria del navegador.
      await extenderCampanaApi(campana.id, fin, contrato.url)
      onDone(campana.nombre)
      cerrar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo extender')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && cerrar()}
      title="Extender campaña"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={extender} disabled={enviando}>
            <CalendarClock className="h-3.5 w-3.5" /> {enviando ? 'Extendiendo…' : 'Extender'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Campo label="Nueva fecha de fin" obligatorio falta={ob.falta('fin')}>
          <input
            type="date"
            value={fin}
            min={campana.fechaFin ? campana.fechaFin.slice(0, 10) : undefined}
            onChange={(e) => setFin(e.target.value)}
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </Campo>

        <Campo label="Contrato firmado de la extensión (PDF)" obligatorio falta={ob.falta('contrato')}>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFile} />
          {contrato ? (
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-3 py-2 text-[13px]">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="truncate">{contrato.nombre}</span>
              </span>
              <button
                type="button"
                aria-label="Quitar contrato"
                onClick={() => setContrato(null)}
                className="text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Adjuntar contrato (PDF)
            </Button>
          )}
        </Campo>

        <p className="text-[12px] text-muted">
          Sin el contrato firmado de la extensión no se puede extender. Queda en el expediente de la
          campaña junto con el folio del tramo nuevo; el contrato original del cliente no se toca.
        </p>
      </div>
    </Modal>
  )
}
