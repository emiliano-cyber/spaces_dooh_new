import type { ContextoVallas, Regla, ResultadoReglas, Hallazgo } from './tipos'
import { CONFIG_POR_OMISION } from './configuracion'
import { crearReglaCompetencia } from './competencia-marcas'

// ============================================================================
//  lib/vallas/reglas/index.ts — EL REGISTRO Y EL EVALUADOR.
// ----------------------------------------------------------------------------
//  `REGLAS` es la lista de reglas activas; `evaluarReglas` las corre TODAS y
//  junta sus hallazgos. `bloquea` es true si alguna devolvió `bloqueo`.
//
//  Quién lo llama hoy: `POST /api/vallas/verificar` (solo informa).
//  PUNTO DE ENGANCHE pendiente (no conectado a propósito: es dinero, R4): las
//  reservas nacen por sitio en `reservar` y `generarCampanaDesdePropuesta`
//  (`lib/server/campanas-repo.ts`). Cuando la reserva sepa en qué vallas cae,
//  allí se arma el contexto con `contextoParaVerificar` y, si `bloquea`, se
//  responde 409 con los hallazgos; si solo hay avisos, se guardan y se pintan.
// ============================================================================

export const REGLAS: Regla[] = [crearReglaCompetencia(CONFIG_POR_OMISION.competencia)]

export function evaluarReglas(ctx: ContextoVallas, reglas: Regla[] = REGLAS): ResultadoReglas {
  const hallazgos: Hallazgo[] = []
  for (const r of reglas) {
    try {
      hallazgos.push(...r.evaluar(ctx))
    } catch (e) {
      // Una regla rota no apaga las demás ni tumba la petición: se avisa.
      hallazgos.push({ regla: r.id, nivel: 'aviso', mensaje: `No se pudo evaluar la regla «${r.descripcion}»`, datos: { error: String((e as Error)?.message ?? e) } })
    }
  }
  return { hallazgos, bloquea: hallazgos.some((h) => h.nivel === 'bloqueo') }
}

export type { Regla, Hallazgo, ContextoVallas, ResultadoReglas, NivelRegla, Candidata } from './tipos'
