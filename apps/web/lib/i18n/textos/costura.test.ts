import { describe, it, expect } from 'vitest'
import { ES_PROPUESTAS, EN_PROPUESTAS } from './propuestas'
import { ES_COMPARTIDOS, EN_COMPARTIDOS } from './compartidos'
import { ES_CAMPANAS, EN_CAMPANAS } from './campanas'
import { ES_FINANZAS, EN_FINANZAS } from './finanzas'
import { ES_COMERCIAL, EN_COMERCIAL } from './comercial'
import { ES_CODIGOS, EN_CODIGOS } from './codigos'
import { ES_CATALOGOS, EN_CATALOGOS } from './catalogos'
import { DICCIONARIOS } from '../diccionario'
import { traducirError } from '../errores-servidor'

// ============================================================================
//  LA COSTURA DE LOS LOTES DEL INGLES (2026-11-02).
// ----------------------------------------------------------------------------
//  Cada lote (propuestas, compartidos, campanas y finanzas, comercial) lo hizo
//  un agente en su rama, con su propio archivo de textos. Cada uno se valido
//  solo, y por construccion ninguno veia a los demas: el mismo texto espanol
//  podia salir traducido de dos maneras en dos pantallas, y el estilo
//  tipografico de un lote no tenia por que ser el del siguiente. Esta prueba
//  mira los seis diccionarios JUNTOS.
// ============================================================================

const LOTES: [string, Record<string, string>, Record<string, string>][] = [
  ['propuestas', ES_PROPUESTAS, EN_PROPUESTAS],
  ['compartidos', ES_COMPARTIDOS, EN_COMPARTIDOS],
  ['campanas', ES_CAMPANAS, EN_CAMPANAS],
  ['finanzas', ES_FINANZAS, EN_FINANZAS],
  ['comercial', ES_COMERCIAL, EN_COMERCIAL],
  ['codigos', ES_CODIGOS, EN_CODIGOS],
  ['catalogos', ES_CATALOGOS, EN_CATALOGOS],
]

// El mismo espanol que en ingles se dice distinto A PROPOSITO, porque en cada
// pantalla significa otra cosa. Cada entrada dice por que; una divergencia que
// no este aqui es un descuido de un lote y la prueba la enseña.
const DISTINTOS_A_PROPOSITO: Record<string, string> = {
  Comercial: 'en la ficha de campaña es la seccion de importes («Pricing», decision del orquestador); el modulo es «Sales», como el menu',
  Desde: 'un periodo de fechas («From») frente a la competencia del espacio, que esta ahi «desde» («Since»)',
  Folio: 'glosario: «Internal ref.» en propuestas y campañas, «Invoice no.» en una factura',
  Horario: 'el horario que se manda a DOOHmain («Schedule») frente al horario de operacion del sitio («Operating hours»)',
  Plazo: 'el plazo de cobranza («Payment terms») frente al plazo de una oferta de renta («Term»)',
  'Por vencer': 'una cuota que vence pronto («Due soon») frente a un contrato que caduca («Expiring soon»)',
  Vencido: 'un pago atrasado («Overdue») frente a un contrato o codigo caducado («Expired»)',
  Vigencia: 'glosario: la vigencia de una propuesta o codigo («Validity») frente al plazo de un contrato («Term»)',
}

describe('costura · los lotes dicen lo mismo de la misma manera', () => {
  it('el mismo texto espanol en dos lotes lleva el mismo ingles (salvo los declarados)', () => {
    const porTexto = new Map<string, Map<string, string[]>>()
    for (const [lote, es, en] of LOTES) {
      for (const clave of Object.keys(es)) {
        const texto = es[clave].trim()
        if (!porTexto.has(texto)) porTexto.set(texto, new Map())
        const ingleses = porTexto.get(texto)!
        const ingles = en[clave].trim()
        ingleses.set(ingles, [...(ingleses.get(ingles) ?? []), `${lote}:${clave}`])
      }
    }
    const divergentes: string[] = []
    for (const [texto, ingleses] of porTexto) {
      const lotes = new Set([...ingleses.values()].flat().map((c) => c.split(':')[0]))
      if (lotes.size < 2 || ingleses.size < 2 || texto in DISTINTOS_A_PROPOSITO) continue
      divergentes.push(`«${texto}» → ${[...ingleses].map(([en, claves]) => `«${en}» (${claves.join(', ')})`).join(' / ')}`)
    }
    expect(divergentes).toEqual([])
  })

  it('las excepciones declaradas siguen existiendo (si una se unifica, se quita de la lista)', () => {
    const textos = new Set(LOTES.flatMap(([, es]) => Object.values(es).map((t) => t.trim())))
    expect(Object.keys(DISTINTOS_A_PROPOSITO).filter((t) => !textos.has(t))).toEqual([])
  })

  // El diccionario ENTERO, no solo los seis lotes: el base de `diccionario.ts`
  // (login, menu, errores) tenia un «Don't» que la prueba de los lotes no veia
  // (validacion de la costura).
  const TODO_EN = Object.entries(DICCIONARIOS.en as Record<string, string>)

  it('el apostrofo ingles es el tipografico (’), en TODO el diccionario', () => {
    // Propuestas y compartidos escribian «can't» y los otros cuatro «can’t».
    // Las coordenadas (19°25'57"N) no cuentan: van entre cifras.
    expect(TODO_EN.filter(([, v]) => /[A-Za-z]'[A-Za-z]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('las comillas inglesas son las tipograficas “ ”, en TODO el diccionario', () => {
    // Una comilla recta que ABRE (al principio o tras un espacio). Los
    // segundos de las coordenadas (57"N) van pegados a una cifra.
    expect(TODO_EN.filter(([, v]) => /(^|[\s(])"/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('«internal ref.» va en minuscula a media frase (es un termino, no un nombre)', () => {
    expect(TODO_EN.filter(([, v]) => /[a-z,;] Internal ref\./.test(v)).map(([k]) => k)).toEqual([])
  })

  it('las periodicidades siguen el glosario (quincenal = twice a month, sin «biweekly» ni «semi-»)', () => {
    const malas = TODO_EN.filter(([, v]) => /\bbi-?weekly\b|\bsemi-?monthly\b|\bsemiannual\b|\bbimonthly\b/i.test(v))
    expect(malas.map(([k]) => k)).toEqual([])
  })

  it('las periodicidades van SIEMPRE en letra: «every two months», nunca «every 2 months»', () => {
    // Decision del orquestador tras la validacion: el glosario ya decia «every
    // two weeks» y la costura habia dejado «every 2 months» / «every 6 months».
    const malas = TODO_EN.filter(([, v]) => /\bevery \d|\b\d+-(week|month|day)\b/i.test(v))
    expect(malas.map(([k]) => k)).toEqual([])
  })

  it('ningun texto da por hecho el peso: la moneda es de la instancia (ADR 0048)', () => {
    // «Precio del conjunto (pesos enteros)», «cuadra al peso», «whole number of
    // pesos»… eran falsos en una instancia en dolares. Se dice neutro: «cantidad
    // entera», «sin centavos», «al centavo». El nombre de la moneda sale de
    // `nombreMoneda()`, nunca de un diccionario.
    // Los huecos no cuentan: `{peso}` es el nombre de una pieza, no texto.
    const malas = (['es', 'en'] as const).flatMap((idioma) =>
      Object.entries(DICCIONARIOS[idioma] as Record<string, string>)
        .filter(([, v]) => /\bpesos?\b|\bM\.N\.|\bd[oó]lar(es)?\b|\bdollars?\b/i.test(v.replace(/\{\w+\}/g, '')))
        .map(([k]) => `${idioma}:${k}`),
    )
    expect(malas).toEqual([])
  })

  it('un motivo con cifra que tambien manda el servidor se dice igual en el campo y en el error', () => {
    // «No puede ser mayor que {n}» lo pinta CampoCifra y lo manda zod: el campo
    // decia «It cannot be greater than» y el servidor «Must not be greater
    // than» (validador de catalogos). Se rellenan los huecos con una cifra y,
    // si el servidor conoce el espanol, el ingles tiene que ser el suyo.
    //
    // Solo los que llevan HUECO, que son los que van por `PATRONES_ERROR`. Y sin
    // los motivos de la calculadora (`compartidos.calc.motivo.*` y
    // `propuestas.calc.*`): el servidor y la pantalla aun los dicen distinto en
    // nueve claves (medido el 02/11), y unificarlos es de la ola 4 («lo que
    // sale del servidor»), no de esta prueba. Cuando se unifiquen, se quita la
    // excepcion.
    const ES = DICCIONARIOS.es as Record<string, string>
    const EN = DICCIONARIOS.en as Record<string, string>
    const rellenar = (t: string) => t.replace(/\{\w+\}/g, '1000')
    const distintos: string[] = []
    for (const clave of Object.keys(ES)) {
      if (!/\{\w+\}/.test(ES[clave])) continue
      if (clave.startsWith('compartidos.calc.motivo.') || clave.startsWith('propuestas.calc.')) continue
      const es = rellenar(ES[clave])
      const delServidor = traducirError(es, 'en')
      if (delServidor === es) continue
      if (rellenar(EN[clave]) !== delServidor) distintos.push(`${clave}: «${rellenar(EN[clave])}» / servidor «${delServidor}»`)
    }
    expect(distintos).toEqual([])
  })
})
