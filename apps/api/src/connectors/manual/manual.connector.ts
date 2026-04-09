import type { CMSConnector, DeliveryReport, TrafficInstruction } from '../connector.interface'

export class ManualConnector implements CMSConnector {
  readonly tipo = 'MANUAL'

  async publish(instruction: TrafficInstruction): Promise<{ referenciaExterna: string }> {
    const referenciaExterna = `MANUAL-${Date.now()}`
    console.log(
      `[ManualConnector] Instrucción registrada: ${instruction.campanaFolio} — ejecutar manualmente en CMS`
    )
    return { referenciaExterna }
  }

  async pause(referenciaExterna: string): Promise<void> {
    console.log(`[ManualConnector] PAUSA pendiente — ejecutar en CMS: ${referenciaExterna}`)
  }

  async resume(referenciaExterna: string): Promise<void> {
    console.log(`[ManualConnector] RESUME pendiente — ejecutar en CMS: ${referenciaExterna}`)
  }

  async cancel(referenciaExterna: string): Promise<void> {
    console.log(`[ManualConnector] CANCELACIÓN pendiente — ejecutar en CMS: ${referenciaExterna}`)
  }

  async getDeliveryReport(
    referenciaExterna: string,
    _periodo: { inicio: Date; fin: Date }
  ): Promise<DeliveryReport> {
    return {
      trafficOrderId: '',
      referenciaExterna,
      totalImpresiones: 0,
      totalSpotsEjecutados: 0,
      totalSegundos: 0,
      cpmReal: 0,
      reporteUrl: undefined,
      rawData: null,
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}
