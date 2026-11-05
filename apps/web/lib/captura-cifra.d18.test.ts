import { describe, it, expect } from 'vitest'
import {
  leerCifra,
  crudoDeLectura,
  textoDesdeCrudo,
  formatearMientrasEscribe,
  teclearCifra,
  cifraAMedias,
  type OpcionesCifra,
  type TecleoCifra,
} from './captura-cifra'
import type { Idioma } from './i18n/idiomas'

// ============================================================================
//  D18 (decisión del dueño del 2026-11-05, opción b) · AL TECLEAR SE AVISA
//  IGUAL QUE AL PEGAR, en español y en inglés, en todos los campos de cifras.
// ----------------------------------------------------------------------------
//  Hasta ese día una coma TECLEADA nunca se quedaba: al recolocar las comas de
//  millar se quitaba, y las cifras se juntaban. «2,5» tecleado acababa en 25,
//  «15000,50» en 1,500,050 y «1,5000» en 15,000, sin ningún aviso; PEGADO, el
//  mismo texto se rechazaba con su motivo.
//
//  La regla nueva (`teclearCifra`):
//   · una coma que pone la PERSONA —tecleada o pegada— se queda donde la puso;
//     mientras quede alguna en el texto, el campo no recoloca nada;
//   · las comas que pone el CAMPO (al teclear la cuarta cifra) se siguen
//     recolocando como siempre;
//   · `leerCifra` decide: «1,500» vale mil quinientos, «2,5» se rechaza con
//     el mismo motivo que al pegar.
//  Y a media escritura no se avisa (`cifraAMedias`): «1,» y «1,5» son el
//  camino hacia «1,500». El aviso sale al salir del campo o al pulsar Enter.
//
//  Se teclea como lo hace `CampoCifra`: un `insertText` por carácter sobre el
//  texto que pintó la tecla anterior, con el estado que guarda el campo.
// ============================================================================

const DINERO: OpcionesCifra = { decimales: 2, minimo: 0 }
const ENTERO: OpcionesCifra = { decimales: 0, minimo: 0 }

/**
 * Teclea `texto` carácter a carácter. `desde` es el texto de partida (con
 * `comasPropias` false: lo pintó el campo), y `cursorInicial` dónde está el
 * cursor (por omisión, al final).
 */
function teclear(
  texto: string,
  idioma: Idioma,
  op: OpcionesCifra = DINERO,
  desde: TecleoCifra = { texto: '', comasPropias: false },
  cursorInicial?: number,
) {
  let estado = desde
  let cursor = cursorInicial ?? desde.texto.length
  const pasos: string[] = []
  for (const ch of texto) {
    const nuevo = estado.texto.slice(0, cursor) + ch + estado.texto.slice(cursor)
    const r = teclearCifra(estado, { nuevo, cursor: cursor + 1, tipoEntrada: 'insertText' }, idioma)
    estado = { texto: r.texto, comasPropias: r.comasPropias }
    cursor = r.cursor
    pasos.push(r.texto)
  }
  const lectura = leerCifra(estado.texto, { ...op, idioma })
  return { estado, cursor, pasos, texto: estado.texto, crudo: crudoDeLectura(lectura), lectura }
}

/** Borra con retroceso (o suprimir) en `cursor`. */
function borrar(estado: TecleoCifra, cursor: number, idioma: Idioma, adelante = false) {
  const i = adelante ? cursor : cursor - 1
  const nuevo = estado.texto.slice(0, i) + estado.texto.slice(i + 1)
  return teclearCifra(
    estado,
    { nuevo, cursor: i, tipoEntrada: adelante ? 'deleteContentForward' : 'deleteContentBackward' },
    idioma,
  )
}

/** Lo que daría el mismo texto PEGADO de una vez. */
const pegado = (t: string, idioma: Idioma, op: OpcionesCifra = DINERO) => leerCifra(t, { ...op, idioma })

for (const idioma of ['es', 'en'] as const) {
  describe(`D18 · ${idioma.toUpperCase()} · lo mal puesto se queda a la vista y se rechaza como al pegar`, () => {
    it('«2,5» se queda «2,5» y se rechaza (antes 25)', () => {
      const r = teclear('2,5', idioma)
      expect(r.pasos).toEqual(['2', '2,', '2,5'])
      expect(r.crudo).toBe('NaN')
      expect(r.lectura).toEqual(pegado('2,5', idioma))
    })

    it('«12,34» se queda «12,34» y se rechaza (antes 1,234)', () => {
      const r = teclear('12,34', idioma)
      expect(r.texto).toBe('12,34')
      expect(r.crudo).toBe('NaN')
      expect(r.lectura).toEqual(pegado('12,34', idioma))
    })

    it('«1,5000» se queda «1,5000» y se rechaza (antes 15,000)', () => {
      const r = teclear('1,5000', idioma)
      expect(r.pasos).toEqual(['1', '1,', '1,5', '1,50', '1,500', '1,5000'])
      expect(r.crudo).toBe('NaN')
      expect(r.lectura).toEqual(pegado('1,5000', idioma))
    })

    it('«15000,50» (coma decimal a la europea) se rechaza (antes 1,500,050)', () => {
      const r = teclear('15000,50', idioma)
      expect(r.texto).toBe('15,000,50')
      expect(r.crudo).toBe('NaN')
    })

    it('en una cantidad entera (0 decimales) también: «2,5» se rechaza', () => {
      const r = teclear('2,5', idioma, ENTERO)
      expect(r.texto).toBe('2,5')
      expect(r.crudo).toBe('NaN')
      expect(r.lectura).toEqual(pegado('2,5', idioma, ENTERO))
    })
  })

  describe(`D18 · ${idioma.toUpperCase()} · lo bien puesto sigue igual`, () => {
    it('«1,500» tecleado con su coma vale 1500', () => {
      const r = teclear('1,500', idioma)
      expect(r.pasos).toEqual(['1', '1,', '1,5', '1,50', '1,500'])
      expect(r.crudo).toBe('1500')
    })

    it('«12,500.50» vale 12500.5', () => {
      const r = teclear('12,500.50', idioma)
      expect(r.texto).toBe('12,500.50')
      expect(r.crudo).toBe('12500.5')
    })

    it('«2.5» vale 2.5, como siempre', () => {
      const r = teclear('2.5', idioma)
      expect(r.pasos).toEqual(['2', '2.', '2.5'])
      expect(r.crudo).toBe('2.5')
    })

    it('«1500» se pinta «1,500» al teclear la cuarta cifra, como siempre', () => {
      const r = teclear('1500', idioma)
      expect(r.pasos).toEqual(['1', '15', '150', '1,500'])
      expect(r.crudo).toBe('1500')
      expect(r.estado.comasPropias).toBe(false)
    })

    it('«1234567.89» se pinta «1,234,567.89»', () => {
      expect(teclear('1234567.89', idioma).texto).toBe('1,234,567.89')
    })

    it('las comas que puso el campo se siguen recolocando: «1,500» + 0 → «15,000»', () => {
      const r = teclear('0', idioma, DINERO, { texto: '1,500', comasPropias: false })
      expect(r.texto).toBe('15,000')
      expect(r.crudo).toBe('15000')
    })
  })

  describe(`D18 · ${idioma.toUpperCase()} · con el cursor en medio`, () => {
    const delCampo = (texto: string): TecleoCifra => ({ texto, comasPropias: false })

    it('una coma tecleada en medio de una cifra del campo se queda: «1,2,500» se rechaza (antes 12,500)', () => {
      const r = teclear(',', idioma, DINERO, delCampo(textoDesdeCrudo('12500', idioma)), 1)
      expect(r.texto).toBe('1,2,500')
      expect(r.cursor).toBe(2)
      expect(r.crudo).toBe('NaN')
    })

    it('una coma tecleada junto a otra del campo se queda: «1,,500» se rechaza', () => {
      const r = teclear(',', idioma, DINERO, delCampo('1,500'), 2)
      expect(r.texto).toBe('1,,500')
      expect(r.crudo).toBe('NaN')
    })

    it('una cifra tecleada en medio de una cifra del campo se reagrupa: «1,500» + 7 tras el 1 → «17,500»', () => {
      const r = teclear('7', idioma, DINERO, delCampo('1,500'), 1)
      expect(r.texto).toBe('17,500')
      expect(r.cursor).toBe(2)
      expect(r.crudo).toBe('17500')
    })

    it('con una coma propia, una cifra en medio NO reagrupa: «1,500» + 7 tras el 5 → «1,5700», rechazado', () => {
      const propio = teclear('1,500', idioma).estado
      const r = teclear('7', idioma, DINERO, propio, 3)
      expect(r.texto).toBe('1,5700')
      expect(r.cursor).toBe(4)
      expect(r.crudo).toBe('NaN')
    })

    it('con una coma propia, una cifra delante que deja los grupos bien vale: «21,500»', () => {
      const propio = teclear('1,500', idioma).estado
      const r = teclear('2', idioma, DINERO, propio, 0)
      expect(r.texto).toBe('21,500')
      expect(r.crudo).toBe('21500')
    })
  })

  describe(`D18 · ${idioma.toUpperCase()} · borrar`, () => {
    it('retroceso sobre una coma PROPIA la quita a ella sola: «1,500» → «1500» (y ya no hay comas propias)', () => {
      const propio = teclear('1,500', idioma).estado
      const r = borrar(propio, 2, idioma)
      expect(r.texto).toBe('1500')
      expect(r.cursor).toBe(1)
      expect(r.comasPropias).toBe(false)
      // Y la siguiente cifra vuelve a reagrupar, porque ya no queda coma de nadie.
      const s = teclear('0', idioma, DINERO, r)
      expect(s.texto).toBe('15,000')
    })

    it('retroceso sobre una coma DEL CAMPO borra la cifra vecina, como siempre: «1,500» → «500»', () => {
      const r = borrar({ texto: '1,500', comasPropias: false }, 2, idioma)
      expect(r.texto).toBe('500')
      expect(r.cursor).toBe(0)
    })

    it('suprimir sobre una coma del campo borra la cifra de la derecha, como siempre: «1,500» → «100»', () => {
      const r = borrar({ texto: '1,500', comasPropias: false }, 1, idioma, true)
      expect(r.texto).toBe('100')
    })

    it('borrar la última cifra de «1,500» propio deja «1,50», a medias', () => {
      const propio = teclear('1,500', idioma).estado
      const r = borrar(propio, 5, idioma)
      expect(r.texto).toBe('1,50')
      expect(r.comasPropias).toBe(true)
      expect(cifraAMedias(r.texto, idioma)).toBe(true)
    })

    it('borrar la cifra de «2,5» y teclear 500 acaba en «2,500» = 2500', () => {
      const r = borrar(teclear('2,5', idioma).estado, 3, idioma)
      expect(r.texto).toBe('2,')
      const s = teclear('500', idioma, DINERO, r)
      expect(s.texto).toBe('2,500')
      expect(s.crudo).toBe('2500')
    })
  })

  describe(`D18 · ${idioma.toUpperCase()} · pegar`, () => {
    it('lo pegado con coma cuenta como de la persona: «1,500» pegado + 0 → «1,5000», rechazado (antes 15,000)', () => {
      const p = teclearCifra({ texto: '', comasPropias: false }, { nuevo: '1,500', cursor: 5, tipoEntrada: 'insertFromPaste' }, idioma)
      expect(p.texto).toBe('1,500')
      expect(p.comasPropias).toBe(true)
      const r = teclear('0', idioma, DINERO, p)
      expect(r.texto).toBe('1,5000')
      expect(r.crudo).toBe('NaN')
    })

    it('B85 · pegar «1,500» ENCIMA de «2,000» (mismas comas) también cuenta: + 0 → «1,5000», rechazado (antes 15,000)', () => {
      const p = teclearCifra({ texto: '2,000', comasPropias: false }, { nuevo: '1,500', cursor: 5, tipoEntrada: 'insertFromPaste' }, idioma)
      expect(p.comasPropias).toBe(true)
      const r = teclear('0', idioma, DINERO, p)
      expect(r.texto).toBe('1,5000')
      expect(r.crudo).toBe('NaN')
      // Y soltar (arrastrar) igual que pegar.
      const d = teclearCifra({ texto: '2,000', comasPropias: false }, { nuevo: '1,500', cursor: 5, tipoEntrada: 'insertFromDrop' }, idioma)
      expect(d.comasPropias).toBe(true)
    })

    it('lo pegado sin coma no: «1500» pegado + 0 → «15,000»', () => {
      const p = teclearCifra({ texto: '', comasPropias: false }, { nuevo: '1500', cursor: 4, tipoEntrada: 'insertFromPaste' }, idioma)
      expect(p.comasPropias).toBe(false)
      expect(teclear('0', idioma, DINERO, p).texto).toBe('15,000')
    })
  })

  describe(`D18 · ${idioma.toUpperCase()} · a medias no se avisa (cifraAMedias)`, () => {
    it.each(['1,', '1,5', '12,50', '212,500,5', '2,5', '12,34', '$ 1,5', '-1,5', '15,000,50'])('«%s» va camino de una cifra bien puesta', (t) => {
      expect(cifraAMedias(t, idioma)).toBe(true)
    })
    it.each(['', '1,500', '1500', '2.5', '1,5000', '0,5', '1,,5', ',5', '1,5.0', '12,500.', 'abc', '1,234,56.7'])('«%s» no', (t) => {
      expect(cifraAMedias(t, idioma)).toBe(false)
    })
  })
}

// ─── B87 (supervisión de D18, 05/11) · el gemelo italiano ────────────────────
// B77 dejó el punto tecleado donde caía, pero en cuanto el texto volvía a
// parecer canónico («1.500») la tecla siguiente lo reagrupaba: «1.5000»
// tecleado daba 15.000 y «1.2345» 12.345, mientras pegados se rechazaban. Se
// aplica la regla de D18 con los signos intercambiados: un punto que pone la
// persona no se recoloca, y mientras quede alguno no se recoloca ninguno.
// LO QUE CAMBIA respecto a la prueba de antes («el italiano no cambia»):
// «1.5000» → «1.5000» rechazado (antes «15.000» = 15000) y «1.2345» →
// «1.2345» rechazado (antes «12.345»). Lo demás de esa lista sale igual.
describe('B87 · ITALIANO · el punto que pone la persona tampoco se reagrupa', () => {
  const IT: OpcionesCifra = { decimales: 2, minimo: 0 }
  it('«1.5000» y «1.2345» tecleados se quedan y se rechazan, como pegados', () => {
    for (const t of ['1.5000', '1.2345']) {
      const r = teclear(t, 'it', IT)
      expect(r.texto, t).toBe(t)
      expect(r.crudo, t).toBe('NaN')
      expect(r.lectura, t).toEqual(pegado(t, 'it', IT))
      expect(r.estado.comasPropias, t).toBe(true)
    }
  })
  it('lo bien puesto sigue igual: «1.500» = 1500, «1.500,50» = 1500.5, «1500» → «1.500», «15000,50» → «15.000,50»', () => {
    expect(teclear('1.500', 'it', IT).crudo).toBe('1500')
    expect(teclear('1.500,50', 'it', IT).crudo).toBe('1500.5')
    const r = teclear('1500', 'it', IT)
    expect(r.texto).toBe('1.500')
    expect(r.estado.comasPropias).toBe(false)
    expect(teclear('15000,50', 'it', IT).texto).toBe('15.000,50')
    expect(teclear('2.5', 'it', IT).crudo).toBe('NaN')
    expect(teclear('12,9', 'it', IT).crudo).toBe('12.9')
  })
  it('los puntos que puso el campo se siguen recolocando: «1.500» + 0 → «15.000»', () => {
    expect(teclear('0', 'it', IT, { texto: '1.500', comasPropias: false }).texto).toBe('15.000')
  })
  it('pegar «1.500» encima de «2.000» y teclear 0 → «1.5000», rechazado (B85 en italiano)', () => {
    const p = teclearCifra({ texto: '2.000', comasPropias: false }, { nuevo: '1.500', cursor: 5, tipoEntrada: 'insertFromPaste' }, 'it')
    expect(p.comasPropias).toBe(true)
    expect(teclear('0', 'it', IT, p).texto).toBe('1.5000')
  })
})

describe('D18 · el ITALIANO, lo que no cambia', () => {
  it('teclearCifra en italiano da lo de formatearMientrasEscribe tecla a tecla en todo lo que no lleva un punto propio', () => {
    for (const t of ['12,9', '1500,50', '15000', '2,5']) {
      let viejo = ''
      let estado: TecleoCifra = { texto: '', comasPropias: false }
      for (const ch of t) {
        const nuevo = viejo + ch
        viejo = formatearMientrasEscribe({ anterior: viejo, nuevo, cursor: nuevo.length, tipoEntrada: 'insertText' }, 'it').texto
        const r = teclearCifra(estado, { nuevo: estado.texto + ch, cursor: estado.texto.length + 1, tipoEntrada: 'insertText' }, 'it')
        estado = { texto: r.texto, comasPropias: r.comasPropias }
        expect(estado.texto).toBe(viejo)
        expect(estado.comasPropias).toBe(false)
      }
    }
    // «2.5» y «1.500,50» llevan un punto propio y acaban igual que antes.
    expect(teclear('2.5', 'it').texto).toBe('2.5')
    expect(teclear('1.500,50', 'it').texto).toBe('1.500,50')
  })
  it('cifraAMedias es siempre false en italiano: su aviso sale como antes', () => {
    expect(cifraAMedias('1.', 'it')).toBe(false)
    expect(cifraAMedias('1.5', 'it')).toBe(false)
    expect(cifraAMedias('1,', 'it')).toBe(false)
  })
})
