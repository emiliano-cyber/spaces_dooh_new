import 'server-only'
import { qRaw1, qConTenant } from './db'
import { generarCodigos, hashDeCodigo } from './codigos-recuperacion'

//  lib/server/codigos-recuperacion-repo.ts — la tabla de los códigos. (ADR 0028)
// ----------------------------------------------------------------------------
//  Mismas dos reglas que `password-reset-repo.ts`, y por la misma razón — es
//  otro secreto PRE-SESIÓN, o sea que se usa justo cuando todavía no se sabe de
//  qué organización es quien pregunta:
//
//    · LEER va por `auth_codigo_recuperacion()`, SECURITY DEFINER, porque
//      resolver un código ocurre ANTES de que exista sesión y contexto de
//      tenant. La RLS no puede ayudar todavía.
//    · ESCRIBIR va por `qConTenant`, porque para entonces el tenant YA se
//      conoce: del usuario al generarlos, y de la propia fila al consumirlos.
//
//  >>> SI ALGUIEN DEVUELVE ALGUNO DE ESTOS ACCESOS A `qRaw`, EL FLUJO NO FALLA:
//  >>> devuelve cero filas EN SILENCIO. Es exactamente el modo de fallo de R2 —
//  >>> el que dejó el desbloqueo de usuarios inservible un despliegue entero— y
//  >>> aquí significaría que el Dueño se queda fuera de su propia instancia sin
//  >>> que nada dé un error.

/** Lo que la función pre-sesión devuelve de un código. */
type CodigoRow = {
  usuario_id: string
  tenant_id: string
  usado_en: string | null
}

/** El resultado de intentar usar un código. */
export type ResultadoCodigo =
  | { ok: true; usuarioId: string; tenantId: string; quedan: number }
  // `motivo` se distingue a propósito: «ya usado» NO es lo mismo que «no
  // existe». Que alguien presente un código que YA se gastó significa que
  // tiene una lista vieja del Dueño, y eso merece quedar anotado.
  | { ok: false; motivo: 'no-existe' | 'ya-usado' }

/**
 * Genera un lote nuevo para un usuario e **invalida los anteriores**.
 *
 * Devuelve los códigos EN CLARO, y es la única vez que existen fuera del
 * navegador de su dueño: no se guardan, no se registran y no se devuelven nunca
 * más. Quien llame a esto tiene que enseñarlos y olvidarlos.
 */
export async function generarLote(usuarioId: string, tenantId: string): Promise<string[]> {
  const codigos = generarCodigos()

  // Los de antes dejan de valer. Se BORRAN en vez de marcarse usados: un código
  // reemplazado no se «gastó», y confundir las dos cosas emborronaría el rastro
  // de quién entró por esta puerta.
  await qConTenant(tenantId, `delete from codigos_recuperacion where usuario_id = $1`, [usuarioId])

  for (const codigo of codigos) {
    await qConTenant(
      tenantId,
      `insert into codigos_recuperacion (codigo_hash, usuario_id, tenant_id)
       values ($1, $2, $3)`,
      [hashDeCodigo(codigo), usuarioId, tenantId],
    )
  }
  return codigos
}

/** Cuántos le quedan sin usar. Para poder avisarle antes de que se quede sin. */
export async function cuantosQuedan(usuarioId: string, tenantId: string): Promise<number> {
  const row = await qConTenant<{ n: string }>(
    tenantId,
    `select count(*)::text as n from codigos_recuperacion
      where usuario_id = $1 and usado_en is null`,
    [usuarioId],
  )
  return Number(row?.[0]?.n ?? 0)
}

/**
 * Usa un código: lo resuelve, comprueba que no estaba usado y lo marca.
 *
 * **No invalida los demás**, y esa es la diferencia deliberada con un reset de
 * contraseña. Allí consumir uno invalida el resto porque el usuario ya recuperó
 * el acceso; aquí, invalidar el resto dejaría al Dueño con una sola vida
 * después del primer uso.
 */
export async function usarCodigo(codigo: string): Promise<ResultadoCodigo> {
  const hash = hashDeCodigo(codigo)
  // `hashDeCodigo` devuelve `''` para un código inutilizable. Se corta aquí:
  // buscar por cadena vacía sería buscar por un valor que alguien podría llegar
  // a insertar.
  if (!hash) return { ok: false, motivo: 'no-existe' }

  const row = await qRaw1<CodigoRow>(`select * from auth_codigo_recuperacion($1)`, [hash])
  if (!row) return { ok: false, motivo: 'no-existe' }
  if (row.usado_en) return { ok: false, motivo: 'ya-usado' }

  // Marcado condicional: `and usado_en is null` en el propio UPDATE, para que
  // dos peticiones simultáneas con el mismo código no lo gasten las dos. La
  // comprobación de arriba no basta —entre leer y escribir cabe otra petición—
  // y este es el único sitio donde eso se decide.
  const marcadas = await qConTenant<{ codigo_hash: string }>(
    row.tenant_id,
    `update codigos_recuperacion set usado_en = now()
      where codigo_hash = $1 and usado_en is null
      returning codigo_hash`,
    [hash],
  )
  if (marcadas.length === 0) return { ok: false, motivo: 'ya-usado' }

  return {
    ok: true,
    usuarioId: row.usuario_id,
    tenantId: row.tenant_id,
    quedan: await cuantosQuedan(row.usuario_id, row.tenant_id),
  }
}
