import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { EstCobranza } from '@/lib/data/types'
import type { TipoPeriodo } from '@/lib/finanzas-periodo'
import type { PeriodicidadCuota } from '@/lib/finanzas-calculo'

// ============================================================================
//  La CLAVE del diccionario de las etiquetas de Finanzas que tienen su verdad
//  en otro modulo (lote de ingles, 2026-11-02): `COBRANZA_LABEL`
//  (StatusBadge.tsx), `OPCIONES_PERIODO` (TableroPeriodo.tsx, que tambien usa
//  el tablero de Propuestas), `PERIODICIDAD_LABEL` (lib/finanzas-calculo.ts) y
//  `etiquetaVencimiento` (vencimiento-cuota.ts). Esos modulos NO se tocan;
//  `textos/finanzas.test.ts` exige que el espanol del diccionario sea IDENTICO
//  al suyo.
//
//  `CLAVE_PERIODO` apunta a las claves `compartidos.periodo.*` desde la costura
//  (2026-11-02): el lote de compartidos ya habia traducido el mismo selector
//  para el tablero de Propuestas, y dos juegos de claves para seis botones
//  iguales divergen en cuanto alguien corrige uno.
// ============================================================================

export const CLAVE_COBRANZA: Record<EstCobranza, ClaveTexto> = {
  AL_CORRIENTE: 'finanzas.cobranza.al-corriente',
  POR_VENCER: 'finanzas.cobranza.por-vencer',
  VENCIDA: 'finanzas.cobranza.vencida',
  PAGADA: 'finanzas.cobranza.pagada',
}

export const CLAVE_PERIODO: Record<TipoPeriodo, ClaveTexto> = {
  mes: 'compartidos.periodo.mes',
  'mes-anterior': 'compartidos.periodo.mes-anterior',
  trimestre: 'compartidos.periodo.trimestre',
  'trimestre-anterior': 'compartidos.periodo.trimestre-anterior',
  anio: 'compartidos.periodo.anio',
  rango: 'compartidos.periodo.rango',
}

/** «{n} cuotas mensuales»: la frase ENTERA por periodicidad, sin pegar trozos. */
export const CLAVE_PARCIALIDAD: Record<PeriodicidadCuota, ClaveTexto> = {
  QUINCENAL: 'finanzas.parcialidad.quincenal',
  MENSUAL: 'finanzas.parcialidad.mensual',
  BIMESTRAL: 'finanzas.parcialidad.bimestral',
  TRIMESTRAL: 'finanzas.parcialidad.trimestral',
  SEMESTRAL: 'finanzas.parcialidad.semestral',
  ANUAL: 'finanzas.parcialidad.anual',
}

/**
 * El texto de la pastilla junto al vencimiento, traducido. Repite las TRES
 * ramas de `etiquetaVencimiento` (que sigue decidiendo el tono y sigue siendo
 * la verdad en espanol) a proposito: `textos/finanzas.test.ts` las compara
 * con la original para pagada, vencida y por vencer, y si una cambia la
 * prueba se pone en rojo.
 */
export function textoVencimiento(
  estado: EstCobranza,
  dias: number,
  t: (clave: ClaveTexto, valores?: Record<string, string | number>) => string,
): string {
  if (estado === 'PAGADA') return t('finanzas.vence.pagada')
  if (dias < 0) return t('finanzas.vence.vencida', { n: Math.abs(dias) })
  return t('finanzas.vence.dias', { n: dias })
}
