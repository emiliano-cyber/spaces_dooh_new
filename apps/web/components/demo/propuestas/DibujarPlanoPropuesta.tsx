'use client'

import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { PlanoVallas } from '@/components/vallas/PlanoVallas'
import { listarVallasApi } from '@/lib/data/vallas-api'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Valla, GrupoVallas } from '@/lib/vallas/tipos'

// ============================================================================
//  «DIBUJAR PLANO» EN LA PROPUESTA (decisión del dueño, 20/11 noche).
//
//  Junto a la marca, en la ficha y en «Nueva propuesta»: despliega, en la
//  misma pantalla (no navega), el plano de las vallas de LOS SITIOS DE ESA
//  PROPUESTA en LAS FECHAS DE LA PROPUESTA. Es el plano de Vallas
//  (`PlanoVallas`, `lib/vallas/plano.ts`) con `sitioIds` y fechas fijas; no
//  hay un segundo dibujo. Las vallas dadas de baja no salen (ya lo hace
//  `armarPlano`).
//
//  PERMISOS. `GET /api/vallas` y `GET /api/vallas/ocupacion` piden
//  `inventario.ver`. Los roles de venta sembrados lo tienen todos, pero los
//  permisos se editan por organización: a quien pueda ver o crear propuestas
//  y NO tenga `inventario.ver` NO se le ofrece el botón. Ofrecérselo acabaría
//  en un 403; y un botón deshabilitado con explicación sería ruido para
//  alguien que, por decisión de su organización, tampoco ve las vallas en
//  Inventario. Mismo criterio que el bloque de paquetes de la ficha.
//
//  Las vallas se piden la PRIMERA vez que se abre, no al pintar la ficha: la
//  mayoría de las veces nadie lo abre.
// ============================================================================

type Datos = { vallas: Valla[]; grupos: GrupoVallas[] }

export function DibujarPlanoPropuesta({
  sitioIds,
  desde,
  hasta,
}: {
  sitioIds: readonly string[]
  /** 'YYYY-MM-DD'; vacías mientras no se eligen (alta). */
  desde: string
  hasta: string
}) {
  const { t } = useIdioma()
  const puedeVer = usePuede('inventario', 'ver')
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!puedeVer) return null

  function alternar() {
    const abrir = !abierto
    setAbierto(abrir)
    if (abrir && !datos) {
      setError(null)
      listarVallasApi()
        .then((r) => setDatos({ vallas: r.vallas, grupos: r.grupos }))
        .catch((e) => setError(e instanceof Error ? e.message : t('vallas.error.cargar')))
    }
  }

  return (
    <div className="space-y-2" data-testid="dibujar-plano">
      <Button size="sm" variant="secondary" onClick={alternar} aria-expanded={abierto}>
        <LayoutGrid className="h-3.5 w-3.5" /> {abierto ? t('propuestas.plano.ocultar') : t('propuestas.plano.dibujar')}
      </Button>
      {abierto && (
        <div className="rounded-md border border-border bg-surface-2 p-3">
          {sitioIds.length === 0 ? (
            <p className="text-[12px] text-muted">{t('propuestas.plano.sin-sitios')}</p>
          ) : error ? (
            <p role="alert" className="text-[12px] text-error">{error}</p>
          ) : !datos ? (
            <p className="text-[12px] text-muted">{t('propuestas.plano.cargando')}</p>
          ) : (
            <PlanoVallas
              vallas={datos.vallas}
              grupos={datos.grupos}
              sitioIds={sitioIds}
              fechas={{ desde, hasta }}
              textoVacio={t('propuestas.plano.sin-vallas')}
            />
          )}
        </div>
      )}
    </div>
  )
}
