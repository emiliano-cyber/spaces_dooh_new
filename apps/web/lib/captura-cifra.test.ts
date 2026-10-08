import { describe, it, expect } from 'vitest'
import {
  leerCifra,
  ponerComas,
  formatearMientrasEscribe,
  textoDesdeCrudo,
  textoAlSalir,
  crudoDeLectura,
  type OpcionesCifra,
} from './captura-cifra'

// ============================================================================
//  Fase 2 de la coma de miles (08/10): lo que se TECLEA en un campo de dinero o
//  de cantidad. La pantalla enseña 212,500 mientras se escribe, y al servidor le
//  llega el mismo número que antes: 212500.
//
//  Es dinero. El fallo caro no es un error: es leer MAL lo tecleado y guardar
//  otro importe sin que nadie se entere. Por eso la mitad de estas pruebas son
//  NEGATIVAS: lo que el campo se niega a adivinar.
// ============================================================================

const DINERO: OpcionesCifra = { decimales: 2, minimo: 0 }
const ENTERO: OpcionesCifra = { decimales: 0, minimo: 0 }

function valor(texto: string, op: OpcionesCifra = DINERO): number | null {
  const r = leerCifra(texto, op)
  if (!r.ok) throw new Error(`se esperaba lectura válida de «${texto}»: ${r.error}`)
  return r.valor
}

function error(texto: string, op: OpcionesCifra = DINERO): string {
  const r = leerCifra(texto, op)
  if (r.ok) throw new Error(`se esperaba RECHAZO de «${texto}» y se leyó ${r.valor}`)
  return r.error
}

describe('leerCifra · lo que se acepta', () => {
  it('sin comas, con comas bien puestas y con decimales', () => {
    expect(valor('212500')).toBe(212500)
    expect(valor('212,500')).toBe(212500)
    expect(valor('212,500.50')).toBe(212500.5)
    expect(valor('1,234,567')).toBe(1234567)
    expect(valor('1,234,567.05')).toBe(1234567.05)
    expect(valor('999')).toBe(999)
    expect(valor('0')).toBe(0)
    expect(valor('0.5')).toBe(0.5)
  })

  it('espacios alrededor y un $ delante (con o sin espacio)', () => {
    expect(valor('  212,500  ')).toBe(212500)
    expect(valor('$212,500.50')).toBe(212500.5)
    expect(valor('$ 212,500')).toBe(212500)
  })

  it('un punto final a medio escribir («212500.») vale lo mismo que sin él', () => {
    expect(valor('212500.')).toBe(212500)
    expect(valor('212,500.')).toBe(212500)
  })

  it('VACÍO es null, NUNCA cero (la lección de leerCostoOt)', () => {
    // Si el vacío fuera 0, dejar un campo en blanco afirmaría «cuesta cero».
    expect(valor('')).toBeNull()
    expect(valor('   ')).toBeNull()
    expect(valor('$')).toBeNull()
  })

  it('CERO es cero, no vacío', () => {
    expect(valor('0')).toBe(0)
    expect(valor('0.00')).toBe(0)
  })

  it('negativos solo si el campo no pone mínimo', () => {
    expect(valor('-1,500', { decimales: 2 })).toBe(-1500)
    expect(error('-1,500', DINERO)).toMatch(/negativ/i)
  })

  it('en un campo de enteros, 2,500 es dos mil quinientos', () => {
    expect(valor('2,500', ENTERO)).toBe(2500)
    expect(valor('2500', ENTERO)).toBe(2500)
  })
})

describe('leerCifra · NEGATIVO: lo que se rechaza en vez de adivinarse', () => {
  it('NEGATIVO · comas mal puestas', () => {
    // «2,50» es 2.50 en Europa y 250 a ojo de quien la quitara: no se adivina.
    for (const t of ['2,50', '21,2500', '2,,500', ',500', '500,', '1,23,456', '0,500', '2,5000']) {
      expect(error(t), t).toMatch(/coma/i)
    }
  })

  it('NEGATIVO · más de un punto', () => {
    expect(error('1.234.567')).toMatch(/punto/i)
    expect(error('2.5.0')).toMatch(/punto/i)
  })

  it('NEGATIVO · estilo europeo: coma DESPUÉS del punto', () => {
    expect(error('2.500,50')).toMatch(/punto.*decimal|decimal.*punto/i)
    expect(error('1.234,5')).toMatch(/punto.*decimal|decimal.*punto/i)
  })

  it('NEGATIVO · letras, notación científica, Infinity, hexadecimal, espacios dentro', () => {
    for (const t of ['abc', '12a', '1e5', 'Infinity', '-Infinity', '0x10', '1 200', '12$', '--5', '$$5', '+5']) {
      expect(leerCifra(t, DINERO).ok, t).toBe(false)
    }
  })

  it('NEGATIVO · un número absurdamente grande no se convierte en Infinity ni pierde precisión', () => {
    expect(error('9'.repeat(400))).toMatch(/grande/i)
    expect(error('99,999,999,999,999,999')).toMatch(/grande/i)
  })

  it('NEGATIVO · más decimales de los que admite el campo', () => {
    expect(error('1,250.505')).toMatch(/decimal/i)
    expect(error('12.5', ENTERO)).toMatch(/decimal|entero/i)
  })

  it('NEGATIVO · «2.500»: en México el punto es decimal y NO se lee como 2,500', () => {
    // La decisión documentada en el módulo: en un campo de dinero (2 decimales)
    // o de cantidad entera, «2.500» se RECHAZA con el porqué, en vez de
    // guardar 2.5 (lo que dice la regla) cuando quien teclea quería 2,500 (lo
    // que dice su costumbre). Un importe mil veces menor no da ningún error.
    expect(error('2.500')).toMatch(/punto es decimal/i)
    expect(error('2.500', ENTERO)).toMatch(/punto es decimal/i)
    expect(error('212.500')).toMatch(/punto es decimal/i)
  })

  it('«2.500» SÍ es 2.5 en un campo que admite 3 decimales: ahí no hay ambigüedad que proteger', () => {
    expect(valor('2.500', { decimales: 3 })).toBe(2.5)
  })

  it('NEGATIVO · por debajo del mínimo', () => {
    expect(error('5', { decimales: 0, minimo: 10 })).toMatch(/10/)
  })

  it('NEGATIVO · vacío cuando el campo no lo permite', () => {
    expect(leerCifra('', { decimales: 2, permiteVacio: false }).ok).toBe(false)
  })
})

describe('ponerComas · reinserta las comas sin tocar las cifras', () => {
  it('casos', () => {
    expect(ponerComas('')).toBe('')
    expect(ponerComas('5')).toBe('5')
    expect(ponerComas('999')).toBe('999')
    expect(ponerComas('1000')).toBe('1,000')
    expect(ponerComas('212500')).toBe('212,500')
    expect(ponerComas('1234567.5')).toBe('1,234,567.5')
    expect(ponerComas('212500.')).toBe('212,500.')
    expect(ponerComas('.5')).toBe('.5')
    expect(ponerComas('-1500')).toBe('-1,500')
    expect(ponerComas('-')).toBe('-')
  })

  it('quita los ceros a la izquierda (si no, «0,012» sería ilegible y se rechazaría)', () => {
    expect(ponerComas('0012345')).toBe('12,345')
    expect(ponerComas('000')).toBe('0')
    expect(ponerComas('00.5')).toBe('0.5')
  })

  it('NEGATIVO · un texto que no es una cifra limpia se devuelve INTACTO', () => {
    for (const t of ['2,50', 'abc', '1.2.3', '$5', '2.500,50']) expect(ponerComas(t), t).toBe(t)
  })
})

describe('IDA Y VUELTA · leer lo que el campo pinta da el mismo número', () => {
  const tabla = [0, 1, 9, 10, 99, 100, 999, 1000, 1001, 9999, 12000, 99999, 100000, 212500, 999999, 1000000, 1234567, 2500.5, 0.05, 1250.75, 12345678.9, 987654321.01]
  it('textoDesdeCrudo(String(n)) → leerCifra → n', () => {
    for (const n of tabla) {
      const texto = textoDesdeCrudo(String(n))
      expect(valor(texto), `${n} → «${texto}»`).toBe(n)
    }
  })

  it('el texto pintado lleva coma cada tres cifras', () => {
    expect(textoDesdeCrudo('212500')).toBe('212,500')
    expect(textoDesdeCrudo('2500.5')).toBe('2,500.5')
    expect(textoDesdeCrudo('')).toBe('')
  })

  it('crudoDeLectura devuelve lo que el formulario guardaba ANTES (sin comas)', () => {
    expect(crudoDeLectura(leerCifra('212,500.50', DINERO))).toBe('212500.5')
    expect(crudoDeLectura(leerCifra('', DINERO))).toBe('')
    expect(crudoDeLectura(leerCifra('0', DINERO))).toBe('0')
  })

  it('NEGATIVO · una lectura inválida NUNCA da un crudo que Number() acepte', () => {
    // Defensa en profundidad: si un formulario se olvidara de mirar el error y
    // hiciera Number(crudo), «2.500» no puede colarse como 2.5 ni «1e5» como
    // 100000.
    for (const t of ['2.500', '1e5', '0x10', '-5', '2,50', 'Infinity', '12.5']) {
      const c = crudoDeLectura(leerCifra(t, t === '12.5' ? ENTERO : DINERO))
      expect(Number.isNaN(Number(c)), `${t} → «${c}»`).toBe(true)
      expect(c, t).not.toBe('')
    }
  })
})

describe('formatearMientrasEscribe · comas al teclear, sin perder lo tecleado', () => {
  // `cursor` es la posición del caret DESPUÉS del cambio, como la da el
  // navegador en `selectionStart`.
  const escribir = (anterior: string, nuevo: string, cursor: number, tipoEntrada?: string) =>
    formatearMientrasEscribe({ anterior, nuevo, cursor, tipoEntrada })

  it('teclear al final reinserta comas y deja el cursor al final', () => {
    expect(escribir('21,250', '21,2500', 7)).toEqual({ texto: '212,500', cursor: 7 })
    expect(escribir('999', '9999', 4)).toEqual({ texto: '9,999', cursor: 5 })
    expect(escribir('', '5', 1)).toEqual({ texto: '5', cursor: 1 })
  })

  it('un punto final sobrevive para poder seguir con los decimales', () => {
    expect(escribir('212,500', '212,500.', 8)).toEqual({ texto: '212,500.', cursor: 8 })
    expect(escribir('212,500.', '212,500.5', 9)).toEqual({ texto: '212,500.5', cursor: 9 })
  })

  it('teclear en medio mantiene el cursor tras la cifra tecleada', () => {
    // «2|12,500» + 9 → «29|12,500» → «2,9|12,500»
    expect(escribir('212,500', '2912,500', 2)).toEqual({ texto: '2,912,500', cursor: 3 })
  })

  it('borrar una cifra reacomoda las comas', () => {
    // «1,000|» retroceso → «1,00|» → «100|»
    expect(escribir('1,000', '1,00', 4, 'deleteContentBackward')).toEqual({ texto: '100', cursor: 3 })
  })

  it('retroceso SOBRE una coma borra la cifra de su izquierda (si no, la tecla no haría nada)', () => {
    // «212,|500» retroceso borra la coma → se borra el 2 → «21|500» → «21|,500»
    expect(escribir('212,500', '212500', 3, 'deleteContentBackward')).toEqual({ texto: '21,500', cursor: 2 })
  })

  it('suprimir SOBRE una coma borra la cifra de su derecha', () => {
    // «212|,500» suprimir borra la coma → se borra el 5 → «212|00» → «21,2|00»
    expect(escribir('212,500', '212500', 3, 'deleteContentForward')).toEqual({ texto: '21,200', cursor: 4 })
  })

  it('NEGATIVO · lo PEGADO no se reformatea: «2,50» se queda tal cual y leerCifra lo rechaza', () => {
    // Si se reformateara, «2,50» (2.50 en Europa) se convertiría en «250» sin
    // que nadie lo decidiera. Lo pegado se valida, no se adivina.
    expect(escribir('', '2,50', 4, 'insertFromPaste')).toEqual({ texto: '2,50', cursor: 4 })
    expect(escribir('', '2,50', 4)).toEqual({ texto: '2,50', cursor: 4 })
    expect(leerCifra('2,50', DINERO).ok).toBe(false)
  })

  it('NEGATIVO · sobre un texto que ya era inválido no se reformatea al seguir tecleando', () => {
    // «2,50» pegado + un 0 → «2,500». Reformatear lo convertiría en dos mil
    // quinientos a partir de algo que quería decir dos cincuenta.
    expect(escribir('2,50', '2,500', 5)).toEqual({ texto: '2,500', cursor: 5 })
  })

  it('NEGATIVO · una letra tecleada no se come: se queda para que se vea el error', () => {
    expect(escribir('212', '212a', 4)).toEqual({ texto: '212a', cursor: 4 })
  })

  it('un texto sin comas (pegado limpio o precargado viejo) sí se reformatea al teclear', () => {
    expect(escribir('212500', '2125000', 7)).toEqual({ texto: '2,125,000', cursor: 9 })
  })

  it('INVARIANTE · teclear una cifra nunca cambia el número que forman las cifras', () => {
    // Para cada texto canónico y cada posición, insertar un dígito: el número
    // del resultado es exactamente el de las cifras tecleadas, sin comas.
    const bases = ['', '5', '999', '1,000', '212,500', '1,234,567.5', '12.']
    for (const base of bases) {
      for (let pos = 0; pos <= base.length; pos++) {
        for (const d of ['0', '7']) {
          const nuevo = base.slice(0, pos) + d + base.slice(pos)
          const r = escribir(base, nuevo, pos + 1)
          const esperado = Number(nuevo.replace(/,/g, '') || 'NaN')
          const leido = leerCifra(r.texto, { decimales: 5 })
          // Lo que no es una cifra limpia (p. ej. una coma pegada a otra tras
          // insertar) se deja; lo que se reformatea tiene que valer lo mismo.
          if (r.texto !== nuevo) {
            expect(leido.ok, `${base} +${d}@${pos} → ${r.texto}`).toBe(true)
            if (leido.ok) expect(leido.valor, `${base} +${d}@${pos}`).toBe(esperado)
          }
        }
      }
    }
  })
})

describe('textoAlSalir · al dejar el campo se pinta canónico, sin cambiar el valor', () => {
  it('lo válido se normaliza', () => {
    expect(textoAlSalir('212500', DINERO)).toBe('212,500')
    expect(textoAlSalir('$ 212,500.50 ', DINERO)).toBe('212,500.50')
    expect(textoAlSalir('212500.', DINERO)).toBe('212,500')
    expect(textoAlSalir('  ', DINERO)).toBe('')
  })

  it('NEGATIVO · lo inválido se deja como está, para que se vea qué se tecleó', () => {
    expect(textoAlSalir('2,50', DINERO)).toBe('2,50')
    expect(textoAlSalir('2.500', DINERO)).toBe('2.500')
  })
})
