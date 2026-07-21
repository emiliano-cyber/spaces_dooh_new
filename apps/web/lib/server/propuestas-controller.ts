import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearPropuesta, aprobarItem, PropuestaError, type PropuestaInput } from './propuestas-repo'
import { cantidadEfectiva, precioItem, UNIDADES, type Unidad } from '@/lib/periodos'

// ============================================================================
//  lib/server/propuestas-controller.ts — Alta de propuestas y aprobación de sus
//  sitios. La economía (divisor/snapshot/guard $0) vive en el model; aquí se
//  valida la forma de entrada. PropuestaError → HTTP.
//
//  Contratación por tiempo: cada ítem lleva unidad (mes/semana/día/spot/hora),
//  su tarifa por unidad y —opcional— la programación de spots (spots/día). El
//  PRECIO se calcula AQUÍ en el servidor (tarifa × cantidad), no se confía en el
//  que manda el cliente, para que la UI no pueda inflar/bajar el precio de lista.
// ============================================================================

const UNIDADES_VALIDAS = UNIDADES.map((u) => u.unidad) as [Unidad, ...Unidad[]]

// Campos numéricos opcionales: el front manda `null` cuando no aplican (p. ej.
// spots/día vacío), así que van con `.nullish()` — `.optional()` solo aceptaría
// `undefined` y `z.coerce.number()` convertiría null→0, fallando en `.positive()`.
const itemSchema = z.object({
  sitioId: z.string().min(1),
  unidad: z.enum(UNIDADES_VALIDAS).optional(),
  tarifaUnitaria: z.coerce.number().nonnegative().nullish(),
  // Cantidad manual (solo se usa para spot/hora; las unidades de tiempo la
  // derivan del rango). Para tiempo se ignora.
  cantidad: z.coerce.number().positive().nullish(),
  spotsPorDia: z.coerce.number().int().positive().nullish(),
  // Precio directo (compatibilidad hacia atrás / propuestas sin unidad).
  precio: z.coerce.number().nonnegative().nullish(),
})

const crearSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    clienteId: z.string().nullish(),
    agenciaId: z.string().nullish(),
    comisionPct: z.coerce.number().min(0).max(100).optional(),
    fechaInicio: z.string().min(1, 'Fecha de inicio requerida'),
    fechaFin: z.string().min(1, 'Fecha de fin requerida'),
    items: z.array(itemSchema).min(1, 'Agrega al menos un sitio'),
    notas: z.string().nullish(),
  })
  .refine((d) => new Date(d.fechaFin) >= new Date(d.fechaInicio), {
    message: 'La fecha fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  })

export async function crearPropuestaCtrl(body: unknown) {
  const d = validar(crearSchema, body)

  // Normaliza cada ítem a la forma persistida, calculando cantidad y precio en
  // el servidor a partir de la unidad y la tarifa por unidad.
  const items = d.items.map((it) => {
    // Sin unidad → modo compatible: precio directo, unidad mensual, cantidad 1.
    if (!it.unidad || it.tarifaUnitaria == null) {
      const precio = it.precio ?? 0
      return {
        sitioId: it.sitioId,
        unidad: (it.unidad ?? 'mensual') as Unidad,
        tarifaUnitaria: precio,
        cantidad: 1,
        spotsPorDia: it.spotsPorDia ?? null,
        precio,
      }
    }
    const cantidad = cantidadEfectiva(it.unidad, d.fechaInicio, d.fechaFin, it.cantidad)
    return {
      sitioId: it.sitioId,
      unidad: it.unidad,
      tarifaUnitaria: it.tarifaUnitaria,
      cantidad,
      spotsPorDia: it.spotsPorDia ?? null,
      precio: precioItem(it.tarifaUnitaria, cantidad),
    }
  })

  try {
    return await crearPropuesta({ ...d, items } as PropuestaInput)
  } catch (e) {
    if (e instanceof PropuestaError) throw new AppError(e.message, 400)
    throw e
  }
}

const aprobarSchema = z.object({ aprobado: z.boolean().default(false) })

export async function aprobarItemCtrl(itemId: string, body: unknown) {
  const d = validar(aprobarSchema, body ?? {})
  try {
    const prop = await aprobarItem(itemId, !!d.aprobado)
    if (!prop) throw new AppError('Ítem no encontrado', 404)
    return prop
  } catch (e) {
    if (e instanceof PropuestaError) throw new AppError(e.message, 409)
    throw e
  }
}
