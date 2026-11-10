import 'server-only'
import { AppError } from './errores'
import { idiomasDelServidor, guardarIdiomasDelServidor } from './idiomas-servidor'
import { IDIOMAS, idiomasActivos, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idiomas-servidor-controller.ts — «Idiomas del servidor».
// ----------------------------------------------------------------------------
//  Lo que se guarda es del SERVIDOR entero: en una instancia con varias
//  organizaciones (la DEMO lleva la de g500 y la `demo`), el Dueno de
//  cualquiera de ellas lo cambia para todas. Es lo pedido —«para cada
//  server»— y en el modelo de instancias soberanas un servidor es un cliente.
// ============================================================================

export interface RespuestaIdiomasServidor {
  /** Lo elegido aqui, o `null` = mandan las variables `IDIOMA_*`. */
  idiomas: Idioma[] | null
  /** Lo que hoy ofrece el servidor, venga de la base o de las variables. */
  activos: Idioma[]
}

export async function leerIdiomasServidorCtrl(): Promise<RespuestaIdiomasServidor> {
  const idiomas = await idiomasDelServidor()
  return { idiomas, activos: idiomasActivos() }
}

/** Valida el cuerpo del PUT. Exportada para las pruebas. */
export function validarIdiomasServidor(body: unknown): Idioma[] | null {
  const v = (body as { idiomas?: unknown } | null)?.idiomas
  if (v === null) return null
  if (!Array.isArray(v) || !v.every((i) => (IDIOMAS as readonly unknown[]).includes(i))) {
    throw new AppError('Los idiomas no son validos')
  }
  // El espanol va siempre: es al que cae todo texto que falte por traducir.
  return IDIOMAS.filter((i) => i === 'es' || v.includes(i))
}

export async function guardarIdiomasServidorCtrl(
  usuarioId: string,
  body: unknown,
): Promise<RespuestaIdiomasServidor> {
  const idiomas = await guardarIdiomasDelServidor(validarIdiomasServidor(body), usuarioId)
  return { idiomas, activos: idiomasActivos() }
}
