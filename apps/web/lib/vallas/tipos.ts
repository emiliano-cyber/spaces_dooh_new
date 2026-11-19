// ============================================================================
//  lib/vallas/tipos.ts — VALLAS (esqueleto, 19/11). Los tipos que comparten
//  el servidor, la pantalla y las reglas. Puro: sin servidor ni React.
// ----------------------------------------------------------------------------
//  Una VALLA es un cuadro/cara individual con su número y su medida, y vive en
//  un SITIO del inventario (`sitios`, el que ya existe con `tipo_medio`,
//  `ancho`, `alto` y `caras`: no se duplica nada de eso). Un GRUPO junta varias
//  vallas con un número propio; si es `una_imagen`, el arte se hace a la medida
//  del grupo (`numeracion.ts`, `medidaParaArte`).
// ============================================================================

export const MODOS_GRUPO = ['una_imagen', 'separadas'] as const
export type ModoGrupo = (typeof MODOS_GRUPO)[number]

export type Valla = {
  id: string
  sitioId: string
  /** Número individual del cuadro (único por organización). */
  numero: string
  /** Qué cara del sitio es (1, 2…), si aplica. */
  cara: number | null
  /** Metros. */
  ancho: number
  alto: number
  grupoId: string | null
  /** Orden dentro del grupo (izquierda → derecha). */
  posicion: number | null
  notas: string | null
  activo: boolean
}

export type GrupoVallas = {
  id: string
  /** Número del grupo (único por organización, aparte del de las vallas). */
  numero: string
  nombre: string | null
  modo: ModoGrupo
  /** Medida total en metros; en `una_imagen` es la que cuenta para el arte. */
  ancho: number | null
  alto: number | null
  notas: string | null
  activo: boolean
}

/** Una categoría de marcas que compiten entre sí («Refrescos de cola»). */
export type CategoriaCompetencia = {
  id: string
  nombre: string
  marcas: string[]
  activo: boolean
}

/** Una marca ya puesta en una valla durante unas fechas (sale de las reservas). */
export type Ocupacion = {
  vallaId: string
  marca: string
  /** 'YYYY-MM-DD', inclusivas. */
  inicio: string
  fin: string
  campanaId: string | null
  campanaNombre: string | null
}
