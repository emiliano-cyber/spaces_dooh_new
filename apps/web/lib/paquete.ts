// ============================================================================
//  lib/paquete.ts — El PAQUETE CERRADO.  ADR 0039, Fase 4.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Hermano de `rejilla.ts` y de
//  `volumen.ts`, y por el mismo motivo: `propuestas-repo.ts` arrastra `cache()`
//  de React, así que esta aritmética no se podría probar sin Next.
// ----------------------------------------------------------------------------
//  DÓNDE ENCAJA EN LA CADENA (ADR 0039), y por qué es la rara de las cuatro:
//
//      tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
//            ×  descuento por volumen                       ← Fase 2
//            │       …O BIEN **PRECIO DE PAQUETE**,         ← aquí
//            │          que SUSTITUYE la suma entera
//            ×  descuento comercial (con su tope)
//            ×  código promocional                          ← Fase 3
//            ×  (1 − comisión de agencia)
//            =  neto
//
//  Las fases 2 y 3 **modifican** un precio ya resuelto: son factores. Un
//  paquete **lo sustituye**: «estas cinco pantallas, prime, un mes: 180 000»,
//  y da igual lo que sumen sus tarifas de lista. Por eso rompe la aritmética de
//  todas las capas anteriores y por eso el ADR la puso la última.
//
//  ═══ LA PARTE DIFÍCIL, Y ES ÉSTA ═══════════════════════════════════════════
//
//  El precio del paquete HAY QUE REPARTIRLO entre sus pantallas, aunque el
//  cliente compre un conjunto. No es una floritura contable: el reporte de
//  rentabilidad atribuye ingreso POR PANTALLA (`reservas.precio`) y el contrato
//  del arrendador cuelga de cada una. Un paquete cuyo precio se quedara en la
//  cabecera dejaría cinco pantallas con ingreso cero y una renta que pagar, o
//  sea cinco líneas en pérdida en el reporte que se enseña en el Summit.
//
//  Y el reparto tiene que sumar **exactamente** el precio del paquete. Un peso
//  de diferencia por redondeo significa que la suma de lo que se factura no es
//  lo que el cliente aceptó, y ese peso no se puede explicar seis meses
//  después. Ver `repartirPaquete`.
// ============================================================================

/** Una pantalla del paquete con la parte del precio cerrado que le tocó. */
export type SitioDelPaquete = {
  sitioId: string
  /** Su porción del precio cerrado, en pesos enteros. Σ partes === precio. */
  parte: number
}

/**
 * Lo que se le dice a quien vende cuando su propuesta lleva un paquete.
 *
 * Se guarda DENTRO del snapshot, igual que `AVISO_FRANJA_NO_VIAJA_AL_CMS`: el
 * documento congelado es lo que alguien audita, y si la advertencia viviera
 * solo en una pantalla nadie sabría por qué la cuenta no da.
 */
export const AVISO_PAQUETE_PRECIO_CERRADO =
  'El precio de este paquete es cerrado: sustituye la suma de las tarifas de lista y ' +
  'no admite descuento por volumen. Quitar una pantalla no baja el precio.'

/** Un número legible y no negativo, o `0`. Nunca `NaN`. */
function pesoSeguro(v: unknown): number {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/**
 * Reparte `total` entre las líneas, a PRORRATA de su tarifa de lista.
 *
 * Devuelve un arreglo del mismo largo que `pesos`, de enteros no negativos,
 * cuya **suma es exactamente `Math.round(total)`**. Siempre. Es la garantía
 * entera de esta función y la razón por la que existe.
 *
 * ─── Por qué A PRORRATA y no a partes iguales ─────────────────────────────
 * Porque la parte de cada pantalla se convierte en `reservas.precio`, y de ahí
 * sale el ingreso por pantalla del reporte de rentabilidad y la comparación
 * contra la renta que se le paga a su arrendador. A partes iguales, una
 * pantalla de prime de 500 000 y una de barrio de 5 000 recibirían lo mismo:
 * el reporte diría que la de barrio es un negocio redondo y la de prime una
 * ruina, con los dos números inventados por el reparto y no por la venta.
 *
 * A prorrata, en cambio, cada pantalla conserva su PROPORCIÓN dentro del
 * conjunto —que es lo único que el dato original dice— y el descuento del
 * paquete se reparte igual de fino entre todas. Es además la única regla que
 * degrada bien: con todas las listas iguales da exactamente partes iguales.
 *
 * ─── Cómo se garantiza que la suma cuadre AL PESO ─────────────────────────
 * Con el método del **mayor resto** (Hare), que es el mismo con el que se
 * reparten escaños:
 *
 *   1. `exacto_i = total × peso_i / Σpesos`  (con decimales)
 *   2. `base_i  = floor(exacto_i)`           (a cada uno, su parte entera)
 *   3. `resto   = total − Σbase_i`           (lo que sobró por truncar)
 *   4. ese `resto` se reparte de UNO EN UNO entre las líneas con la fracción
 *      más grande, que son las que más perdieron al truncar.
 *
 * La suma es exacta **por construcción**, no por suerte: el paso 4 añade
 * exactamente `resto` unidades, así que el total es `Σbase + resto = total`.
 * No hay ningún redondeo al final del que pueda salir un peso de más.
 *
 * Eso es lo que lo separa de la alternativa evidente —`Math.round(total ×
 * peso_i / Σpesos)` en cada línea—, que NO cuadra: 180 000 entre siete
 * pantallas iguales da 25 714,28 en cada una, siete redondeos a 25 714 y un
 * total de 179 998. Dos pesos que faltan en el importe que el cliente aceptó.
 *
 * ─── El desempate es DETERMINISTA, y eso importa más de lo que parece ─────
 * Fracción mayor primero; a igualdad, la de mayor peso; a igualdad, la que
 * viene antes. Dos lecturas de la misma venta tienen que dar el MISMO reparto,
 * porque una se congela en el snapshot y otra alimenta la campaña — si
 * discreparan, la factura y la cotización dirían cosas distintas. Mismo
 * criterio con el que `temporadaDeFecha` devuelve siempre la primera que cubre.
 *
 * ─── Los bordes, y por qué cada uno cae del lado que cae ──────────────────
 * · Sin líneas → reparto vacío. No hay dónde poner el dinero, y reventar aquí
 *   dejaría la propuesta imposible de leer.
 * · Σpesos ≤ 0 (todas las listas en cero, o ilegibles) → **partes iguales**.
 *   Es el único reparto que no requiere información que no existe. Un `0/0`
 *   daría `NaN`, y `numeric` de Postgres ADMITE `NaN` y lo propaga: el neto
 *   entero de la propuesta se envenenaría y la petición contestaría 200 OK.
 * · Un peso ilegible o negativo cuenta como **cero**, no contamina a los demás.
 * · Un `total` ilegible se lee como **cero**, nunca como `NaN`.
 */
export function repartirPaquete(pesos: unknown[], total: unknown): number[] {
  const n = Array.isArray(pesos) ? pesos.length : 0
  if (n === 0) return []

  const bruto = typeof total === 'number' || typeof total === 'string' ? Number(total) : NaN
  const T = Number.isFinite(bruto) ? Math.round(Math.max(0, bruto)) : 0

  const w = (pesos as unknown[]).map(pesoSeguro)
  let W = 0
  for (const x of w) W += x
  // Todas las listas en cero: el reparto equitativo es el único que no inventa
  // una proporción. Se implementa dando a todos el mismo peso, así que el resto
  // lo sigue colocando el mismo mecanismo de abajo y no hay una segunda rama
  // que pueda divergir.
  if (!(W > 0)) {
    for (let i = 0; i < n; i++) w[i] = 1
    W = n
  }

  const base = new Array<number>(n)
  const frac = new Array<number>(n)
  let asignado = 0
  for (let i = 0; i < n; i++) {
    const exacto = (T * w[i]) / W
    const b = Math.floor(exacto)
    base[i] = b
    frac[i] = exacto - b
    asignado += b
  }

  // Lo que sobró por truncar. Es un entero de [0, n] por construcción: cada
  // fracción está en [0, 1), así que su suma es menor que n.
  const resto = T - asignado

  // El orden del desempate, declarado UNA vez y con los tres criterios a la
  // vista. Escrito como comparador y no como «el mayor» en un bucle porque los
  // empates son el caso normal —todas las listas iguales— y ahí el orden es lo
  // único que hace el resultado reproducible.
  const orden = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    if (frac[b] !== frac[a]) return frac[b] - frac[a]
    if (w[b] !== w[a]) return w[b] - w[a]
    return a - b
  })

  const salida = base.slice()
  // `% n` es una red, no el camino normal: `resto` nunca llega a n. Pero si
  // alguna vez lo hiciera —por un borde de coma flotante que no se ha visto—,
  // esto sigue sumando exactamente `T` en vez de escribir fuera del arreglo.
  for (let k = 0; k < resto; k++) salida[orden[k % n]] += 1
  return salida
}

/**
 * ¿Las pantallas de la propuesta siguen siendo las que formaban el paquete?
 *
 * `composicion` son los sitios CONGELADOS el día en que se aplicó el paquete
 * (`propuestas.paquete_composicion`); `sitiosActuales`, los de las líneas de
 * hoy. Devuelve la frase que hay que enseñar, o `null` si coinciden.
 *
 * ═══ ÉSTA ES LA TERCERA PREGUNTA DE LA FASE, Y LA RESPUESTA ES «SE AVISA» ═══
 *
 * ¿Qué pasa si alguien quita una pantalla de un paquete ya cotizado? Había tres
 * respuestas posibles y las tres se consideraron:
 *
 *  · **Se recalcula el precio hacia abajo.** Descartada: es exactamente lo que
 *    «precio cerrado» significa que NO pasa. Y bajaría el importe en silencio,
 *    que es el lado del que el ADR 0039 §1 dice que no se vuelve: cobrar de más
 *    se corrige con una nota de crédito; regalar ya se regaló.
 *  · **Se rompe** (no se deja quitar). Descartada: una cotización en borrador
 *    tiene que poder editarse, y prohibirlo obligaría a rehacerla entera por
 *    una pantalla que se cayó.
 *  · **Se avisa, y el precio NO se mueve.** Elegida. El reparto se recalcula
 *    sobre las pantallas que quedan —así que Σ partes sigue siendo el precio
 *    del paquete— y la propuesta LO DICE, con el número de antes y el de ahora.
 *
 * Y lo que cuesta, con todas las letras: **quitar una pantalla de un paquete de
 * 180 000 sigue costando 180 000.** Es lo correcto y es sorprendente, así que
 * el sistema no puede callárselo. Un paquete que se quedara callado sería la
 * misma familia de fallo que el `?? 0` del mapa.
 *
 * Una vez APROBADA la propuesta nada de esto aplica: el snapshot congeló el
 * precio, la composición y el reparto, y ya no se mueve nunca.
 *
 * ─── Se comparan los CONJUNTOS, no los tamaños ────────────────────────────
 * Cambiar una pantalla por otra deja el número igual y la venta distinta. Un
 * aviso que solo contase no vería ese caso, que es justo el que no se nota.
 */
export function avisoPaqueteIncompleto(
  composicion: readonly string[] | null | undefined,
  sitiosActuales: readonly string[],
  nombre: string,
  precio: number,
): string | null {
  if (!Array.isArray(composicion) || composicion.length === 0) return null
  const antes = new Set(composicion.map(String))
  const ahora = new Set((sitiosActuales ?? []).map(String))
  let iguales = antes.size === ahora.size
  if (iguales) for (const s of antes) if (!ahora.has(s)) { iguales = false; break }
  if (iguales) return null
  // Sin acentos: este texto viaja al snapshot congelado y a la liga publica, y
  // se ha visto llegar mutilado por codificaciones intermedias.
  const p = Number.isFinite(precio) ? Math.round(precio) : 0
  return (
    `El paquete "${sinAcentos(nombre)}" se cotizo con ${antes.size} pantalla(s) y esta ` +
    `propuesta tiene ${ahora.size}. El precio cerrado NO baja: sigue siendo ` +
    `$${p.toLocaleString('es-MX')}, repartido entre las pantallas que quedan. ` +
    `Si el trato cambio, quita el paquete o ajusta su definicion.`
  )
}

/** Quita los acentos de un texto que va a viajar congelado. */
function sinAcentos(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Lo mínimo que tiene que traer un paquete para poder guardarse. */
export type PaqueteCandidato = {
  nombre: string
  precioCerrado: number
  sitios: string[]
}

/**
 * Por qué NO se puede guardar este paquete, o `null` si sí se puede.
 *
 * ─── Por qué el precio tiene que ser un ENTERO de pesos ───────────────────
 * Porque el reparto es en pesos enteros (ver `repartirPaquete`) y todo el
 * dinero de este repositorio se redondea a pesos. Un precio con centavos
 * obligaría a decidir qué línea se queda el centavo, y ese centavo no se puede
 * explicar. Se rechaza al capturar, que es donde hay una persona que puede
 * arreglarlo, en vez de redondearlo en silencio.
 *
 * ─── Por qué DOS pantallas como mínimo ────────────────────────────────────
 * Un «paquete» de una sola pantalla es una tarifa con otro nombre, y admitirlo
 * abriría un camino para fijar el precio de una pantalla saltándose la rejilla,
 * el volumen y el tope de descuento de golpe. El precio de una pantalla se pone
 * en su tarifa.
 */
export function motivoPaqueteInvalido(p: PaqueteCandidato): string | null {
  const nombre = String(p?.nombre ?? '').trim()
  if (!nombre) return 'El paquete necesita un nombre.'
  if (nombre.length > 120) return 'El nombre del paquete no puede pasar de 120 caracteres.'

  const bruto = p?.precioCerrado
  if (typeof bruto !== 'number' && typeof bruto !== 'string') {
    return 'El precio del paquete tiene que ser un numero.'
  }
  const precio = Number(bruto)
  if (!Number.isFinite(precio)) return 'El precio del paquete tiene que ser un numero.'
  if (precio <= 0) {
    return 'El precio de un paquete tiene que ser mayor que 0: un paquete gratis no es un paquete.'
  }
  if (!Number.isInteger(precio)) {
    return 'El precio del paquete tiene que ser un numero entero de pesos: el reparto entre las pantallas no admite centavos.'
  }

  const sitios = Array.isArray(p?.sitios) ? p.sitios.map(String) : []
  if (sitios.length < 2) {
    return 'Un paquete necesita al menos 2 pantallas; con una sola, eso es una tarifa y va en la ficha de la pantalla.'
  }
  if (new Set(sitios).size !== sitios.length) {
    return 'Hay una pantalla repetida en el paquete.'
  }
  return null
}

/**
 * El paquete CONGELADO en una propuesta, tal como lo leen las capas de arriba.
 *
 * `null` = esta propuesta no lleva paquete, que es el caso de TODA la base
 * instalada y el invariante de esta fase: sin paquete aplicado, la venta sale
 * exactamente como salía antes.
 */
export type PaqueteAplicado = {
  nombre: string
  /** El precio cerrado, en pesos enteros. SUSTITUYE la suma de las listas. */
  precio: number
  /** Regla 2 del ADR 0039: nace en `false` y se abre a propósito, por paquete. */
  admiteCodigo: boolean
  aplicadoEn: string | null
  /** Las pantallas que lo formaban el día en que se aplicó. */
  composicion: string[] | null
}

/**
 * Lee el paquete congelado de una fila de `propuestas`, con guardas.
 *
 * Declarado AQUÍ y no en el repositorio porque lo necesitan tres sitios —la
 * lectura de la propuesta, el congelado del snapshot y la generación de la
 * campaña— y tres copias de esta lectura divergirían. Divergir aquí significa
 * que la pantalla enseñe un total y se cobre otro.
 *
 * El precio se lee con la misma guarda que el descuento comercial y por el
 * mismo motivo: `numeric` de Postgres ADMITE `NaN` y lo propaga. Un `NaN` aquí
 * no dejaría el importe en cero —eso se vería—, lo dejaría en `NaN`, y el
 * importe se guardaría igual con un 200 OK.
 *
 * Un precio ilegible o ≤ 0 se lee como **sin paquete**: se vuelve al precio de
 * línea, que es el lado prudente (cobra la lista, que es lo publicado).
 */
export function paqueteDeFila(fila: {
  paquete_nombre?: unknown
  paquete_precio?: unknown
  paquete_admite_codigo?: unknown
  paquete_aplicado_en?: unknown
  paquete_composicion?: unknown
}): PaqueteAplicado | null {
  const nombre = fila?.paquete_nombre
  if (nombre == null || String(nombre).trim() === '') return null
  const bruto = fila?.paquete_precio
  const precio =
    typeof bruto === 'number' || typeof bruto === 'string' ? Number(bruto) : NaN
  if (!Number.isFinite(precio) || precio <= 0) return null
  const comp = fila?.paquete_composicion
  return {
    nombre: String(nombre),
    precio: Math.round(precio),
    // `=== true` y no `!!`: la columna es `boolean not null default false`, pero
    // esta lectura también sirve al snapshot ya congelado, donde el campo puede
    // faltar. Ausente tiene que significar APAGADA (regla 2 del ADR 0039), y un
    // `!!` sobre una cadena `'false'` daría `true`.
    admiteCodigo: fila?.paquete_admite_codigo === true || fila?.paquete_admite_codigo === 'true',
    aplicadoEn:
      fila?.paquete_aplicado_en instanceof Date
        ? (fila.paquete_aplicado_en as Date).toISOString()
        : fila?.paquete_aplicado_en != null
          ? String(fila.paquete_aplicado_en)
          : null,
    composicion: Array.isArray(comp) ? comp.map(String) : null,
  }
}
