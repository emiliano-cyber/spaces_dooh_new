import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACIÓN del controller. Mismo criterio que
// arrendadores-controller.test.ts.
const repo = {
  crearCliente: vi.fn(async (i: unknown) => ({ id: 'C1', ...(i as object) })),
  actualizarCliente: vi.fn(async (id: string, i: unknown) => ({ id, ...(i as object) })),
}
vi.mock('./clientes-repo', () => repo)

const { crearClienteCtrl, actualizarClienteCtrl } = await import('./clientes-controller')

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
