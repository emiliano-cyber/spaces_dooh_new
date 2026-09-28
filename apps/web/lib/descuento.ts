// ============================================================================
//  lib/descuento.ts — el descuento de una propuesta, validado y acotado.
// ----------------------------------------------------------------------------
//  Vive APARTE del repositorio a propósito: `propuestas-repo.ts` arrastra
//  `cache()` de React, así que importarlo fuera de Next revienta antes de
//  ejecutar nada y su lógica pura no se podría probar. Mismo motivo por el que
//  existe `lib/perfil-acceso.ts`.
// ============================================================================

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
  constructor(pedido: number, tope: number) {
    // El mensaje DICE EL TOPE. Un «valor inválido» genérico deja a quien vende
    // sin saber qué número sí puede teclear, y la única salida es preguntar.
    super(
      `El descuento máximo que autoriza tu organización es ${pct(tope)} %, y se pidió ` +
      `${pct(pedido)} %. Pídele a Administración que lo suba si hace falta.`,
    )
    this.pedido = pedido
    this.tope = tope
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

/**
 * El descuento validado **y por debajo del techo de la organización**.
 *
 * Revienta con `DescuentoSobreTope` si lo pasa: por encima del tope **no se
 * guarda nada**. El límite es INCLUSIVO —un tope del 40 % significa «hasta
 * 40», no «menos de 40»—: quien configura 40 espera poder cerrar al 40.
 */
export function descuentoDentroDelTope(valor: unknown, tope: unknown): number {
  // Primero la guarda de siempre: `NaN` no puede colarse por «NaN > tope es
  // false», que es exactamente el modo de fallo que documenta este archivo.
  const d = descuentoValido(valor)
  const techo = topeDescuentoValido(tope)
  if (d > techo) throw new DescuentoSobreTope(d, techo)
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
