import { LIMITE_RAZON_SOCIAL } from '@/lib/cuestionario-entidades'

// ============================================================================
//  La lógica de la pantalla de razones sociales, FUERA del `.tsx`.
// ----------------------------------------------------------------------------
//  `vitest.config.ts` no monta jsdom, y lo dice en su propia cabecera: un
//  `.tsx` no se puede probar en este repositorio. Una decisión escrita dentro
//  de una pantalla no la prueba nadie, y aquí las decisiones son de identidad
//  fiscal: cuál es un duplicado, cuándo una razón social se puede guardar y qué
//  papeles del negocio se han quedado sin dueño. Equivocarse en eso no da
//  error: da rentas pagadas y comprobantes emitidos a nombre de quien no era.
//
//  Es el mismo molde que ya usan `components/demo/reportes/*.ts` y
//  `lib/cuestionario-entidades.ts`.
// ============================================================================

export interface EntidadUI {
  id: string
  razonSocial: string
  rfc: string | null
  regimen: string | null
  cpFiscal: string | null
  serieFolios: string | null
  roles: string[]
  activo: boolean
  creadoEn?: string | null
}

export interface BorradorEntidad {
  razonSocial: string
  rfc: string
  regimen: string
  cpFiscal: string
  serieFolios: string
  roles: string[]
}

export const BORRADOR_VACIO: BorradorEntidad = {
  razonSocial: '',
  rfc: '',
  regimen: '',
  cpFiscal: '',
  serieFolios: '',
  roles: [],
}

export { LIMITE_RAZON_SOCIAL }

export interface ContextoBorrador {
  /** Las que ya existen, INCLUIDAS las dadas de baja. */
  existentes: EntidadUI[]
  /** El id que se está editando, para que no choque consigo mismo. */
  editando?: string | null
  /** Los roles que la base admite, leídos del catálogo. */
  catalogo: string[]
}

export function loQueFaltaEnElBorrador(
  _borrador: BorradorEntidad,
  _ctx: ContextoBorrador,
): string | null {
  return null
}

export function entidadesOrdenadas(_entidades: EntidadUI[]): EntidadUI[] {
  return []
}

export function rolesSinDueno(_entidades: EntidadUI[], _catalogo: string[]): string[] {
  return []
}

export function rolesCompartidos(_entidades: EntidadUI[], _catalogo: string[]): string[] {
  return []
}
