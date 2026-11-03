import { describe, it, expect } from 'vitest'
import { ES_PROPUESTAS, EN_PROPUESTAS } from './propuestas'
import { ES_COMPARTIDOS, EN_COMPARTIDOS } from './compartidos'
import { ES_CAMPANAS, EN_CAMPANAS } from './campanas'
import { ES_FINANZAS, EN_FINANZAS } from './finanzas'
import { ES_COMERCIAL, EN_COMERCIAL } from './comercial'
import { ES_CODIGOS, EN_CODIGOS } from './codigos'
import { ES_CATALOGOS, EN_CATALOGOS } from './catalogos'
import { ES_ADMIN, EN_ADMIN } from './admin'
import { ES_CUENTA, EN_CUENTA } from './cuenta'
import { ES_SHELL, EN_SHELL } from './shell'
import { ES_SERVIDOR, EN_SERVIDOR } from './servidor'
import { ES_CLIENTES, EN_CLIENTES } from './clientes'
import { ES_OPERACIONES, EN_OPERACIONES } from './operaciones'
import { ES_SPACEEYES, EN_SPACEEYES } from './spaceeyes'
import { ES_INVENTARIO, EN_INVENTARIO } from './inventario'
import { ES_ARRENDADORES, EN_ARRENDADORES } from './arrendadores'
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
  ['admin', ES_ADMIN, EN_ADMIN],
  ['cuenta', ES_CUENTA, EN_CUENTA],
  ['shell', ES_SHELL, EN_SHELL],
  // El diccionario BASE de `diccionario.ts` (login, menu `nav.*`, comunes):
  // lo que no es de ningun lote. Sin el, el menu podia decir «Activity» y el
  // titulo de la misma pagina «Activity log» sin que nadie lo viera
  // (validacion del lote de administracion, 2026-11-02).
  ['base', ...baseDelDiccionario()],
  ['servidor', ES_SERVIDOR, EN_SERVIDOR],
  ['clientes', ES_CLIENTES, EN_CLIENTES],
  ['operaciones', ES_OPERACIONES, EN_OPERACIONES],
  ['spaceeyes', ES_SPACEEYES, EN_SPACEEYES],
  ['inventario', ES_INVENTARIO, EN_INVENTARIO],
  ['arrendadores', ES_ARRENDADORES, EN_ARRENDADORES],
]

function baseDelDiccionario(): [Record<string, string>, Record<string, string>] {
  const deLotes = new Set(
    [ES_PROPUESTAS, ES_COMPARTIDOS, ES_CAMPANAS, ES_FINANZAS, ES_COMERCIAL, ES_CODIGOS, ES_CATALOGOS, ES_ADMIN, ES_CUENTA, ES_SHELL, ES_SERVIDOR, ES_CLIENTES, ES_OPERACIONES, ES_SPACEEYES, ES_INVENTARIO, ES_ARRENDADORES].flatMap((o) => Object.keys(o)),
  )
  const es: Record<string, string> = {}
  const en: Record<string, string> = {}
  for (const [k, v] of Object.entries(DICCIONARIOS.es as Record<string, string>)) {
    if (deLotes.has(k)) continue
    es[k] = v
    en[k] = (DICCIONARIOS.en as Record<string, string>)[k]
  }
  return [es, en]
}

// El mismo espanol que en ingles se dice distinto A PROPOSITO, porque en cada
// pantalla significa otra cosa. Cada entrada dice por que; una divergencia que
// no este aqui es un descuido de un lote y la prueba la enseña.
const DISTINTOS_A_PROPOSITO: Record<string, string> = {
  '{n} pantalla': 'en el loop de Administracion la frase cuenta solo las pantallas digitales y el adjetivo vive dentro de la clave en ingles («{n} digital screen»); en paquetes son pantallas a secas (aparecio al juntar admin con catalogos, 2026-11-02)',
  '{n} pantallas': 'lo mismo que «{n} pantalla», en plural',
  Actualizar: 'refrescar o recargar una lista o lo que dice DOOHmain («Refresh») frente a guardar un correo ya escrito, en Administracion, instalar la version nueva del programa de un equipo, en Space Eyes, o actualizar las pantallas que ya existen en una carga masiva de Inventario («Update»)',
  Baja: 'el estatus de un sitio dado de baja («Decommissioned») frente a la prioridad de un ticket de soporte («Low»)',
  Cargo: 'un cargo contable del estado de cuenta («Charge») frente al puesto de un usuario («Job title»)',
  Configuración: 'la pestaña de configuracion del negocio en Administracion («Business settings») frente a la de la cuenta del usuario («Account settings»), decision del orquestador',
  Imprenta: 'el modulo y la seccion de la ficha («Printing») frente al rol de una persona («Print shop»), decision del orquestador',
  Aprobada: 'el estatus de una propuesta o la columna del pipeline del cliente («Approved») frente a la columna del tablero de Propuestas que lleva la FECHA de aprobacion («Approved on»)',
  RFC: 'la cabecera de tabla o el rotulo del campo («RFC», el glosario no lo traduce) frente a la ficha de facturacion, que lo explica («RFC (tax ID)»)',
  Validada: 'un creativo revisado y aceptado («Approved») frente a la negociacion con una agencia, que se valida («Validated»)',
  Validar: 'el boton de Campañas que abre la revision de creativos («Review») frente al que valida la negociacion de una agencia («Validate»)',
  Próximo: 'un codigo que aun no entra en vigor («Upcoming») frente al siguiente pago de renta del cuadre («Next»)',
  Vigente: 'un permiso o licencia vigente («Valid», decision del orquestador) frente a un contrato o codigo vigente («Active»)',
  Vence: 'una cuota o un pago («Due») frente a un contrato que caduca («Expires»)',
  Comercial: 'en la ficha de campaña es la seccion de importes («Pricing», decision del orquestador); el modulo es «Sales», como el menu',
  'Dar de baja': 'la baja logica de una franja, temporada o paquete en catalogos, que se puede revertir («Deactivate»), frente a la baja definitiva de un articulo fisico del almacen, sin movimiento posible despues («Decommission», como el sitio de Comercial)',
  Desde: 'un periodo de fechas («From») frente a la competencia del espacio, que esta ahi «desde» («Since»)',
  Entrar: 'iniciar sesion («Sign in», login) frente a cambiar a otra organizacion («Switch to», Administracion)',
  Folio: 'glosario: «Internal ref.» en propuestas y campañas, «Invoice no.» en una factura',
  Horario: 'el horario que se manda a DOOHmain («Schedule») frente al horario de operacion del sitio («Operating hours»)',
  Movimiento: 'un renglon del estado de cuenta («Transaction») frente al traslado fisico de un articulo del almacen («Movement»)',
  Plazo: 'el plazo de cobranza («Payment terms») frente al plazo de una oferta de renta («Term»)',
  'Por vencer': 'una cuota que vence pronto («Due soon») frente a un contrato que caduca («Expiring soon»)',
  Vencido: 'un pago atrasado («Overdue») frente a un contrato o codigo caducado («Expired»)',
  Vista: 'hacia donde mira una cara del sitio («Facing») frente al selector de vista de la rejilla de Disponibilidad, catorcena o mes («View»)',
  Vigencia: 'glosario: la vigencia de una propuesta o codigo («Validity») frente al plazo de un contrato («Term»)',
  // Lote Space Eyes (2026-11-02):
  Estado: 'el estatus de algo («Status») frente al estado de la republica en la direccion de un equipo («State»)',
  Ganancia: 'la ganancia de una propuesta («Profit») frente a la ganancia del sensor de la camara («Gain»)',
  // Costura 2 (2026-11-02): aparecieron al juntar Space Eyes con catalogos, admin y cuenta.
  'Dada de baja': 'la baja logica de un registro que se reactiva, franja, temporada, paquete o razon social («Deactivated») frente a la pantalla que sale de la flota de Space Eyes, como el sitio dado de baja («Decommissioned»)',
  Equipo: 'el equipo de personas de una organizacion, en Administracion («Team») frente al aparato de Space Eyes («Device»)',
  Operador: 'la empresa duena de una pantalla de la Network («Operator») frente a la compania de telefonia de la SIM de un equipo de Space Eyes («Carrier»)',
  Volver: 'regresar a la pantalla anterior («Back») frente a devolver la camara a la orientacion guardada, en la vista en vivo de Space Eyes («Revert»)',
  Registrar: 'dar de alta un articulo en el almacen («Register») frente a anotar un pago de renta en la ficha del contrato («Record»)',
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

  // «peso» que NO es dinero: el grosor de una letra o la importancia de algo.
  // Cada excepcion es una frase entera, con su motivo; un «peso» suelto sigue
  // cayendo. (Space Eyes aun no esta traducido: cuando lo este, «Peso de la
  // fuente» llegara a un diccionario y no debe hacer caer la guardia.)
  const PESO_QUE_NO_ES_DINERO: Record<string, string> = {
    'peso de la fuente': 'el grosor de la letra en el editor de Space Eyes (AjustarTexto.tsx)',
    'peso visual': 'la importancia de un boton en la ficha del sitio (SiteFicha.tsx)',
  }

  it('ningun texto da por hecho la moneda: es de la instancia (ADR 0048)', () => {
    // «Precio del conjunto (pesos enteros)», «cuadra al peso», «whole number of
    // pesos»… eran falsos en una instancia en dolares. Se dice neutro:
    // «cantidad entera», «sin centavos», «exacto». El nombre de la moneda sale
    // de `nombreMoneda()` y su simbolo de `simboloMoneda()`, nunca de un
    // diccionario: ni la palabra (pesos, dolares, M.N.) ni el codigo (MXN, USD).
    // Los huecos no cuentan: `{peso}` es el nombre de una pieza, no texto.
    const sinExcepciones = (v: string) => {
      let t = v.replace(/\{\w+\}/g, '')
      for (const frase of Object.keys(PESO_QUE_NO_ES_DINERO)) t = t.replace(new RegExp(frase, 'gi'), '')
      return t
    }
    const malas = (['es', 'en'] as const).flatMap((idioma) =>
      Object.entries(DICCIONARIOS[idioma] as Record<string, string>)
        .filter(([, v]) => {
          const t = sinExcepciones(v)
          return /\bpesos?\b|\bM\.N\.|\bd[oó]lar(es)?\b|\bdollars?\b/i.test(t) || /\b(MXN|USD)\b/.test(t)
        })
        .map(([k]) => `${idioma}:${k}`),
    )
    expect(malas).toEqual([])
  })

  it('las excepciones de «peso» son frases que no hablan de dinero (y no tapan un «pesos» de verdad)', () => {
    for (const frase of Object.keys(PESO_QUE_NO_ES_DINERO)) expect(frase).not.toMatch(/\bpesos\b|centav|precio|monto|importe/i)
  })

  // El mismo espanol que manda el servidor tiene que leerse igual en ingles en
  // la pantalla y en el error. Medido el 02/11 recorriendo el diccionario: el
  // servidor (`traducirError`) conoce 19 textos espanoles del diccionario
  // —7 con hueco, que van por `PATRONES_ERROR`, y 12 frases fijas—. Coinciden
  // 10. Los 9 que divergen son todos de la calculadora y estan aqui, uno por
  // uno: unificarlos es del lote del servidor (ola 4), no de esta prueba. Cuando
  // se unifique uno, la segunda prueba obliga a quitarlo de la lista.
  // Al juntar con el lote del servidor (ola 4, 2026-11-02) los ocho se
  // unificaron: el servidor dice ya el ingles de la pantalla. Queda solo el
  // singular de «pocos libres», y no por divergir: `rellenar` pone 1000 en
  // el hueco, asi que el servidor elige con razon la forma plural.
  const CALCULADORA_DIVERGE_OLA_4 = [
    'compartidos.calc.motivo.pocos-libres.uno',
  ]
  const ES_D = DICCIONARIOS.es as Record<string, string>
  const EN_D = DICCIONARIOS.en as Record<string, string>
  const rellenar = (t: string) => t.replace(/\{\w+\}/g, '1000')
  const conocidasPorElServidor = Object.keys(ES_D).filter((k) => traducirError(rellenar(ES_D[k]), 'en') !== rellenar(ES_D[k]))
  const igualQueElServidor = (k: string) => rellenar(EN_D[k]) === traducirError(rellenar(ES_D[k]), 'en')

  it('un texto que tambien manda el servidor se dice igual en el campo y en el error', () => {
    // «No puede ser mayor que {n}» lo pinta CampoCifra y lo manda zod: el campo
    // decia «It cannot be greater than» y el servidor «Must not be greater
    // than» (validador de catalogos). Se rellenan los huecos con una cifra.
    const distintos = conocidasPorElServidor
      .filter((k) => !CALCULADORA_DIVERGE_OLA_4.includes(k) && !igualQueElServidor(k))
      .map((k) => `${k}: «${rellenar(EN_D[k])}» / servidor «${traducirError(rellenar(ES_D[k]), 'en')}»`)
    expect(distintos).toEqual([])
    // Y que la prueba mire algo: si el diccionario o el catalogo cambian y esto
    // se queda en cero, no protege nada.
    expect(conocidasPorElServidor.filter((k) => !CALCULADORA_DIVERGE_OLA_4.includes(k)).length).toBeGreaterThanOrEqual(10)
  })

  it('las excepciones de la calculadora siguen divergiendo (si una se unifica, se quita de la lista)', () => {
    expect(CALCULADORA_DIVERGE_OLA_4.filter((k) => !conocidasPorElServidor.includes(k) || igualQueElServidor(k))).toEqual([])
  })
})
