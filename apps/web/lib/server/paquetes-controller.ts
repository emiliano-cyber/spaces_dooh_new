import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { motivoPaqueteInvalido, type PaqueteCandidato } from '@/lib/paquete'
import {
  listarPaquetes,
  guardarPaquete,
  borrarPaquete,
  aplicarPaquete,
  quitarPaquete,
  PaqueteImposible,
} from './paquetes-repo'

// ============================================================================
//  lib/server/paquetes-controller.ts — La forma de entrada de los paquetes
//  cerrados y la aplicación de sus reglas.  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  Las REGLAS de formato viven en `lib/paquete.ts`, que es puro y no sabe nada
//  de la base. Las reglas de NEGOCIO —que el paquete sea de esta organización,
//  que esté activo, que la propuesta no esté aprobada, que las pantallas
//  cuadren— viven en el repo, dentro de la transacción, porque dependen de lo
//  que la base diga en ese instante.
//
//  ⚠️ EL PRECIO NUNCA ENTRA POR EL CUERPO DE LA PETICIÓN AL APLICAR.
//  Lo único que llega es el `paqueteId`; el precio sale de `paquetes` bajo RLS.
//  Es el mismo candado que la Fase 2 le puso al volumen, y aquí importa más que
//  en ninguna: si el precio del conjunto viajara en el JSON, cerrar una venta
//  de cinco pantallas en un peso sería un `curl`. (La `tarifaUnitaria` de la
//  Fase 1 sí viaja así — hallazgo B40, decisión abierta del dueño. Esta fase no
//  lo arregla pero TAMPOCO lo amplía.)
//
//  NINGÚN `tenantId` entra por el cuerpo tampoco. El repo lo saca de la sesión.
// ============================================================================

const paqueteSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  nombre: z.string().trim().min(1).max(200),
  // El FORMATO fino no se valida aquí sino en `motivoPaqueteInvalido`, a
  // propósito: así el dueño lee «el precio tiene que ser un numero entero de
  // pesos» —una frase que dice qué hacer— y no el mensaje genérico de zod. El
  // acotado de aquí es solo para que nada desmedido llegue a esa frase.
  precioCerrado: z.coerce.number().finite().min(-1_000_000_000).max(1_000_000_000),
  // REGLA 2 DEL ADR 0039 · nace APAGADA. El `.default(false)` no es comodidad:
  // es lo que hace que un cuerpo que omite el campo cree un paquete cerrado, y
  // no uno abierto. «La regla nace cerrada y se abre a propósito.»
  //
  // ⚠️ `z.boolean()` Y NO `z.coerce.boolean()`, y es deliberado: `Boolean('false')`
  // es `true`, así que con coerción la cadena `"false"` —que es lo que manda un
  // formulario mal serializado— ENCENDERÍA la bandera. Sobre una regla que
  // decide si un cupón descuenta encima de un precio final, eso es abrirla sin
  // que nadie lo haya decidido, que es justo lo contrario de «nace cerrada».
  admiteCodigo: z.boolean().default(false),
  activo: z.boolean().default(true),
  notas: z.string().max(2000).nullish(),
  sitios: z.array(z.string().trim().min(1).max(64)).max(200),
})

export async function listarPaquetesCtrl() {
  return { paquetes: await listarPaquetes() }
}

/**
 * Alta o edición de un paquete.
 *
 * ⚠️ EDITAR UN PAQUETE NO MUEVE NINGUNA VENTA — ni en borrador ni aprobada. El
 * precio ya está copiado en cada propuesta que lo aplicó. Lo único que cambia
 * es lo que costará la PRÓXIMA aplicación. Es el invariante 4 del ADR 0039.
 */
export async function guardarPaqueteCtrl(body: unknown) {
  const d = validar(paqueteSchema, body)
  const candidato: PaqueteCandidato = {
    nombre: d.nombre,
    precioCerrado: d.precioCerrado,
    sitios: d.sitios,
  }
  const motivo = motivoPaqueteInvalido(candidato)
  if (motivo) throw new AppError(motivo, 400)

  const guardado = await guardarPaquete({
    id: d.id,
    nombre: d.nombre.trim(),
    precioCerrado: d.precioCerrado,
    // `=== true` y `!== false`, no un `??`: es la misma polaridad que el
    // `.default()` del esquema, escrita otra vez donde se usa. `validar` pierde
    // el tipo de los campos con valor por omisión —`ZodType<T>` no distingue
    // entrada de salida—, y confiar en eso para una bandera que decide dinero
    // sería confiar en una inferencia. La regla nace cerrada en los dos sitios.
    admiteCodigo: d.admiteCodigo === true,
    activo: d.activo !== false,
    notas: d.notas ?? null,
    sitios: d.sitios,
  })
  // 404 y no 403: decir «existe pero no es tuyo» ya cuenta algo de otra
  // organización.
  if (!guardado) throw new AppError('Ese paquete no existe en esta organización', 404)
  return guardado
}

export async function borrarPaqueteCtrl(id: string) {
  const ok = await borrarPaquete(id)
  if (!ok) throw new AppError('Ese paquete no existe en esta organización', 404)
  return { ok: true }
}

const aplicarSchema = z.object({
  // SOLO el id. Ni el precio, ni el nombre, ni la bandera: los tres salen del
  // catálogo bajo RLS. Ver la cabecera de este archivo.
  paqueteId: z.string().trim().min(1).max(64),
})

export async function aplicarPaqueteCtrl(propuestaId: string, body: unknown) {
  const d = validar(aplicarSchema, body)
  try {
    return await aplicarPaquete(propuestaId, d.paqueteId)
  } catch (e) {
    // 409 y no 400: no es que el cuerpo esté mal formado, es que el estado del
    // mundo no permite la operación. Mismo criterio que el canje del cupón.
    if (e instanceof PaqueteImposible) throw new AppError(e.message, 409)
    throw e
  }
}

export async function quitarPaqueteCtrl(propuestaId: string) {
  try {
    const ok = await quitarPaquete(propuestaId)
    if (!ok) throw new AppError('Esa propuesta no tiene paquete aplicado', 404)
    return { ok: true }
  } catch (e) {
    if (e instanceof PaqueteImposible) throw new AppError(e.message, 409)
    throw e
  }
}
