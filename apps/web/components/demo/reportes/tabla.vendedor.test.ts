import { describe, it, expect } from 'vitest'
import { columnasDeDimension, ordenInicialDe, avisosDelReporte, formatoCelda } from './tabla'
import { DIMENSIONES_UI, sustantivoFila } from './consulta'

// ============================================================================
//  Las columnas de `vendedor`, y sobre todo LO QUE NO TRAE.
// ----------------------------------------------------------------------------
//  Esta pantalla ya tuvo el defecto que estas pruebas impiden, el 2026-09-18 y
//  con un navegador delante: la tabla pintaba SIEMPRE las columnas de `sitio`,
//  así que una dimensión podía calcular bien y no enseñar nada de lo suyo. No lo
//  ve nada automático — las columnas propias son campos OPCIONALES de
//  `FilaRentabilidad`, y un campo opcional que nadie lee no da error de tipos ni
//  de ejecución.
//
//  Y aquí hay un segundo motivo, propio de esta dimensión: las filas son
//  PERSONAS. Lo que se pinte de más mide a alguien por algo que no decidió.
// ============================================================================

// El resto del reporte que `avisosDelReporte` necesita para no mirar a ciegas.
// `desde`/`hasta` en un trimestre cerrado y `hoy` fijo: así ningún otro aviso
// —el del trimestre en curso— se cuela y ensucia lo que aquí se mide.
const RESTO = {
  desde: '2020-01-01',
  hasta: '2020-03-31',
  hoy: new Date('2026-02-15T12:00:00Z'),
  filas: [] as any[],
}

const COBERTURA = {
  reservasConVendedor: 3,
  reservasSinVendedor: 2,
  reservasSinPropuesta: 1,
  reservasDePropuestaSinVendedor: 1,
  ingresoSinVendedor: 64_000,
  nota: 'La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia. 2 de las 5 reservas del periodo salen en «Sin vendedor».',
}

describe('tabla — dimensión `vendedor`', () => {
  it('la dimensión se puede elegir en la pantalla', () => {
    // Un motor que nadie puede pedir desde el desplegable es un motor que no
    // existe para el dueño, que es quien hizo la pregunta.
    expect(DIMENSIONES_UI.map((d) => d.valor)).toContain('vendedor')
  })

  it('las filas se llaman VENDEDORES, no pantallas', () => {
    // El pie dice «N pantallas» en las cinco dimensiones que agrupan por
    // pantalla. Aquí diría una mentira sobre lo que se está contando.
    expect(sustantivoFila('vendedor')).toEqual({ singular: 'vendedor', plural: 'vendedores' })
  })

  it('trae quién, cuánto vendió, qué parte es, y la comparación — EN ESE ORDEN', () => {
    expect(columnasDeDimension('vendedor').map((c) => c.clave)).toEqual([
      'etiqueta',
      'ingreso',
      'pctDelIngreso',
      'ingresoLista',
      'ingresoComparable',
      'descuentoYComision',
      'descuentoYComisionPct',
    ])
  })

  it('NO trae ninguna columna de costo ni de margen', () => {
    // La más importante de este archivo. La renta que se le paga al arrendador
    // y las visitas de mantenimiento NO las decide el vendedor: un «margen de
    // Ana» la mediría por el precio de un contrato de arrendamiento que ella no
    // negoció, y que además cambiaría sin que ella hiciera nada.
    const claves = columnasDeDimension('vendedor').map((c) => c.clave)
    for (const c of [
      'costoEspacio',
      'costoOperacion',
      'costoEnergia',
      'costoTotal',
      'margen',
      'margenPct',
      'visitas',
      'kwh',
      'm2',
    ]) {
      expect(claves, `«${c}» no dice nada de una persona`).not.toContain(c)
    }
  })

  it('las columnas de la comparación se llaman IGUAL que en `tarifa`', () => {
    // Deliberado: es la misma cifra con otro agrupador. Dos columnas con el
    // mismo nombre midiendo cosas distintas harían que las dos pantallas no se
    // pudieran conciliar, y dos nombres para lo mismo harían dudar de cuál es.
    const enTarifa = columnasDeDimension('tarifa').map((c) => c.clave)
    for (const c of [
      'ingresoLista',
      'ingresoComparable',
      'descuentoYComision',
      'descuentoYComisionPct',
    ]) {
      expect(enTarifa).toContain(c)
      expect(columnasDeDimension('vendedor').map((x) => x.clave)).toContain(c)
    }
  })

  it('la brecha NO se llama «descuento» a secas', () => {
    // `neto = lista × (1−descuento) × (1−comisión)`: dentro va la comisión de la
    // agencia, que el vendedor no concede. Llamarla «Descuento» le atribuiría a
    // una persona una rebaja que no hizo.
    const col = columnasDeDimension('vendedor').find((c) => c.clave === 'descuentoYComision')!
    expect(col.label).toBe('Descuento y comisión')
    expect(col.label.toLowerCase()).toContain('comisión')
  })

  it('abre ordenada por quién VENDIÓ más', () => {
    // La pregunta tiene dos mitades —cuánto vendió y cuánto descontó— y esta es
    // la que da el marco: un 40 % de descuento sobre una venta de 2 000 no dice
    // nada del negocio. El otro orden está a un clic, en su columna.
    expect(ordenInicialDe('vendedor')).toEqual({ columna: 'ingreso', direccion: 'desc' })
  })
})

describe('el aviso del histórico — lo que hace que la tabla no se lea como rota', () => {
  it('se pinta en ÁMBAR cuando queda dinero sin vendedor, con la nota del motor VERBATIM', () => {
    const avisos = avisosDelReporte({ ...RESTO, dimension: 'vendedor', vendedores: COBERTURA } as any)
    const a = avisos.find((x) => x.clave === 'vendedor-sin-atribuir')
    expect(a, JSON.stringify(avisos)).toBeTruthy()
    expect(a!.tono).toBe('alerta')
    // VERBATIM: reescribir la frase aquí sería la segunda implementación de la
    // misma explicación, y divergir significaría decirle al usuario que falta
    // otra cosa de la que falta.
    expect(a!.texto).toBe(COBERTURA.nota)
  })

  it('se pinta TAMBIÉN cuando no falta nada, en gris', () => {
    // «Todo atribuido» y «no te lo digo» se ven igual sin texto. Y su primera
    // frase hace falta siempre: sin ella la columna de la brecha se lee como si
    // el vendedor hubiera regalado toda esa diferencia.
    const avisos = avisosDelReporte({
      ...RESTO,
      dimension: 'vendedor',
      vendedores: { ...COBERTURA, reservasSinVendedor: 0, ingresoSinVendedor: 0 },
    } as any)
    const a = avisos.find((x) => x.clave === 'vendedor-sin-atribuir')!
    expect(a.tono).toBe('info')
    expect(a.texto).toBeTruthy()
  })

  it('NO se cuela en las otras dimensiones', () => {
    // El reporte solo trae `vendedores` en su dimensión. Si el aviso se pintara
    // sin el dato, diría algo de un reporte que no lo contesta.
    const avisos = avisosDelReporte({ ...RESTO, dimension: 'sitio' } as any)
    expect(avisos.map((x) => x.clave)).not.toContain('vendedor-sin-atribuir')
  })
})

describe('RAYA y no cero, en la celda', () => {
  it('un `null` en las cuatro columnas se pinta como raya, no como $0.00', () => {
    // El corazón de la doctrina, en el último sitio donde se puede estropear:
    // el formateo. Un «$0.00» en «Descuento y comisión» afirma que esa persona
    // no concedió ninguno; una raya dice que no se sabe.
    //
    // Se recorren las columnas REALES de la dimensión y se usa SU formato, no
    // uno escrito a mano aquí: si mañana alguien le cambia el formato a una de
    // las cuatro, esta prueba lo sigue mirando en vez de comprobar una columna
    // que ya no existe.
    const cuatro = columnasDeDimension('vendedor').filter((c) =>
      ['ingresoLista', 'ingresoComparable', 'descuentoYComision', 'descuentoYComisionPct'].includes(
        c.clave,
      ),
    )
    expect(cuatro).toHaveLength(4)
    for (const col of cuatro) {
      expect(formatoCelda(null, col.formato), col.clave).toBe('—')
    }
  })

  it('y un cero de verdad SÍ se pinta como cero (control positivo)', () => {
    // Sin esto, un formateador que devolviera siempre una raya pasaría la
    // prueba de arriba sin distinguir nada.
    expect(formatoCelda(0, 'dinero')).toMatch(/0/)
    expect(formatoCelda(0, 'porcentaje')).toMatch(/0/)
  })
})
