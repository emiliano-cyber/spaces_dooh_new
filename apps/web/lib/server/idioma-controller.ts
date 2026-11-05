import 'server-only'
import { AppError } from './errores'
import { guardarIdiomaPreferido, idiomaPreferidoPropio } from './usuarios-repo'
import { idiomasDeCuenta, preferenciaDeIdioma, normalizarIdioma, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idioma-controller.ts — el idioma de la interfaz que la persona
//  en sesión elige para SU cuenta (IDIOMA-USUARIO, 03/11).
// ----------------------------------------------------------------------------
//  Solo la propia cuenta: el id sale de la SESIÓN, nunca del cuerpo, y el repo
//  filtra además por el tenant de la sesión. No hay forma de pedir ni de
//  cambiar el idioma de otra persona, y es a propósito: es una preferencia, no
//  algo que un administrador decida por nadie.
//
//  Ola 0 del portugues (05/11): lo que se puede elegir es `idiomasDeCuenta()`,
//  los encendidos que CABEN en `usuarios.idioma_preferido` (CHECK es/en/it).
//  Con el portugues encendido, la cuenta no lo ofrece ni lo guarda —un `pt`
//  tumbaria el UPDATE con un 500—; se consigue con el navegador o el selector.
//  Abrir la columna es una tarea ROJA aparte. Sin el portugues encendido es
//  exactamente `idiomasActivos()`, como antes.
// ============================================================================

export type RespuestaIdioma = {
  /** Lo guardado en la cuenta, si está ENCENDIDO; `null` = sigue al navegador. */
  preferido: Idioma | null
  /** Los idiomas que se pueden elegir en esta instancia. */
  disponibles: Idioma[]
}

export async function leerIdiomaCtrl(usuarioId: string): Promise<RespuestaIdioma> {
  const disponibles = idiomasDeCuenta()
  // Una preferencia de un idioma APAGADO se trata como «sin preferencia»: la
  // pantalla no lo ofrece y el servidor no lo aplica. No se borra: si vuelven a
  // encenderlo, la persona lo recupera.
  const preferido = normalizarIdioma(await idiomaPreferidoPropio(usuarioId), disponibles)
  return { preferido, disponibles }
}

export async function guardarIdiomaCtrl(usuarioId: string, body: unknown): Promise<RespuestaIdioma> {
  const disponibles = idiomasDeCuenta()
  const valor = (body as { idioma?: unknown } | null)?.idioma
  const p = preferenciaDeIdioma(valor === undefined ? undefined : valor, disponibles)
  if (!p.ok) throw new AppError('Ese idioma no está disponible en este servidor.', 400)
  const hubo = await guardarIdiomaPreferido(usuarioId, p.idioma)
  // La fila es la de la sesión: si no se tocó, la cuenta dejó de existir (o de
  // ser de este tenant) entre la sesión y aquí.
  if (!hubo) throw new AppError('No encontrado', 404)
  return { preferido: p.idioma, disponibles }
}
