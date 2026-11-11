// ============================================================================
//  lib/captura-cifra.ts — Lo que se TECLEA en un campo de dinero o de cantidad:
//  cómo se lee y cómo se pinta con su coma de miles mientras se escribe.
// ----------------------------------------------------------------------------
//  Fase 2 del estándar del dueño (08/10): toda cifra lleva coma cada tres
//  dígitos, al estilo es-MX, también la que se está tecleando. La fase 1 la puso
//  en todo lo que se MUESTRA (`formatMonto`, `formatNumero`).
//
//  Vive FUERA del componente (`components/demo/ui/CampoCifra.tsx`) a propósito:
//  `vitest.config.ts` no monta jsdom, y una decisión escrita dentro de un `.tsx`
//  no la prueba nadie. Aquí se decide dinero, y el fallo caro NO da error: es
//  leer mal lo tecleado y guardar otro importe.
//
//  REGLAS DE LECTURA (es-MX, sin excepciones):
//   · La COMA solo separa miles, y solo bien puesta: cada tres cifras, contando
//     desde el punto. «2,50», «21,2500» o «2,,500» se RECHAZAN: no se adivina si
//     quien escribió «2,50» quería 2.50 (costumbre europea) o 250.
//   · El PUNTO solo es decimal, y hay uno como mucho. «1.234.567» y «2.500,50»
//     (estilo europeo) se rechazan con el porqué.
//   · «2.500» es 2.5 por la regla, pero quien lo teclea casi siempre quería
//     2,500 por costumbre. Un importe mil veces menor no da ningún error, así
//     que en los campos que admiten menos de 3 decimales —todos los de dinero
//     (2) y los de cantidad (0)— se RECHAZA con un mensaje que lo explica. Solo
//     en un campo que admite 3 o más decimales no hay nada que proteger y se lee
//     como 2.5.
//   · Vacío es `null`, NUNCA cero (la misma lección que `leerCostoOt`): un campo
//     en blanco no puede afirmar que algo costó cero.
//   · Se tolera un `$` delante y espacios alrededor; nada más: ni letras, ni
//     `1e5`, ni `0x10`, ni `Infinity`, ni espacios dentro.
//
//  EN ITALIANO (decisión del dueño del 2026-11-04, P-L2-1) la regla es el
//  ESPEJO exacto: el PUNTO separa miles y la COMA es decimal («212.500,50»).
//  Hasta ese día el italiano se leía a la mexicana, y «12,9» tecleado en el
//  ancho de una pantalla se guardaba como 0. No hay una segunda regla escrita:
//  se intercambian los dos signos de lo tecleado (`intercambiar`), se lee con
//  la de arriba, y los ejemplos del motivo vuelven a intercambiarse para salir
//  en italiano. Así lo ambiguo se rechaza en los dos sentidos por la misma
//  razón: «1,500» en un campo de dinero es 1,5 por la regla, pero quien lo
//  teclea casi siempre quería mil quinientos a la inglesa.
//
//  EN PORTUGUÉS (pt-BR, decisión del dueño del 2026-11-05, P2) se teclea
//  igual que en italiano: es el MISMO sistema de separadores y lo HEREDA
//  entero, porque aquí nada pregunta «¿es italiano?» sino `comaDecimal()`
//  (`FORMATO_IDIOMA[idioma].separadorDecimal`). Lo que el italiano acepta,
//  rechaza, pinta y manda, el portugués también; solo el motivo va en su
//  idioma. Lo fijan `captura-cifra.portugues.test.ts` y el barrido de
//  `captura-cifra.d18.test.ts` (cada tecla, la del italiano).
//
//  Español e inglés NO pasan por el intercambio: su camino es el de antes,
//  carácter por carácter, y lo fija `captura-cifra.es-en.test.ts` contra lo
//  que daba la función de antes — con UNA excepción autorizada, D18 (decisión
//  del dueño del 2026-11-05): una coma TECLEADA ya no se quita al recolocar,
//  se queda y la lee `leerCifra` como si se hubiera pegado (`teclearCifra`).
//
//  MIENTRAS SE ESCRIBE (`teclearCifra`, D18): el campo recoloca SUS comas de
//  millar; las que pone la persona no las toca nunca. «2,5» tecleado se queda
//  «2,5» y se rechaza; «1,500» vale mil quinientos. A media escritura («1,»,
//  «1,5», camino de «1,500») no se avisa (`cifraAMedias`). En italiano y en
//  portugués, lo mismo con el punto de millar (B87, 05/11), pero avisando en
//  el acto.
//
//  Lo que se entrega al formulario (`crudoDeLectura`) es la MISMA cifra en los
//  cuatro idiomas: sin separadores y con punto decimal.
// ============================================================================

import { traducir, type ClaveTexto } from './i18n/diccionario'
import type { Idioma } from './i18n/idiomas'
import { FORMATO_IDIOMA } from './i18n/formato-idioma'

export type LecturaCifra = { ok: true; valor: number | null } | { ok: false; error: string }

export interface OpcionesCifra {
  /** Decimales máximos: 2 para dinero, 0 para cantidades enteras. */
  decimales: number
  /** Mínimo admitido (p. ej. 0 = sin negativos). Sin él, se admiten negativos. */
  minimo?: number
  /** Máximo admitido, si el campo tiene tope. */
  maximo?: number
  /** Por defecto `true`: el vacío se lee como `null`. */
  permiteVacio?: boolean
  /**
   * I18N (lote catalogos, 2026-11-02) · el idioma del MOTIVO de rechazo. Por
   * omision 'es', y en espanol devuelve los literales de siempre: los
   * llamadores que no lo pasan (otros lotes, `costo-ot-captura`) no cambian.
   * Las cifras de ejemplo van por hueco: ningun diccionario lleva miles.
   */
  idioma?: Idioma
}

const MSJ_FORMA = 'Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: 212,500.50'
const MSJ_COMAS = 'Las comas van cada tres cifras, como en 212,500. Si querías decimales, usa punto: 2.50'
const MSJ_EUROPEO = 'Aquí el punto es decimal y la coma separa miles: escribe 2,500.50'
const MSJ_PUNTOS = 'Solo puede haber un punto, y es el decimal. Para miles usa coma: 1,234,567'

/** ¿Este idioma teclea coma decimal y punto de millar? Hoy, el italiano y el portugués. */
export function comaDecimal(idioma: Idioma): boolean {
  return FORMATO_IDIOMA[idioma].separadorDecimal === ','
}

/** Cambia cada punto por coma y cada coma por punto; lo demás, intacto. */
export function intercambiar(texto: string): string {
  return texto.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'))
}

/** Del texto tecleado a la cifra. Ver las reglas en la cabecera. */
export function leerCifra(texto: string, opciones: OpcionesCifra): LecturaCifra {
  const { decimales, minimo, maximo, permiteVacio = true, idioma = 'es' } = opciones
  const m = (literal: string, clave: ClaveTexto, valores?: Record<string, string | number>) =>
    idioma === 'es' ? literal : traducir(idioma, clave, valores)
  // Las cifras que salen en un motivo, con los signos del idioma. En español e
  // inglés es la identidad: sus motivos no cambian ni un carácter.
  const coma = comaDecimal(idioma)
  const fx = (cifra: string) => (coma ? intercambiar(cifra) : cifra)
  const forma = () => m(MSJ_FORMA, 'compartidos.cifra.forma', { ejemplo: fx('212,500.50') })
  let t = texto.trim()
  if (t.startsWith('$')) t = t.slice(1).trim()
  // Italiano: se lee con la regla mexicana sobre los signos intercambiados.
  if (coma) t = intercambiar(t)

  if (t === '') {
    return permiteVacio ? { ok: true, valor: null } : { ok: false, error: m('Escribe una cifra', 'compartidos.cifra.vacia') }
  }

  let negativo = false
  if (t.startsWith('-')) {
    negativo = true
    t = t.slice(1)
  }
  if (t === '') return { ok: false, error: forma() }

  // Solo cifras, comas y puntos. Esto deja fuera 'Infinity', '1e5', '0x10',
  // '1 200', un segundo signo o un segundo '$' — todo lo que `Number()`
  // aceptaría (o casi) y que en un campo de importe no significa nada.
  if (/[^\d,.]/.test(t)) return { ok: false, error: forma() }

  const punto = t.indexOf('.')
  if (punto !== -1 && t.lastIndexOf(',') > punto) return { ok: false, error: m(MSJ_EUROPEO, 'compartidos.cifra.europeo', { ejemplo: fx('2,500.50') }) }
  if (punto !== -1 && t.indexOf('.', punto + 1) !== -1) return { ok: false, error: m(MSJ_PUNTOS, 'compartidos.cifra.puntos', { ejemplo: fx('1,234,567') }) }

  const ent = punto === -1 ? t : t.slice(0, punto)
  const frac = punto === -1 ? '' : t.slice(punto + 1)

  // La primera cifra de un grupo con comas no puede ser 0: «0,500» es 0.5 en
  // Europa, y aceptarlo como 500 sería adivinar.
  if (ent.includes(',') && !/^[1-9]\d{0,2}(,\d{3})+$/.test(ent)) {
    return { ok: false, error: m(MSJ_COMAS, 'compartidos.cifra.comas', { ejemplo: fx('212,500'), decimal: fx('2.50') }) }
  }
  const digitos = ent.replace(/,/g, '')
  if (digitos === '' && frac === '') return { ok: false, error: forma() }

  if (frac.length > decimales) {
    if (frac.length === 3 && decimales < 3 && !ent.includes(',') && /^\d{1,3}$/.test(digitos)) {
      const miles = `${digitos}${frac}`.replace(/^0+(?=\d)/, '')
      return {
        ok: false,
        error: m(
          `En México el punto es decimal: «${t}» sería ${digitos}.${frac.replace(/0+$/, '') || '0'}. Para ${ponerComas(miles)} escribe ${miles} o ${ponerComas(miles)}`,
          'compartidos.cifra.punto-decimal',
          {
            texto: fx(t),
            decimal: fx(`${digitos}.${frac.replace(/0+$/, '') || '0'}`),
            miles: fx(ponerComas(miles)),
            sinComas: miles,
          },
        ),
      }
    }
    return {
      ok: false,
      error:
        decimales === 0
          ? m('Solo cifras enteras, sin decimales', 'compartidos.cifra.enteras')
          : m(
              `Máximo ${decimales} ${decimales === 1 ? 'decimal' : 'decimales'}`,
              decimales === 1 ? 'compartidos.cifra.max-decimales.uno' : 'compartidos.cifra.max-decimales.otros',
              { n: decimales },
            ),
    }
  }

  let v = Number(`${digitos || '0'}.${frac || '0'}`)
  // Más allá de MAX_SAFE_INTEGER, `Number` redondea en silencio (y con 400
  // cifras da Infinity): el importe guardado no sería el tecleado.
  if (!Number.isFinite(v) || v > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: m('Esa cifra es demasiado grande', 'compartidos.cifra.grande') }
  }
  if (negativo) v = -v
  if (v === 0) v = 0 // sin -0

  if (minimo != null && v < minimo) {
    return {
      ok: false,
      error:
        minimo === 0
          ? m('No puede ser negativo', 'compartidos.cifra.negativo')
          : m(`No puede ser menor que ${ponerComas(String(minimo))}`, 'compartidos.cifra.menor', { n: fx(ponerComas(String(minimo))) }),
    }
  }
  if (maximo != null && v > maximo) {
    return { ok: false, error: m(`No puede ser mayor que ${ponerComas(String(maximo))}`, 'compartidos.cifra.mayor', { n: fx(ponerComas(String(maximo))) }) }
  }
  return { ok: true, valor: v }
}

/**
 * Reinserta la coma de miles en un texto que ya es una cifra limpia (cifras,
 * a lo sumo un punto, un signo delante). Quita los ceros a la izquierda: si no,
 * «0012345» daría «0,012,345», que `leerCifra` rechaza. Cualquier otra cosa se
 * devuelve INTACTA: reformatear un texto que no se entiende es adivinar.
 */
export function ponerComas(texto: string): string {
  if (!/^-?\d*(\.\d*)?$/.test(texto)) return texto
  const signo = texto.startsWith('-') ? '-' : ''
  const cuerpo = signo ? texto.slice(1) : texto
  const punto = cuerpo.indexOf('.')
  let ent = punto === -1 ? cuerpo : cuerpo.slice(0, punto)
  const resto = punto === -1 ? '' : cuerpo.slice(punto)
  ent = ent.replace(/^0+(?=\d)/, '')
  return signo + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + resto
}

/**
 * Lo que el formulario guardaba ANTES de este campo: la cifra sin comas
 * («212500.5»), o '' si está vacío.
 *
 * Si la lectura es inválida devuelve 'NaN', a propósito: no vacío (un campo
 * obligatorio no debe decir «falta» cuando lo que hay es un error) y que
 * `Number()` NUNCA acepte. Es defensa en profundidad: cada formulario además
 * bloquea el envío con el error, pero si uno lo olvidara, «2.500» no se colaría
 * como 2.5 ni «1e5» como 100000.
 */
export const CRUDO_INVALIDO = 'NaN'
export function crudoDeLectura(lectura: LecturaCifra): string {
  if (!lectura.ok) return CRUDO_INVALIDO
  return lectura.valor == null ? '' : String(lectura.valor)
}

/**
 * Lo que se pinta a partir del valor que guarda el formulario («212500» →
 * «212,500»; en italiano «1500.5» → «1.500,5»). El crudo SIEMPRE lleva punto
 * decimal y ningún separador, sea cual sea el idioma.
 */
export function textoDesdeCrudo(crudo: string, idioma: Idioma = 'es'): string {
  const texto = ponerComas(crudo.trim())
  return comaDecimal(idioma) ? intercambiar(texto) : texto
}

/**
 * B82 (supervisión, 04/11; cerrada el 05/11) · el crudo que llega de OTRO idioma.
 *
 * En español e inglés `EntradaCifra` guarda lo tecleado TAL CUAL («1,500»,
 * «12.9»), no la cifra canónica. Si la persona cambia a italiano con el
 * diálogo abierto, el campo italiano recibe ese texto como si fuera canónico, y
 * `textoDesdeCrudo('1,500', 'it')` pintaba «1.500» —mil quinientos a la
 * italiana— mientras el formulario seguía mandando `Number('1,500') || 0` = 0.
 *
 * Aquí se RELEE el crudo sin cambiar lo que se manda: si es canónico, el camino
 * de siempre; si `Number()` lo entiende («2.500» es 2.5, « 7 » es 7), se pinta
 * ESA cifra con los signos nuevos, que es la que el formulario mandará; y si no
 * lo entiende, se deja como se tecleó con `ajeno: true`, para que el campo avise
 * (`motivoCifraAjena`) en vez de enseñar una cifra que no se va a mandar.
 *
 * Solo en italiano y portugués: en español e inglés el crudo de `CampoCifra` siempre es
 * suyo (lo emite él), y esto es la identidad con `textoDesdeCrudo`.
 */
export function pintarCrudo(crudo: string, idioma: Idioma): { texto: string; ajeno: boolean } {
  const t = crudo.trim()
  if (!comaDecimal(idioma) || t === '' || t === CRUDO_INVALIDO || CIFRA_SIN_COMAS.test(t)) {
    return { texto: textoDesdeCrudo(crudo, idioma), ajeno: false }
  }
  const n = Number(t)
  if (Number.isFinite(n)) return { texto: textoDesdeCrudo(String(n), idioma), ajeno: false }
  return { texto: crudo, ajeno: true }
}

/** El aviso de un crudo ajeno (B82): el motivo de forma del idioma, con su ejemplo. */
export function motivoCifraAjena(idioma: Idioma): string {
  if (idioma === 'es') return MSJ_FORMA
  const ejemplo = comaDecimal(idioma) ? intercambiar('212,500.50') : '212,500.50'
  return traducir(idioma, 'compartidos.cifra.forma', { ejemplo })
}

/**
 * Al salir del campo: si lo tecleado es válido se pinta canónico (sin `$`, sin
 * espacios, sin punto colgando, con sus comas) conservando las cifras
 * tecleadas; si no, se deja tal cual, para que se vea qué se escribió junto al
 * error. Nunca cambia el valor: solo cómo se ve.
 */
export function textoAlSalir(texto: string, opciones: OpcionesCifra): string {
  const r = leerCifra(texto, opciones)
  if (!r.ok) return texto
  if (r.valor === null) return ''
  // Italiano: se canoniza en los signos mexicanos y se devuelve intercambiado.
  const coma = comaDecimal(opciones.idioma ?? 'es')
  let limpio = (coma ? intercambiar(texto) : texto).trim().replace(/^\$/, '').trim().replace(/,/g, '')
  if (limpio.endsWith('.')) limpio = limpio.slice(0, -1)
  limpio = limpio.replace(/^(-?)\./, '$10.')
  return coma ? intercambiar(ponerComas(limpio)) : ponerComas(limpio)
}

const CIFRA_CON_COMAS = /^-?[\d,]*(\.\d*)?$/
const CIFRA_SIN_COMAS = /^-?\d*(\.\d*)?$/

/** ¿El texto lo produjo este mismo campo (o no tiene comas que malinterpretar)? */
function esCanonico(texto: string): boolean {
  if (texto === '') return true
  if (CIFRA_SIN_COMAS.test(texto)) return true
  return CIFRA_CON_COMAS.test(texto) && ponerComas(texto.replace(/,/g, '')) === texto
}

/**
 * Comas al teclear, sin perder lo tecleado ni el cursor.
 *
 * Solo reformatea cuando el cambio es UNA tecla (insertar o borrar un carácter)
 * sobre un texto que ya era canónico. Entonces no hay nada que interpretar: las
 * cifras son las que había más la tecleada, y las comas se recolocan. Lo PEGADO
 * (o un cambio de varios caracteres) se deja tal cual y lo valida `leerCifra`:
 * reformatear «2,50» pegado daría «250», que nadie decidió.
 *
 * D18 (decisión del dueño del 2026-11-05, opción b): tampoco reformatea cuando
 * la tecla es una COMA ni mientras el texto lleve comas que puso la persona
 * (`comasPropias`, que lleva `CampoCifra` vía `teclearCifra`). Ver allí.
 *
 * `cursor` es `selectionStart` después del cambio; `tipoEntrada` es el
 * `inputType` del evento nativo, si lo hay.
 */
export function formatearMientrasEscribe(
  e: {
    anterior: string
    nuevo: string
    cursor: number
    tipoEntrada?: string
    /** D18 · el texto anterior lleva comas que puso la persona: no se recoloca nada. */
    comasPropias?: boolean
  },
  idioma: Idioma = 'es',
): { texto: string; cursor: number } {
  // Italiano: los puntos de millar se recolocan igual que las comas, sobre los
  // signos intercambiados. El intercambio no cambia ninguna longitud, así que
  // el cursor que sale vale tal cual.
  if (comaDecimal(idioma)) {
    // B77 (supervisión, 04/11): un PUNTO tecleado no se recoloca. En el camino
    // de abajo pasaría a ser una «coma de millar» mal puesta, y al recolocar
    // las comas se QUITARÍA: «12.9» tecleado acababa en 129 y «2.5» en 25, sin
    // ningún aviso, mientras pegado se rechazaba. Se deja donde se tecleó y
    // `leerCifra` lo acepta si está bien puesto («1.500») o lo rechaza con su
    // motivo. La tecla siguiente tampoco recoloca: el texto ya no es canónico.
    const insertoUnPunto =
      e.nuevo.length === e.anterior.length + 1 &&
      e.cursor >= 1 &&
      e.nuevo[e.cursor - 1] === '.' &&
      e.nuevo.slice(0, e.cursor - 1) + e.nuevo.slice(e.cursor) === e.anterior
    if (insertoUnPunto) return { texto: e.nuevo, cursor: e.cursor }
    const r = formatearMientrasEscribe({ ...e, anterior: intercambiar(e.anterior), nuevo: intercambiar(e.nuevo) })
    return { texto: intercambiar(r.texto), cursor: r.cursor }
  }
  const { anterior, nuevo, cursor, tipoEntrada } = e
  const intacto = { texto: nuevo, cursor }
  if (esPegado(tipoEntrada)) return intacto
  // D18 · una COMA tecleada no se recoloca, y mientras quede alguna de la
  // persona no se recoloca nada. Hasta el 05/11 la coma tecleada pasaba a ser
  // una «coma de millar» mal puesta y al recolocar se QUITABA: «2,5» acababa en
  // 25, «15000,50» en 1,500,050 y «1,5000» en 15,000, sin ningún aviso,
  // mientras pegado se rechazaba. Es la misma trampa que B77 en italiano.
  if (e.comasPropias || insertoUnaComa(anterior, nuevo, cursor)) return intacto
  if (!esCanonico(anterior)) return intacto

  let texto = nuevo
  let c = cursor
  const inserto =
    nuevo.length === anterior.length + 1 && cursor >= 1 && nuevo.slice(0, cursor - 1) + nuevo.slice(cursor) === anterior
  const borro = nuevo.length === anterior.length - 1 && nuevo === anterior.slice(0, cursor) + anterior.slice(cursor + 1)
  if (!inserto && !borro) return intacto

  // Borrar una COMA no cambia ninguna cifra, así que al recolocarlas volvería a
  // aparecer y la tecla no haría nada. Se borra la cifra vecina: la de la
  // izquierda con retroceso, la de la derecha con suprimir.
  if (borro && anterior[cursor] === ',') {
    if (tipoEntrada === 'deleteContentForward') {
      texto = anterior.slice(0, cursor + 1) + anterior.slice(cursor + 2)
      c = cursor + 1
    } else {
      texto = anterior.slice(0, cursor - 1) + anterior.slice(cursor)
      c = Math.max(0, cursor - 1)
    }
  }

  const sin = texto.replace(/,/g, '')
  if (!CIFRA_SIN_COMAS.test(sin)) return intacto
  const formateado = ponerComas(sin)

  // El cursor se recoloca contando las cifras que tiene a su DERECHA, que no
  // cambian (los ceros a la izquierda que se quitan están a la izquierda).
  const derecha = texto.slice(c).replace(/,/g, '').length
  let pos = formateado.length
  let cuenta = 0
  while (pos > 0 && cuenta < derecha) {
    pos--
    if (formateado[pos] !== ',') cuenta++
  }
  while (pos > 0 && formateado[pos - 1] === ',') pos--
  return { texto: formateado, cursor: pos }
}

const esPegado = (tipoEntrada?: string) => tipoEntrada === 'insertFromPaste' || tipoEntrada === 'insertFromDrop'

/** ¿El cambio es UNA coma insertada en `cursor - 1` y nada más? */
function insertoUnaComa(anterior: string, nuevo: string, cursor: number): boolean {
  return (
    nuevo.length === anterior.length + 1 &&
    cursor >= 1 &&
    nuevo[cursor - 1] === ',' &&
    nuevo.slice(0, cursor - 1) + nuevo.slice(cursor) === anterior
  )
}

/** Lo que `CampoCifra` guarda al teclear: el texto y si lleva comas de la persona. */
export interface TecleoCifra {
  texto: string
  /**
   * El texto lleva alguna coma que puso la PERSONA (tecleada o pegada), no el
   * campo. Mientras sea así, el campo no recoloca ninguna.
   */
  comasPropias: boolean
}

/**
 * D18 (decisión del dueño del 2026-11-05, opción b) · UNA TECLA EN UN CAMPO DE
 * CIFRAS, con el estado que guarda `CampoCifra`. Al teclear se trata lo mal
 * puesto igual que al pegar.
 *
 * LA REGLA, en español e inglés:
 *  1. Las comas que pone el CAMPO (al teclear la cuarta cifra: «1500» →
 *     «1,500») se recolocan como siempre al teclear o borrar una cifra.
 *  2. Una coma que pone la PERSONA —tecleada, o en un texto pegado— se queda
 *     donde la puso, y mientras quede alguna en el texto el campo no recoloca
 *     NINGUNA (`comasPropias`). Si no, «1,500» tecleado coma incluida y luego
 *     un 0 acabaría en «15,000» en vez de en el «1,5000» que se tecleó.
 *  3. `comasPropias` se apaga cuando el texto se queda sin comas, al salir
 *     del campo con una cifra válida (se pinta canónica) o cuando el
 *     formulario repinta el campo con lo que guarda.
 *  4. Decide `leerCifra`, la misma que al pegar: «1,500» y «12,500.50» valen;
 *     «2,5», «12,34», «1,5000» y «15,000,50» se rechazan con «las comas van
 *     cada tres cifras», y el formulario recibe 'NaN' y no envía.
 *  5. A media escritura no se avisa: ver `cifraAMedias`.
 *
 * EN ITALIANO Y PORTUGUÉS, la misma regla con los signos intercambiados (B87, 05/11): el
 * PUNTO de millar que pone la persona no se recoloca, y `comasPropias` dice
 * «lleva puntos propios». `cifraAMedias` sigue siendo `false`: su aviso sale
 * en el acto, como desde B77.
 */
export function teclearCifra(
  antes: TecleoCifra,
  e: { nuevo: string; cursor: number; tipoEntrada?: string },
  idioma: Idioma = 'es',
): TecleoCifra & { cursor: number } {
  // B87 (supervisión de D18, 05/11): el italiano es el ESPEJO, con los
  // signos intercambiados, como en `leerCifra`. Hasta ese día devolvía
  // `comasPropias: false` siempre, y un punto tecleado que dejaba el texto
  // canónico («1.500») se reagrupaba con la tecla siguiente: «1.5000»
  // tecleado daba 15.000, pegado se rechazaba. El intercambio no cambia
  // ninguna longitud, así que el cursor vale tal cual.
  if (comaDecimal(idioma)) {
    const r = teclearCifra(
      { texto: intercambiar(antes.texto), comasPropias: antes.comasPropias },
      { ...e, nuevo: intercambiar(e.nuevo) },
      'es',
    )
    return { ...r, texto: intercambiar(r.texto) }
  }
  const r = formatearMientrasEscribe({ anterior: antes.texto, ...e, comasPropias: antes.comasPropias }, idioma)
  // La persona PUSO una coma si el cambio trae más comas de las que había y
  // el campo no lo reformateó (una coma tecleada, o un texto escrito sobre una
  // selección que las trae), o si llega PEGADA o SOLTADA: lo pegado es suyo
  // entero aunque traiga las mismas comas que lo que reemplaza (B85: pegar
  // «1,500» encima de «2,000» y teclear 0 daba 15,000).
  const comas = (t: string) => t.split(',').length - 1
  const pone = esPegado(e.tipoEntrada) || (comas(e.nuevo) > comas(antes.texto) && r.texto === e.nuevo)
  return { texto: r.texto, cursor: r.cursor, comasPropias: (antes.comasPropias || pone) && r.texto.includes(',') }
}

/**
 * D18 · ¿El texto va A MEDIAS hacia una cifra bien puesta? «1,» y «1,5» son el
 * camino de teclear «1,500», así que mientras se teclea no se avisa (ni borde
 * rojo ni motivo). El formulario SÍ recibe 'NaN' —no se puede mandar— y el
 * aviso sale al salir del campo o al pulsar Enter (`CampoCifra`).
 *
 * Es a medias exactamente lo que acaba en un grupo de millar INCOMPLETO y nada
 * más: `[1-9]` y hasta dos cifras, grupos de tres, y una coma final con 0, 1 o
 * 2 cifras detrás («2,5» también: puede ir hacia «2,500»). Con `$`, signo o
 * espacios alrededor, como `leerCifra`. Lo que ya no puede acabar bien
 * («1,5000», «0,5», «1,,5», «1,5.0») avisa en el acto, como siempre.
 *
 * Solo español e inglés: en italiano y portugués es `false` y su aviso sale como antes.
 */
export function cifraAMedias(texto: string, idioma: Idioma = 'es'): boolean {
  if (comaDecimal(idioma)) return false
  let t = texto.trim()
  if (t.startsWith('$')) t = t.slice(1).trim()
  if (t.startsWith('-')) t = t.slice(1)
  return /^[1-9]\d{0,2}(,\d{3})*,\d{0,2}$/.test(t)
}

// ─── Los campos que no eran `CampoCifra` (P-L2-1, 04/11) ─────────────────────
// `EntradaCifra` (`components/demo/ui/EntradaCifra.tsx`) es el `<input>` de
// siempre en español e inglés y un `CampoCifra` en italiano y portugués. Estas dos son su
// parte pura. (`crudoTecleado`, un modelo del campo que nadie llamaba, se quitó
// el 04/11 —B80—: lo tecleado de verdad lo prueba `cifras-formularios.test.ts`.)

/**
 * ¿Hay que bloquear el envío? Solo en italiano y portugués, y solo con el 'NaN' de
 * `CampoCifra`: en español e inglés el formulario hace lo de siempre con lo
 * tecleado, también si alguien escribe «NaN» a mano.
 */
export function cifraIlegible(crudo: string, idioma: Idioma): boolean {
  return comaDecimal(idioma) && crudo === CRUDO_INVALIDO
}

/**
 * Una cifra de EJEMPLO de un texto de ayuda o un `placeholder`, escrita con
 * los signos de quien lee: «15,000.50» y «12.9» en español e inglés (sin
 * tocar: es la identidad), «15.000,50» y «12,9» en italiano y portugués.
 */
export function ejemploCifra(texto: string, idioma: Idioma): string {
  return comaDecimal(idioma) ? intercambiar(texto) : texto
}
