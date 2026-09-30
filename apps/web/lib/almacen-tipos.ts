// ============================================================================
//  lib/almacen-tipos.ts — Qué clase de cosas guarda el almacén.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: «en almacén se debe de poder añadir más
//  elementos, camionetas, herramientas, pantallas, cámaras, etc.». Hasta ese
//  día el almacén era de equipo de pantalla —PANTALLA / ESTRUCTURA / LONA /
//  OTRO— y esa lista vivía SOLO en el <select> de la pantalla: la ruta metía en
//  `tipo_activo` cualquier texto que le llegara.
//
//  Este archivo NO toca base ni red: lo usan el servidor (`almacen-controller`
//  valida el alta y el filtro contra él) y la pantalla (el <select>, las
//  pastillas de filtro y sus cuentas). Una lista escrita dos veces diverge.
//
//  `tipo_activo` es `text` en la base, SIN CHECK, desde `20260723_almacen.sql`.
//  Por eso ampliar el catálogo NO necesita migración, y por eso las filas
//  viejas con texto libre siguen existiendo: caen en OTRO para filtrar, pero
//  enseñan su texto tal cual (`etiquetaTipoActivo`), que es lo único que dice
//  qué son.
// ============================================================================

// OTRO va el ÚLTIMO a propósito: es el cajón de lo que no encaja, y el filtro
// del servidor lo construye como «todo lo que no es de los demás».
export const TIPOS_ACTIVO = [
  'VEHICULO',
  'HERRAMIENTA',
  'PANTALLA',
  'EQUIPO',
  'CAMARA',
  'ESTRUCTURA',
  'LONA',
  'OTRO',
] as const
export type TipoActivo = (typeof TIPOS_ACTIVO)[number]

export const ETIQUETA_TIPO_ACTIVO: Record<TipoActivo, string> = {
  VEHICULO: 'Vehículo / camioneta',
  HERRAMIENTA: 'Herramienta',
  PANTALLA: 'Pantalla',
  EQUIPO: 'Equipo electrónico',
  CAMARA: 'Cámara',
  ESTRUCTURA: 'Estructura',
  LONA: 'Lona',
  OTRO: 'Otro',
}

// ─── Los datos propios de cada tipo ─────────────────────────────────────────
// Columnas de `20261001_almacen_datos_por_tipo.sql` (PENDIENTE DE APROBACIÓN
// DEL DUEÑO al escribirse). La `ubicacion` no está aquí porque vale para
// TODOS: dónde está guardado algo no depende de qué es.
//
// Las placas son SOLO de vehículos, y la base lo repite con un CHECK: unas
// placas en una cámara son un error de captura, y guardarlas haría que buscar
// por placa encontrara una cámara. Estructura y lona no piden nada propio
// —bastan etiqueta y notas—; OTRO ofrece todo menos placas porque no sabemos
// qué es.
export const CAMPOS_TIPO = ['marca', 'modelo', 'numeroSerie', 'placas'] as const
export type CampoTipo = (typeof CAMPOS_TIPO)[number]

export const ETIQUETA_CAMPO: Record<CampoTipo, string> = {
  marca: 'Marca',
  modelo: 'Modelo',
  numeroSerie: 'Número de serie',
  placas: 'Placas',
}

const EQUIPO_BASICO: CampoTipo[] = ['marca', 'modelo', 'numeroSerie']
const CAMPOS_POR_TIPO: Record<TipoActivo, CampoTipo[]> = {
  VEHICULO: ['marca', 'modelo', 'numeroSerie', 'placas'],
  HERRAMIENTA: EQUIPO_BASICO,
  PANTALLA: EQUIPO_BASICO,
  EQUIPO: EQUIPO_BASICO,
  CAMARA: EQUIPO_BASICO,
  ESTRUCTURA: [],
  LONA: [],
  OTRO: EQUIPO_BASICO,
}

export function camposDelTipo(tipo: TipoActivo): CampoTipo[] {
  return [...CAMPOS_POR_TIPO[tipo]]
}

const CONOCIDOS = new Set<string>(TIPOS_ACTIVO)

export function esTipoActivo(v: unknown): v is TipoActivo {
  return typeof v === 'string' && CONOCIDOS.has(v)
}

/** Todos los del catálogo menos OTRO: lo que el filtro «Otro» EXCLUYE. */
export function tiposConocidosSalvoOtro(): TipoActivo[] {
  return TIPOS_ACTIVO.filter((t) => t !== 'OTRO')
}

/**
 * El grupo de filtro de una fila. Igualdad EXACTA, sin pasar a mayúsculas: el
 * servidor filtra con `tipo_activo = $1`, y si aquí se normalizara una fila
 * «pantalla» contaría como PANTALLA en la pastilla y no saldría al filtrarla.
 */
export function tipoDeFiltro(tipo: string | null | undefined): TipoActivo {
  return esTipoActivo(tipo) ? tipo : 'OTRO'
}

/** El nombre para la pantalla. El texto libre de antes se enseña tal cual. */
export function etiquetaTipoActivo(tipo: string | null | undefined): string {
  if (esTipoActivo(tipo)) return ETIQUETA_TIPO_ACTIVO[tipo]
  return tipo && tipo.trim() ? tipo : ETIQUETA_TIPO_ACTIVO.OTRO
}

export function contarPorTipo<T extends { tipoActivo: string | null }>(filas: T[]): Record<TipoActivo, number> {
  const c = Object.fromEntries(TIPOS_ACTIVO.map((t) => [t, 0])) as Record<TipoActivo, number>
  for (const f of filas) c[tipoDeFiltro(f.tipoActivo)] += 1
  return c
}

export function filtrarPorTipo<T extends { tipoActivo: string | null }>(filas: T[], tipo: TipoActivo | null): T[] {
  if (!tipo) return filas
  return filas.filter((f) => tipoDeFiltro(f.tipoActivo) === tipo)
}
