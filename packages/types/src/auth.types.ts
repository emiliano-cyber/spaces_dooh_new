export type Permission =
  | 'sitios:read' | 'sitios:create' | 'sitios:edit'
  | 'contratos:read' | 'contratos:create' | 'contratos:edit'
  | 'incidencias:create' | 'incidencias:resolve'
  | 'campanas:read' | 'campanas:create' | 'campanas:confirm' | 'campanas:cancel'
  | 'campanas:readiness'
  | 'inventario:read' | 'inventario:read_costs'
  | 'ots:read' | 'ots:create' | 'ots:assign' | 'ots:complete'
  | 'traffic:read' | 'traffic:manage'
  | 'portal:manage'
  | 'users:read' | 'users:manage'
  | 'roles:read' | 'roles:manage'
  | 'tenant:manage'
  | 'audit:read'

export interface AuthUser {
  id: string
  tenantId: string
  rol: string
  permisos: Permission[]
  nombre?: string
  email?: string
}

export interface JWTPayload extends AuthUser {
  sub: string
  iat: number
  exp: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
