'use client'

import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/demo/EmptyState'
import { useTexto } from '@/lib/i18n/contexto'

// Placeholder de módulo aún no construido. Mantiene la navegación del shell sin
// pantallas en blanco ni 404 mientras avanzan las fases.
export function ModuloPlaceholder({
  titulo,
  subtitulo,
  icon,
  fase,
}: {
  titulo: string
  subtitulo: string
  icon: LucideIcon
  fase: string
}) {
  const t = useTexto()
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl text-ink">{titulo}</h1>
        <p className="mt-1 text-[13px] text-muted">{subtitulo}</p>
      </div>
      <EmptyState
        icon={icon}
        titulo={t('shell.placeholder.titulo', { fase })}
        detalle={t('shell.placeholder.detalle')}
      />
    </div>
  )
}
