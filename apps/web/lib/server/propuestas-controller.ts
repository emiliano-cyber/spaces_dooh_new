import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearPropuesta, aprobarItem, PropuestaError, type PropuestaInput } from './propuestas-repo'
import { cantidadEfectiva, diasInclusivos, precioItem, UNIDADES, type Unidad } from '@/lib/periodos'
import { PERIODICIDAD_VALUES } from '@/lib/renta-periodicidad'
import { listarFranjas } from './rejilla-repo'
import { listarEscalasVolumen } from './volumen-repo'
import { resolverVolumen, SIN_VOLUMEN } from '@/lib/volumen'
import { decidirPrecioItem, tarifaCalculada } from '@/lib/tarifa-calculada'
import {
  decidirPrecioCalculadora,
  duracionSpotSeg,
  espaciosLibres,
  horasDeHorario,
  horasPorOmision,
  resolverCalculadora,
  tarifaBaseCalculadora,
  usaCalculadora,
} from '@/lib/calculadora-spots'
import { datosDelLoop, datosParaTarifar } from './tarifas-repo'
import { usuarioActual, tienePermiso } from './auth'

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
//  Y conviene decir por qué se insiste: hasta el 2026-10-01 la `tarifaUnitaria`
//  de la Fase 1 se copiaba tal cual de lo que mandaba el navegador (hallazgo
//  B40), así que se podía cerrar una venta de prime a 1 peso con un `curl`.
//
//  ─── PRECIO-01 · LA TARIFA BASE TAMBIÉN LA DECIDE EL SERVIDOR (2026-10-01) ─
//  Decisión del dueño: «en propuestas aparte de ser calculado el gerente será
//  el único que podrá poner otro precio diferente al de la tarifa e igual
//  usuarios superiores». El servidor calcula la tarifa de cada línea con la
//  MISMA función que la pantalla (`lib/tarifa-calculada.ts`) sobre los datos de
//  ESTA organización (`tarifas-repo.ts`, bajo RLS y con `and tenant_id`):
//
//    · precio = tarifa (al centavo) → se guarda, sin ajuste;
//    · precio ≠ tarifa y la sesión NO tiene `comercial.aprobar` → 403 y no se
//      guarda NADA, ni las líneas buenas de la misma propuesta;
//    · precio ≠ tarifa con `comercial.aprobar` → se guarda con la tarifa
//      calculada al lado y el repo anota quién la ajustó (de la SESIÓN).
//
//  403 y no 409: no es un conflicto con el estado del recurso —reintentar lo
//  mismo daría lo mismo—, es que a ESA persona no le toca esa acción. Es el
//  mismo código que devuelve decidir un cupón sin `comercial.aprobar`
//  (`/api/propuestas/:id/codigo/decision`), que es la misma pareja de roles.
//
//  Lo que NO cambia: el volumen, el descuento comercial, el cupón, el paquete y
//  el snapshot se componen ENCIMA del precio de la línea exactamente igual que
//  antes. La tarifa es el escalón base, y es el único que esto vigila.
//
//  ─── ADR 0042 · LA CANTIDAD DE SPOTS TAMBIÉN LA DECIDE EL SERVIDOR ────────
//  Una línea de pantalla digital por spot puede traer los parámetros de la
//  calculadora (espacios del loop, horas al día, Roadblock y su prima). Si los
//  trae, el servidor RECALCULA la cantidad con la misma función que la
//  pantalla (`lib/calculadora-spots.ts`) sobre el loop de ESTA organización, y
//  rechaza la que no cuadre: si se copiara, una `cantidad: 100` con un `curl`
//  bajaría el total sin tocar la tarifa — B40 por la otra puerta.
//
//    · parámetros mal o cantidad que no cuadra → 400;
//    · más espacios que los libres, o un Roadblock sin el loop entero → 409;
//    · prima de Roadblock > 0 sin `comercial.aprobar` → 403;
//    · prima con permiso → la tarifa esperada es calculada × (1+prima), y la
//      línea queda como AJUSTE, con su `precio_ajustado_por` y su Actividad.
//
//  ADR 0043 · y desde el 2026-10-06 el PRECIO de esa línea tampoco es la
//  modalidad `spot`: es la tarifa mensual repartida entre los spots del loop
//  (`tarifaBaseCalculadora`), y el loop es la ocupación de hoy más la línea.
//  Es la cuenta de la calculadora HTML del dueño. La regla de quién puede
//  apartarse de ese precio es la misma.
//
//  Una línea SIN parámetros sigue exactamente como antes: la calculadora no
//  existe para ella, ni para las pantallas fijas ni para las demás unidades.
// ============================================================================

const UNIDADES_VALIDAS = UNIDADES.map((u) => u.unidad) as [Unidad, ...Unidad[]]

// ADR 0042 · una línea SIN calculadora, dicho explícitamente y no dejado en
// `undefined`: el repo escribe `roadblock = false` y lo demás en NULL, que es
// «no usó la calculadora» — lo de siempre.
const SIN_CALCULADORA = {
  espaciosComprados: null,
  horasDia: null,
  roadblock: false,
  primaRoadblockPct: null,
} as const

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
  // ADR 0042 · los parámetros de la CALCULADORA DE SPOTS. Entran por el cuerpo
  // —los elige quien vende, como la franja—, pero la CANTIDAD que sale de ellos
  // la recalcula el servidor. Opcionales: sin ninguno la línea es la de siempre.
  // Los rangos de aquí son la forma; los que dependen de la pantalla (techo de
  // espacios y de horas) los mira `resolverCalculadora`.
  espaciosComprados: z.coerce.number().int().positive().nullish(),
  horasDia: z.coerce.number().positive().max(24).nullish(),
  roadblock: z.boolean().nullish(),
  primaRoadblockPct: z.coerce.number().min(0).max(100).nullish(),
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

/**
 * PRECIO-01 · una línea cuyo precio se apartó de la tarifa calculada (o que no
 * tenía tarifa), puesta por alguien con `comercial.aprobar`. El route la anota
 * en Actividad; viaja APARTE de la propuesta para no publicarla en la
 * respuesta de la API.
 */
export type AjusteTarifa = {
  sitioId: string
  sitioNombre: string
  unidad: string
  tarifaCalculada: number | null
  tarifa: number
  /** ADR 0042 · la prima del Roadblock, si el ajuste fue por ella. */
  primaRoadblockPct?: number | null
}

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
  // ADR 0042 · el catálogo se guarda: la calculadora toma de la franja elegida
  // el techo de horas al día, y no hay por qué leerlo dos veces.
  let catalogoFranjas: Awaited<ReturnType<typeof listarFranjas>> = []
  if (franjasPedidas.length) {
    catalogoFranjas = await listarFranjas()
    const validas = new Set(catalogoFranjas.map((f) => f.id))
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

  // ADR 0042 · la CALCULADORA DE SPOTS, línea a línea y ANTES que el precio.
  //
  // El loop se lee UNA vez y SOLO si alguna línea la usa, por la misma razón
  // que las franjas: la base instalada cotiza sin ella.
  //
  // Va antes que la tarifa a propósito: un 400 o un 409 de aquí («la cantidad
  // no cuadra», «no hay espacios libres») es lo que el vendedor tiene que
  // arreglar primero, y un 403 por la prima no le diría nada de eso.
  const dias = diasInclusivos(String(d.fechaInicio).slice(0, 10), String(d.fechaFin).slice(0, 10))
  const conCalculadora = d.items.some((it) => usaCalculadora(it))
  const loop = conCalculadora ? await datosDelLoop(d.items.map((it) => it.sitioId)) : null
  const calculadoras = d.items.map((it) => {
    if (!loop || !usaCalculadora(it)) return null
    if (it.tarifaUnitaria == null) {
      // Sin tarifa la línea caería al modo compatible —precio directo y
      // cantidad 1— y la calculadora no tendría nada que multiplicar.
      throw new AppError('La calculadora de spots necesita la tarifa por spot de la línea.', 400)
    }
    const s = loop.sitios.get(it.sitioId)
    const franja = it.franjaId ? catalogoFranjas.find((f) => f.id === it.franjaId) ?? null : null
    const r = resolverCalculadora({
      // Una pantalla de otra organización no está en `loop`: no es digital
      // para esta propuesta, y la calculadora la rechaza (R2).
      digital: !!s?.digital,
      unidad: it.unidad ?? 'mensual',
      totalSpots: s?.totalSpots ?? null,
      duracionSeg: duracionSpotSeg(s?.duracionSpotSeg, loop.spotSegOrganizacion),
      horasMaximas: horasPorOmision({ franja, horario: s?.horario ?? null }),
      libres: s ? espaciosLibres({ totalSpots: s.totalSpots, guardados: s.spotsDisponibles, campanasActivas: s.campanasActivas }) : null,
      // ADR 0043 · el loop es la ocupación. Las CAMPAÑAS vigentes y no el
      // contador guardado: es lo que cuenta la pantalla (total − libres del
      // inventario), y si los dos contaran distinto la cantidad no cuadraría.
      ocupados: s ? s.campanasActivas : null,
      dias,
      espaciosComprados: it.espaciosComprados ?? null,
      horasDia: it.horasDia ?? null,
      roadblock: it.roadblock ?? null,
      primaRoadblockPct: it.primaRoadblockPct ?? null,
      // La que llegó en el CUERPO, sin redondear: es la que se compara.
      cantidadEnviada: it.cantidad ?? null,
    })
    if (!r.ok) throw new AppError(r.motivo, r.status)
    return r
  })

  // Normaliza cada ítem a la forma persistida, calculando cantidad y precio en
  // el servidor a partir de la unidad y la tarifa por unidad.
  const normalizados = d.items.map((it, idx) => {
    const calc = calculadoras[idx]
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
        ...SIN_CALCULADORA,
      }
    }
    // ADR 0042 · con calculadora, la cantidad es la que RECALCULÓ el servidor
    // (que ya comprobó que es la enviada). Sin ella, la de siempre.
    const cantidad = calc ? calc.cantidad : cantidadEfectiva(it.unidad, d.fechaInicio, d.fechaFin, it.cantidad)
    return {
      sitioId: it.sitioId,
      unidad: it.unidad,
      tarifaUnitaria: it.tarifaUnitaria,
      cantidad,
      // ADR 0042 · con calculadora, la PROGRAMACIÓN sale de la misma cuenta:
      // los spots al día que se cotizaron son los pases al día que se programan
      // en el CMS. Si la línea trajera otro número aquí, lo cotizado y lo
      // programado contarían dos historias del mismo trato.
      spotsPorDia: calc ? calc.spotsDia : (it.spotsPorDia ?? null),
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
      ...(calc
        ? {
            espaciosComprados: calc.espaciosComprados,
            horasDia: calc.horasDia,
            roadblock: calc.roadblock,
            primaRoadblockPct: calc.primaRoadblockPct,
          }
        : SIN_CALCULADORA),
    }
  })

  // PRECIO-01 · la tarifa de cada línea, calculada AQUÍ. UNA lectura por
  // propuesta, no una por línea.
  const datos = await datosParaTarifar(d.items.map((it) => it.sitioId))
  // El permiso se resuelve UNA vez y SOLO si alguna línea se aparta de la
  // tarifa: toda venta a tarifa —el caso normal— no paga el viaje a la base.
  // Sale de la SESIÓN (`usuarioActual()`, la misma cookie que el tenant), nunca
  // del cuerpo: un `rol` en el JSON no lo lee nadie. Sin sesión, sin permiso.
  let permiso: boolean | null = null
  const puedeAjustar = async (): Promise<boolean> => {
    if (permiso == null) {
      const u = await usuarioActual()
      permiso = !!u && (await tienePermiso(u.rol, 'comercial', 'aprobar'))
    }
    return permiso
  }
  // La temporada se deduce del DÍA de inicio, igual que en el congelado del
  // snapshot (`String(...).slice(0, 10)`): una fecha con hora no puede cambiar
  // de temporada según quién la mande.
  const fechaTarifa = String(d.fechaInicio).slice(0, 10)
  const items: ((typeof normalizados)[number] & { tarifaCalculada: number | null; precioAjustado: boolean })[] = []
  const ajustes: AjusteTarifa[] = []
  for (const [idx, it] of normalizados.entries()) {
    const sitio = datos.sitios.get(it.sitioId)
    // ADR 0043 · una línea de calculadora NO se tarifa con la modalidad `spot`:
    // su precio sale de la tarifa MENSUAL repartida entre los spots del loop,
    // como en la calculadora HTML. `normalizados` va en el orden de `d.items`,
    // y por eso `calculadoras[idx]` es la de esta línea.
    const conCalc = calculadoras[idx]
    const deLoop = conCalc ? loop?.sitios.get(it.sitioId) : undefined
    const calc = conCalc
      ? tarifaBaseCalculadora({
          sitio: sitio ?? {},
          franjaId: it.franjaId,
          temporadas: datos.temporadas,
          fechaInicio: fechaTarifa,
          loop: conCalc.loop,
          duracionSeg: duracionSpotSeg(deLoop?.duracionSpotSeg, loop?.spotSegOrganizacion),
          horasOperacion: horasDeHorario(deLoop?.horario ?? null).horas,
          roadblock: conCalc.roadblock,
        })
      : tarifaCalculada({
          sitio: sitio ?? {},
          unidad: it.unidad,
          franjaId: it.franjaId,
          temporadas: datos.temporadas,
          fechaInicio: fechaTarifa,
        })
    // ADR 0042 · una línea de calculadora pasa por `decidirPrecioCalculadora`,
    // que mete la prima del Roadblock dentro de la MISMA regla: la tarifa
    // esperada es calculada × (1+prima) —la prima se aplica UNA vez, ahí— y una
    // prima > 0 es un ajuste de gerente. Sin prima da exactamente lo mismo que
    // `decidirPrecioItem`; las líneas sin calculadora siguen por éste, tal cual.
    const prima = it.primaRoadblockPct ?? 0
    const decidir = (puede: boolean) =>
      it.espaciosComprados != null
        ? decidirPrecioCalculadora({ enviada: it.tarifaUnitaria, calculada: calc, primaPct: prima, puedeAjustar: puede })
        : decidirPrecioItem({ enviada: it.tarifaUnitaria, calculada: calc, puedeAjustar: puede })
    let dec = decidir(false)
    if (!dec.ok) dec = decidir(await puedeAjustar())
    if (!dec.ok) {
      if (dec.motivo === 'prima-sin-permiso') {
        throw new AppError('Solo un gerente o superior puede poner prima a un Roadblock.', 403)
      }
      // Se rechaza ANTES de llamar al repo: no se escribe ni la propuesta ni
      // ninguna de sus líneas. Una propuesta a medias, con la línea mala
      // quitada, sería un precio que nadie cotizó.
      if (dec.motivo === 'sin-tarifa') {
        throw new AppError(
          'Esta pantalla no tiene una tarifa calculada para esa unidad. Pide a un gerente o superior que le ponga precio.',
          403,
        )
      }
      throw new AppError('Solo un gerente o superior puede cambiar la tarifa de una pantalla.', 403)
    }
    items.push({ ...it, tarifaCalculada: dec.tarifaCalculada, precioAjustado: dec.ajustado })
    if (dec.ajustado) {
      ajustes.push({
        sitioId: it.sitioId,
        sitioNombre: sitio?.nombre ?? it.sitioId,
        unidad: it.unidad,
        tarifaCalculada: dec.tarifaCalculada,
        tarifa: it.tarifaUnitaria,
        // Solo cuando la hubo: el ajuste de siempre no gana un campo vacío.
        ...(prima > 0 ? { primaRoadblockPct: prima } : {}),
      })
    }
  }

  try {
    const propuesta = await crearPropuesta({ ...d, items } as PropuestaInput)
    return { propuesta, ajustes }
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
