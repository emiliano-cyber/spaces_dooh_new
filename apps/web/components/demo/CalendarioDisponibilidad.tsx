'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

// ============================================================================
//  CalendarioDisponibilidad — grilla mensual que pinta los días según reservas
//  vs confirmaciones de un sitio (sección 7.3). Sin librerías de fecha.
// ============================================================================

export interface RangoOcupacion {
  fechaInicio: string
  fechaFin: string
  estatus: 'CONFIRMADA' | 'TENTATIVA'
  etiqueta?: string
}

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function ymd(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function CalendarioDisponibilidad({
  rangos,
  className,
}: {
  rangos: RangoOcupacion[]
  className?: string
}) {
  const hoy = new Date()
  const [offset, setOffset] = useState(0)
  const base = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1)
  const year = base.getFullYear()
  const month = base.getMonth()

  const primerDia = new Date(year, month, 1)
  // Lunes = 0
  const arranque = (primerDia.getDay() + 6) % 7
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const hoyNum = ymd(hoy)

  const celdas: (number | null)[] = []
  for (let i = 0; i < arranque; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  function estadoDia(dia: number): 'CONFIRMADA' | 'TENTATIVA' | null {
    const num = year * 10000 + (month + 1) * 100 + dia
    let estado: 'CONFIRMADA' | 'TENTATIVA' | null = null
    for (const r of rangos) {
      const ini = ymd(new Date(r.fechaInicio))
      const fin = ymd(new Date(r.fechaFin))
      if (num >= ini && num <= fin) {
        if (r.estatus === 'CONFIRMADA') return 'CONFIRMADA'
        estado = 'TENTATIVA'
      }
    }
    return estado
  }

  return (
    <div className={cn('rounded-md border border-border bg-surface p-3', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted hover:bg-surface-2"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium capitalize text-ink">
          {MESES[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted hover:bg-surface-2"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-medium text-muted">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const est = estadoDia(dia)
          const num = year * 10000 + (month + 1) * 100 + dia
          const esHoy = num === hoyNum
          return (
            <div
              key={i}
              className={cn(
                'demo-num flex h-8 items-center justify-center rounded text-[12px]',
                est === 'CONFIRMADA' && 'bg-[#10b9811a] text-[#0f7a55]',
                est === 'TENTATIVA' && 'bg-[#f59e0b1a] text-[#9a6700]',
                !est && 'text-ink',
                esHoy && 'ring-1 ring-accent',
              )}
            >
              {dia}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#10b981]" /> confirmada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" /> tentativa
        </span>
      </div>
    </div>
  )
}
