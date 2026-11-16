// ============================================================================
//  lib/apariencia.ts — LA PALETA DE COLOR DE UNA INSTANCIA (PALETA-01, 10/11).
// ----------------------------------------------------------------------------
//  Se elige AL INSTALAR y no desde la aplicacion. Decision del dueno el
//  2026-11-10: «no debe de ser algo personalizable mas que al inicio, cuando
//  se instala la app en el droplet». Por eso no hay pantalla, ni ruta, ni
//  migracion: es una variable de `app.env`, `PALETA`, que escribe el alta
//  (`--paleta` en `provision-instancia.sh` e `instalar-hijo.sh`). Cambiarla
//  despues es editar ese archivo en el servidor y recrear el contenedor, o
//  sea un trabajo de quien administra la maquina, no de un usuario.
//
//  (La rama `feat/apariencia-e-idiomas` tenia la version con tarjeta en
//  Administracion, tabla y migracion. Se descarto por esa decision.)
//
//  Toda la interfaz pinta su color de producto con cinco variables de
//  `app/(app)/demo.css` (`--accent`, `--accent-hover`, `--accent-soft`,
//  `--accent-fg` y `--info`, que es el mismo azul). Cambiar la paleta es
//  sobrescribir ESAS y nada mas: los neutros, los semaforos (verde, ambar,
//  rojo) y la tipografia son la marca SPACE OS y se quedan.
//
//  Solo se elige UN color —el de marca— y los otros se DERIVAN de el. Pedirle
//  a quien instala un hover y un tinte suave es pedirle que entienda el
//  sistema de diseno; si los escribiera mal, la pantalla quedaria
//  inconsistente sin que nada fallara.
//
//  ─── LA REGLA DE CONTRASTE, Y POR QUE ES UNA SOLA ─────────────────────────
//  El color de marca se usa como FONDO de los botones principales, con texto
//  blanco encima, y como TEXTO sobre blanco (botones terciarios, enlaces). Las
//  dos piden lo mismo: contraste de al menos 4.5:1 contra el blanco (WCAG AA).
//  Un amarillo o un azul cielo dejarian los botones ilegibles —«no se ven los
//  botones», la queja de la DEMO del 10/11—, asi que NO se aceptan: el alta
//  los rechaza antes de escribir nada, y si alguien los pone a mano en
//  `app.env`, la aplicacion se queda con el azul y lo dice en el log.
// ============================================================================

export const PALETAS = [
  { clave: 'azul', color: '#0a66ff' },
  { clave: 'verde', color: '#12805c' },
  { clave: 'morado', color: '#6d28d9' },
  { clave: 'naranja', color: '#c2410c' },
  { clave: 'vino', color: '#9f1239' },
  { clave: 'grafito', color: '#27272a' },
] as const

export type ClavePaleta = (typeof PALETAS)[number]['clave']

export const COLOR_POR_OMISION = PALETAS[0].color
export const CONTRASTE_MINIMO = 4.5

/** `#rrggbb` en minusculas, o `null` si no es un color de seis cifras. */
export function normalizarHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  const largo = /^#?([0-9a-f]{6})$/.exec(s)
  if (largo) return `#${largo[1]}`
  // `#abc` es una forma comun de escribir un color: se expande en vez de
  // rechazarlo con un mensaje que no diria que hacer.
  const corto = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s)
  if (corto) return `#${corto[1]}${corto[1]}${corto[2]}${corto[2]}${corto[3]}${corto[3]}`
  return null
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`
}

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste WCAG entre dos colores `#rrggbb` (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** ¿Se puede usar como color de marca? Ver «la regla de contraste» arriba. */
export function colorLegible(hex: string): boolean {
  return contraste(hex, '#ffffff') >= CONTRASTE_MINIMO
}

/** Mezcla `hex` con `otro` en la proporcion `t` (0 = hex, 1 = otro). */
function mezclar(hex: string, otro: string, t: number): string {
  const a = rgb(hex)
  const b = rgb(otro)
  return aHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}

export interface TokensPaleta {
  accent: string
  accentHover: string
  accentSoft: string
  accentFg: string
}

/**
 * Las variables que pinta un color de marca. Las proporciones salen del azul
 * de SPACE OS: `#0a66ff` → hover `#0052d6` (≈16 % hacia negro) y tinte suave
 * `#eaf1ff` (≈91 % hacia blanco).
 */
export function tokensDeColor(hex: string): TokensPaleta {
  return {
    accent: hex,
    accentHover: mezclar(hex, '#000000', 0.16),
    accentSoft: mezclar(hex, '#ffffff', 0.91),
    accentFg: '#ffffff',
  }
}

export type LecturaPaleta =
  | { ok: true; color: string }
  | { ok: false; color: string; motivo: string }

/**
 * Lee el valor de `PALETA`: una clave (`verde`) o un color propio
 * (`#1e3a8a`). Vacio o ausente es el azul de siempre y NO es un error.
 * Cualquier otra cosa cae al azul con `ok: false` y el motivo, para que el
 * layout lo deje en el log: una instancia NUNCA deja de arrancar por un
 * color, y nunca pinta botones ilegibles.
 */
export function leerPaleta(valor: string | undefined): LecturaPaleta {
  const v = (valor ?? '').trim().toLowerCase()
  if (!v) return { ok: true, color: COLOR_POR_OMISION }
  const predefinida = PALETAS.find((p) => p.clave === v)
  if (predefinida) return { ok: true, color: predefinida.color }
  const hex = normalizarHex(v)
  if (!hex) {
    return {
      ok: false,
      color: COLOR_POR_OMISION,
      motivo: `PALETA=${JSON.stringify(valor)} no es una paleta (${PALETAS.map((p) => p.clave).join(', ')}) ni un color #rrggbb`,
    }
  }
  if (!colorLegible(hex)) {
    return {
      ok: false,
      color: COLOR_POR_OMISION,
      motivo: `PALETA=${hex} tiene contraste ${contraste(hex, '#ffffff').toFixed(2)}:1 con el blanco y hace falta ${CONTRASTE_MINIMO}:1`,
    }
  }
  return { ok: true, color: hex }
}

/**
 * La regla CSS que sobrescribe la paleta, o cadena vacia si es la de siempre
 * (asi una instancia que no toca nada sirve el mismo HTML que antes).
 *
 * `:root .demo-root` y no `.demo-root` a secas: gana por especificidad a
 * `demo.css` sin depender del orden en que el navegador cargue las hojas.
 * El color llega siempre validado como `#rrggbb` por `leerPaleta`, asi que
 * un valor de `app.env` no puede convertirse en CSS arbitrario.
 */
export function cssDePaleta(color: string): string {
  const hex = normalizarHex(color)
  if (!hex || hex === COLOR_POR_OMISION) return ''
  const k = tokensDeColor(hex)
  return (
    `:root .demo-root{--accent:${k.accent};--accent-hover:${k.accentHover};` +
    `--accent-soft:${k.accentSoft};--accent-fg:${k.accentFg};--info:${k.accent}}`
  )
}
