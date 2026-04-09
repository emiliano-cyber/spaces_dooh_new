export interface ReadinessStatus {
  listaParaFacturar: boolean
  tipoCampana: string
  items: {
    ocRecibida: { ok: boolean; url?: string }
    fotosComprobatorias: { ok: boolean; cantidad: number }
    reportePublicacion: { ok: boolean; url?: string }
    otCompletada: { ok: boolean; otId?: string; requerida: boolean }
    trafficFinalizado: { ok: boolean; toId?: string; requerido: boolean }
  }
}
