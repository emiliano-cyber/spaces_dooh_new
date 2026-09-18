import 'server-only'
import type { RolCatalogo, EntidadConRoles } from '@/lib/cuestionario-entidades'

export interface ResultadoCuestionario { entidades: EntidadConRoles[]; resumen: string }
export interface EstadoCuestionario {
  pendiente: boolean
  totalEntidades: number
  roles: RolCatalogo[]
  entidades: EntidadConRoles[]
}
export async function contestarCuestionarioCtrl(_body: unknown): Promise<ResultadoCuestionario> {
  throw new Error('sin implementar')
}
export async function estadoCuestionarioCtrl(): Promise<EstadoCuestionario> {
  throw new Error('sin implementar')
}
