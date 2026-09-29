import { describe, it, expect } from 'vitest'
import {
  columnasDeDimension,
  ordenInicialDe,
  avisosDelReporte,
  formatoCelda,
  notaDeArrendador,
} from './tabla'
import { DIMENSIONES_UI, sustantivoFila, cuenta } from './consulta'

// ============================================================================
//  Las columnas de `tarifa`, y lo que NO trae.
// ----------------------------------------------------------------------------
//  Esta pantalla ya tuvo el defecto que estas pruebas impiden, el 2026-09-18 y
//  con un navegador delante: la tabla pintaba SIEMPRE las columnas de `sitio`,
//  así que `operacion` calculaba bien y no enseñaba ni visitas ni horas. No lo
//  vio nada automático —las columnas propias son campos OPCIONALES de
//  `FilaRentabilidad`, y un campo opcional que nadie lee no da error de tipos ni
//  de ejecución—. De ahí que las columnas vivan en un `.ts` y no en el `.tsx`.
// ============================================================================

describe('tabla — dimensión `tarifa`', () => {
  it('la dimensión se puede elegir en la pantalla', () => {
    // Un motor que nadie puede pedir desde el desplegable es un motor que no
    // existe para el dueño, que es quien hizo la pregunta.
    expect(DIMENSIONES_UI.map((d) => d.valor)).toContain('tarifa')
  })

  it('trae la publicada, el neto comparable y la brecha, EN ESE ORDEN', () => {
    // De izquierda a derecha se lee la historia: qué se publicó, qué entró de
    // eso, cuánto se fue por el camino y qué proporción es.
    expect(columnasDeDimension('tarifa').map((c) => c.clave)).toEqual([
      'etiqueta',
      'ingreso',
      'ingresoLista',
      'ingresoComparable',
      'descuentoYComision',
      'descuentoYComisionPct',
    ])
  })

  it('la brecha NO se llama «descuento» a secas', () => {
    // `neto = lista × (1−descuento) × (1−comisión)`: la brecha lleva dentro la
    // comisión de la agencia, que no es una rebaja que nadie concediera.
    // Llamarla «Descuento» haría leer mal la columna entera — el mismo motivo
    // por el que `entidad` llama `saldoAtribuido` a lo que no es un margen.
    const col = columnasDeDimension('tarifa').find((c) => c.clave === 'descuentoYComision')!
    expect(col.label).toBe('Descuento y comisión')
    expect(col.label).not.toMatch(/^Descuento$/)
  })

  it('NEGATIVA · no pinta margen ni costos: no es una pregunta de costo', () => {
    const claves = columnasDeDimension('tarifa').map((c) => c.clave)
    for (const prohibida of ['margenBruto', 'margenBrutoPct', 'costoEspacio', 'costoOperacion', 'costoEnergia', 'costoTotal']) {
      expect(claves).not.toContain(prohibida)
    }
  })

  it('NEGATIVA · las columnas de tarifa NO se cuelan en las otras seis dimensiones', () => {
    for (const d of ['sitio', 'trimestre', 'operacion', 'm2', 'luz', 'entidad'] as const) {
      const claves = columnasDeDimension(d).map((c) => c.clave)
      expect(claves).not.toContain('ingresoLista')
      expect(claves).not.toContain('descuentoYComision')
    }
  })

  it('la primera columna dice que las filas son pantallas', () => {
    const primera = columnasDeDimension('tarifa')[0]
    expect(primera.label).toBe('Pantalla')
    expect(sustantivoFila('tarifa')).toEqual({ singular: 'pantalla', plural: 'pantallas' })
    expect(cuenta(1, 'tarifa')).toBe('1 pantalla')
  })

  it('abre por el dinero que más separa la publicada del neto', () => {
    // No por porcentaje: un 50 % sobre una pantalla de 2 000 no es el problema,
    // 80 000 regalados en una grande sí. Mismo criterio que `luz` y `operacion`,
    // que abren por el costo que explican y no por el margen.
    expect(ordenInicialDe('tarifa')).toEqual({ columna: 'descuentoYComision', direccion: 'desc' })
  })

  it('NEGATIVA · la fila sin tarifa publicada se pinta con RAYA, no con cero', () => {
    expect(formatoCelda(null, 'dinero')).toBe('—')
    expect(formatoCelda(null, 'porcentaje')).toBe('—')
  })

  it('las filas SÍ son pantallas, así que la nota del arrendador sigue valiendo', () => {
    expect(notaDeArrendador('tarifa', false, null)).toBe('sin contrato')
    expect(notaDeArrendador('tarifa', true, 'Inmuebles Dos')).toBe('Inmuebles Dos')
  })

  it('el aviso de cobertura se pinta verbatim y en ámbar cuando falta comparar', () => {
    const avisos = avisosDelReporte({
      dimension: 'tarifa',
      desde: '2020-01-01',
      hasta: '2020-03-31',
      hoy: new Date('2026-02-15T12:00:00Z'),
      filas: [],
      tarifas: {
        reservasConTarifa: 1,
        reservasSinTarifa: 2,
        ingresoLista: 100_000,
        ingresoComparable: 72_000,
        ingresoSinTarifa: 90_000,
        nota: 'LA NOTA DEL MOTOR',
      },
    })
    const a = avisos.find((x) => x.clave === 'tarifa-sin-publicada')!
    expect(a).toBeDefined()
    expect(a.texto).toBe('LA NOTA DEL MOTOR')
    expect(a.tono).toBe('alerta')
  })

  it('sin hueco el mismo aviso sale en gris: «no falta ninguno» y «no te lo digo» se ven igual sin texto', () => {
    const avisos = avisosDelReporte({
      dimension: 'tarifa',
      desde: '2020-01-01',
      hasta: '2020-03-31',
      hoy: new Date('2026-02-15T12:00:00Z'),
      filas: [],
      tarifas: {
        reservasConTarifa: 3,
        reservasSinTarifa: 0,
        ingresoLista: 100_000,
        ingresoComparable: 72_000,
        ingresoSinTarifa: 0,
        nota: 'TODO COMPARADO',
      },
    })
    expect(avisos.find((x) => x.clave === 'tarifa-sin-publicada')!.tono).toBe('info')
  })

  it('NEGATIVA · sin `tarifas` no sale el aviso (las otras seis dimensiones)', () => {
    const avisos = avisosDelReporte({
      dimension: 'sitio',
      desde: '2020-01-01',
      hasta: '2020-03-31',
      hoy: new Date('2026-02-15T12:00:00Z'),
      filas: [],
    })
    expect(avisos.find((x) => x.clave === 'tarifa-sin-publicada')).toBeUndefined()
  })
})
