import type { CMSConnector, DeliveryReport, TrafficInstruction } from '../connector.interface'

export class DoohmainConnector implements CMSConnector {
  readonly tipo = 'DOOHMAIN'

  constructor(private readonly config: { apiKey: string; baseUrl: string }) {}

  async publish(_instruction: TrafficInstruction): Promise<{ referenciaExterna: string }> {
    console.log('[DoohmainConnector] publish() — pendiente de implementación con credenciales reales')
    throw new Error('DoohmainConnector: credenciales no configuradas')
  }

  async pause(_referenciaExterna: string): Promise<void> {
    console.log('[DoohmainConnector] pause() — pendiente de implementación con credenciales reales')
    throw new Error('DoohmainConnector: credenciales no configuradas')
  }

  async resume(_referenciaExterna: string): Promise<void> {
    console.log('[DoohmainConnector] resume() — pendiente de implementación con credenciales reales')
    throw new Error('DoohmainConnector: credenciales no configuradas')
  }

  async cancel(_referenciaExterna: string): Promise<void> {
    console.log('[DoohmainConnector] cancel() — pendiente de implementación con credenciales reales')
    throw new Error('DoohmainConnector: credenciales no configuradas')
  }

  async getDeliveryReport(
    _referenciaExterna: string,
    _periodo: { inicio: Date; fin: Date }
  ): Promise<DeliveryReport> {
    console.log('[DoohmainConnector] getDeliveryReport() — pendiente de implementación con credenciales reales')
    throw new Error('DoohmainConnector: credenciales no configuradas')
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      await fetch(`${this.config.baseUrl}/health`, { signal: controller.signal })
      clearTimeout(timeout)
      return true
    } catch {
      return false
    }
  }
}
