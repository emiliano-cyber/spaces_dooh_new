'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import {
  programacionApi,
  programarFranjaApi,
  type CampanaProgramacionUI,
  type FranjaProgramacionUI,
} from '@/lib/data/programacion-api'
import { etiquetaFranja } from '@/lib/franja-programada'

// ============================================================================
//  El horario de transmisión de UNA campaña: verlo y cambiarlo.   PROG-01.
// ----------------------------------------------------------------------------
//  Es un componente aparte, montado con UNA línea en `campanas/[id]/page.tsx`,
//  a propósito: esa página la tocan otras ramas a la vez, y cuanto menos se
//  meta dentro, menos se pisa.
//
//  Enseña las DOS franjas y no las mezcla:
//   · «Vendida» sale de las reservas (`reservas.franja_id`) y aquí NO se puede
//     cambiar — es lo que el cliente aceptó, con su precio congelado.
//   · «Se transmite en» es la programada, la única que este cuadro edita.
//
//  Si difieren, el aviso llega calculado del servidor. HOY SE AVISA Y NO SE
//  BLOQUEA: si debería bloquearse es una decisión pendiente del dueño.
// ============================================================================

export function FranjaProgramadaCampana({ campanaId }: { campanaId: string }) {
  const [franjas, setFranjas] = useState<FranjaProgramacionUI[]>([])
  const [campana, setCampana] = useState<CampanaProgramacionUI | null>(null)
  const [eleccion, setEleccion] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)
  // `comercial.aprobar`, decidido por el servidor: sin él se ve el horario pero
  // no se ofrece el selector (decisión del dueño del 30/09).
  const [puede, setPuede] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const d = await programacionApi(campanaId)
      setFranjas(d.franjas)
      const c = d.campanas[0] ?? null
      setCampana(c)
      setEleccion(c?.franjaProgramadaId ?? '')
      setPuede(d.puedeProgramar === true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el horario de transmisión')
    } finally {
      setCargando(false)
    }
  }, [campanaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardar() {
    setOcupado(true)
    try {
      await programarFranjaApi(eleccion || null, [campanaId])
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo programar')
    } finally {
      setOcupado(false)
    }
  }

  // Sin franjas en el catálogo no hay nada que programar, y el cuadro no se
  // pinta: la campaña se ve exactamente como antes de que esto existiera.
  if (cargando || (!error && franjas.length === 0)) return null

  const porId = new Map(franjas.map((f) => [f.id, f]))
  const actual = campana?.franjaProgramadaId ? porId.get(campana.franjaProgramadaId) : undefined
  // Se ofrecen las ACTIVAS; la actual se añade aunque esté dada de baja, para
  // que el selector no mienta sobre lo que hay guardado.
  const opciones = franjas.filter((f) => f.activo || f.id === actual?.id)
  const vendidas = (campana?.contratadas ?? []).map((c) => ({
    nombre: c.franjaId ? porId.get(c.franjaId)?.nombre ?? c.franjaNombre ?? 'otra franja' : 'Todo el día',
    pantallas: c.pantallas,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario de transmisión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800">
            {error}
          </p>
        )}
        {campana && (
          <>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Vendida (no cambia aquí)</dt>
                <dd className="text-right text-ink">
                  {vendidas.length
                    ? vendidas.map((v) => `${v.nombre} (${v.pantallas})`).join(' · ')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Se transmite en</dt>
                <dd className="text-right text-ink">
                  {actual ? etiquetaFranja(actual) + (actual.activo ? '' : ' (dada de baja)') : 'Sin franja programada'}
                </dd>
              </div>
            </dl>

            {!puede ? (
              <p className="text-[12px] text-muted">
                Solo el gerente de ventas, el director comercial y la dirección pueden cambiar el
                horario de transmisión.
              </p>
            ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Franja de transmisión"
                className="rounded border px-2 py-1"
                value={eleccion}
                onChange={(e) => setEleccion(e.target.value)}
              >
                <option value="">Sin franja programada</option>
                {opciones.map((f) => (
                  <option key={f.id} value={f.id}>
                    {etiquetaFranja(f)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={ocupado || eleccion === (campana.franjaProgramadaId ?? '')}
                onClick={() => void guardar()}
                className="rounded border px-2 py-1 text-[12px] font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
            )}

            {campana.avisos.map((a) => (
              <p
                key={a.franjaContratadaId}
                role="note"
                className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900"
              >
                {a.texto}
              </p>
            ))}
          </>
        )}
        <AvisoFranjaCMS compacto />
      </CardContent>
    </Card>
  )
}
