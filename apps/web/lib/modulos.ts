// ============================================================================
//  lib/modulos.ts — Qué área de la interfaz gobierna cada módulo de permiso.
// ----------------------------------------------------------------------------
//  ADR 0010. La matriz de Administración mostraba 8 módulos y parecía completa,
//  pero el producto tiene 17 áreas: marcar `comercial` abría además Clientes,
//  Propuestas y Campañas sin que nada lo dijera. Quien administra permisos no
//  tenía forma de saber qué estaba concediendo.
//
//  La unidad de autorización SIGUE siendo el módulo — esto no añade permisos
//  nuevos, solo deja de esconder qué abre cada casilla.
//
//  Sobre `apiPropia`: cuatro áreas (Disponibilidad, Creativos, Comisiones,
//  Actividad) no tienen endpoints propios; leen todo de `/api/estado`. Su
//  entrada aquí sirve para decir de quién dependen, pero ocultarles el menú NO
//  protegería el dato — lo protege el permiso con el que `/api/estado` filtra.
//  Se marca explícitamente para que nadie confunda «no aparece en el menú» con
//  «está protegido».
// ============================================================================

export interface AreaProducto {
  clave: string
  label: string
  // Módulo de `rol_permisos` que la autoriza.
  modulo: string
  // ¿Tiene endpoints propios bajo /api? Si no, se sirve de /api/estado.
  apiPropia: boolean
}

export const AREAS: AreaProducto[] = [
  { clave: 'dashboard', label: 'Dashboard', modulo: 'dashboard', apiPropia: false },
  { clave: 'comercial', label: 'Comercial', modulo: 'comercial', apiPropia: true },
  { clave: 'clientes', label: 'Clientes', modulo: 'comercial', apiPropia: true },
  { clave: 'propuestas', label: 'Propuestas', modulo: 'comercial', apiPropia: true },
  { clave: 'campanas', label: 'Campañas', modulo: 'comercial', apiPropia: true },
  { clave: 'disponibilidad', label: 'Disponibilidad', modulo: 'comercial', apiPropia: false },
  { clave: 'creativos', label: 'Creativos', modulo: 'comercial', apiPropia: false },
  { clave: 'comisiones', label: 'Comisiones', modulo: 'comercial', apiPropia: false },
  { clave: 'inventario', label: 'Inventario', modulo: 'inventario', apiPropia: true },
  { clave: 'arrendadores', label: 'Arrendadores', modulo: 'arrendadores', apiPropia: true },
  { clave: 'operaciones', label: 'Operaciones', modulo: 'operaciones', apiPropia: true },
  { clave: 'almacen', label: 'Almacén', modulo: 'operaciones', apiPropia: true },
  { clave: 'imprenta', label: 'Imprenta', modulo: 'imprenta', apiPropia: true },
  { clave: 'finanzas', label: 'Finanzas', modulo: 'finanzas', apiPropia: true },
  { clave: 'network', label: 'Network', modulo: 'network', apiPropia: true },
  { clave: 'integraciones', label: 'Integraciones', modulo: 'administracion', apiPropia: true },
  { clave: 'actividad', label: 'Actividad', modulo: 'administracion', apiPropia: false },
  { clave: 'administracion', label: 'Administración', modulo: 'administracion', apiPropia: true },
]

// Áreas que abre un módulo dado, para explicarlo junto a la casilla.
export function areasDeModulo(modulo: string): AreaProducto[] {
  return AREAS.filter((a) => a.modulo === modulo)
}

// Los módulos que el producto usa de verdad, en orden de presentación. Sale del
// catálogo y no de una lista aparte: dos listas divergen, una no puede.
export const MODULOS: string[] = AREAS.reduce<string[]>((acc, a) => {
  if (!acc.includes(a.modulo)) acc.push(a.modulo)
  return acc
}, [])
