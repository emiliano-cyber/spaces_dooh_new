import { describe, it, expect } from 'vitest'
import { COSTOS_OT_RESPALDO, costoDeOt, sanearCostosOt } from './costos-ot'
import { TODOS_TIPOS_OT } from './tipos-ot'

// ============================================================================
//  El costo de una orden de trabajo sale POR TIPO y desde Configuración.
// ----------------------------------------------------------------------------
//  Antes era la constante `COSTO_OPERATIVO_POR_OT = 1500` de
//  `lib/data/derive.ts:254`, cuyo propio comentario admitía que era un
//  parámetro de demo: «en producción vendría de ConfigNegocio o por tipo de
//  OT». El margen de toda la aplicación —dashboard, P&L de campaña y ahora los
//  reportes de rentabilidad— se apoyaba en ese 1500 a fuego, igual para montar
//  una lona que para una inspección.
//
//  Lo que estas pruebas fijan es el modo de fallo, no el número: una
//  organización que NO haya configurado nada tiene que seguir obteniendo el
//  mismo margen que hoy, y una que sí lo configure tiene que mandar. Que el
//  motor reviente —o devuelva 0— por un tenant sin configurar sería peor que la
//  constante: un costo ausente no se ve, se cree.
// ============================================================================

describe('costoDeOt — configuración por tipo con respaldo', () => {
  it('un tipo SIN configurar cae al respaldo', () => {
    expect(costoDeOt('MANTENIMIENTO_PREVENTIVO', {})).toBe(
      COSTOS_OT_RESPALDO.MANTENIMIENTO_PREVENTIVO,
    )
  })

  it('sin configuración ninguna (null / undefined) tambien cae al respaldo', () => {
    expect(costoDeOt('HERRERIA', null)).toBe(COSTOS_OT_RESPALDO.HERRERIA)
    expect(costoDeOt('HERRERIA', undefined)).toBe(COSTOS_OT_RESPALDO.HERRERIA)
  })

  it('un tipo CONFIGURADO manda sobre el respaldo', () => {
    expect(costoDeOt('HERRERIA', { HERRERIA: 4200 })).toBe(4200)
  })

  it('configurar un tipo NO altera el de los demas', () => {
    const cfg = { HERRERIA: 4200 }
    expect(costoDeOt('INSPECCION', cfg)).toBe(COSTOS_OT_RESPALDO.INSPECCION)
  })

  // El 0 es un costo capturable de verdad: una inspección que hace el propio
  // dueño no cuesta cuadrilla. Mismo criterio que `plazosCobranzaDelTenant`
  // con el plazo 0 — filtrarlo sería volver a decidir por el usuario.
  it('un costo configurado en 0 SI manda: no se confunde con «sin configurar»', () => {
    expect(costoDeOt('INSPECCION', { INSPECCION: 0 })).toBe(0)
  })

  // ─── Negativos: la configuración viene de una columna jsonb, así que puede
  //     traer cualquier cosa. Nada de esto debe colarse al margen.
  it('un valor basura (texto, negativo, NaN, null) cae al respaldo', () => {
    const cfg = {
      HERRERIA: 'mucho',
      ELECTRICO: -500,
      DESMONTAJE: Number.NaN,
      OTRO: null,
    } as unknown as Record<string, number>
    expect(costoDeOt('HERRERIA', cfg)).toBe(COSTOS_OT_RESPALDO.HERRERIA)
    expect(costoDeOt('ELECTRICO', cfg)).toBe(COSTOS_OT_RESPALDO.ELECTRICO)
    expect(costoDeOt('DESMONTAJE', cfg)).toBe(COSTOS_OT_RESPALDO.DESMONTAJE)
    expect(costoDeOt('OTRO', cfg)).toBe(COSTOS_OT_RESPALDO.OTRO)
  })

  // Un tipo que no está en el enum no puede costar 0 en silencio: 0 se suma sin
  // que nada falle y deja el margen inflado. Cae al respaldo de OTRO, que es
  // justo la casilla que el enum reserva para lo que no tiene casilla.
  it('un tipo fuera del enum cae al respaldo de OTRO, no a 0', () => {
    expect(costoDeOt('LO_QUE_SEA', {})).toBe(COSTOS_OT_RESPALDO.OTRO)
  })
})

describe('COSTOS_OT_RESPALDO — cubre el enum entero', () => {
  // Guard: el día que alguien añada un tipo a `tipo_ot` (db/schema.sql:53) sin
  // darle respaldo, esta prueba lo caza. Sin ella, el tipo nuevo entraría al
  // motor de costos por la puerta de OTRO y nadie lo notaría.
  it('hay un respaldo por cada tipo del catalogo', () => {
    for (const t of TODOS_TIPOS_OT) {
      expect(COSTOS_OT_RESPALDO[t], `falta respaldo para ${t}`).toBeTypeOf('number')
    }
    expect(Object.keys(COSTOS_OT_RESPALDO).sort()).toEqual([...TODOS_TIPOS_OT].sort())
  })
})

describe('sanearCostosOt — lo que se guarda en la columna', () => {
  it('descarta las claves que no son tipos del enum', () => {
    expect(sanearCostosOt({ HERRERIA: 100, INVENTADO: 999 })).toEqual({ HERRERIA: 100 })
  })

  it('descarta los importes que no son numeros finitos y no negativos', () => {
    expect(
      sanearCostosOt({ HERRERIA: -1, ELECTRICO: 'x', INSPECCION: 0, DESMONTAJE: 2500 }),
    ).toEqual({ INSPECCION: 0, DESMONTAJE: 2500 })
  })

  it('una entrada que no es objeto da el mapa vacio, no revienta', () => {
    expect(sanearCostosOt(null)).toEqual({})
    expect(sanearCostosOt('{}')).toEqual({})
    expect(sanearCostosOt([1, 2])).toEqual({})
  })
})
