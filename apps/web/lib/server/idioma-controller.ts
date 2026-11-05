import 'server-only'
import { AppError } from './errores'
import { guardarIdiomaPreferido, idiomaPreferidoPropio } from './usuarios-repo'
import { idiomasActivos, preferenciaDeIdioma, normalizarIdioma, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idioma-controller.ts — el idioma de la interfaz que la persona
//  en sesión elige para SU cuenta (IDIOMA-USUARIO, 03/11).
// ----------------------------------------------------------------------------
//  Solo la propia cuenta: el id sale de la SESIÓN, nunca del cuerpo, y el repo
//  filtra además por el tenant de la sesión. No hay forma de pedir ni de
//  cambiar el idioma de otra persona, y es a propósito: es una preferencia, no
//  algo que un administrador decida por nadie.
//
//  Lo que se puede elegir son los idiomas ENCENDIDOS (`idiomasActivos()`).
//  Entre la ola 0 del portugues y P3 (05/11) se quitaba `pt` aunque estuviera
//  encendido, porque el CHECK de `usuarios.idioma_preferido` no lo aceptaba;
//  con eso, una persona con una preferencia guardada no podia llegar al
//  portugues (H1 de la validacion de la ola 0). `20261105_idioma_portugues.sql`
//  abrio el CHECK y la restriccion se retiro.
// ============================================================================

export type RespuestaIdioma = {
  /** Lo guardado en la cuenta, si está ENCENDIDO; `null` = sigue al navegador. */
  preferido: Idioma | null
  /** Los idiomas que se pueden elegir en esta instancia. */
  disponibles: Idioma[]
}

export async function leerIdiomaCtrl(usuarioId: string): Promise<RespuestaIdioma> {
  const disponibles = idiomasActivos()
  // Una preferencia de un idioma APAGADO se trata como «sin preferencia»: la
  // pantalla no lo ofrece y el servidor no lo aplica. No se borra: si vuelven a
  // encenderlo, la persona lo recupera.
  const preferido = normalizarIdioma(await idiomaPreferidoPropio(usuarioId), disponibles)
  return { preferido, disponibles }
}

export async function guardarIdiomaCtrl(usuarioId: string, body: unknown): Promise<RespuestaIdioma> {
  const disponibles = idiomasActivos()
  const valor = (body as { idioma?: unknown } | null)?.idioma
  const p = preferenciaDeIdioma(valor === undefined ? undefined : valor, disponibles)
  if (!p.ok) throw new AppError('Ese idioma no está disponible en este servidor.', 400)
  const hubo = await guardarIdiomaPreferido(usuarioId, p.idioma)
  // La fila es la de la sesión: si no se tocó, la cuenta dejó de existir (o de
  // ser de este tenant) entre la sesión y aquí.
  if (!hubo) throw new AppError('No encontrado', 404)
  return { preferido: p.idioma, disponibles }
}
