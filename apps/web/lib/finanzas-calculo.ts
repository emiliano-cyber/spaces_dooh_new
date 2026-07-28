// ============================================================================
//  lib/finanzas-calculo.ts — Cálculo puro del cobro en parcialidades.
//  Sin acceso a BD ni a `server-only`, para que se pueda probar aislado: es
//  aritmética de dinero y merece pruebas propias.
// ============================================================================

export type PeriodicidadCuota = 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL'

export const DIAS_PERIODO: Record<PeriodicidadCuota, number> = {
  QUINCENAL: 15, MENSUAL: 30, BIMESTRAL: 60, TRIMESTRAL: 90,
}

// Reparte un total en n cuotas iguales SIN perder centavos: todas se redondean
// hacia abajo a 2 decimales y la última absorbe el residuo, de modo que la suma
// cuadra exactamente con la factura. Es el invariante que sostiene la cartera:
// si las cuotas no suman el total, se cobra de menos sin que nadie lo note.
export function repartirCuotas(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100
  const cuotas = Array(n).fill(base)
  const suma = Math.round(base * n * 100) / 100
  cuotas[n - 1] = Math.round((base + (total - suma)) * 100) / 100
  return cuotas
}
