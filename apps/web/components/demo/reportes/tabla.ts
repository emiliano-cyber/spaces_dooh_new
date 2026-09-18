// Esqueleto en rojo.
import type { FilaRentabilidad } from '@/lib/data/reportes'
export type FilaOrdenable = Pick<
  FilaRentabilidad,
  'etiqueta' | 'ingreso' | 'costoEspacio' | 'costoOperacion' | 'costoTotal' | 'margen' | 'margenPct' | 'tieneContrato'
>
export type ColumnaReporte = keyof Omit<FilaOrdenable, 'tieneContrato'>
export type Direccion = 'asc' | 'desc'
export interface Orden {
  columna: ColumnaReporte
  direccion: Direccion
}
export const COLUMNAS: { clave: ColumnaReporte; label: string; numerica: boolean; direccionInicial: Direccion }[] = []
export const ORDEN_INICIAL: Orden = { columna: 'etiqueta', direccion: 'asc' }
export function ordenarFilas<T extends FilaOrdenable>(_filas: readonly T[], _orden: Orden): T[] {
  throw new Error('sin implementar')
}
export function siguienteOrden(_actual: Orden, _clic: ColumnaReporte): Orden {
  throw new Error('sin implementar')
}
export function formatoPorcentaje(_v: number | null): string {
  throw new Error('sin implementar')
}
export function advertenciasDelReporte(_filas: readonly FilaOrdenable[]): { sinContrato: number; sinIngreso: number } {
  throw new Error('sin implementar')
}
