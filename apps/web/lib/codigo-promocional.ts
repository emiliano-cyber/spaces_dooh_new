// ============================================================================
//  lib/codigo-promocional.ts — El CÓDIGO PROMOCIONAL.  ADR 0039, Fase 3.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Hermano de `volumen.ts`.
// ----------------------------------------------------------------------------
//  DÓNDE ENCAJA EN LA CADENA (ADR 0039):
//
//      tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
//            ×  descuento por volumen                       ← Fase 2
//            ×  descuento comercial (con su tope)
//            ×  CÓDIGO PROMOCIONAL                          ← aquí
//            ×  (1 − comisión de agencia)
//            =  neto
//
//  ─── LO QUE HACE DISTINTO A ESTE ESCALÓN, Y MANDA SOBRE TODO EL DISEÑO ────
//
//  Es **el único de los cuatro que le promete algo a alguien de fuera de la
//  casa**. Una escala de volumen es una regla interna: si mañana cambia, nadie
//  fuera se entera. Un cupón se le dice a un cliente —«teclea VERANO20 y te
//  llevas un 20 %»— y a partir de ahí el sistema tiene que poder sostener esa
//  frase.
//
//  De ahí salen las dos propiedades que un cupón tiene y el volumen no:
//  **vence** y **se agota**. Y las dos son, literalmente, un contador y un
//  reloj — dos cosas que **no pueden vivir en el navegador de quien vende**.
//
//  ─── POR QUÉ ESTE MÓDULO NO DECIDE NADA SOLO ──────────────────────────────
//
//  Aquí viven las REGLAS, no los DATOS. Este archivo no sabe qué día es hoy ni
//  cuántas veces se usó el cupón: las dos cosas entran como argumento, y quien
//  las provee es `lib/server/codigos-repo.ts`, que las lee de Postgres —
//  `current_date` y un `count(*)` bajo el bloqueo de la fila. Es a propósito:
//  si este módulo llamara a `new Date()`, la vigencia la decidiría el reloj de
//  la máquina que ejecute el código, y con `next dev` esa máquina puede ser la
//  del vendedor.
//
//  EL HALLAZGO B40 ES EL MOTIVO DE ESTA SEPARACIÓN. La cadena de precio de la
//  Fase 1 vive ENTERA en el navegador (`resolverTarifa` solo se llama desde un
//  archivo `'use client'`), y sobre eso un cupón no se puede construir: un
//  contador de usos que vive en el navegador no es un contador. Esta fase NO
//  arregla la Fase 1 —es la decisión D11, del dueño— pero **nace del lado
//  correcto**: la pantalla manda el CÓDIGO TECLEADO y nada más.
// ============================================================================

/** Un cupón tal y como lo capturó la organización. */
export type CodigoPromocional = {
  id?: string
  /** El código, como se teclea. Se compara SIEMPRE en mayúsculas. */
  codigo: string
  /** Por ciento que baja el precio. Siempre > 0. */
  descuentoPct: number
  /** Primer día en que se puede canjear, INCLUSIVE. `YYYY-MM-DD`. */
  vigenteDesde: string
  /** Último día en que se puede canjear, INCLUSIVE. `YYYY-MM-DD`. */
  vigenteHasta: string
  /** Cuántas veces se puede canjear en total. `null` = sin tope. */
  usosMaximos: number | null
}

/** La ausencia de cupón: el caso de TODA la base instalada. */
export const SIN_CODIGO = { codigo: null as string | null, descuentoPct: 0 }

/** Una fecha con forma `YYYY-MM-DD` de verdad, o `null`. */
function fechaIso(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  // La forma no basta: '2026-13-45' la pasa. Se comprueba que el calendario la
  // acepte y que no se haya desplazado — `new Date('2026-02-30')` da el 2 de
  // marzo sin quejarse, y esa fecha corrida sería una vigencia que nadie puso.
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10) === s ? s : null
}

/**
 * El código tecleado, listo para comparar: recortado y en MAYÚSCULAS.
 *
 * ─── Por qué se compara sin distinguir mayúsculas ─────────────────────────
 * Porque el cupón se dice de viva voz o se pega de un correo, y nadie teclea
 * `VERANO20` exactamente. Si `verano20` y `VERANO20` fueran dos cupones
 * distintos, el descuento que recibe un cliente dependería de cómo lo escribió
 * — y el día que existan los dos, nadie sabría cuál se aplicó. Por eso el
 * `unique` de la base también va sobre `upper(codigo)`.
 *
 * ─── Lo que NO hace: borrar los espacios de dentro ────────────────────────
 * `VERANO 20` no se convierte en `VERANO20`. Si lo hiciera aquí y no en la
 * captura, el dueño creería haber creado un cupón con espacio y el canje
 * encontraría otro. Los espacios interiores se rechazan al capturar, que es
 * donde se puede explicar.
 *
 * Lo que no es texto da cadena VACÍA, nunca `'UNDEFINED'`: `String(undefined)`
 * es un código perfectamente buscable, y el día que alguien lo cree, una
 * petición sin código canjearía un cupón.
 */
export function normalizarCodigo(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.trim().toUpperCase()
}

/** Formato del código: letras, números y guiones, de 3 a 32. */
const FORMA_CODIGO = /^[A-Z0-9-]{3,32}$/

/**
 * Por qué NO se puede guardar este cupón, o `null` si sí se puede.
 *
 * `otros` son los cupones YA guardados de la misma organización. El choque se
 * mira aquí y NO solo en el `unique` de la base, por lo de siempre en este
 * repositorio: la base es la que de verdad cierra el agujero —una validación
 * es algo que alguien puede olvidar en la siguiente ruta— y esto es para que
 * se lea una frase en vez de un error de restricción.
 */
export function motivoCodigoInvalido(
  cupon: CodigoPromocional,
  otros: CodigoPromocional[],
): string | null {
  const codigo = normalizarCodigo(cupon?.codigo)
  if (!codigo) return 'El codigo promocional es obligatorio.'
  if (!FORMA_CODIGO.test(codigo)) {
    return 'Un codigo promocional solo admite letras, numeros y guiones, entre 3 y 32 caracteres.'
  }

  const pctBruto = cupon?.descuentoPct
  if (typeof pctBruto !== 'number' && typeof pctBruto !== 'string') {
    return 'El descuento tiene que ser un numero.'
  }
  const p = Number(pctBruto)
  if (!Number.isFinite(p)) return 'El descuento tiene que ser un numero.'
  // Un cupón al 0 % es una regla que no hace nada y que hace creer que sí — un
  // cliente teclea el código, ve que se acepta y no ve bajar el precio.
  if (p <= 0) return 'El descuento de un codigo tiene que ser mayor que 0 %.'
  if (p > 100) return 'El descuento de un codigo no puede pasar del 100 %.'

  const desde = fechaIso(cupon?.vigenteDesde)
  const hasta = fechaIso(cupon?.vigenteHasta)
  if (!desde || !hasta) {
    return 'Un codigo promocional necesita su fecha de inicio y su fecha de fin, con forma AAAA-MM-DD.'
  }
  // Comparación de cadenas y no de `Date`: en formato ISO el orden del texto ES
  // el orden del calendario, y así no hay ninguna zona horaria de por medio.
  // `new Date('2026-09-30')` es medianoche UTC, que en México es el día 29.
  if (hasta < desde) return 'La fecha de fin no puede ser anterior a la de inicio.'

  const usos = cupon?.usosMaximos
  if (usos != null) {
    if (typeof usos !== 'number' && typeof usos !== 'string') {
      return 'El tope de usos tiene que ser un numero entero.'
    }
    const u = Number(usos)
    if (!Number.isFinite(u)) return 'El tope de usos tiene que ser un numero entero.'
    if (!Number.isInteger(u)) {
      return 'El tope de usos tiene que ser un numero entero: no se canjea media vez.'
    }
    if (u < 1) return 'Un codigo tiene que poder usarse al menos una vez; si no, no lo crees.'
  }

  for (const otro of otros ?? []) {
    if (otro?.id && cupon?.id && otro.id === cupon.id) continue
    if (normalizarCodigo(otro?.codigo) === codigo) {
      return `Ya existe el codigo "${codigo}" en esta organizacion. Dos cupones con el mismo codigo son dos descuentos para la misma palabra.`
    }
  }
  return null
}

/**
 * Por qué NO se puede canjear este cupón AHORA, o `null` si sí se puede.
 *
 * ⚠️ ESTA ES LA FUNCIÓN QUE HACE QUE UN CUPÓN SEA UN CUPÓN. Todo lo que
 * comprueba —que exista, que esté vigente, que le queden usos— lo decide el
 * SERVIDOR, y por eso `hoy` y `usosActuales` entran como argumento en vez de
 * leerse aquí: los provee `codigos-repo.ts` desde Postgres, con la fila del
 * cupón BLOQUEADA, que es lo que resuelve la carrera del último uso.
 *
 * ─── «No existe» es una sola frase, y es deliberado ───────────────────────
 * Un cupón de OTRA organización no llega hasta aquí: la RLS lo deja fuera y
 * este argumento viene `null`. El mensaje es el mismo que el de un código
 * inventado, porque decir «existe pero no es tuyo» ya cuenta algo de la otra
 * empresa — el fallo R2 aplicado a una promoción.
 *
 * ─── Todo lo ilegible RECHAZA, nunca deja pasar ───────────────────────────
 * Una fecha corrupta comparada con `>=` daría `false` y dejaría el cupón
 * eternamente válido; un conteo `NaN` comparado con el tope daría `false` y lo
 * dejaría infinito. Es el mismo molde que el `NaN > tope` que documenta
 * `lib/descuento.ts`, y aquí cae del lado prudente: cobrar de más se corrige
 * con una nota de crédito; regalar en silencio ya se regaló (ADR 0039 §1).
 */
export function motivoCanjeImposible(
  cupon: CodigoPromocional | null | undefined,
  hoy: string,
  usosActuales: number,
): string | null {
  if (!cupon) {
    return 'Ese codigo promocional no existe en esta organizacion.'
  }
  const codigo = normalizarCodigo(cupon.codigo) || 'sin codigo'

  const p = Number(cupon.descuentoPct)
  if (!Number.isFinite(p) || p <= 0 || p > 100) {
    return `El codigo "${codigo}" tiene un descuento ilegible y no se puede aplicar. Avisa a Administracion.`
  }

  const dia = fechaIso(hoy)
  const desde = fechaIso(cupon.vigenteDesde)
  const hasta = fechaIso(cupon.vigenteHasta)
  if (!dia || !desde || !hasta) {
    return `El codigo "${codigo}" tiene una vigencia ilegible y no se puede aplicar. Avisa a Administracion.`
  }
  // Los DOS extremos son INCLUSIVOS: quien configura «hasta el 30» espera poder
  // canjear el 30. Es el mismo criterio con el que el tope de descuento del
  // 28/09 admite el valor exacto que alguien tecleó.
  if (dia < desde) {
    return `El codigo "${codigo}" todavia no esta vigente: empieza el ${desde}.`
  }
  if (dia > hasta) {
    return `El codigo "${codigo}" vencio el ${hasta}.`
  }

  // Sin tope no se agota nunca, y es el único caso en que el conteo da igual.
  if (cupon.usosMaximos == null) return null

  const tope = Number(cupon.usosMaximos)
  const usados = Number(usosActuales)
  if (!Number.isFinite(tope) || !Number.isFinite(usados)) {
    // «No sé cuántas veces se usó» NO es «no se ha usado nunca». Un `?? 0` aquí
    // convertiría un dato ilegible en un cupón sin límite.
    return `No se pudo comprobar cuantas veces se uso el codigo "${codigo}", asi que no se aplica.`
  }
  if (usados >= tope) {
    return `El codigo "${codigo}" ya se uso las ${tope} veces que se podia.`
  }
  return null
}

/**
 * Lo que descuenta el cupón, en dinero, sobre la base que le llega.
 *
 * Se redondea a entero igual que el resto de la cadena (`precioItem`,
 * `volumenDeLineas`): el importe de un documento tiene que cuadrar con lo que
 * imprime, y decimales sueltos se leen como un defecto del sistema.
 *
 * ─── La guarda no es decorativa ───────────────────────────────────────────
 * Un porcentaje ilegible se lee como CERO y nunca se propaga. `numeric` de
 * Postgres ADMITE `NaN` y lo multiplica alegremente, así que una sola fila
 * corrupta convertiría el neto entero en `NaN` y la petición contestaría
 * 200 OK. Es exactamente el mutante M15 de la Fase 2: los totales quedaban
 * perfectos y solo se envenenaba el importe que se factura.
 */
export function montoDescuentoCodigo(base: unknown, pct: unknown): number {
  const b = Number(base)
  const p = Number(pct)
  if (!Number.isFinite(b) || !Number.isFinite(p) || p <= 0) return 0
  return Math.round(b * (Math.min(p, 100) / 100))
}
