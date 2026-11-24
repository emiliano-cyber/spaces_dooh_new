'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { useIdioma } from '@/lib/i18n/contexto'
import { Modal } from '@/components/demo/ui/Modal'
import { GaleriaFotos } from './FotosYUbicacionSitio'

// ============================================================================
//  «Fotos de las pantallas» — el cuadro de la ficha INTERNA de la propuesta
//  (pedido del dueño del 20/11: «fotos de cada pantalla, si es que están»).
// ----------------------------------------------------------------------------
//  Las fotos se piden UNA vez por propuesta (`GET /api/propuestas/:id/fotos`),
//  no una por sitio: el cuadro enseña todas las miniaturas a la vez.
//
//  El cuadro vive DENTRO de una `CardColapsable`, que desmonta su contenido al
//  plegarla: quien lo deja plegado no descarga las fotos, que son data URLs de
//  cientos de kB cada una.
//
//  Se vuelve a pedir cuando cambian los sitios de la propuesta (agregar o
//  quitar), por eso la ruta contesta `no-store`.
//
//  Al pulsar una miniatura se abre el MISMO visor que «Ver fotos y ubicación»
//  (`GaleriaFotos`), en esa foto.
// ============================================================================

export interface FotosDeSitio {
  sitioId: string
  nombre: string
  fotos: string[]
}

export type EstadoFotosPantallas = 'cargando' | 'error' | FotosDeSitio[]

/** Pide las fotos de la propuesta y pinta el cuadro. */
export function FotosPantallasPropuesta({ propuestaId, sitioIds }: { propuestaId: string; sitioIds: string[] }) {
  const [estado, setEstado] = useState<EstadoFotosPantallas>('cargando')
  // La lista de sitios como clave: al agregar o quitar uno, se vuelve a pedir.
  const clave = sitioIds.join(',')

  useEffect(() => {
    let vivo = true
    setEstado('cargando')
    fetch(`/spaces-dooh/api/propuestas/${propuestaId}/fotos/`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        const d = (await r.json()) as { sitios?: FotosDeSitio[] }
        if (vivo) setEstado(Array.isArray(d.sitios) ? d.sitios : [])
      })
      .catch(() => {
        if (vivo) setEstado('error')
      })
    return () => {
      vivo = false
    }
  }, [propuestaId, clave])

  return <CuadroFotosPantallas estado={estado} />
}

/** El cuadro, sin pedir nada: lo que se pinta para cada estado. */
export function CuadroFotosPantallas({ estado }: { estado: EstadoFotosPantallas }) {
  const { t } = useIdioma()
  // Qué foto está abierta en el visor: sitio (índice en la lista) y foto.
  const [abierta, setAbierta] = useState<{ sitio: number; foto: number } | null>(null)

  if (estado === 'cargando') {
    return <p className="text-[13px] text-muted">{t('propuestas.fotos.cargando')}</p>
  }
  if (estado === 'error') {
    return <p className="text-[13px] text-muted">{t('propuestas.fotos.error')}</p>
  }
  if (!estado.some((s) => s.fotos.length > 0)) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <ImageOff className="h-4 w-4 shrink-0" />
        {t('propuestas.ficha.fotos.ninguna')}
      </div>
    )
  }

  const enVisor = abierta ? estado[abierta.sitio] : null

  return (
    <>
      <ul className="m-0 list-none space-y-4 p-0">
        {estado.map((s, si) => (
          <li key={s.sitioId} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
            <div className="text-[13px] font-medium text-ink">{s.nombre}</div>
            {s.fotos.length === 0 ? (
              <div className="mt-1 text-[12px] text-muted">{t('propuestas.ficha.fotos.sin-fotos')}</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.fotos.map((f, fi) => (
                  <button
                    key={fi}
                    type="button"
                    onClick={() => setAbierta({ sitio: si, foto: fi })}
                    aria-label={t('propuestas.ficha.fotos.abrir', { n: fi + 1, sitio: s.nombre })}
                    className="h-16 w-24 overflow-hidden rounded border border-border bg-surface-2 hover:border-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de un data URL */}
                    <img src={f} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={!!enVisor}
        onOpenChange={(o) => {
          if (!o) setAbierta(null)
        }}
        title={enVisor?.nombre ?? ''}
        subtitle={t('propuestas.ficha.fotos')}
        size="lg"
      >
        {enVisor && abierta && (
          <GaleriaFotos
            nombre={enVisor.nombre}
            fotos={enVisor.fotos}
            actual={abierta.foto}
            onActual={(i) => setAbierta({ sitio: abierta.sitio, foto: i })}
          />
        )}
      </Modal>
    </>
  )
}
