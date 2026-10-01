import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  I18N-07 · EL EMBUDO: `respuestaError()` CONTESTA EN EL IDIOMA DE QUIEN PIDE.
// ----------------------------------------------------------------------------
//  Las otras pruebas miran las piezas. Esta mira el sitio por donde salen de
//  verdad los 253 errores: la respuesta HTTP.
//
//  Los tres casos negativos que se pidieron, y estan los tres abajo:
//
//    1. con el idioma en ingles -> sale en ingles
//    2. sin cookie y sin cabecera -> sale en espanol
//    3. lanzado FUERA de una peticion -> no revienta, y sale en espanol
//
//  El tercero es el que mas facil se escapa y el mas grave: `respuestaError()`
//  corre en el `catch` de cada ruta, asi que si reventara al buscar cabeceras
//  que no existen, el manejador de errores se convertiria en el error.
// ============================================================================

const estado = {
  modo: 'peticion' as 'fuera' | 'peticion',
  cookie: null as string | null,
  accept: null as string | null,
}

vi.mock('next/headers', () => ({
  cookies: () => {
    if (estado.modo === 'fuera') throw new Error('`cookies` was called outside a request scope.')
    return {
      get: (n: string) =>
        n === 'spaces_idioma' && estado.cookie ? { value: estado.cookie } : undefined,
    }
  },
  headers: () => {
    if (estado.modo === 'fuera') throw new Error('`headers` was called outside a request scope.')
    return { get: (n: string) => (n === 'accept-language' ? estado.accept : null) }
  },
}))

async function cuerpo(e: unknown): Promise<{ estado: number; error: string }> {
  const { respuestaError } = await import('./errores')
  const r = respuestaError(e)
  return { estado: r.status, error: (await r.json()).error }
}

beforeEach(() => {
  estado.modo = 'peticion'
  estado.cookie = null
  estado.accept = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Las pruebas de traduccion describen el ingles ENCENDIDO. Desde el
  // 2026-09-30 viene apagado por omision (describe 0, abajo).
  process.env.IDIOMA_INGLES = '1'
})

describe('0 · con el ingles APAGADO (omision desde el 2026-09-30), el error sale en ESPANOL', () => {
  beforeEach(() => {
    delete process.env.IDIOMA_INGLES
  })

  it('aunque la cookie y el navegador pidan ingles', async () => {
    estado.cookie = 'en'
    estado.accept = 'en-US,en;q=0.9'
    const { respuestaError, AppError } = await import('./errores')
    const r = respuestaError(new AppError('Campaña no encontrada', 404))
    expect(((await r.json()) as { error: string }).error).toBe('Campaña no encontrada')
  })
})

describe('1 · con el idioma en INGLES, el error sale en ingles', () => {
  it('un AppError del catalogo', async () => {
    estado.accept = 'en-US,en;q=0.9'
    const { AppError } = await import('./errores')
    const r = await cuerpo(new AppError('Campaña no encontrada', 404))
    expect(r.estado).toBe(404)
    expect(r.error).toBe('Campaign not found')
  })

  it('el codigo HTTP NO cambia con el idioma', async () => {
    // Traducir es traducir. Si el idioma moviera un status, dos clientes
    // veRian comportamientos distintos del mismo API.
    const { AppError } = await import('./errores')
    for (const [cookie, esperado] of [
      ['es', 'Campaña no encontrada'],
      ['en', 'Campaign not found'],
    ] as const) {
      estado.cookie = cookie
      const r = await cuerpo(new AppError('Campaña no encontrada', 404))
      expect(r.estado).toBe(404)
      expect(r.error).toBe(esperado)
    }
  })

  it('un error de Postgres traducido por el mapa central', async () => {
    estado.cookie = 'en'
    const r = await cuerpo(Object.assign(new Error('dup'), { code: '23505' }))
    expect(r.estado).toBe(409)
    expect(r.error).toBe('The record already exists')
  })

  it('la base caida', async () => {
    estado.cookie = 'en'
    const r = await cuerpo(Object.assign(new Error(''), { code: 'ECONNREFUSED' }))
    expect(r.estado).toBe(503)
    expect(r.error).toBe('The service is unavailable right now. Please try again in a few minutes.')
  })

  it('el error no controlado', async () => {
    estado.cookie = 'en'
    const r = await cuerpo(new Error('algo raro de dentro'))
    expect(r.estado).toBe(500)
    expect(r.error).toBe('Internal error')
    // Y lo de dentro SIGUE sin filtrarse, en cualquier idioma.
    expect(r.error).not.toContain('algo raro')
  })
})

describe('2 · sin cookie y sin cabecera, el error sale en ESPANOL', () => {
  it.each([
    ['Campaña no encontrada', 404],
    ['No encontrado', 404],
    ['RFC inválido', 400],
  ] as const)('%s', async (mensaje, status) => {
    const { AppError } = await import('./errores')
    const r = await cuerpo(new AppError(mensaje, status))
    expect(r.estado).toBe(status)
    expect(r.error).toBe(mensaje)
  })

  it('tambien con una cabecera de un idioma que no hablamos', async () => {
    estado.accept = 'fr-FR,fr;q=0.9,de;q=0.8'
    const { AppError } = await import('./errores')
    expect((await cuerpo(new AppError('No encontrado', 404))).error).toBe('No encontrado')
  })

  it('el mensaje en espanol es EXACTAMENTE el de antes de este lote', async () => {
    // La red de las 11 pruebas que afirman el texto exacto, comprobada aqui
    // tambien: el espanol canonico no se toca.
    const r = await cuerpo(Object.assign(new Error(''), { code: 'ECONNREFUSED' }))
    expect(r.error).toBe(
      'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
    )
  })
})

describe('3 · FUERA de una peticion · NO REVIENTA, y sale en espanol', () => {
  it('un AppError lanzado desde un script o un trabajo de fondo', async () => {
    estado.modo = 'fuera'
    const { AppError } = await import('./errores')
    const r = await cuerpo(new AppError('Campaña no encontrada', 404))
    expect(r.estado).toBe(404)
    expect(r.error).toBe('Campaña no encontrada')
  })

  it('el manejador de errores NO se convierte en el error', async () => {
    // El modo de fallo exacto: si `respuestaError` lanzara al buscar las
    // cabeceras, el error original se perderia y en su lugar apareceria uno
    // de Next que no dice nada del problema real.
    estado.modo = 'fuera'
    const { respuestaError, AppError } = await import('./errores')
    expect(() => respuestaError(new AppError('No encontrado', 404))).not.toThrow()
    expect(() => respuestaError(new Error('cualquier cosa'))).not.toThrow()
    expect(() => respuestaError(Object.assign(new Error(''), { code: '23505' }))).not.toThrow()
    expect(() => respuestaError(null)).not.toThrow()
  })
})

describe('lo que NO se traduce, porque es REGISTRO y no interfaz', () => {
  it('lo que va al log del servidor sigue en espanol, sea cual sea el idioma', async () => {
    // Un registro en dos idiomas segun quien provoco el fallo es un registro
    // inservible: quien lo lee despues no sabe si «Not found» y «No encontrado»
    // son el mismo suceso. El log es memoria del sistema, no un mensaje para
    // el usuario de turno.
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.cookie = 'en'
    await cuerpo(Object.assign(new Error('x'), { code: '23505' }))
    const linea = espia.mock.calls.map((c) => String(c[0])).join(' | ')
    expect(linea).toContain('[api] Postgres 23505')
    expect(linea).not.toContain('The record already exists')
  })

  it('el log del error no controlado tampoco cambia de idioma', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.cookie = 'en'
    await cuerpo(new Error('interno'))
    const linea = espia.mock.calls.map((c) => String(c[0])).join(' | ')
    expect(linea).toContain('[api] Error no controlado:')
  })

  it('EL LOG ES BYTE A BYTE EL MISMO en espanol y en ingles', async () => {
    // La invariante de verdad, y la que faltaba: las dos de arriba comprueban
    // que una cadena concreta siga ahi, lo que deja pasar cualquier traduccion
    // de una cadena que no sea esa. Esto compara las DOS corridas enteras.
    //
    // Lo pide el mutante E12: traducir el log sobrevivia porque el texto que
    // mutaba no estaba en el catalogo. Comparando los dos idiomas, cualquier
    // traduccion de cualquier parte del log se ve.
    async function log(idioma: string): Promise<string> {
      const espia = vi.spyOn(console, 'error').mockImplementation(() => {})
      espia.mockClear()
      estado.cookie = idioma
      await cuerpo(Object.assign(new Error('x'), { code: '23505' }))
      await cuerpo(Object.assign(new Error(''), { code: 'ECONNREFUSED' }))
      await cuerpo(new Error('interno'))
      return espia.mock.calls.map((c) => String(c[0])).join('\n')
    }
    expect(await log('en')).toBe(await log('es'))
  })
})
