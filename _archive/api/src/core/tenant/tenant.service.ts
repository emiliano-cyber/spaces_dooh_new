import { publicPrisma } from '../../db/client'

export interface TenantInfo {
  id: string
  nombre: string
  subdominioBase: string
  dbSchema: string
  plan: string
  activo: boolean
  config: unknown
  creadoEn: Date
}

/**
 * Resolve a tenant by subdomain slug.
 * Returns null if the tenant does not exist or is inactive.
 */
export async function getBySlug(slug: string): Promise<TenantInfo | null> {
  const tenant = await publicPrisma.tenant.findUnique({
    where: { subdominioBase: slug },
  })
  if (!tenant || !tenant.activo) return null
  return tenant
}

/**
 * Resolve a tenant by its internal ID.
 */
export async function getById(id: string): Promise<TenantInfo | null> {
  return publicPrisma.tenant.findUnique({ where: { id } }) as Promise<TenantInfo | null>
}

/**
 * Extract the tenant slug from a hostname.
 * e.g. 'comercial.westmedia.spaces.com' → 'westmedia'
 *      'westmedia.spaces.com'           → 'westmedia'
 */
export function extractSlug(host: string): string | null {
  const parts = host.split('.')
  if (parts.length >= 4) return parts[1]
  if (parts.length === 3) return parts[0]
  return null
}

/**
 * Update mutable tenant fields (nombre, config).
 */
export async function update(
  id: string,
  data: { nombre?: string; config?: Record<string, unknown> },
): Promise<TenantInfo> {
  return publicPrisma.tenant.update({ where: { id }, data: data as any }) as Promise<TenantInfo>
}
