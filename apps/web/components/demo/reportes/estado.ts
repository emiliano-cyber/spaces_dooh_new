// Esqueleto en rojo.
import type { DimensionUI, FiltrosReporte } from './consulta'
export type FaseReporte = 'inicial' | 'cargando' | 'invalido' | 'sin-motor' | 'error' | 'vacio' | 'datos'
export interface RespuestaReporte {
  status: number
  mensaje: string | null
  filas: number
}
export interface EntradaEstado {
  motivoInvalido: string | null
  cargando: boolean
  dimension: DimensionUI
  respuesta: RespuestaReporte | null
}
export interface EstadoReporte {
  fase: FaseReporte
  mensaje: string | null
}
export function estadoDeReporte(_e: EntradaEstado): EstadoReporte {
  throw new Error('sin implementar')
}
export function debePedir(_f: FiltrosReporte): boolean {
  throw new Error('sin implementar')
}
