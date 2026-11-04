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
//  Español e inglés NO pasan por el intercambio: su camino es el de antes,
//  carácter por carácter, y lo fija `captura-cifra.es-en.test.ts` contra lo
//  que daba la función de antes. Lo que se entrega al formulario
//  (`crudoDeLectura`) es la MISMA cifra en los tres idiomas: sin separadores y
//  con punto decimal.
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

/** ¿Este idioma teclea coma decimal y punto de millar? Hoy, solo el italiano. */
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
 * `cursor` es `selectionStart` después del cambio; `tipoEntrada` es el
 * `inputType` del evento nativo, si lo hay.
 */
export function formatearMientrasEscribe(
  e: {
    anterior: string
    nuevo: string
    cursor: number
    tipoEntrada?: string
  },
  idioma: Idioma = 'es',
): { texto: string; cursor: number } {
  // Italiano: los puntos de millar se recolocan igual que las comas, sobre los
  // signos intercambiados. El intercambio no cambia ninguna longitud, así que
  // el cursor que sale vale tal cual.
  if (comaDecimal(idioma)) {
    const r = formatearMientrasEscribe({ ...e, anterior: intercambiar(e.anterior), nuevo: intercambiar(e.nuevo) })
    return { texto: intercambiar(r.texto), cursor: r.cursor }
  }
  const { anterior, nuevo, cursor, tipoEntrada } = e
  const intacto = { texto: nuevo, cursor }
  if (tipoEntrada === 'insertFromPaste' || tipoEntrada === 'insertFromDrop') return intacto
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

// ─── Los campos que no eran `CampoCifra` (P-L2-1, 04/11) ─────────────────────
// `EntradaCifra` (`components/demo/ui/EntradaCifra.tsx`) es el `<input>` de
// siempre en español e inglés y un `CampoCifra` en italiano. Estas dos son su
// parte pura.

/**
 * Lo que recibe el formulario cuando en un `EntradaCifra` se teclea `texto`:
 * en español e inglés lo tecleado tal cual (el `<input>` de siempre); en
 * italiano la cifra canónica de `CampoCifra` («12,9» → «12.9»), o 'NaN'.
 */
export function crudoTecleado(texto: string, opciones: OpcionesCifra & { idioma: Idioma }): string {
  return comaDecimal(opciones.idioma) ? crudoDeLectura(leerCifra(texto, opciones)) : texto
}

/**
 * ¿Hay que bloquear el envío? Solo en italiano, y solo con el 'NaN' de
 * `CampoCifra`: en español e inglés el formulario hace lo de siempre con lo
 * tecleado, también si alguien escribe «NaN» a mano.
 */
export function cifraIlegible(crudo: string, idioma: Idioma): boolean {
  return comaDecimal(idioma) && crudo === CRUDO_INVALIDO
}

/**
 * Una cifra de EJEMPLO de un texto de ayuda o un `placeholder`, escrita con
 * los signos de quien lee: «15,000.50» y «12.9» en español e inglés (sin
 * tocar: es la identidad), «15.000,50» y «12,9» en italiano.
 */
export function ejemploCifra(texto: string, idioma: Idioma): string {
  return comaDecimal(idioma) ? intercambiar(texto) : texto
}
