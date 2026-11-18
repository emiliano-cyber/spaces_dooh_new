import 'server-only'
import type { NextResponse } from 'next/server'
import type { UsuarioSesion } from './auth'
import { AppError, respuestaError } from './errores'
import { soloDe } from './oportunidades-controller'
import { propuestaAjena, renglonAjeno } from './propuestas-repo'

// ============================================================================
//  lib/server/propuestas-visibilidad.ts — Quién ve qué propuesta.
//  ADR 0051, decisión del dueño del 17/11: «sus propuestas el vendedor, el
//  resto todas».
// ----------------------------------------------------------------------------
//  La misma regla que las oportunidades (y que Captación con su permiso): quien
//  tiene `comercial.aprobar` ve todas; el resto, solo las que llevan su
//  `usuario_id`. Una ajena es 404, no 403.
//
//  Las rutas por `id` llaman a `siNoEsSuya` ANTES de hacer nada, y si devuelve
//  una respuesta, la devuelven tal cual. La liga pública NO pasa por aquí: la
//  abre quien tiene el token, que es el cliente.
// ============================================================================

export const soloDePropuestas = soloDe

const NO_ENCONTRADA = 'Propuesta no encontrada'
// Estas comprobaciones corren FUERA del `try` de cada ruta: un id que no es
// uuid haría reventar la consulta con un 500. Se contesta 404 sin preguntar.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 404 si la propuesta es de otro vendedor (o no existe aquí); null si puede seguir. */
export async function siNoEsSuya(u: UsuarioSesion, propuestaId: string): Promise<NextResponse | null> {
  if (!UUID.test(propuestaId)) return respuestaError(new AppError(NO_ENCONTRADA, 404))
  return (await propuestaAjena(propuestaId, await soloDe(u))) ? respuestaError(new AppError(NO_ENCONTRADA, 404)) : null
}

/** Igual, por el id de un renglón (`/api/propuestas/items/[id]`). */
export async function siElRenglonNoEsSuyo(u: UsuarioSesion, itemId: string): Promise<NextResponse | null> {
  if (!UUID.test(itemId)) return respuestaError(new AppError(NO_ENCONTRADA, 404))
  return (await renglonAjeno(itemId, await soloDe(u))) ? respuestaError(new AppError(NO_ENCONTRADA, 404)) : null
}
