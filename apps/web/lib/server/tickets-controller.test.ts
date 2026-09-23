import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACION del controller. Mismo criterio que
// clientes-controller.test.ts / entidades-repo.test.ts.
const repo = {
  crearTicket: vi.fn(async (i: unknown) => ({
    id: 'T1',
    folio: 'TK-2026-0001',
    estado: 'ABIERTO',
    respuesta: null,
    respondidoEn: null,
    ...(i as object),
  })),
  responderTicket: vi.fn(async (id: string, respuesta: string) => ({
    id,
    folio: 'TK-2026-0001',
    tenantId: 'TEN-1',
    asunto: 'Un asunto',
    cuerpo: 'Un cuerpo',
    estado: 'ABIERTO',
    prioridad: 'NORMAL',
    creadoPorUsuario: null,
    creadoEn: '2026-09-23T00:00:00.000Z',
    actualizadoEn: '2026-09-23T00:00:00.000Z',
    respuesta,
    // El repo (tickets-repo.ts:135-144) es quien fija `respondido_en = now()`
    // en el UPDATE; aqui se simula ese contrato para comprobar que el
    // controller lo DEVUELVE tal cual, sin recortarlo ni perderlo en el paso.
    respondidoEn: '2026-09-23T12:00:00.000Z',
  })),
}
vi.mock('./tickets-repo', () => repo)

const { crearTicketCtrl, responderTicketCtrl } = await import('./tickets-controller')

beforeEach(() => vi.clearAllMocks())

describe('crearTicketCtrl · el alta corriente sigue funcionando', () => {
  it('un alta normal llega al repo con el usuario de la sesion', async () => {
    const t = await crearTicketCtrl({ asunto: 'No prende una pantalla', cuerpo: 'Detalle largo del problema' }, 'U1')
    expect(repo.crearTicket).toHaveBeenCalledTimes(1)
    expect(repo.crearTicket.mock.calls[0][0]).toMatchObject({
      asunto: 'No prende una pantalla',
      cuerpo: 'Detalle largo del problema',
      creadoPorUsuario: 'U1',
    })
    expect(t).toBeDefined()
  })

  it('la prioridad es opcional y viaja cuando se manda', async () => {
    await crearTicketCtrl(
      { asunto: 'Asunto', cuerpo: 'Cuerpo', prioridad: 'URGENTE' },
      null,
    )
    expect(repo.crearTicket.mock.calls[0][0]).toMatchObject({ prioridad: 'URGENTE' })
  })
})

describe('crearTicketCtrl · casos negativos', () => {
  it('rechaza asunto vacio', async () => {
    await expect(crearTicketCtrl({ asunto: '', cuerpo: 'Cuerpo valido' }, null)).rejects.toThrow()
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })

  it('rechaza asunto de solo espacios (no es "algo" con el trim ya aplicado)', async () => {
    await expect(crearTicketCtrl({ asunto: '   ', cuerpo: 'Cuerpo valido' }, null)).rejects.toThrow()
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })

  it('rechaza cuerpo de mas de 4000 caracteres', async () => {
    await expect(
      crearTicketCtrl({ asunto: 'Asunto valido', cuerpo: 'A'.repeat(4001) }, null),
    ).rejects.toThrow(/4000/)
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })

  it('4000 caracteres exactos SI entran (el limite no se pasa de largo)', async () => {
    await crearTicketCtrl({ asunto: 'Asunto valido', cuerpo: 'A'.repeat(4000) }, null)
    expect(repo.crearTicket).toHaveBeenCalledTimes(1)
  })

  it('rechaza un estado que no esta en el enum', async () => {
    // El estado de un ticket nuevo nace ABIERTO por default de la columna
    // (db/migrations/20260923_tickets.sql:20): el cliente NUNCA lo fija al
    // abrir uno. `.strict()` rechaza la clave entera -- valida o no -- para
    // que el campo dé 400 en vez de ignorarse en silencio (mismo criterio que
    // `password` en usuarios-controller.ts).
    await expect(
      crearTicketCtrl({ asunto: 'Asunto valido', cuerpo: 'Cuerpo valido', estado: 'NO_EXISTE' }, null),
    ).rejects.toThrow()
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })

  it('rechaza una prioridad que no esta en el enum', async () => {
    await expect(
      crearTicketCtrl({ asunto: 'Asunto valido', cuerpo: 'Cuerpo valido', prioridad: 'MEGA' }, null),
    ).rejects.toThrow()
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })

  it('rechaza cualquier campo de mas (.strict())', async () => {
    await expect(
      crearTicketCtrl({ asunto: 'Asunto valido', cuerpo: 'Cuerpo valido', tenantId: 'TEN-2' }, null),
    ).rejects.toThrow()
    expect(repo.crearTicket).not.toHaveBeenCalled()
  })
})

describe('crearTicketCtrl · recorta espacios del asunto antes de guardar', () => {
  it('el asunto llega al repo sin los espacios de los extremos', async () => {
    await crearTicketCtrl({ asunto: '   No prende una pantalla   ', cuerpo: 'Cuerpo valido' }, null)
    expect(repo.crearTicket.mock.calls[0][0]).toMatchObject({ asunto: 'No prende una pantalla' })
  })

  it('el cuerpo tambien se recorta', async () => {
    await crearTicketCtrl({ asunto: 'Asunto', cuerpo: '  Cuerpo con espacios  ' }, null)
    expect(repo.crearTicket.mock.calls[0][0]).toMatchObject({ cuerpo: 'Cuerpo con espacios' })
  })
})

describe('responderTicketCtrl · al responder, fija respondido_en', () => {
  it('la respuesta del repo trae respondidoEn y el controller la devuelve tal cual', async () => {
    const t = await responderTicketCtrl('T1', { respuesta: 'Ya se reviso el sitio' })
    expect(repo.responderTicket).toHaveBeenCalledWith('T1', 'Ya se reviso el sitio')
    expect(t).toMatchObject({ respuesta: 'Ya se reviso el sitio', respondidoEn: '2026-09-23T12:00:00.000Z' })
  })

  it('NO mueve el estado a RESUELTO -- responder no es resolver (ADR 0038)', async () => {
    // El repo (T3) no toca `estado` en el UPDATE; aqui se comprueba que el
    // controller tampoco intenta forzarlo: el mock de arriba devuelve
    // `estado: 'ABIERTO'` sin que el controller lo haya pedido cambiar, y
    // nadie en este archivo pasa un `estado` a `responderTicket`.
    const t = await responderTicketCtrl('T1', { respuesta: 'Necesito mas datos' })
    expect(repo.responderTicket.mock.calls[0]).toEqual(['T1', 'Necesito mas datos'])
    expect(t).toMatchObject({ estado: 'ABIERTO' })
  })

  it('un id inexistente es 404 y no un 200 silencioso', async () => {
    repo.responderTicket.mockResolvedValueOnce(null as never)
    await expect(responderTicketCtrl('NOPE', { respuesta: 'x' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('responderTicketCtrl · casos negativos', () => {
  it('rechaza respuesta vacia', async () => {
    await expect(responderTicketCtrl('T1', { respuesta: '' })).rejects.toThrow()
    expect(repo.responderTicket).not.toHaveBeenCalled()
  })

  it('rechaza respuesta de solo espacios', async () => {
    await expect(responderTicketCtrl('T1', { respuesta: '   ' })).rejects.toThrow()
    expect(repo.responderTicket).not.toHaveBeenCalled()
  })

  it('rechaza un estado en el cuerpo de la respuesta (.strict())', async () => {
    // El estado se mueve aparte y explicitamente (progress.md, ruling T3 #3):
    // responder NUNCA acarrea un cambio de estado colado en el mismo cuerpo.
    await expect(
      responderTicketCtrl('T1', { respuesta: 'Texto valido', estado: 'RESUELTO' }),
    ).rejects.toThrow()
    expect(repo.responderTicket).not.toHaveBeenCalled()
  })

  it('rechaza cualquier campo de mas (.strict())', async () => {
    await expect(
      responderTicketCtrl('T1', { respuesta: 'Texto valido', prioridad: 'ALTA' }),
    ).rejects.toThrow()
    expect(repo.responderTicket).not.toHaveBeenCalled()
  })

  it('recorta espacios de la respuesta antes de guardar', async () => {
    await responderTicketCtrl('T1', { respuesta: '  Texto con espacios  ' })
    expect(repo.responderTicket).toHaveBeenCalledWith('T1', 'Texto con espacios')
  })
})
