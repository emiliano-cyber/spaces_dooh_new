// ============================================================================
//  Presentación de las CAPACIDADES para la matriz de roles (Bloque F).
//
//  Ojo: aquí NO vive ninguna copia del RBAC. Los módulos, roles y celdas de la
//  matriz se leen de la BD vía GET /api/admin/permisos-matriz (mismo origen que
//  exigir()). Este archivo solo tiene etiquetas de las cuatro capacidades, que
//  son puro texto de UI. La copia estática anterior (MATRIZ_PERMISOS,
//  MODULOS_PERMISO, ROLES_MATRIZ) se eliminó porque se desincronizó de la BD.
// ============================================================================

export type Capacidad = 'ver' | 'crear' | 'aprobar' | 'facturar'

// Orden en que se muestran las capacidades en cada celda / leyenda.
export const CAPACIDADES: Capacidad[] = ['ver', 'crear', 'aprobar', 'facturar']

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
