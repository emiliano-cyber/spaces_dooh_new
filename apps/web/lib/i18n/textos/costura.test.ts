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
import { ES_OPERACIONES2, EN_OPERACIONES2 } from './operaciones2'
import { ES_INICIO, EN_INICIO } from './inicio'
import { ES_ENERGIA, EN_ENERGIA } from './energia'
import { ES_REPORTES, EN_REPORTES } from './reportes'
import { DICCIONARIOS, AMBITOS_ITALIANO, IT_PARCIAL, AMBITOS_PORTUGUES, PT_PARCIAL } from '../diccionario'
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
  ['operaciones2', ES_OPERACIONES2, EN_OPERACIONES2],
  ['inicio', ES_INICIO, EN_INICIO],
  ['energia', ES_ENERGIA, EN_ENERGIA],
  ['reportes', ES_REPORTES, EN_REPORTES],
]

function baseDelDiccionario(): [Record<string, string>, Record<string, string>] {
  const deLotes = new Set(
    [ES_PROPUESTAS, ES_COMPARTIDOS, ES_CAMPANAS, ES_FINANZAS, ES_COMERCIAL, ES_CODIGOS, ES_CATALOGOS, ES_ADMIN, ES_CUENTA, ES_SHELL, ES_SERVIDOR, ES_CLIENTES, ES_OPERACIONES, ES_SPACEEYES, ES_INVENTARIO, ES_ARRENDADORES, ES_OPERACIONES2, ES_INICIO, ES_ENERGIA, ES_REPORTES].flatMap((o) => Object.keys(o)),
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
  'sin número': 'en Energia va justo detras del medidor y entre parentesis («Meter (no number)», pedido del validador de operaciones parte 2); en Space Eyes es el valor suelto de una celda («no number»). Aparecio al juntar operaciones parte 2, 2026-11-02',
  Actualizar: 'refrescar o recargar una lista o lo que dice DOOHmain («Refresh») frente a guardar un correo ya escrito, en Administracion, instalar la version nueva del programa de un equipo, en Space Eyes, o actualizar las pantallas que ya existen en una carga masiva de Inventario («Update»)',
  Baja: 'el estatus de un sitio dado de baja («Decommissioned») frente a la prioridad de un ticket de soporte o de una OT («Low»)',
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
  '{n} meses': 'Comercial tiene un singular (`.uno`) cuyo espanol es el de siempre («1 meses») y su ingles «{n} month»; el plural dice «{n} months» en todos los lotes',
  Comercial: 'en la ficha de campaña es la seccion de importes («Pricing», decision del orquestador); el modulo es «Sales», como el menu',
  'Dar de baja': 'la baja logica de una franja, temporada o paquete en catalogos, que se puede revertir («Deactivate»), frente a la baja definitiva de un articulo fisico del almacen, sin movimiento posible despues («Decommission», como el sitio de Comercial)',
  Desde: 'un periodo de fechas («From») frente a la competencia del espacio, que esta ahi «desde» («Since»)',
  Entrar: 'iniciar sesion («Sign in», login) frente a cambiar a otra organizacion («Switch to», Administracion)',
  Folio: 'glosario: «Internal ref.» en propuestas y campañas, «Invoice no.» en una factura',
  Horario: 'el horario que se manda a DOOHmain («Schedule») frente al horario de operacion del sitio («Operating hours»)',
  Movimiento: 'un renglon del estado de cuenta («Transaction») frente al traslado fisico de un articulo del almacen («Movement»)',
  Plazo: 'el plazo de cobranza («Payment terms») frente al plazo de una oferta de renta («Term»)',
  'Por vencer': 'una cuota que vence pronto («Due soon») frente a un contrato que caduca («Expiring soon»)',
  Trimestre: 'la opcion del selector de periodo, el trimestre en curso («This quarter»), frente al encabezado de la columna del reporte de rentabilidad cuyas filas son trimestres («Quarter»)',
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

// ============================================================================
//  LA COSTURA DEL ITALIANO (ola 0, 2026-11-03).
// ----------------------------------------------------------------------------
//  La misma regla que el ingles —el mismo espanol en dos lotes se dice igual—
//  aplicada al italiano, que lo traducen 4 o 5 lotes en paralelo. Tolera las
//  claves aun vacias: solo compara lo que YA tiene italiano. Hoy casi todo
//  falta y la prueba pasa sola; la que la hace morder es la de los datos de
//  muestra, abajo.
// ============================================================================

type LoteIt = [string, Record<string, string>, Partial<Record<string, string>>]

const escrita = (v: unknown): v is string => typeof v === 'string' && v !== ''

/** Los textos espanoles que en dos lotes llevan dos italianos distintos. */
function divergenciasItaliano(lotes: LoteIt[], excepciones: Record<string, string>): string[] {
  const porTexto = new Map<string, Map<string, string[]>>()
  for (const [lote, es, it] of lotes) {
    for (const clave of Object.keys(es)) {
      const italiano = it[clave]
      if (!escrita(italiano)) continue
      const texto = es[clave].trim()
      if (!porTexto.has(texto)) porTexto.set(texto, new Map())
      const m = porTexto.get(texto)!
      m.set(italiano.trim(), [...(m.get(italiano.trim()) ?? []), `${lote}:${clave}`])
    }
  }
  const divergentes: string[] = []
  for (const [texto, italianos] of porTexto) {
    const lotes = new Set([...italianos.values()].flat().map((c) => c.split(':')[0]))
    if (lotes.size < 2 || italianos.size < 2 || texto in excepciones) continue
    divergentes.push(`«${texto}» → ${[...italianos].map(([it, c]) => `«${it}» (${c.join(', ')})`).join(' / ')}`)
  }
  return divergentes
}

// Los mismos de antes: si en ingles se dicen distinto a proposito es porque
// en cada pantalla significa otra cosa, y en italiano tambien. Lo que el
// italiano necesite aparte lo declara aqui su lote, con el porque.
const DISTINTOS_A_PROPOSITO_IT: Record<string, string> = {
  ...DISTINTOS_A_PROPOSITO,
  // Costura del italiano (2026-11-04): Space Eyes configura la pantalla DIGITAL
  // que vigila un dispositivo («Schermo»); el alta de inventario guarda el
  // punto de venta («Impianto»). Mismo criterio que «Pantalla» abajo.
  'Guardar pantalla': 'Space Eyes guarda la pantalla digital (Salva schermo); inventario guarda el impianto (Salva impianto), glosario del italiano',
  // Lote L3 (2026-11-03):
  Pantalla: 'la pantalla como punto de inventario, que puede ser un espectacular o una valla («Impianto», glosario del italiano) frente al articulo del almacen de tipo pantalla, un aparato electronico («Schermo»). En ingles las dos son «Screen». Lote L4: tambien «Schermo» en la columna de lo que se manda a DOOHmain e «Impianto» en reportes y captacion',
  // Costura del italiano tras juntar L4 (2026-11-04): el adjetivo concuerda
  // con el sustantivo que el espanol calla, y dos «comprobantes» que en
  // italiano son cosas distintas.
  'Ver todas ({n})': 'concordancia: campañas y cobranzas son femeninas («Mostra tutte»); las ordenes de trabajo, «ordini», masculinas («Mostra tutti»)',
  Activa: 'concordancia: la campaña es femenina («Attiva»); el estado de un dispositivo de Space Eyes, masculino («Attivo»)',
  Rechazada: 'concordancia: propuesta, creatividad y oferta son femeninas («Rifiutata»); la orden de trabajo, «ordine», masculina («Rifiutato»)',
  Rechazado: 'concordancia: la etapa de negociacion es masculina («Rifiutato»); la creatividad, femenina («Rifiutata»)',
  Aprobado: 'concordancia: importe y etapa masculinos («Approvato»); la creatividad, femenina («Approvata»)',
  Todas: 'concordancia: propuestas, femeninas («Tutte»); fallas («guasti») y ordenes de trabajo («ordini»), masculinas («Tutti»)',
  Vencidas: 'cobranzas vencidas son «Scadute»; ordenes de trabajo vencidas, «In ritardo» (glosario del lote L3)',
  'Comprobante de pago': 'finanzas: la prueba de pago que sube el cliente («Prova di pagamento», glosario); arrendadores: el recibo del pago que hicimos («Ricevuta di pagamento»)',
  Comprobante: 'el mismo caso que «Comprobante de pago»: prova del cliente frente a ricevuta del pago al locatore',
  // Lote L4 (2026-11-03).
  Vencida:
    'concuerda con lo que nombra: la cobranza es femenina («Scaduta») y la orden de trabajo de la ficha de campaña, en italiano «ordine», masculina («Scaduto»)',
  // Lote L2 (2026-11-03):
  Lista: 'la vista en lista del alta de propuestas, la alternativa al mapa («Elenco»), frente a la columna del precio de lista en el reparto de un paquete («Listino»); en ingles las dos son «List»',
  // Costura final (2026-11-04), tras juntar los cinco lotes:
  a: 'entre los dos campos de FECHA del selector de periodo va una raya («–»): «al» seria un articulo delante de una fecha, prohibido en todo el italiano; entre dos HORAS (DOOHmain, Space Eyes) va «alle», como en «dalle 6 alle 22»',
  'Sin asignar': 'concordancia: la razon social sin asignar, en el selector compartido y en la fila del reporte por razon social, es femenina («Non assegnata», «ragione sociale»); el responsable de una OT o de un creativo, masculino («Non assegnato», «responsabile»)',
  Automática: 'concordancia: la renovacion de un contrato de Comercial es «rinnovo», masculino («Automatico»); el modo de actualizacion de Administracion es «modalità», femenino («Automatica»)',
  Nuevo: 'el tipo de una entrada de las notas de version, una funcion nueva («Novità», como el rotulo del sector), frente a la opcion del asistente de contrato de Inventario que da de alta un locatore nuevo, masculino («Nuovo»)',
  '{n} nueva': 'las novedades de las notas de version («{n} novità», invariable) frente a las pantallas creadas por una carga de Inventario, que son impianti, masculino («{n} nuovo»)',
  '{n} nuevas': 'lo mismo que «{n} nueva», en plural («{n} novità» / «{n} nuovi»)',
}

function lotesItaliano(): LoteIt[] {
  const deAmbito = new Set(AMBITOS_ITALIANO.flatMap((a) => Object.keys(a.es)))
  const esBase = Object.fromEntries(
    Object.entries(DICCIONARIOS.es as Record<string, string>).filter(([k]) => !deAmbito.has(k)),
  )
  return [
    ['base', esBase, IT_PARCIAL as Partial<Record<string, string>>],
    ...AMBITOS_ITALIANO.map((a): LoteIt => [a.ambito, a.es, a.it]),
  ]
}

describe('costura del italiano · los lotes dicen lo mismo de la misma manera', () => {
  it('el mismo espanol en dos lotes lleva el mismo italiano (tolerando los vacios)', () => {
    expect(divergenciasItaliano(lotesItaliano(), DISTINTOS_A_PROPOSITO_IT)).toEqual([])
  })

  it('y muerde: con datos de muestra, una divergencia se ve y un vacio no cuenta', () => {
    const muestra: LoteIt[] = [
      ['a', { x: 'Guardar', y: 'Cerrar' }, { x: 'Salva', y: 'Chiudi' }],
      ['b', { x: 'Guardar', y: 'Cerrar' }, { x: 'Memorizza', y: '' }],
    ]
    expect(divergenciasItaliano(muestra, {})).toEqual(['«Guardar» → «Salva» (a:x) / «Memorizza» (b:x)'])
    expect(divergenciasItaliano(muestra, { Guardar: 'porque si' })).toEqual([])
  })

  it('el apostrofo italiano es el tipografico (’): «l’ordine», no «l\'ordine»', () => {
    const malas = Object.entries(IT_PARCIAL as Record<string, string>).filter(([, v]) => /[A-Za-zÀ-ú]'[A-Za-zÀ-ú]/.test(v))
    expect(malas.map(([k]) => k)).toEqual([])
  })

  // Regla de TODO el italiano (orquestador, validaciones de L1 y L3): la fecha
  // llega formateada («8 dic 2026», «11 nov») y un articulo delante tendria
  // que elidirse («l’8», «dall’11»), cosa que un hueco no sabe hacer. Cada
  // lote lo vigilaba en su propio diccionario; esta es la guardia de TODOS
  // juntos (costura final, 2026-11-04).
  const ARTICULO_ANTE_FECHA = /\b(il|al|dal|del|nel|sul|l’|all’|dall’|dell’) ?\{(fecha|fin|desde|inicio|hasta|vence)\}/

  it('nunca un articulo delante de una fecha, en NINGUN diccionario italiano', () => {
    const malas = Object.entries(IT_PARCIAL as Record<string, string>)
      .filter(([, v]) => escrita(v) && ARTICULO_ANTE_FECHA.test(v))
      .map(([k, v]) => `${k}: «${v}»`)
    expect(malas).toEqual([])
  })

  it('y la guardia de las fechas muerde: «dal {desde}» y «l’{fecha}» caen, «Da: {desde}» no', () => {
    expect(['Valido dal {desde}', 'Scade il {vence}', 'Inviata l’{fecha}', 'fino al {fin}'].filter((v) => !ARTICULO_ANTE_FECHA.test(v))).toEqual([])
    expect(['Da: {desde}', 'in data {fecha}', 'fino al giorno {fin}', '{desde} – {hasta}', 'il {nombre}'].filter((v) => ARTICULO_ANTE_FECHA.test(v))).toEqual([])
  })

  it('ningun texto italiano da por hecha la moneda (ADR 0048)', () => {
    const malas = Object.entries(IT_PARCIAL as Record<string, string>)
      .filter(([, v]) => {
        const t = v.replace(/\{\w+\}/g, '')
        return /\bpesos?\b|\bdollar[oi]\b|\beuro\b|\b(MXN|USD|EUR)\b/i.test(t)
      })
      .map(([k]) => k)
    expect(malas).toEqual([])
  })

  it('un texto que tambien manda el servidor se dice igual en el campo y en el error (si los dos tienen italiano)', () => {
    const ES_D = DICCIONARIOS.es as Record<string, string>
    const rellenar = (t: string) => t.replace(/\{\w+\}/g, '1000')
    const distintos = Object.entries(IT_PARCIAL as Record<string, string>)
      .filter(([k, v]) => escrita(v) && k in ES_D)
      .filter(([k]) => traducirError(rellenar(ES_D[k]), 'it') !== traducirError(rellenar(ES_D[k]), 'en'))
      .filter(([k, v]) => rellenar(v) !== traducirError(rellenar(ES_D[k]), 'it'))
      .map(([k]) => k)
    expect(distintos).toEqual([])
  })
})

// ============================================================================
//  LA COSTURA DEL PORTUGUES (2026-11-05).
// ----------------------------------------------------------------------------
//  La misma regla que el ingles y el italiano —el mismo espanol en dos lotes
//  se dice igual— sobre los cinco lotes del portugues juntos (L1 Space Eyes y
//  luz, L2 comercial, L3 inventario, L4 campanas, L5 armazon), que se
//  tradujeron en paralelo y cada uno solo vio su glosario y el comun (§2 bis
//  de `vault/03-Frontend/portugues-olas.md`). Con la cobertura completa ya no
//  hay vacios: se compara todo.
// ============================================================================

// Los del ingles valen (si en ingles se dicen distinto a proposito, en cada
// pantalla significa otra cosa). Los del italiano que son de CONCORDANCIA no
// se heredan: el genero portugues no es el italiano. Lo que el portugues
// necesita aparte va aqui, con el porque.
const DISTINTOS_A_PROPOSITO_PT: Record<string, string> = {
  ...DISTINTOS_A_PROPOSITO,
  // Glosario comun (§2 bis), como en italiano: el ponto de inventario frente a
  // la tela DIGITAL (DOOHmain, el articulo de almacen, Space Eyes).
  Pantalla: 'la pantalla como unidad de inventario, que puede ser un painel o un outdoor («Ponto», glosario comun) frente a la pantalla DIGITAL: la columna de lo que va a DOOHmain, el articulo «Pantalla» del almacen y la que vigila Space Eyes («Tela»)',
  'Guardar pantalla': 'Space Eyes guarda la tela digital que vigila («Salvar tela»); inventario guarda el ponto («Salvar ponto»)',
  Sitio: 'el ponto de inventario («Ponto») frente al lugar fisico donde esta un dispositivo de Space Eyes («Local», glosario aprobado por el dueno el 05/11)',
  Lista: 'la vista en lista del alta de propuestas, la alternativa al mapa («Lista»), frente al precio de lista en el reparto de un paquete («Tabela», de «preço de tabela»)',
  // Concordancia: el genero portugues de lo que el espanol calla.
  Fija: 'concordancia: en propuestas es el ponto, masculino («Fixo»); en inventario, la mídia, femenina («Fixa»)',
  Todas: 'concordancia: propostas, falhas y OS son femeninas («Todas»); en la Network son los pontos, masculino («Todos»)',
  Automática: 'concordancia: la renovacion de un contrato es femenina («Automática»); el modo de actualizacion de Administracion, «modo», masculino («Automático»)',
  'Sin asignar': 'la razon social sin asignar, femenina («Não atribuída»), frente al responsable de una OS, que no hay («Sem responsável»)',
  '— Sin asignar —': 'el locador de un ponto, masculino, sin elegir («— Não atribuído —») frente a la OS nueva sin responsable («— Sem responsável —»)',
  Vencida: 'la cobranza vencida («Vencida») frente a la OS fuera de plazo («Atrasada», glosario comun: OT vencida → OS atrasada)',
  Vencidas: 'lo mismo que «Vencida», en plural: cobranzas «Vencidas», OS «Atrasadas»',
  // Formas de la frase.
  // Validacion de la costura (H3): dos claves de horas de DOOHmain decian
  // «a»; desde entonces TODAS las de horas dicen «às» (lo fija la prueba
  // «entre dos horas» de abajo, con su lista `ENTRE_HORAS`).
  a: 'entre dos FECHAS va «a» (el selector de periodo: «1 de dez. a 5 de dez.»); entre dos HORAS va «às» («De 06:00 às 22:00»: el horario individual de DOOHmain en la ficha de campaña y el editor de Space Eyes), como el italiano «–»/«alle»',
  '{desde} a {hasta}': 'lo mismo que «a»: un rango de FECHAS («{desde} a {hasta}», periodo, playlogs, revision del contrato) frente a un rango de HORAS de DOOHmain («{desde} às {hasta}»)',
  Siguiente: 'el boton de un asistente por pasos («Avançar», el de las interfaces brasileñas) frente a la pagina o la foto siguiente («Próxima»)',
  Fin: 'el termino de un CONTRATO de locacion («Término», como lo dice el contrato) frente al fin de una reserva, junto a «Início» («Fim»)',
  Operación: 'la familia de ajustes que lleva al modulo («Operações», como el menu) frente al costo de operar un ponto («Operação»)',
  No: 'en las instrucciones del Raspberry Pi Imager el boton se llama «No» (la herramienta esta en ingles: se cita tal cual, revision del L1); en las demas, la respuesta «Não»',
  Teléfono: 'el aparato que se da de alta en Space Eyes es un celular («Celular»); en los demas es el numero de contacto («Telefone»)',
  '{n} nueva': 'las novedades de las notas de version («{n} novidade», sustantivo) frente a los pontos creados por una carga de Inventario, masculino («{n} novo»)',
  '{n} nuevas': 'lo mismo que «{n} nueva», en plural («{n} novidades» / «{n} novos»)',
}

function lotesPortugues(): LoteIt[] {
  const deAmbito = new Set(AMBITOS_PORTUGUES.flatMap((a) => Object.keys(a.es)))
  const esBase = Object.fromEntries(
    Object.entries(DICCIONARIOS.es as Record<string, string>).filter(([k]) => !deAmbito.has(k)),
  )
  return [
    ['base', esBase, PT_PARCIAL as Partial<Record<string, string>>],
    ...AMBITOS_PORTUGUES.map((a): LoteIt => [a.ambito, a.es, a.pt]),
  ]
}

describe('costura del portugues · los lotes dicen lo mismo de la misma manera', () => {
  it('el mismo espanol en dos lotes lleva el mismo portugues (salvo los declarados)', () => {
    expect(divergenciasItaliano(lotesPortugues(), DISTINTOS_A_PROPOSITO_PT)).toEqual([])
  })

  it('las excepciones propias del portugues siguen existiendo y siguen divergiendo', () => {
    const propias = Object.keys(DISTINTOS_A_PROPOSITO_PT).filter((t) => !(t in DISTINTOS_A_PROPOSITO))
    const sinExcepcion = divergenciasItaliano(lotesPortugues(), {})
    expect(propias.filter((t) => !sinExcepcion.some((d) => d.startsWith(`«${t}» →`)))).toEqual([])
  })

  it('las comillas portuguesas son las curvas “ ”, nunca « » ni rectas que abren', () => {
    const malas = Object.entries(PT_PARCIAL as Record<string, string>).filter(([, v]) => /[«»]|(^|[\s(])"/.test(v))
    expect(malas.map(([k]) => k)).toEqual([])
  })

  // «peso» que no es dinero, en portugues (el grosor de la letra, como en
  // espanol). Y sin «reais» suelto: «dispositivos reais» son los de verdad.
  const PESO_QUE_NO_ES_DINERO_PT = ['peso da fonte']
  it('ningun texto portugues da por hecha la moneda (ADR 0048)', () => {
    const malas = Object.entries(PT_PARCIAL as Record<string, string>)
      .filter(([, v]) => {
        let t = v.replace(/\{\w+\}/g, '')
        for (const f of PESO_QUE_NO_ES_DINERO_PT) t = t.replace(new RegExp(f, 'gi'), '')
        return /\bpesos?\b|\bd[óo]lar(es)?\b|\b(MXN|USD|BRL)\b|R\$|\d\s*reais\b/i.test(t)
      })
      .map(([k]) => k)
    expect(malas).toEqual([])
    expect(PESO_QUE_NO_ES_DINERO_PT.filter((f) => /\bpesos\b|centav|preço|valor/i.test(f))).toEqual([])
  })

  // Validacion de la costura (H1, H2): la comparacion de arriba solo ve el
  // MISMO espanol. «Tarifa publicada ({unidad})» no es «Tarifa publicada», y
  // el titulo «Grade de programação» convivia con «horário de exibição» en el
  // mismo panel. Por PALABRA del glosario: si el espanol dice el termino, el
  // portugues dice el suyo, y el termino descartado no sale en ningun sitio.
  const GLOSARIO_POR_PALABRA: Array<[string, RegExp, RegExp, RegExp]> = [
    ['tarifa publicada / de lista → tarifa / preço de tabela', /tarifa publicada|tarifa de lista|precio de lista/i, /\bde tabela\b/i, /tarifa publicada/i],
    ['horario de transmisión → grade de programação', /horario de transmisi[óo]n/i, /grade de programação/i, /horário de (exibição|veiculação|transmissão)/i],
  ]
  it('el glosario por PALABRA: el termino del espanol lleva el suyo, y el descartado no sale', () => {
    const ES_D = DICCIONARIOS.es as Record<string, string>
    const malas: string[] = []
    for (const [k, v] of Object.entries(PT_PARCIAL as Record<string, string>)) {
      for (const [nombre, es, pt, descartado] of GLOSARIO_POR_PALABRA) {
        if (es.test(ES_D[k] ?? '') && !pt.test(v)) malas.push(`${k} · ${nombre}: «${v}»`)
        if (descartado.test(v)) malas.push(`${k} · descartado (${nombre}): «${v}»`)
      }
    }
    expect(malas).toEqual([])
  })

  // H3: entre dos HORAS va siempre «às» (DOOHmain en la ficha y en la
  // programacion, Space Eyes); entre dos FECHAS, «a» (ver `a` arriba).
  const ENTRE_HORAS = ['campanas.doohmain.horario.a', 'campanas.comun.rango-horas', 'compartidos.doohmain.horario', 'spaceeyes.pconfig.editor.a']
  it('entre dos horas, «às», en todas las claves de rango horario', () => {
    const PT = PT_PARCIAL as Record<string, string>
    expect(ENTRE_HORAS.filter((k) => !/(^|[\s}])às($|[\s{])/.test(PT[k] ?? ''))).toEqual([])
  })

  it('«Ex.:» para un ejemplo (glosario del L2), nunca «p. ex.»', () => {
    const malas = Object.entries(PT_PARCIAL as Record<string, string>).filter(([, v]) => /\bp\. ?ex\./i.test(v))
    expect(malas.map(([k]) => k)).toEqual([])
  })

  it('un texto que tambien manda el servidor se dice igual en el campo y en el error', () => {
    const ES_D = DICCIONARIOS.es as Record<string, string>
    const rellenar = (t: string) => t.replace(/\{\w+\}/g, '1000')
    const conocidas = Object.keys(ES_D).filter((k) => traducirError(rellenar(ES_D[k]), 'pt') !== rellenar(ES_D[k]))
    const distintos = conocidas
      .filter((k) => !CALCULADORA_DIVERGE_PT.includes(k))
      .filter((k) => rellenar((PT_PARCIAL as Record<string, string>)[k]) !== traducirError(rellenar(ES_D[k]), 'pt'))
      .map((k) => `${k}: «${rellenar((PT_PARCIAL as Record<string, string>)[k])}» / servidor «${traducirError(rellenar(ES_D[k]), 'pt')}»`)
    expect(distintos).toEqual([])
    expect(conocidas.length).toBeGreaterThanOrEqual(10)
  })
})

// Lo mismo que en ingles: `rellenar` pone 1000 en el hueco y el servidor elige
// con razon la forma plural del singular de «pocos libres».
const CALCULADORA_DIVERGE_PT = ['compartidos.calc.motivo.pocos-libres.uno']
