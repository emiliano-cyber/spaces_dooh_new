import { describe, it, expect } from 'vitest'
import {
  AVISO_FRANJA_NO_VIAJA_AL_CMS,
  ORIGENES_TARIFA,
  minutosDeHora,
  motivoFranjaInvalida,
  motivoTemporadaInvalida,
  temporadaDeFecha,
  resolverTarifa,
  type FranjaHoraria,
  type Temporada,
} from './rejilla'

// ============================================================================
//  LA REJILLA — las reglas del precio por franja y temporada, en UN solo sitio.
// ----------------------------------------------------------------------------
//  Módulo PURO, igual que `modalidades.ts` y por el mismo motivo escrito allí:
//  la rejilla la van a escribir DOS caminos (la ficha de la pantalla y, más
//  adelante, el importador) y la van a LEER otros dos (la propuesta y el
//  congelado del snapshot). Cuatro copias de «cuál de estas filas manda»
//  divergen, y aquí divergir significa cobrar un precio que nadie decidió.
//
//  Lo que estas pruebas NO afirman: nada sobre la base de datos. No se ejecuta
//  una sola consulta. Lo que fija el SQL está en las pruebas de repositorio y
//  en las e2e.
// ============================================================================

const f = (id: string, horaInicio: string, horaFin: string): FranjaHoraria => ({
  id,
  nombre: id,
  horaInicio,
  horaFin,
})

const t = (id: string, desde: string, hasta: string): Temporada => ({
  id,
  nombre: id,
  desde,
  hasta,
})

describe('1 · la hora, que es de donde sale todo lo demás', () => {
  it('convierte HH:MM a minutos desde la medianoche', () => {
    expect(minutosDeHora('00:00')).toBe(0)
    expect(minutosDeHora('06:30')).toBe(390)
    expect(minutosDeHora('23:59')).toBe(1439)
  })

  it('devuelve null —y no un cero— para lo que no es una hora', () => {
    // Un `?? 0` aquí pondría todo a medianoche sin avisar: es el defecto del
    // mapa que el ADR 0039 nombra. Se devuelve «no sé», y quien llama decide.
    expect(minutosDeHora('24:00')).toBeNull()
    expect(minutosDeHora('6:30')).toBeNull()
    expect(minutosDeHora('06:60')).toBeNull()
    expect(minutosDeHora('')).toBeNull()
    expect(minutosDeHora('prime')).toBeNull()
  })
})

describe('2 · qué franja NO se guarda — los casos negativos', () => {
  it('acepta una franja normal cuando no hay ninguna otra', () => {
    expect(motivoFranjaInvalida(f('prime', '06:00', '10:00'), [])).toBeNull()
  })

  it('acepta una franja que cruza la medianoche', () => {
    // Madrugada 22:00–06:00 es una venta real, no un error de captura.
    expect(motivoFranjaInvalida(f('madrugada', '22:00', '06:00'), [])).toBeNull()
  })

  it('rechaza una franja sin nombre', () => {
    const sinNombre = { ...f('x', '06:00', '10:00'), nombre: '  ' }
    expect(motivoFranjaInvalida(sinNombre, [])).toMatch(/nombre/i)
  })

  it('rechaza una hora mal escrita, nombrando cuál', () => {
    expect(motivoFranjaInvalida(f('x', '6:00', '10:00'), [])).toMatch(/06:00.*23:59|HH:MM/i)
    expect(motivoFranjaInvalida(f('x', '06:00', '25:00'), [])).toMatch(/HH:MM|hora/i)
  })

  it('rechaza una franja de duración cero', () => {
    expect(motivoFranjaInvalida(f('x', '06:00', '06:00'), [])).toMatch(/misma hora|no cubre/i)
  })

  it('RECHAZA una franja que se solapa con otra ya guardada', () => {
    const prime = f('prime', '06:00', '10:00')
    expect(motivoFranjaInvalida(f('nueva', '09:00', '12:00'), [prime])).toMatch(/prime/)
    expect(motivoFranjaInvalida(f('nueva', '05:00', '07:00'), [prime])).toMatch(/prime/)
    expect(motivoFranjaInvalida(f('nueva', '07:00', '08:00'), [prime])).toMatch(/prime/)
    expect(motivoFranjaInvalida(f('nueva', '00:00', '23:59'), [prime])).toMatch(/prime/)
  })

  it('el FIN es EXCLUSIVO: dos franjas que se tocan NO se solapan', () => {
    // 06:00–10:00 y 10:00–14:00 son el reparto normal de un día. Si el fin
    // fuera inclusivo, un dueño no podría partir el día sin dejar huecos.
    const prime = f('prime', '06:00', '10:00')
    expect(motivoFranjaInvalida(f('tarde', '10:00', '14:00'), [prime])).toBeNull()
    expect(motivoFranjaInvalida(f('antes', '02:00', '06:00'), [prime])).toBeNull()
  })

  it('detecta el solape también cuando una de las dos cruza la medianoche', () => {
    const madrugada = f('madrugada', '22:00', '06:00')
    expect(motivoFranjaInvalida(f('nueva', '23:00', '23:30'), [madrugada])).toMatch(/madrugada/)
    expect(motivoFranjaInvalida(f('nueva', '05:00', '05:30'), [madrugada])).toMatch(/madrugada/)
    expect(motivoFranjaInvalida(f('nueva', '06:00', '10:00'), [madrugada])).toBeNull()
  })

  it('una franja NO se solapa consigo misma al editarla', () => {
    // Guardar «prime» con las mismas horas es una edición del nombre, no un
    // solape. Si esto fallara, ninguna franja se podría volver a guardar.
    const prime = f('prime', '06:00', '10:00')
    expect(motivoFranjaInvalida({ ...prime, nombre: 'Prime AM' }, [prime])).toBeNull()
  })
})

describe('3 · qué temporada NO se guarda', () => {
  it('acepta una temporada normal', () => {
    expect(motivoTemporadaInvalida(t('buenfin', '2026-11-13', '2026-11-16'), [])).toBeNull()
  })

  it('rechaza una temporada sin nombre y una con fechas mal escritas', () => {
    expect(
      motivoTemporadaInvalida({ ...t('x', '2026-11-13', '2026-11-16'), nombre: '' }, []),
    ).toMatch(/nombre/i)
    expect(motivoTemporadaInvalida(t('x', '13/11/2026', '2026-11-16'), [])).toMatch(/AAAA-MM-DD/i)
  })

  it('rechaza una temporada que termina antes de empezar', () => {
    expect(motivoTemporadaInvalida(t('x', '2026-11-16', '2026-11-13'), [])).toMatch(/antes|termina/i)
  })

  it('RECHAZA una temporada que se solapa con otra, y la nombra', () => {
    const buenFin = t('buenfin', '2026-11-13', '2026-11-16')
    expect(motivoTemporadaInvalida(t('nueva', '2026-11-16', '2026-11-20'), [buenFin])).toMatch(
      /buenfin/,
    )
    expect(motivoTemporadaInvalida(t('nueva', '2026-11-01', '2026-12-31'), [buenFin])).toMatch(
      /buenfin/,
    )
  })

  it('los extremos son INCLUSIVOS: el día siguiente ya no se solapa', () => {
    const buenFin = t('buenfin', '2026-11-13', '2026-11-16')
    expect(motivoTemporadaInvalida(t('nueva', '2026-11-17', '2026-11-20'), [buenFin])).toBeNull()
    expect(motivoTemporadaInvalida(t('nueva', '2026-11-01', '2026-11-12'), [buenFin])).toBeNull()
  })

  it('una temporada NO se solapa consigo misma al editarla', () => {
    const buenFin = t('buenfin', '2026-11-13', '2026-11-16')
    expect(motivoTemporadaInvalida({ ...buenFin, nombre: 'Buen Fin 2026' }, [buenFin])).toBeNull()
  })
})

describe('4 · qué temporada le toca a una fecha', () => {
  const buenFin = t('buenfin', '2026-11-13', '2026-11-16')
  const diciembre = t('diciembre', '2026-12-01', '2026-12-31')

  it('devuelve la temporada que cubre la fecha, extremos incluidos', () => {
    expect(temporadaDeFecha([buenFin, diciembre], '2026-11-13')).toBe('buenfin')
    expect(temporadaDeFecha([buenFin, diciembre], '2026-11-16')).toBe('buenfin')
    expect(temporadaDeFecha([buenFin, diciembre], '2026-12-15')).toBe('diciembre')
  })

  it('devuelve null cuando la fecha no cae en ninguna — que es lo normal', () => {
    expect(temporadaDeFecha([buenFin, diciembre], '2026-07-04')).toBeNull()
    expect(temporadaDeFecha([], '2026-11-14')).toBeNull()
  })
})

describe('5 · la resolución de la tarifa — el corazón de la fase', () => {
  const BASE = 1000

  it('SIN filas de rejilla devuelve la tarifa base, y lo dice', () => {
    // INVARIANTE 1 del encargo. Una pantalla sin rejilla se vende como hoy.
    const r = resolverTarifa({ tarifaBase: BASE, rejilla: [], franjaId: null, temporadaId: null })
    expect(r.tarifa).toBe(1000)
    expect(r.origen).toBe('modalidad')
    expect(r.franjaId).toBeNull()
    expect(r.temporadaId).toBeNull()
  })

  it('SIN filas de rejilla devuelve la base AUNQUE se contrate una franja', () => {
    // La franja se contrata (es un compromiso comercial); que no haya tarifa
    // propia para ella no puede impedir la venta ni inventarse un precio.
    const r = resolverTarifa({
      tarifaBase: BASE,
      rejilla: [],
      franjaId: 'prime',
      temporadaId: 'buenfin',
    })
    expect(r.tarifa).toBe(1000)
    expect(r.origen).toBe('modalidad')
  })

  it('gana la fila EXACTA (franja + temporada) sobre todas las demás', () => {
    const rejilla = [
      { franjaId: null, temporadaId: null, tarifa: 1100 },
      { franjaId: 'prime', temporadaId: null, tarifa: 1400 },
      { franjaId: null, temporadaId: 'buenfin', tarifa: 1200 },
      { franjaId: 'prime', temporadaId: 'buenfin', tarifa: 1800 },
    ]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: 'prime', temporadaId: 'buenfin' })
    expect(r.tarifa).toBe(1800)
    expect(r.origen).toBe('franja+temporada')
    expect(r.franjaId).toBe('prime')
    expect(r.temporadaId).toBe('buenfin')
  })

  it('la FRANJA gana a la TEMPORADA cuando no hay fila exacta', () => {
    // Decisión documentada: la franja la ELIGE el vendedor y queda contratada;
    // la temporada se DEDUCE de la fecha. Entre dos filas igual de específicas,
    // manda la que alguien escogió a propósito.
    const rejilla = [
      { franjaId: null, temporadaId: null, tarifa: 1100 },
      { franjaId: 'prime', temporadaId: null, tarifa: 1400 },
      { franjaId: null, temporadaId: 'buenfin', tarifa: 1200 },
    ]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: 'prime', temporadaId: 'buenfin' })
    expect(r.tarifa).toBe(1400)
    expect(r.origen).toBe('franja')
    expect(r.temporadaId).toBeNull()
  })

  it('cae a la TEMPORADA cuando la franja no tiene fila propia', () => {
    const rejilla = [
      { franjaId: null, temporadaId: null, tarifa: 1100 },
      { franjaId: null, temporadaId: 'buenfin', tarifa: 1200 },
    ]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: 'prime', temporadaId: 'buenfin' })
    expect(r.tarifa).toBe(1200)
    expect(r.origen).toBe('temporada')
    expect(r.franjaId).toBeNull()
    expect(r.temporadaId).toBe('buenfin')
  })

  it('cae a la fila SIN dimensiones de la rejilla antes que a la modalidad', () => {
    const rejilla = [{ franjaId: null, temporadaId: null, tarifa: 1100 }]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: 'prime', temporadaId: null })
    expect(r.tarifa).toBe(1100)
    expect(r.origen).toBe('rejilla')
  })

  it('una fila de OTRA franja NO se aplica', () => {
    // Caso negativo: la rejilla es dispersa, y una fila que no es la de esta
    // venta no puede colarse «porque es la única que hay».
    const rejilla = [{ franjaId: 'madrugada', temporadaId: null, tarifa: 300 }]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: 'prime', temporadaId: null })
    expect(r.tarifa).toBe(1000)
    expect(r.origen).toBe('modalidad')
  })

  it('sin franja contratada, una fila DE franja NO se aplica', () => {
    const rejilla = [{ franjaId: 'prime', temporadaId: null, tarifa: 1400 }]
    const r = resolverTarifa({ tarifaBase: BASE, rejilla, franjaId: null, temporadaId: null })
    expect(r.tarifa).toBe(1000)
    expect(r.origen).toBe('modalidad')
  })

  it('una tarifa de CERO en la rejilla se respeta y NO cae a la base', () => {
    // `?? base` sobre un 0 lo trataría como «no hay fila» y cobraría la base:
    // es la misma familia del `?? 0` del mapa, con el signo cambiado y peor,
    // porque cobra de más sin que nadie lo haya decidido.
    const rejilla = [{ franjaId: 'madrugada', temporadaId: null, tarifa: 0 }]
    const r = resolverTarifa({
      tarifaBase: BASE,
      rejilla,
      franjaId: 'madrugada',
      temporadaId: null,
    })
    expect(r.tarifa).toBe(0)
    expect(r.origen).toBe('franja')
  })

  it('los cinco orígenes posibles están declarados, y no hay más', () => {
    expect([...ORIGENES_TARIFA]).toEqual([
      'franja+temporada',
      'franja',
      'temporada',
      'rejilla',
      'modalidad',
    ])
  })
})

describe('6 · el aviso de que la franja NO viaja al CMS', () => {
  it('existe como UNA sola cadena y dice las tres cosas que tiene que decir', () => {
    // Si este texto se escribiera suelto en cada pantalla, el día que cambie
    // quedarían versiones viejas diciendo otra cosa sobre lo mismo.
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).toMatch(/comercial/i)
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).toMatch(/manualmente|a mano/i)
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).toMatch(/CMS/)
  })

  it('NO promete que el sistema programe la franja', () => {
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).not.toMatch(/se programa autom/i)
  })
})
