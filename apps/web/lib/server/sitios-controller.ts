import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { actualizarSitio, borrarSitio, toggleNetwork, getSitio, importarSitios } from './sitios-repo'

// ============================================================================
//  lib/server/sitios-controller.ts — Edición, borrado e importación de pantallas.
//  El model whitelistea columnas (CAMPO_COL) y usa SQL parametrizado; aquí se
//  valida la forma de la entrada y se mapean errores de FK/negocio a HTTP.
// ============================================================================

const updateSchema = z.record(z.string(), z.unknown())

export async function actualizarSitioCtrl(id: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (b.toggleNetwork) {
    const s = await toggleNetwork(id)
    if (!s) throw new AppError('No encontrado', 404)
    return { sitio: s, toggled: true }
  }
  const d = validar(updateSchema, b)
  const s = await actualizarSitio(id, d)
  if (!s) throw new AppError('No encontrado', 404)
  return { sitio: s, toggled: false }
}

export async function borrarSitioCtrl(id: string) {
  const previo = await getSitio(id)
  try {
    await borrarSitio(id)
  } catch (e) {
    // 23503 = FK: la pantalla tiene reservas / OT / impresión asociadas.
    if ((e as { code?: string })?.code === '23503') {
      throw new AppError('No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.', 409)
    }
    throw e
  }
  return previo?.nombre ?? id
}

const importSchema = z.object({
  filas: z.array(z.any()).min(1, 'No hay filas para importar'),
  modoDuplicado: z.enum(['ACTUALIZAR', 'NUEVA_VERSION']).default('ACTUALIZAR'),
  precioM2: z.coerce.number().nonnegative().nullish(),
  imagenes: z.record(z.string(), z.any()).nullish(),
})

export async function importarSitiosCtrl(body: unknown) {
  const d = validar(importSchema, body ?? {})
  return importarSitios({
    filas: d.filas,
    modoDuplicado: d.modoDuplicado ?? 'ACTUALIZAR',
    precioM2: d.precioM2 ?? null,
    imagenes: d.imagenes && typeof d.imagenes === 'object' ? (d.imagenes as Record<string, string>) : undefined,
  })
}
