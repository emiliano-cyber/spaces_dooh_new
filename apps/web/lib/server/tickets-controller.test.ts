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
  actualizarTicketDesdePanel: vi.fn(async (id: string, cambios: { respuesta?: string; estado?: string }) => ({
    id,
    folio: 'TK-2026-0001',
    tenantId: 'TEN-1',
    asunto: 'Un asunto',
    cuerpo: 'Un cuerpo',
    // El repo (tickets-repo.ts) es quien decide de verdad si el estado se
    // mueve; aqui se simula ese contrato para comprobar que el controller le
    // pasa (o no le pasa) `estado` tal cual, sin inventarlo ni perderlo.
    estado: cambios.estado ?? 'ABIERTO',
    prioridad: 'NORMAL',
    creadoPorUsuario: null,
    creadoEn: '2026-09-23T00:00:00.000Z',
    actualizadoEn: '2026-09-23T00:00:00.000Z',
    respuesta: cambios.respuesta ?? null,
    // El repo es quien fija `respondido_en = now()` UNICAMENTE cuando llega
    // `respuesta` (tickets-repo.ts, actualizarTicketDesdePanel); aqui se
    // simula ese contrato para comprobar que el controller lo DEVUELVE tal
    // cual, sin recortarlo ni perderlo en el paso.
    respondidoEn: cambios.respuesta !== undefined ? '2026-09-23T12:00:00.000Z' : null,
  })),
}
vi.mock('./tickets-repo', () => repo)

const { crearTicketCtrl, actualizarTicketDesdePanelCtrl } = await import('./tickets-controller')

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

describe('actualizarTicketDesdePanelCtrl · al responder, fija respondido_en', () => {
  it('la respuesta del repo trae respondidoEn y el controller la devuelve tal cual', async () => {
    const t = await actualizarTicketDesdePanelCtrl('T1', { respuesta: 'Ya se reviso el sitio' })
    expect(repo.actualizarTicketDesdePanel).toHaveBeenCalledWith('T1', { respuesta: 'Ya se reviso el sitio', estado: undefined })
    expect(t).toMatchObject({ respuesta: 'Ya se reviso el sitio', respondidoEn: '2026-09-23T12:00:00.000Z' })
  })

  it('NO mueve el estado a RESUELTO -- responder no es resolver (ADR 0038, Tarea 3)', async () => {
    // El repo es quien de verdad decide si `estado` se mueve; aqui se
    // comprueba que el controller no lo fuerza cuando solo llega `respuesta`:
    // el mock devuelve `estado: 'ABIERTO'` (su default cuando no le pasan
    // `estado`), y el controller no pasa ningun `estado` en este caso.
    const t = await actualizarTicketDesdePanelCtrl('T1', { respuesta: 'Necesito mas datos' })
    expect(repo.actualizarTicketDesdePanel.mock.calls[0]).toEqual(['T1', { respuesta: 'Necesito mas datos', estado: undefined }])
    expect(t).toMatchObject({ estado: 'ABIERTO' })
  })

  it('un id inexistente es 404 y no un 200 silencioso', async () => {
    repo.actualizarTicketDesdePanel.mockResolvedValueOnce(null as never)
    await expect(actualizarTicketDesdePanelCtrl('NOPE', { respuesta: 'x' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('actualizarTicketDesdePanelCtrl · mover el estado sin responder', () => {
  it('un PATCH solo de estado mueve el estado a RESUELTO', async () => {
    const t = await actualizarTicketDesdePanelCtrl('T1', { estado: 'RESUELTO' })
    expect(repo.actualizarTicketDesdePanel).toHaveBeenCalledWith('T1', { respuesta: undefined, estado: 'RESUELTO' })
    expect(t).toMatchObject({ estado: 'RESUELTO' })
  })

  it('un PATCH solo de estado NO trae respuesta ni respondidoEn', async () => {
    const t = await actualizarTicketDesdePanelCtrl('T1', { estado: 'EN_PROCESO' })
    expect(t).toMatchObject({ respuesta: null, respondidoEn: null })
  })

  it('con las dos cosas a la vez, las dos viajan al repo', async () => {
    await actualizarTicketDesdePanelCtrl('T1', { respuesta: 'Se cambio el driver', estado: 'RESUELTO' })
    expect(repo.actualizarTicketDesdePanel).toHaveBeenCalledWith('T1', { respuesta: 'Se cambio el driver', estado: 'RESUELTO' })
  })
})

describe('actualizarTicketDesdePanelCtrl · casos negativos', () => {
  it('rechaza un PATCH sin respuesta NI estado -- 400, no un update vacio', async () => {
    await expect(actualizarTicketDesdePanelCtrl('T1', {})).rejects.toMatchObject({ status: 400 })
    expect(repo.actualizarTicketDesdePanel).not.toHaveBeenCalled()
  })

  it('rechaza respuesta vacia', async () => {
    await expect(actualizarTicketDesdePanelCtrl('T1', { respuesta: '' })).rejects.toThrow()
    expect(repo.actualizarTicketDesdePanel).not.toHaveBeenCalled()
  })

  it('rechaza respuesta de solo espacios', async () => {
    await expect(actualizarTicketDesdePanelCtrl('T1', { respuesta: '   ' })).rejects.toThrow()
    expect(repo.actualizarTicketDesdePanel).not.toHaveBeenCalled()
  })

  it('rechaza un estado fuera del enum', async () => {
    await expect(
      actualizarTicketDesdePanelCtrl('T1', { estado: 'NO_EXISTE' }),
    ).rejects.toThrow()
    expect(repo.actualizarTicketDesdePanel).not.toHaveBeenCalled()
  })

  it('rechaza cualquier campo de mas (.strict())', async () => {
    await expect(
      actualizarTicketDesdePanelCtrl('T1', { respuesta: 'Texto valido', prioridad: 'ALTA' }),
    ).rejects.toThrow()
    expect(repo.actualizarTicketDesdePanel).not.toHaveBeenCalled()
  })

  it('recorta espacios de la respuesta antes de guardar', async () => {
    await actualizarTicketDesdePanelCtrl('T1', { respuesta: '  Texto con espacios  ' })
    expect(repo.actualizarTicketDesdePanel).toHaveBeenCalledWith('T1', { respuesta: 'Texto con espacios', estado: undefined })
  })
})
