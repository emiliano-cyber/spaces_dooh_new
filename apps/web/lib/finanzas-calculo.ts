// ============================================================================
//  lib/finanzas-calculo.ts — Cálculo puro del cobro en parcialidades.
//  Sin acceso a BD ni a `server-only`, para que se pueda probar aislado: es
//  aritmética de dinero y merece pruebas propias.
// ============================================================================

export type PeriodicidadCuota =
  | 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

// Intervalo de PostgreSQL, no un número de días. Avanzar "30 días" no es avanzar
// un mes: 12 cuotas mensuales desde el 1 de septiembre caían el 1, el 1, el 31,
// el 30, el 30… porque cada salto se comía los meses de 31 días. Con
// `interval '1 month'` Postgres respeta el día del mes y ajusta los cortos
// (el 31 de enero + 1 mes = 28 de febrero).
export const INTERVALO_PERIODO: Record<PeriodicidadCuota, string> = {
  QUINCENAL: '15 days',
  MENSUAL: '1 month',
  BIMESTRAL: '2 months',
  TRIMESTRAL: '3 months',
  SEMESTRAL: '6 months',
  ANUAL: '1 year',
}

export const PERIODICIDAD_LABEL: Record<PeriodicidadCuota, string> = {
  QUINCENAL: 'quincenales', MENSUAL: 'mensuales', BIMESTRAL: 'bimestrales',
  TRIMESTRAL: 'trimestrales', SEMESTRAL: 'semestrales', ANUAL: 'anuales',
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
