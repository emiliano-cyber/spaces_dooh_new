import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/cn'

// Indicador destacado de slots de una pantalla digital. Con `disponibles` colorea
// según cuántos quedan (verde = holgado, ámbar = pocos, rojo = lleno); sin él
// muestra solo la capacidad (dato de la pantalla) en azul. 1 slot = 1 campaña.
export function SlotsBadge({
  disponibles,
  total,
  className,
}: {
  disponibles?: number | null
  total: number | null
  className?: string
}) {
  if (total == null) return null
  const disp = disponibles ?? null
  const tono =
    disp == null
      ? 'capacidad'
      : disp <= 0
        ? 'lleno'
        : disp <= Math.max(1, Math.ceil(total / 3))
          ? 'pocos'
          : 'ok'
  const estilo = {
    ok: 'border-[#1da85040] bg-success-soft text-[#146c39]',
    pocos: 'border-[#f59e0b40] bg-warning-soft text-[#9a6700]',
    lleno: 'border-[#dc262640] bg-error-soft text-[#b42318]',
    capacidad: 'border-accent/30 bg-accent-soft text-[#0a4fcc]',
  }[tono]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold leading-none',
        estilo,
        className,
      )}
      title={disp != null ? `${disp} de ${total} slots libres` : `${total} slots`}
    >
      <LayoutGrid className="h-3 w-3" strokeWidth={2} />
      <span className="demo-num">{disp != null ? `${disp}/${total}` : total}</span>
      slots
    </span>
  )
}
