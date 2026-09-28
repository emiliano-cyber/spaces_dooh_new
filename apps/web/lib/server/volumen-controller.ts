import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { motivoTramoInvalido, type TramoVolumen } from '@/lib/volumen'
import { UNIDADES, type Unidad } from '@/lib/periodos'
import {
  listarEscalasVolumen,
  guardarTramoVolumen,
  borrarTramoVolumen,
} from './volumen-repo'

// ============================================================================
//  lib/server/volumen-controller.ts — La forma de entrada de la escala de
//  volumen y la aplicación de sus reglas.  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  Las REGLAS viven en `lib/volumen.ts`, que es puro y no sabe nada de la base.
//  Lo que vive aquí es quién le pasa «los otros» para comparar — y ése es
//  exactamente el punto donde un olvido deja entrar una escala en la que
//  comprar más sale más caro.
//
//  NINGÚN `tenantId` entra por el cuerpo. El repo lo saca de la sesión. Si
//  viajara en el JSON se podría escribir la política comercial de otra
//  organización con un `curl`, y no daría ningún error: la fila escrita sería
//  coherente consigo misma, así que el `with check` de la RLS la aprobaría.
// ============================================================================

const UNIDADES_VALIDAS = UNIDADES.map((u) => u.unidad) as [Unidad, ...Unidad[]]

const tramoSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  // La unidad SÍ va como enum cerrado aquí, aunque la columna sea `text` a
  // secas como en `sitio_modalidades`. El motivo es el modo de fallo: una
  // unidad mal escrita no rompe nada, simplemente hace que ese tramo NO aplique
  // jamás — el dueño cree que descuenta y cobra el precio entero. Un error
  // silencioso al capturar es más caro que un rechazo al guardar.
  unidad: z.enum(UNIDADES_VALIDAS, {
    errorMap: () => ({ message: 'Elige una unidad de venta de la lista' }),
  }),
  // El FORMATO fino no se valida aquí sino en `motivoTramoInvalido`, a
  // propósito: así el dueño lee «un tramo de volumen empieza desde 2 unidades o
  // mas» —una frase que dice qué hacer— y no el mensaje genérico de zod. El
  // acotado de aquí es solo para que nada desmedido llegue a esa frase.
  desdeCantidad: z.coerce.number().finite().min(-1_000_000).max(1_000_000),
  descuentoPct: z.coerce.number().finite().min(-1000).max(1000),
})

export async function listarEscalasCtrl() {
  return { tramos: await listarEscalasVolumen() }
}

/**
 * Alta o edición de un tramo.
 *
 * SE COMPARA CONTRA TODOS LOS TRAMOS DE LA ORGANIZACIÓN, no solo contra los de
 * su unidad: el filtro por unidad lo hace `motivoTramoInvalido`, para que quien
 * llama no pueda olvidarlo. Olvidarlo dejaría pasar un umbral repetido —dos
 * precios para la misma compra— o una escala no monótona, que es la que no da
 * ningún error y solo hace que comprar más salga más caro.
 *
 * El umbral repetido lo rechaza ADEMÁS el `unique` de la base
 * (`idx_escalas_volumen_uq`). Esto es para que se lea una frase en vez de un
 * error de restricción; aquélla es la que de verdad cierra el agujero, porque
 * una validación es algo que alguien puede olvidar en la siguiente ruta.
 */
export async function guardarTramoCtrl(body: unknown) {
  const d = validar(tramoSchema, body)
  const candidato: TramoVolumen = {
    id: d.id ?? '',
    unidad: d.unidad,
    desdeCantidad: d.desdeCantidad,
    descuentoPct: d.descuentoPct,
  }
  const otros = await listarEscalasVolumen()
  const motivo = motivoTramoInvalido(candidato, otros)
  if (motivo) throw new AppError(motivo, 400)

  const guardado = await guardarTramoVolumen({
    id: d.id,
    unidad: d.unidad,
    desdeCantidad: d.desdeCantidad,
    descuentoPct: d.descuentoPct,
  })
  // 404 y no 403: decir «existe pero no es tuyo» ya cuenta algo de otra
  // organización.
  if (!guardado) throw new AppError('Ese tramo no existe en esta organización', 404)
  return guardado
}

/**
 * Borra un tramo. Borrado REAL, no lógico — ver `volumen-repo.ts`: nada
 * referencia un tramo, porque el porcentaje y el umbral se copian a cada línea
 * de propuesta al capturarla. Borrarlo no mueve ni una venta ya hecha.
 */
export async function borrarTramoCtrl(id: string) {
  const ok = await borrarTramoVolumen(id)
  if (!ok) throw new AppError('Ese tramo no existe en esta organización', 404)
  return { ok: true }
}
