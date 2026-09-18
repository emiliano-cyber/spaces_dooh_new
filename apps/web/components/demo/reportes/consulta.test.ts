import { describe, it, expect } from 'vitest'
import {
  DIMENSIONES_UI,
  GRANULARIDADES_UI,
  RUTA_RENTABILIDAD,
  RANGO_DE_APERTURA,
  construirConsulta,
  motivoInvalido,
  rangoDelTrimestreCerradoDe,
  rangoDelTrimestreDe,
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

describe('2 · las cuatro dimensiones del contrato estan declaradas', () => {
  it('declara las cuatro, en el mismo orden del contrato', () => {
    expect(DIMENSIONES_UI.map((d) => d.valor)).toEqual(['sitio', 'trimestre', 'operacion', 'm2'])
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

describe('4 · el rango que se propone al abrir es el ULTIMO TRIMESTRE CERRADO', () => {
  it('propone el trimestre COMPLETO anterior, no el que esta en curso', () => {
    // EL DEFECTO, y el que mas caro sale de los tres. Con el trimestre EN CURSO
    // la pantalla abria en un periodo a medias: en la base de demostracion,
    // jul-sep 2026 no tiene ingresos y SI tiene renta, asi que lo primero que
    // se veia era el negocio perdiendo 184 500.
    //
    // El motivo del cambio es de PRODUCTO, no de demo: un trimestre en curso
    // siempre se lee peor que uno completo —la renta se devenga desde el dia 1
    // y las reservas se cobran al cerrar—, asi que el reporte abriria dando una
    // impresion falsa a cualquier cliente, el suyo incluido.
    expect(RANGO_DE_APERTURA(new Date(2026, 8, 18))).toEqual({ desde: '2026-04-01', hasta: '2026-06-30' })
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 8, 18))).toEqual({ desde: '2026-04-01', hasta: '2026-06-30' })
  })

  it('en enero retrocede de AÑO, no a un T4 del año en curso', () => {
    // Un `mes - 3` sin cruzar el año daria `2026-10-01` a `2026-12-31`: un
    // trimestre que todavia no ha pasado, presentado como cerrado. No da error.
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 0, 5))).toEqual({ desde: '2025-10-01', hasta: '2025-12-31' })
    expect(rangoDelTrimestreCerradoDe(new Date(2026, 2, 31))).toEqual({ desde: '2025-10-01', hasta: '2025-12-31' })
  })

  it('el cerrado NUNCA solapa al que esta en curso', () => {
    // Un solo dia de solape metaria en el reporte el periodo incompleto que
    // este cambio existe para sacar.
    for (const mes of [0, 1, 3, 5, 6, 8, 9, 11]) {
      const hoy = new Date(2026, mes, 15)
      const cerrado = rangoDelTrimestreCerradoDe(hoy)
      const enCurso = rangoDelTrimestreDe(hoy)
      expect(cerrado.hasta < enCurso.desde, `mes ${mes}`).toBe(true)
    }
  })

  it('el trimestre EN CURSO se conserva, porque la decision es del dueño', () => {
    // `rangoDelTrimestreDe` no se borra: volver al trimestre en curso es
    // cambiar UNA linea (`RANGO_DE_APERTURA`), y es una decision de producto
    // que el dueño puede querer al reves.
    expect(rangoDelTrimestreDe(new Date(2026, 1, 15))).toEqual({ desde: '2026-01-01', hasta: '2026-03-31' })
    expect(rangoDelTrimestreDe(new Date(2026, 8, 30))).toEqual({ desde: '2026-07-01', hasta: '2026-09-30' })
    expect(rangoDelTrimestreDe(new Date(2026, 11, 1))).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' })
  })

  it('el rango propuesto siempre es valido para el endpoint', () => {
    for (const mes of [0, 3, 6, 9, 11]) {
      const r = RANGO_DE_APERTURA(new Date(2026, mes, 20))
      expect(motivoInvalido({ ...base, ...r }), `mes ${mes}`).toBeNull()
    }
  })
})
