'use client'

import { Stepper } from '@/components/demo/Stepper'
import { usePipeline } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'
import { CLAVE_ETAPA } from '@/components/demo/campanas/etiquetas'

// Render del pipeline de una campaña (sección 7.4). Reutilizado en el detalle
// interno (con S/) y en el portal del cliente (sin financieros).
export function PipelineView({
  campanaId,
  orientation = 'horizontal',
}: {
  campanaId: string
  orientation?: 'horizontal' | 'vertical'
}) {
  const p = usePipeline(campanaId)
  const { t, idioma } = useIdioma()
  if (!p) {
    return <div className="h-16 w-full animate-pulse rounded bg-surface-2" />
  }
  // I18N (lote shell, 2026-11-02) · la etiqueta de cada paso la arma
  // `usePipeline` con `ETAPA_LABEL` (espanol); en otro idioma, `CLAVE_ETAPA`
  // del lote de campanas, cuyo espanol ya esta atado a esa tabla.
  const pasos = idioma === 'es' ? p.pasos : p.pasos.map((x) => ({ ...x, label: t(CLAVE_ETAPA[x.key]) }))
  return <Stepper pasos={pasos} actualIndex={p.index} orientation={orientation} />
}
