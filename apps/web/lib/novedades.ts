// ============================================================================
//  lib/novedades.ts — Las notas de version, para la aplicacion.
// ----------------------------------------------------------------------------
//  Pedido del dueno, 2026-10-01: cada version nueva trae escrito que cambio.
//  TODO usuario lo ve UNA vez despues de instalarse la version; el Dueno y el
//  Administrador lo ven ANTES, en el panel de Actualizaciones.
//
//  Las REGLAS del archivo viven en `novedades-reglas.mjs` (por que es `.mjs`
//  esta escrito en su cabecera); este modulo las reexporta con tipos y anade
//  lo que solo necesita la aplicacion: agrupar por tipo y decidir cuando sale
//  el dialogo.
//
//  PURO Y SIN EL ARCHIVO DENTRO, a proposito. `notasDe` recibe la lista en vez
//  de importar `novedades.json`: este modulo lo importan componentes de
//  CLIENTE, y el JSON importado aqui acabaria en el bundle del navegador, que
//  cualquiera descarga sin sesion. Las notas dicen que version corre la
//  instancia, y esa version va tras token en `/api/version` (P6, ver su
//  cabecera). El archivo lo lee solo el servidor: `lib/server/novedades.ts`.
// ============================================================================

import {
  TIPOS_NOVEDAD as TIPOS,
  ETIQUETA_TIPO as ETIQUETAS,
  validarNovedades as validar,
  erroresDeEntrada,
  notasDe as notasDeReglas,
  versionBase as versionBaseReglas,
} from './novedades-reglas.mjs'

export type TipoNovedad = 'NUEVO' | 'AJUSTADO' | 'CORREGIDO'

export interface ItemNovedad {
  tipo: TipoNovedad
  texto: string
}

export interface EntradaNovedades {
  version: string
  fecha: string
  items: ItemNovedad[]
}

export type ResultadoValidacion = { ok: true; novedades: EntradaNovedades[] } | { ok: false; errores: string[] }

export const TIPOS_NOVEDAD = TIPOS as readonly TipoNovedad[]
export const ETIQUETA_TIPO = ETIQUETAS as Readonly<Record<TipoNovedad, string>>

export function validarNovedades(datos: unknown): ResultadoValidacion {
  return validar(datos) as ResultadoValidacion
}

/** `vX.Y.Z` de una version de imagen (con o sin sufijo de precandidata), o null. */
export function versionBase(v: unknown): string | null {
  return versionBaseReglas(v)
}

/** Las notas de una version dentro de una lista ya validada, o null. */
export function notasDe(version: string | null | undefined, novedades: EntradaNovedades[]): EntradaNovedades | null {
  return notasDeReglas(version, novedades) as EntradaNovedades | null
}

/**
 * Lo que el actualizador escribio en `notas_disponibles`, si sirve para
 * ensenarse como las notas de `version`. Cualquier otra cosa es `null`, nunca
 * un error: lo escribe otro proceso, desde otra imagen, y una columna con algo
 * raro no puede tumbar el panel de Actualizaciones con un 500.
 */
export function entradaValida(x: unknown, version: string | null | undefined): EntradaNovedades | null {
  if (erroresDeEntrada(x).length > 0) return null
  const e = x as EntradaNovedades
  // Las notas de OTRA version pintadas al lado del boton de instalar serian la
  // mentira mas cara de esta pantalla: el dueno aprobaria leyendo lo que no va.
  return e.version === versionBase(version) ? e : null
}

export interface GrupoNovedades {
  tipo: TipoNovedad
  etiqueta: string
  textos: string[]
}

/** Agrupa en el orden fijo Nuevo → Ajustado → Corregido, sin grupos vacios. */
export function agruparPorTipo(items: ItemNovedad[]): GrupoNovedades[] {
  return TIPOS_NOVEDAD.map((tipo) => ({
    tipo,
    etiqueta: ETIQUETA_TIPO[tipo],
    textos: items.filter((i) => i.tipo === tipo).map((i) => i.texto),
  })).filter((g) => g.textos.length > 0)
}

// ─── Cuando sale el dialogo ────────────────────────────────────────────────

/**
 * La version instalada, tal como la sella la imagen (`SPACE_OS_VERSION`,
 * `Dockerfile` → `ARG VERSION`). En desarrollo, o sin una version con forma de
 * version, NO hay version instalada y el dialogo no sale nunca: un `next dev`
 * no es una instalacion, y `desconocida` (el valor por omision del
 * `Dockerfile`) es una imagen construida fuera del pipeline.
 */
export function versionInstaladaDe(valor: string | undefined, nodeEnv: string | undefined): string | null {
  if (nodeEnv !== 'production') return null
  return versionBase(valor) ? (valor as string) : null
}

/** Se ensena si hay notas y este usuario todavia no las vio. */
export function debeMostrarNovedades(s: { notas: EntradaNovedades | null; vistas: string[] }): boolean {
  if (!s.notas) return false
  return !s.vistas.includes(s.notas.version)
}

// Tope de versiones recordadas: el dato vive en `localStorage` de cada
// navegador y no tiene por que crecer para siempre. 20 versiones son meses de
// historia; una que se cayera de la lista solo volveria a salir si la
// instancia volviera atras a ella, que es justo cuando conviene verla.
const MAX_VISTAS = 20

export function marcarVista(vistas: string[], version: string): string[] {
  const sin = vistas.filter((v) => v !== version)
  return [...sin, version].slice(-MAX_VISTAS)
}

/** Lo que haya en `localStorage`, sin fiarse de nada: puede ser cualquier cosa. */
export function leerVistas(crudo: string | null): string[] {
  if (!crudo) return []
  try {
    const x = JSON.parse(crudo)
    return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

// POR USUARIO: un navegador compartido (el de la recepcion, el de la sala de
// juntas) no puede dar por vistas las notas de alguien que no las vio.
export function claveVistas(usuarioId: string): string {
  return `space-os:novedades-vistas:${usuarioId}`
}
