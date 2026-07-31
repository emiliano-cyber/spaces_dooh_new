import { describe, it, expect } from 'vitest'
import {
  PERIODICIDADES,
  FACTOR_MENSUAL,
  DIAS_AVISO_PAGO,
  factorMensual,
  montoMensualEquivalente,
  periodoDeIndice,
  periodicidadLabel,
  diasAvisoPago,
  diasCriticoPago,
  clasificarVencimiento,
  textoVencimiento,
  type PeriodicidadRenta,
} from './renta-periodicidad'

// ============================================================================
//  Periodicidad de la renta al arrendador.
//
//  El objeto de estas pruebas NO es comprobar aritmética evidente, sino los dos
//  modos de fallo que este módulo existe para evitar:
//
//   1. DERIVA ENTRE TABLAS. El factor mensual, las etiquetas, el avance de
//      vencimientos y el margen de aviso son cuatro tablas indexadas por el
//      mismo enum. Antes vivían en archivos distintos y una periodicidad nueva
//      podía entrar en una y faltar en otra: el `?? 1` de cada tabla la trataba
//      como mensual y el P&L subestimaba la renta SIN FALLAR. Los tests de
//      cobertura de abajo convierten ese fallo silencioso en un test rojo.
//
//   2. REGRESIÓN DEL UMBRAL DE AVISO. El margen de recordatorio pasó de un 90
//      fijo a uno proporcional a la cadencia. Un contrato ANUAL tiene que
//      seguir comportándose exactamente igual que antes del cambio.
// ============================================================================

const VALORES = PERIODICIDADES.map((p) => p.value)

describe('cobertura del enum: ninguna tabla puede quedarse atrás', () => {
  it('las 9 periodicidades del enum están en la lista de selectores', () => {
    // Espejo de `periodicidad_pago` en db/schema.sql. Si se añade un valor a la
    // BD sin añadirlo aquí, este test lo dice.
    expect(VALORES).toEqual([
      'DIARIA', 'SEMANAL', 'CATORCENAL', 'QUINCENAL', 'MENSUAL',
      'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL',
    ])
  })

  it('toda periodicidad tiene factor mensual, etiqueta y margen de aviso', () => {
    for (const p of VALORES) {
      expect(FACTOR_MENSUAL[p], `falta FACTOR_MENSUAL[${p}]`).toBeGreaterThan(0)
      expect(DIAS_AVISO_PAGO[p], `falta DIAS_AVISO_PAGO[${p}]`).toBeGreaterThan(0)
      expect(periodicidadLabel(p), `falta etiqueta de ${p}`).not.toBe('—')
    }
  })

  it('toda periodicidad avanza el vencimiento (ninguna cae en el default mensual por descuido)', () => {
    // Una cadencia que no esté en ninguna de las dos tablas de `periodoDeIndice`
    // cae en el default y avanza un mes. Se detecta comprobando que cada una
    // produce un salto DISTINTO de las demás, salvo MENSUAL que es el default
    // legítimo.
    const desde = new Date(2026, 0, 1)
    const saltos = new Map<number, PeriodicidadRenta[]>()
    for (const p of VALORES) {
      const dias = Math.round((periodoDeIndice(desde, 1, p).getTime() - desde.getTime()) / 86_400_000)
      saltos.set(dias, [...(saltos.get(dias) ?? []), p])
    }
    for (const [dias, ps] of saltos) {
      expect(ps, `${ps.join(' y ')} avanzan lo mismo (${dias} días)`).toHaveLength(1)
    }
  })
})

describe('factor mensual', () => {
  it('DIARIA vale ×30 — el mes comercial que ya asumía SEMANAL', () => {
    // 500/día son 15 000/mes. Si alguien olvidara DIARIA en la tabla, el `?? 1`
    // la trataría como mensual y el P&L reportaría 500: un error de 30×.
    expect(montoMensualEquivalente(500, 'DIARIA')).toBe(15_000)
    expect(FACTOR_MENSUAL.DIARIA).toBe(30)
  })

  it('las periodicidades preexistentes no cambian de valor', () => {
    // Blindaje del histórico: mover cualquiera de estos movería el costo de
    // renta ya reportado de todos los contratos vigentes.
    expect(montoMensualEquivalente(60_000, 'ANUAL')).toBe(5_000)
    expect(montoMensualEquivalente(30_000, 'TRIMESTRAL')).toBe(10_000)
    expect(montoMensualEquivalente(7_000, 'SEMANAL')).toBe(30_000)
    expect(montoMensualEquivalente(1_000, 'MENSUAL')).toBe(1_000)
  })

  it('un contrato INCOMPLETO aporta 0, no un importe inventado', () => {
    // ADR 0001: sin importe capturado el costo se DESCONOCE. Suponerle un valor
    // falsearía el margen tanto como omitirlo, pero en la otra dirección.
    expect(montoMensualEquivalente(null, null)).toBe(0)
    expect(montoMensualEquivalente(undefined, 'MENSUAL')).toBe(0)
  })

  it('reconoce las etiquetas legacy en minúscula que dejó el seed viejo', () => {
    expect(factorMensual('mensual')).toBe(1)
    expect(factorMensual('anual')).toBeCloseTo(1 / 12)
    expect(factorMensual('diario')).toBe(30)
    // 'diaria' no debe colarse por la rama de 'anu'/'año'.
    expect(factorMensual('diaria')).toBe(30)
  })

  it('una periodicidad desconocida se trata como mensual, no como 0', () => {
    // Devolver 0 haría desaparecer la renta del P&L; mensual es el default de
    // la columna en la BD y el error más contenido.
    expect(factorMensual('LO_QUE_SEA')).toBe(1)
  })
})

describe('avance del calendario de pagos', () => {
  // Fechas de CALENDARIO en hora local, que es como llegan aquí: el generador
  // construye el inicio desde una columna `date`, que el driver resuelve a la
  // medianoche local. Escribirlas como '2026-03-10T00:00:00Z' significaría el 9
  // en México y el 10 en UTC, y el test diría cosas distintas según dónde corra.
  const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d)
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('el índice 0 es la fecha de inicio', () => {
    expect(ymd(periodoDeIndice(fecha(2026, 3, 10), 0, 'MENSUAL'))).toBe('2026-03-10')
  })

  it('DIARIA avanza un día', () => {
    expect(ymd(periodoDeIndice(fecha(2026, 3, 10), 1, 'DIARIA'))).toBe('2026-03-11')
  })

  it('los saltos en meses conservan el día del mes', () => {
    expect(ymd(periodoDeIndice(fecha(2026, 3, 15), 1, 'TRIMESTRAL'))).toBe('2026-06-15')
    expect(ymd(periodoDeIndice(fecha(2026, 10, 1), 1, 'BIMESTRAL'))).toBe('2026-12-01')
  })

  // ─── El defecto que corrigió el ADR 0007 ─────────────────────────────────
  // Antes se avanzaba de uno en uno con `Date.setMonth`, que desborda: del 31 de
  // enero + 1 mes salía el 3 de marzo. Febrero se quedaba SIN cuota y la serie
  // entera pasaba a caer a principios de mes.
  it('un mes corto recorta al último día, no desborda al siguiente', () => {
    expect(ymd(periodoDeIndice(fecha(2026, 1, 31), 1, 'MENSUAL'))).toBe('2026-02-28')
    expect(ymd(periodoDeIndice(fecha(2027, 1, 29), 1, 'MENSUAL'))).toBe('2027-02-28')
    expect(ymd(periodoDeIndice(fecha(2026, 3, 31), 1, 'MENSUAL'))).toBe('2026-04-30')
  })

  // La otra mitad, y la razón de anclar al inicio en vez de acumular: tras el
  // mes corto el día ANCLA se recupera. Acumulando, el 28 se quedaría pegado
  // para siempre y la renta se cobraría un día antes cada mes a partir de ahí.
  it('después del mes corto se recupera el día original', () => {
    expect(ymd(periodoDeIndice(fecha(2027, 1, 29), 2, 'MENSUAL'))).toBe('2027-03-29')
    expect(ymd(periodoDeIndice(fecha(2026, 1, 31), 2, 'MENSUAL'))).toBe('2026-03-31')
    expect(ymd(periodoDeIndice(fecha(2026, 1, 31), 3, 'MENSUAL'))).toBe('2026-04-30')
  })

  it('el 29 de febrero solo existe en año bisiesto', () => {
    expect(ymd(periodoDeIndice(fecha(2028, 1, 29), 1, 'MENSUAL'))).toBe('2028-02-29')
    // ANUAL desde un 29 de febrero: el año siguiente no lo tiene.
    expect(ymd(periodoDeIndice(fecha(2028, 2, 29), 1, 'ANUAL'))).toBe('2029-02-28')
    expect(ymd(periodoDeIndice(fecha(2028, 2, 29), 4, 'ANUAL'))).toBe('2032-02-29')
  })

  it('cruza el año correctamente', () => {
    expect(ymd(periodoDeIndice(fecha(2026, 12, 31), 1, 'DIARIA'))).toBe('2027-01-01')
    expect(ymd(periodoDeIndice(fecha(2026, 5, 20), 1, 'ANUAL'))).toBe('2027-05-20')
  })

  // La serie completa de un contrato: es lo que genera `generarCalendarioEnTx`.
  it('la serie de un contrato del día 29 no se salta febrero', () => {
    const inicio = fecha(2026, 12, 29)
    const serie = Array.from({ length: 4 }, (_, k) => ymd(periodoDeIndice(inicio, k, 'MENSUAL')))
    expect(serie).toEqual(['2026-12-29', '2027-01-29', '2027-02-28', '2027-03-29'])
  })

  // Cruce con la MIGRACIÓN. `20260731_calendario_meses_cortos.sql` recalcula el
  // calendario correcto en SQL (`inicio + k meses`), y esta función lo recalcula
  // en TypeScript. Si divergieran, la migración realinearía los calendarios y la
  // app volvería a torcerlos en la siguiente edición del contrato —o al revés—,
  // y el desacuerdo se vería como cuotas que aparecen y desaparecen solas.
  //
  // La lista es la que devolvió la migración corriendo contra la base, para el
  // contrato de la demo (29/07/2026 → 01/03/2028, MENSUAL).
  it('coincide con la serie que calcula la migración en SQL', () => {
    const inicio = fecha(2026, 7, 29)
    const fin = fecha(2028, 3, 1)
    const serie: string[] = []
    for (let k = 0; ; k++) {
      const d = periodoDeIndice(inicio, k, 'MENSUAL')
      if (d > fin) break
      serie.push(ymd(d))
    }
    expect(serie).toEqual([
      '2026-07-29', '2026-08-29', '2026-09-29', '2026-10-29', '2026-11-29', '2026-12-29',
      '2027-01-29', '2027-02-28', '2027-03-29', '2027-04-29', '2027-05-29', '2027-06-29',
      '2027-07-29', '2027-08-29', '2027-09-29', '2027-10-29', '2027-11-29', '2027-12-29',
      '2028-01-29', '2028-02-29',
    ])
  })
})

describe('margen de recordatorio', () => {
  it('un contrato ANUAL conserva el comportamiento previo al cambio (90 y 15)', () => {
    // Antes del margen proporcional el umbral era un 90 fijo con rojo a 15.
    // Esa era la cadencia para la que se diseñó, y no debe moverse.
    expect(diasAvisoPago('ANUAL')).toBe(90)
    expect(diasCriticoPago('ANUAL')).toBe(15)
  })

  it('el margen se acorta conforme la cadencia se acorta', () => {
    const margenes = VALORES.map((p) => diasAvisoPago(p))
    // Monótono no decreciente de la más frecuente a la menos frecuente: avisar
    // de un pago diario con más antelación que de uno mensual no tendría sentido.
    for (let i = 1; i < margenes.length; i++) {
      expect(margenes[i], `${VALORES[i]} avisa antes que ${VALORES[i - 1]}`)
        .toBeGreaterThanOrEqual(margenes[i - 1])
    }
  })

  it('una renta DIARIA avisa con un día, no con tres meses', () => {
    // El fallo que motivó el cambio: con el 90 fijo, TODAS las cuotas del
    // trimestre estaban "por vencer" a la vez y el aviso dejaba de señalar nada.
    expect(diasAvisoPago('DIARIA')).toBe(1)
  })

  it('toda cadencia llega a rojo alguna vez (el mínimo de 1 día)', () => {
    // Sin el Math.max(1), ceil(1/6)=1 sobrevive pero un margen futuro de 0
    // dejaría un aviso que nunca pasa de ámbar.
    for (const p of VALORES) expect(diasCriticoPago(p)).toBeGreaterThanOrEqual(1)
  })

  it('un contrato sin periodicidad (INCOMPLETO) usa el margen mensual', () => {
    // Es el default de la columna en la BD; inventarle otro sería arbitrario.
    expect(diasAvisoPago(null)).toBe(DIAS_AVISO_PAGO.MENSUAL)
    expect(diasAvisoPago(undefined)).toBe(DIAS_AVISO_PAGO.MENSUAL)
  })
})

describe('estado de vencimiento de una cuota (lo que pinta Finanzas)', () => {
  it('un pago pagado lo está, aunque su fecha haya pasado hace años', () => {
    // PAGADO es un hecho consumado y NO se recalcula contra la fecha. Sin este
    // corto, el histórico entero de un contrato viejo se pintaría en rojo.
    expect(clasificarVencimiento(-900, 'MENSUAL', true)).toBe('PAGADO')
  })

  it('separa lo que vence pronto de lo que vence lejos — ambos PENDIENTE en la BD', () => {
    // El motivo de existir de esta función: `est_pago_renta` no distingue entre
    // "vence mañana" y "vence en seis meses", y esa es justo la distinción que
    // Finanzas necesita para programar la salida de dinero.
    expect(clasificarVencimiento(3, 'MENSUAL', false)).toBe('POR_VENCER')
    expect(clasificarVencimiento(120, 'MENSUAL', false)).toBe('PROGRAMADO')
  })

  it('la frontera depende de la cadencia, no de un número fijo', () => {
    // A 10 días: para una renta mensual ya urge; para una anual falta mucho.
    expect(clasificarVencimiento(10, 'MENSUAL', false)).toBe('POR_VENCER')
    expect(clasificarVencimiento(10, 'DIARIA', false)).toBe('PROGRAMADO')
    expect(clasificarVencimiento(10, 'ANUAL', false)).toBe('POR_VENCER')
    expect(clasificarVencimiento(120, 'ANUAL', false)).toBe('PROGRAMADO')
  })

  it('lo que vence hoy cuenta como por vencer, no como vencido', () => {
    // Todavía se puede pagar a tiempo; marcarlo en rojo sería una falsa alarma.
    expect(clasificarVencimiento(0, 'MENSUAL', false)).toBe('POR_VENCER')
    expect(clasificarVencimiento(-1, 'MENSUAL', false)).toBe('VENCIDO')
  })

  it('un impago viejo es VENCIDO con cualquier cadencia', () => {
    for (const p of VALORES) expect(clasificarVencimiento(-30, p, false)).toBe('VENCIDO')
  })
})

describe('texto relativo del vencimiento', () => {
  it('distingue pasado, presente y futuro', () => {
    expect(textoVencimiento(0)).toBe('hoy')
    expect(textoVencimiento(5)).toBe('en 5 días')
    expect(textoVencimiento(-5)).toBe('hace 5 días')
  })

  it('concuerda el singular', () => {
    // "en 1 días" es el detalle que hace que una tabla parezca sin terminar.
    expect(textoVencimiento(1)).toBe('en 1 día')
    expect(textoVencimiento(-1)).toBe('hace 1 día')
  })
})
