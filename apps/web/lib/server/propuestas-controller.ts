import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearPropuesta, aprobarItem, PropuestaError, type PropuestaInput } from './propuestas-repo'
import { cantidadEfectiva, precioItem, UNIDADES, type Unidad } from '@/lib/periodos'
import { PERIODICIDAD_VALUES } from '@/lib/renta-periodicidad'
import { listarFranjas } from './rejilla-repo'
import { listarEscalasVolumen } from './volumen-repo'
import { resolverVolumen, SIN_VOLUMEN } from '@/lib/volumen'

// ============================================================================
//  lib/server/propuestas-controller.ts — Alta de propuestas y aprobación de sus
//  sitios. La economía (divisor/snapshot/guard $0) vive en el model; aquí se
//  valida la forma de entrada. PropuestaError → HTTP.
//
//  Contratación por tiempo: cada ítem lleva unidad (mes/semana/día/spot/hora),
//  su tarifa por unidad y —opcional— la programación de spots (spots/día). El
//  PRECIO se calcula AQUÍ en el servidor (tarifa × cantidad), no se confía en el
//  que manda el cliente, para que la UI no pueda inflar/bajar el precio de lista.
//
//  ─── VOL-01 · EL DESCUENTO POR VOLUMEN LO DECIDE EL SERVIDOR ──────────────
//  El cliente manda la CANTIDAD; el porcentaje sale de `escalas_volumen`, leída
//  bajo RLS con el tenant de la sesión. Nunca entra por el cuerpo, y el
//  `itemSchema` no lo declara: ése es el candado, igual que con el vendedor.
//
//  Y conviene decir por qué se insiste, porque el archivo de al lado hace lo
//  contrario: la `tarifaUnitaria` de la Fase 1 SÍ se copia tal cual de lo que
//  manda el navegador (hallazgo B40), así que hoy se puede cerrar una venta de
//  prime a 1 peso con un `curl`. Esta fase no arregla aquello —mover la cadena
//  entera al servidor cambia el comportamiento de cada venta y es una decisión
//  abierta del dueño— pero **no lo amplía**: el escalón nuevo nace del lado
//  correcto. Sobre una cadena que vive en el cliente no se puede construir la
//  Fase 3, porque el contador de usos de un cupón lo tiene que llevar el
//  servidor.
// ============================================================================

const UNIDADES_VALIDAS = UNIDADES.map((u) => u.unidad) as [Unidad, ...Unidad[]]

// Campos numéricos opcionales: el front manda `null` cuando no aplican (p. ej.
// spots/día vacío), así que van con `.nullish()` — `.optional()` solo aceptaría
// `undefined` y `z.coerce.number()` convertiría null→0, fallando en `.positive()`.
// Mismo enum que `periodicidad_pago` en la BD y que arrendadores-controller:
// los tres lo toman ya de lib/renta-periodicidad.ts.
const PERIODICIDADES_RENTA = PERIODICIDAD_VALUES

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
  // Renta que se le paga al PROPIETARIO por esta pantalla (el costo). Capturarla
  // aquí hace que el contrato nazca completo al generar la campaña, en vez de
  // como pendiente sin importe (ADR 0001). Opcional: sin ella todo sigue igual.
  rentaMonto: z.coerce.number().nonnegative().nullish(),
  rentaPeriodicidad: z.enum(PERIODICIDADES_RENTA).nullish(),
  rentaArrendadorId: z.string().uuid().nullish(),
  // REJILLA-01 · la FRANJA contratada (ADR 0039, Fase 1). Al revés que el
  // vendedor del mismo día, ésta SÍ entra por el cuerpo: la elige quien vende y
  // no hay de dónde deducirla. Por eso se valida contra el catálogo de la
  // organización antes de escribir —abajo— y por eso la FK de la base es
  // COMPUESTA con el tenant. Opcional: casi ninguna venta la usa.
  // Acotado: el rechazo NOMBRA el identificador para poder diagnosticarlo, y
  // sin tope alguien haría que el servidor le devolviera lo que él mandó.
  franjaId: z.string().trim().min(1).max(64).nullish(),
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

  // REJILLA-01 · la franja contratada se comprueba contra el catálogo ACTIVO de
  // esta organización, y solo si alguien la usa.
  //
  // `listarFranjas()` lee bajo RLS y sin argumentos devuelve solo las activas,
  // así que esta única llamada cierra los dos casos de golpe: una franja de otra
  // organización no aparece en la lista, y una desactivada tampoco. Poder
  // vender una franja apagada haría que apagarla no significara nada.
  //
  // La FK compuesta `(franja_id, tenant_id)` de la base ya rechazaría la ajena
  // —y es la que de verdad cierra el agujero R2, porque una validación es algo
  // que alguien puede olvidar en la siguiente ruta—. Esto es para que quien lo
  // lea vea una frase y no un error de restricción.
  //
  // El `if` no es micro-optimización: toda la base instalada vende sin franja, y
  // sin él cada alta de propuesta pagaría un viaje a la base por un catálogo que
  // no va a usar.
  const franjasPedidas = d.items.map((it) => it.franjaId ?? null).filter((f): f is string => !!f)
  if (franjasPedidas.length) {
    const validas = new Set((await listarFranjas()).map((f) => f.id))
    const mala = franjasPedidas.find((f) => !validas.has(f))
    if (mala) {
      throw new AppError(
        `La franja horaria "${mala}" no existe en esta organización o está desactivada.`,
        400,
      )
    }
  }

  // VOL-01 · la escala de volumen de ESTA organización, leída UNA vez.
  //
  // Una sola consulta por propuesta y no una por línea: son pocas filas —un
  // puñado de tramos por unidad— y el índice único las sirve enteras. Aquí no
  // hay un `if` que la evite como con las franjas, y es a propósito: saber si
  // aplica exige haber leído la escala, y un atajo que la salte cuando «parece»
  // que no hay volumen es exactamente la clase de optimización que acaba
  // vendiendo sin el descuento que el dueño capturó.
  //
  // Sin tramos, `resolverVolumen` devuelve 0 para todo y la propuesta sale
  // idéntica a como salía antes de esta fase (invariante 3).
  const escala = await listarEscalasVolumen()
  const tramosDe = (unidad: string) => escala.filter((t) => t.unidad === unidad)

  /**
   * El volumen de una línea, resuelto aquí y no en ninguna otra parte.
   *
   * Devuelve las dos columnas juntas para que no se puedan escribir por
   * separado: un porcentaje sin su umbral es un descuento que no se puede
   * auditar, y un umbral sin porcentaje no es nada.
   */
  const volumenDelItem = (unidad: string, cantidad: number) => {
    const v = resolverVolumen(tramosDe(unidad), cantidad) ?? SIN_VOLUMEN
    return { descuentoVolumenPct: v.descuentoPct, volumenDesde: v.desdeCantidad }
  }

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
        // Renta al propietario: se propaga tal cual; el repo la normaliza a
        // null si falta importe o periodicidad (el CHECK los exige juntos).
        rentaMonto: it.rentaMonto ?? null,
        rentaPeriodicidad: it.rentaPeriodicidad ?? null,
        rentaArrendadorId: it.rentaArrendadorId ?? null,
        // Explícito a `null` y no dejado en `undefined`: el contrato hacia el
        // repo dice «sin franja», que es un hecho, y no «no me acordé». Un
        // `?? laPrimera` futuro no podría colarse sin tocar esta línea.
        franjaId: it.franjaId ?? null,
        // Modo compatible: `cantidad` es 1, así que no puede alcanzar ningún
        // umbral (el mínimo es 2). Se resuelve igual y no se escribe un 0 a
        // mano: el día que este camino aprenda a contar, el volumen viajará
        // solo, sin que nadie tenga que acordarse de tocar esta rama.
        ...volumenDelItem(it.unidad ?? 'mensual', 1),
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
      // Renta al propietario: se propaga tal cual; el repo la normaliza a
      // null si falta importe o periodicidad (el CHECK los exige juntos).
      rentaMonto: it.rentaMonto ?? null,
      rentaPeriodicidad: it.rentaPeriodicidad ?? null,
      rentaArrendadorId: it.rentaArrendadorId ?? null,
      franjaId: it.franjaId ?? null,
      // La cantidad que cuenta para el volumen es la EFECTIVA, la misma que
      // multiplica la tarifa — no la que llegó en el cuerpo. En unidades de
      // tiempo sale del rango de fechas, así que una `cantidad: 999` inflada a
      // mano no regala ningún tramo: pagaría 999 meses o no cuenta.
      ...volumenDelItem(it.unidad, cantidad),
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
