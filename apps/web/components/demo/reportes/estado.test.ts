import { describe, it, expect } from 'vitest'
import { estadoDeReporte, debePedir, type EntradaEstado } from './estado'

// ============================================================================
//  La maquina de estados de la pantalla de reportes.
// ----------------------------------------------------------------------------
//  Tiene SIETE salidas y una de ellas —el 501— no es un error. Escrita dentro
//  del `.tsx` no la probaria nadie (vitest no monta jsdom), y sus dos modos de
//  fallo son silenciosos: un spinner que no termina nunca, y un «no hay datos»
//  puesto sobre un fallo de red.
// ============================================================================

const listo: EntradaEstado = {
  motivoInvalido: null,
  cargando: false,
  dimension: 'sitio',
  respuesta: { status: 200, mensaje: null, filas: 4 },
}

describe('1 · el 501 NO es un error, es una dimension sin motor', () => {
  it('un 501 cae en `sin-motor`', () => {
    const e = estadoDeReporte({ ...listo, dimension: 'm2', respuesta: { status: 501, mensaje: null, filas: 0 } })
    expect(e.fase).toBe('sin-motor')
  })

  it('un 501 NUNCA cae en `error` ni en `vacio`', () => {
    // Un 501 pintado como error manda a buscar un fallo que no existe; pintado
    // como vacio afirma que no hay datos, y eso es falso: no se calcularon.
    for (const filas of [0, 7]) {
      const e = estadoDeReporte({ ...listo, dimension: 'trimestre', respuesta: { status: 501, mensaje: null, filas } })
      expect(e.fase).not.toBe('error')
      expect(e.fase).not.toBe('vacio')
    }
  })

  it('usa el mensaje del servidor cuando lo trae', () => {
    const e = estadoDeReporte({
      ...listo,
      dimension: 'm2',
      respuesta: { status: 501, mensaje: 'El reporte de rentabilidad por metro cuadrado todavía no está disponible.', filas: 0 },
    })
    expect(e.mensaje).toContain('metro cuadrado')
  })

  it('y si no lo trae, el mensaje propio NOMBRA la dimension que falta', () => {
    // «No implementado» no le dice a nadie si pedir otra cosa o esperar.
    const e = estadoDeReporte({ ...listo, dimension: 'operacion', respuesta: { status: 501, mensaje: null, filas: 0 } })
    expect(e.mensaje).toMatch(/operaci/i)
    expect(e.mensaje).not.toMatch(/501|no implementado/i)
  })
})

describe('2 · nunca un spinner infinito', () => {
  it('con una respuesta ya recibida la fase JAMAS es `cargando`', () => {
    // El modo de fallo que este arnes existe para impedir. Se barre la matriz
    // entera en vez de un caso: el defecto aparece en la combinacion que nadie
    // escribio a mano.
    for (const status of [200, 400, 401, 403, 404, 500, 501]) {
      for (const filas of [0, 1, 250]) {
        for (const mensaje of [null, 'algo paso']) {
          const e = estadoDeReporte({ ...listo, cargando: false, respuesta: { status, mensaje, filas } })
          expect(e.fase, `status ${status} filas ${filas}`).not.toBe('cargando')
        }
      }
    }
  })

  it('mientras pide, `cargando`', () => {
    expect(estadoDeReporte({ ...listo, cargando: true, respuesta: null }).fase).toBe('cargando')
  })

  it('y al repetir la consulta sigue `cargando` aunque haya datos viejos en pantalla', () => {
    expect(estadoDeReporte({ ...listo, cargando: true }).fase).toBe('cargando')
  })
})

describe('3 · el rango invalido corta antes de pedir', () => {
  it('con motivo invalido la fase es `invalido` y arrastra el motivo', () => {
    const e = estadoDeReporte({ ...listo, motivoInvalido: 'La fecha de fin no puede ser anterior a la de inicio' })
    expect(e.fase).toBe('invalido')
    expect(e.mensaje).toMatch(/anterior/)
  })

  it('y manda incluso sobre `cargando`: no se pide un rango que se sabe malo', () => {
    const e = estadoDeReporte({ ...listo, cargando: true, motivoInvalido: 'Usa fechas con formato AAAA-MM-DD' })
    expect(e.fase).toBe('invalido')
  })

  it('debePedir es false con un rango invalido y true con uno bueno', () => {
    expect(debePedir({ dimension: 'sitio', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' })).toBe(true)
    expect(debePedir({ dimension: 'sitio', granularidad: 'mes', desde: '2026-03-31', hasta: '2026-01-01' })).toBe(false)
  })

  it('y SI pide una dimension sin motor: el 501 lo decide el servidor, no la pantalla', () => {
    // Si la pantalla se negara a pedir `m2`, el dia que aterrice su motor
    // habria que tocar la pantalla — que es exactamente lo que el limite existe
    // para evitar.
    expect(debePedir({ dimension: 'm2', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' })).toBe(true)
  })
})

describe('4 · cero filas no es un error, y un error no es cero filas', () => {
  it('200 con cero filas es `vacio`', () => {
    // Una pantalla sin ingreso, sin renta y sin OT en el rango no aparece, asi
    // que un rango sin movimiento da cero filas y no un error.
    expect(estadoDeReporte({ ...listo, respuesta: { status: 200, mensaje: null, filas: 0 } }).fase).toBe('vacio')
  })

  it('200 con filas es `datos`', () => {
    expect(estadoDeReporte(listo).fase).toBe('datos')
  })

  it('un 403 es `error` con el mensaje del servidor, no un «no hay datos»', () => {
    const e = estadoDeReporte({ ...listo, respuesta: { status: 403, mensaje: 'Sin permiso para finanzas', filas: 0 } })
    expect(e.fase).toBe('error')
    expect(e.mensaje).toBe('Sin permiso para finanzas')
  })

  it('un error sin mensaje trae uno honesto, nunca vacio', () => {
    const e = estadoDeReporte({ ...listo, respuesta: { status: 500, mensaje: null, filas: 0 } })
    expect(e.fase).toBe('error')
    expect((e.mensaje ?? '').length).toBeGreaterThan(10)
  })

  it('sin haber pedido nada todavia, `inicial`', () => {
    expect(estadoDeReporte({ ...listo, cargando: false, respuesta: null }).fase).toBe('inicial')
  })
})
