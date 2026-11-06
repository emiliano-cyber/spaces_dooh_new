import { describe, it, expect } from 'vitest'
import {
  leerCifra,
  crudoDeLectura,
  textoDesdeCrudo,
  textoAlSalir,
  teclearCifra,
  cifraAMedias,
  cifraIlegible,
  ejemploCifra,
  pintarCrudo,
  motivoCifraAjena,
  comaDecimal,
  type OpcionesCifra,
  type TecleoCifra,
} from './captura-cifra'
import { traducir } from './i18n/diccionario'
import type { Idioma } from './i18n/idiomas'

// ============================================================================
//  P2 (decisión del dueño del 2026-11-05) · EN PORTUGUÉS (pt-BR) LAS CIFRAS SE
//  TECLEAN A LA BRASILEÑA: punto de millar y coma decimal («1.500,50»).
// ----------------------------------------------------------------------------
//  Es el MISMO sistema de separadores que el italiano (P-L2-1, 04/11), y el
//  portugués lo hereda entero: lo que el italiano acepta, rechaza, pinta y
//  manda, el portugués lo acepta, rechaza, pinta y manda igual. Solo cambian
//  las palabras del motivo. Hasta este día el portugués se tecleaba a la
//  mexicana (`separadorDecimal: '.'`), y «12,9» en el ancho de una pantalla
//  se rechazaba (o, en un `<input>` de `Number()`, se guardaba como 0).
//
//  Lo que llega al servidor es la MISMA cifra que en es/en/it: «1500.5».
// ============================================================================

const PT: OpcionesCifra = { decimales: 2, minimo: 0, idioma: 'pt' }
const PT_ENTERO: OpcionesCifra = { decimales: 0, minimo: 0, idioma: 'pt' }

function valor(texto: string, op: OpcionesCifra = PT): number | null {
  const r = leerCifra(texto, op)
  if (!r.ok) throw new Error(`se esperaba lectura valida de «${texto}»: ${r.error}`)
  return r.valor
}
function error(texto: string, op: OpcionesCifra = PT): string {
  const r = leerCifra(texto, op)
  if (r.ok) throw new Error(`se esperaba RECHAZO de «${texto}» y se leyo ${r.valor}`)
  return r.error
}

describe('P2 · el portugués teclea coma decimal', () => {
  it('comaDecimal("pt") es true, como el italiano; es y en siguen con punto', () => {
    expect(comaDecimal('pt')).toBe(true)
    expect(comaDecimal('it')).toBe(true)
    expect(comaDecimal('es')).toBe(false)
    expect(comaDecimal('en')).toBe(false)
  })
})

describe('P2 · leerCifra en portugués · lo que se acepta', () => {
  it('«1.500,50», «12,9», «212.500,50», «55,5» y «12,9» m', () => {
    expect(valor('1.500,50')).toBe(1500.5)
    expect(valor('12,9')).toBe(12.9)
    expect(valor('212.500,50')).toBe(212500.5)
    expect(valor('55,5')).toBe(55.5)
    expect(valor('1.234.567,89')).toBe(1234567.89)
  })

  it('«1.500» es mil quinientos', () => {
    expect(valor('1.500')).toBe(1500)
    expect(valor('1.500', PT_ENTERO)).toBe(1500)
  })

  it('NEGATIVO · «1,500» es uno y medio, NUNCA mil quinientos', () => {
    // Con 3 o más decimales no hay nada que proteger: 1,5.
    expect(valor('1,500', { decimales: 3, idioma: 'pt' })).toBe(1.5)
    // En dinero (2 decimales) es ambiguo y se rechaza diciendo que sería 1,5.
    const e = error('1,500')
    expect(e).toBe('Em português, a vírgula é decimal: “1,500” seria 1,5. Para 1.500, digite 1500 ou 1.500')
    expect(crudoDeLectura(leerCifra('1,500', PT))).toBe('NaN')
    expect(Number(crudoDeLectura(leerCifra('1,500', PT)))).not.toBe(1500)
  })

  it('NEGATIVO · «1,500.50» pegado (formato mexicano) se rechaza con su aviso, no se convierte', () => {
    expect(error('1,500.50')).toBe('Aqui a vírgula é decimal e o ponto separa os milhares: digite 2.500,50')
    expect(error('212,500.50')).toBe('Aqui a vírgula é decimal e o ponto separa os milhares: digite 2.500,50')
    expect(crudoDeLectura(leerCifra('1,500.50', PT))).toBe('NaN')
  })

  it('NEGATIVO · lo ambiguo o mal puesto se rechaza y avisa en portugués', () => {
    expect(error('12.9')).toBe('Os pontos vão a cada três algarismos, como em 212.500. Se queria decimais, use vírgula: 2,50')
    expect(error('2.5')).toMatch(/^Os pontos vão a cada três algarismos/)
    expect(error('1,234,567')).toBe('Só pode haver uma vírgula, a dos decimais. Para os milhares, use ponto: 1.234.567')
    expect(error('abc')).toBe('Digite só algarismos: o ponto separa os milhares e a vírgula, os decimais. Exemplo: 212.500,50')
    expect(error('12,9', PT_ENTERO)).toBe('Só números inteiros, sem decimais')
    expect(error('2.000', { ...PT, maximo: 1500 })).toBe('Não pode ser maior que 1.500')
    expect(error('999', { ...PT, minimo: 1500 })).toBe('Não pode ser menor que 1.500')
  })
})

describe('P2 · el crudo es el MISMO número en los cuatro idiomas', () => {
  it('la misma cantidad tecleada a la manera de cada idioma llega igual', () => {
    const casos: Array<[Record<Idioma, string>, string]> = [
      [{ es: '1,500.50', en: '1,500.50', it: '1.500,50', pt: '1.500,50' }, '1500.5'],
      [{ es: '12.9', en: '12.9', it: '12,9', pt: '12,9' }, '12.9'],
      [{ es: '212,500', en: '212,500', it: '212.500', pt: '212.500' }, '212500'],
      [{ es: '0.05', en: '0.05', it: '0,05', pt: '0,05' }, '0.05'],
    ]
    for (const [porIdioma, crudo] of casos) {
      for (const idioma of ['es', 'en', 'it', 'pt'] as const) {
        expect(crudoDeLectura(leerCifra(porIdioma[idioma], { decimales: 2, minimo: 0, idioma })), `${idioma} ${porIdioma[idioma]}`).toBe(crudo)
      }
    }
  })
})

describe('P2 · lo que se pinta en portugués', () => {
  it('textoDesdeCrudo y textoAlSalir, con punto de millar y coma decimal', () => {
    expect(textoDesdeCrudo('1500.5', 'pt')).toBe('1.500,5')
    expect(textoDesdeCrudo('212500', 'pt')).toBe('212.500')
    expect(textoDesdeCrudo('12.9', 'pt')).toBe('12,9')
    expect(textoAlSalir('1500,50', PT)).toBe('1.500,50')
    expect(textoAlSalir('1,500', PT)).toBe('1,500') // lo ilegible se deja
  })

  it('IDA Y VUELTA: leer lo que se pinta da el mismo número', () => {
    for (const n of [0, 1, 999, 1000, 12.9, 1500.5, 212500.5, 0.05, 1234567, 987654321.01]) {
      expect(valor(textoDesdeCrudo(String(n), 'pt')), String(n)).toBe(n)
    }
  })

  it('los ejemplos de captura salen a la brasileña: «12,9», «7,2», «15.000,50»', () => {
    expect(ejemploCifra('12.9', 'pt')).toBe('12,9')
    expect(ejemploCifra('7.2', 'pt')).toBe('7,2')
    expect(ejemploCifra('15,000.50', 'pt')).toBe('15.000,50')
    expect(traducir('pt', 'comercial.comun.ej', { valor: ejemploCifra('12.9', 'pt') })).toBe('Ex.: 12,9')
  })

  it('B82 en portugués · un crudo de es/en que no es cifra no se pinta como otra cifra', () => {
    expect(pintarCrudo('1,500', 'pt')).toEqual({ texto: '1,500', ajeno: true })
    expect(pintarCrudo('12.9', 'pt')).toEqual({ texto: '12,9', ajeno: false })
    expect(motivoCifraAjena('pt')).toBe('Digite só algarismos: o ponto separa os milhares e a vírgula, os decimais. Exemplo: 212.500,50')
  })

  it('el «NaN» de un campo portugués bloquea el envío (cifraIlegible)', () => {
    expect(cifraIlegible('NaN', 'pt')).toBe(true)
    expect(cifraIlegible('12.9', 'pt')).toBe(false)
  })
})

describe('P2 · los avisos dicen la verdad nueva', () => {
  it('ningún aviso de captura en portugués dice ya «a vírgula separa os milhares»', () => {
    const claves = [
      'compartidos.cifra.forma', 'compartidos.cifra.comas', 'compartidos.cifra.europeo', 'compartidos.cifra.puntos',
      'compartidos.cifra.punto-decimal', 'campanas.candado.monto-ilegible', 'comercial.tarifas.no-se-entiende',
      'catalogos.tarifas.invalida', 'inventario.tabla.cifra-ilegible', 'inventario.renta.ilegible',
      'inventario.tarifa.ilegible', 'inventario.wizard.renta-ilegible', 'inventario.carga.precio-m2-ilegible',
    ] as const
    for (const k of claves) {
      const s = traducir('pt', k, { ejemplo: 'X', decimal: 'X', texto: 'X', miles: 'X', sinComas: 'X' })
      expect(s, k).not.toMatch(/vírgula separa os milhares|ponto é decimal|ponto, os decimais|decimais, use ponto|um ponto, o dos decimais/)
    }
    expect(traducir('pt', 'campanas.candado.monto-ilegible', { ejemplo: ejemploCifra('212,500.50', 'pt') })).toBe(
      'O valor não foi entendido: o ponto separa os milhares e a vírgula, os decimais (212.500,50).',
    )
    expect(traducir('pt', 'inventario.carga.precio-m2-ilegible')).toContain('(65,50)')
  })
})

// ─── D18 en portugués: hereda el comportamiento del italiano (B87) ─────────
function teclear(texto: string, idioma: Idioma, desde: TecleoCifra = { texto: '', comasPropias: false }) {
  let estado = desde
  let cursor = desde.texto.length
  const pasos: string[] = []
  const avisos: boolean[] = []
  for (const ch of texto) {
    const nuevo = estado.texto.slice(0, cursor) + ch + estado.texto.slice(cursor)
    const r = teclearCifra(estado, { nuevo, cursor: cursor + 1, tipoEntrada: 'insertText' }, idioma)
    estado = { texto: r.texto, comasPropias: r.comasPropias }
    cursor = r.cursor
    pasos.push(r.texto)
    avisos.push(!leerCifra(r.texto, { decimales: 2, minimo: 0, idioma }).ok && !cifraAMedias(r.texto, idioma))
  }
  return { estado, pasos, avisos, crudo: crudoDeLectura(leerCifra(estado.texto, { decimales: 2, minimo: 0, idioma })) }
}

describe('P2 · D18 en portugués es el del italiano, tecla a tecla', () => {
  it('«1.5000» y «1.2345» tecleados se quedan y se rechazan (B87), como en italiano', () => {
    for (const t of ['1.5000', '1.2345']) {
      const r = teclear(t, 'pt')
      expect(r.estado.texto, t).toBe(t)
      expect(r.crudo, t).toBe('NaN')
      expect(r).toEqual(teclear(t, 'it'))
    }
  })

  it('«1500» se pinta «1.500»; «15000,50» → «15.000,50» = 15000.5; «12,9» = 12.9', () => {
    expect(teclear('1500', 'pt').pasos).toEqual(['1', '15', '150', '1.500'])
    expect(teclear('15000,50', 'pt').estado.texto).toBe('15.000,50')
    expect(teclear('15000,50', 'pt').crudo).toBe('15000.5')
    expect(teclear('12,9', 'pt').crudo).toBe('12.9')
  })

  it('cifraAMedias es false en portugués, como en italiano: «1.» avisa en el acto', () => {
    expect(cifraAMedias('1.', 'pt')).toBe(false)
    expect(cifraAMedias('1.5', 'pt')).toBe(false)
    expect(teclear('1.500', 'pt').avisos).toEqual([false, true, true, true, false])
    expect(teclear('1.500', 'pt').avisos).toEqual(teclear('1.500', 'it').avisos)
  })
})
