export type EstadoTecnicoTO =
  | 'PENDIENTE'
  | 'EN_TRAFICO'
  | 'ACTIVA'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'CANCELADA'

export type ConnectorTipo = 'MANUAL' | 'DOOHMAIN' | 'BROADSIGN' | 'INVIAN'

export interface TrafficOrder {
  id: string
  folio: string
  campanaId: string
  campaignLineId?: string
  connectorTipo: ConnectorTipo
  estadoTecnico: EstadoTecnicoTO
  referenciaExterna?: string
  deliveryUrl?: string
  deliveryKey?: string
  instruccionJson?: Record<string, unknown>
  notas?: string
  creadoEn: string
  actualizadoEn: string
}

export interface TrafficInstruction {
  campanaId: string
  trafficOrderId: string
  campanaFolio: string
  clienteNombre: string
  pantallasExternas: string[]
  creatividades: Array<{
    url: string
    storageKey: string
    formato: string
    duracionSeg: number
    resolucion: string
  }>
  horario: {
    fechaInicio: Date
    fechaFin: Date
    horaInicio?: string
    horaFin?: string
    diasSemana?: number[]
  }
  prioridad: number
  tipoVenta: string
}
