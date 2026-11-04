import { describe, it, expect } from 'vitest'
import {
  leerCifra,
  formatearMientrasEscribe,
  textoDesdeCrudo,
  textoAlSalir,
  crudoDeLectura,
  type OpcionesCifra,
} from './captura-cifra'

// ============================================================================
//  La captura de cifras EN ITALIANO (decision del dueno del 04/11, P-L2-1).
//
//  Un italiano escribe «1.500,50»: punto de millar y coma decimal. Hasta hoy el
//  campo lo leia a la mexicana en todos los idiomas, y «12,9» en el ancho de
//  una pantalla se guardaba como 0 y «1.500,50» se rechazaba (o, en un campo de
//  `Number()` a secas, se guardaba otra cifra). La regla italiana es el ESPEJO
//  exacto de la mexicana: los dos signos cambian de papel y todo lo demas —lo
//  que se rechaza por ambiguo, el vacio, los topes— sigue igual.
//
//  Lo que viaja al formulario (el «crudo») NO cambia de forma: la cifra sin
//  separadores y con punto decimal («1500.5»), igual en los tres idiomas. Solo
//  cambia como se lee lo tecleado y como se pinta.
// ============================================================================

const IT_DINERO: OpcionesCifra = { decimales: 2, minimo: 0, idioma: 'it' }
const IT_ENTERO: OpcionesCifra = { decimales: 0, minimo: 0, idioma: 'it' }

function valor(texto: string, op: OpcionesCifra = IT_DINERO): number | null {
  const r = leerCifra(texto, op)
  if (!r.ok) throw new Error(`se esperaba lectura valida de «${texto}»: ${r.error}`)
  return r.valor
}

function error(texto: string, op: OpcionesCifra = IT_DINERO): string {
  const r = leerCifra(texto, op)
  if (r.ok) throw new Error(`se esperaba RECHAZO de «${texto}» y se leyo ${r.valor}`)
  return r.error
}

describe('leerCifra en italiano · lo que se acepta', () => {
  it('los casos del dueno: «1.500,50», «12,9», «212.500,50»', () => {
    expect(valor('1.500,50')).toBe(1500.5)
    expect(valor('12,9')).toBe(12.9)
    expect(valor('212.500,50')).toBe(212500.5)
  })

  it('«1.500» es mil quinientos y «1,5» es uno coma cinco', () => {
    expect(valor('1.500')).toBe(1500)
    expect(valor('1,5')).toBe(1.5)
    expect(valor('1.234.567')).toBe(1234567)
    expect(valor('1.234.567,89')).toBe(1234567.89)
  })

  it('sin separadores, enteros y decimales sueltos', () => {
    expect(valor('1500')).toBe(1500)
    expect(valor('1500,5')).toBe(1500.5)
    expect(valor('0,05')).toBe(0.05)
    expect(valor(',5')).toBe(0.5)
    expect(valor('12,')).toBe(12)
    expect(valor('0')).toBe(0)
  })

  it('el «$» delante y los espacios alrededor se toleran, como en espanol', () => {
    expect(valor('$1.500,50')).toBe(1500.5)
    expect(valor('  $ 12,9  ')).toBe(12.9)
  })

  it('el vacio es null, nunca cero', () => {
    expect(valor('')).toBeNull()
    expect(valor('   ')).toBeNull()
    expect(leerCifra('', { ...IT_DINERO, permiteVacio: false }).ok).toBe(false)
  })

  it('negativos cuando el campo no tiene minimo', () => {
    expect(valor('-1.500,5', { decimales: 2, idioma: 'it' })).toBe(-1500.5)
    expect(valor('-0', { decimales: 2, idioma: 'it' })).toBe(0)
    expect(Object.is(valor('-0', { decimales: 2, idioma: 'it' }), -0)).toBe(false)
  })

  it('con tres o mas decimales, «1,500» es uno coma cinco (no hay nada que proteger)', () => {
    expect(valor('1,500', { decimales: 3, idioma: 'it' })).toBe(1.5)
    expect(valor('12,3456', { decimales: 4, idioma: 'it' })).toBe(12.3456)
  })
})

describe('leerCifra en italiano · NEGATIVO: se rechaza en vez de adivinar', () => {
  it('«12.9» y «65.50» (punto decimal a la inglesa) se rechazan', () => {
    expect(error('12.9')).toMatch(/punti vanno ogni tre cifre/)
    expect(error('65.50')).toMatch(/punti vanno ogni tre cifre/)
    expect(error('2.50')).toMatch(/virgola: 2,50/)
  })

  it('«1,500» con dos decimales: ¿1,5 o mil quinientos a la inglesa? Se rechaza', () => {
    const e = error('1,500')
    expect(e).toMatch(/virgola separa i decimali/)
    expect(e).toContain('«1,500» sarebbe 1,5')
    expect(e).toContain('Per 1.500 scrivi 1500 o 1.500')
    expect(error('1,500', IT_ENTERO)).toContain('sarebbe 1,5')
  })

  it('el formato mexicano «212,500.50» (mixto) se rechaza con el ejemplo italiano', () => {
    expect(error('212,500.50')).toBe('Qui la virgola separa i decimali e il punto le migliaia: scrivi 2.500,50')
    expect(error('2,500.5')).toMatch(/2\.500,50/)
  })

  it('dos comas: solo hay una decimal', () => {
    expect(error('1,234,567')).toMatch(/una sola virgola/)
    expect(error('1,2,3')).toMatch(/1\.234\.567/)
  })

  it('puntos mal puestos', () => {
    for (const t of ['1.50', '21.2500', '2..500', '0.500', '.500', '1.5000']) {
      expect(error(t), t).toMatch(/punti vanno ogni tre cifre/)
    }
  })

  it('letras, exponentes y espacios dentro', () => {
    for (const t of ['abc', '1e5', '0x10', 'Infinity', '1 500', '1.500 €', '--5', '-']) {
      expect(leerCifra(t, IT_DINERO).ok, t).toBe(false)
    }
    expect(error('1e5')).toContain('Esempio: 212.500,50')
  })

  it('decimales de mas', () => {
    expect(error('1,555')).toMatch(/sarebbe/)
    expect(error('1,5555')).toBe('Massimo 2 decimali')
    expect(error('1,5', IT_ENTERO)).toBe('Solo cifre intere, senza decimali')
  })

  it('topes, con la cifra del tope en italiano', () => {
    expect(error('-5')).toBe('Non può essere negativo')
    expect(error('999', { ...IT_DINERO, minimo: 1500 })).toBe('Non può essere minore di 1.500')
    expect(error('2.000', { ...IT_DINERO, maximo: 1500 })).toBe('Non può essere maggiore di 1.500')
    expect(error('99.999.999.999.999.999')).toBe('Questa cifra è troppo grande')
  })

  it('una lectura invalida NUNCA da un crudo que Number() acepte', () => {
    for (const t of ['12.9', '1,500', '212,500.50', '1e5', '-5']) {
      const c = crudoDeLectura(leerCifra(t, IT_DINERO))
      expect(Number.isNaN(Number(c)), `${t} → «${c}»`).toBe(true)
    }
  })
})

describe('el crudo es el MISMO en los tres idiomas', () => {
  it('«1.500,50» en italiano y «1,500.50» en espanol e ingles dan «1500.5»', () => {
    expect(crudoDeLectura(leerCifra('1.500,50', IT_DINERO))).toBe('1500.5')
    expect(crudoDeLectura(leerCifra('1,500.50', { decimales: 2, minimo: 0, idioma: 'es' }))).toBe('1500.5')
    expect(crudoDeLectura(leerCifra('1,500.50', { decimales: 2, minimo: 0, idioma: 'en' }))).toBe('1500.5')
    expect(crudoDeLectura(leerCifra('12,9', IT_DINERO))).toBe('12.9')
  })
})

describe('textoDesdeCrudo en italiano · se pinta con punto de millar y coma decimal', () => {
  it('lo guardado se ve a la italiana', () => {
    expect(textoDesdeCrudo('212500', 'it')).toBe('212.500')
    expect(textoDesdeCrudo('1500.5', 'it')).toBe('1.500,5')
    expect(textoDesdeCrudo('12.9', 'it')).toBe('12,9')
    expect(textoDesdeCrudo('', 'it')).toBe('')
    expect(textoDesdeCrudo('-1234567.89', 'it')).toBe('-1.234.567,89')
  })

  it('en espanol e ingles, como siempre', () => {
    expect(textoDesdeCrudo('1500.5', 'es')).toBe('1,500.5')
    expect(textoDesdeCrudo('1500.5', 'en')).toBe('1,500.5')
    expect(textoDesdeCrudo('1500.5')).toBe('1,500.5')
  })

  it('IDA Y VUELTA: leer lo que se pinta da el mismo numero', () => {
    for (const n of [0, 1, 999, 1000, 12.9, 1500.5, 212500.5, 0.05, 1234567, 987654321.01]) {
      const texto = textoDesdeCrudo(String(n), 'it')
      expect(valor(texto), `${n} → «${texto}»`).toBe(n)
    }
  })
})

describe('textoAlSalir en italiano', () => {
  it('canoniza conservando las cifras', () => {
    expect(textoAlSalir('1500,50', IT_DINERO)).toBe('1.500,50')
    expect(textoAlSalir('$ 212500', IT_DINERO)).toBe('212.500')
    expect(textoAlSalir('12,', IT_DINERO)).toBe('12')
    expect(textoAlSalir(',5', IT_DINERO)).toBe('0,5')
    expect(textoAlSalir('', IT_DINERO)).toBe('')
  })

  it('lo que no se entiende se deja tal cual', () => {
    expect(textoAlSalir('12.9', IT_DINERO)).toBe('12.9')
    expect(textoAlSalir('1,500', IT_DINERO)).toBe('1,500')
  })
})

describe('formatearMientrasEscribe en italiano · puntos de millar al teclear', () => {
  it('teclear la cuarta cifra pone el punto', () => {
    expect(formatearMientrasEscribe({ anterior: '150', nuevo: '1500', cursor: 4 }, 'it')).toEqual({ texto: '1.500', cursor: 5 })
  })

  it('la coma decimal no se toca', () => {
    expect(formatearMientrasEscribe({ anterior: '1.500', nuevo: '1.500,', cursor: 6 }, 'it')).toEqual({ texto: '1.500,', cursor: 6 })
    expect(formatearMientrasEscribe({ anterior: '1.500,5', nuevo: '1.500,50', cursor: 8 }, 'it')).toEqual({ texto: '1.500,50', cursor: 8 })
  })

  it('borrar el punto de millar borra la cifra vecina', () => {
    // «1.500» con el cursor tras el punto y retroceso: se va el 1.
    expect(formatearMientrasEscribe({ anterior: '1.500', nuevo: '1500', cursor: 1, tipoEntrada: 'deleteContentBackward' }, 'it')).toEqual({ texto: '500', cursor: 0 })
  })

  it('lo pegado se deja tal cual', () => {
    expect(formatearMientrasEscribe({ anterior: '', nuevo: '1500,50', cursor: 7, tipoEntrada: 'insertFromPaste' }, 'it')).toEqual({ texto: '1500,50', cursor: 7 })
  })

  it('una coma tecleada en espanol se queda donde esta (sin idioma = espanol)', () => {
    expect(formatearMientrasEscribe({ anterior: '150', nuevo: '1500', cursor: 4 })).toEqual({ texto: '1,500', cursor: 5 })
  })
})

// ─── B77 (supervision 04/11) · TECLEADO tecla a tecla, como lo hace CampoCifra ─
// Pegar «12.9» se rechazaba, pero teclearlo tecla a tecla lo convertia en 129:
// el punto a la inglesa caia fuera de posicion de millar y se perdia al
// recolocar los separadores. Lo tecleado tiene que acabar igual que lo pegado.
function teclear(texto: string, op: OpcionesCifra = IT_DINERO, desde = '', cursorInicial?: number) {
  let actual = desde
  let cur = cursorInicial ?? desde.length
  const pasos: string[] = []
  for (const ch of texto) {
    const nuevo = actual.slice(0, cur) + ch + actual.slice(cur)
    const r = formatearMientrasEscribe({ anterior: actual, nuevo, cursor: cur + 1, tipoEntrada: 'insertText' }, op.idioma)
    actual = r.texto
    cur = r.cursor
    pasos.push(actual)
  }
  return { texto: actual, pasos, lectura: leerCifra(actual, op), crudo: crudoDeLectura(leerCifra(actual, op)) }
}

describe('B77 · en italiano, lo TECLEADO acaba igual que lo pegado', () => {
  it('NEGATIVO · «2.5», «12.9» y «15000.50» (punto a la inglesa) se rechazan, no se vuelven 25, 129 ni 1.500.050', () => {
    for (const t of ['2.5', '12.9', '15000.50']) {
      const r = teclear(t)
      expect(r.lectura.ok, `${t} → ${JSON.stringify(r.pasos)}`).toBe(false)
      expect(r.crudo, t).toBe('NaN')
      expect(r.texto, t).toBe(t.replace(/^15000/, '15.000'))
    }
  })

  it('el punto tecleado se queda donde se tecleo', () => {
    expect(formatearMientrasEscribe({ anterior: '2', nuevo: '2.', cursor: 2, tipoEntrada: 'insertText' }, 'it')).toEqual({ texto: '2.', cursor: 2 })
  })

  it('«1.500,50», «12,9» y «1500,50» tecleados se leen bien', () => {
    expect(teclear('1.500,50').crudo).toBe('1500.5')
    expect(teclear('12,9').crudo).toBe('12.9')
    const r = teclear('1500,50')
    expect(r.texto).toBe('1.500,50')
    expect(r.crudo).toBe('1500.5')
  })

  it('NEGATIVO · un punto tecleado con el cursor en medio no se traga', () => {
    // «1.500» y el cursor tras el 5: se teclea «.» → «1.5.00», que se rechaza.
    const r = teclear('.', IT_DINERO, '1.500', 3)
    expect(r.texto).toBe('1.5.00')
    expect(r.lectura.ok).toBe(false)
  })

  it('una cifra tecleada en medio sigue recolocando los puntos', () => {
    // «1.500» y el cursor tras el 1: se teclea «2» → 12.500.
    const r = teclear('2', IT_DINERO, '1.500', 1)
    expect(r.texto).toBe('12.500')
    expect(r.crudo).toBe('12500')
  })

  it('en español e inglés, tecleado, lo de siempre (D18 no se toca aquí)', () => {
    for (const idioma of ['es', 'en'] as const) {
      expect(teclear('12.9', { decimales: 2, minimo: 0, idioma }).crudo).toBe('12.9')
      expect(teclear('2,5', { decimales: 2, minimo: 0, idioma }).crudo).toBe('25')
    }
  })
})
