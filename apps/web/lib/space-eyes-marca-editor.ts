// ============================================================================
//  Editor de la marca (nombre · fecha · hora) que Space Eye graba en las fotos.
//
//  Funciones puras: la pantalla «Ajustar texto» solo pinta lo que salga de
//  aquí. La cuenta es LA MISMA que hace Space Eye al quemar la marca
//  (`frontend/src/js/photo-utils.js`, `_drawOverlay`):
//
//    · fuente   = max(12 px, ancho / 42 · tamaño)
//    · renglón  = fuente · espaciado entre líneas
//    · relleno  = 0.6 · fuente arriba/abajo, 0.9 · fuente a los lados
//    · caja centrada en (x, y) % y metida a 6 px de cada borde
//
//  En la vista previa se expresa en `cqw` (1 % del ancho del recuadro), así
//  que la marca guarda la misma proporción con la foto a cualquier tamaño.
// ============================================================================

import type { CSSProperties } from 'react'

export type PesoMarca = 'normal' | 'bold'
export type AlineacionMarca = 'left' | 'center' | 'right'

export interface EstiloMarca {
  size: number
  weight: PesoMarca
  color: string
  shadow: boolean
  bg: boolean
  align: AlineacionMarca
  letterSpacing: number
  lineSpacing: number
}

export interface ConfigMarca {
  x: number
  y: number
  enabled: boolean
  style: EstiloMarca
}

export const ESTILO_POR_OMISION: EstiloMarca = {
  size: 1.2,
  weight: 'bold',
  color: '#ffffff',
  shadow: true,
  bg: true,
  align: 'left',
  letterSpacing: 0,
  lineSpacing: 1.3,
}

export const MARCA_POR_OMISION: ConfigMarca = { x: 50, y: 92, enabled: true, style: ESTILO_POR_OMISION }

// Los topes de los controles. Caben dentro de lo que acepta Space Eye
// (`setOverlay`: size 0.5–8, letterSpacing −0.5–2, lineSpacing 0.8–3).
export const RANGOS = {
  size: { min: 0.6, max: 4, step: 0.1 },
  lineSpacing: { min: 0.9, max: 2.5, step: 0.1 },
  letterSpacing: { min: -0.1, max: 0.6, step: 0.02 },
} as const

const num = (v: unknown, def: number) => {
  const n = Number(v)
  return v != null && v !== '' && Number.isFinite(n) ? n : def
}

/** La configuración guardada de un equipo, tal como la manda GET /api/devices/:id. */
export function marcaDeEquipo(d: Record<string, unknown> | null | undefined): ConfigMarca {
  if (!d) return { ...MARCA_POR_OMISION, style: { ...ESTILO_POR_OMISION } }
  let st: unknown = d.overlay_style
  if (typeof st === 'string') {
    try {
      st = JSON.parse(st || 'null')
    } catch {
      st = null
    }
  }
  const s = (st && typeof st === 'object' ? st : {}) as Partial<EstiloMarca>
  return {
    x: num(d.overlay_x, 50),
    y: num(d.overlay_y, 92),
    enabled: d.overlay_enabled !== 0 && d.overlay_enabled !== false,
    style: {
      size: num(s.size, ESTILO_POR_OMISION.size),
      weight: s.weight === 'normal' ? 'normal' : 'bold',
      color: typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : ESTILO_POR_OMISION.color,
      shadow: s.shadow !== false,
      bg: s.bg !== false,
      align: s.align === 'center' || s.align === 'right' ? s.align : 'left',
      letterSpacing: num(s.letterSpacing, ESTILO_POR_OMISION.letterSpacing),
      lineSpacing: num(s.lineSpacing, ESTILO_POR_OMISION.lineSpacing),
    },
  }
}

/** El cuerpo de PUT /api/devices/:id/overlay. */
export function cuerpoMarca(c: ConfigMarca) {
  const s = c.style
  return {
    x: Math.round(limitar(c.x, 0, 100)),
    y: Math.round(limitar(c.y, 0, 100)),
    enabled: c.enabled,
    style: {
      size: Number(s.size),
      weight: s.weight,
      color: s.color,
      shadow: !!s.shadow,
      bg: !!s.bg,
      align: s.align,
      letterSpacing: Number(s.letterSpacing),
      lineSpacing: Number(s.lineSpacing),
    },
  }
}

export function mismaMarca(a: ConfigMarca, b: ConfigMarca): boolean {
  return JSON.stringify(cuerpoMarca(a)) === JSON.stringify(cuerpoMarca(b))
}

export function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Nombre · fecha · hora, con la fecha de CAPTURA (igual que `overlayInfoLines`). */
export function renglonesMarca(nombre: string | null | undefined, tomadaEn: string | Date | null | undefined): string[] {
  const d = tomadaEn ? new Date(tomadaEn) : new Date()
  const f = Number.isNaN(d.getTime()) ? new Date() : d
  return [
    nombre || 'SPACE EYE',
    f.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  ].filter(Boolean)
}

/**
 * Tamaño de la fuente en cqw. `anchoReal` es el ancho en píxeles de la foto ya
 * enderezada: con él se respeta el piso de 12 px que pone el render de verdad
 * (una foto chica lleva la letra proporcionalmente más grande).
 */
export function fuenteCqw(size: number, anchoReal?: number | null): number {
  const prop = (Number(size) || ESTILO_POR_OMISION.size) * (100 / 42)
  if (!anchoReal || anchoReal <= 0) return prop
  return Math.max(prop, (12 / anchoReal) * 100)
}

/** Estilos del bloque de texto (sin la posición, que se calcula aparte). */
export function estiloTextoMarca(s: EstiloMarca, anchoReal?: number | null): CSSProperties {
  return {
    fontSize: `${fuenteCqw(s.size, anchoReal).toFixed(3)}cqw`,
    fontWeight: s.weight === 'normal' ? 400 : 700,
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: s.color,
    textAlign: s.align,
    lineHeight: Number(s.lineSpacing) || ESTILO_POR_OMISION.lineSpacing,
    letterSpacing: `${Number(s.letterSpacing) || 0}em`,
    padding: '0.6em 0.9em',
    borderRadius: '0.4em',
    whiteSpace: 'pre',
    background: s.bg ? 'rgba(0,0,0,0.55)' : 'transparent',
    textShadow: s.shadow ? '0 0 4px rgba(0,0,0,0.9)' : 'none',
  }
}

/**
 * Esquina superior izquierda de la caja, en píxeles del recuadro: centrada en
 * (x, y) % y metida a 6 px «reales» de cada borde, como `_drawOverlay`. Sin
 * esto, una marca arrastrada a la orilla se ve cortada aquí pero sale entera
 * en la foto.
 */
export function posicionCaja(
  x: number,
  y: number,
  caja: { w: number; h: number },
  recuadro: { w: number; h: number },
  anchoReal?: number | null,
): { left: number; top: number } {
  const m = anchoReal && anchoReal > 0 ? (6 * recuadro.w) / anchoReal : 0
  const cx = (x / 100) * recuadro.w
  const cy = (y / 100) * recuadro.h
  return {
    left: Math.min(Math.max(cx - caja.w / 2, m), Math.max(m, recuadro.w - caja.w - m)),
    top: Math.min(Math.max(cy - caja.h / 2, m), Math.max(m, recuadro.h - caja.h - m)),
  }
}

/** Cuánto hay que girar la foto para verla derecha (`giroDeFoto`). */
export function giroFoto(g: unknown): 0 | 90 | 180 | 270 {
  const n = Number(g) || 0
  return n === 90 || n === 180 || n === 270 ? n : 0
}
