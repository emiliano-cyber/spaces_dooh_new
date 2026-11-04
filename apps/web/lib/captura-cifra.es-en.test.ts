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
  it('la batería entera da la huella de antes (sin idioma, y con es)', () => {
    expect(huella(bateria(C))).toBe(HUELLA_DE_ANTES)
    expect(huella(bateria(enIdioma('es')))).toBe(HUELLA_DE_ANTES)
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
