// Esqueleto: las firmas existen para que las pruebas CORRAN y fallen por lo que
// afirman, no por un modulo que no se encuentra. La implementacion va aparte.
export const LIMITE_RAZON_SOCIAL = 200
export interface RolCatalogo { rol: string; etiqueta: string }
export interface RespuestasCuestionario {
  variasRazonesSociales?: boolean | null
  operacionYVentasJuntas?: boolean | null
  razonSocialUnica?: string | null
  razonSocialPorRol?: Record<string, string | null | undefined> | null
}
export interface EntidadPlaneada { razonSocial: string; roles: string[] }
export type PlanCuestionario =
  | { ok: true; entidades: EntidadPlaneada[] }
  | { ok: false; error: string }
export interface CampoPaso3 { clave: string; roles: string[]; etiqueta: string }
export interface EntidadConRoles { id: string; razonSocial: string; roles: string[]; activo?: boolean }

export function claveRazonSocial(_v: string): string { throw new Error('sin implementar') }
export function planDelCuestionario(
  _r: RespuestasCuestionario, _catalogo: string[],
): PlanCuestionario { throw new Error('sin implementar') }
export function camposDelPaso3(
  _r: RespuestasCuestionario, _catalogo: RolCatalogo[],
): CampoPaso3[] { throw new Error('sin implementar') }
export function faltaContestarCuestionario(_total: number | null | undefined): boolean {
  throw new Error('sin implementar')
}
export function emisorPorOmision<T extends EntidadConRoles>(
  _entidades: T[] | null | undefined, _rol: string,
): T | null { throw new Error('sin implementar') }
export function resumenParaBitacora(_entidades: EntidadPlaneada[]): string {
  throw new Error('sin implementar')
}
