import type { CMSConnector } from './connector.interface'
import { ManualConnector } from './manual/manual.connector'
import { DoohmainConnector } from './doohmain/doohmain.connector'
import { BroadsignConnector } from './broadsign/broadsign.connector'
import { InvianConnector } from './invian/invian.connector'

export class ConnectorRegistry {
  private connectors = new Map<string, CMSConnector>()

  register(tipo: string, connector: CMSConnector): void {
    this.connectors.set(tipo, connector)
  }

  get(tipo: string): CMSConnector {
    const connector = this.connectors.get(tipo)
    if (!connector) {
      console.warn(`[ConnectorRegistry] Conector '${tipo}' no encontrado, usando MANUAL`)
      return this.connectors.get('MANUAL')!
    }
    return connector
  }

  static fromTenantConfig(configs: Array<{
    tipo: string
    activo: boolean
    credencialesEnc: string
  }>): ConnectorRegistry {
    const registry = new ConnectorRegistry()
    registry.register('MANUAL', new ManualConnector())

    for (const config of configs) {
      if (!config.activo) continue
      let creds: { apiKey: string; baseUrl: string }
      try {
        creds = JSON.parse(
          Buffer.from(config.credencialesEnc, 'base64').toString('utf8')
        )
      } catch {
        console.error(`[ConnectorRegistry] Error al parsear credenciales de ${config.tipo}`)
        continue
      }
      if (config.tipo === 'DOOHMAIN') {
        registry.register('DOOHMAIN', new DoohmainConnector(creds))
      }
      if (config.tipo === 'BROADSIGN') {
        registry.register('BROADSIGN', new BroadsignConnector(creds))
      }
      if (config.tipo === 'INVIAN') {
        registry.register('INVIAN', new InvianConnector(creds))
      }
    }
    return registry
  }
}
