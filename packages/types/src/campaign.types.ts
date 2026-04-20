export type TipoCampana = 'OOH' | 'DOOH' | 'HIBRIDA'
export type EstadoComercial =
  | 'DRAFT'
  | 'COTIZACION'
  | 'CONFIRMADA'
  | 'ACTIVA'
  | 'LISTA_FACTURAR'
  | 'COMPLETADA'
  | 'CANCELADA'

export type TipoVenta =
  | 'SPOT_UNIT'
  | 'DAY_PACK'
  | 'HOUR_PACK'
  | 'SOV'
  | 'TAKEOVER'
  | 'FIXED_PKG'
  | 'PROG_DIRECT'
  | 'PROG_PMP'
  | 'PROG_OPEN'
  | 'MAKEGOOD'
  | 'HOUSE_AD'

export interface Campana {
  id: string
  folio: string
  nombre: string
  clienteId: string
  tipoCampana: TipoCampana
  estadoComercial: EstadoComercial
  fechaInicio: string
  fechaFin: string
  presupuestoBruto?: number
  presupuestoNeto?: number
  moneda: string
  notas?: string
  ocRecibida: boolean
  fotosComprobatorias: boolean
  reportePublicacion: boolean
  portalToken?: string
  portalActivo: boolean
  creadoEn: string
  actualizadoEn: string
}

export interface CampanaLine {
  id: string
  campanaId: string
  sitioId: string
  pantallasIds: string[]
  fechaInicio: string
  fechaFin: string
  tipoVenta: TipoVenta
  precio: number
  cantidad: number
  unidad: string
  duracionSpot?: number
  frecuencia?: number
  estatus: string
  creadoEn: string
}

export interface CreateCampanaInput {
  nombre: string
  clienteId: string
  agencia?: string
  marca?: string
  tipoCampana: TipoCampana
  fechaInicio: string
  fechaFin: string
  presupuestoBruto?: number
  moneda?: string
  notas?: string
}

export interface CreateCampanaLineInput {
  sitioId: string
  fechaInicio: string
  fechaFin: string
  tipoVenta: TipoVenta
  precio: number
  cantidad?: number
  unidad?: string
  duracionSpot?: number
  frecuencia?: number
  pantallasIds?: string[]
}
