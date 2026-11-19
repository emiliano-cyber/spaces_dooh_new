// ============================================================================
//  lib/vallas/reglas/configuracion.ts — cómo se comporta cada regla.
// ----------------------------------------------------------------------------
//  Vive en código. Si algún día cada organización tiene que poder cambiarlo, va
//  a `config_negocio` en una migración aparte, saneado al leer como
//  `requisitos_impresion`.
//
//  DECISIONES DEL DUEÑO (19/11) sobre la competencia de marcas:
//   · SOLO AVISA, NUNCA BLOQUEA. Por eso `nivel` es el literal `'aviso'` y no
//     `NivelRegla`: no existe una configuración que la haga bloquear, y la
//     regla además lo escribe fijo al emitir (`competencia-marcas.ts`). El tipo
//     `NivelRegla` conserva `'bloqueo'` porque el evaluador es común a todas
//     las reglas y una regla futura sí podría necesitarlo. Cambiar esto es
//     cambiar una decisión del dueño, no un ajuste técnico.
//   · APLICA A TODO EL SITIO: dos marcas rivales en cualquier valla del mismo
//     sitio, con fechas que se solapan, avisan.
// ============================================================================

/**
 * Hasta dónde busca choques la regla de competencia, de menos a más:
 *  · `valla` ........ solo el mismo cuadro;
 *  · `grupo_imagen` . el cuadro y los de su grupo si el grupo es UNA IMAGEN;
 *  · `grupo` ........ el cuadro y los de su grupo, sea cual sea el modo;
 *  · `sitio` ........ cualquier valla del mismo sitio, MÁS las de su grupo
 *                     (un grupo se vende junto aunque cruce de sitio).
 */
export const ALCANCES_COMPETENCIA = ['valla', 'grupo_imagen', 'grupo', 'sitio'] as const
export type AlcanceCompetencia = (typeof ALCANCES_COMPETENCIA)[number]

export type ConfigCompetencia = { nivel: 'aviso'; alcance: AlcanceCompetencia }

export const CONFIG_POR_OMISION: { competencia: ConfigCompetencia } = {
  // Decisión del dueño del 19/11: solo avisa, y en todo el sitio.
  competencia: { nivel: 'aviso', alcance: 'sitio' },
}
