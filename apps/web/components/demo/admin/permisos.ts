// ============================================================================
//  Presentación de las CAPACIDADES para la matriz de roles (Bloque F).
//
//  Ojo: aquí NO vive ninguna copia del RBAC. Los módulos, roles y celdas de la
//  matriz se leen de la BD vía GET /api/admin/permisos-matriz (mismo origen que
//  exigir()). Este archivo solo tiene etiquetas de las cuatro capacidades, que
//  son puro texto de UI. La copia estática anterior (MATRIZ_PERMISOS,
//  MODULOS_PERMISO, ROLES_MATRIZ) se eliminó porque se desincronizó de la BD.
// ============================================================================

// ⚠️ ESTA LISTA TIENE QUE CUBRIR TODA ACCIÓN QUE LA API EXIJA, y no es una
// preferencia de presentación: la pantalla de Administración pinta las celdas
// con `CAPACIDADES.filter(...)`, así que una acción que falte aquí **no se ve en
// la matriz**. El Dueño miraría `operaciones: V C A`, no habría ni rastro de que
// existe otra, y no tendría forma de saber que la está concediendo o negando.
//
// Es exactamente la trampa del ADR 0010 —un permiso que existe y nada lo
// muestra— con el signo cambiado. Lo caza `lib/rbac-coherencia.test.ts`, que
// compara esta lista contra los `exigir(...)` reales de los `route.ts`.
export type Capacidad = 'ver' | 'crear' | 'aprobar' | 'facturar' | 'costear'

// Orden en que se muestran las capacidades en cada celda / leyenda.
export const CAPACIDADES: Capacidad[] = ['ver', 'crear', 'aprobar', 'facturar', 'costear']

export const CAP_LABEL: Record<Capacidad, string> = {
  ver: 'Ver',
  crear: 'Crear',
  aprobar: 'Aprobar',
  facturar: 'Facturar',
  // 2026-09-29 · capturar el costo REAL de una orden de trabajo, y nada más.
  // Existe separada de `Crear` porque `Crear` en Operaciones es crear y CERRAR
  // órdenes: quien paga la factura de la cuadrilla no tiene por qué poder eso.
  costear: 'Costear',
}
export const CAP_CORTA: Record<Capacidad, string> = {
  ver: 'V',
  crear: 'C',
  aprobar: 'A',
  facturar: 'F',
  // `$` y no una letra: las cuatro de siempre son la inicial de su nombre y
  // «C» ya es Crear. Una segunda «C» en la misma celda sería ilegible justo
  // donde se reparte quién toca el dinero.
  costear: '$',
}
