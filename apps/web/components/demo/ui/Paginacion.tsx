'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ============================================================================
//  Paginacion — recorte de listas largas + su control.
// ----------------------------------------------------------------------------
//  M7 de la auditoría del 04/08/2026: Actividad pintaba sus 168 entradas de una
//  vez y los pagos de renta 30+ filas programadas hasta 2027. No es solo ruido
//  visual: cada fila de esas tablas monta varios nodos, así que el coste crece
//  con datos que solo van a crecer más.
//
//  Se pagina en vez de virtualizar a propósito. Virtualizar rinde más con miles
//  de filas, pero mete scroll sintético, rompe Ctrl+F del navegador y complica
//  imprimir — y aquí hablamos de cientos, no de miles. Paginar es lo que la
//  tabla necesita y lo que el usuario ya sabe usar.
//
//  La página se reinicia sola cuando cambia el número de elementos: si estás en
//  la página 4 y un filtro deja 12 resultados, quedarte en la 4 muestra una
//  tabla vacía y parece que no hay datos.
// ============================================================================

export function usePaginacion<T>(items: T[], porPagina = 25) {
  const [pagina, setPagina] = useState(1)
  const total = items.length
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  // `pagina` puede haber quedado fuera de rango tras filtrar; se acota al leer
  // en vez de con un efecto, así no hay un render intermedio en blanco.
  const actual = Math.min(pagina, paginas)
  const visibles = useMemo(
    () => items.slice((actual - 1) * porPagina, actual * porPagina),
    [items, actual, porPagina],
  )
  return {
    visibles,
    pagina: actual,
    paginas,
    total,
    desde: total === 0 ? 0 : (actual - 1) * porPagina + 1,
    hasta: Math.min(actual * porPagina, total),
    irA: (p: number) => setPagina(Math.min(Math.max(1, p), paginas)),
  }
}

export function Paginacion({
  pagina, paginas, desde, hasta, total, irA, etiqueta = 'registros',
}: {
  pagina: number
  paginas: number
  desde: number
  hasta: number
  total: number
  irA: (p: number) => void
  etiqueta?: string
}) {
  // Con una sola página no se pinta nada: un control de paginación que no
  // pagina es ruido, y encima sugiere que hay más datos de los que hay.
  if (paginas <= 1) return null
  const btn =
    'inline-flex h-8 items-center gap-1 rounded border border-border-strong bg-surface px-2.5 text-[12px] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
      <span className="text-[12px] text-muted">
        <span className="demo-num text-ink">{desde}–{hasta}</span> de{' '}
        <span className="demo-num text-ink">{total}</span> {etiqueta}
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => irA(pagina - 1)} disabled={pagina <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <span className="demo-num px-1 text-[12px] text-muted">{pagina} / {paginas}</span>
        <button type="button" className={btn} onClick={() => irA(pagina + 1)} disabled={pagina >= paginas}>
          Siguiente <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
