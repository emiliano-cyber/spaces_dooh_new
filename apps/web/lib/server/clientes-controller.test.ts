import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACIÓN del controller. Mismo criterio que
// arrendadores-controller.test.ts.
const repo = {
  crearCliente: vi.fn(async (i: unknown) => ({ id: 'C1', ...(i as object) })),
  actualizarCliente: vi.fn(async (id: string, i: unknown) => ({ id, ...(i as object) })),
  // Por defecto: un cliente limpio que se borra. Cada prueba de bloqueo
  // sobrescribe el valor con el estado que quiere ejercitar. Los parámetros se
  // declaran aunque no se usen: sin ellos `mock.calls[0][1]` no existe para
  // TypeScript y las pruebas que comprueban QUÉ se le pasó no compilan.
  borrarCliente: vi.fn(async (_id: string, _opts: { confirmaPropuestasHuerfanas?: boolean }) => ({
    estado: 'borrado',
    cliente: { id: 'C1', nombre: 'Telcel' },
  })),
}
vi.mock('./clientes-repo', () => repo)

const { crearClienteCtrl, actualizarClienteCtrl, borrarClienteCtrl } = await import(
  './clientes-controller',
)

beforeEach(() => vi.clearAllMocks())

// ============================================================================
//  Auditoría de caja negra del 2026-08-26 sobre el alta de clientes.
//  Tres hallazgos, todos por lo mismo: la UI valida y el servidor confía en
//  ella. Un `curl` se salta la UI entera.
// ============================================================================

describe('control · el alta corriente sigue funcionando', () => {
  // Sin este caso, cualquier rotura del módulo (un import mal, una firma
  // cambiada) haría pasar los casos negativos por el motivo equivocado.
  it('un cliente normal llega al repo', async () => {
    const c = await crearClienteCtrl({ nombre: 'Telcel', rfc: 'XAXX010101000' })
    expect(repo.crearCliente).toHaveBeenCalledTimes(1)
    expect(c.nombre).toBe('Telcel')
  })
})

// ─── VAL-01 · RFC con fecha imposible ───────────────────────────────────────
describe('VAL-01 · el RFC del alta pasa por el calendario', () => {
  it('rechaza el RFC exacto de la auditoría (mes 13) y no escribe nada', async () => {
    await expect(crearClienteCtrl({ nombre: 'Con RFC imposible', rfc: 'XAXX021301000' }))
      .rejects.toThrow('RFC inválido')
    expect(repo.crearCliente).not.toHaveBeenCalled()
  })

  it('el mismo control en la edición', async () => {
    await expect(actualizarClienteCtrl('C1', { rfc: 'XAXX021301000' }))
      .rejects.toThrow('RFC inválido')
    expect(repo.actualizarCliente).not.toHaveBeenCalled()
  })

  it('los RFC genéricos del SAT siguen entrando', async () => {
    await crearClienteCtrl({ nombre: 'Público en general', rfc: 'XAXX010101000' })
    await crearClienteCtrl({ nombre: 'Extranjero', rfc: 'XEXX010101000' })
    expect(repo.crearCliente).toHaveBeenCalledTimes(2)
  })
})

// ─── VAL-02 · nombre sin tope ───────────────────────────────────────────────
describe('VAL-02 · el nombre tiene un tope en el SERVIDOR', () => {
  it('rechaza los 5 000 caracteres que aceptó la auditoría', async () => {
    // El formulario ya limitaba el campo. La UI no es una defensa: el alta se
    // hace igual por HTTP, y el nombre se pinta en la tabla de Clientes, en las
    // propuestas y en el CFDI — un valor así rompe el layout de todos.
    await expect(crearClienteCtrl({ nombre: 'A'.repeat(5000) }))
      .rejects.toThrow(/No puede tener más de/)
    expect(repo.crearCliente).not.toHaveBeenCalled()
  })

  it('un nombre largo pero razonable sí entra', async () => {
    // El tope no puede quedar tan bajo que estorbe: las razones sociales
    // mexicanas reales pasan de los 80 caracteres con facilidad.
    await crearClienteCtrl({ nombre: 'B'.repeat(200) })
    expect(repo.crearCliente).toHaveBeenCalledTimes(1)
  })

  it('también topa en la edición', async () => {
    await expect(actualizarClienteCtrl('C1', { nombre: 'A'.repeat(5000) }))
      .rejects.toThrow(/No puede tener más de/)
    expect(repo.actualizarCliente).not.toHaveBeenCalled()
  })
})

// ─── VAL-01b · el correo de primer nivel ────────────────────────────────────
describe('VAL-01b · el correo suelto en la raíz del cuerpo', () => {
  it('un correo inválido en la raíz ya no responde 201', async () => {
    // Lo que reportó la auditoría: `{nombre, email:'no-es-un-correo'}` → 201.
    // El esquema validaba `contacto.email` pero zod DESCARTA en silencio las
    // claves que no declara, así que el `email` de la raíz ni se validaba ni se
    // guardaba: el alta salía «bien» y el correo no existía en ninguna parte.
    await expect(crearClienteCtrl({ nombre: 'Correo malo', email: 'no-es-un-correo' }))
      .rejects.toThrow(/[Cc]orreo/)
    expect(repo.crearCliente).not.toHaveBeenCalled()
  })

  it('un correo válido en la raíz se GUARDA, no se descarta', async () => {
    // La otra mitad del defecto, y la que nadie habría notado: validarlo sin
    // guardarlo dejaría el mismo agujero con mejor cara.
    await crearClienteCtrl({ nombre: 'Correo bueno', email: 'x@ejemplo.com' })
    expect(repo.crearCliente.mock.calls[0][0]).toMatchObject({
      contacto: { email: 'x@ejemplo.com' },
    })
  })

  it('si vienen los dos, manda el de contacto (es el explícito)', async () => {
    await crearClienteCtrl({
      nombre: 'Los dos', email: 'raiz@ejemplo.com',
      contacto: { email: 'contacto@ejemplo.com' },
    })
    expect(repo.crearCliente.mock.calls[0][0]).toMatchObject({
      contacto: { email: 'contacto@ejemplo.com' },
    })
  })

  it('el correo de contacto sigue validándose como antes', async () => {
    await expect(crearClienteCtrl({ nombre: 'X', contacto: { email: 'roto' } }))
      .rejects.toThrow(/[Cc]orreo/)
  })

  it('sin correo no se inventa un contacto con la clave vacía', async () => {
    await crearClienteCtrl({ nombre: 'Sin correo' })
    const enviado = repo.crearCliente.mock.calls[0][0] as { contacto?: Record<string, unknown> }
    expect(enviado.contacto?.email).toBeUndefined()
  })
})

// ─── CRUD-01 · el borrado de cliente ────────────────────────────────────────
//  La auditoría del 2026-08-26 dejó diez clientes de prueba que NADIE podía
//  quitar: `/api/clientes` solo exportaba POST y `/api/clientes/[id]` solo
//  PATCH. Estas pruebas cubren la traducción del estado que devuelve el repo a
//  la respuesta HTTP; que la BASE bloquee de verdad se prueba en
//  `lib/test/borrado-cliente.e2e.test.ts`, porque un mock nunca produce un
//  23503 y aquí lo que se ejercita es solo el mapeo.
describe('CRUD-01 · borrado de cliente', () => {
  it('un cliente limpio se borra y devuelve la ficha que se llevó', async () => {
    const c = await borrarClienteCtrl('C1', {})
    expect(repo.borrarCliente).toHaveBeenCalledTimes(1)
    expect(c.nombre).toBe('Telcel')
  })

  it('un id inexistente es 404 y no un 200 silencioso', async () => {
    repo.borrarCliente.mockResolvedValueOnce({ estado: 'no-encontrado' } as never)
    await expect(borrarClienteCtrl('NOPE', {})).rejects.toMatchObject({ status: 404 })
  })

  it('con campañas y facturas es 409 y dice CUÁNTAS de cada cosa', async () => {
    // El 409 sin cifras («no se puede borrar») deja al usuario sin saber qué
    // quitar primero: el motivo del hallazgo es justamente que nadie sabía
    // por qué el borrado no ocurría.
    repo.borrarCliente.mockResolvedValueOnce({
      estado: 'bloqueado', campanas: 2, facturas: 3,
      clientesConEstaAgencia: 0, propuestasConEstaAgencia: 0,
    } as never)
    const e = await borrarClienteCtrl('C1', {}).catch((x) => x)
    expect(e.status).toBe(409)
    expect(e.message).toContain('2 campaña')
    expect(e.message).toContain('3 factura')
  })

  it('el 409 NO menciona lo que está en cero', async () => {
    // Un mensaje que enumera «0 facturas» manda a revisar una lista vacía.
    repo.borrarCliente.mockResolvedValueOnce({
      estado: 'bloqueado', campanas: 1, facturas: 0,
      clientesConEstaAgencia: 0, propuestasConEstaAgencia: 0,
    } as never)
    const e = await borrarClienteCtrl('C1', {}).catch((x) => x)
    expect(e.message).toContain('1 campaña')
    expect(e.message).not.toContain('factura')
  })

  it('una AGENCIA en uso también bloquea, y lo dice', async () => {
    // Las dos FK que el esquema no declara con `on delete`: `clientes
    // .agencia_id` y `propuestas.agencia_id` quedan en NO ACTION, que bloquea
    // igual que un RESTRICT. Sin contarlas, borrar una agencia daba un 409
    // genérico del driver que no decía qué la retenía.
    repo.borrarCliente.mockResolvedValueOnce({
      estado: 'bloqueado', campanas: 0, facturas: 0,
      clientesConEstaAgencia: 4, propuestasConEstaAgencia: 1,
    } as never)
    const e = await borrarClienteCtrl('C1', {}).catch((x) => x)
    expect(e.status).toBe(409)
    expect(e.message).toContain('4 cliente')
    expect(e.message).toContain('1 propuesta')
  })

  it('si dejaría propuestas huérfanas pide confirmación explícita', async () => {
    // `propuestas.cliente_id` es `on delete set null`: borrar al cliente NO
    // falla, deja las propuestas sin dueño y sin avisar. Se responde 409 con
    // la cifra y una salida, en vez de destruir el vínculo en silencio.
    repo.borrarCliente.mockResolvedValueOnce({ estado: 'huerfanas', propuestas: 3 } as never)
    const e = await borrarClienteCtrl('C1', {}).catch((x) => x)
    expect(e.status).toBe(409)
    expect(e.motivo).toBe('propuestas-huerfanas')
    expect(e.propuestas).toBe(3)
    expect(e.message).toContain('3 propuesta')
  })

  it('la confirmación viaja al repo; NO se asume', async () => {
    await borrarClienteCtrl('C1', { confirmaPropuestasHuerfanas: true })
    expect(repo.borrarCliente.mock.calls[0][1]).toMatchObject({
      confirmaPropuestasHuerfanas: true,
    })
  })

  it('sin pedirla, la confirmación va en false', async () => {
    await borrarClienteCtrl('C1', {})
    expect(repo.borrarCliente.mock.calls[0][1]).toMatchObject({
      confirmaPropuestasHuerfanas: false,
    })
  })
})
