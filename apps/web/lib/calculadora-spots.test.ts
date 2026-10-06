import { describe, it, expect } from 'vitest'
import {
  CALCULADORA_POR_OMISION,
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
  cantidadDeSpots,
  loopDeLaLinea,
  resolverCalculadora,
  rotacionesPorHora,
  tarifaBaseCalculadora,
  tarifaConPrima,
  tarifaPorSpot,
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

// ADR 0043 · las fórmulas son las de la calculadora HTML del dueño
// (`indexcal.html`), con UNA diferencia: se cuenta en enteros —horas en
// centésimas, pesos en centavos— para que la pantalla y el servidor den el
// MISMO número. Los casos llevan las cifras que enseña esa calculadora.
describe('las fórmulas', () => {
  it('rotaciones por hora = 3600 / (anunciantes del loop × duración)', () => {
    expect(rotacionesPorHora(12, 20)).toBe(15)
    expect(rotacionesPorHora(6, 20)).toBe(30)
    expect(rotacionesPorHora(7, 20)).toBeCloseTo(25.714, 3)
  })

  it('el loop es la OCUPACIÓN: los anunciantes de hoy más los espacios que compra la línea', () => {
    expect(loopDeLaLinea({ totalSpots: 12, ocupados: 5, espacios: 1, roadblock: false })).toBe(6)
    expect(loopDeLaLinea({ totalSpots: 12, ocupados: 0, espacios: 2, roadblock: false })).toBe(2)
    // Nunca más que la pantalla: el exceso lo rechaza el 409 de los libres.
    expect(loopDeLaLinea({ totalSpots: 12, ocupados: 11, espacios: 3, roadblock: false })).toBe(12)
    // Sin saber la ocupación, el loop entero: no se inventa una pantalla vacía.
    expect(loopDeLaLinea({ totalSpots: 12, ocupados: null, espacios: 1, roadblock: false })).toBe(12)
    // Un Roadblock ES el loop entero.
    expect(loopDeLaLinea({ totalSpots: 12, ocupados: 0, espacios: 12, roadblock: true })).toBe(12)
  })

  it('el caso de la calculadora HTML: 6 anunciantes × 20 s, 18 h, 30 días → 16 200 spots', () => {
    expect(cantidadDeSpots({ loop: 6, duracionSeg: 20, espacios: 1, horasDia: 18, dias: 30, roadblock: false })).toBe(16200)
  })

  it('SIN redondeo por día: 7 anunciantes × 20 s cuenta las fracciones y redondea UNA vez, al final', () => {
    // 3600 / 140 = 25,714… × 18 h = 462,857 al día × 30 = 13 885,7 → 13 885.
    // Con el redondeo por día del ADR 0042 eran 462 × 30 = 13 860.
    expect(cantidadDeSpots({ loop: 7, duracionSeg: 20, espacios: 1, horasDia: 18, dias: 30, roadblock: false })).toBe(13885)
    expect(cantidadDeSpots({ loop: 7, duracionSeg: 20, espacios: 1, horasDia: 18, dias: 1, roadblock: false })).toBe(462)
  })

  it('las horas fraccionarias, sin errores de coma flotante', () => {
    // 15 rotaciones × 4,5 h × 2 días = 135, exacto.
    expect(cantidadDeSpots({ loop: 12, duracionSeg: 20, espacios: 1, horasDia: 4.5, dias: 2, roadblock: false })).toBe(135)
    // 0,1 + 0,2 no es 0,3 en flotante; 15 × 0,3 × 10 = 45, no 44.
    expect(cantidadDeSpots({ loop: 12, duracionSeg: 20, espacios: 1, horasDia: 0.1 + 0.2, dias: 10, roadblock: false })).toBe(45)
  })

  it('Roadblock: floor(3600 / duración) spots por hora, como la calculadora HTML', () => {
    expect(cantidadDeSpots({ loop: 12, duracionSeg: 20, espacios: 12, horasDia: 18, dias: 30, roadblock: true })).toBe(97200)
    // 3600 / 7 = 514,28 → 514 por hora: la hora no da un spot partido.
    expect(cantidadDeSpots({ loop: 12, duracionSeg: 7, espacios: 12, horasDia: 1, dias: 1, roadblock: true })).toBe(514)
  })
})

describe('tarifaPorSpot · el PRECIO sale de la tarifa mensual, como en la calculadora HTML', () => {
  it('tarifa mensual ÷ spots de un anunciante al mes: $100,000 con 6 anunciantes → $6.17', () => {
    expect(tarifaPorSpot({ tarifaMensual: 100000, loop: 6, duracionSeg: 20, horasOperacion: 18, roadblock: false })).toBe(6.17)
  })

  it('con el loop lleno el spot vale el doble que con la mitad: lo que se paga al mes no cambia', () => {
    expect(tarifaPorSpot({ tarifaMensual: 100000, loop: 12, duracionSeg: 20, horasOperacion: 18, roadblock: false })).toBe(12.35)
  })

  it('Roadblock: ingreso de la hora ÷ spots de la hora, $1,111.11 / 180 → $6.17', () => {
    // ingresoHora = 100 000 × 6 / (18 × 30) = 1 111,11; spots en la hora = 180.
    expect(tarifaPorSpot({ tarifaMensual: 100000, loop: 6, duracionSeg: 20, horasOperacion: 18, roadblock: true })).toBe(6.17)
    // Y con la prima del 30 % del HTML, $8.02 por spot ($1,444.44 la hora).
    expect(tarifaConPrima(6.17, 30)).toBe(8.02)
  })

  it('NEGATIVO · sin tarifa mensual, sin loop o sin horas no hay precio', () => {
    expect(tarifaPorSpot({ tarifaMensual: 0, loop: 6, duracionSeg: 20, horasOperacion: 18, roadblock: false })).toBeNull()
    expect(tarifaPorSpot({ tarifaMensual: 100000, loop: 0, duracionSeg: 20, horasOperacion: 18, roadblock: false })).toBeNull()
    expect(tarifaPorSpot({ tarifaMensual: 100000, loop: 6, duracionSeg: 20, horasOperacion: 0, roadblock: false })).toBeNull()
  })
})

describe('tarifaBaseCalculadora · de qué tarifa mensual sale', () => {
  const comun = {
    franjaId: null,
    temporadas: [],
    fechaInicio: '2026-11-01',
    loop: 6,
    duracionSeg: 20,
    horasOperacion: 18,
    roadblock: false,
  }

  it('la modalidad mensual de la pantalla, aunque la línea se venda por spot', () => {
    const sitio = {
      modalidadesDetalle: [
        { unidad: 'spot', tarifaPublicada: 3200 },
        { unidad: 'mensual', tarifaPublicada: 100000 },
      ],
    }
    expect(tarifaBaseCalculadora({ ...comun, sitio })).toEqual({ tarifa: 6.17, calculable: true })
  })

  it('sin modalidad mensual, la tarifa mensual de la ficha', () => {
    const sitio = { tarifaMensual: 100000, modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 3200 }] }
    expect(tarifaBaseCalculadora({ ...comun, sitio })).toEqual({ tarifa: 6.17, calculable: true })
  })

  it('NEGATIVO · sin ninguna tarifa mensual NO cae a la del spot: no es calculable', () => {
    // Caer a los $3,200 «por spot» es justo lo que cotizaba $32.6 M el 01/10.
    const sitio = { modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 3200 }] }
    expect(tarifaBaseCalculadora({ ...comun, sitio })).toEqual({ tarifa: 0, calculable: false })
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

// Pantalla de 12 espacios de 20 s, 18 h de operación, 4 anunciantes hoy, 5
// libres (el contador guardado acota), 30 días. Con 2 espacios el loop es de 6:
// 30 rotaciones por hora × 2 espacios × 18 h = 1080 al día.
const base: EntradaCalculadora = {
  digital: true,
  unidad: 'spot',
  totalSpots: 12,
  duracionSeg: 20,
  horasMaximas: 18,
  libres: 5,
  ocupados: 4,
  dias: 30,
  espaciosComprados: 2,
  horasDia: null,
  roadblock: false,
  primaRoadblockPct: null,
  cantidadEnviada: 1080 * 30,
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
      loop: 6,
      rotacionesHora: 30,
      spotsDia: 1080,
      spotsDiaExactos: 1080,
      cantidad: 32400,
    })
  })

  it('el vendedor BAJA las horas y la cantidad baja con ellas', () => {
    const r = resolverCalculadora({ ...base, horasDia: 6, cantidadEnviada: 360 * 30 })
    expect(r).toMatchObject({ ok: true, horasDia: 6, spotsDia: 360, cantidad: 10800 })
  })

  it('el loop crece con la ocupación: con 9 anunciantes hoy, 2 espacios son un loop de 11', () => {
    // 3600 / 220 = 16,36 rotaciones × 2 × 18 = 589,09 al día × 30 = 17 672,7 → 17 672.
    const r = resolverCalculadora({ ...base, ocupados: 9, libres: null, cantidadEnviada: 17672 })
    expect(r).toMatchObject({ ok: true, loop: 11, spotsDia: 589, cantidad: 17672 })
  })

  it('sin ocupación conocida, el loop es la pantalla entera', () => {
    const r = resolverCalculadora({ ...base, ocupados: null, cantidadEnviada: 540 * 30 })
    expect(r).toMatchObject({ ok: true, loop: 12, spotsDia: 540, cantidad: 16200 })
  })

  it('NEGATIVO · una cantidad que no cuadra se rechaza con la cuenta escrita', () => {
    const r = resolverCalculadora({ ...base, cantidadEnviada: 100 })
    expect(r).toEqual({
      ok: false,
      status: 400,
      motivo:
        'La cantidad de spots no cuadra con la calculadora: con 2 espacios, 18 h al día y 30 días son 32400 spots, no 100.',
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
    const r = resolverCalculadora({ ...base, espaciosComprados: 6, cantidadEnviada: 58320 })
    expect(r).toEqual({
      ok: false,
      status: 409,
      motivo: 'Pides 6 espacios del loop y la pantalla solo tiene 5 libres.',
    })
    // `libres` desconocido no acota, igual que `spotsDeLaReserva`.
    // Loop de 4 + 6 = 10: 18 rotaciones × 6 × 18 h × 30 = 58 320.
    expect(resolverCalculadora({ ...base, libres: null, espaciosComprados: 6, cantidadEnviada: 58320 })).toMatchObject({
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

  it('NEGATIVO · si en todo el periodo no sale ni un spot, no se vende', () => {
    // Loop de 5 × 20 s = 100 s; 0,02 h = 72 s: 0,72 spots en un día.
    const r = resolverCalculadora({ ...base, espaciosComprados: 1, horasDia: 0.02, dias: 1, cantidadEnviada: 0 })
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it('pero las fracciones de varios días SÍ suman: 0,72 al día × 30 días = 21', () => {
    const r = resolverCalculadora({ ...base, espaciosComprados: 1, horasDia: 0.02, cantidadEnviada: 21 })
    expect(r).toMatchObject({ ok: true, spotsDia: 0, cantidad: 21 })
  })
})

describe('Roadblock', () => {
  const rb: EntradaCalculadora = {
    ...base,
    libres: 12,
    ocupados: 0,
    roadblock: true,
    espaciosComprados: null,
    primaRoadblockPct: 25,
    cantidadEnviada: 180 * 18 * 30,
  }

  it('compra TODOS los espacios del loop', () => {
    expect(resolverCalculadora(rb)).toMatchObject({
      ok: true,
      espaciosComprados: 12,
      roadblock: true,
      primaRoadblockPct: 25,
      loop: 12,
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
    const rb = { ...base, roadblock: true, espaciosComprados: null, libres: 12, ocupados: 0, cantidadEnviada: 97200 }
    const casos: EntradaCalculadora[] = [
      { ...base, digital: false },
      { ...base, totalSpots: null },
      { ...base, espaciosComprados: 0 },
      { ...rb, espaciosComprados: 11 },
      { ...rb, primaRoadblockPct: 101 },
      { ...base, primaRoadblockPct: 10 },
      { ...base, horasDia: 19 },
      { ...base, espaciosComprados: 1, horasDia: 0.02, dias: 1, cantidadEnviada: 0 },
      { ...base, dias: 0 },
      { ...base, cantidadEnviada: 100 },
      { ...rb, libres: 11 },
      { ...base, espaciosComprados: 6, cantidadEnviada: 58320 },
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
    expect(prev).toMatchObject({ ok: true, cantidad: 32400, spotsDia: 1080 })
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

describe('CALCULADORA_POR_OMISION — arranca APAGADA (decisión del dueño, 01/10)', () => {
  // Con la calculadora encendida por omisión, una pantalla con tarifa «por spot»
  // de $3,200 (capturada como precio de día o de paquete, no de UNA
  // reproducción) cotizaba 10,200 spots = $32.6 M en vez de los $3,200 de
  // siempre. Hasta revisar esas tarifas, la línea arranca en cantidad manual.
  it('una línea nueva arranca en cantidad manual, sin calculadora', () => {
    expect(CALCULADORA_POR_OMISION.manual).toBe(true)
  })

  it('y si alguien la enciende, empieza con un espacio y sin Roadblock', () => {
    expect(CALCULADORA_POR_OMISION.espacios).toBe('1')
    expect(CALCULADORA_POR_OMISION.roadblock).toBe(false)
    expect(CALCULADORA_POR_OMISION.prima).toBe('')
  })
})
