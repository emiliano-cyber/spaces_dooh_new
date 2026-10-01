import { describe, it, expect } from 'vitest'
import {
  DURACION_SPOT_RESPALDO_SEG,
  HORAS_OPERACION_RESPALDO,
  decidirPrecioCalculadora,
  duracionSpotSeg,
  espaciosLibres,
  etiquetaCalculadora,
  previsualizarCalculadora,
  horasDeFranja,
  horasDeHorario,
  horasPorOmision,
  referenciaPorSpotMensual,
  resolverCalculadora,
  rotacionesPorHora,
  spotsPorDia,
  tarifaConPrima,
  usaCalculadora,
  type EntradaCalculadora,
} from './calculadora-spots'
import { traducirError } from './i18n/errores-servidor'

// ============================================================================
//  ADR 0042 · la calculadora de spots da la CANTIDAD; el precio sigue siendo el
//  de la pantalla. Aquí se fijan las fórmulas, los respaldos, el Roadblock y la
//  regla de la prima, sin servidor y sin base. Lo que la base guarda y lo que el
//  servidor rechaza de verdad lo mide `calculadora-spots.e2e.test.ts`.
// ============================================================================

describe('las fórmulas', () => {
  it('rotaciones por hora = 3600 / (espacios del loop × duración)', () => {
    expect(rotacionesPorHora(12, 20)).toBe(15)
    expect(rotacionesPorHora(7, 20)).toBeCloseTo(25.714, 3)
  })

  it('spots al día: el caso exacto, 12 espacios × 20 s, 1 espacio, 18 h → 270', () => {
    expect(spotsPorDia({ totalSpots: 12, duracionSeg: 20, espacios: 1, horasDia: 18 })).toBe(270)
    expect(spotsPorDia({ totalSpots: 12, duracionSeg: 20, espacios: 3, horasDia: 18 })).toBe(810)
  })

  it('el caso FRACCIONARIO: 7 espacios × 20 s se redondea hacia ABAJO por día', () => {
    // 3600 / 140 = 25,714… rotaciones por hora. La calculadora original cobraba
    // 25,714 × 18 = 462,857 spots; aquí se cobran 462: no se cobra una
    // reproducción que no ocurre.
    expect(spotsPorDia({ totalSpots: 7, duracionSeg: 20, espacios: 1, horasDia: 1 })).toBe(25)
    expect(spotsPorDia({ totalSpots: 7, duracionSeg: 20, espacios: 1, horasDia: 18 })).toBe(462)
    // Y se redondea al FINAL del día, no por hora: 25 × 18 serían 450.
    expect(spotsPorDia({ totalSpots: 7, duracionSeg: 20, espacios: 2, horasDia: 18 })).toBe(925)
  })

  it('las horas fraccionarias cuentan al minuto que dan, sin errores de coma flotante', () => {
    // 15 rotaciones × 1 espacio × 4,5 h = 67,5 → 67.
    expect(spotsPorDia({ totalSpots: 12, duracionSeg: 20, espacios: 1, horasDia: 4.5 })).toBe(67)
    // 0,1 + 0,2 no es 0,3 en flotante; la cuenta no puede depender de eso.
    expect(spotsPorDia({ totalSpots: 12, duracionSeg: 20, espacios: 1, horasDia: 0.1 + 0.2 })).toBe(4)
  })
})

describe('los respaldos', () => {
  it('duración: la de la pantalla, luego la de la organización, luego 20 s', () => {
    expect(duracionSpotSeg(15, 10)).toBe(15)
    expect(duracionSpotSeg(null, 10)).toBe(10)
    expect(duracionSpotSeg(0, null)).toBe(DURACION_SPOT_RESPALDO_SEG)
    expect(duracionSpotSeg(undefined, undefined)).toBe(20)
    // Un valor que no es un número no es una duración.
    expect(duracionSpotSeg(Number.NaN, -3)).toBe(20)
  })

  it('horas de una franja: fin exclusivo, y la que cruza la medianoche también', () => {
    expect(horasDeFranja({ horaInicio: '06:00', horaFin: '10:00' })).toBe(4)
    expect(horasDeFranja({ horaInicio: '22:00', horaFin: '06:00' })).toBe(8)
    expect(horasDeFranja({ horaInicio: '06:30', horaFin: '08:00' })).toBe(1.5)
    expect(horasDeFranja({ horaInicio: '06:00', horaFin: '06:00' })).toBeNull()
    expect(horasDeFranja({ horaInicio: 'prime', horaFin: '10:00' })).toBeNull()
  })

  it('horas del horario de la pantalla, en las formas que hay en el inventario', () => {
    expect(horasDeHorario('06:00-24:00')).toEqual({ horas: 18, reconocido: true })
    expect(horasDeHorario('06:00–24:00')).toEqual({ horas: 18, reconocido: true })
    expect(horasDeHorario('6:00 am a 12:00 pm')).toEqual({ horas: 6, reconocido: true })
    expect(horasDeHorario('6 a 24')).toEqual({ horas: 18, reconocido: true })
    expect(horasDeHorario('18:00 - 02:00')).toEqual({ horas: 8, reconocido: true })
    expect(horasDeHorario('00:00-24:00')).toEqual({ horas: 24, reconocido: true })
    expect(horasDeHorario('24 horas')).toEqual({ horas: 24, reconocido: true })
    expect(horasDeHorario('24/7')).toEqual({ horas: 24, reconocido: true })
  })

  it('un horario que no se entiende cae a 18 h, y lo DICE', () => {
    expect(horasDeHorario(null)).toEqual({ horas: HORAS_OPERACION_RESPALDO, reconocido: false })
    expect(horasDeHorario('')).toEqual({ horas: 18, reconocido: false })
    expect(horasDeHorario('según el centro comercial')).toEqual({ horas: 18, reconocido: false })
    expect(horasDeHorario('25:00-30:00')).toEqual({ horas: 18, reconocido: false })
  })

  it('horas por omisión: la franja manda; sin franja, el horario', () => {
    expect(horasPorOmision({ franja: { horaInicio: '06:00', horaFin: '10:00' }, horario: '06:00-24:00' })).toBe(4)
    expect(horasPorOmision({ franja: null, horario: '06:00-24:00' })).toBe(18)
    expect(horasPorOmision({ horario: '00:00-24:00' })).toBe(24)
    // Una franja ilegible no se convierte en cero horas: cae al horario.
    expect(horasPorOmision({ franja: { horaInicio: 'x', horaFin: 'y' }, horario: '6 a 12' })).toBe(6)
  })
})

// Pantalla de 12 espacios de 20 s, 18 h de operación, 5 libres, 30 días.
const base: EntradaCalculadora = {
  digital: true,
  unidad: 'spot',
  totalSpots: 12,
  duracionSeg: 20,
  horasMaximas: 18,
  libres: 5,
  dias: 30,
  espaciosComprados: 2,
  horasDia: null,
  roadblock: false,
  primaRoadblockPct: null,
  cantidadEnviada: 2 * 270 * 30,
}

describe('resolverCalculadora · la línea completa', () => {
  it('sin horas, toma las máximas; la cantidad es spots/día × días', () => {
    const r = resolverCalculadora(base)
    expect(r).toEqual({
      ok: true,
      espaciosComprados: 2,
      horasDia: 18,
      roadblock: false,
      primaRoadblockPct: null,
      rotacionesHora: 15,
      spotsDia: 540,
      cantidad: 16200,
    })
  })

  it('el vendedor BAJA las horas y la cantidad baja con ellas', () => {
    const r = resolverCalculadora({ ...base, horasDia: 6, cantidadEnviada: 2 * 90 * 30 })
    expect(r).toMatchObject({ ok: true, horasDia: 6, spotsDia: 180, cantidad: 5400 })
  })

  it('NEGATIVO · una cantidad que no cuadra se rechaza con la cuenta escrita', () => {
    const r = resolverCalculadora({ ...base, cantidadEnviada: 100 })
    expect(r).toEqual({
      ok: false,
      status: 400,
      motivo:
        'La cantidad de spots no cuadra con la calculadora: con 2 espacios, 18 h al día y 30 días son 16200 spots, no 100.',
    })
    // Sin cantidad tampoco: el servidor no rellena lo que el vendedor no vio.
    expect(resolverCalculadora({ ...base, cantidadEnviada: null })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · más horas que la franja o el horario, o cero horas', () => {
    expect(resolverCalculadora({ ...base, horasDia: 19 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, horasDia: 0 })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · espacios fuera de 1…total', () => {
    expect(resolverCalculadora({ ...base, espaciosComprados: 0 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, espaciosComprados: 13 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, espaciosComprados: 1.5 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, espaciosComprados: null })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · más espacios que los libres → 409, no 400: es la pantalla, no la petición', () => {
    const r = resolverCalculadora({ ...base, espaciosComprados: 6, cantidadEnviada: 6 * 270 * 30 })
    expect(r).toEqual({
      ok: false,
      status: 409,
      motivo: 'Pides 6 espacios del loop y la pantalla solo tiene 5 libres.',
    })
    // `libres` desconocido no acota, igual que `spotsDeLaReserva`.
    expect(resolverCalculadora({ ...base, libres: null, espaciosComprados: 6, cantidadEnviada: 48600 })).toMatchObject({
      ok: true,
    })
  })

  it('NEGATIVO · no aplica a una pantalla fija ni a otra unidad', () => {
    expect(resolverCalculadora({ ...base, digital: false })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, unidad: 'mensual' })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · una pantalla sin espacios capturados no se puede calcular', () => {
    expect(resolverCalculadora({ ...base, totalSpots: null })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...base, totalSpots: 0 })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · si no sale ni un spot al día, no se vende', () => {
    // 12 × 20 s = 240 s de loop; 0,05 h = 180 s: no da una vuelta.
    const r = resolverCalculadora({ ...base, espaciosComprados: 1, horasDia: 0.05, cantidadEnviada: 0 })
    expect(r).toMatchObject({ ok: false, status: 400 })
  })
})

describe('Roadblock', () => {
  const rb: EntradaCalculadora = {
    ...base,
    libres: 12,
    roadblock: true,
    espaciosComprados: null,
    primaRoadblockPct: 25,
    cantidadEnviada: 12 * 270 * 30,
  }

  it('compra TODOS los espacios del loop', () => {
    expect(resolverCalculadora(rb)).toMatchObject({
      ok: true,
      espaciosComprados: 12,
      roadblock: true,
      primaRoadblockPct: 25,
      spotsDia: 3240,
      cantidad: 97200,
    })
    // Sin prima es prima 0, no null: la línea ES un Roadblock.
    expect(resolverCalculadora({ ...rb, primaRoadblockPct: null })).toMatchObject({ ok: true, primaRoadblockPct: 0 })
  })

  it('NEGATIVO · un Roadblock con menos espacios que el loop no es un Roadblock', () => {
    expect(resolverCalculadora({ ...rb, espaciosComprados: 11 })).toMatchObject({ ok: false, status: 400 })
  })

  it('NEGATIVO · exige el loop ENTERO libre: con un espacio ocupado, 409', () => {
    expect(resolverCalculadora({ ...rb, libres: 11 })).toEqual({
      ok: false,
      status: 409,
      motivo: 'Un Roadblock necesita los 12 espacios del loop libres, y la pantalla tiene 11.',
    })
  })

  it('NEGATIVO · prima sin Roadblock, o fuera de 0…100', () => {
    expect(resolverCalculadora({ ...base, primaRoadblockPct: 10 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...rb, primaRoadblockPct: 101 })).toMatchObject({ ok: false, status: 400 })
    expect(resolverCalculadora({ ...rb, primaRoadblockPct: -1 })).toMatchObject({ ok: false, status: 400 })
    // Una prima 0 en una línea normal no es un error: es «no hay prima».
    expect(resolverCalculadora({ ...base, primaRoadblockPct: 0 })).toMatchObject({ ok: true, primaRoadblockPct: null })
  })

  it('el precio unitario = tarifa × (1 + prima), al centavo', () => {
    expect(tarifaConPrima(1200, 25)).toBe(1500)
    expect(tarifaConPrima(1200, 0)).toBe(1200)
    expect(tarifaConPrima(999.99, 12.5)).toBe(1124.99)
    expect(tarifaConPrima(0.1, 33.33)).toBe(0.13)
  })
})

describe('decidirPrecioCalculadora · la prima es un ajuste de gerente', () => {
  const calc = { tarifa: 1200, calculable: true }

  it('VENDEDOR · Roadblock a prima 0 y a la tarifa: entra, sin ajuste', () => {
    expect(decidirPrecioCalculadora({ enviada: 1200, calculada: calc, primaPct: 0, puedeAjustar: false })).toEqual({
      ok: true,
      tarifaCalculada: 1200,
      ajustado: false,
    })
  })

  it('NEGATIVO · VENDEDOR con prima > 0 → «prima-sin-permiso», aunque mande la cuenta bien', () => {
    expect(decidirPrecioCalculadora({ enviada: 1500, calculada: calc, primaPct: 25, puedeAjustar: false })).toEqual({
      ok: false,
      motivo: 'prima-sin-permiso',
    })
  })

  it('GERENTE · con prima: la esperada es calculada × (1+prima), queda como ajuste y guarda la BASE', () => {
    // La prima NO se aplica dos veces: el 1500 que manda la pantalla ya la
    // lleva, y lo que se guarda como «tarifa calculada» es la de la pantalla.
    expect(decidirPrecioCalculadora({ enviada: 1500, calculada: calc, primaPct: 25, puedeAjustar: true })).toEqual({
      ok: true,
      tarifaCalculada: 1200,
      ajustado: true,
    })
  })

  it('NEGATIVO · con prima, mandar la tarifa SIN prima es otro precio: para un vendedor no hay prima que valga', () => {
    // Vendedor, prima 0, pero manda la de la prima: es un precio distinto.
    expect(decidirPrecioCalculadora({ enviada: 1500, calculada: calc, primaPct: 0, puedeAjustar: false })).toEqual({
      ok: false,
      motivo: 'distinta',
    })
  })

  it('sin tarifa calculable: solo el gerente, igual que PRECIO-01', () => {
    const sin = { tarifa: 0, calculable: false }
    expect(decidirPrecioCalculadora({ enviada: 500, calculada: sin, primaPct: 0, puedeAjustar: false })).toEqual({
      ok: false,
      motivo: 'sin-tarifa',
    })
    expect(decidirPrecioCalculadora({ enviada: 500, calculada: sin, primaPct: 10, puedeAjustar: true })).toEqual({
      ok: true,
      tarifaCalculada: null,
      ajustado: true,
    })
  })
})

describe('los motivos llegan traducidos al inglés', () => {
  it('ninguno de los rechazos de resolverCalculadora sale en español a quien lee en inglés', () => {
    // La GUARDIA de `errores-servidor.test.ts` solo ve los literales de
    // `new AppError('…')`; éstos viajan como `AppError(r.motivo)` y se le
    // escaparían. Si alguien reescribe un motivo, esto se pone en rojo.
    const rb = { ...base, roadblock: true, espaciosComprados: null, libres: 12, cantidadEnviada: 97200 }
    const casos: EntradaCalculadora[] = [
      { ...base, digital: false },
      { ...base, totalSpots: null },
      { ...base, espaciosComprados: 0 },
      { ...rb, espaciosComprados: 11 },
      { ...rb, primaRoadblockPct: 101 },
      { ...base, primaRoadblockPct: 10 },
      { ...base, horasDia: 19 },
      { ...base, espaciosComprados: 1, horasDia: 0.05, cantidadEnviada: 0 },
      { ...base, dias: 0 },
      { ...base, cantidadEnviada: 100 },
      { ...rb, libres: 11 },
      { ...base, espaciosComprados: 6, cantidadEnviada: 48600 },
    ]
    for (const c of casos) {
      const r = resolverCalculadora(c)
      expect(r.ok, JSON.stringify(c)).toBe(false)
      if (r.ok) continue
      expect(traducirError(r.motivo, 'en'), r.motivo).not.toBe(r.motivo)
    }
  })
})

describe('previsualizarCalculadora · lo que enseña la pantalla ANTES de mandar', () => {
  it('da la misma cantidad que luego acepta el servidor', () => {
    const { cantidadEnviada: _, ...sinCantidad } = base
    const prev = previsualizarCalculadora(sinCantidad)
    expect(prev).toMatchObject({ ok: true, cantidad: 16200, spotsDia: 540 })
    if (!prev.ok) return
    expect(resolverCalculadora({ ...base, cantidadEnviada: prev.cantidad })).toEqual(prev)
  })

  it('y avisa con el MISMO motivo que daría el servidor', () => {
    const { cantidadEnviada: _, ...sinCantidad } = base
    expect(previsualizarCalculadora({ ...sinCantidad, espaciosComprados: 6 })).toEqual({
      ok: false,
      status: 409,
      motivo: 'Pides 6 espacios del loop y la pantalla solo tiene 5 libres.',
    })
  })
})

describe('etiquetaCalculadora · el detalle interno', () => {
  it('sin calculadora no dice nada', () => {
    expect(etiquetaCalculadora({ espaciosComprados: null, horasDia: null, roadblock: false, primaRoadblockPct: null })).toBeNull()
  })

  it('los espacios y las horas, con su concordancia', () => {
    expect(etiquetaCalculadora({ espaciosComprados: 2, horasDia: 18, roadblock: false })).toBe('2 espacios del loop · 18 h al día')
    expect(etiquetaCalculadora({ espaciosComprados: 1, horasDia: 4.5, roadblock: false })).toBe('1 espacio del loop · 4.5 h al día')
  })

  it('el Roadblock, y su prima solo si la hay', () => {
    expect(etiquetaCalculadora({ espaciosComprados: 12, horasDia: 18, roadblock: true, primaRoadblockPct: 25 })).toBe(
      'Roadblock · 12 espacios del loop · 18 h al día · prima 25 %',
    )
    expect(etiquetaCalculadora({ espaciosComprados: 12, horasDia: 18, roadblock: true, primaRoadblockPct: 0 })).toBe(
      'Roadblock · 12 espacios del loop · 18 h al día',
    )
  })
})

describe('usaCalculadora · qué línea entra por aquí', () => {
  it('cualquiera de los cuatro parámetros la activa; ninguno, la deja como hoy', () => {
    expect(usaCalculadora({})).toBe(false)
    expect(usaCalculadora({ espaciosComprados: null, horasDia: null, roadblock: false, primaRoadblockPct: null })).toBe(
      false,
    )
    expect(usaCalculadora({ espaciosComprados: 2 })).toBe(true)
    expect(usaCalculadora({ horasDia: 4 })).toBe(true)
    expect(usaCalculadora({ roadblock: true })).toBe(true)
    expect(usaCalculadora({ primaRoadblockPct: 10 })).toBe(true)
  })
})

describe('espaciosLibres · lo mismo que el inventario, y nunca más que el contador', () => {
  it('total − campañas vigentes, como `listarSitios`', () => {
    expect(espaciosLibres({ totalSpots: 12, guardados: null, campanasActivas: 1 })).toBe(11)
    expect(espaciosLibres({ totalSpots: 12, guardados: null, campanasActivas: 0 })).toBe(12)
  })

  it('el contador guardado ACOTA, porque es con el que la campaña recorta la reserva', () => {
    expect(espaciosLibres({ totalSpots: 12, guardados: 4, campanasActivas: 0 })).toBe(4)
    expect(espaciosLibres({ totalSpots: 12, guardados: 12, campanasActivas: 3 })).toBe(9)
  })

  it('nunca negativo; sin ninguno de los dos datos, no se sabe', () => {
    expect(espaciosLibres({ totalSpots: 2, guardados: null, campanasActivas: 5 })).toBe(0)
    expect(espaciosLibres({ totalSpots: null, guardados: null, campanasActivas: 0 })).toBeNull()
    expect(espaciosLibres({ totalSpots: null, guardados: 3, campanasActivas: 0 })).toBe(3)
  })
})

describe('referenciaPorSpotMensual · informativa, nunca se cobra', () => {
  it('tarifa mensual ÷ spots de un cliente al mes', () => {
    // 15 rotaciones × 18 h = 270 al día × 30 = 8100 al mes.
    expect(referenciaPorSpotMensual({ tarifaMensual: 45000, totalSpots: 12, duracionSeg: 20, horasOperacion: 18 })).toBe(
      5.56,
    )
  })

  it('sin tarifa mensual o sin loop, no hay referencia', () => {
    expect(referenciaPorSpotMensual({ tarifaMensual: 0, totalSpots: 12, duracionSeg: 20, horasOperacion: 18 })).toBeNull()
    expect(referenciaPorSpotMensual({ tarifaMensual: 45000, totalSpots: null, duracionSeg: 20, horasOperacion: 18 })).toBeNull()
  })
})
