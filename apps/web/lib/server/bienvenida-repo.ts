import 'server-only'
import type { EntidadPlaneada, RolCatalogo, EntidadConRoles } from '@/lib/cuestionario-entidades'

export type AltaCuestionario =
  | { ok: true; entidades: EntidadConRoles[] }
  | { ok: false; yaHabia: number }

export async function catalogoRolesConEtiqueta(): Promise<RolCatalogo[]> {
  throw new Error('sin implementar')
}
export async function contarEntidadesDelTenant(): Promise<number> {
  throw new Error('sin implementar')
}
export async function listarEntidadesConRoles(): Promise<EntidadConRoles[]> {
  throw new Error('sin implementar')
}
export async function crearEntidadesDelCuestionario(
  _plan: EntidadPlaneada[],
): Promise<AltaCuestionario> { throw new Error('sin implementar') }
