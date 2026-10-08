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
// ============================================================================

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
}

const MSJ_FORMA = 'Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: 212,500.50'
const MSJ_COMAS = 'Las comas van cada tres cifras, como en 212,500. Si querías decimales, usa punto: 2.50'
const MSJ_EUROPEO = 'Aquí el punto es decimal y la coma separa miles: escribe 2,500.50'
const MSJ_PUNTOS = 'Solo puede haber un punto, y es el decimal. Para miles usa coma: 1,234,567'

/** Del texto tecleado a la cifra. Ver las reglas en la cabecera. */
export function leerCifra(texto: string, opciones: OpcionesCifra): LecturaCifra {
  const { decimales, minimo, maximo, permiteVacio = true } = opciones
  let t = texto.trim()
  if (t.startsWith('$')) t = t.slice(1).trim()

  if (t === '') {
    return permiteVacio ? { ok: true, valor: null } : { ok: false, error: 'Escribe una cifra' }
  }

  let negativo = false
  if (t.startsWith('-')) {
    negativo = true
    t = t.slice(1)
  }
  if (t === '') return { ok: false, error: MSJ_FORMA }

  // Solo cifras, comas y puntos. Esto deja fuera 'Infinity', '1e5', '0x10',
  // '1 200', un segundo signo o un segundo '$' — todo lo que `Number()`
  // aceptaría (o casi) y que en un campo de importe no significa nada.
  if (/[^\d,.]/.test(t)) return { ok: false, error: MSJ_FORMA }

  const punto = t.indexOf('.')
  if (punto !== -1 && t.lastIndexOf(',') > punto) return { ok: false, error: MSJ_EUROPEO }
  if (punto !== -1 && t.indexOf('.', punto + 1) !== -1) return { ok: false, error: MSJ_PUNTOS }

  const ent = punto === -1 ? t : t.slice(0, punto)
  const frac = punto === -1 ? '' : t.slice(punto + 1)

  // La primera cifra de un grupo con comas no puede ser 0: «0,500» es 0.5 en
  // Europa, y aceptarlo como 500 sería adivinar.
  if (ent.includes(',') && !/^[1-9]\d{0,2}(,\d{3})+$/.test(ent)) {
    return { ok: false, error: MSJ_COMAS }
  }
  const digitos = ent.replace(/,/g, '')
  if (digitos === '' && frac === '') return { ok: false, error: MSJ_FORMA }

  if (frac.length > decimales) {
    if (frac.length === 3 && decimales < 3 && !ent.includes(',') && /^\d{1,3}$/.test(digitos)) {
      const miles = `${digitos}${frac}`.replace(/^0+(?=\d)/, '')
      return {
        ok: false,
        error: `En México el punto es decimal: «${t}» sería ${digitos}.${frac.replace(/0+$/, '') || '0'}. Para ${ponerComas(miles)} escribe ${miles} o ${ponerComas(miles)}`,
      }
    }
    return {
      ok: false,
      error: decimales === 0 ? 'Solo cifras enteras, sin decimales' : `Máximo ${decimales} ${decimales === 1 ? 'decimal' : 'decimales'}`,
    }
  }

  let v = Number(`${digitos || '0'}.${frac || '0'}`)
  // Más allá de MAX_SAFE_INTEGER, `Number` redondea en silencio (y con 400
  // cifras da Infinity): el importe guardado no sería el tecleado.
  if (!Number.isFinite(v) || v > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: 'Esa cifra es demasiado grande' }
  }
  if (negativo) v = -v
  if (v === 0) v = 0 // sin -0

  if (minimo != null && v < minimo) {
    return { ok: false, error: minimo === 0 ? 'No puede ser negativo' : `No puede ser menor que ${ponerComas(String(minimo))}` }
  }
  if (maximo != null && v > maximo) {
    return { ok: false, error: `No puede ser mayor que ${ponerComas(String(maximo))}` }
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

/** Lo que se pinta a partir del valor que guarda el formulario («212500» → «212,500»). */
export function textoDesdeCrudo(crudo: string): string {
  return ponerComas(crudo.trim())
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
  let limpio = texto.trim().replace(/^\$/, '').trim().replace(/,/g, '')
  if (limpio.endsWith('.')) limpio = limpio.slice(0, -1)
  limpio = limpio.replace(/^(-?)\./, '$10.')
  return ponerComas(limpio)
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
export function formatearMientrasEscribe(e: {
  anterior: string
  nuevo: string
  cursor: number
  tipoEntrada?: string
}): { texto: string; cursor: number } {
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
