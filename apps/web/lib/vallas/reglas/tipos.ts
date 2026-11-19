import type { Valla, GrupoVallas, CategoriaCompetencia, Ocupacion } from '../tipos'

// ============================================================================
//  lib/vallas/reglas/tipos.ts — EL CONTRATO DE UNA REGLA DE VALLAS.
// ----------------------------------------------------------------------------
//  Aquí se enchufan las reglas de negocio nuevas de las vallas. Una regla es
//  PURA: recibe el contexto ya leído de la base (`ContextoVallas`) y devuelve
//  sus hallazgos. No lee la base, no lanza por un caso de negocio, no decide si
//  algo se guarda: eso lo hace quien llama, mirando `bloquea`.
//
//  Para añadir una regla:
//   1. un archivo en esta carpeta que exporte un `Regla` (o una fábrica que
//      reciba su configuración, como `crearReglaCompetencia`);
//   2. su configuración por omisión en `configuracion.ts`;
//   3. añadirla a `REGLAS` en `index.ts`;
//   4. si necesita datos que el contexto no trae, ampliarlo aquí y llenarlo en
//      `contextoParaVerificar` (`lib/server/vallas-repo.ts`).
// ============================================================================

export type NivelRegla = 'bloqueo' | 'aviso'

export type Hallazgo = {
  /** El `id` de la regla que lo produjo. */
  regla: string
  nivel: NivelRegla
  /** En español; la pantalla lo pinta tal cual (o lo traduce por `datos`). */
  mensaje: string
  datos?: Record<string, unknown>
}

/** Lo que se quiere poner: una marca, unas fechas y unas vallas. */
export type Candidata = {
  marca: string
  inicio: string
  fin: string
  vallaIds: string[]
  /** La campaña que se está verificando, para no chocar consigo misma. */
  excluirCampanaId?: string | null
}

export type ContextoVallas = {
  vallas: Valla[]
  grupos: GrupoVallas[]
  categorias: CategoriaCompetencia[]
  /** Lo que ya está puesto en las vallas que importan, en fechas que importan. */
  ocupaciones: Ocupacion[]
  candidata: Candidata
}

export interface Regla {
  id: string
  descripcion: string
  evaluar(ctx: ContextoVallas): Hallazgo[]
}

export type ResultadoReglas = { hallazgos: Hallazgo[]; bloquea: boolean }
