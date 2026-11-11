import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import * as C from './captura-cifra'

// ============================================================================
//  Español e inglés NO cambian con la captura italiana (P-L2-1, 04/11).
//
//  El italiano lee con los signos intercambiados; el español y el inglés
//  tienen que seguir dando, para CUALQUIER entrada, el mismo número y el mismo
//  motivo que antes. Esto lo fija de dos maneras:
//
//   · Una batería determinista de 2000 entradas y 116 000 resultados (cifras con y
//     sin separadores, signos cambiados, basura) por todas las funciones
//     públicas, y su huella sha256. La huella se calculó con la función de
//     ANTES (`integra/idiomas` cb116dde) y se pegó aquí: si un solo carácter
//     de un motivo o un solo valor cambia en es/en, la huella no cuadra.
//   · Una docena de casos a la vista, para que el rojo diga algo.
//
//  D18 (decisión del dueño del 2026-11-05) es el ÚNICO cambio autorizado en
//  español e inglés desde entonces: una coma tecleada se queda donde se
//  tecleó. Cambia exactamente 68 de las 116 000 filas —las de
//  `formatearMientrasEscribe` cuyo evento inserta una coma—, y están
//  apuntadas abajo (`CAMBIOS_D18`) con lo que daban antes y lo que dan ahora.
//  La huella se comprueba con esas filas devueltas a su valor de antes: si
//  cambia una sola fila más, no cuadra.
//
//  Además, al escribir el cambio se corrió un barrido aleatorio de 2,88
//  millones de lecturas contra la función de antes, importada de su copia
//  congelada; no se versiona (la copia sería código muerto), pero el
//  procedimiento está en la nota de convenciones.
// ============================================================================

type Modulo = Pick<
  typeof C,
  'leerCifra' | 'ponerComas' | 'textoDesdeCrudo' | 'textoAlSalir' | 'crudoDeLectura' | 'formatearMientrasEscribe'
>

const ALFABETO = ['0', '1', '2', '5', '9', '0', '3', ',', '.', '-', '$', ' ', 'e', 'x', '1', '2', '7']
const OPCIONES: C.OpcionesCifra[] = [
  { decimales: 2, minimo: 0 },
  { decimales: 0, minimo: 0 },
  { decimales: 2 },
  { decimales: 3 },
  { decimales: 2, minimo: 1500, maximo: 1000000 },
  { decimales: 2, permiteVacio: false },
]

/** Lo que da cada función para cada entrada, en es (por omisión y explícito) y en. */
export function bateria(M: Modulo): unknown[] {
  let semilla = 20261104
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    return semilla / 0x7fffffff
  }
  const basura = () => {
    let s = ''
    for (let i = Math.floor(azar() * 12); i > 0; i--) s += ALFABETO[Math.floor(azar() * ALFABETO.length)]
    return s
  }
  const cifra = () => {
    const ent = String(Math.floor(azar() * 10 ** Math.floor(azar() * 10)))
    let s = (azar() < 0.5 ? M.ponerComas(ent) : ent) + (azar() < 0.5 ? '' : '.' + String(Math.floor(azar() * 10000)).slice(0, 1 + Math.floor(azar() * 4)))
    if (azar() < 0.3) s = s.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'))
    if (azar() < 0.1) s = '-' + s
    if (azar() < 0.1) s = '$' + s
    return s
  }
  const filas: unknown[] = []
  for (let i = 0; i < 2000; i++) {
    const t = i % 2 ? basura() : cifra()
    for (const op of OPCIONES) {
      for (const idioma of [undefined, 'es', 'en'] as const) {
        const o = idioma ? { ...op, idioma } : op
        const r = M.leerCifra(t, o)
        filas.push(r, M.crudoDeLectura(r), M.textoAlSalir(t, o))
      }
    }
    filas.push(M.ponerComas(t), M.textoDesdeCrudo(t))
    const pos = Math.floor(azar() * (t.length + 1))
    const c = ALFABETO[Math.floor(azar() * ALFABETO.length)]
    const tipo = azar() < 0.5 ? 'deleteContentForward' : 'deleteContentBackward'
    for (const ev of [
      { anterior: t, nuevo: t.slice(0, pos) + c + t.slice(pos), cursor: pos + 1 },
      { anterior: t, nuevo: t.slice(0, pos) + t.slice(pos + 1), cursor: pos, tipoEntrada: tipo },
    ]) {
      filas.push(M.formatearMientrasEscribe(ev))
    }
  }
  return filas
}

/** Calculada con `lib/captura-cifra.ts` de cb116dde (antes de la captura italiana). */
const HUELLA_DE_ANTES = 'e5240e24065a685350c809d98a02f6a07ba65f15ffef205896872af2c902fda3'

/**
 * D18 · las filas de la batería que cambian, y por qué. Todas son
 * `formatearMientrasEscribe` con un evento que INSERTA UNA COMA (se verifica
 * abajo): antes la coma pasaba a ser una «coma de millar» mal puesta y se
 * quitaba al recolocar («87» + «,» → «87»; «16» + «,» en medio → «16»;
 * «5963402.3» + «,» → «5,963,402.3»); ahora se queda donde se tecleó y
 * `leerCifra` la acepta o la rechaza como si se hubiera pegado. Medido
 * contra la función de `a91580bb` (antes de D18); las mismas 68 filas
 * sin idioma, en español y en inglés.
 *
 * [fila, texto anterior, antes: texto, antes: cursor, ahora: texto, ahora: cursor]
 */
const CAMBIOS_D18: Array<[number, string, string, number, string, number]> = [
  [4348, '87', '87', 2, '87,', 3],
  [11714, '', '', 0, ',', 1],
  [11772, '962326765', '962,326,765', 10, '96232676,5', 9],
  [13744, '235595464', '235,595,464', 6, '23559,5464', 6],
  [13976, '7.70', '7.70', 1, '7,.70', 2],
  [14556, '778.397', '778.397', 5, '778.3,97', 6],
  [16760, '0', '0', 1, '0,', 2],
  [16992, '96.1514', '96.1514', 5, '96.15,14', 6],
  [19370, '9', '9', 0, ',9', 1],
  [21516, '0', '0', 1, '0,', 2],
  [23140, '73,650', '73,650', 5, '73,65,0', 6],
  [25924, '269906', '269,906', 7, '269906,', 7],
  [28070, '3.1', '3.1', 1, '3,.1', 2],
  [33000, '94,996,976.25', '94,996,976.25', 2, '94,,996,976.25', 3],
  [33696, '22.219', '22.219', 6, '22.219,', 7],
  [34508, '16', '16', 1, '1,6', 2],
  [39612, '141.8', '141.8', 4, '141.,8', 5],
  [39960, '6', '6', 1, '6,', 2],
  [41468, '-531847.693', '-531,847.693', 6, '-5318,47.693', 6],
  [42048, '5963402.3', '5,963,402.3', 3, '59,63402.3', 3],
  [42280, '7,929', '7,929', 1, '7,,929', 2],
  [42744, '13', '13', 2, '13,', 3],
  [44020, '1.529', '1.529', 4, '1.52,9', 5],
  [45644, '2.1947', '2.1947', 1, '2,.1947', 2],
  [47036, '137,839,078', '137,839,078', 7, '137,839,,078', 8],
  [48950, '1', '1', 0, ',1', 1],
  [49472, '4447298', '4,447,298', 8, '444729,8', 7],
  [51502, '7', '7', 1, '7,', 2],
  [52604, '39', '39', 1, '3,9', 2],
  [55040, '18981963', '18,981,963', 6, '18981,963', 6],
  [55504, '546,933,889.861', '546,933,889.861', 6, '546,93,3,889.861', 7],
  [56896, '71282267.4', '71,282,267.4', 10, '71282267,.4', 9],
  [58172, '5', '5', 1, '5,', 2],
  [59622, '', '', 0, ',', 1],
  [60376, '694,775,820.823', '694,775,820.823', 3, '694,,775,820.823', 4],
  [62464, '-0', '-0', 1, '-,0', 2],
  [63044, '41234689', '41,234,689', 10, '41234689,', 9],
  [66176, '-909070', '-909,070', 6, '-9090,70', 6],
  [71454, '', '', 0, ',', 1],
  [71512, '962326765', '962,326,765', 10, '96232676,5', 9],
  [73484, '235595464', '235,595,464', 6, '23559,5464', 6],
  [73716, '7.70', '7.70', 1, '7,.70', 2],
  [74296, '778.397', '778.397', 5, '778.3,97', 6],
  [76500, '0', '0', 1, '0,', 2],
  [76732, '96.1514', '96.1514', 5, '96.15,14', 6],
  [79110, '9', '9', 0, ',9', 1],
  [81256, '0', '0', 1, '0,', 2],
  [82880, '73,650', '73,650', 5, '73,65,0', 6],
  [85664, '269906', '269,906', 7, '269906,', 7],
  [87810, '3.1', '3.1', 1, '3,.1', 2],
  [92740, '94,996,976.25', '94,996,976.25', 2, '94,,996,976.25', 3],
  [93436, '22.219', '22.219', 6, '22.219,', 7],
  [94248, '16', '16', 1, '1,6', 2],
  [99352, '141.8', '141.8', 4, '141.,8', 5],
  [99700, '6', '6', 1, '6,', 2],
  [101208, '-531847.693', '-531,847.693', 6, '-5318,47.693', 6],
  [101788, '5963402.3', '5,963,402.3', 3, '59,63402.3', 3],
  [102020, '7,929', '7,929', 1, '7,,929', 2],
  [102484, '13', '13', 2, '13,', 3],
  [103760, '1.529', '1.529', 4, '1.52,9', 5],
  [105384, '2.1947', '2.1947', 1, '2,.1947', 2],
  [106776, '137,839,078', '137,839,078', 7, '137,839,,078', 8],
  [108690, '1', '1', 0, ',1', 1],
  [109212, '4447298', '4,447,298', 8, '444729,8', 7],
  [111242, '7', '7', 1, '7,', 2],
  [112344, '39', '39', 1, '3,9', 2],
  [114780, '18981963', '18,981,963', 6, '18981,963', 6],
  [115244, '546,933,889.861', '546,933,889.861', 6, '546,93,3,889.861', 7],
]

/** La batería con las filas de D18 devueltas a lo que daban antes. */
function sinD18(filas: unknown[]): unknown[] {
  const copia = [...filas]
  for (const [fila, , texto, cursor] of CAMBIOS_D18) copia[fila] = { texto, cursor }
  return copia
}

/** El módulo de hoy forzado a un idioma: lo que ven los campos en es y en en. */
function enIdioma(idioma: 'es' | 'en'): Modulo {
  return {
    leerCifra: (t, o) => C.leerCifra(t, { ...o, idioma: o.idioma ?? idioma }),
    ponerComas: C.ponerComas,
    textoDesdeCrudo: (t) => C.textoDesdeCrudo(t, idioma),
    textoAlSalir: (t, o) => C.textoAlSalir(t, { ...o, idioma: o.idioma ?? idioma }),
    crudoDeLectura: C.crudoDeLectura,
    formatearMientrasEscribe: (e) => C.formatearMientrasEscribe(e, idioma),
  }
}

const huella = (filas: unknown[]) => createHash('sha256').update(JSON.stringify(filas)).digest('hex')

describe('captura de cifras · español e inglés, idénticos a antes', () => {
  it('la batería entera da la huella de antes (sin idioma, y con es), salvo las filas de D18', () => {
    expect(huella(sinD18(bateria(C)))).toBe(HUELLA_DE_ANTES)
    expect(huella(sinD18(bateria(enIdioma('es'))))).toBe(HUELLA_DE_ANTES)
  })

  it('D18 · las 68 filas que cambian son una coma tecleada que ahora se queda donde se tecleó', () => {
    expect(CAMBIOS_D18).toHaveLength(68)
    for (const M of [C, enIdioma('es'), enIdioma('en')]) {
      const filas = bateria(M)
      for (const [fila, anterior, , , texto, cursor] of CAMBIOS_D18) {
        expect(filas[fila], `fila ${fila}`).toEqual({ texto, cursor })
        // Lo de ahora es lo anterior con UNA coma insertada justo antes del cursor.
        expect(texto[cursor - 1]).toBe(',')
        expect(texto.slice(0, cursor - 1) + texto.slice(cursor)).toBe(anterior)
      }
    }
  })

  it('el ingles da los mismos numeros que el español (los motivos van en su idioma)', () => {
    const numeros = (M: Modulo) =>
      bateria(M).map((f) => (f && typeof f === 'object' && 'ok' in f ? ((f as C.LecturaCifra).ok ? f : 'rechazo') : f))
    expect(numeros(enIdioma('en'))).toEqual(numeros(C))
  })

  it('los casos de siempre, a la vista', () => {
    const op = { decimales: 2, minimo: 0 }
    for (const idioma of ['es', 'en'] as const) {
      const v = (t: string) => C.leerCifra(t, { ...op, idioma })
      expect(v('212,500.50')).toEqual({ ok: true, valor: 212500.5 })
      expect(v('1,500')).toEqual({ ok: true, valor: 1500 })
      expect(v('12.9')).toEqual({ ok: true, valor: 12.9 })
      expect(v('1.5')).toEqual({ ok: true, valor: 1.5 })
      expect(v('12,9').ok).toBe(false)
      expect(v('1.500,50').ok).toBe(false)
      expect(v('2.500').ok).toBe(false)
      expect(C.textoDesdeCrudo('1500.5', idioma)).toBe('1,500.5')
      expect(C.textoAlSalir('1500.5', { ...op, idioma })).toBe('1,500.5')
    }
    expect(C.leerCifra('12,9', op)).toEqual({
      ok: false,
      error: 'Las comas van cada tres cifras, como en 212,500. Si querías decimales, usa punto: 2.50',
    })
    expect(C.leerCifra('1.500,50', { ...op, idioma: 'en' })).toEqual({
      ok: false,
      error: 'Here the period is the decimal point and the comma separates thousands: enter 2,500.50',
    })
  })
})

// ─── P2 (decisión del dueño del 2026-11-05) · el portugués, a la brasileña ──
// El portugués pasa a teclear con coma decimal, el MISMO sistema que el
// italiano. La batería de arriba lo fija así:
//  · la huella del ITALIANO, motivos incluidos, calculada con la función de
//    `a97c171d` (antes de P2): el italiano no puede cambiar ni un carácter;
//  · el portugués da, entrada por entrada, los mismos números, los mismos
//    textos pintados y los mismos rechazos que el italiano (solo el motivo
//    va en su idioma).
// Las huellas de es/en, arriba, tampoco cambian.
const HUELLA_IT_DE_ANTES = '58b30641d009dc0f0b0ff57bacf38d7ba17fcc46df16bdbe6e532949401b6d53'

/** El módulo con el idioma IMPUESTO en cada llamada (la batería pasa es/en a veces). */
function soloEn(idioma: 'es' | 'it' | 'pt'): Modulo {
  return {
    leerCifra: (t, o) => C.leerCifra(t, { ...o, idioma }),
    ponerComas: C.ponerComas,
    textoDesdeCrudo: (t) => C.textoDesdeCrudo(t, idioma),
    textoAlSalir: (t, o) => C.textoAlSalir(t, { ...o, idioma }),
    crudoDeLectura: C.crudoDeLectura,
    formatearMientrasEscribe: (e) => C.formatearMientrasEscribe(e, idioma),
  }
}

describe('P2 · el italiano idéntico y el portugués, su gemelo', () => {
  const numeros = (M: Modulo) =>
    bateria(M).map((f) => (f && typeof f === 'object' && 'ok' in f ? ((f as C.LecturaCifra).ok ? f : 'rechazo') : f))

  it('la batería en italiano da la huella de antes de P2 (motivos incluidos)', () => {
    expect(huella(bateria(soloEn('it')))).toBe(HUELLA_IT_DE_ANTES)
  })

  it('el portugués da exactamente los números del italiano, y no los del español', () => {
    const pt = numeros(soloEn('pt'))
    expect(pt).toEqual(numeros(soloEn('it')))
    expect(pt).not.toEqual(numeros(soloEn('es')))
  })
})
