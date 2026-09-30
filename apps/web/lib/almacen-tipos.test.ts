import { describe, it, expect } from 'vitest'
import {
  TIPOS_ACTIVO,
  ETIQUETA_TIPO_ACTIVO,
  tipoDeFiltro,
  etiquetaTipoActivo,
  contarPorTipo,
  filtrarPorTipo,
  tiposConocidosSalvoOtro,
} from './almacen-tipos'

// ============================================================================
//  El catálogo de tipos del almacén. Pedido del dueño el 2026-09-30: «en
//  almacén se debe de poder añadir más elementos, camionetas, herramientas,
//  pantallas, cámaras, etc.».
// ============================================================================

describe('catálogo de tipos', () => {
  it('trae los que pidió el dueño y conserva los tres de siempre', () => {
    for (const t of ['VEHICULO', 'HERRAMIENTA', 'PANTALLA', 'EQUIPO', 'CAMARA', 'OTRO']) {
      expect(TIPOS_ACTIVO).toContain(t)
    }
    // Los que la pantalla ofrecía antes del 30/09: una fila vieja con estos
    // valores tiene que seguir cayendo en su propio grupo, no en «Otro».
    for (const t of ['ESTRUCTURA', 'LONA']) expect(TIPOS_ACTIVO).toContain(t)
  })

  it('cada tipo tiene su nombre para la pantalla', () => {
    for (const t of TIPOS_ACTIVO) expect(ETIQUETA_TIPO_ACTIVO[t]).toBeTruthy()
    expect(ETIQUETA_TIPO_ACTIVO.VEHICULO).toMatch(/camioneta/i)
  })

  it('OTRO va al final: es el cajón de lo que no encaja', () => {
    expect(TIPOS_ACTIVO[TIPOS_ACTIVO.length - 1]).toBe('OTRO')
    expect(tiposConocidosSalvoOtro()).not.toContain('OTRO')
    expect(tiposConocidosSalvoOtro()).toHaveLength(TIPOS_ACTIVO.length - 1)
  })
})

describe('tipoDeFiltro — a qué grupo pertenece una fila', () => {
  it('un tipo del catálogo es su propio grupo', () => {
    expect(tipoDeFiltro('VEHICULO')).toBe('VEHICULO')
    expect(tipoDeFiltro('PANTALLA')).toBe('PANTALLA')
  })

  // Hasta el 30/09 el POST aceptaba CUALQUIER texto en `tipo_activo` (solo la
  // pantalla lo limitaba a cuatro). Una fila con «Pantalla LED» escrita por la
  // API no puede quedar fuera de todos los filtros: cae en OTRO.
  it('un valor fuera del catálogo —texto libre de antes— cae en OTRO', () => {
    expect(tipoDeFiltro('Pantalla LED')).toBe('OTRO')
    expect(tipoDeFiltro('')).toBe('OTRO')
    expect(tipoDeFiltro(null)).toBe('OTRO')
  })

  it('no normaliza mayúsculas: «pantalla» no es PANTALLA', () => {
    // El servidor filtra con igualdad exacta; si aquí se normalizara, la
    // pantalla contaría la fila en un grupo y el filtro del servidor en otro.
    expect(tipoDeFiltro('pantalla')).toBe('OTRO')
  })
})

describe('etiquetaTipoActivo', () => {
  it('traduce los del catálogo y deja visible el texto libre de antes', () => {
    expect(etiquetaTipoActivo('CAMARA')).toBe(ETIQUETA_TIPO_ACTIVO.CAMARA)
    // No se esconde detrás de «Otro»: el texto es lo único que dice qué es.
    expect(etiquetaTipoActivo('Pantalla LED')).toBe('Pantalla LED')
    expect(etiquetaTipoActivo(null)).toBe(ETIQUETA_TIPO_ACTIVO.OTRO)
  })
})

describe('contarPorTipo y filtrarPorTipo', () => {
  const filas = [
    { id: '1', tipoActivo: 'VEHICULO' },
    { id: '2', tipoActivo: 'VEHICULO' },
    { id: '3', tipoActivo: 'CAMARA' },
    { id: '4', tipoActivo: 'Pantalla LED' },
    { id: '5', tipoActivo: 'OTRO' },
  ]

  it('cuenta por grupo, con los de texto libre dentro de OTRO', () => {
    const c = contarPorTipo(filas)
    expect(c.VEHICULO).toBe(2)
    expect(c.CAMARA).toBe(1)
    expect(c.OTRO).toBe(2)
    expect(c.HERRAMIENTA).toBe(0)
  })

  it('la suma de los grupos es el total: ninguna fila se pierde ni se cuenta dos veces', () => {
    const c = contarPorTipo(filas)
    const suma = Object.values(c).reduce((s, n) => s + n, 0)
    expect(suma).toBe(filas.length)
  })

  it('filtrar sin tipo devuelve todo; con tipo, solo su grupo', () => {
    expect(filtrarPorTipo(filas, null)).toHaveLength(5)
    expect(filtrarPorTipo(filas, 'VEHICULO').map((f) => f.id)).toEqual(['1', '2'])
    expect(filtrarPorTipo(filas, 'OTRO').map((f) => f.id)).toEqual(['4', '5'])
    expect(filtrarPorTipo(filas, 'HERRAMIENTA')).toEqual([])
  })
})
