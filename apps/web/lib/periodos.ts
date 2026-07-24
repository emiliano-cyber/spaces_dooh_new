// ============================================================================
//  lib/periodos.ts — Contratación por tiempo: cuántos periodos de una unidad
//  caben en un rango, y el precio resultante. Módulo PURO (sin estado, sin
//  server-only) para que la UI (preview) y el servidor (autoridad) calculen
//  EXACTAMENTE igual.
//
//  Convención de equivalencias (misma que el enum periodicidad_pago del schema:
//  "mensual ≡ 30 días"): mensual/30, catorcenal/14, semanal/7, diaria/1.
//  `spot` y `hora` no se derivan del rango: su cantidad la captura el usuario
//  (nº de spots u horas contratadas).
// ============================================================================

export type Unidad = 'mensual' | 'catorcenal' | 'semanal' | 'diaria' | 'spot' | 'hora'

export const UNIDADES: { unidad: Unidad; label: string; corta: string }[] = [
  { unidad: 'mensual', label: 'Mensual', corta: 'mes' },
  { unidad: 'catorcenal', label: 'Catorcenal', corta: 'catorcena' },
  { unidad: 'semanal', label: 'Semanal', corta: 'semana' },
  { unidad: 'diaria', label: 'Diaria', corta: 'día' },
  { unidad: 'spot', label: 'Por spot', corta: 'spot' },
  { unidad: 'hora', label: 'Por hora', corta: 'hora' },
]

export const UNIDAD_LABEL: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.unidad, u.label]),
)
export const UNIDAD_CORTA: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.unidad, u.corta]),
)

// Días inclusivos entre dos fechas 'YYYY-MM-DD' (14→20 son 7 días).
export function diasInclusivos(fechaInicio: string, fechaFin: string): number {
  const a = Date.parse(fechaInicio)
  const b = Date.parse(fechaFin)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

// Cuántos periodos de `unidad` caben en el rango. Para spot/hora devuelve null:
// esa cantidad no se deriva del tiempo, la pone el usuario.
export function periodosEnRango(unidad: Unidad, fechaInicio: string, fechaFin: string): number | null {
  if (unidad === 'spot' || unidad === 'hora') return null
  const dias = diasInclusivos(fechaInicio, fechaFin)
  if (dias <= 0) return 0
  const divisor = unidad === 'mensual' ? 30 : unidad === 'catorcenal' ? 14 : unidad === 'semanal' ? 7 : 1
  return Math.max(1, Math.ceil(dias / divisor))
}

// La cantidad efectiva del ítem: para unidades de tiempo, los periodos del
// rango; para spot/hora, la cantidad manual (mínimo 1).
export function cantidadEfectiva(
  unidad: Unidad,
  fechaInicio: string,
  fechaFin: string,
  cantidadManual?: number | null,
): number {
  const auto = periodosEnRango(unidad, fechaInicio, fechaFin)
  if (auto !== null) return auto
  return Math.max(1, Math.floor(cantidadManual ?? 1))
}

// Fecha "hasta" a partir de una duración: fechaInicio + (cantidad × días de la
// unidad) − 1 (rango inclusivo). Usa la MISMA equivalencia que el precio (mes=30,
// catorcena=14, semana=7, día=1), así una duración de "1 mes" cubre exactamente
// 1 periodo mensual. Devuelve '' si faltan datos. Solo unidades de tiempo.
export function fechaFinDesde(fechaInicio: string, unidad: Unidad, cantidad: number): string {
  const base = Date.parse(fechaInicio)
  if (Number.isNaN(base) || !cantidad || cantidad < 1) return ''
  if (unidad === 'spot' || unidad === 'hora') return ''
  const factor = unidad === 'mensual' ? 30 : unidad === 'catorcenal' ? 14 : unidad === 'semanal' ? 7 : 1
  const diasTotal = Math.round(cantidad * factor)
  const fin = base + (diasTotal - 1) * 86_400_000
  return new Date(fin).toISOString().slice(0, 10)
}

// Precio del ítem = tarifa por unidad × cantidad. Redondeado a entero (MXN/PEN
// sin centavos, como el resto de precios de lista del sistema).
export function precioItem(tarifaUnitaria: number, cantidad: number): number {
  return Math.round((Number(tarifaUnitaria) || 0) * (Number(cantidad) || 0))
}
