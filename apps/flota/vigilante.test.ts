import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { decidirAvisos, redactar, exigirConfig, vigilar, CAIDA, RECUPERADA } from './vigilante.mjs'

// ============================================================================
//  El vigilante de la flota (ADR 0026).
//
//  Lo corre el cron del PADRE. Recorre la flota, la compara con lo que vio la
//  vez anterior, y avisa POR CAMBIO DE ESTADO -- no por pasada. Si avisara por
//  pasada, una instancia caída generaría un correo cada vez que corre el cron, y
//  a la tercera nadie los lee.
//
//  Va fuera de la vista a propósito (decidido el 2026-09-04): una instancia se
//  puede caer un viernes por la noche y nadie abre el panel hasta el lunes.
// ============================================================================

const arriba = (nombre: string) => ({ nombre, dominio: `${nombre}.mx`, estado: 'al-dia' })
const abajo = (nombre: string) => ({ nombre, dominio: `${nombre}.mx`, estado: 'sin-respuesta' })

describe('avisa por CAMBIO, no por pasada', () => {
  it('si nada cambió, no manda nada', () => {
    const previo = { pixeled: 'al-dia', sankofa: 'sin-respuesta' }
    expect(decidirAvisos(previo, [arriba('pixeled'), abajo('sankofa')])).toEqual([])
  })

  it('una instancia que se cae, un aviso', () => {
    const avisos = decidirAvisos({ pixeled: 'al-dia' }, [abajo('pixeled')])
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ nombre: 'pixeled', tipo: CAIDA })
  })

  it('y cuando vuelve, otro', () => {
    // Sin el aviso de vuelta, quien recibió el de caída no sabe nunca si se
    // arregló: se queda mirando el panel por si acaso.
    const avisos = decidirAvisos({ pixeled: 'sin-respuesta' }, [arriba('pixeled')])
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ nombre: 'pixeled', tipo: RECUPERADA })
  })

  it('rezagada NO es caída: responde, solo va vieja', () => {
    // `rezagada` es una instancia que contesta y corre una versión anterior.
    // Eso no es una caída y no despierta a nadie de madrugada.
    expect(decidirAvisos({ pixeled: 'al-dia' }, [{ nombre: 'pixeled', dominio: 'x', estado: 'rezagada' }])).toEqual([])
  })

  it('en la PRIMERA pasada, una instancia caída sí avisa', () => {
    // No hay estado anterior con el que comparar. Se elige avisar: un vigilante
    // que se calla sobre una instancia caída porque «es la primera vez» es peor
    // que uno que manda un correo de más. Y solo pasa una vez.
    const avisos = decidirAvisos({}, [abajo('pixeled'), arriba('sankofa')])
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ nombre: 'pixeled', tipo: CAIDA })
  })

  it('una instancia nueva que responde no genera ruido', () => {
    expect(decidirAvisos({}, [arriba('nueva')])).toEqual([])
  })

  it('una instancia que sale del inventario no avisa de nada', () => {
    // Se dio de baja a propósito; no es una caída.
    expect(decidirAvisos({ vieja: 'al-dia' }, [arriba('pixeled')])).toEqual([])
  })
})

describe('el correo dice lo que hace falta para actuar', () => {
  it('el asunto nombra la instancia y qué pasó', () => {
    const { asunto, texto } = redactar([{ nombre: 'pixeled', tipo: CAIDA, dominio: 'space-os.pixeled.mx' }])
    expect(asunto).toMatch(/pixeled/)
    expect(asunto.toLowerCase()).toMatch(/no responde|caid/)
    expect(texto).toContain('space-os.pixeled.mx')
  })

  it('varios cambios van en UN correo, no en cinco', () => {
    const { asunto } = redactar([
      { nombre: 'a', tipo: CAIDA, dominio: 'a.mx' },
      { nombre: 'b', tipo: CAIDA, dominio: 'b.mx' },
    ])
    expect(asunto).toMatch(/2/)
  })
})

describe('la configuración es obligatoria y se comprueba ANTES de nada', () => {
  it('sin destinatario, aborta y lo dice', () => {
    expect(() => exigirConfig({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.co' })).toThrow(/AVISOS_PARA/)
  })

  it('sin credenciales de correo, también', () => {
    expect(() => exigirConfig({ AVISOS_PARA: 'a@b.co', EMAIL_FROM: 'x@y.co' })).toThrow(/RESEND_API_KEY/)
    expect(() => exigirConfig({ AVISOS_PARA: 'a@b.co', RESEND_API_KEY: 'k' })).toThrow(/EMAIL_FROM/)
  })

  it('con las tres, pasa', () => {
    expect(exigirConfig({ AVISOS_PARA: 'a@b.co', RESEND_API_KEY: 'k', EMAIL_FROM: 'x@y.co' })).toMatchObject({
      para: 'a@b.co',
    })
  })
})

describe('si el correo no sale, el estado NO avanza', () => {
  it('un envío fallido deja el aviso pendiente para la próxima pasada', async () => {
    // Esto es lo que separa un vigilante de un adorno. Si se guardara el estado
    // nuevo igualmente, el aviso se perdería PARA SIEMPRE: en la pasada
    // siguiente ya no habría cambio que detectar, y la instancia seguiría caída
    // sin que nadie lo supiera. Falla abierto, como fallaba el respaldo antes
    // del 02/09.
    let guardado: any = null
    const r = await vigilar({
      config: { AVISOS_PARA: 'a@b.co', RESEND_API_KEY: 'k', EMAIL_FROM: 'x@y.co' },
      obtenerFilas: async () => [abajo('pixeled')],
      leerPrevio: async () => ({ pixeled: 'al-dia' }),
      guardar: async (e: any) => {
        guardado = e
      },
      enviar: async () => {
        throw new Error('Resend dijo 500')
      },
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/500/)
    expect(guardado, 'no debe guardarse el estado si el aviso no salio').toBeNull()
  })

  it('cuando sale, sí avanza', async () => {
    let guardado: any = null
    let enviados = 0
    const r = await vigilar({
      config: { AVISOS_PARA: 'a@b.co', RESEND_API_KEY: 'k', EMAIL_FROM: 'x@y.co' },
      obtenerFilas: async () => [abajo('pixeled')],
      leerPrevio: async () => ({ pixeled: 'al-dia' }),
      guardar: async (e: any) => {
        guardado = e
      },
      enviar: async () => {
        enviados++
      },
    })
    expect(r.ok).toBe(true)
    expect(enviados).toBe(1)
    expect(guardado).toEqual({ pixeled: 'sin-respuesta' })
  })

  it('sin cambios no se manda correo, pero el estado SÍ se guarda', async () => {
    let guardado: any = null
    let enviados = 0
    await vigilar({
      config: { AVISOS_PARA: 'a@b.co', RESEND_API_KEY: 'k', EMAIL_FROM: 'x@y.co' },
      obtenerFilas: async () => [arriba('pixeled')],
      leerPrevio: async () => ({ pixeled: 'al-dia' }),
      guardar: async (e: any) => {
        guardado = e
      },
      enviar: async () => {
        enviados++
      },
    })
    expect(enviados).toBe(0)
    expect(guardado).toEqual({ pixeled: 'al-dia' })
  })
})
