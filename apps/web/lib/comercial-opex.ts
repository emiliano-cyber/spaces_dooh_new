// ============================================================================
//  lib/comercial-opex.ts — Las cuentas de la pantalla de Comercial negociación.
// ----------------------------------------------------------------------------
//  Fue la MAQUETA del 30/09 (datos escritos aquí, sin base). Desde NEG-01
//  (22/10) los espacios salen de la API —son prospectos PREDIO o PANTALLA,
//  `lib/server/captacion-repo.ts`— y aquí solo quedan las cuentas que pinta la
//  pantalla, que ya tenían pruebas y se conservan.
//
//  ─── POR QUÉ LAS CUENTAS VIVEN AQUÍ Y NO EN EL `.tsx` ──────────────────────
//  Porque dentro de un componente no las comprueba nada: el arnés no monta DOM.
//  En la semana del 28/09 tres mutantes que borraban avisos del reporte
//  SOBREVIVIERON por exactamente eso.
//
//  Las reglas de negocio (qué etapa exige quién firma, qué oferta es final…)
//  NO van aquí: están en `lib/negociacion.ts`, que también usa el servidor.
// ============================================================================

import type { Etapa } from './captacion'
import { diasDesde, estadoEspacio } from './negociacion'

export { ETAPAS_RESPONSABLE } from './negociacion'

/** Lo mínimo de un espacio que necesitan las cuentas. */
export interface EspacioResumen {
  id: string
  etapa: Etapa
  /** El avance más reciente de la bitácora; null si nunca se ha hablado. */
  ultimoContactoEn: string | null
}

/** Días desde el último contacto, o `null` —no 0— si nunca hubo uno. */
export function diasSinContacto(e: EspacioResumen, hoy: Date): number | null {
  return diasDesde(e.ultimoContactoEn, hoy)
}

/** El umbral a partir del cual una negociación se considera enfriada. */
export const DIAS_ENFRIADO = 30

/**
 * Los que hay que retomar: EN NEGOCIACIÓN y con más de 30 días sin contacto.
 *
 * El estado importa: uno activo (aprobado) lleva meses sin llamada porque ya
 * está contratado y va bien, y uno perdido no se está persiguiendo. Contarlos
 * llenaría el aviso de ruido y dejaría de mirarse, que es como muere un aviso.
 */
export function enfriados<T extends EspacioResumen>(espacios: T[], hoy: Date): T[] {
  return espacios.filter((e) => {
    if (estadoEspacio(e.etapa) !== 'negociacion') return false
    const d = diasSinContacto(e, hoy)
    return d !== null && d > DIAS_ENFRIADO
  })
}

export function resumen(espacios: EspacioResumen[], hoy: Date) {
  return {
    total: espacios.length,
    enNegociacion: espacios.filter((e) => estadoEspacio(e.etapa) === 'negociacion').length,
    activos: espacios.filter((e) => estadoEspacio(e.etapa) === 'activo').length,
    enfriados: enfriados(espacios, hoy).length,
  }
}

/**
 * El espacio que se detalla. Sin elección, o con un id que ya no existe, el
 * primero: una pantalla de detalle vacía con espacios en la lista no ayuda.
 */
export function espacioElegido<T extends { id: string }>(espacios: T[], id: string | null): T | null {
  return espacios.find((e) => e.id === id) ?? espacios[0] ?? null
}

/**
 * Las dos iniciales del círculo de un contacto. Quita el tratamiento («Ing.»,
 * «Lic.», «Sra.»…) y se queda solo con palabras que empiezan por LETRA: la
 * primera versión pintaba «C(» para «Sra. Carmen (vecina 1418)».
 */
export function iniciales(nombre: string): string {
  return nombre
    .replace(/^(Ing|Lic|Sra|Srta|Sr|Dr|Dra|Arq|Mtro|Mtra)\.?\s+/i, '')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}
