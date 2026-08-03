import { describe, it, expect } from 'vitest'
import { filasDeInventario, nombreArchivo, neutralizarFormulas, COLUMNAS_PLANTILLA } from './inventario-export'
import { validarFila } from './inventario-import'
import type { Sitio } from './data/types'

// ============================================================================
//  Lo que se descarga se tiene que poder volver a subir.
//
//  El valor de exportar en el formato de la plantilla no es que las columnas se
//  llamen igual: es que el archivo VIAJE de ida y vuelta. Por eso estas pruebas
//  no comparan contra una lista de encabezados escrita a mano —eso solo probaría
//  que copié bien la constante— sino que meten la fila exportada por el
//  validador REAL del importador y comprueban que sale sin errores y con los
//  mismos valores.
// ============================================================================

const SITIO_BASE: Partial<Sitio> = {
  codigoProveedor: 'S-001',
  nombre: 'Espectacular Reforma',
  tipoMedio: 'ESPECTACULAR',
  exhibicion: 'fijo',
  unidad: 'mensual',
  esRotativo: false,
  plazaCiudad: 'CDMX',
  ciudad: 'CDMX',
  direccion: 'Av. Reforma 222',
  lat: 19.43,
  lng: -99.13,
  ancho: 12,
  alto: 4,
  caras: 1,
  iluminado: true,
  tipoEstructura: 'unipolar',
  vista: 'N-S',
  tramo: 'Reforma',
  tarifaPublicada: 50000,
  costoCompra: 20000,
  spotsPorHora: null,
  duracionSpotSeg: null,
  horario: null,
  notas: null,
  pendienteVerificacion: false,
}

const sitio = (over: Partial<Sitio> = {}): Sitio => ({ ...SITIO_BASE, ...over }) as Sitio

describe('el inventario exportado se puede reimportar', () => {
  it('una fila exportada pasa el validador del importador sin errores', () => {
    const [fila] = filasDeInventario([sitio()])
    const r = validarFila(fila as Record<string, unknown>, 0)
    expect(r.status).not.toBe('error')
    expect(r.datos).not.toBeNull()
  })

  it('conserva los valores al ir y volver', () => {
    const [fila] = filasDeInventario([sitio()])
    const { datos } = validarFila(fila as Record<string, unknown>, 0)
    expect(datos!.nombre).toBe('Espectacular Reforma')
    expect(datos!.codigo_proveedor).toBe('S-001')
    expect(datos!.tarifa_publicada).toBe(50000)
    expect(datos!.exhibicion).toBe('fijo')
    expect(datos!.unidad).toBe('mensual')
    expect(datos!.iluminacion).toBe(true)
    expect(datos!.es_rotativo).toBe(false)
    expect(datos!.latitud).toBeCloseTo(19.43)
  })

  it('la renta al arrendador sobrevive al viaje (es el costo único, ADR 0006)', () => {
    const [fila] = filasDeInventario([sitio({ costoCompra: 20000 })])
    expect(fila.renta_arrendador).toBe(20000)
    const { datos } = validarFila(fila as Record<string, unknown>, 0)
    expect(datos!.renta_arrendador).toBe(20000)
  })

  it('saca una fila por modalidad, como espera el importador', () => {
    const filas = filasDeInventario([
      sitio({
        modalidadesDetalle: [
          { unidad: 'mensual', tarifaPublicada: 50000, costoCompra: 20000 },
          { unidad: 'catorcenal', tarifaPublicada: 28000, costoCompra: 11000 },
        ],
      }),
    ])
    expect(filas).toHaveLength(2)
    // Mismo código: así el importador las agrupa en UNA pantalla con dos modalidades.
    expect(new Set(filas.map((f) => f.codigo_proveedor))).toEqual(new Set(['S-001']))
    expect(filas.map((f) => f.unidad)).toEqual(['mensual', 'catorcenal'])
    expect(filas.map((f) => f.tarifa_publicada)).toEqual([50000, 28000])
  })

  it('una pantalla sin modalidades detalladas igual sale (no se pierde del archivo)', () => {
    const filas = filasDeInventario([sitio({ modalidadesDetalle: [] })])
    expect(filas).toHaveLength(1)
    expect(filas[0].unidad).toBe('mensual')
  })

  it('todas las columnas de la plantilla están presentes en cada fila', () => {
    const [fila] = filasDeInventario([sitio()])
    // El orden lo impone `construirArchivo`; aquí basta con que no falte ninguna.
    for (const c of COLUMNAS_PLANTILLA) expect(Object.keys(fila)).toContain(c)
  })
})

describe('lo que NO se debe exportar', () => {
  it('no saca las coordenadas por defecto: son "sin capturar", no un dato', () => {
    // Si salieran, al reimportar dejarían de estar pendientes de verificación y
    // el centro de la CDMX pasaría por ubicación buena.
    const [fila] = filasDeInventario([sitio({ pendienteVerificacion: true })])
    expect(fila.latitud).toBe('')
    expect(fila.longitud).toBe('')
    const { datos } = validarFila(fila as Record<string, unknown>, 0)
    expect(datos!.pendienteVerificacion).toBe(true)
  })

  it('la renta en CERO sale vacía: un 0 guardado significa «pendiente», no «gratis»', () => {
    // El importador rechaza toda renta <= 0, asi que el sistema nunca guarda un
    // 0 legitimo. Exportarlo como 0 lo afirmaria como dato, y al reimportar
    // levantaria una advertencia por una fila que esta bien.
    const [fila] = filasDeInventario([
      sitio({ modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 9500, costoCompra: 0 }] }),
    ])
    expect(fila.renta_arrendador).toBe('')
    const { datos, status } = validarFila(fila as Record<string, unknown>, 0)
    expect(datos!.renta_arrendador).toBeNull()
    expect(status).toBe('ok') // sin advertencia: la fila viaja limpia
  })

  it('deja la celda vacía —no un cero— cuando no hay dato', () => {
    // Un 0 en renta_arrendador se leería como «el espacio es gratis».
    const [fila] = filasDeInventario([
      sitio({ modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 50000, costoCompra: null as never }] }),
    ])
    expect(fila.renta_arrendador).toBe('')
    const { datos } = validarFila(fila as Record<string, unknown>, 0)
    expect(datos!.renta_arrendador).toBeNull()
  })
})

describe('nombre del archivo', () => {
  it('lleva la fecha, para que dos descargas no se pisen', () => {
    expect(nombreArchivo(new Date(2026, 7, 3), 'xlsx')).toBe('inventario-2026-08-03.xlsx')
    expect(nombreArchivo(new Date(2026, 11, 25), 'csv')).toBe('inventario-2026-12-25.csv')
  })
})

describe('inyección de fórmulas en CSV', () => {
  it('neutraliza los valores que Excel abriría como fórmula', () => {
    const f = neutralizarFormulas({
      nombre: '=HYPERLINK("http://malo","ver")',
      direccion: '+1+1',
      notas: '-2',
      tramo: '@SUM(A1)',
      // Lo normal no se toca.
      codigo_proveedor: 'S-001',
      tarifa_publicada: 50000,
    })
    expect(f.nombre).toBe('\'=HYPERLINK("http://malo","ver")')
    expect(f.direccion).toBe("'+1+1")
    expect(f.notas).toBe("'-2")
    expect(f.tramo).toBe("'@SUM(A1)")
    expect(f.codigo_proveedor).toBe('S-001')
    expect(f.tarifa_publicada).toBe(50000)
  })

  it('un número negativo real sigue siendo número, no texto', () => {
    // Los números no son cadenas, así que la regla no los alcanza: si los
    // convirtiera en texto, la columna dejaría de sumar en Excel.
    expect(neutralizarFormulas({ latitud: -99.13 }).latitud).toBe(-99.13)
  })
})
