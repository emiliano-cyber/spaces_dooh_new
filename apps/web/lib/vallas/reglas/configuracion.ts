import type { NivelRegla } from './tipos'

// ============================================================================
//  lib/vallas/reglas/configuracion.ts — cómo se comporta cada regla.
// ----------------------------------------------------------------------------
//  En el esqueleto vive en código. Bloqueo o aviso, y hasta dónde llega la
//  competencia, son DECISIONES DEL DUEÑO pendientes (ver la nota
//  `vault/02-Backend/vallas.md`). Si cada organización tiene que poder
//  cambiarlo, va a `config_negocio` en una migración aparte, saneado al leer
//  como `requisitos_impresion`.
// ============================================================================

/**
 * Hasta dónde busca choques la regla de competencia, de menos a más:
 *  · `valla` ........ solo el mismo cuadro;
 *  · `grupo_imagen` . el cuadro y los de su grupo si el grupo es UNA IMAGEN;
 *  · `grupo` ........ el cuadro y los de su grupo, sea cual sea el modo;
 *  · `sitio` ........ cualquier valla del mismo sitio (vecinas).
 */
export const ALCANCES_COMPETENCIA = ['valla', 'grupo_imagen', 'grupo', 'sitio'] as const
export type AlcanceCompetencia = (typeof ALCANCES_COMPETENCIA)[number]

export type ConfigCompetencia = { nivel: NivelRegla; alcance: AlcanceCompetencia }

export const CONFIG_POR_OMISION: { competencia: ConfigCompetencia } = {
  // AVISO hasta que el dueño decida; `grupo_imagen` porque es lo que pidió
  // («la misma valla o el mismo conjunto de vallas que forman una imagen»).
  competencia: { nivel: 'aviso', alcance: 'grupo_imagen' },
}
