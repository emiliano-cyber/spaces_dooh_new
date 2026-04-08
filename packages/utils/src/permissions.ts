import type { Permission, AuthUser } from '@spaces-dooh/types'

export const BUILTIN_ROLES: Record<string, (Permission | '*')[]> = {
  owner: ['*'],
  admin: ['*'],
  inmuebles_manager: [
    'sitios:read', 'sitios:create', 'sitios:edit',
    'contratos:read', 'contratos:create', 'contratos:edit',
    'incidencias:create', 'incidencias:resolve',
  ],
  operaciones_manager: ['ots:read', 'ots:create', 'ots:assign', 'ots:complete', 'sitios:read'],
  comercial_manager: [
    'campanas:read', 'campanas:create', 'campanas:confirm', 'campanas:cancel',
    'inventario:read', 'inventario:read_costs', 'campanas:readiness', 'portal:manage',
  ],
  seller: ['campanas:read', 'campanas:create', 'inventario:read'],
  trafficker: ['traffic:read', 'traffic:manage', 'campanas:read'],
  crew_chief: ['ots:read', 'ots:complete'],
  field_worker: ['ots:read', 'ots:complete'],
  auditor: ['sitios:read', 'campanas:read', 'ots:read', 'audit:read'],
}

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  if (user.rol === 'owner' || user.rol === 'admin') return true
  if ((user.permisos as string[]).includes('*')) return true
  return user.permisos.includes(permission)
}
