// ============================================================================
//  lib/vallas/plano-publico.ts — EL PLANO EN LA LIGA DEL CLIENTE (dueño, 20/11).
// ----------------------------------------------------------------------------
//  «En la liga que se le manda al cliente también debe estar, si es valla, cómo
//  se ven las pantallas que rentará, si es más de 1; si solo es una, entonces
//  sin tema, como se encuentra actualmente.»
//
//  La forma que manda el servidor en `GET /api/propuestas/publica/<token>`
//  (campo `planoVallas`, solo con MÁS DE UNA valla activa) y cómo se convierte
//  en el plano de siempre (`armarPlano`). Puro: sin servidor ni React.
//
//  Qué NO trae, a propósito: ocupación (marcas, campañas, clientes de otros),
//  notas, ids internos. Los ids de vallas y grupos son OPACOS («v1», «g1»),
//  solo sirven para unir valla con grupo dentro de esta respuesta. El
//  `sitioId` es el mismo que la liga ya expone en `items[].sitioId`.
//  `sigueFuera` dice que el grupo continúa en un sitio que NO es de la
//  propuesta, sin decir cuál.
// ============================================================================

import { armarPlano, type SitioPlano } from './plano'
import type { Dobla, ModoGrupo } from './tipos'

export type VallaLiga = {
  id: string
  sitioId: string
  numero: string
  cara: number | null
  ancho: number
  alto: number
  grupoId: string | null
  posicion: number | null
  dobla: Dobla | null
}

export type GrupoLiga = {
  id: string
  numero: string
  nombre: string | null
  modo: ModoGrupo
  sigueFuera: boolean
}

export type PlanoVallasLiga = {
  sitios: { id: string; nombre: string }[]
  vallas: VallaLiga[]
  grupos: GrupoLiga[]
}

/** La regla del dueño: el plano solo con MÁS de una valla. */
export const MINIMO_VALLAS_PLANO_LIGA = 2

export function mostrarPlanoEnLiga(p: PlanoVallasLiga | null | undefined): p is PlanoVallasLiga {
  return !!p && Array.isArray(p.vallas) && p.vallas.length >= MINIMO_VALLAS_PLANO_LIGA
}

/** El plano de siempre, sin ocupación: el cliente solo ve SUS vallas. */
export function planoDesdeLiga(p: PlanoVallasLiga): SitioPlano[] {
  return armarPlano({
    vallas: p.vallas.map((v) => ({ ...v, notas: null, activo: true })),
    grupos: p.grupos.map((g) => ({
      id: g.id,
      numero: g.numero,
      nombre: g.nombre,
      modo: g.modo,
      ancho: null,
      alto: null,
      notas: null,
      activo: true,
    })),
    sitios: p.sitios,
    ocupaciones: [],
    gruposQueSiguenFuera: p.grupos.filter((g) => g.sigueFuera).map((g) => g.id),
  })
}
