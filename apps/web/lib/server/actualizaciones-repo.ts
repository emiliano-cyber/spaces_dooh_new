import 'server-only'
import { qRaw, qRaw1 } from './db'
import { AppError } from './errores'

// ============================================================================
//  lib/server/actualizaciones-repo.ts — El buzón entre el dueño y update.sh.
//  ADR 0037: cada instancia elige si toma la versión nueva.
// ----------------------------------------------------------------------------
//  `actualizaciones_instancia` NO tiene `tenant_id` y no lleva RLS: describe
//  el DROPLET, no una organización de dentro (es hermana de
//  `schema_migrations`, no de `config_negocio`). Por eso todo este archivo usa
//  `qRaw`/`qRaw1` — sin fijar `app.tenant_id` — en vez de `q`/`q1`. Fijar un
//  GUC de tenant aquí no protegería nada y confundiría al siguiente lector,
//  haciéndole pensar que hay una RLS que no existe.
//
//  La defensa real de qué puede escribir la app vive en el GRANT por columna
//  de `db/migrations/20260921_actualizaciones_instancia.sql`: aunque este
//  archivo tuviera un bug y intentara escribir `digest_disponible`, Postgres
//  lo rechazaría con `42501` (sin permiso de UPDATE en esa columna para
//  `spaces_app`), que `respuestaError()` traduce a 403. Este archivo es la
//  SEGUNDA capa, no la única — por eso el PATCH del route también usa
//  `.strict()`: da 400 en vez de dejar que Postgres lo descubra.
// ============================================================================

export interface FilaActualizacion {
  modo: string
  version_instalada: string | null
  digest_instalado: string | null
  version_disponible: string | null
  digest_disponible: string | null
  migraciones_pendientes: number | null
  comprobado_en: string | Date | null
  aprobado_digest: string | null
}

export async function obtenerFilaActualizacion(): Promise<FilaActualizacion> {
  const fila = await qRaw1<FilaActualizacion>(
    `select modo, version_instalada, digest_instalado, version_disponible,
            digest_disponible, migraciones_pendientes, comprobado_en, aprobado_digest
       from actualizaciones_instancia
      where id = true`,
  )
  // No debería poder pasar: la migración inserta la única fila con
  // `on conflict (id) do nothing`. Si pasa, es una instancia con la migración
  // sin aplicar, y eso es un 500 de verdad, no un dato ausente que el
  // frontend deba aprender a tolerar.
  if (!fila) throw new AppError('No hay fila de actualizaciones: falta la migracion 20260921', 500)
  return fila
}

export async function fijarModo(modo: 'automatica' | 'aprobacion'): Promise<void> {
  await qRaw(
    `update actualizaciones_instancia set modo = $1, actualizado_en = now() where id = true`,
    [modo],
  )
}

// Aprueba un digest — pero SOLO si en ESTE instante sigue siendo el
// disponible. La comprobación y la escritura son ATÓMICAS (un solo UPDATE con
// el digest en el WHERE): entre leer «cuál es el disponible» y escribir la
// aprobación no cabe una corrida de `update.sh --comprobar` cambiándolo por
// debajo. Sin esa atomicidad, la ventana entre las dos consultas sería
// exactamente el fallo silencioso que el ADR 0037 existe para cerrar.
export async function aprobarDigest(digest: string, usuarioId: string | null): Promise<void> {
  const filas = await qRaw(
    `update actualizaciones_instancia
        set aprobado_digest = $1, aprobado_por = $2, aprobado_en = now(), actualizado_en = now()
      where id = true and digest_disponible = $1
      returning id`,
    [digest, usuarioId],
  )
  if (filas.length === 0) {
    throw new AppError(
      'Ese digest ya no es el disponible: se publico una version nueva mientras tanto',
      409,
    )
  }
}
