import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas ejercitan la VALIDACIÓN del controller. Mismo criterio que
// `clientes-controller.test.ts` y `arrendadores-controller.test.ts`.
const repo = {
  getSitio: vi.fn(async (_id: string) => SITIO_DIGITAL as Record<string, unknown> | null),
  actualizarModalidades: vi.fn(
    async (_id: string, _cambios: { guardar: unknown[]; quitar: string[] }) => SITIO_DIGITAL,
  ),
  // El controller importa el módulo entero; el resto de funciones tienen que
  // existir aunque estas pruebas no las toquen.
  actualizarSitio: vi.fn(),
  borrarSitio: vi.fn(),
  toggleNetwork: vi.fn(),
  importarSitios: vi.fn(),
}

const SITIO_DIGITAL = {
  id: 'S-DIG',
  nombre: 'Pantalla Reforma',
  exhibicion: 'digital',
  modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 30000, costoCompra: 0 }],
}
const SITIO_FIJO = {
  id: 'S-FIJ',
  nombre: 'Lona Centro',
  exhibicion: 'fijo',
  modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 18000, costoCompra: 0 }],
}

vi.mock('./sitios-repo', () => repo)

const { actualizarModalidadesCtrl } = await import('./sitios-controller')

beforeEach(() => {
  vi.clearAllMocks()
  repo.getSitio.mockResolvedValue(SITIO_DIGITAL)
  repo.actualizarModalidades.mockResolvedValue(SITIO_DIGITAL)
})

// ============================================================================
//  Capturar las tarifas por unidad DESDE LA FICHA — lo que el servidor NO deja.
// ----------------------------------------------------------------------------
//  Hasta hoy `sitio_modalidades` solo se escribía por el camino de importación
//  (`insertarSitio` y `actualizarSitioCompleto`). Para vender por spot había que
//  subir un CSV. Al abrir la captura desde la ficha, TODA la validación que
//  hacía el importador hay que rehacerla aquí — el archivo la tenía, el
//  formulario no, y un `curl` no pasa por ningún formulario.
//
//  LO QUE ESTAS PRUEBAS FIJAN, y por qué cada una:
//   · Una unidad inválida no se guarda — la lista de siete es cerrada.
//   · Una pantalla FIJA con spot no se guarda — la misma regla del importador.
//   · Una unidad REPETIDA en la misma petición no se guarda — `unique
//     (sitio_id, unidad)` lo impediría en la base, pero como el camino es
//     `on conflict do update` el segundo valor PISARÍA al primero en silencio y
//     nadie sabría cuál de los dos precios quedó.
//   · Nada de eso escribe NADA: se comprueba que el repo no se llamó. Un
//     rechazo que ya escribió media petición no es un rechazo.
// ============================================================================

describe('control · el camino bueno llega al repo', () => {
  // Sin este caso, una rotura del módulo haría pasar los negativos por el
  // motivo equivocado.
  it('añadir una unidad con su tarifa se guarda', async () => {
    const r = await actualizarModalidadesCtrl('S-DIG', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250 }],
    })
    expect(repo.actualizarModalidades).toHaveBeenCalledTimes(1)
    expect(repo.actualizarModalidades.mock.calls[0][1]).toEqual({
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: [],
    })
    expect(r.guardadas).toBe(1)
    expect(r.quitadas).toBe(0)
  })

  it('cambiar la tarifa de una unidad que ya existe es el mismo camino', async () => {
    await actualizarModalidadesCtrl('S-DIG', {
      guardar: [{ unidad: 'mensual', tarifaPublicada: 31500 }],
    })
    expect(repo.actualizarModalidades.mock.calls[0][1].guardar).toEqual([
      { unidad: 'mensual', tarifaPublicada: 31500, costoCompra: 0 },
    ])
  })

  it('quitar una unidad viaja como `quitar`, no como una tarifa en cero', async () => {
    // Guardar 0 y quitar NO son lo mismo: un 0 se lee como «se vende gratis» y
    // la pantalla seguiría ofreciéndose en esa unidad.
    const r = await actualizarModalidadesCtrl('S-DIG', { quitar: ['mensual'] })
    expect(repo.actualizarModalidades.mock.calls[0][1]).toEqual({ guardar: [], quitar: ['mensual'] })
    expect(r.quitadas).toBe(1)
  })

  it('las siete unidades entran en una pantalla digital', async () => {
    await actualizarModalidadesCtrl('S-DIG', {
      guardar: [
        { unidad: 'mensual', tarifaPublicada: 1 },
        { unidad: 'catorcenal', tarifaPublicada: 2 },
        { unidad: 'semanal', tarifaPublicada: 3 },
        { unidad: 'diaria', tarifaPublicada: 4 },
        { unidad: 'spot', tarifaPublicada: 5 },
        { unidad: 'hora', tarifaPublicada: 6 },
        { unidad: 'programatico', tarifaPublicada: 7 },
      ],
    })
    expect(repo.actualizarModalidades.mock.calls[0][1].guardar).toHaveLength(7)
  })

  it('sin nada que cambiar NO se escribe: el repo ni se llama', async () => {
    await actualizarModalidadesCtrl('S-DIG', { guardar: [], quitar: [] })
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })
})

describe('negativo · una unidad que no existe no se guarda', () => {
  it('rechaza «quincenal» y no escribe nada', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', { guardar: [{ unidad: 'quincenal', tarifaPublicada: 100 }] }),
    ).rejects.toThrow(/unidad/i)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('rechaza también la unidad inventada dentro de `quitar`', async () => {
    // Un `quitar` con un nombre que no existe sería un borrado silencioso de
    // nada: el usuario cree que quitó algo y no quitó nada.
    await expect(actualizarModalidadesCtrl('S-DIG', { quitar: ['quincenal'] })).rejects.toThrow(
      /unidad/i,
    )
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('una unidad válida junto a otra inválida NO pasa a medias', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', {
        guardar: [
          { unidad: 'spot', tarifaPublicada: 250 },
          { unidad: 'trimestral', tarifaPublicada: 900 },
        ],
      }),
    ).rejects.toThrow(/unidad/i)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })
})

describe('negativo · una pantalla FIJA no se vende por spot', () => {
  beforeEach(() => {
    repo.getSitio.mockResolvedValue(SITIO_FIJO)
  })

  it('rechaza spot en una fija, con el mismo criterio que el importador', async () => {
    await expect(
      actualizarModalidadesCtrl('S-FIJ', { guardar: [{ unidad: 'spot', tarifaPublicada: 250 }] }),
    ).rejects.toThrow(/mensual/)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('las cinco prohibidas caen todas', async () => {
    for (const unidad of ['semanal', 'diaria', 'spot', 'hora', 'programatico']) {
      await expect(
        actualizarModalidadesCtrl('S-FIJ', { guardar: [{ unidad, tarifaPublicada: 10 }] }),
        `«${unidad}» coló en una pantalla fija`,
      ).rejects.toThrow()
    }
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('pero mensual y catorcenal sí entran en una fija', async () => {
    repo.actualizarModalidades.mockResolvedValue(SITIO_FIJO)
    await actualizarModalidadesCtrl('S-FIJ', {
      guardar: [
        { unidad: 'mensual', tarifaPublicada: 18000 },
        { unidad: 'catorcenal', tarifaPublicada: 9500 },
      ],
    })
    expect(repo.actualizarModalidades).toHaveBeenCalledTimes(1)
  })
})

describe('negativo · una unidad repetida no se guarda', () => {
  it('rechaza la misma unidad dos veces en la misma petición', async () => {
    // `unique (sitio_id, unidad)` no llega a verlo: el upsert aplicaría las dos
    // y la segunda pisaría a la primera SIN error. Quedaría un precio que nadie
    // eligió a conciencia.
    await expect(
      actualizarModalidadesCtrl('S-DIG', {
        guardar: [
          { unidad: 'spot', tarifaPublicada: 250 },
          { unidad: 'spot', tarifaPublicada: 400 },
        ],
      }),
    ).rejects.toThrow(/repetida|repetid/i)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('el mensaje dice CUÁL unidad viene repetida', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', {
        guardar: [
          { unidad: 'hora', tarifaPublicada: 1 },
          { unidad: 'hora', tarifaPublicada: 2 },
        ],
      }),
    ).rejects.toThrow(/hora/)
  })

  it('y rechaza guardar y quitar LA MISMA unidad a la vez', async () => {
    // Es una contradicción, y el orden de aplicación decidiría el resultado.
    await expect(
      actualizarModalidadesCtrl('S-DIG', {
        guardar: [{ unidad: 'spot', tarifaPublicada: 250 }],
        quitar: ['spot'],
      }),
    ).rejects.toThrow(/spot/)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('una unidad repetida en `quitar` también se rechaza', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', { quitar: ['spot', 'spot'] }),
    ).rejects.toThrow(/spot/)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })
})

describe('negativo · una tarifa tiene que ser un número usable', () => {
  it('rechaza una tarifa negativa', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', { guardar: [{ unidad: 'spot', tarifaPublicada: -1 }] }),
    ).rejects.toThrow()
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('rechaza un texto donde va la tarifa', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', { guardar: [{ unidad: 'spot', tarifaPublicada: 'gratis' }] }),
    ).rejects.toThrow()
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('rechaza una tarifa ausente: es el dato que da sentido a la unidad', async () => {
    await expect(
      actualizarModalidadesCtrl('S-DIG', { guardar: [{ unidad: 'spot' }] }),
    ).rejects.toThrow()
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('el cero SÍ entra: una unidad de cortesía es una decisión, no un descuido', async () => {
    await actualizarModalidadesCtrl('S-DIG', { guardar: [{ unidad: 'spot', tarifaPublicada: 0 }] })
    expect(repo.actualizarModalidades).toHaveBeenCalledTimes(1)
  })
})

describe('negativo · una pantalla que no existe', () => {
  it('da 404 y no escribe', async () => {
    repo.getSitio.mockResolvedValue(null)
    await expect(
      actualizarModalidadesCtrl('NO-EXISTE', { guardar: [{ unidad: 'spot', tarifaPublicada: 1 }] }),
    ).rejects.toThrow(/no encontrad/i)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })

  it('la exhibición se lee de la BASE, no del cuerpo de la petición', async () => {
    // Si el controller se fiara de un `exhibicion` mandado por el cliente, la
    // regla de la pantalla fija se saltaría con una línea de `curl`.
    repo.getSitio.mockResolvedValue(SITIO_FIJO)
    await expect(
      actualizarModalidadesCtrl('S-FIJ', {
        exhibicion: 'digital',
        guardar: [{ unidad: 'spot', tarifaPublicada: 250 }],
      }),
    ).rejects.toThrow(/mensual/)
    expect(repo.actualizarModalidades).not.toHaveBeenCalled()
  })
})
