import { describe, it, expect, vi } from 'vitest'
import { AppError } from './errores'

// La base NO se toca en estas pruebas, y el doble lo demuestra: si la
// validación o el 501 llegaran a leer, la llamada contaría aquí. Además evita
// arrastrar `db.ts` → `pg` y `tenant.ts` → `cache` de React, que fuera del
// runtime de Next no existe; es el mismo patrón de
// `arrendadores-repo.editar-contrato.test.ts`.
const lecturas: unknown[] = []
vi.mock('./reportes-repo', () => ({
  datosRentabilidad: vi.fn(async (rango: unknown) => {
    lecturas.push(rango)
    return { sitios: [], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: [], costosOt: {} }
  }),
}))

const {
  validarConsultaRentabilidad,
  rentabilidadCtrl,
  DIMENSIONES,
  GRANULARIDADES,
} = await import('./reportes-controller')

// ============================================================================
//  La validación del límite. Corre ANTES de tocar la base, así que se prueba
//  sin Postgres — mismo criterio que `finanzas-controller.plazos.test.ts`.
// ----------------------------------------------------------------------------
//  Lo que se está protegiendo aquí no es la comodidad del cliente: es que
//  `dimension` y `granularidad` acaban decidiendo POR QUÉ SE AGRUPA. Un
//  agrupador que entre como texto libre es inyección por la puerta de servicio,
//  y no se ve en ninguna prueba que solo mire el camino feliz. Por eso son
//  ENUMS CERRADOS y por eso la mayoría de estas pruebas son negativas.
// ============================================================================

const OK = { dimension: 'sitio', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' }

function status(fn: () => unknown): number | null {
  try {
    fn()
    return null
  } catch (e) {
    return e instanceof AppError ? e.status : -1
  }
}

describe('validarConsultaRentabilidad — el camino bueno', () => {
  it('acepta la consulta completa y devuelve los valores tipados', () => {
    expect(validarConsultaRentabilidad(OK)).toEqual({
      dimension: 'sitio', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31',
    })
  })

  it('un solo dia es un rango valido', () => {
    expect(validarConsultaRentabilidad({ ...OK, hasta: '2026-01-01' }).hasta).toBe('2026-01-01')
  })

  it('acepta las cuatro dimensiones y las dos granularidades declaradas', () => {
    for (const d of DIMENSIONES) {
      expect(validarConsultaRentabilidad({ ...OK, dimension: d }).dimension).toBe(d)
    }
    for (const g of GRANULARIDADES) {
      expect(validarConsultaRentabilidad({ ...OK, granularidad: g }).granularidad).toBe(g)
    }
  })
})

describe('validarConsultaRentabilidad — NEGATIVOS, que es lo que importa', () => {
  // El caso que da nombre a todo esto: si `dimension` llegara al SQL, esto
  // sería un `group by` inyectado. Tiene que morir en la validación con 400,
  // no en la base con 500.
  it('una dimension que no esta en el enum da 400', () => {
    expect(status(() => validarConsultaRentabilidad({ ...OK, dimension: 'arrendador' }))).toBe(400)
  })

  it('una dimension con SQL dentro da 400, no 500', () => {
    const veneno = "sitio; drop table reservas--"
    expect(status(() => validarConsultaRentabilidad({ ...OK, dimension: veneno }))).toBe(400)
  })

  it('una granularidad fuera del enum da 400 (incluidas las de la grafica)', () => {
    // `dia` y `semana` SÍ existen en `Granularidad` (derive.ts) para la gráfica
    // de ocupación, y NO valen para este reporte: un reporte de rentabilidad por
    // día sobre historia de años es justo lo que este endpoint viene a evitar.
    expect(status(() => validarConsultaRentabilidad({ ...OK, granularidad: 'dia' }))).toBe(400)
    expect(status(() => validarConsultaRentabilidad({ ...OK, granularidad: 'semana' }))).toBe(400)
    expect(status(() => validarConsultaRentabilidad({ ...OK, granularidad: 'anio' }))).toBe(400)
  })

  it('el rango invertido (desde > hasta) da 400', () => {
    expect(status(() => validarConsultaRentabilidad({ ...OK, desde: '2026-03-31', hasta: '2026-01-01' }))).toBe(400)
  })

  // Comparar fechas COMO TEXTO solo funciona con ceros a la izquierda:
  // '2026-9-1' < '2026-10-01' como cadenas y al revés en el calendario. Ese
  // defecto ya se pagó dos veces en este repo (`lib/server/fechas.ts`).
  it('el rango invertido se detecta aunque las fechas vengan sin ceros a la izquierda', () => {
    expect(status(() => validarConsultaRentabilidad({ ...OK, desde: '2026-9-1', hasta: '2026-10-01' }))).toBeNull()
    expect(status(() => validarConsultaRentabilidad({ ...OK, desde: '2026-10-01', hasta: '2026-9-1' }))).toBe(400)
  })

  it('una fecha que no es fecha da 400', () => {
    expect(status(() => validarConsultaRentabilidad({ ...OK, desde: 'ayer' }))).toBe(400)
    expect(status(() => validarConsultaRentabilidad({ ...OK, hasta: '' }))).toBe(400)
  })

  it('faltar una fecha da 400: el reporte no inventa un rango por omision', () => {
    // Un rango por omisión sobre historia de años es una consulta sin límite
    // disfrazada de comodidad.
    expect(status(() => validarConsultaRentabilidad({ dimension: 'sitio', granularidad: 'mes' }))).toBe(400)
  })

  it('un parametro de mas da 400: un typo no se ignora en silencio', () => {
    expect(status(() => validarConsultaRentabilidad({ ...OK, tenantId: 'otro' }))).toBe(400)
  })

  // El caso serio de un `tenantId` por parámetro: aunque el schema no fuera
  // estricto, la consulta NO tiene por dónde aceptar un tenant. El tenant sale
  // de la sesión, nunca de la petición.
  it('la consulta validada NO tiene campo de tenant', () => {
    expect(Object.keys(validarConsultaRentabilidad(OK))).toEqual(
      expect.not.arrayContaining(['tenantId', 'tenant']),
    )
  })
})

describe('rentabilidadCtrl — las cuatro dimensiones tienen motor', () => {
  async function statusAsync(fn: () => Promise<unknown>): Promise<number | null> {
    try {
      await fn()
      return null
    } catch (e) {
      return e instanceof AppError ? e.status : -1
    }
  }

  // Hasta el 2026-09-18 `trimestre`, `operacion` y `m2` contestaban 501: la
  // dimensión era parte del contrato del endpoint y no tenía motor. Ya lo tiene,
  // y lo que este bloque protege es que NINGUNA vuelva a quedarse sin él: el
  // despacho es un `Record<DimensionRentabilidad, Motor>` EXHAUSTIVO, así que
  // añadir una dimensión al enum sin escribir su motor ya no compila — no hace
  // falta un 501 en tiempo de ejecución para lo que el tipo garantiza antes.
  it('ninguna dimension declarada devuelve 501', async () => {
    for (const d of DIMENSIONES) {
      expect(await statusAsync(() => rentabilidadCtrl({ ...OK, dimension: d })), d).toBeNull()
    }
  })

  it('cada dimension devuelve un reporte que dice CUAL es', async () => {
    for (const d of DIMENSIONES) {
      const r = await rentabilidadCtrl({ ...OK, dimension: d })
      expect(r.dimension, d).toBe(d)
      expect(r.desde).toBe('2026-01-01')
      expect(r.hasta).toBe('2026-03-31')
    }
  })

  it('solo m2 trae el recuento de exclusiones, porque solo m2 excluye', async () => {
    // Un campo que aparece en las cuatro dimensiones con valor cero invita a
    // pintarlo siempre; aquí solo significa algo en `m2`.
    expect((await rentabilidadCtrl({ ...OK, dimension: 'm2' })).excluidas).toBeDefined()
    for (const d of ['sitio', 'trimestre', 'operacion']) {
      expect((await rentabilidadCtrl({ ...OK, dimension: d })).excluidas, d).toBeUndefined()
    }
  })

  it('una dimension invalida no lee la base', async () => {
    lecturas.length = 0
    await rentabilidadCtrl({ ...OK, dimension: 'arrendador' }).catch(() => {})
    expect(lecturas).toEqual([])
  })

  it('sitio si lee, y le pasa el rango VALIDADO al repo', async () => {
    lecturas.length = 0
    const r = await rentabilidadCtrl(OK)
    expect(lecturas).toEqual([
      { dimension: 'sitio', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' },
    ])
    expect(r.dimension).toBe('sitio')
    expect(r.filas).toEqual([])
  })
})
