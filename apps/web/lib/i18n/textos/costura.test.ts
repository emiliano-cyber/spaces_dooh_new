import { describe, it, expect } from 'vitest'
import { ES_PROPUESTAS, EN_PROPUESTAS } from './propuestas'
import { ES_COMPARTIDOS, EN_COMPARTIDOS } from './compartidos'
import { ES_CAMPANAS, EN_CAMPANAS } from './campanas'
import { ES_FINANZAS, EN_FINANZAS } from './finanzas'
import { ES_COMERCIAL, EN_COMERCIAL } from './comercial'
import { ES_CODIGOS, EN_CODIGOS } from './codigos'
import { ES_CLIENTES, EN_CLIENTES } from './clientes'
import { ES_OPERACIONES, EN_OPERACIONES } from './operaciones'
import { DICCIONARIOS } from '../diccionario'

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
  ['clientes', ES_CLIENTES, EN_CLIENTES],
  ['operaciones', ES_OPERACIONES, EN_OPERACIONES],
]

// El mismo espanol que en ingles se dice distinto A PROPOSITO, porque en cada
// pantalla significa otra cosa. Cada entrada dice por que; una divergencia que
// no este aqui es un descuido de un lote y la prueba la enseña.
const DISTINTOS_A_PROPOSITO: Record<string, string> = {
  Aprobada: 'el estatus de una propuesta o la columna del pipeline del cliente («Approved») frente a la columna del tablero de Propuestas que lleva la FECHA de aprobacion («Approved on»)',
  RFC: 'la cabecera de tabla o el rotulo del campo («RFC», el glosario no lo traduce) frente a la ficha de facturacion, que lo explica («RFC (tax ID)»)',
  Validada: 'un creativo revisado y aceptado («Approved») frente a la negociacion con una agencia, que se valida («Validated»)',
  Validar: 'el boton de Campañas que abre la revision de creativos («Review») frente al que valida la negociacion de una agencia («Validate»)',
  Comercial: 'en la ficha de campaña es la seccion de importes («Pricing», decision del orquestador); el modulo es «Sales», como el menu',
  Desde: 'un periodo de fechas («From») frente a la competencia del espacio, que esta ahi «desde» («Since»)',
  Folio: 'glosario: «Internal ref.» en propuestas y campañas, «Invoice no.» en una factura',
  Horario: 'el horario que se manda a DOOHmain («Schedule») frente al horario de operacion del sitio («Operating hours»)',
  Movimiento: 'un renglon del estado de cuenta («Transaction») frente al traslado fisico de un articulo del almacen («Movement»)',
  Plazo: 'el plazo de cobranza («Payment terms») frente al plazo de una oferta de renta («Term»)',
  'Por vencer': 'una cuota que vence pronto («Due soon») frente a un contrato que caduca («Expiring soon»)',
  Vencido: 'un pago atrasado («Overdue») frente a un contrato o codigo caducado («Expired»)',
  Vista: 'hacia donde mira una cara del sitio («Facing») frente al selector de vista de la rejilla de Disponibilidad, catorcena o mes («View»)',
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
})
