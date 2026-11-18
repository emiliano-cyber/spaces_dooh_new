'use client'

import { useCallback, useEffect, useState } from 'react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import {
  programacionApi,
  programarFranjaApi,
  type CampanaProgramacionUI,
  type FranjaProgramacionUI,
} from '@/lib/data/programacion-api'
import { etiquetaFranja } from '@/lib/franja-programada'
import { Button } from '@/components/demo/ui/Button'
import { useTexto } from '@/lib/i18n/contexto'

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
  const t = useTexto()
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
      setError(e instanceof Error ? e.message : t('campanas.horario.no-leer'))
    } finally {
      setCargando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(e instanceof Error ? e.message : t('campanas.horario.no-programar'))
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
    nombre: c.franjaId
      ? porId.get(c.franjaId)?.nombre ?? c.franjaNombre ?? t('campanas.horario.otra-franja')
      : t('campanas.horario.todo-el-dia'),
    pantallas: c.pantallas,
  }))

  return (
    // PLEG-01 · plegar NO pierde la franja elegida sin guardar: `eleccion` vive
    // en este componente, que sigue montado; solo se desmonta el contenido.
    <CardColapsable id="campana.horario" titulo={t('campanas.horario.titulo')} contentClassName="space-y-3 text-[13px]">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800">
            {error}
          </p>
        )}
        {campana && (
          <>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('campanas.horario.vendida')}</dt>
                <dd className="text-right text-ink">
                  {vendidas.length
                    ? vendidas.map((v) => `${v.nombre} (${v.pantallas})`).join(' · ')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('campanas.horario.se-transmite')}</dt>
                <dd className="text-right text-ink">
                  {actual
                    ? etiquetaFranja(actual) + (actual.activo ? '' : t('campanas.horario.dada-de-baja'))
                    : t('campanas.horario.sin-franja')}
                </dd>
              </div>
            </dl>

            {!puede ? (
              <p className="text-[12px] text-muted">
                {t('campanas.horario.sin-permiso')}
              </p>
            ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t('campanas.horario.franja')}
                className="rounded border px-2 py-1"
                value={eleccion}
                onChange={(e) => setEleccion(e.target.value)}
              >
                <option value="">{t('campanas.horario.sin-franja')}</option>
                {opciones.map((f) => (
                  <option key={f.id} value={f.id}>
                    {etiquetaFranja(f)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                disabled={ocupado || eleccion === (campana.franjaProgramadaId ?? '')}
                onClick={() => void guardar()}
                size="sm"
              >
                {t('comun.guardar')}
              </Button>
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
    </CardColapsable>
  )
}
