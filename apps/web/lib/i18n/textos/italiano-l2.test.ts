import { describe, it, expect } from 'vitest'
import { ES_COMERCIAL, EN_COMERCIAL, IT_COMERCIAL } from './comercial'
import { ES_CODIGOS, EN_CODIGOS, IT_CODIGOS } from './codigos'
import { ES_PROPUESTAS, EN_PROPUESTAS, IT_PROPUESTAS } from './propuestas'
import { ES_CATALOGOS, EN_CATALOGOS, IT_CATALOGOS } from './catalogos'

// ============================================================================
//  EL ITALIANO DEL LOTE L2 «COMERCIAL Y PROPUESTAS», MIRADO EN EL DICCIONARIO.
// ----------------------------------------------------------------------------
//  Lote L2 del italiano (2026-11-03). Las pruebas de pantallas
//  (`pantallas-comercial`, `-propuestas`, `-catalogos`) miran lo PINTADO; esta
//  mira lo ESCRITO, clave por clave, en los cuatro ambitos del lote: que este
//  todo, que lleve los mismos huecos que el espanol, el estilo tipografico del
//  italiano de la app y —lo que ninguna otra prueba ve— que obedezca el
//  glosario (`vault/03-Frontend/italiano-olas.md`): una frase espanola que dice
//  «propuesta» tiene que decir «proposta», no «offerta».
//
//  Y una instantanea, como el espanol y el ingles: el italiano no cambia sin
//  que el diff de `__snapshots__/` lo enseñe.
// ============================================================================

const AMBITOS: [string, Record<string, string>, Record<string, string>, Record<string, string>][] = [
  ['comercial', ES_COMERCIAL, EN_COMERCIAL, IT_COMERCIAL],
  ['codigos', ES_CODIGOS, EN_CODIGOS, IT_CODIGOS],
  ['propuestas', ES_PROPUESTAS, EN_PROPUESTAS, IT_PROPUESTAS],
  ['catalogos', ES_CATALOGOS, EN_CATALOGOS, IT_CATALOGOS],
]

const todas = () => AMBITOS.flatMap(([, es, en, it]) => Object.keys(es).map((k) => ({ k, es: es[k], en: en[k], it: it[k] })))
const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
const sinHuecos = (s: string) => s.replace(/\{\w+\}/g, '')

describe('italiano L2 · instantanea', () => {
  for (const [nombre, , , italiano] of AMBITOS) {
    it(`el italiano de ${nombre} no cambia sin que se vea`, () => {
      expect(italiano).toMatchSnapshot()
    })
  }
})

describe('italiano L2 · completo y bien formado', () => {
  it('cada clave espanola tiene su italiano, no vacio, y ninguna sobra', () => {
    for (const [nombre, es, , italiano] of AMBITOS) {
      expect(Object.keys(es).filter((k) => !italiano[k]), nombre).toEqual([])
      expect(Object.keys(italiano).filter((k) => !(k in es)), nombre).toEqual([])
    }
  })

  it('los huecos son los del espanol', () => {
    expect(todas().filter((x) => huecos(x.it) !== huecos(x.es)).map((x) => x.k)).toEqual([])
  })

  it('los espacios de los bordes son los del espanol (la frase va pegada a otro nodo)', () => {
    const borde = (s: string) => `${/^\s/.test(s)}${/\s$/.test(s)}`
    expect(todas().filter((x) => borde(x.it) !== borde(x.es)).map((x) => x.k)).toEqual([])
  })
})

describe('italiano L2 · estilo tipografico', () => {
  it('apostrofo tipografico (’), nunca el recto', () => {
    expect(todas().filter((x) => /[A-Za-zÀ-ú]'[A-Za-zÀ-ú]/.test(x.it)).map((x) => x.k)).toEqual([])
  })

  it('comillas « », nunca rectas ni inglesas (salvo las coordenadas de ejemplo, que son dato)', () => {
    const malas = todas()
      .filter((x) => x.k !== 'comercial.negociacion.buscar.ayuda')
      .filter((x) => /["“”]/.test(x.it))
    expect(malas.map((x) => x.k)).toEqual([])
  })

  it('porcentaje sin espacio delante («20%»)', () => {
    expect(todas().filter((x) => /\d %|\} %/.test(x.it)).map((x) => x.k)).toEqual([])
  })

  it('nada de ortografia espanola: ñ, ¿, ¡ ni las tildes agudas que el italiano no usa', () => {
    // El italiano acentua sobre todo con grave (à è ì ò ù) y «é» en «perché»;
    // á, í, ó, ú, ñ, ¿ y ¡ son espanol que se quedo pegado.
    expect(todas().filter((x) => /[ñÑ¿¡áíóúÁÍÓÚ]/.test(sinHuecos(x.it))).map((x) => x.k)).toEqual([])
  })

  it('ningun texto da por hecha la moneda (ADR 0048): ni pesos ni dolares ni simbolos', () => {
    expect(
      todas()
        .filter((x) => /\bpesos?\b|\bdollar[oi]\b|\beuro\b|\b(MXN|USD|EUR)\b|\$/i.test(sinHuecos(x.it)))
        .map((x) => x.k),
    ).toEqual([])
  })
})

// Las que coinciden A PROPOSITO con el ingles: anglicismos del sector que el
// glosario deja sin traducir (decision del dueno, 03/11), marcas, ejemplos que
// son dato y plantillas sin texto.
const IGUAL_QUE_EL_INGLES = new Set([
  'comercial.comun.no', // «No»
  'comercial.comun.video', // «Video»
  'comercial.comun.programatico', // «Programmatic»: anglicismo del sector
  'comercial.eye.en-linea', // «Online»
  'comercial.eye.desconectado', // «Offline»
  'comercial.negociacion.canal.whatsapp', // marca
  'comercial.reserva.cliente-ej', // dato de ejemplo
  'comercial.negociacion.canal.correo', // «Email»: asi se dice en italiano
  'comercial.negociacion.contactos.correo', // «Email»
  'codigos.pct', // «{pct}%»
  'propuestas.comun.pct', // «{pct}%»
  'propuestas.lista.resumen', // plantilla
  'propuestas.codigo.opcion', // plantilla
  'propuestas.lista.kpi.pipeline', // «In pipeline»: anglicismo del sector
  'propuestas.alta.pie.volumen', // «Volume: {monto}»
  'propuestas.calc.por-spot', // «{monto} per spot»
  'catalogos.volumen.pct', // «→ {pct}%»
  'catalogos.volumen.aviso.compone.pct', // «64%»
])

describe('italiano L2 · no es ingles', () => {
  it('ninguna entrada italiana es igual a la inglesa, salvo las declaradas', () => {
    const iguales = todas().filter((x) => x.it === x.en).map((x) => x.k)
    expect(iguales.filter((k) => !IGUAL_QUE_EL_INGLES.has(k))).toEqual([])
  })

  it('la lista de declaradas no tiene sobrantes (una que ya no es igual se quita)', () => {
    const iguales = new Set(todas().filter((x) => x.it === x.en).map((x) => x.k))
    expect([...IGUAL_QUE_EL_INGLES].filter((k) => !iguales.has(k))).toEqual([])
  })
})

// ─── El glosario, obedecido ─────────────────────────────────────────────────
// Si el espanol dice el termino, el italiano tiene que decir el suyo. Cada
// excepcion dice por que la frase italiana no lo necesita.
const GLOSARIO: [string, RegExp, RegExp][] = [
  ['propuesta → proposta', /propuesta/i, /propost/i],
  ['campaña → campagna', /campaña/i, /campagn/i],
  ['arrendador → locatore', /arrendador/i, /locator/i],
  ['tarifa → tariffa', /tarifa/i, /tariff/i],
  ['borrador → bozza', /borrador/i, /bozz/i],
  ['franja → fascia oraria', /franja/i, /fascia oraria|fasce orarie/i],
  ['temporada → stagione', /temporada/i, /stagion/i],
  ['paquete → pacchetto', /paquete/i, /pacchett/i],
  ['cupón / código de negociación → codice', /cupón|código de negociación|códigos de negociación/i, /codic/i],
  ['vendedor → commerciale', /vendedor/i, /commercial/i],
  ['folio → Rif. interno', /\bfolio\b/i, /Rif\. interno/i],
  ['espectacular → cartellone', /espectacular/i, /cartellon/i],
  ['reserva → prenotazione', /reserv/i, /prenot/i],
  ['sitio → sito', /\bsitios?\b/i, /\bsit[oi]\b/i],
  ['pantalla → impianto / schermo', /pantalla/i, /impiant|scherm/i],
  ['impactos → impression', /impactos/i, /impression/i],
  ['salidas / pases → passaggi', /\bsalidas\b|\bpases\b/i, /passaggi/i],
  ['millar → migliaio', /millar/i, /migliai/i],
  ['bruto → lordo', /\bbruto\b/i, /lord/i],
  ['neto → netto', /\bneto\b/i, /nett/i],
  ['Administración → Impostazioni', /Administración/, /Impostazioni/],
  ['ficha técnica → scheda tecnica', /ficha técnica/i, /scheda tecnica/i],
  ['tentativa → provvisoria', /tentativ/i, /provvisori/i],
  ['Arrendadores (modulo) → Locatori', /Arrendadores/, /Locatori/],
  ['rotaciones/h → loop/h', /rotaciones\/h/, /loop\/h/],
]

// Clave → por que no lleva el termino del glosario.
const SIN_TERMINO: Record<string, string> = {
  'comercial.ficha.no-reservable': '«Sitio {estatus} · no disponible para reservar» → «Non prenotabile (stato: …)»: el sujeto se sobreentiende, como en ingles',
  'comercial.negociacion.canal.visita': '«Visita en sitio» → «Sopralluogo»: una sola palabra italiana dice «visita al lugar»',
  'propuestas.ficha.codigo-pendiente': '« · cupón pendiente de aprobación» va pegado a «Codice {codigo} ({pct}%)»: repetir «codice» sobra (el ingles tampoco lo repite)',
  'catalogos.motivo.tramo.desde-dos': '«el tarifario entero» es la lista de precios: «l’intero listino», no una tarifa',
}

describe('italiano L2 · el glosario, obedecido', () => {
  it('si el espanol dice el termino, el italiano dice el suyo', () => {
    const faltan: string[] = []
    for (const x of todas()) {
      if (x.k in SIN_TERMINO) continue
      for (const [nombre, es, italiano] of GLOSARIO) {
        if (es.test(sinHuecos(x.es)) && !italiano.test(sinHuecos(x.it))) faltan.push(`${x.k} · ${nombre}`)
      }
    }
    expect(faltan).toEqual([])
  })

  it('las excepciones declaradas siguen siendo excepciones (sin sobrantes)', () => {
    const vivas = Object.keys(SIN_TERMINO).filter((k) => {
      const x = todas().find((y) => y.k === k)
      return x && GLOSARIO.some(([, es, italiano]) => es.test(sinHuecos(x.es)) && !italiano.test(sinHuecos(x.it)))
    })
    expect(Object.keys(SIN_TERMINO).filter((k) => !vivas.includes(k))).toEqual([])
  })

  it('y muerde: una frase que traduce «propuesta» por «offerta» cae', () => {
    const [, es, italiano] = GLOSARIO[0]
    expect(es.test('Nueva propuesta') && !italiano.test('Nuova offerta')).toBe(true)
  })
})
