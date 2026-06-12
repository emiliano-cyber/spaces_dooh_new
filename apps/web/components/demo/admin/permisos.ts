import type { RolDemo } from '@/lib/data/types'

// ============================================================================
//  Matriz de roles × módulos (read-only). Es la foto visual del RBAC sin
//  construirlo: qué puede hacer cada rol en cada módulo.
// ============================================================================

export type Capacidad = 'ver' | 'crear' | 'aprobar' | 'facturar'

export const CAP_LABEL: Record<Capacidad, string> = {
  ver: 'Ver',
  crear: 'Crear',
  aprobar: 'Aprobar',
  facturar: 'Facturar',
}
export const CAP_CORTA: Record<Capacidad, string> = {
  ver: 'V',
  crear: 'C',
  aprobar: 'A',
  facturar: 'F',
}

export interface ModuloPermiso {
  key: string
  label: string
}

export const MODULOS_PERMISO: ModuloPermiso[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'arrendadores', label: 'Arrendadores' },
  { key: 'operaciones', label: 'Operaciones' },
  { key: 'imprenta', label: 'Imprenta' },
  { key: 'finanzas', label: 'Finanzas' },
  { key: 'administracion', label: 'Administración' },
]

// Columnas de la matriz: roles internos (el Cliente externo solo ve su portal).
export const ROLES_MATRIZ: { rol: RolDemo; label: string }[] = [
  { rol: 'DUENO', label: 'Dueño' },
  { rol: 'COMERCIAL', label: 'Comercial' },
  { rol: 'OPERACIONES', label: 'Operaciones' },
  { rol: 'IMPRENTA', label: 'Imprenta' },
  { rol: 'FINANZAS', label: 'Finanzas' },
]

// matriz[moduloKey][rol] = capacidades permitidas
export const MATRIZ_PERMISOS: Record<string, Partial<Record<RolDemo, Capacidad[]>>> = {
  dashboard: { DUENO: ['ver'], COMERCIAL: ['ver'], FINANZAS: ['ver'] },
  comercial: { DUENO: ['ver', 'crear', 'aprobar'], COMERCIAL: ['ver', 'crear'], OPERACIONES: ['ver'] },
  arrendadores: { DUENO: ['ver', 'crear', 'aprobar'] },
  operaciones: { DUENO: ['ver', 'aprobar'], OPERACIONES: ['ver', 'crear'], IMPRENTA: ['ver'] },
  imprenta: { DUENO: ['ver', 'aprobar'], IMPRENTA: ['ver', 'crear'], OPERACIONES: ['ver'] },
  finanzas: { DUENO: ['ver', 'facturar'], FINANZAS: ['ver', 'crear', 'facturar'] },
  administracion: { DUENO: ['ver', 'crear', 'aprobar'] },
}
