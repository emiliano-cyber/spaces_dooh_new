import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_REPORTES, EN_REPORTES } from './reportes'
import { traducir, type ClaveTexto } from '../diccionario'
import {
  CLAVE_DIMENSION,
  CLAVE_GRANULARIDAD,
  DIMENSIONES_UI,
  GRANULARIDADES_UI,
  claveCuenta,
  cuenta,
  motivoInvalido,
  type DimensionUI,
} from '@/components/demo/reportes/consulta'
import {
  CLAVE_COLUMNA,
  CLAVE_DESGLOSE,
  CLAVE_PRIMERA_COLUMNA,
  COLUMNAS,
  COLUMNAS_DESGLOSE,
  TEXTO_CONVENCION,
  TEXTO_MARGEN_BRUTO,
  columnasDeDimension,
  etiquetaDePeriodo,
  textoDeFila,
} from '@/components/demo/reportes/tabla'
import { estadoDeReporte } from '@/components/demo/reportes/estado'
import { etiquetaBucket } from '@/lib/data/derive'
import {
  MSJ_TOPE_MESES_REPORTE,
  notaDeCobertura,
  notaDeCostosOt,
  notaDeTarifas,
  notaDeVendedores,
} from '@/lib/data/reportes'

// ============================================================================
//  EL DICCIONARIO DE REPORTES, CONGELADO Y ATADO A SUS MODULOS.
// ----------------------------------------------------------------------------
//  Mismo patron que `catalogos.test.ts`: una instantanea de los dos idiomas y
//  las guardias de forma de los otros lotes. Y ademas, como el menu con
//  `nav.ts`: los catalogos en espanol de `consulta.ts` y `tabla.ts` siguen
//  siendo la verdad, y el diccionario tiene que decir EXACTAMENTE lo mismo.
// ============================================================================

const ES = ES_REPORTES as Record<string, string>
const EN = EN_REPORTES as Record<string, string>

describe('diccionario de REPORTES · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_REPORTES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_REPORTES).toMatchSnapshot()
  })
})

describe('diccionario de REPORTES · el ingles no esta en espanol', () => {
  // Textos que se escriben igual en los dos idiomas, cada uno con su motivo.
  const IGUALES = new Set<string>([
    // Una cifra y una palabra que llega por hueco: el orden es el mismo.
    'reportes.periodos',
    // «Total (3)» se dice igual en ingles.
    'reportes.tabla.total',
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })

  it('las declaradas siguen siendo iguales (si una cambia, se quita de la lista)', () => {
    expect([...IGUALES].filter((k) => ES[k] !== EN[k])).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(Object.entries(EN).filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })

  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) => (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) || (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })
})

describe('diccionario de REPORTES · el espanol es el de los modulos, letra por letra', () => {
  const DIMENSIONES = DIMENSIONES_UI.map((d) => d.valor)

  it('las dimensiones y su ayuda (`DIMENSIONES_UI`)', () => {
    const malas = DIMENSIONES_UI.filter(
      (d) => traducir('es', CLAVE_DIMENSION[d.valor].label) !== d.label || traducir('es', CLAVE_DIMENSION[d.valor].ayuda) !== d.ayuda,
    ).map((d) => d.valor)
    expect(malas).toEqual([])
  })

  it('las granularidades (`GRANULARIDADES_UI`)', () => {
    expect(GRANULARIDADES_UI.filter((g) => traducir('es', CLAVE_GRANULARIDAD[g.valor]) !== g.label).map((g) => g.valor)).toEqual([])
  })

  it('las columnas (`COLUMNAS`) y la primera de cada dimension', () => {
    const malas = COLUMNAS.filter((c) => c.clave !== 'etiqueta' && traducir('es', CLAVE_COLUMNA[c.clave]) !== c.label).map((c) => c.clave)
    expect(malas).toEqual([])
    for (const d of DIMENSIONES) {
      const primera = columnasDeDimension(d)[0]
      expect(traducir('es', CLAVE_PRIMERA_COLUMNA[d])).toBe(primera.label)
    }
  })

  it('en espanol `columnasDeDimension` con y sin idioma devuelve lo mismo', () => {
    for (const d of DIMENSIONES) expect(columnasDeDimension(d, 'es')).toEqual(columnasDeDimension(d))
  })

  it('el desglose por periodo (`COLUMNAS_DESGLOSE`)', () => {
    expect(COLUMNAS_DESGLOSE.filter((c) => traducir('es', CLAVE_DESGLOSE[String(c.clave)]) !== c.label).map((c) => c.clave)).toEqual([])
  })

  it('`cuenta`: el diccionario dice lo mismo que `SUSTANTIVO_FILA`, en las ocho dimensiones', () => {
    const malas: string[] = []
    for (const d of DIMENSIONES as DimensionUI[]) {
      for (const n of [0, 1, 2, 7]) {
        if (traducir('es', claveCuenta(n, d), { n }) !== cuenta(n, d)) malas.push(`${d}:${n}`)
      }
    }
    expect(malas).toEqual([])
    expect(cuenta(1, 'entidad', 'en')).toBe('1 legal entity')
    expect(cuenta(3, 'trimestre', 'en')).toBe('3 quarters')
  })

  it('el aviso del margen bruto y las dos convenciones del m²', () => {
    expect(traducir('es', 'reportes.aviso.margen-bruto')).toBe(TEXTO_MARGEN_BRUTO)
    expect(traducir('es', 'reportes.aviso.m2.todas-las-caras')).toBe(TEXTO_CONVENCION['todas-las-caras'])
    expect(traducir('es', 'reportes.aviso.m2.una-cara')).toBe(TEXTO_CONVENCION['una-cara'])
  })

  it('el tope de 24 meses es el del servidor, y en ingles dice lo mismo que su catalogo', () => {
    expect(traducir('es', 'reportes.motivo.tope')).toBe(MSJ_TOPE_MESES_REPORTE)
    const tope = { dimension: 'sitio' as const, granularidad: 'mes' as const, desde: '2020-01-01', hasta: '2025-01-01' }
    expect(motivoInvalido(tope)).toBe(MSJ_TOPE_MESES_REPORTE)
    expect(motivoInvalido(tope, 'en')).toBe(EN['reportes.motivo.tope'])
  })

  it('las dos filas que anade el motor dicen en el diccionario lo que escribe el motor', () => {
    // El motor escribe estas cuatro frases como literales (`rentabilidadPorEntidad`
    // y `rentabilidadPorVendedor`): si alguien las cambia alli, aqui se ve.
    const motor = readFileSync(path.join(__dirname, '../../data/reportes.ts'), 'utf8')
    for (const k of [
      'reportes.fila.sin-asignar',
      'reportes.fila.sin-asignar.detalle',
      'reportes.fila.sin-vendedor',
      'reportes.fila.sin-vendedor.detalle',
    ] as ClaveTexto[]) {
      expect(motor).toContain(`'${traducir('es', k)}'`)
    }
  })
})

describe('REPORTES · lo que no se rinde en la prueba de pantallas', () => {
  it('la red caida: el mensaje lo pone `estadoDeReporte` con su clave, en los dos idiomas', () => {
    const red = { motivoInvalido: null, cargando: false, respuesta: { status: 0, mensaje: null, filas: 0 } }
    expect(estadoDeReporte(red).mensaje).toBe('No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.')
    expect(estadoDeReporte(red, 'en').mensaje).toBe(EN['reportes.error.red'])
    // Un mensaje del servidor pasa tal cual, en cualquier idioma.
    const conMensaje = { ...red, respuesta: { status: 403, mensaje: 'Sin permiso', filas: 0 } }
    expect(estadoDeReporte(conMensaje, 'en').mensaje).toBe('Sin permiso')
  })

  it('el trimestre y el mes en ingles («Q1 2026», «Jan»); en espanol, lo de siempre', () => {
    const d = new Date(2026, 0, 12)
    expect(etiquetaBucket(d, 'trimestre')).toBe('T1 2026')
    expect(etiquetaBucket(d, 'trimestre', 'en')).toBe('Q1 2026')
    expect(etiquetaBucket(d, 'mes', 'en')).toBe('Jan')
    expect(etiquetaBucket(d, 'semana')).toBe('12/01')
    expect(etiquetaBucket(d, 'semana', 'en')).toBe('Jan 12')
    expect(etiquetaBucket(d, 'mes', 'es')).toBe(etiquetaBucket(d, 'mes'))
    expect(etiquetaDePeriodo({ clave: '2025-T4', etiqueta: 'T4 2025' }, 'en')).toBe('Q4 2025')
    expect(etiquetaDePeriodo({ clave: '2025-03', etiqueta: 'mar' }, 'en')).toBe('Mar')
    expect(etiquetaDePeriodo({ clave: '2025-03', etiqueta: 'mar' })).toBe('mar')
    expect(etiquetaDePeriodo({ clave: 'raro', etiqueta: 'raro' }, 'en')).toBe('raro')
  })

  it('las filas: los datos no se traducen, lo que escribe el motor si', () => {
    const fila = { clave: 's1', etiqueta: 'Reforma 222', detalle: 'R-01' }
    expect(textoDeFila('sitio', fila, 'en')).toEqual({ etiqueta: 'Reforma 222', detalle: 'R-01' })
    const sinAsignar = { clave: '', etiqueta: 'Sin asignar', detalle: 'Sin razón social en el dato de origen' }
    expect(textoDeFila('entidad', sinAsignar)).toEqual({ etiqueta: 'Sin asignar', detalle: 'Sin razón social en el dato de origen' })
    expect(textoDeFila('entidad', sinAsignar, 'en').etiqueta).toBe('Unassigned')
  })

  it('las variantes de concordancia de las notas, en ingles', () => {
    expect(notaDeCostosOt({ visitasConCostoReal: 0, visitasConEstimacion: 1, costoRealCapturado: 0, costoEstimado: 1500 }, 'en')).toContain('1 of 1 visit in the period is costed at')
    expect(notaDeCostosOt({ visitasConCostoReal: 4, visitasConEstimacion: 1, costoRealCapturado: 0, costoEstimado: 1500 }, 'en')).toContain('1 of the 5 visits in the period is costed at')
    expect(notaDeCostosOt({ visitasConCostoReal: 1, visitasConEstimacion: 0, costoRealCapturado: 900, costoEstimado: 0 }, 'en')).toContain('The period’s only visit is at its ACTUAL recorded cost')
    expect(notaDeTarifas({ reservasConTarifa: 0, reservasSinTarifa: 1, ingresoLista: 0, ingresoComparable: 0, ingresoSinTarifa: 10 }, 'en')).toContain('1 of 1 booking in the period has')
    expect(notaDeVendedores({ reservasConVendedor: 3, reservasSinVendedor: 1, reservasSinPropuesta: 1, reservasDePropuestaSinVendedor: 0, ingresoSinVendedor: 10 }, 'en')).toContain('1 of the 4 bookings in the period shows')
    expect(notaDeCobertura(0, 1, 0, 0, 'en')).toBe(EN['reportes.nota.luz.completa.uno'].replace('{esperados}', '1'))
    expect(notaDeCobertura(0, 0, 0, 0, 'en')).toBe(EN['reportes.nota.luz.sin-esperados'])
  })

  it('el servidor sigue mandando las notas en espanol: sin idioma, el motor no cambia', () => {
    expect(notaDeCobertura(2, 6, 1, 350)).toBe(
      'Faltan 2 de 6 recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. Además, 1 recibo por 350 no aparece en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta.',
    )
  })
})
