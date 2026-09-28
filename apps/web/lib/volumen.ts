// ============================================================================
//  lib/volumen.ts — El descuento por VOLUMEN.  ADR 0039, Fase 2.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Hermano de `rejilla.ts`.
// ----------------------------------------------------------------------------
//  DÓNDE ENCAJA EN LA CADENA (ADR 0039):
//
//      tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
//            ×  DESCUENTO POR VOLUMEN                       ← aquí
//            ×  descuento comercial (con su tope)
//            ×  código promocional                          ← Fase 3, no existe
//            ×  (1 − comisión de agencia)
//            =  neto
//
//  ─── LAS DOS DECISIONES DE DISEÑO, con el motivo escrito ──────────────────
//
//  1 · LA ESCALA CUELGA DE LA ORGANIZACIÓN, CON LA UNIDAD DE VENTA COMO CLAVE.
//
//  No de la fila de tarifa (`pantalla × unidad × franja × temporada`): eso
//  obligaría al dueño a capturar tramos en cada combinación de la rejilla, que
//  es precisamente la explosión que la Fase 1 evitó haciéndola DISPERSA. Y no
//  «a secas por organización», porque **50 spots y 50 meses no son la misma
//  compra**: una escala que no distinga la unidad regalaría el tramo de los
//  spots a un contrato de cuatro años. La unidad no es una dimensión opcional,
//  es lo que hace que el número 50 signifique algo.
//
//  El repositorio ya tiene el precedente de los dos lados, y la diferencia
//  decide: la TARIFA es un dato de la pantalla y vive con ella
//  (`sitio_modalidades`, `sitio_tarifas`); el TECHO DE DESCUENTO es una
//  política comercial del dueño y vive en `config_negocio`
//  (`20260928_tope_descuento_propuestas.sql`). Un descuento por volumen es lo
//  segundo: es lo que esta casa concede a quien compra mucho, no una propiedad
//  de un poste.
//
//  2 · LOS TRAMOS SON PLANOS, NO ESCALONADOS.
//
//  «A partir de 50 spots, 10 % sobre TODO» — no «los primeros 10 a precio
//  lleno, del 11 al 50 al 5 %…». Tres motivos:
//
//   · Es la frase que un dueño de medios ya tiene escrita en su tarifario, y es
//     el mismo argumento con el que el ADR 0039 descartó los multiplicadores:
//     se negocia en precios que se pueden señalar, no en cuentas.
//   · Un tramo marginal produce una tarifa unitaria MEZCLADA que no es ningún
//     número del tarifario. Como el snapshot congela `tarifaUnitaria` para que
//     el reporte compare publicada contra neta, congelaría un promedio que
//     nadie decidió y que no se puede explicar seis meses después.
//   · Y el que decide en la base: en una escala plana el «solape» es
//     exactamente **el umbral repetido**, así que lo prohíbe un `unique
//     (tenant_id, unidad, desde_cantidad)`. Escalonado son rangos, y prohibir
//     su solape volvería a necesitar lógica de aplicación como la de las
//     franjas — una regla que alguien puede olvidar en el siguiente camino.
//
//  LO QUE CUESTA, dicho con todas las letras: el ESCALÓN. Quien compra 49 paga
//  más que quien compra 50, y el salto puede ser mayor que la diferencia de una
//  unidad. Es el comportamiento estándar de un tarifario por volumen y por eso
//  la pantalla de captura lo enseña como «a partir de N, X % sobre todo»; pero
//  es una consecuencia real, no un detalle.
// ============================================================================

/** Un peldaño de la escala: «a partir de `desdeCantidad`, `descuentoPct` %». */
export type TramoVolumen = {
  id?: string
  /** La unidad de venta a la que aplica: `spot`, `mensual`, … */
  unidad: string
  /** Umbral INCLUSIVO. «A partir de 50» incluye el 50. */
  desdeCantidad: number
  /** Por ciento que baja el precio unitario. Siempre > 0. */
  descuentoPct: number
}

/** El tramo que le tocó a una venta, o la ausencia de tramo. */
export type VolumenAplicado = {
  descuentoPct: number
  /** El umbral del tramo que ganó. `null` = no ganó ninguno. */
  desdeCantidad: number | null
}

/**
 * No hay tramo. Es el caso de TODA la base instalada y el invariante de esta
 * fase: sin escala capturada, la venta sale exactamente como ayer.
 */
export const SIN_VOLUMEN: VolumenAplicado = { descuentoPct: 0, desdeCantidad: null }

/** Un entero >= 1 de verdad, o `null`. Nunca un `?? 0` que invente una cantidad. */
function enteroPositivo(v: unknown): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/** Un porcentaje de (0, 100], o `null`. */
function pctValido(v: unknown): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}

/**
 * De una cantidad contratada al descuento que le toca.
 *
 * ─── Gana el UMBRAL MAYOR alcanzado, nunca «el descuento más grande» ───────
 * Con una escala bien capturada dan lo mismo, porque la monotonía se exige al
 * escribir (`motivoTramoInvalido`). Con datos torcidos —los que existieran
 * antes de esa validación, o los que entren por `psql`— NO dan lo mismo, y
 * entonces lo que importa es que el desempate sea **el mismo siempre**: dos
 * lecturas de la misma venta no pueden dar dos precios. Es el mismo criterio
 * con el que `temporadaDeFecha` devuelve la primera que cubre.
 *
 * ─── Lo ilegible cae a SIN descuento ──────────────────────────────────────
 * Una cantidad que no es un número, o un tramo con el umbral corrupto, se
 * ignoran. El lado prudente es el que NO mueve dinero: cobrar de más se corrige
 * con una nota de crédito; regalar en silencio ya se regaló (ADR 0039 §1).
 */
export function resolverVolumen(tramos: TramoVolumen[], cantidad: unknown): VolumenAplicado {
  const cant = enteroPositivo(cantidad)
  if (cant === null) return SIN_VOLUMEN

  let mejor: VolumenAplicado = SIN_VOLUMEN
  for (const t of tramos ?? []) {
    const desde = enteroPositivo(t?.desdeCantidad)
    const pct = pctValido(t?.descuentoPct)
    if (desde === null || pct === null) continue
    if (desde > cant) continue
    if (mejor.desdeCantidad === null || desde > mejor.desdeCantidad) {
      mejor = { descuentoPct: pct, desdeCantidad: desde }
    }
  }
  return mejor
}

/**
 * Por qué NO se puede guardar este tramo, o `null` si sí se puede.
 *
 * `otros` son los tramos YA guardados de la misma organización, de TODAS las
 * unidades: el filtro por unidad se hace aquí para que quien llama no pueda
 * olvidarlo — olvidarlo dejaría pasar un umbral repetido, que son dos precios
 * para la misma compra.
 *
 * ─── La MONOTONÍA es la regla que de verdad protege ───────────────────────
 * «Desde 50 → 10 %» junto a «desde 100 → 5 %» no da ningún error: simplemente
 * quien compra 100 paga MÁS por unidad que quien compra 50, y nadie lo ve hasta
 * que un cliente hace la cuenta. Se exige CRECIMIENTO ESTRICTO, así que dos
 * umbrales con el mismo porcentaje también se rechazan: el segundo no cambia
 * nada y solo sirve para hacer creer que sí.
 */
export function motivoTramoInvalido(
  tramo: TramoVolumen,
  otros: TramoVolumen[],
): string | null {
  const unidad = String(tramo?.unidad ?? '').trim()
  if (!unidad) return 'El tramo necesita una unidad de venta.'

  const bruto = tramo?.desdeCantidad
  if (typeof bruto !== 'number' && typeof bruto !== 'string') {
    return 'La cantidad desde la que aplica tiene que ser un numero entero.'
  }
  const n = Number(bruto)
  if (!Number.isFinite(n)) return 'La cantidad desde la que aplica tiene que ser un numero entero.'
  if (!Number.isInteger(n)) {
    return 'La cantidad desde la que aplica tiene que ser un numero entero: no se venden fracciones de unidad.'
  }
  // «Desde 1» aplicaría a TODA venta: eso no es un descuento por volumen, es
  // bajar el tarifario entero sin tocar una sola tarifa — y sin que se note.
  if (n < 2) return 'Un tramo de volumen empieza desde 2 unidades o mas; "desde 1" seria bajar el tarifario entero.'

  const pctBruto = tramo?.descuentoPct
  if (typeof pctBruto !== 'number' && typeof pctBruto !== 'string') {
    return 'El descuento tiene que ser un numero.'
  }
  const p = Number(pctBruto)
  if (!Number.isFinite(p)) return 'El descuento tiene que ser un numero.'
  if (p <= 0) return 'El descuento de un tramo tiene que ser mayor que 0 %: un tramo al 0 % no hace nada.'
  if (p > 100) return 'El descuento de un tramo no puede pasar del 100 %.'

  for (const otro of otros ?? []) {
    if (otro?.id && tramo?.id && otro.id === tramo.id) continue
    if (String(otro?.unidad ?? '').trim() !== unidad) continue
    const od = Number(otro?.desdeCantidad)
    const op = Number(otro?.descuentoPct)
    if (!Number.isFinite(od) || !Number.isFinite(op)) continue
    if (od === n) {
      return `Ya hay un tramo desde ${n} para esta unidad (${op} %). Dos tramos con el mismo umbral son dos precios para la misma compra.`
    }
    // Crecimiento estricto en las dos direcciones. Escrito con los dos casos
    // separados —y no con un `(od - n) * (op - p) <= 0`— porque el mensaje tiene
    // que poder nombrar el tramo con el que choca.
    if (od < n && op >= p) {
      return `No se puede comprar mas y descontar menos: el tramo desde ${od} ya da ${op} % y este, desde ${n}, daria ${p} %.`
    }
    if (od > n && op <= p) {
      return `No se puede comprar mas y descontar menos: el tramo desde ${od} da ${op} % y este, desde ${n}, daria ${p} %.`
    }
  }
  return null
}

/** Una línea de propuesta vista desde el volumen: su importe de lista y su tramo. */
export type LineaConVolumen = { precio: number; descuentoVolumenPct: number }

export type VolumenDeLineas = {
  /** Σ de los importes de LISTA. Es el `bruto` de siempre, sin tocar. */
  bruto: number
  /** Lo que se regaló por volumen, en dinero. */
  descuentoVolumenMonto: number
  /** `bruto − descuentoVolumenMonto`. Sobre esto aplica el descuento comercial. */
  brutoConVolumen: number
  /** El volumen de la propuesta ENTERA, ponderado por importe. 0 cuando no hay. */
  volumenPctEfectivo: number
}

/**
 * El volumen de una propuesta entera, declarado UNA vez.
 *
 * Lo usan TRES sitios —la lectura de la propuesta, el congelado del snapshot y
 * la comprobación del tope— y por eso vive aquí: tres copias de esta aritmética
 * divergirían, y aquí divergir significa que la pantalla enseñe un total y se
 * cobre otro.
 *
 * ─── Se redondea LÍNEA A LÍNEA ────────────────────────────────────────────
 * Igual que `precioItem`, y por el mismo motivo: el importe de cada renglón
 * tiene que ser un entero que cuadre con lo que enseña el documento. Redondear
 * solo al final dejaría renglones con centavos que no suman el total impreso.
 *
 * ─── El porcentaje efectivo es PONDERADO, no un promedio de tramos ────────
 * Si una pantalla lleva 20 % y otra del mismo importe no lleva nada, de la
 * propuesta se regaló el 10 %, no el 20 ni el 10 «porque son dos». Es el número
 * que se compara contra el tope, así que promediar mal ahí es rechazar ventas
 * que sí caben, o dejar pasar las que no.
 */
export function volumenDeLineas(lineas: LineaConVolumen[]): VolumenDeLineas {
  let bruto = 0
  let descuentoVolumenMonto = 0
  for (const l of lineas ?? []) {
    const precio = Number(l?.precio)
    if (!Number.isFinite(precio)) continue
    bruto += precio
    // Un porcentaje ilegible se lee como CERO, nunca se propaga: `numeric` de
    // Postgres admite NaN y lo multiplica alegremente, así que una sola fila
    // corrupta convertiría el bruto entero de la propuesta en NaN y la petición
    // contestaría 200 OK. Es el fallo exacto que documenta `lib/descuento.ts`.
    const pct = Number(l?.descuentoVolumenPct)
    if (!Number.isFinite(pct) || pct <= 0) continue
    descuentoVolumenMonto += Math.round(precio * (Math.min(pct, 100) / 100))
  }
  return {
    bruto,
    descuentoVolumenMonto,
    brutoConVolumen: bruto - descuentoVolumenMonto,
    volumenPctEfectivo: bruto > 0 ? (descuentoVolumenMonto * 100) / bruto : 0,
  }
}
