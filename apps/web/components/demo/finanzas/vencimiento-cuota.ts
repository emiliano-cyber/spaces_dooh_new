import type { EstCobranza } from '@/lib/data/types'

// ============================================================================
//  La etiqueta junto a la fecha de vencimiento de una cuota de cobranza.
// ----------------------------------------------------------------------------
//  Vive aparte de la página para poder probarla sin DOM. Hasta el 06/10 la
//  celda decidía con la FECHA sola y pintaba «(12d vencida)» en rojo en una
//  cuota ya PAGADA, al lado de su insignia «Pagada». El estado de la cuota
//  manda: los días solo importan mientras se debe algo.
// ============================================================================

export type TonoVencimiento = 'error' | 'warning' | 'muted'

export function etiquetaVencimiento(
  estado: EstCobranza,
  dias: number,
): { texto: string; tono: TonoVencimiento } {
  if (estado === 'PAGADA') return { texto: 'pagada', tono: 'muted' }
  if (dias < 0) return { texto: `${Math.abs(dias)}d vencida`, tono: 'error' }
  return { texto: `${dias}d`, tono: dias <= 30 ? 'warning' : 'muted' }
}
