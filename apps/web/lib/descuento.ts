// ============================================================================
//  lib/descuento.ts — el descuento de una propuesta, validado y acotado.
// ----------------------------------------------------------------------------
//  Vive APARTE del repositorio a propósito: `propuestas-repo.ts` arrastra
//  `cache()` de React, así que importarlo fuera de Next revienta antes de
//  ejecutar nada y su lógica pura no se podría probar. Mismo motivo por el que
//  existe `lib/perfil-acceso.ts`.
// ============================================================================

import { volumenDeLineas } from './volumen'
import { paqueteDeFila } from './paquete'

export class DescuentoInvalido extends Error {
  constructor(recibido: unknown) {
    super(`El descuento debe ser un número entre 0 y 100; llegó ${JSON.stringify(recibido)}`)
  }
}

/**
 * Devuelve el descuento acotado a [0, 100], o revienta si no es un número.
 *
 * ─── El fallo que motiva esta función ──────────────────────────────────────
 * El recorte era `Math.max(0, Math.min(100, Number(input.descuentoPct)))`, y
 * **no recortaba nada** cuando el valor no era un número: `Number('abc')` es
 * `NaN`, `Math.min(100, NaN)` es `NaN` y `Math.max(0, NaN)` también. Parecía
 * una guarda y no lo era.
 *
 * Y la base no lo frenaba: `numeric` de Postgres **admite NaN** y lo propaga
 * —`'NaN'::numeric * 5` vuelve a ser `NaN`—, así que el descuento contaminaba
 * el bruto, el neto y el aprobado de esa propuesta, y la petición contestaba
 * 200 OK. `PATCH /api/propuestas/[id]` pasa el cuerpo crudo: ese camino no
 * tiene esquema, y esta es su única defensa.
 *
 * `Infinity` se rechaza aunque el recorte lo dejara «bien» en 100: quien manda
 * `Infinity` no está pidiendo el 100 %, está mandando basura, y aceptarla
 * esconde el error de quien llama.
 */
export function descuentoValido(valor: unknown): number {
  // `Number([])` es 0 y `Number(true)` es 1: sin este filtro, un arreglo vacío
  // se guardaría como «sin descuento» y un booleano como «1 %».
  if (typeof valor !== 'number' && typeof valor !== 'string') throw new DescuentoInvalido(valor)
  if (typeof valor === 'string' && valor.trim() === '') throw new DescuentoInvalido(valor)
  const n = Number(valor)
  if (!Number.isFinite(n)) throw new DescuentoInvalido(valor)
  return Math.max(0, Math.min(100, n))
}

// ────────────────────────────────────────────────────────────────────────────
//  TOPE-01 · el techo de descuento que autoriza la ORGANIZACIÓN
// ────────────────────────────────────────────────────────────────────────────
//
// ─── El agujero que cierra ─────────────────────────────────────────────────
// `descuentoValido` acotaba a [0, 100] y nada más. O sea que **el 90 % pasaba
// liso**, lo podía poner cualquier rol COMERCIAL
// (`app/api/propuestas/[id]/route.ts:13` pide `exigir('comercial','crear')`) y
// **sin la contraseña**: propuestas no está entre las rutas con
// `exigirCambioSensible`. Cambiar la renta de una pantalla sí la pedía;
// regalar el 80 % de una venta, no. El único freno era el 100 % exacto, y ése
// ni siquiera es una validación del porcentaje: es `PropuestaCeroError`
// (`propuestas-repo.ts:589`), que mira el TOTAL.
//
// ─── Por qué son DOS funciones y no un argumento más de `descuentoValido` ──
// Porque los verbos son distintos. `descuentoValido` **RECORTA** (250 → 100) y
// el tope tiene que **RECHAZAR**. Recortar en silencio al 40 % una propuesta
// que se pidió al 70 % guardaría un número que nadie tecleó, sobre dinero, y
// contestando 200 OK — que es exactamente la familia de fallo de la que nació
// este archivo. Además, meter el tope dentro rompería a los llamantes que hoy
// esperan el recorte.
//
// ─── Por qué el tope viaja como ARGUMENTO ─────────────────────────────────
// Este módulo es puro a propósito (ver la cabecera del archivo): si leyera la
// configuración él mismo arrastraría `db.ts` y dejaría de poder probarse sin
// Postgres. Quien lo lee CON contexto de tenant —que es lo que importa, porque
// el techo es de cada organización— es
// `config-repo.topeDescuentoDelTenant()`.

/**
 * Tope por omisión: **100 %**, o sea el comportamiento exacto de antes de que
 * el tope existiera.
 *
 * Es la misma decisión que `PLAZOS_COBRANZA_RESPALDO` y por el mismo motivo: un
 * dato ilegible —columna corrupta, base sin la migración todavía, `null`— NO
 * puede interpretarse como «tope 0», porque eso apagaría la venta entera de esa
 * organización sin que nadie lo decidiera. Un fallo mucho peor, y sobre dinero,
 * que el que se está corrigiendo.
 */
export const TOPE_DESCUENTO_RESPALDO = 100

/** El descuento pedido pasa el techo que autoriza la organización. */
export class DescuentoSobreTope extends Error {
  readonly pedido: number
  readonly tope: number
  /** VOL-02 · el volumen de la propuesta que entró en la cuenta. 0 = no había. */
  readonly volumenPct: number
  constructor(pedido: number, tope: number, volumenPct = 0) {
    // El mensaje DICE EL TOPE. Un «valor inválido» genérico deja a quien vende
    // sin saber qué número sí puede teclear, y la única salida es preguntar.
    //
    // Y cuando hay volumen DICE TAMBIÉN EL VOLUMEN Y LA CUENTA. Sin eso, a
    // alguien le rechazan un 10 % contra un tope del 20 % y lo único que puede
    // concluir es que el sistema está roto — el número que sobra no está en
    // ninguna de las dos cifras que él ve.
    const base =
      `El descuento máximo que autoriza tu organización es ${pct(tope)} %, y se pidió ` +
      `${pct(pedido)} %.`
    const conVolumen =
      volumenPct > 0
        ? `El descuento máximo que autoriza tu organización es ${pct(tope)} %. ` +
          `Esta propuesta ya lleva ${pct(volumenPct)} % por volumen, así que un ` +
          `${pct(pedido)} % comercial deja un ${pct(descuentoContraTope(pedido, volumenPct))} % ` +
          `en total (los descuentos se componen, no se suman).`
        : base
    super(`${conVolumen} Pídele a Administración que lo suba si hace falta.`)
    this.pedido = pedido
    this.tope = tope
    this.volumenPct = volumenPct
  }
}

/** `22.00` → `'22'`, `12.50` → `'12.5'`. `numeric` de `pg` llega con ceros. */
function pct(n: number): string {
  return String(Number(n.toFixed(2)))
}

/**
 * Acota el TOPE a [0, 100]. Lo ilegible cae al respaldo del 100 %, nunca a 0.
 *
 * Se usa en los dos extremos —al guardarlo desde Administración y al leerlo de
 * la base— porque el CHECK de la columna protege de lo que entra por la
 * aplicación, no de lo que entre por `psql` ni de una base que todavía no tenga
 * la migración aplicada.
 */
export function topeDescuentoValido(valor: unknown): number {
  if (typeof valor !== 'number' && typeof valor !== 'string') return TOPE_DESCUENTO_RESPALDO
  if (typeof valor === 'string' && valor.trim() === '') return TOPE_DESCUENTO_RESPALDO
  const n = Number(valor)
  if (!Number.isFinite(n)) return TOPE_DESCUENTO_RESPALDO
  return Math.max(0, Math.min(100, n))
}

// ────────────────────────────────────────────────────────────────────────────
//  VOL-02 · ¿el descuento por VOLUMEN cuenta contra este tope?
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠️ ESTA ES LA PREGUNTA DE NEGOCIO DE LA FASE 2, Y NO LA DECIDE EL CÓDIGO.
// Está preguntada al dueño. Mientras no conteste, la respuesta implementada es
// **SÍ cuenta**, y vive ENTERA en la función de abajo: cambiarla a «no cuenta»
// es cambiar su cuerpo por `return descuentoValido(comercialPct)` y ajustar
// `descuento.volumen.test.ts`. Ningún otro archivo se entera.
//
// ─── Por qué SÍ, mientras nadie diga lo contrario ─────────────────────────
// El tope nació el 2026-09-28 porque cualquier comercial podía regalar el 90 %.
// Si el volumen no contara, un 15 % de volumen más el tope entero volvería a
// dejar el techo real por encima de lo que alguien autorizó — y el tope dejaría
// de ser el techo, que es justo el agujero que vino a cerrar. Es el criterio
// del ADR 0039 §2: **la regla nace cerrada y se abre a propósito.**
//
// ─── Por qué COMPUESTO y no sumado ────────────────────────────────────────
// Porque compuesto es lo que de verdad se regaló. Un 20 % de volumen y un 20 %
// comercial dejan al cliente pagando el 64 %, o sea un **36 %** regalado, no un
// 40 %. Comparar contra el tope una suma que nadie dejó de cobrar cerraría
// ventas por un margen que no se perdió.
//
// ─── Lo que cuesta, dicho con todas las letras ────────────────────────────
// El volumen se come margen de negociación del vendedor: con una escala del
// 15 % y un tope del 20 %, al comercial le quedan ~5,9 puntos, no 5 ni 20. Y si
// el dueño deja el tope POR DEBAJO de su propia escala, ninguna propuesta con
// volumen podrá tocar su descuento hasta que arregle una de las dos cosas. Eso
// es visible y se explica; lo contrario —un techo que no es techo— no se ve.

// ────────────────────────────────────────────────────────────────────────────
//  COD-02 · ¿el CÓDIGO PROMOCIONAL cuenta contra este tope?
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠️ ESTA ES LA PREGUNTA DE NEGOCIO DE LA FASE 3, Y NO LA DECIDE EL CÓDIGO.
// Está preguntada al dueño. Mientras no conteste, la respuesta implementada es
// **NO cuenta**, y vive entera en la constante de abajo: cambiarla a `true`
// hace que `descuentoContraTope` componga también el cupón, y ningún otro
// archivo se entera. La aritmética de las tres capas ya está escrita y probada
// (`componerDescuentos`), así que el cambio es una línea.
//
// ─── Por qué NO, mientras nadie diga lo contrario ─────────────────────────
// Porque el tope y el cupón **acotan a personas distintas**. El tope nació el
// 2026-09-28 para que ningún COMERCIAL regalara el 90 % por su cuenta: acota la
// DISCRECIÓN DE QUIEN VENDE. El volumen cuenta contra él (VOL-02) precisamente
// porque se apila debajo del vendedor sin que él lo elija — si no contara, el
// techo real volvería a quedar por encima de lo autorizado.
//
// Un cupón es lo contrario: **lo creó el dueño**. Alguien de Administración
// decidió «VERANO20 vale un 20 %, hasta el 31 de octubre, cien usos», y lo hizo
// desde una pantalla que pide `exigirCambioSensible`. Esa decisión ES la
// autorización. Hacer que compita contra el tope significaría que la promoción
// del dueño queda bloqueada por el tope del dueño, y con una escala del 15 % y
// un tope del 20 % ni siquiera cabría con cero descuento comercial.
//
// ─── Y hay un motivo de oportunidad, que es el que decide ─────────────────
// El cupón se canjea al APLICARLO, y el tope se comprueba al guardar el
// descuento comercial. Si el cupón contara, un vendedor podría aplicar el
// código, prometérselo al cliente, y descubrir después —al teclear su
// descuento— que ya no cabe. **Un cupón es lo único de esta cadena que se le
// promete a alguien de fuera de la casa**, y un «sí» que se convierte en «no»
// no se arregla con una nota de crédito.
//
// ─── Lo que cuesta, dicho con todas las letras ────────────────────────────
// El descuento total de una venta puede pasar del tope. Con volumen 15 %,
// comercial 20 % y cupón 20 %, se regaló el 45,6 % y el tope decía 20. Eso es
// visible —las tres capas se imprimen por separado en el documento— y cada una
// la autorizó alguien; pero quien lea «tope de descuento: 20 %» en la pantalla
// de configuración no está viendo el techo real de una venta con cupón.
export const CODIGO_CUENTA_CONTRA_TOPE: boolean = false

/**
 * El número que se compara contra el tope de la organización.
 *
 * `comercialPct`, `volumenPct` y `codigoPct` en por ciento. Devuelve el
 * descuento EFECTIVO compuesto, también en por ciento.
 *
 * Con `volumenPct = 0` devuelve el comercial tal cual, y ése es el detalle que
 * hace que toda la base instalada se comporte exactamente igual que antes de
 * la Fase 2. Y `codigoPct` hoy **no se usa** (ver COD-02 arriba), así que
 * omitirlo o pasarlo da el mismo número.
 */
export function descuentoContraTope(
  comercialPct: unknown,
  volumenPct: unknown,
  codigoPct: unknown = 0,
): number {
  const c = descuentoValido(comercialPct)
  // COD-02 · el cupón entra en la cuenta SOLO si la constante lo dice. Hoy no
  // lo dice, así que este argumento se anula aquí y la aritmética de abajo
  // recibe un 0 — que es exactamente lo que hacía esta función antes de la
  // Fase 3, dígito por dígito.
  return componerDescuentos(volumenPct, c, CODIGO_CUENTA_CONTRA_TOPE ? codigoPct : 0)
}

/**
 * Un porcentaje legible y acotado a [0, 100]. Lo ilegible es **0**, nunca NaN.
 *
 * El volumen y el cupón NO usan `descuentoValido`: lo ilegible aquí no es culpa
 * de quien teclea —sale de la base— y reventar dejaría la propuesta imposible
 * de editar. Cae a 0, que es «no hay esa capa». Nunca a NaN: `NaN > tope` es
 * false y desactivaría el tope en silencio, que es el fallo del que nació este
 * archivo y el mutante M10 de la Fase 2.
 */
function pctSeguro(valor: unknown): number {
  const bruto =
    typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN
  return Number.isFinite(bruto) ? Math.max(0, Math.min(100, bruto)) : 0
}

/**
 * Compone porcentajes de descuento. **Se componen, no se suman** (ADR 0039 §1).
 *
 * `componerDescuentos(20, 20)` es 36, no 40: el cliente paga 0,8 × 0,8 = 64 %.
 * Con tres capas del 20 % es 48,8 %, no 60 — que es el ejemplo con el que el
 * ADR 0039 explica la regla.
 *
 * Vive aparte de `descuentoContraTope` porque son dos cosas distintas: esto es
 * la ARITMÉTICA, que vale siempre; aquélla es la POLÍTICA de qué capas entran
 * en la cuenta del tope, que es una decisión de negocio. Separarlas es lo que
 * permite que cambiar la política sea cambiar una constante.
 */
export function componerDescuentos(...pcts: unknown[]): number {
  let factor = 1
  for (const p of pcts) factor *= 1 - pctSeguro(p) / 100
  return 100 * (1 - factor)
}

/**
 * El descuento validado **y por debajo del techo de la organización**.
 *
 * Revienta con `DescuentoSobreTope` si lo pasa: por encima del tope **no se
 * guarda nada**. El límite es INCLUSIVO —un tope del 40 % significa «hasta
 * 40», no «menos de 40»—: quien configura 40 espera poder cerrar al 40.
 *
 * `volumenPct` (VOL-02) es el volumen ya aplicado a esta propuesta. Omitirlo es
 * decir «no hay volumen», y entonces esto hace exactamente lo de siempre — por
 * eso los llamantes anteriores a la Fase 2 no cambian.
 */
export function descuentoDentroDelTope(
  valor: unknown,
  tope: unknown,
  volumenPct: unknown = 0,
  codigoPct: unknown = 0,
): number {
  // Primero la guarda de siempre: `NaN` no puede colarse por «NaN > tope es
  // false», que es exactamente el modo de fallo que documenta este archivo.
  const d = descuentoValido(valor)
  const techo = topeDescuentoValido(tope)
  const efectivo = descuentoContraTope(d, volumenPct, codigoPct)
  // La comparación lleva una tolerancia de `1e-9` puntos porcentuales, o sea
  // una milmillonésima: el compuesto sale de multiplicar flotantes, y
  // `100 × (1 − 0.8 × 0.75)` da 19.999999999999996 — que sin la tolerancia
  // rechazaría un caso que vale exactamente 20 contra un tope de 20. Un tope es
  // un número que alguien tecleó, no una cota de precisión. El margen es lo
  // bastante pequeño como para no dejar pasar nada que importe: el descuento
  // más fino que se puede teclear es de centésimas de punto.
  if (efectivo - techo > 1e-9) {
    // El error NOMBRA el comercial pedido, no el efectivo: es el número que la
    // persona tecleó y el único que puede cambiar. El efectivo va en el texto.
    throw new DescuentoSobreTope(d, techo, descuentoContraTope(0, volumenPct))
  }
  return d
}

/**
 * Lo que la bitácora escribe al guardar una propuesta.
 *
 * `descuentoAplicado` es `null` cuando este guardado **no tocó el descuento**
 * (se editó el nombre o las notas). Entonces el texto se queda como estaba:
 * anotar un descuento en cada guardado llenaría Actividad de ruido y haría
 * inútil el filtro por persona, que es justo lo que se quiere poder enseñar.
 *
 * Se escribe para que lo lea alguien que no programa: lo pinta
 * `app/(app)/(shell)/actividad/page.tsx:137` como
 * «<persona> · <accion> <nombre de la propuesta>».
 */
export function textoBitacoraPropuesta(version: number, descuentoAplicado: number | null): string {
  if (descuentoAplicado == null) return `Actualizó propuesta (v${version})`
  // Bajar a 0 es QUITAR el descuento. «Puso 0 % de descuento» se lee como si
  // hubiera hecho algo a favor del cliente, y es lo contrario.
  if (descuentoAplicado === 0) return `Quitó el descuento de la propuesta (v${version})`
  return `Puso ${pct(descuentoAplicado)} % de descuento en la propuesta (v${version})`
}

// ────────────────────────────────────────────────────────────────────────────
//  TOPE-03 · la cuenta del tope de UNA PROPUESTA, escrita una sola vez
// ────────────────────────────────────────────────────────────────────────────
//
// Hasta el 2026-10-05 esta cuenta vivía DENTRO de `actualizarPropuesta`, y era
// el único sitio que la hacía. Si Administración bajaba el tope después de que
// una propuesta guardó su descuento, ni la aprobación interna
// (`cambiarEstatusPropuesta`) ni la aceptación del cliente por la liga
// (`aceptarPropuestaPublica`) la repetían, y el descuento por encima del techo
// VIGENTE se congelaba en el snapshot. Para que las tres puertas digan lo mismo
// la cuenta tiene que ser UNA: si cada una la copiara, el día que el dueño
// conteste VOL-02 o COD-02 se cambiaría en un sitio y no en los otros.

/** Las columnas de `propuestas` que deciden qué capas cuentan contra el tope. */
export interface FilaPropuestaTope {
  paquete_nombre?: unknown
  paquete_precio?: unknown
  paquete_admite_codigo?: unknown
  codigo_descuento_pct?: unknown
}

/** Una línea de `propuesta_items`, tal como sale de la base. */
export interface LineaPropuestaTope {
  precio: unknown
  descuento_volumen_pct?: unknown
}

/**
 * El descuento comercial `comercialPct` **validado contra el tope de esa
 * propuesta**: revienta con `DescuentoSobreTope` si no cabe.
 *
 * - **Volumen** (VOL-02): el de las líneas tal como se capturó, no lo que la
 *   escala diga hoy. **Con paquete vivo no cuenta** (PAQ-01): no se aplicó.
 * - **Cupón** (COD-02): se pasa siempre bien —0 si el paquete no lo admite,
 *   porque no descontó nada— y `CODIGO_CUENTA_CONTRA_TOPE` decide si cuenta.
 */
export function descuentoDePropuestaDentroDelTope(
  comercialPct: unknown,
  tope: unknown,
  fila: FilaPropuestaTope,
  lineas: readonly LineaPropuestaTope[],
): number {
  const paqueteVivo = paqueteDeFila(fila)
  const volumenPct = paqueteVivo
    ? 0
    : volumenDeLineas(
        (lineas ?? []).map((l) => ({
          precio: Number(l.precio),
          descuentoVolumenPct: Number(l.descuento_volumen_pct ?? 0),
        })),
      ).volumenPctEfectivo
  const codigoPct =
    paqueteVivo && !paqueteVivo.admiteCodigo ? 0 : Number(fila.codigo_descuento_pct ?? 0)
  return descuentoDentroDelTope(comercialPct, tope, volumenPct, codigoPct)
}

/**
 * TOPE-03 · lo que se le dice a QUIEN APRUEBA cuando el descuento guardado ya
 * no cabe en el tope de hoy. Dice los dos números y qué hacer: un «no se puede»
 * sin la cifra deja a quien aprueba sin saber cuánto bajar.
 */
export function mensajeTopeVigente(e: DescuentoSobreTope): string {
  const total =
    e.volumenPct > 0
      ? ` (${pct(descuentoContraTope(e.pedido, e.volumenPct))} % en total con el ` +
        `${pct(e.volumenPct)} % por volumen)`
      : ''
  return (
    `El descuento de esta propuesta, ${pct(e.pedido)} %${total}, supera el tope vigente ` +
    `de tu organización, ${pct(e.tope)} %: el tope se bajó después de guardarlo. ` +
    'Ajusta el descuento antes de aprobarla, o pídele a Administración que suba el tope.'
  )
}

/**
 * TOPE-03 · lo que se le dice al CLIENTE en la liga pública. **No nombra el
 * tope**: es un dato interno de la organización y el cliente no puede hacer
 * nada con él. Lo único útil para él es a quién acudir.
 */
export const MSJ_TOPE_VIGENTE_PUBLICO =
  'Esta propuesta necesita una revisión de su descuento antes de poder aceptarse. ' +
  'Pídele a tu ejecutivo que te envíe la versión actualizada.'
