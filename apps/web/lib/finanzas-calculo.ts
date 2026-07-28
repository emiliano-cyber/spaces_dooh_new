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

// ─── Qué parcialidades caben en una campaña ─────────────────────────────────
// Duración de cada periodo en MESES. Quincenal es medio mes: en una campaña de
// un mes caben 2 quincenas.
export const MESES_PERIODO: Record<PeriodicidadCuota, number> = {
  QUINCENAL: 0.5, MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12,
}

// Duración de la campaña en meses. Las campañas casi nunca caen en meses
// exactos (del 14/07 al 13/08 es "un mes" pero son 31 días), así que se
// aproxima por días y se redondea: 30.44 es la media real de días por mes.
export function duracionMeses(fechaInicio: string, fechaFin: string): number {
  const i = new Date(fechaInicio).getTime()
  const f = new Date(fechaFin).getTime()
  if (!Number.isFinite(i) || !Number.isFinite(f) || f < i) return 0
  const dias = Math.round((f - i) / 86_400_000) + 1 // ambos extremos cuentan
  return Math.max(1, Math.round(dias / 30.44))
}

export interface OpcionParcialidad {
  periodicidad: PeriodicidadCuota
  cuotas: number
}

// Periodicidades válidas para una campaña de `meses`, con las cuotas que salen.
//
// La regla es una sola: las cuotas deben salir ENTERAS y ser al menos 2.
//   · 1 mes  → mensual da 1 cuota (no es fraccionar) y bimestral daría media.
//              Solo quedan las quincenales, que dan 2.
//   · 2 meses→ mensual da 2 ✓; bimestral daría 1 ✗.
//   · 12 meses→ anual daría 1 ✗; con 24 da 2 ✓ (de ahí lo del múltiplo de 12).
// Cobrar en "una parcialidad" no es fraccionar el pago: es el cobro único, que
// ya existe sin marcar la casilla.
export function opcionesParcialidad(meses: number): OpcionParcialidad[] {
  const out: OpcionParcialidad[] = []
  for (const p of Object.keys(MESES_PERIODO) as PeriodicidadCuota[]) {
    const exactas = meses / MESES_PERIODO[p]
    const cuotas = Math.round(exactas)
    if (Math.abs(exactas - cuotas) > 0.001) continue // no cabe un nº entero
    if (cuotas < 2) continue                          // 1 cuota = cobro único
    out.push({ periodicidad: p, cuotas })
  }
  return out
}
