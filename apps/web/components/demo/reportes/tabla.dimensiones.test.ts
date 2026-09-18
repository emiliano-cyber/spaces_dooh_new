import { describe, it, expect } from 'vitest'
import {
  COLUMNAS_DESGLOSE,
  avisosDelReporte,
  columnasDeDimension,
  desgloseDeFila,
  formatoCelda,
  ordenInicialDe,
  ordenarFilas,
  resumenVisitasPorTipo,
  valorDeColumna,
  type FilaOrdenable,
} from './tabla'
import { DIMENSIONES_UI } from './consulta'

// ============================================================================
//  Las columnas salen de la DIMENSION, no de `sitio`.
// ----------------------------------------------------------------------------
//  El defecto que estas pruebas fijan salio de MIRAR la app el 2026-09-18, con
//  el build fusionado y un navegador delante. No lo vio el typecheck ni las
//  unitarias, y por una razon exacta: la tabla pintaba SIEMPRE las siete
//  columnas de `sitio`, y las columnas que el motor devuelve solo en
//  `operacion` y en `m2` son campos OPCIONALES de `FilaRentabilidad`. Un campo
//  opcional que nadie lee no da error de tipos ni de ejecucion: da una tabla
//  que calcula bien y no enseña la respuesta.
//
//  «Por operacion» daba Tlalpan 21.6 % contra Santa Monica 34.2 % —el guion del
//  dueño, bien calculado— SIN una sola columna de visitas ni de horas, que es
//  justo lo que la hace «por operacion». Y en trimestral el encabezado de la
//  primera columna decia «PANTALLA» mientras las filas eran trimestres.
// ============================================================================

function fila(p: Partial<FilaOrdenable> & { clave: string }): FilaOrdenable {
  return {
    etiqueta: p.clave,
    ingreso: 0,
    costoEspacio: 0,
    costoOperacion: 0,
    costoTotal: 0,
    margen: 0,
    margenPct: null,
    tieneContrato: true,
    visitas: 0,
    ...p,
  }
}

describe('1 · cada dimension trae SUS columnas, y las trae de verdad', () => {
  it('las cuatro dimensiones declaradas tienen juego de columnas', () => {
    // Recorre `DIMENSIONES_UI` y no una lista escrita a mano: una dimension
    // nueva en el selector sin columnas propias volveria a pintar las de sitio.
    for (const d of DIMENSIONES_UI) {
      const cols = columnasDeDimension(d.valor)
      expect(cols.length, d.valor).toBeGreaterThan(4)
      expect(cols[0].clave, d.valor).toBe('etiqueta')
    }
  })

  it('`operacion` enseña visitas, el porcentaje de operacion y las horas en sitio', () => {
    // EL DEFECTO. Sin estas tres columnas el reporte «por operacion» calcula
    // perfectamente y no contesta su propia pregunta: donde se va el dinero en
    // visitas. El motor ya las devuelve (`rentabilidadPorOperacion`).
    const claves = columnasDeDimension('operacion').map((c) => c.clave)
    expect(claves).toContain('visitas')
    expect(claves).toContain('costoOperacionPct')
    expect(claves).toContain('horasEnSitio')
  })

  it('`m2` enseña la superficie y el rendimiento por metro', () => {
    const claves = columnasDeDimension('m2').map((c) => c.clave)
    expect(claves).toContain('m2')
    expect(claves).toContain('ingresoPorM2')
    expect(claves).toContain('margenPorM2')
  })

  it('NEGATIVO: `sitio` NO trae las columnas de otra dimension', () => {
    // El caso contrario del defecto, y el que lo deja cerrado por los dos
    // lados: en `sitio` el motor no pone `costoOperacionPct` ni `m2`, asi que
    // una columna de esas saldria vacia en todas las filas —y una columna en
    // blanco se lee como un dato que falta, no como uno que no aplica—.
    const claves = columnasDeDimension('sitio').map((c) => c.clave)
    for (const ajena of ['visitas', 'costoOperacionPct', 'horasEnSitio', 'm2', 'ingresoPorM2', 'margenPorM2']) {
      expect(claves, ajena).not.toContain(ajena)
    }
  })

  it('NEGATIVO: `trimestre` tampoco las trae, aunque su fila SI tenga visitas', () => {
    // `visitas` es un campo obligatorio de `FilaRentabilidad` y viene en toda
    // dimension, asi que aqui el tipo no protege de nada: la decision es de
    // producto y tiene que estar escrita.
    expect(columnasDeDimension('trimestre').map((c) => c.clave)).not.toContain('visitas')
  })

  it('`costoTotal` es la unica que cede el sitio, y no se pierde nada', () => {
    // Cuando una dimension trae columnas propias, la que sale es `costoTotal`:
    // es la suma exacta de las dos columnas que tiene al lado, que siguen en
    // pantalla. Cualquier otra si seria informacion perdida.
    expect(columnasDeDimension('sitio').map((c) => c.clave)).toContain('costoTotal')
    expect(columnasDeDimension('operacion').map((c) => c.clave)).not.toContain('costoTotal')
    expect(columnasDeDimension('m2').map((c) => c.clave)).not.toContain('costoTotal')
    for (const d of ['operacion', 'm2'] as const) {
      const claves = columnasDeDimension(d).map((c) => c.clave)
      expect(claves, d).toContain('costoEspacio')
      expect(claves, d).toContain('costoOperacion')
    }
  })
})

describe('2 · el encabezado de la primera columna dice QUE son las filas', () => {
  it('en `trimestre` la primera columna NO se llama «Pantalla»', () => {
    // EL DEFECTO, visto en el navegador: las filas eran trimestres y el
    // encabezado decia PANTALLA. Es la clase de mentira que no da error y que
    // hace que quien mira el reporte lea la tabla entera al reves.
    const primera = columnasDeDimension('trimestre')[0]
    expect(primera.label).not.toMatch(/pantalla/i)
    expect(primera.label).toMatch(/trimestre/i)
  })

  it('en las otras tres las filas SI son pantallas y el encabezado lo dice', () => {
    for (const d of ['sitio', 'operacion', 'm2'] as const) {
      expect(columnasDeDimension(d)[0].label, d).toMatch(/pantalla/i)
    }
  })
})

describe('3 · en `trimestre` el orden es CRONOLOGICO, no por margen', () => {
  const trimestres = [
    fila({ clave: '2026-T1', etiqueta: 'T1 2026', margen: 10_000 }),
    fila({ clave: '2026-T2', etiqueta: 'T2 2026', margen: 90_000 }),
    fila({ clave: '2025-T4', etiqueta: 'T4 2025', margen: 50_000 }),
  ]

  it('el orden inicial de `trimestre` no es por margen', () => {
    // Una serie de tiempo ordenada por importe es ilegible, y ordenada por
    // margen descendente pone el trimestre MAS RECIENTE arriba unas veces y
    // abajo otras, segun como fuera el negocio. El motor ya los devuelve en
    // orden (`rentabilidadPorTrimestre`): la tabla no tiene que discutirlo.
    const o = ordenInicialDe('trimestre')
    expect(o.columna).not.toBe('margen')
    expect(ordenarFilas(trimestres, o, 'trimestre').map((f) => f.clave)).toEqual([
      '2025-T4',
      '2026-T1',
      '2026-T2',
    ])
  })

  it('ordena por CLAVE y no por etiqueta: «T4 2025» va ANTES de «T1 2026»', () => {
    // Como texto, 'T4 2025' va DESPUES de 'T1 2026' —la T4 pesa mas que la T1—
    // y en el calendario va antes. La clave (`2025-T4`) si ordena bien porque
    // empieza por el año. Es la misma trampa que ya se pago dos veces en este
    // repo comparando fechas como cadenas.
    const porEtiqueta = [...trimestres].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
    expect(porEtiqueta.map((f) => f.clave)).toEqual(['2026-T1', '2026-T2', '2025-T4'])
    expect(ordenarFilas(trimestres, ordenInicialDe('trimestre'), 'trimestre')[0].clave).toBe('2025-T4')
  })

  it('las otras tres SI van «peor primero», y cada una por su columna', () => {
    // Se conserva la intencion original, y cada dimension usa el MISMO orden
    // que su motor: `sitio` por peor margen, `operacion` por mas costo de
    // operacion, `m2` por peor margen por metro. Si la tabla reordenara al
    // recibir, discutiria con el servidor sobre la misma pregunta.
    expect(ordenInicialDe('sitio')).toEqual({ columna: 'margen', direccion: 'asc' })
    expect(ordenInicialDe('operacion')).toEqual({ columna: 'costoOperacion', direccion: 'desc' })
    expect(ordenInicialDe('m2')).toEqual({ columna: 'margenPorM2', direccion: 'asc' })
  })

  it('el orden inicial de cada dimension apunta a una columna QUE SE VE', () => {
    // Un orden inicial por una columna que no esta en la tabla deja la flecha
    // invisible: la tabla sale ordenada por algo que nadie puede ver ni
    // cambiar de un clic.
    for (const d of DIMENSIONES_UI) {
      const o = ordenInicialDe(d.valor)
      const claves = columnasDeDimension(d.valor).map((c) => c.clave)
      expect(claves, `${d.valor} ordena por ${o.columna}`).toContain(o.columna)
    }
  })
})

describe('4 · las exclusiones del m2 se ENSEÑAN, y la convencion se declara', () => {
  const filasM2 = [fila({ clave: 's1', ingreso: 100, m2: 18, margenPorM2: 2 })]

  it('la nota del servidor se pinta VERBATIM, no se vuelve a redactar', () => {
    // El motor ya la trae redactada (`notaDeExclusiones`, reportes.ts). Volver
    // a escribirla aqui seria la segunda implementacion de la misma frase, y
    // este repo documenta esa clase de error como su error de raiz
    // (`lib/server/tenant.ts:87-89`): divergirian, y aqui divergir significa
    // decir en pantalla que se excluyo otra cosa que la que se excluyo.
    const nota =
      'Quedaron fuera del ranking: 3 pantallas digitales o rotativas, porque su denominador correcto son spots y no metros.'
    const avisos = avisosDelReporte({
      dimension: 'm2',
      filas: filasM2,
      excluidas: { digitales: 3, sinMedidas: 0, nota },
      convencionM2: 'una-cara',
    })
    expect(avisos.map((a) => a.texto)).toContain(nota)
  })

  it('con CERO exclusiones tambien se dice, porque el silencio no distingue', () => {
    // «No excluí nada» y «no te lo digo» se ven igual si no se pinta nada. Es
    // el hallazgo C1 de la auditoria QA otra vez: el sistema vacio
    // indistinguible del no cargado.
    const nota =
      'No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas.'
    const avisos = avisosDelReporte({
      dimension: 'm2',
      filas: filasM2,
      excluidas: { digitales: 0, sinMedidas: 0, nota },
      convencionM2: 'una-cara',
    })
    expect(avisos.map((a) => a.texto)).toContain(nota)
  })

  it('la convencion del metro cuadrado se DECLARA en pantalla', () => {
    // Una cifra por metro cuadrado sin decir que cuenta como metro cuadrado no
    // se puede conciliar con nada. Hoy es UNA CARA y hay una decision del dueño
    // pendiente sobre si multiplica por caras: el usuario tiene que ver cual se
    // uso sin preguntarle a nadie.
    const avisos = avisosDelReporte({
      dimension: 'm2',
      filas: filasM2,
      excluidas: { digitales: 0, sinMedidas: 0, nota: 'x' },
      convencionM2: 'una-cara',
    })
    const texto = avisos.find((a) => a.clave === 'm2-convencion')?.texto ?? ''
    expect(texto).toMatch(/una cara/i)
    expect(texto).toMatch(/18/)
  })

  it('si el dueño decide que multiplica por caras, el aviso lo dice al reves', () => {
    const avisos = avisosDelReporte({
      dimension: 'm2',
      filas: filasM2,
      excluidas: { digitales: 0, sinMedidas: 0, nota: 'x' },
      convencionM2: 'todas-las-caras',
    })
    const texto = avisos.find((a) => a.clave === 'm2-convencion')?.texto ?? ''
    expect(texto).toMatch(/todas las caras/i)
    expect(texto).toMatch(/36/)
  })

  it('NEGATIVO: en `sitio` no aparece ningun aviso de m2', () => {
    // El motor no manda `excluidas` ni `convencionM2` fuera de `m2`. Un aviso
    // de superficie encima de un reporte por pantalla afirmaria que se
    // escondieron filas que nadie escondio.
    const avisos = avisosDelReporte({ dimension: 'sitio', filas: filasM2 })
    expect(avisos.map((a) => a.clave)).not.toContain('m2-excluidas')
    expect(avisos.map((a) => a.clave)).not.toContain('m2-convencion')
  })
})

describe('5 · los avisos de contrato y de ingreso hablan de lo que ES la fila', () => {
  it('en `sitio` cuenta pantallas sin contrato y pantallas que costaron sin vender', () => {
    const avisos = avisosDelReporte({
      dimension: 'sitio',
      filas: [
        fila({ clave: 'a', ingreso: 0, tieneContrato: false }),
        fila({ clave: 'b', ingreso: 10_000, tieneContrato: true }),
      ],
    })
    const claves = avisos.map((a) => a.clave)
    expect(claves).toContain('sin-contrato')
    expect(claves).toContain('sin-ingreso')
    expect(avisos.find((a) => a.clave === 'sin-contrato')?.texto).toMatch(/pantalla/i)
  })

  it('NEGATIVO: en `trimestre` NO se dice «pantallas sin contrato»', () => {
    // `tieneContrato` en `trimestre` significa «hubo renta en el trimestre»: la
    // fila NO es una pantalla (`vault/02-Backend/reportes-dimensiones.md` §3).
    // Contado como pantallas, el aviso afirma algo que no existe —«2 pantallas
    // no tienen contrato» sobre dos trimestres sin renta— y no da ningun error.
    const avisos = avisosDelReporte({
      dimension: 'trimestre',
      filas: [
        fila({ clave: '2026-T1', tieneContrato: false, ingreso: 0 }),
        fila({ clave: '2026-T2', tieneContrato: false, ingreso: 0 }),
      ],
    })
    expect(avisos.map((a) => a.clave)).not.toContain('sin-contrato')
  })

  it('en `trimestre` el aviso de sin ingreso habla de TRIMESTRES y defiende el cero', () => {
    // Un trimestre sin movimiento SI aparece, en cero y a proposito: un hueco
    // en una serie se lee como «faltan datos».
    const avisos = avisosDelReporte({
      dimension: 'trimestre',
      filas: [fila({ clave: '2026-T1', ingreso: 0 }), fila({ clave: '2026-T2', ingreso: 5 })],
    })
    const texto = avisos.find((a) => a.clave === 'sin-ingreso')?.texto ?? ''
    expect(texto).toMatch(/trimestre/i)
    expect(texto).not.toMatch(/pantalla/i)
  })

  it('sin nada que advertir, la lista viene vacia y no se pinta la caja', () => {
    expect(avisosDelReporte({ dimension: 'sitio', filas: [fila({ clave: 'a', ingreso: 1 })] })).toEqual([])
  })
})

describe('6 · el pie NO inventa totales que el servidor no manda', () => {
  const totalizables = (d: 'sitio' | 'operacion' | 'm2') =>
    columnasDeDimension(d)
      .filter((c) => c.totalizable)
      .map((c) => c.clave)

  it('solo las seis columnas de dinero de `Totales` son totalizables', () => {
    // `reporte.totales` trae seis campos y ninguno mas. Sumar aqui las visitas
    // —o peor, promediar `margenPorM2`— daria un pie que no cuadra con nada: el
    // promedio de los margenes por metro NO es el margen por metro del total,
    // porque cada fila tiene una superficie distinta.
    expect(totalizables('sitio').sort()).toEqual(
      ['costoEspacio', 'costoOperacion', 'costoTotal', 'ingreso', 'margen', 'margenPct'].sort(),
    )
  })

  it('NEGATIVO: ninguna columna propia de una dimension se totaliza', () => {
    for (const ajena of ['visitas', 'horasEnSitio', 'costoOperacionPct']) {
      expect(totalizables('operacion'), ajena).not.toContain(ajena)
    }
    for (const ajena of ['m2', 'ingresoPorM2', 'margenPorM2']) {
      expect(totalizables('m2'), ajena).not.toContain(ajena)
    }
  })

  it('la etiqueta nunca es totalizable', () => {
    for (const d of DIMENSIONES_UI) {
      expect(columnasDeDimension(d.valor)[0].totalizable, d.valor).toBe(false)
    }
  })
})

describe('7 · el formato de cada columna dice lo que el valor significa', () => {
  it('un null en horas es «—» y NO «0.0 h»', () => {
    // `horasEnSitio` es null cuando NINGUNA visita tiene las dos marcas de
    // tiempo. Pintado como cero afirma que la cuadrilla entro y salio en el
    // mismo instante, que es una medicion, no una ausencia.
    expect(formatoCelda(null, 'horas')).toBe('—')
    expect(formatoCelda(12.5, 'horas')).toMatch(/12\.5\s*h/)
  })

  it('cero visitas SI es «0»: es un hecho medido, no un dato que falta', () => {
    expect(formatoCelda(0, 'entero')).toBe('0')
    expect(formatoCelda(4, 'entero')).toBe('4')
  })

  it('la superficie lleva su unidad, porque 18 a secas no dice metros', () => {
    expect(formatoCelda(18, 'superficie')).toMatch(/18(\.00)?\s*m²/)
  })

  it('un null en porcentaje sigue siendo «—», nunca «0 %»', () => {
    expect(formatoCelda(null, 'porcentaje')).toBe('—')
  })

  it('el dinero usa el MISMO formateador que el resto de la app', () => {
    // Negativos entre parentesis, que es la convencion contable de este repo
    // (`formatMonto`): «$ -156,986.66» se lee mal en una columna de cifras.
    expect(formatoCelda(-1000, 'dinero')).toMatch(/^\(\$/)
  })
})

describe('8 · `visitasPorTipo` se lee, no se cuenta dos veces', () => {
  it('resume por tipo con el nombre en español y de mas a menos', () => {
    // «Van a arreglarla» no es lo mismo que «van a inspeccionarla»: el numero
    // total de visitas no distingue las dos, y esa distincion es el guion del
    // dueño (Tlalpan contra Santa Monica).
    expect(resumenVisitasPorTipo({ INSPECCION: 1, HERRERIA: 3 })).toBe('Herrería 3 · Inspección 1')
  })

  it('un tipo que no esta en el catalogo se pinta con su clave, no se esconde', () => {
    // Una OT historica con un tipo retirado del catalogo seguiria contando en
    // `visitas`: si el resumen la omitiera, las dos cifras no cuadrarian y
    // nadie sabria por que.
    expect(resumenVisitasPorTipo({ TIPO_RARO: 2 })).toBe('TIPO_RARO 2')
  })

  it('sin tipos, cadena vacia y no un separador suelto', () => {
    expect(resumenVisitasPorTipo(undefined)).toBe('')
    expect(resumenVisitasPorTipo({})).toBe('')
  })
})

describe('9 · el desglose por periodo se pinta en el orden del SERVIDOR', () => {
  const periodos = [
    { clave: '2026-01', etiqueta: 'ene', desde: '2026-01-01', hasta: '2026-01-31', ingreso: 10, costoEspacio: 1, costoOperacion: 0, costoTotal: 1, margen: 9, visitas: 0 },
    { clave: '2026-02', etiqueta: 'feb', desde: '2026-02-01', hasta: '2026-02-28', ingreso: 90, costoEspacio: 1, costoOperacion: 0, costoTotal: 1, margen: 89, visitas: 2 },
    { clave: '2026-03', etiqueta: 'mar', desde: '2026-03-01', hasta: '2026-03-31', ingreso: 50, costoEspacio: 1, costoOperacion: 0, costoTotal: 1, margen: 49, visitas: 1 },
  ]

  it('no se reordena por importe: es una serie de tiempo', () => {
    expect(desgloseDeFila({ periodos }).map((p) => p.clave)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('no muta el arreglo de la respuesta', () => {
    // `Array.prototype.sort` ordena EN SITIO, y sobre lo que guarda un
    // `useState` eso es una mutacion que React no ve.
    const copia = [...periodos]
    desgloseDeFila({ periodos })
    expect(periodos).toEqual(copia)
  })

  it('una fila sin periodos no revienta: da lista vacia', () => {
    expect(desgloseDeFila({})).toEqual([])
  })

  it('el desglose incluye las visitas del bucket, que es un hecho de todo periodo', () => {
    expect(COLUMNAS_DESGLOSE.map((c) => c.clave)).toContain('visitas')
    expect(COLUMNAS_DESGLOSE[0].clave).toBe('etiqueta')
  })
})

describe('10 · `valorDeColumna` lee el campo que la columna declara', () => {
  it('en `trimestre` la primera columna ORDENA por clave y PINTA la etiqueta', () => {
    // Son dos cosas distintas y es la unica columna donde se separan: se pinta
    // «T1 2026» porque es lo que se lee, y se ordena por `2026-T1` porque es lo
    // unico que ordena bien.
    const f = fila({ clave: '2026-T1', etiqueta: 'T1 2026' })
    const primera = columnasDeDimension('trimestre')[0]
    expect(primera.campoOrden).toBe('clave')
    expect(valorDeColumna(f, primera)).toBe('T1 2026')
  })

  it('una columna que la fila no trae da null, no `undefined` pintado', () => {
    // Una dimension nunca deberia pedir una columna que su motor no llena —lo
    // fija la prueba 1—, pero si pasara, `undefined` en el JSX se pinta como
    // nada y la columna sale en blanco sin decir por que.
    const f = fila({ clave: 'a' })
    const col = columnasDeDimension('m2').find((c) => c.clave === 'margenPorM2')!
    expect(valorDeColumna(f, col)).toBeNull()
  })
})
