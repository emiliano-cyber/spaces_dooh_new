export interface ReadinessItem {
  ok: boolean
  url?: string
  cantidad?: number
  otId?: string
  toId?: string
  requerida?: boolean
  requerido?: boolean
}

export interface ReadinessItems {
  ocRecibida: ReadinessItem
  fotosComprobatorias: ReadinessItem & { cantidad: number }
  reportePublicacion: ReadinessItem
  otCompletada: ReadinessItem & { requerida: boolean }
  trafficFinalizado: ReadinessItem & { requerido: boolean }
}

export interface ReadinessStatus {
  listaParaFacturar: boolean
  tipoCampana: string
  campanaId?: string
  tenantId?: string
  items: ReadinessItems
}

export interface PortalEtapa {
  label: string
  completado: boolean
  fecha?: string
}

export interface PortalCampana {
  folio: string
  nombre: string
  clienteNombre: string
  estadoComercial: string
  tipoCampana: string
  fechaInicio: string
  fechaFin: string
  etapas: PortalEtapa[]
}
