import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  crearCreatividad,
  setCreativosDeReserva,
  repartirCreativosEnCampana,
  CreatividadError,
} from './creativos-repo'
import { LIMITES, validarUpload } from './uploads'

// ============================================================================
//  lib/server/creativos-controller.ts — Alta de creativos y asignación a
//  reservas. Valida la entrada (zod) y mapea CreatividadError a HTTP.
// ============================================================================

// El arte del creativo llega por dos vías y cada una tiene su límite (Bloque D):
//   · archivoUrl → imagen subida como data URL (15 MB, JPG/PNG/WebP)
//   · codigo     → creativo HTML, texto plano (2 MB)
// `archivoUrl` también admite una URL http(s) normal (arte ya hospedado): en ese
// caso no hay nada que validar aquí, solo se comprueba que sea una URL. La
// validación de subida se dispara ÚNICAMENTE cuando el valor es un data URL.
const archivoCreatividad = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const fallo = (message: string, status?: number) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, ...(status ? { params: { status } } : {}) })
    if (!v.startsWith('data:')) {
      if (!/^https?:\/\//i.test(v)) fallo('El arte debe ser una imagen subida o una URL http(s)')
      return
    }
    try {
      validarUpload({
        base64: v,
        allowlist: LIMITES.creatividadImagen.allowlist,
        maxMB: LIMITES.creatividadImagen.maxMB,
        campo: 'arte',
      })
    } catch (e) {
      // Archivo inválido → 422 (el resto de la forma del creativo está bien).
      fallo(e instanceof AppError ? e.message : 'Arte inválido', e instanceof AppError ? e.status : 422)
    }
  })

// El HTML se almacena como TEXTO y se escapa al renderizar (nunca
// dangerouslySetInnerHTML sin sandbox). Aquí solo se acota su tamaño.
const MAX_CODIGO_BYTES = LIMITES.creatividadHtml.maxMB * 1024 * 1024
const codigoCreatividad = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (Buffer.byteLength(v, 'utf8') > MAX_CODIGO_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El código del creativo supera el límite de ${LIMITES.creatividadHtml.maxMB} MB`,
        params: { status: 422 },
      })
    }
  })

const crearSchema = z
  .object({
    campanaId: z.string().min(1, 'La campaña es requerida'),
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    archivoUrl: archivoCreatividad.nullish(),
    codigo: codigoCreatividad.nullish(),
    formato: z.string().trim().nullish(),
    resolucion: z.string().trim().nullish(),
  })
  .refine((d) => !!(d.archivoUrl || d.codigo), {
    message: 'Falta la imagen o el código del creativo',
    path: ['archivoUrl'],
  })

export async function crearCreatividadCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  try {
    return await crearCreatividad({
      campanaId: d.campanaId,
      nombre: d.nombre,
      archivoUrl: d.archivoUrl ?? null,
      codigo: d.codigo ?? null,
      formato: d.formato ?? null,
      resolucion: d.resolucion ?? null,
    })
  } catch (e) {
    if (e instanceof CreatividadError) throw new AppError(e.message, 409)
    throw e
  }
}

// Reemplazo de arte (PUT /api/creatividades/:id). Entraba como escritura cruda
// sin zod: mismo arte, mismos límites que el alta.
const reemplazarSchema = z
  .object({
    nombre: z.string().trim().min(1).nullish(),
    archivoUrl: archivoCreatividad.nullish(),
    codigo: codigoCreatividad.nullish(),
    formato: z.string().trim().nullish(),
  })
  .refine((d) => !!(d.archivoUrl || d.codigo), {
    message: 'Falta el nuevo arte (codigo o archivoUrl)',
    path: ['archivoUrl'],
  })

export function validarReemplazoCreatividad(body: unknown) {
  const d = validar(reemplazarSchema, body ?? {})
  return {
    nombre: d.nombre ?? null,
    archivoUrl: d.archivoUrl ?? null,
    codigo: d.codigo ?? null,
    formato: d.formato ?? null,
  }
}

const asignarSchema = z.object({
  creativos: z
    .array(z.object({ creatividadId: z.string().min(1), veces: z.coerce.number().int().min(1).default(1) }))
    .default([]),
})

export async function setCreativosReservaCtrl(reservaId: string, body: unknown) {
  const d = validar(asignarSchema, body ?? {})
  const creativos = (d.creativos ?? []).map((c) => ({ creatividadId: c.creatividadId, veces: c.veces ?? 1 }))
  const res = await setCreativosDeReserva(reservaId, creativos)
  if (!res) throw new AppError('Reserva no encontrada', 404)
  return { creativos: res }
}

// Reparto masivo a todas las pantallas digitales de la campaña.
//
// `creatividadIds` va ORDENADO y el orden importa: cuando los spots no dividen
// exacto, el resto va a los primeros. Por eso es un arreglo y no un conjunto.
//
// `soloVacias` por defecto en `false`: quien pulsa «repartir» normalmente quiere
// que quede repartido, no un resultado a medias. La UI ofrece el otro modo y
// avisa de que sobrescribe.
const repartirSchema = z.object({
  creatividadIds: z.array(z.string().uuid()).min(1, 'Elige al menos un creativo'),
  soloVacias: z.coerce.boolean().default(false),
})

export async function repartirCreativosCtrl(campanaId: string, body: unknown) {
  const d = validar(repartirSchema, body ?? {})
  const res = await repartirCreativosEnCampana(campanaId, d.creatividadIds, d.soloVacias ?? false)
  if (!res) throw new AppError('Campaña no encontrada', 404)
  return res
}
