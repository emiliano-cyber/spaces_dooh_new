'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ExtenderCampanaDialog } from '@/components/demo/campanas/ExtenderCampanaDialog'
import { extensionesCampanaApi, type ExtensionCampana } from '@/lib/data/estado-api'
import { formatFecha } from '@/lib/data/client'

// ============================================================================
//  ExtensionesCampana — EXT-CONTRATO (29/10). En la ficha de la campaña: el
//  botón «Extender campaña» (con el contrato obligatorio, ver el diálogo) y el
//  expediente de las extensiones ya hechas, cada una con su folio de tramo, de
//  qué fecha a qué fecha, quién la hizo y su contrato.
//
//  Las filas salen de `GET /api/campanas/[id]/extender` (`campana_extensiones`).
//  Las extensiones de antes del 29/10 no pedían contrato y no aparecen aquí: su
//  rastro está en la bitácora («Extendió campaña … hasta …»).
// ============================================================================

export function ExtensionesCampana({
  campana,
}: {
  campana: { id: string; nombre: string; fechaFin: string | null; estadoComercial: string }
}) {
  const puede = usePuede('comercial', 'crear')
  const [lista, setLista] = useState<ExtensionCampana[] | null>(null)
  const [abierto, setAbierto] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLista(await extensionesCampanaApi(campana.id))
    } catch {
      setLista([])
    }
  }, [campana.id])
  useEffect(() => {
    void cargar()
  }, [cargar])

  // Una cancelada no se alarga: no tiene sentido firmar un contrato para eso.
  const sePuedeExtender = puede && campana.estadoComercial !== 'CANCELADA'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] text-muted">
          Termina el <span className="demo-num text-ink">{campana.fechaFin ? formatFecha(campana.fechaFin) : '—'}</span>.
          Para alargarla hace falta el contrato firmado de la extensión.
        </p>
        {sePuedeExtender && (
          <Button size="sm" onClick={() => setAbierto(true)}>
            <CalendarClock className="h-3.5 w-3.5" /> Extender campaña
          </Button>
        )}
      </div>

      {lista === null ? (
        <div className="h-10 w-full animate-pulse rounded bg-surface-2" />
      ) : lista.length === 0 ? (
        <p className="m-0 text-[13px] text-muted">Sin extensiones con contrato.</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {lista.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
              <div className="min-w-0">
                <div className="demo-num font-medium text-ink">{x.folio}</div>
                <div className="text-[12px] text-muted">
                  <span className="demo-num">
                    {formatFecha(x.fechaFinAnterior)} → {formatFecha(x.fechaFinNueva)}
                  </span>
                  {x.usuarioNombre ? ` · ${x.usuarioNombre}` : ''}
                </div>
              </div>
              <a
                href={x.contratoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
              >
                Ver contrato <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Se monta solo abierto: así la fecha propuesta sale de la fecha de fin
          que la campaña tiene AHORA, no de la que tenía al cargar la ficha. */}
      {abierto && (
        <ExtenderCampanaDialog
          campana={{ id: campana.id, nombre: campana.nombre, fechaFin: campana.fechaFin }}
          onClose={() => setAbierto(false)}
          onDone={(nombre) => {
            toast.success(`${nombre} extendida`)
            void cargar()
          }}
        />
      )}
    </div>
  )
}
