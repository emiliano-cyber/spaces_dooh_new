// Esqueleto en rojo: las firmas que las pruebas fijan, sin comportamiento.
export type DimensionUI = 'sitio' | 'trimestre' | 'operacion' | 'm2'
export type GranularidadUI = 'mes' | 'trimestre'
export interface FiltrosReporte {
  dimension: DimensionUI
  granularidad: GranularidadUI
  desde: string
  hasta: string
}
export const RUTA_RENTABILIDAD = ''
export const DIMENSIONES_UI: { valor: DimensionUI; label: string; ayuda: string; conMotor: boolean }[] = []
export const GRANULARIDADES_UI: { valor: GranularidadUI; label: string }[] = []
export function construirConsulta(_f: FiltrosReporte): string {
  throw new Error('sin implementar')
}
export function etiquetaDimension(_d: DimensionUI): string {
  throw new Error('sin implementar')
}
export function motivoInvalido(_f: FiltrosReporte): string | null {
  throw new Error('sin implementar')
}
export function rangoDelTrimestreDe(_hoy: Date): { desde: string; hasta: string } {
  throw new Error('sin implementar')
}
