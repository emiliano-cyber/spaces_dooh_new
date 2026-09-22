import { describe, it, expect } from 'vitest'
import {
  RANGO_DE_APERTURA,
  RUTA_CONSUMOS,
  construirConsulta,
  etiquetaDeMes,
  filasDelTablero,
  motivoInvalido,
  motivoInvalidoDelRecibo,
  resumenDeCobertura,
  rutaDeBorrado,
  textoDeConfirmacionDeBorrado,
  vistaDeCaptura,
  type TableroUI,
} from './captura'

// ============================================================================
//  La pantalla de captura, y lo único que la hace distinta: ENSEÑA LO QUE FALTA.
// ----------------------------------------------------------------------------
//  Una lista de recibos capturados deja invisible el mes que nadie tecleó, y ese
//  mes no da error en ningún sitio: sale como un costo de luz de CERO en el
//  reporte de rentabilidad, indistinguible de una pantalla que no gasta luz.
//
//  Por eso lo que se prueba aquí es sobre todo el HUECO: que se pinte, que se
//  cuente, y que no se confunda con un consumo de cero.
//
//  Y está aquí, fuera del `.tsx`, porque `vitest.config.ts` no monta jsdom a
//  propósito: una decisión escrita dentro de un componente no la prueba nadie.
// ============================================================================

const PUNTOS = [
  { clave: 'P:p1', tipo: 'predio' as const, id: 'p1', nombre: 'Predio Norte', pantallas: 3 },
  { clave: 'S:s9', tipo: 'pantalla' as const, id: 's9', nombre: 'Valla Suelta', pantallas: 1 },
]

function tablero(over: Partial<TableroUI> = {}): TableroUI {
  return {
    desde: '2026-01-01',
    hasta: '2026-03-31',
    meses: ['2026-01-01', '2026-02-01', '2026-03-01'],
    puntos: PUNTOS,
    celdas: [
      { punto: 'P:p1', mes: '2026-01', recibos: [] },
      { punto: 'P:p1', mes: '2026-02', recibos: [recibo('r1')] },
      { punto: 'P:p1', mes: '2026-03', recibos: [] },
      { punto: 'S:s9', mes: '2026-01', recibos: [recibo('r2')] },
      { punto: 'S:s9', mes: '2026-02', recibos: [recibo('r3'), recibo('r4', 'M-2')] },
      { punto: 'S:s9', mes: '2026-03', recibos: [] },
    ],
    esperados: 6,
    faltantes: 3,
    huerfanos: [],
    ...over,
  }
}

function recibo(id: string, medidor: string | null = 'M-1') {
  return {
    id,
    predioId: null,
    sitioId: null,
    periodo: '2026-02-01',
    medidor,
    kwh: 1500,
    importe: 3000,
    notas: null,
    creadoEn: '2026-02-05',
  }
}

describe('1 · la ruta del endpoint', () => {
  it('lleva el basePath y la barra final', () => {
    // `next.config.mjs` declara `basePath: '/spaces-dooh'` y
    // `trailingSlash: true`. Escrita como `/api/energia/...`, la petición sale
    // del navegador hacia el ORIGEN y lo que vuelve NO es un error de red: es el
    // 404 de Next con cuerpo HTML, que la pantalla pintaría como «no se pudo
    // cargar» sin decir nada de la causa. Ya pasó en la pantalla de reportes.
    expect(RUTA_CONSUMOS).toBe('/spaces-dooh/api/energia/consumos/')
    expect(rutaDeBorrado('abc')).toBe('/spaces-dooh/api/energia/consumos/abc/')
  })

  it('manda los dos parametros y ninguno mas', () => {
    // El schema del controller es `.strict()`: un parámetro de más da 400 en vez
    // de ignorarse, y un `tenantId` colado aquí tumbaría la pantalla entera.
    const url = new URL(construirConsulta({ desde: '2026-01-01', hasta: '2026-03-31' }), 'https://x.test')
    expect([...url.searchParams.keys()].sort()).toEqual(['desde', 'hasta'])
  })

  it('escapa los valores en vez de pegarlos', () => {
    const url = new URL(
      construirConsulta({ desde: '2026-01-01&hasta=2030-01-01', hasta: '2026-03-31' }),
      'https://x.test',
    )
    expect(url.searchParams.getAll('hasta')).toHaveLength(1)
    expect(url.searchParams.get('hasta')).toBe('2026-03-31')
  })
})

describe('2 · con que rango abre', () => {
  it('abre en los SEIS ultimos meses, terminando en el mes en curso', () => {
    // Quien usa esto tiene un recibo en la mano, casi siempre del mes pasado.
    // Seis meses es lo que cabe de columnas sin encoger la tabla, y alcanza para
    // ver de un vistazo si hay un hueco viejo sin rellenar.
    //
    // El mes EN CURSO entra aunque casi nunca tenga recibo todavía: si no
    // estuviera, el recibo que llega el día 3 no tendría dónde capturarse y
    // habría que mover el rango a mano para teclear lo más reciente.
    expect(RANGO_DE_APERTURA(new Date(2026, 8, 18))).toEqual({
      desde: '2026-04-01',
      hasta: '2026-09-30',
    })
  })

  it('cruza el anio sin inventar meses', () => {
    // `mes - 5` sin cruzar el año daría meses negativos y un rango imposible.
    expect(RANGO_DE_APERTURA(new Date(2026, 1, 10))).toEqual({
      desde: '2025-09-01',
      hasta: '2026-02-28',
    })
  })

  it('se construye con las partes LOCALES de la fecha', () => {
    // Con `toISOString()`, el día 1 a medianoche en México (UTC−6) sale como el
    // último día del mes anterior y el rango entero se corre un mes. Es la misma
    // trampa que ya se pagó en `diasHasta` (`derive.ts`). El 1 de enero es el
    // caso que lo destapa.
    expect(RANGO_DE_APERTURA(new Date(2026, 0, 1)).hasta).toBe('2026-01-31')
  })
})

describe('3 · la REJILLA: cada punto con sus meses, y sus huecos', () => {
  it('una fila por punto, y una celda por mes EN ORDEN', () => {
    const filas = filasDelTablero(tablero())
    expect(filas.map((f) => f.punto.nombre)).toEqual(['Predio Norte', 'Valla Suelta'])
    expect(filas[0].celdas.map((c) => c.mes)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('la celda SIN recibo se marca como hueco, y no como un consumo de cero', () => {
    // LA DISTINCIÓN QUE JUSTIFICA LA PANTALLA. Un hueco pintado como «$0.00»
    // afirma que ese mes no se gastó luz, y es lo contrario de lo que pasa: no
    // se sabe. Es el hallazgo C1 de la auditoría QA otra vez.
    const filas = filasDelTablero(tablero())
    const enero = filas[0].celdas[0]
    expect(enero.hueco).toBe(true)
    expect(enero.importe).toBeNull()
    expect(enero.kwh).toBeNull()

    const febrero = filas[0].celdas[1]
    expect(febrero.hueco).toBe(false)
    expect(febrero.importe).toBe(3000)
  })

  it('un punto con DOS medidores en un mes suma los dos, y dice cuantos son', () => {
    // Un predio puede tener más de un medidor y los dos recibos son de verdad:
    // por eso la unicidad de la base lleva el medidor dentro. La celda tiene que
    // enseñar el total y no esconder que son dos.
    const febrero = filasDelTablero(tablero())[1].celdas[1]
    expect(febrero.recibos).toHaveLength(2)
    expect(febrero.importe).toBe(6000)
    expect(febrero.kwh).toBe(3000)
  })

  it('cuenta los huecos POR FILA, para saber a quien perseguir', () => {
    const filas = filasDelTablero(tablero())
    expect(filas[0].huecos).toBe(2)
    expect(filas[1].huecos).toBe(1)
  })

  it('un punto sin NINGUNA celda no revienta ni desaparece', () => {
    // Defensivo a propósito: la rejilla la arma el servidor y la pantalla no
    // puede suponer que viene completa. Una fila que desapareciera en silencio
    // es justo lo que esta pantalla existe para no hacer.
    const filas = filasDelTablero(tablero({ celdas: [] }))
    expect(filas).toHaveLength(2)
    expect(filas[0].celdas.map((c) => c.hueco)).toEqual([true, true, true])
    expect(filas[0].huecos).toBe(3)
  })
})

describe('4 · el resumen dice la verdad, tambien cuando no falta nada', () => {
  it('con huecos, los cuenta y dice que el reporte va a mentir', () => {
    const t = resumenDeCobertura(tablero())
    expect(t.tono).toBe('alerta')
    expect(t.texto).toMatch(/3 de 6/)
  })

  it('SIN huecos lo dice igual, en vez de callarse', () => {
    // «No falta ninguno» y «no te lo digo» se ven idénticos si no hay texto.
    const t = resumenDeCobertura(tablero({ faltantes: 0 }))
    expect(t.tono).toBe('ok')
    expect(t.texto).toMatch(/complet[ao]|no falta/i)
  })

  it('sin PUNTOS de medicion no dice «esta completo»: dice que no hay donde', () => {
    // Con cero predios y cero pantallas sueltas, `faltantes` es 0 y un texto
    // ingenuo felicitaría por tener la captura al día sobre un inventario vacío.
    const t = resumenDeCobertura(tablero({ puntos: [], celdas: [], esperados: 0, faltantes: 0 }))
    expect(t.tono).toBe('info')
    expect(t.texto).not.toMatch(/complet[ao]/i)
  })

  it('los recibos HUERFANOS se dicen aparte, con su importe', () => {
    // Están capturados y su dinero NO llega a ninguna fila del reporte, porque
    // su predio se quedó sin pantallas. Sin esta frase desaparecen sin error.
    const t = resumenDeCobertura(tablero({ huerfanos: [recibo('h1')] }))
    expect(t.huerfanos).toMatch(/1 recibo/)
    expect(t.huerfanos).toMatch(/3,000|3000/)
  })

  it('sin huerfanos no se inventa una frase vacia', () => {
    expect(resumenDeCobertura(tablero()).huerfanos).toBe('')
  })
})

describe('5 · el mes se pinta en español y sin correrse de mes', () => {
  it('«2026-02» es febrero de 2026', () => {
    expect(etiquetaDeMes('2026-02')).toMatch(/feb/i)
    expect(etiquetaDeMes('2026-02')).toMatch(/2026/)
  })

  it('enero NO se pinta como diciembre del anio anterior', () => {
    // `new Date('2026-01')` se interpreta como UTC y en México cae en diciembre.
    // Es el mismo error de zona que este repo ya pagó dos veces.
    expect(etiquetaDeMes('2026-01')).toMatch(/ene/i)
    expect(etiquetaDeMes('2026-01')).toMatch(/2026/)
    expect(etiquetaDeMes('2026-01')).not.toMatch(/dic|2025/i)
  })
})

describe('6 · lo que se rechaza ANTES de mandar', () => {
  it('el rango invertido se detecta por CALENDARIO, no como texto', () => {
    // '2026-9-1' va DESPUÉS de '2026-10-01' como cadena y antes en el
    // calendario. Ese defecto ya se pagó dos veces en este repo.
    expect(motivoInvalido({ desde: '2026-10-01', hasta: '2026-9-1' })).toBeTruthy()
    expect(motivoInvalido({ desde: '2026-9-1', hasta: '2026-10-01' })).toBeNull()
  })

  it('un rango vacio o mal escrito se avisa antes de pedir', () => {
    expect(motivoInvalido({ desde: '', hasta: '2026-03-31' })).toBeTruthy()
    expect(motivoInvalido({ desde: 'ayer', hasta: '2026-03-31' })).toBeTruthy()
  })

  const base = { punto: 'P:p1', periodo: '2026-02', kwh: '1500', importe: '3000' }

  it('el recibo completo pasa', () => {
    expect(motivoInvalidoDelRecibo(base, new Date(2026, 8, 18))).toBeNull()
  })

  it('sin punto de medicion no se puede capturar', () => {
    expect(motivoInvalidoDelRecibo({ ...base, punto: '' }, new Date(2026, 8, 18))).toBeTruthy()
  })

  it('el importe y los kWh son OBLIGATORIOS, y el cero vale', () => {
    // NOT NULL los dos en la base: un recibo trae siempre las dos cifras. Pero
    // el CERO es un dato válido —un medidor que no giró— y rechazarlo obligaría
    // a inventar un número.
    expect(motivoInvalidoDelRecibo({ ...base, importe: '' }, new Date(2026, 8, 18))).toBeTruthy()
    expect(motivoInvalidoDelRecibo({ ...base, kwh: '' }, new Date(2026, 8, 18))).toBeTruthy()
    expect(motivoInvalidoDelRecibo({ ...base, kwh: '0', importe: '0' }, new Date(2026, 8, 18))).toBeNull()
  })

  it('NEGATIVO: ni importe ni kWh negativos', () => {
    // Un importe negativo es una nota de crédito, no un consumo: RESTARÍA costo
    // y mejoraría el margen sin que nada lo dijera. El CHECK de la base lo corta
    // igual, pero con un mensaje que no dice qué hacer.
    expect(motivoInvalidoDelRecibo({ ...base, importe: '-500' }, new Date(2026, 8, 18))).toBeTruthy()
    expect(motivoInvalidoDelRecibo({ ...base, kwh: '-1' }, new Date(2026, 8, 18))).toBeTruthy()
  })

  it('NEGATIVO: un importe que no es un numero', () => {
    expect(motivoInvalidoDelRecibo({ ...base, importe: 'tres mil' }, new Date(2026, 8, 18))).toBeTruthy()
  })

  it('NEGATIVO: un recibo de un mes que todavia no termina', () => {
    // Casi siempre es un año mal tecleado, y su efecto no se ve: entra en un
    // periodo que nadie mira y aparece meses después inflando un mes que ya se
    // daba por cerrado.
    expect(motivoInvalidoDelRecibo({ ...base, periodo: '2027-01' }, new Date(2026, 8, 18))).toBeTruthy()
    // El mes EN CURSO sí vale: un recibo puede llegar a mitad de mes.
    expect(motivoInvalidoDelRecibo({ ...base, periodo: '2026-09' }, new Date(2026, 8, 18))).toBeNull()
  })
})

// ============================================================================
//  B33 · Un fallo AL BORRAR no puede llevarse la rejilla por delante.
// ----------------------------------------------------------------------------
//  Operaciones puede `ver` y `crear` consumos, pero borrar exige `aprobar`
//  (`app/api/energia/consumos/[id]/route.ts:24`). El 403 que sale de ahí no
//  dice nada de la carga: el tablero ya está en memoria y está intacto. Pintar
//  «No se pudo cargar la captura» y vaciar la tabla es AFIRMAR algo falso —la
//  carga sí funcionó— y además esconde el dato que la persona estaba mirando.
//
//  Por eso el estado del borrado va SEPARADO del estado de la carga, y esta
//  prueba es la que lo sujeta: es la misma familia que B26, la de los errores
//  que mienten en silencio.
// ============================================================================
describe('vistaDeCaptura', () => {
  const lleno = tablero()

  it('NEGATIVO: un fallo al BORRAR deja la rejilla en pie', () => {
    // El corazón de B33. Si esto se pone en verde devolviendo 'error-carga',
    // la pantalla volvió a mentir.
    expect(
      vistaDeCaptura({
        cargando: false,
        errorCarga: null,
        errorBorrado: 'No tienes permiso para borrar recibos.',
        motivo: null,
        tablero: lleno,
      }),
    ).toBe('rejilla')
  })

  it('un fallo al CARGAR sí tapa la rejilla: no hay nada fiable que enseñar', () => {
    expect(
      vistaDeCaptura({
        cargando: false,
        errorCarga: 'No se pudo cargar la captura de consumos',
        errorBorrado: null,
        motivo: null,
        tablero: lleno,
      }),
    ).toBe('error-carga')
  })

  it('cargando gana a todo: enseñar datos viejos mientras llegan los nuevos es mentir a medias', () => {
    expect(
      vistaDeCaptura({
        cargando: true,
        errorCarga: 'lo que sea',
        errorBorrado: 'lo que sea',
        motivo: null,
        tablero: lleno,
      }),
    ).toBe('cargando')
  })

  it('un periodo invalido se dice como tal, y no como un fallo del servidor', () => {
    expect(
      vistaDeCaptura({
        cargando: false,
        errorCarga: null,
        errorBorrado: null,
        motivo: 'La fecha de inicio va despues de la final.',
        tablero: lleno,
      }),
    ).toBe('periodo-invalido')
  })

  it('sin puntos de medicion se dice POR QUE esta vacio', () => {
    expect(
      vistaDeCaptura({
        cargando: false,
        errorCarga: null,
        errorBorrado: null,
        motivo: null,
        tablero: tablero({ puntos: [], celdas: [] }),
      }),
    ).toBe('sin-puntos')
  })

  it('sin tablero todavia no se pinta nada', () => {
    expect(
      vistaDeCaptura({
        cargando: false,
        errorCarga: null,
        errorBorrado: null,
        motivo: null,
        tablero: null,
      }),
    ).toBe('nada')
  })
})

// ============================================================================
//  B32 · Borrar un recibo pide confirmación, y la confirmación DICE QUÉ se va.
// ----------------------------------------------------------------------------
//  El botón era un icono sin texto y borraba al primer clic. El manual de
//  usuario afirmaba lo contrario («El sistema te pide confirmar»), así que una
//  de las dos cosas estaba mal; se corrige la que deja un borrado irreversible
//  a un clic de distancia.
//
//  Y el texto no dice «¿seguro?»: nombra el recibo y dice la consecuencia real,
//  que no es «se pierde un dato» sino que ese mes vuelve a ser un HUECO y el
//  reporte de rentabilidad enseñará un costo de luz menor del real.
// ============================================================================
describe('textoDeConfirmacionDeBorrado', () => {
  const recibo = {
    id: 'r1',
    predioId: 'p1',
    sitioId: null,
    periodo: '2026-02-01',
    medidor: 'M-4471',
    kwh: 1200,
    importe: 8450,
    notas: null,
    creadoEn: '2026-03-01T00:00:00.000Z',
  }

  it('nombra el medidor, el mes y el importe: sin eso no se puede decidir', () => {
    const t = textoDeConfirmacionDeBorrado(recibo)
    expect(t).toContain('M-4471')
    expect(t).toContain('feb')
    expect(t).toContain('2026')
    expect(t).toMatch(/8,450/)
  })

  it('dice la consecuencia de verdad: ese mes vuelve a contar como un hueco', () => {
    expect(textoDeConfirmacionDeBorrado(recibo)).toMatch(/hueco/i)
  })

  it('un recibo sin numero de medidor se nombra igual, y no como «null»', () => {
    const t = textoDeConfirmacionDeBorrado({ ...recibo, medidor: null })
    expect(t).toContain('sin número')
    expect(t).not.toMatch(/null/)
  })
})
