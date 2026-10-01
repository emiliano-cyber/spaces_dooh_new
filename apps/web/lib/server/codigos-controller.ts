import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { motivoCodigoInvalido, normalizarCodigo } from '@/lib/codigo-promocional'
import {
  listarCodigos,
  guardarCodigo,
  borrarCodigo,
  canjearCodigo,
  quitarCodigo,
  decidirCodigo,
  leerCodigoDePropuesta,
  CanjeImposible,
  DecisionImposible,
} from './codigos-repo'

// ============================================================================
//  lib/server/codigos-controller.ts — La forma de entrada de los códigos
//  promocionales y de su canje.  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  ⚠️ EL CANJE NO ACEPTA MÁS QUE EL CÓDIGO TECLEADO, Y ÉSE ES TODO EL PUNTO.
//
//  `canjeSchema` declara **un solo campo**: `codigo`. No hay `descuentoPct`, ni
//  `porcentaje`, ni `importe`, ni `validado`. Si la pantalla mandara el
//  porcentaje, el cupón dejaría de ser un cupón: cualquiera cerraría una venta
//  con un 90 % «promocional» mandando un `curl`, y quedaría congelada en el
//  snapshot con toda la apariencia de ser auditable.
//
//  Es el mismo candado que el vendedor de VEND-01 y que el volumen de VOL-01, y
//  `codigos-canje.test.ts` lee ESTE archivo para impedir que alguien añada el
//  campo sin darse cuenta.
//
//  Y conviene decir por qué se insiste: la `tarifaUnitaria` de la Fase 1 SÍ se
//  copia tal cual de lo que manda el navegador (hallazgo B40). Esta fase no
//  arregla aquello —es la decisión D11, del dueño— pero **no lo amplía**: la
//  vigencia y el tope de usos de un cupón son un reloj y un contador, y ninguno
//  de los dos puede vivir en el navegador de quien vende.
//
//  NINGÚN `tenantId` entra por el cuerpo. El repo lo saca de la sesión.
// ============================================================================

const codigoSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  // Acotado aquí solo para que nada desmedido llegue a las frases de
  // `motivoCodigoInvalido`, que son las que dicen QUÉ hacer. El formato fino
  // —letras, números y guiones— se valida allí y además en el CHECK de la base.
  codigo: z.string().trim().min(1).max(64),
  descuentoPct: z.coerce.number().finite().min(-1000).max(1000),
  vigenteDesde: z.string().trim().min(1).max(10),
  vigenteHasta: z.string().trim().min(1).max(10),
  // `null` es «sin tope», y es distinto de no mandarlo. `nullish` acepta los
  // dos y abajo se normalizan al mismo valor.
  usosMaximos: z.coerce.number().finite().min(-1_000_000).max(1_000_000).nullish(),
})

export async function listarCodigosCtrl() {
  return { codigos: await listarCodigos() }
}

/**
 * Alta o edición de un cupón.
 *
 * SE COMPARA CONTRA TODOS LOS CUPONES DE LA ORGANIZACIÓN, y la comparación es
 * insensible a mayúsculas. El choque lo rechaza ADEMÁS el `unique` de la base
 * sobre `upper(codigo)`; esto es para que se lea una frase en vez de un error
 * de restricción, y aquél es el que de verdad cierra el agujero — una
 * validación es algo que alguien puede olvidar en la siguiente ruta.
 */
export async function guardarCodigoCtrl(body: unknown) {
  const d = validar(codigoSchema, body)
  const candidato = {
    id: d.id ?? '',
    // Se guarda NORMALIZADO, en mayúsculas. Es lo que se teclea, lo que se
    // imprime en la publicidad y lo que se busca; guardarlo con la
    // capitalización de quien lo capturó haría que la pantalla enseñara
    // `Verano20` y el cliente tecleara `VERANO20`, y aunque el canje funciona
    // igual, dos formas del mismo código en pantalla se leen como dos cupones.
    codigo: normalizarCodigo(d.codigo),
    descuentoPct: d.descuentoPct,
    vigenteDesde: d.vigenteDesde,
    vigenteHasta: d.vigenteHasta,
    usosMaximos: d.usosMaximos ?? null,
  }
  const otros = await listarCodigos()
  const motivo = motivoCodigoInvalido(candidato, otros)
  if (motivo) throw new AppError(motivo, 400)

  const guardado = await guardarCodigo({
    id: d.id,
    codigo: candidato.codigo,
    descuentoPct: candidato.descuentoPct,
    vigenteDesde: candidato.vigenteDesde,
    vigenteHasta: candidato.vigenteHasta,
    usosMaximos: candidato.usosMaximos,
  })
  // 404 y no 403: decir «existe pero no es tuyo» ya cuenta algo de otra
  // organización.
  if (!guardado) throw new AppError('Ese codigo no existe en esta organizacion', 404)
  return guardado
}

export async function borrarCodigoCtrl(id: string) {
  const ok = await borrarCodigo(id)
  if (!ok) throw new AppError('Ese codigo no existe en esta organizacion', 404)
  return { ok: true }
}

/**
 * EL ESQUEMA DEL CANJE. Un solo campo, y es deliberado — ver la cabecera.
 *
 * `max(64)` y no sin tope: sin él, un rechazo devolvería al cliente lo que él
 * mismo mandó, y el mensaje NOMBRA el código para poder diagnosticarlo.
 */
const canjeSchema = z.object({ codigo: z.string().trim().min(1).max(64) })

/**
 * Aplica un código a una propuesta.
 *
 * Todo lo que decide si se puede —que exista, que esté vigente, que le queden
 * usos— lo resuelve `canjearCodigo` contra la base, con la fila del cupón
 * bloqueada. Aquí solo se comprueba la FORMA de lo que llega.
 *
 * `CanjeImposible` → 400 y no 404: el mensaje ya distingue «no existe» de
 * «venció» de «se agotó», y quien vende necesita leer cuál de las tres es. Un
 * 404 pelado le dejaría pensando que la propuesta desapareció.
 */
export async function aplicarCodigoCtrl(propuestaId: string, body: unknown) {
  const d = validar(canjeSchema, body)
  try {
    return await canjearCodigo(propuestaId, d.codigo)
  } catch (e) {
    if (e instanceof CanjeImposible) throw new AppError(e.message, 400)
    throw e
  }
}

/** Quita el código de una propuesta y devuelve el uso al cupón. */
export async function quitarCodigoCtrl(propuestaId: string) {
  try {
    const ok = await quitarCodigo(propuestaId)
    if (!ok) throw new AppError('Esa propuesta no tiene ningun codigo aplicado', 404)
    return { ok: true }
  } catch (e) {
    if (e instanceof CanjeImposible) throw new AppError(e.message, 409)
    throw e
  }
}

/**
 * COD-03 · EL ESQUEMA DE LA DECISIÓN de un gerente sobre el cupón pendiente.
 *
 * `.strict()` en las DOS ramas, y es el mismo candado que `canjeSchema` por el
 * otro lado: aprobar no admite ni un campo más. Sin él, un cuerpo
 * `{ decision: 'APROBAR', descuentoPct: 90 }` pasaría (zod descarta lo que no
 * conoce) y hoy no haría nada — pero el día que alguien añada un campo «para
 * ajustar el porcentaje al aprobar», la ruta ya lo estaría aceptando de
 * cualquiera con `comercial.aprobar`. Con `.strict()` ese día empieza en rojo.
 *
 * Tampoco hay `aprobadoPor`: quién aprobó sale de la sesión, nunca del cuerpo.
 *
 * El motivo es OBLIGATORIO al rechazar y no se admite al aprobar: rechazar le
 * quita a alguien un descuento que el vendedor ya ofreció, y seis meses
 * después «lo rechazó Fulano» sin el porqué no se puede explicar. Acotado a
 * 500 para que no se convierta en una caja de texto libre dentro de la
 * bitácora.
 */
const decisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APROBAR') }).strict(),
  z.object({ decision: z.literal('RECHAZAR'), motivo: z.string().trim().min(3).max(500) }).strict(),
])

/** Aprueba o rechaza el cupón pendiente. 404 si no es de esta organización. */
export async function decidirCodigoCtrl(propuestaId: string, body: unknown) {
  const d = validar(decisionSchema, body)
  try {
    const r = await decidirCodigo(propuestaId, d)
    if (!r) throw new AppError('Esa propuesta no existe en esta organizacion', 404)
    return r
  } catch (e) {
    // 409 y no 400: la petición está bien formada; lo que choca es el ESTADO
    // (ya aprobado, sin cupón, propuesta firmada).
    if (e instanceof DecisionImposible) throw new AppError(e.message, 409)
    throw e
  }
}

/** El cupón de la propuesta para la pantalla interna. 404 si no es de aquí. */
export async function leerCodigoCtrl(propuestaId: string) {
  const r = await leerCodigoDePropuesta(propuestaId)
  if (!r) throw new AppError('Esa propuesta no existe en esta organizacion', 404)
  return r
}
