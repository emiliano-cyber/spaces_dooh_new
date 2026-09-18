import { describe, it, expect } from 'vitest'
import {
  DIMENSIONES_UI,
  GRANULARIDADES_UI,
  RUTA_RENTABILIDAD,
  RANGO_DE_APERTURA,
  avanceDelTrimestreEnCurso,
  construirConsulta,
  filtrosDesdeUrl,
  motivoInvalido,
  rangoDelTrimestreCerradoDe,
  rangoDelTrimestreDe,
  solapaTrimestreEnCurso,
  sustantivoFila,
  type FiltrosReporte,
} from './consulta'

// ============================================================================
//  La construccion de la peticion y la validacion previa del rango.
// ----------------------------------------------------------------------------
//  Todo esto vive fuera del `.tsx` a proposito: `vitest.config.ts` no monta
//  jsdom, asi que una decision escrita dentro del componente no la prueba
//  nadie. Es el mismo motivo por el que la compuerta del shell salio a
//  `compuerta.ts` — y ahi aparecieron nueve casos en rojo.
// ============================================================================

const base: FiltrosReporte = {
  dimension: 'sitio',
  granularidad: 'mes',
  desde: '2026-01-01',
  hasta: '2026-03-31',
}

describe('1 · la pantalla pide sus numeros al endpoint, no al store', () => {
  it('apunta al endpoint de rentabilidad y no a /api/estado', () => {
    // Si esto cambiara a /api/estado, la pantalla volveria al camino que ya
    // reventó una vez: 6.12 MB y pantalla en blanco de 6 a 12 segundos.
    expect(RUTA_RENTABILIDAD).toContain('/api/reportes/rentabilidad')
    expect(RUTA_RENTABILIDAD).not.toContain('/api/estado')
  })

  it('lleva el basePath y la barra final, o el fetch cae en el 404 de Next', () => {
    // `next.config.mjs:126-127` declara `basePath: '/spaces-dooh'` y
    // `trailingSlash: true`. Una ruta escrita como '/api/...' desde el
    // navegador sale al ORIGEN, no a la app, y el sintoma no es un error de
    // red: es un 404 con cuerpo HTML que la pantalla pinta como «no se pudo
    // calcular el reporte». Es la misma forma que ya usan `estado-api.ts` y
    // `OrganizacionesPanel.tsx`.
    expect(RUTA_RENTABILIDAD).toBe('/spaces-dooh/api/reportes/rentabilidad/')
    expect(construirConsulta(base).startsWith('/spaces-dooh/api/reportes/rentabilidad/?')).toBe(true)
  })

  it('manda EXACTAMENTE los cuatro parametros que el schema admite, ni uno mas', () => {
    // El schema del controller es `.strict()`: un parametro de mas es un 400,
    // no un campo ignorado. Un `tenantId` colado aqui tumbaria la pantalla
    // entera, y el tenant sale SIEMPRE de la sesion.
    const url = new URL(construirConsulta(base), 'https://ejemplo.test')
    expect([...url.searchParams.keys()].sort()).toEqual(['desde', 'dimension', 'granularidad', 'hasta'])
  })

  it('los valores viajan tal cual los valida el zod del controller', () => {
    const url = new URL(construirConsulta(base), 'https://ejemplo.test')
    expect(url.searchParams.get('dimension')).toBe('sitio')
    expect(url.searchParams.get('granularidad')).toBe('mes')
    expect(url.searchParams.get('desde')).toBe('2026-01-01')
    expect(url.searchParams.get('hasta')).toBe('2026-03-31')
  })

  it('escapa lo que se le pase, aunque el selector solo ofrezca enums', () => {
    // El selector ofrece enums cerrados, pero la funcion no puede suponerlo:
    // concatenar sin escapar es como se cuela un `&` en una querystring.
    const sucio = construirConsulta({ ...base, desde: '2026-01-01&dimension=m2' })
    const url = new URL(sucio, 'https://ejemplo.test')
    expect(url.searchParams.get('dimension')).toBe('sitio')
    expect(url.searchParams.getAll('dimension')).toHaveLength(1)
  })
})

describe('2 · las dimensiones del contrato estan declaradas', () => {
  it('declara las cinco, en el mismo orden del contrato', () => {
    // `luz` entra el 2026-09-18 con el consumo electrico, y es la quinta.
    expect(DIMENSIONES_UI.map((d) => d.valor)).toEqual([
      'sitio', 'trimestre', 'operacion', 'm2', 'luz',
    ])
  })

  it('NINGUNA se ofrece «en preparacion»: las cuatro calculan', () => {
    // EL DEFECTO, visto en el navegador el 2026-09-18. La pantalla nacio el 17
    // con tres dimensiones devolviendo 501, y en la ola 2 se cerraron las tres
    // — pero nadie quito la etiqueta. El desplegable ofrecia «Por trimestre (en
    // preparacion)» y al elegirla calculaba perfectamente: el selector mentia
    // sobre su propia aplicacion, y ni el typecheck ni las unitarias lo vieron
    // porque una etiqueta no rompe nada.
    for (const d of DIMENSIONES_UI) {
      expect(d.label, d.valor).not.toMatch(/prepara/i)
      expect('conMotor' in d, d.valor).toBe(false)
    }
  })

  it('cada dimension tiene etiqueta en español y ninguna se llama como su clave', () => {
    for (const d of DIMENSIONES_UI) {
      expect(d.label.length, d.valor).toBeGreaterThan(2)
      expect(d.label).not.toBe(d.valor)
    }
  })

  it('`sustantivoFila` dice QUE es una fila en cada dimension', () => {
    // La cabecera decia «N pantallas con movimiento» en TODA dimension, y en
    // trimestral las filas son trimestres. Es el mismo defecto que el
    // encabezado «PANTALLA» de la primera columna, en otro sitio de la pantalla.
    expect(sustantivoFila('sitio')).toEqual({ singular: 'pantalla', plural: 'pantallas' })
    expect(sustantivoFila('operacion')).toEqual({ singular: 'pantalla', plural: 'pantallas' })
    expect(sustantivoFila('m2')).toEqual({ singular: 'pantalla', plural: 'pantallas' })
    expect(sustantivoFila('trimestre')).toEqual({ singular: 'trimestre', plural: 'trimestres' })
  })

  it('las granularidades son solo `mes` y `trimestre`', () => {
    // `dia` y `semana` existen en `Granularidad` para la grafica de ocupacion y
    // NO valen aqui: una rentabilidad por dia sobre años de historia es la
    // consulta sin limite que este endpoint viene a evitar.
    expect(GRANULARIDADES_UI.map((g) => g.valor)).toEqual(['mes', 'trimestre'])
  })
})

describe('3 · el rango se valida ANTES de pedir', () => {
  it('un rango correcto no tiene motivo', () => {
    expect(motivoInvalido(base)).toBeNull()
  })

  it('el mismo dia es un rango valido: las fechas son inclusive', () => {
    expect(motivoInvalido({ ...base, desde: '2026-02-10', hasta: '2026-02-10' })).toBeNull()
  })

  it('sin fecha de inicio lo dice, y nombra el inicio', () => {
    expect(motivoInvalido({ ...base, desde: '' })).toMatch(/inicio/i)
  })

  it('sin fecha de fin lo dice, y nombra el fin', () => {
    expect(motivoInvalido({ ...base, hasta: '   ' })).toMatch(/fin/i)
  })

  it('un rango invertido se rechaza por CALENDARIO, no comparando texto', () => {
    // Este es el caso que ya se pago dos veces en el repo. Como texto,
    // '2026-9-1' va DESPUES de '2026-10-01'; en el calendario va antes.
    expect(motivoInvalido({ ...base, desde: '2026-10-01', hasta: '2026-9-1' })).toMatch(/anterior/i)
  })

  it('y el mismo par al reves SI es valido — una comparacion de texto lo rechazaria', () => {
    expect(motivoInvalido({ ...base, desde: '2026-9-1', hasta: '2026-10-01' })).toBeNull()
  })

  it('texto libre que no es fecha se rechaza en vez de mandarse al servidor', () => {
    expect(motivoInvalido({ ...base, desde: 'mañana' })).toMatch(/AAAA-MM-DD/)
  })
})

describe('4 · el rango que se propone al abrir: EL TRIMESTRE EN CURSO', () => {
  it('abre en el trimestre EN CURSO, por decision del dueño del 2026-09-18', () => {
    // OJO AL LEER ESTO: el trimestre en curso abre a medias y por eso se lee
    // peor de lo que es —la renta corre desde el dia 1 y lo vendido se cobra al
    // cerrar—. Eso NO es un defecto pendiente: se le pregunto al dueño con las
    // tres opciones y sus consecuencias, y eligio ver el trimestre VIVO al
    // abrir. El precio de esa eleccion se paga con el aviso de periodo
    // incompleto (`avisosDelReporte`, clave `periodo-en-curso`), no cambiando
    // esta linea.
    expect(RANGO_DE_APERTURA(new Date(2026, 8, 18))).toEqual({ desde: '2026-07-01', hasta: '2026-09-30' })
    expect(RANGO_DE_APERTURA(new Date(2026, 1, 15))).toEqual({ desde: '2026-01-01', hasta: '2026-03-31' })
    expect(RANGO_DE_APERTURA(new Date(2026, 11, 1))).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' })
  })

  it('el CERRADO se conserva entero, porque la decision puede volver a cambiar', () => {
    // No se borra al dejar de ser el de apertura: volver a abrir en el ultimo
    // trimestre completo es cambiar `RANGO_DE_APERTURA` a esta funcion, y su
    // caso del cruce de año es el que nadie escribe a mano.
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 8, 18))).toEqual({ desde: '2026-04-01', hasta: '2026-06-30' })
  })

  it('el cerrado retrocede de AÑO en enero, no a un T4 del año en curso', () => {
    // Un `mes - 3` sin cruzar el año daria `2026-10-01` a `2026-12-31`: un
    // trimestre que todavia no ha pasado, presentado como cerrado. No da error.
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 0, 5))).toEqual({ desde: '2025-10-01', hasta: '2025-12-31' })
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 2, 31))).toEqual({ desde: '2025-10-01', hasta: '2025-12-31' })
  })

  it('el cerrado NUNCA solapa al que esta en curso', () => {
    for (const mes of [0, 1, 3, 5, 6, 8, 9, 11]) {
      const hoy = new Date(2026, mes, 15)
      expect(solapaTrimestreEnCurso(rangoDelTrimestreCerradoDe(hoy), hoy), `mes ${mes}`).toBe(false)
    }
  })

  it('el rango propuesto siempre es valido para el endpoint', () => {
    for (const mes of [0, 3, 6, 9, 11]) {
      const r = RANGO_DE_APERTURA(new Date(2026, mes, 20))
      expect(motivoInvalido({ ...base, ...r }), `mes ${mes}`).toBeNull()
    }
  })
})

describe('5 · cuando el rango toca un periodo que NO HA CERRADO', () => {
  // 18 de septiembre de 2026: el trimestre en curso es T3, del 1 de julio al
  // 30 de septiembre.
  const hoy = new Date(2026, 8, 18)

  it('el rango de apertura SI solapa: es justo el trimestre vivo', () => {
    expect(solapaTrimestreEnCurso(RANGO_DE_APERTURA(hoy), hoy)).toBe(true)
  })

  it('NEGATIVO: un periodo ya cerrado NO solapa, y por eso el aviso desaparece', () => {
    // La condicion que hace que el aviso valga algo. Un aviso que sale siempre
    // es un aviso que nadie lee — la misma trampa que el ambar que deja de
    // avisar por salir en todo.
    expect(solapaTrimestreEnCurso({ desde: '2026-04-01', hasta: '2026-06-30' }, hoy)).toBe(false)
    expect(solapaTrimestreEnCurso({ desde: '2025-01-01', hasta: '2025-12-31' }, hoy)).toBe(false)
  })

  it('UN SOLO DIA de solape cuenta: el periodo sigue estando a medias', () => {
    // Un rango que termina el 1.º de julio ya arrastra un dia de renta del
    // trimestre vivo sin su ingreso.
    expect(solapaTrimestreEnCurso({ desde: '2026-01-01', hasta: '2026-07-01' }, hoy)).toBe(true)
    expect(solapaTrimestreEnCurso({ desde: '2026-09-30', hasta: '2026-12-31' }, hoy)).toBe(true)
  })

  it('un año entero que lo contiene solapa', () => {
    expect(solapaTrimestreEnCurso({ desde: '2026-01-01', hasta: '2026-12-31' }, hoy)).toBe(true)
  })

  it('NEGATIVO: el solape se decide por CALENDARIO, no comparando texto', () => {
    // `motivoInvalido` acepta `2026-9-1` sin cero a la izquierda, asi que aqui
    // puede llegar. Como cadena, '2026-9-1' va DESPUES de '2026-09-30' —el '9'
    // pesa mas que el '0'—, asi que un `<=` de texto diria que septiembre no
    // solapa con septiembre y el aviso no saldria. Es el defecto que este repo
    // ya pago dos veces; se reusa `diaComparable` de `lib/server/fechas.ts`.
    expect(solapaTrimestreEnCurso({ desde: '2026-9-1', hasta: '2026-9-30' }, hoy)).toBe(true)
  })

  it('cuenta los dias corridos del trimestre vivo y los que tiene', () => {
    // T3 de 2026: julio 31 + agosto 31 + septiembre 30 = 92 dias, y al 18 de
    // septiembre llevan corridos 31 + 31 + 18 = 80.
    expect(avanceDelTrimestreEnCurso(hoy)).toEqual({ corridos: 80, totales: 92, etiqueta: 'T3 2026' })
  })

  it('el primer dia del trimestre es UNO corrido, no cero', () => {
    // Inclusive, como el rango del reporte. «0 de 92 dias» el dia que arranca
    // se lee como que no ha empezado, y la renta de ese dia ya corrio.
    expect(avanceDelTrimestreEnCurso(new Date(2026, 6, 1)).corridos).toBe(1)
  })

  it('el ultimo dia del trimestre esta COMPLETO: corridos = totales', () => {
    const a = avanceDelTrimestreEnCurso(new Date(2026, 8, 30))
    expect(a.corridos).toBe(a.totales)
    expect(a.totales).toBe(92)
  })

  it('en los cuatro trimestres los dias cuadran con el calendario', () => {
    // 2026 no es bisiesto: T1 = 31+28+31 = 90.
    const dias = { 0: 90, 3: 91, 6: 92, 9: 92 } as Record<number, number>
    for (const mes of [0, 3, 6, 9]) {
      const a = avanceDelTrimestreEnCurso(new Date(2026, mes, 10))
      expect(a.totales, `mes ${mes}`).toBe(dias[mes])
      expect(a.corridos, `mes ${mes}`).toBeLessThanOrEqual(a.totales)
      expect(a.corridos, `mes ${mes}`).toBeGreaterThan(0)
    }
  })

  it('la etiqueta del trimestre es la MISMA que pinta el resto de la app', () => {
    // `etiquetaBucket` de `derive.ts`, la que usan la grafica de ocupacion y la
    // dimension `trimestre`. Dos etiquetados del mismo trimestre acabarian
    // diciendo «T1» en una pantalla y «1er trimestre» en la otra.
    expect(avanceDelTrimestreEnCurso(new Date(2026, 0, 10)).etiqueta).toBe('T1 2026')
    expect(avanceDelTrimestreEnCurso(new Date(2025, 11, 31)).etiqueta).toBe('T4 2025')
  })
})

// ── Los filtros de apertura pueden venir en la direccion ────────────────────
//
// Hasta el 18/09 la pantalla ignoraba la querystring: navegar a
// `?dimension=luz&desde=…` abria igual en el trimestre en curso y por pantalla.
// Consecuencia practica, y por eso se arregla: NO se podia dejar un enlace
// preparado con el reporte ya filtrado. Habia que teclear dos fechas en vivo.
describe('5 · filtrosDesdeUrl — un enlace puede traer el reporte ya filtrado', () => {
  const hoy = new Date(2026, 8, 18)
  const q = (s: string) => new URLSearchParams(s)

  it('sin querystring devuelve exactamente lo de siempre', () => {
    expect(filtrosDesdeUrl(q(''), hoy)).toEqual({
      dimension: 'sitio',
      granularidad: 'mes',
      ...RANGO_DE_APERTURA(hoy),
    })
  })

  it('toma las cuatro cosas cuando vienen bien', () => {
    expect(filtrosDesdeUrl(q('dimension=luz&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre'), hoy))
      .toEqual({ dimension: 'luz', granularidad: 'trimestre', desde: '2025-07-01', hasta: '2026-06-30' })
  })

  it('acepta una dimension sola y deja el rango de apertura', () => {
    const f = filtrosDesdeUrl(q('dimension=operacion'), hoy)
    expect(f.dimension).toBe('operacion')
    expect({ desde: f.desde, hasta: f.hasta }).toEqual(RANGO_DE_APERTURA(hoy))
  })

  // NEGATIVOS. La direccion la escribe cualquiera, asi que es entrada que no se
  // confia: un valor malo se IGNORA y se cae al de siempre. Nunca deja la
  // pantalla en un estado que su propio selector no sepa representar.
  it('una dimension inventada se ignora, no rompe el selector', () => {
    expect(filtrosDesdeUrl(q('dimension=nomina'), hoy).dimension).toBe('sitio')
  })

  it('una granularidad inventada se ignora', () => {
    expect(filtrosDesdeUrl(q('granularidad=semanal'), hoy).granularidad).toBe('mes')
  })

  it('una fecha con forma invalida se ignora, y NO deja media pareja', () => {
    // Media pareja seria peor que ignorarla: `desde` de la URL con `hasta` del
    // trimestre en curso es un rango que nadie pidio.
    const f = filtrosDesdeUrl(q('desde=ayer&hasta=2026-06-30'), hoy)
    expect({ desde: f.desde, hasta: f.hasta }).toEqual(RANGO_DE_APERTURA(hoy))
  })

  it('un rango invertido se ignora: lo habria rechazado el servidor igual', () => {
    const f = filtrosDesdeUrl(q('desde=2026-06-30&hasta=2025-07-01'), hoy)
    expect({ desde: f.desde, hasta: f.hasta }).toEqual(RANGO_DE_APERTURA(hoy))
  })

  it('`2026-9-1` sin cero a la izquierda se ignora: no es la forma del contrato', () => {
    // Es la misma trampa que ya cazo el aviso de periodo en curso: como cadena
    // `2026-9-1` va DESPUES de `2026-09-30`.
    const f = filtrosDesdeUrl(q('desde=2026-9-1&hasta=2026-09-30'), hoy)
    expect({ desde: f.desde, hasta: f.hasta }).toEqual(RANGO_DE_APERTURA(hoy))
  })
})
