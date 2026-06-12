'use client'

import { Stepper } from '@/components/demo/Stepper'
import { usePipeline } from '@/lib/data/client'

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
  if (!p) {
    return <div className="h-16 w-full animate-pulse rounded bg-surface-2" />
  }
  return <Stepper pasos={p.pasos} actualIndex={p.index} orientation={orientation} />
}
