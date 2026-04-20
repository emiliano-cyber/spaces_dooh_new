export type PlanTipo = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

export interface Tenant {
  id: string
  nombre: string
  subdominioBase: string
  dbSchema: string
  plan: PlanTipo
  activo: boolean
  config: TenantConfig
  creadoEn: string
}

export interface TenantConfig {
  logoUrl?: string
  colorPrimario?: string
  monedaDefault?: string
  zonaHoraria?: string
  emailNotificaciones?: string
  portalPublico?: boolean
}

export interface TenantUser {
  id: string
  tenantId: string
  nombre: string
  email: string
  rolId: string
  activo: boolean
  creadoEn: string
}

export interface Role {
  id: string
  nombre: string
  descripcion?: string
  builtin: boolean
  permisos: string[]
}

export interface ConnectorStatus {
  tipo: 'DOOHMAIN' | 'BROADSIGN' | 'INVIAN' | 'MANUAL'
  activo: boolean
  configurado: boolean
  apiKeyMasked: string | null
  baseUrl: string | null
}
