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
  sovPorcentaje?: number
  tipoVenta: string
}

export interface DeliveryReport {
  trafficOrderId: string
  referenciaExterna: string
  totalImpresiones?: number
  totalSpotsEjecutados?: number
  totalSegundos?: number
  cpmReal?: number
  reporteUrl?: string
  rawData?: unknown
}

export interface CMSConnector {
  tipo: string
  publish(instruction: TrafficInstruction): Promise<{ referenciaExterna: string }>
  pause(referenciaExterna: string): Promise<void>
  resume(referenciaExterna: string): Promise<void>
  cancel(referenciaExterna: string): Promise<void>
  getDeliveryReport(
    referenciaExterna: string,
    periodo: { inicio: Date; fin: Date }
  ): Promise<DeliveryReport>
  healthCheck(): Promise<boolean>
}
