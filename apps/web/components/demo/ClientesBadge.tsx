import { Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTexto } from '@/lib/i18n/contexto'

// ADR 0008 · cupo de clientes de una pantalla: cuántos ANUNCIANTES distintos la
// comparten, contra el máximo que admite. Es un eje distinto del de slots
// (`SlotsBadge`): una pantalla puede tener slots libres y no admitir un cliente
// nuevo, o al revés. Por eso se pinta aparte y no se mezclan en un solo chip.
//
// Sin cupo configurado no se pinta nada: la regla nace apagada y un badge
// "3 clientes" sin límite a la vista solo sería ruido.
export function ClientesBadge({
  ocupados,
  cupo,
  className,
}: {
  ocupados: number
  cupo: number | null
  className?: string
}) {
  const t = useTexto()
  if (cupo == null) return null
  const libres = cupo - ocupados
  const tono = libres <= 0 ? 'lleno' : libres === 1 ? 'ultimo' : 'ok'
  const estilo = {
    ok: 'border-[#1da85040] bg-success-soft text-[#146c39]',
    ultimo: 'border-[#f59e0b40] bg-warning-soft text-[#9a6700]',
    lleno: 'border-[#dc262640] bg-error-soft text-[#b42318]',
  }[tono]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold leading-none',
        estilo,
        className,
      )}
      title={
        libres > 0
          ? t('operaciones.clientes-badge.libres', { libres, cupo })
          : t('operaciones.clientes-badge.lleno', { cupo })
      }
    >
      <Users className="h-3 w-3" strokeWidth={2} />
      <span className="demo-num">
        {ocupados}/{cupo}
      </span>
      {t('operaciones.clientes-badge.clientes')}
    </span>
  )
}
