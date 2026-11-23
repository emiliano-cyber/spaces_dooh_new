import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  crearImprenta,
  actualizarImprenta,
  imprentaUsable,
  ImprentaError,
  IMPRENTA_NO_ENCONTRADA,
  IMPRENTA_AJENA,
} from './imprentas-repo'
import { asignarImprentaAOrden } from './impresion-repo'
import { FORMATOS_ARTE, RANGOS } from '@/lib/requisitos-impresion'

// ============================================================================
//  lib/server/imprentas-controller.ts — IMP-REQ (18/11). Valida con zod lo que
//  entra (los mismos rangos que el saneo de `lib/requisitos-impresion.ts`) y
//  mapea los errores del repo a HTTP.
// ============================================================================

const dpi = z.coerce.number().min(RANGOS.dpi.min).max(RANGOS.dpi.max)

/**
 * Los requisitos de arte: todos opcionales (un campo ausente cae al siguiente
 * nivel: imprenta → empresa → constantes). `.strict()` para que un campo mal
 * escrito no se ignore en silencio. Lo comparten el CRUD de imprentas y
 * `PATCH /api/config` (los de la empresa).
 */
export const requisitosSchema = z
  .object({
    dpiGranVerde: dpi,
    dpiGranAmbar: dpi,
    dpiCercanaVerde: dpi,
    dpiCercanaAmbar: dpi,
    corteGranM: z.coerce.number().min(RANGOS.corteGranM.min).max(RANGOS.corteGranM.max),
    margenCm: z.coerce.number().min(RANGOS.margenCm.min).max(RANGOS.margenCm.max),
    formatos: z.array(z.enum(FORMATOS_ARTE)).max(FORMATOS_ARTE.length),
  })
  .partial()
  .strict()
  .refine((r) => r.dpiGranAmbar === undefined || r.dpiGranVerde === undefined || r.dpiGranAmbar <= r.dpiGranVerde, {
    message: 'El mínimo aceptable no puede ser mayor que el recomendado',
    path: ['dpiGranAmbar'],
  })
  .refine(
    (r) => r.dpiCercanaAmbar === undefined || r.dpiCercanaVerde === undefined || r.dpiCercanaAmbar <= r.dpiCercanaVerde,
    { message: 'El mínimo aceptable no puede ser mayor que el recomendado', path: ['dpiCercanaAmbar'] },
  )

const nombre = z.string().trim().min(1, 'El nombre es requerido').max(120, 'El nombre no puede pasar de 120 caracteres')

const crearSchema = z.object({ nombre, requisitos: requisitosSchema.optional() }).strict()
const actualizarSchema = z
  .object({ nombre, requisitos: requisitosSchema, activo: z.boolean() })
  .partial()
  .strict()
const asignarSchema = z.object({ imprentaId: z.string().uuid().nullable() }).strict()

function mapear(e: unknown): never {
  if (e instanceof ImprentaError) throw new AppError(e.message, e.status)
  throw e
}

export async function crearImprentaCtrl(body: unknown) {
  const d = validar(crearSchema, body ?? {})
  try {
    return await crearImprenta(d)
  } catch (e) {
    mapear(e)
  }
}

export async function actualizarImprentaCtrl(id: string, body: unknown) {
  const d = validar(actualizarSchema, body ?? {})
  try {
    const r = await actualizarImprenta(id, d)
    if (!r) throw new AppError(IMPRENTA_NO_ENCONTRADA, 404)
    return r
  } catch (e) {
    mapear(e)
  }
}

/** La imprenta de una orden de impresión (null = quitarla). */
export async function asignarImprentaCtrl(ordenId: string, body: unknown) {
  const d = validar(asignarSchema, body ?? {})
  if (d.imprentaId && !(await imprentaUsable(d.imprentaId))) throw new AppError(IMPRENTA_AJENA, 400)
  const oi = await asignarImprentaAOrden(ordenId, d.imprentaId)
  if (!oi) throw new AppError('Orden no encontrada', 404)
  return oi
}

/** Para el alta de una orden: comprueba la imprenta si viene. */
export async function comprobarImprentaDeOrden(imprentaId: unknown): Promise<string | null> {
  if (imprentaId == null || imprentaId === '') return null
  // El formato se mira antes de preguntar: un id que no es uuid haría fallar
  // el cast de Postgres con un 500 en vez de un 400.
  if (typeof imprentaId !== 'string' || !/^[0-9a-f-]{36}$/i.test(imprentaId) || !(await imprentaUsable(imprentaId))) {
    throw new AppError(IMPRENTA_AJENA, 400)
  }
  return imprentaId
}
