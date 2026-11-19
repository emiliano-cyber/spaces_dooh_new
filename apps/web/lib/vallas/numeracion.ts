import type { Valla, GrupoVallas } from './tipos'

// ============================================================================
//  lib/vallas/numeracion.ts — las DOS numeraciones y la medida del arte.
// ----------------------------------------------------------------------------
//  Pedido del dueño (19/11): «una numeración por cada cuadro y una por grupo,
//  cuando varias vallas juntas forman una sola imagen». Las dos son texto libre
//  (lo pone el usuario: «V-012», «Norte 3»); `siguienteNumero` solo SUGIERE.
//
//  ENGANCHE CON IMPRENTA (señalado, sin conectar): `medidaParaArte` devuelve
//  la misma forma `{ ancho, alto }` en metros que `Lona` de
//  `lib/valoracion-arte.ts` y que `medidaDeOrden` de
//  `lib/proporcion-pantalla.ts`. El día que la orden de impresión apunte a una
//  valla (o a un grupo), la valoración del arte debe pedir la lona aquí: si el
//  grupo es `una_imagen`, la lona es la del GRUPO, no la del cuadro.
// ============================================================================

export function normalizarNumero(n: string): string {
  return n.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** El siguiente número con ese prefijo: el mayor + 1, con tres cifras mínimo. */
export function siguienteNumero(existentes: string[], prefijo: string): string {
  const p = normalizarNumero(prefijo)
  let mayor = 0
  for (const e of existentes) {
    const n = normalizarNumero(e)
    if (!n.startsWith(p)) continue
    const resto = n.slice(p.length)
    if (/^\d+$/.test(resto)) mayor = Math.max(mayor, Number(resto))
  }
  return `${p}${String(mayor + 1).padStart(3, '0')}`
}

export type MedidaArte = { ancho: number; alto: number; origen: 'valla' | 'grupo' }

/**
 * La medida a la que se hace el arte de esta valla. Si su grupo es
 * `una_imagen`, la del grupo; si ese grupo no tiene medida capturada, `null`
 * (no se adivina: un arte a la medida equivocada se imprime y se pierde).
 */
export function medidaParaArte(valla: Valla, grupo: GrupoVallas | null | undefined): MedidaArte | null {
  if (grupo && valla.grupoId === grupo.id && grupo.modo === 'una_imagen') {
    if (grupo.ancho && grupo.alto && grupo.ancho > 0 && grupo.alto > 0) {
      return { ancho: grupo.ancho, alto: grupo.alto, origen: 'grupo' }
    }
    return null
  }
  return { ancho: valla.ancho, alto: valla.alto, origen: 'valla' }
}

/**
 * Sugerencia para la medida total de un grupo: las vallas LADO A LADO (suma de
 * anchos, el mayor alto). Es solo una sugerencia: el usuario la confirma,
 * porque un grupo también puede ir apilado o en L.
 */
export function medidaSugeridaDeGrupo(vallas: Pick<Valla, 'ancho' | 'alto'>[]): { ancho: number; alto: number } | null {
  if (!vallas.length) return null
  const ancho = Math.round(vallas.reduce((s, v) => s + v.ancho, 0) * 100) / 100
  const alto = Math.max(...vallas.map((v) => v.alto))
  return { ancho, alto }
}

export type ProblemaGrupo = { codigo: 'grupo-sin-medida' | 'grupo-una-valla' | 'grupo-varios-sitios' }

/** Lo que conviene avisar de un grupo (no bloquea guardarlo). */
export function problemasDeGrupo(grupo: GrupoVallas, miembros: Valla[]): ProblemaGrupo[] {
  const p: ProblemaGrupo[] = []
  if (grupo.modo === 'una_imagen' && !(grupo.ancho && grupo.alto)) p.push({ codigo: 'grupo-sin-medida' })
  if (miembros.length < 2) p.push({ codigo: 'grupo-una-valla' })
  if (new Set(miembros.map((v) => v.sitioId)).size > 1) p.push({ codigo: 'grupo-varios-sitios' })
  return p
}
