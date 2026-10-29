import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  PROP-COMPLETA · «Enviar» manda la propuesta por correo (29/10).
//
//  Lo que se mide aquí es el ORDEN, que es la regla de dinero del envío: la
//  propuesta solo pasa a ENVIADA (y toma vigencia) si el correo salió, o si la
//  instancia no tiene correo. Un Resend caído no puede dejarla «enviada» de algo
//  que no llegó. Y el correo escapa todo lo que escribe una persona.
// ============================================================================

const h = vi.hoisted(() => ({
  habilitado: true,
  enviar: vi.fn(async (_o: any) => {}),
  cambiar: vi.fn(async (_id: string, _e: string) => ({ id: 'P1', nombre: 'Prop', estatus: 'ENVIADA' })),
  fila: {
    estatus: 'BORRADOR',
    nombre: 'Verano <b>',
    folio: 'PR-2026-0001',
    token_publico: 'tok123',
    vigente_hasta: null as string | null,
    vencida: null as boolean | null,
  } as any,
}))

vi.mock('./db', () => ({
  q1: vi.fn(async (sql: string) =>
    sql.includes('from propuestas') ? h.fila : { nombre: 'Medios "Sol"', email_remitente: 'ventas@sol.mx', logo_token: null },
  ),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./config-repo', () => ({ vigenciaPropuestaDelTenant: vi.fn(async () => 30) }))
vi.mock('./propuestas-repo', () => ({
  cambiarEstatusPropuesta: (id: string, e: string) => h.cambiar(id, e),
  PropuestaError: class PropuestaError extends Error {},
}))
vi.mock('./email', async () => {
  const real = await vi.importActual<typeof import('./email')>('./email')
  return {
    ...real,
    emailHabilitado: () => h.habilitado,
    enviarEmail: (o: any) => h.enviar(o),
    remitenteDeOrganizacion: (n: string) => `${n} <no-reply@plataforma.test>`,
  }
})

import { enviarPropuestaCtrl } from './propuestas-envio'
import { asuntoCorreoPropuesta, htmlCorreoPropuesta } from './propuesta-correo'

const CTX = { baseUrl: 'https://app.test/', remitente: { nombre: 'Ana', email: 'ana@sol.mx' } }

beforeEach(() => {
  h.habilitado = true
  h.enviar.mockReset()
  h.enviar.mockImplementation(async () => {})
  h.cambiar.mockClear()
  h.fila.estatus = 'BORRADOR'
})

describe('el envío', () => {
  it('manda la liga al cliente, con copia a quien envía y Reply-To de la organización, y DESPUÉS la deja ENVIADA', async () => {
    const r = await enviarPropuestaCtrl('P1', { para: 'cliente@x.com', mensaje: 'Hola' }, CTX)
    expect(r.correo).toBe('enviado')
    const o = h.enviar.mock.calls[0][0]
    expect(o.to).toBe('cliente@x.com')
    expect(o.cc).toBe('ana@sol.mx')
    expect(o.replyTo).toBe('ventas@sol.mx')
    expect(o.html).toContain('https://app.test/spaces-dooh/p/tok123/')
    expect(h.cambiar).toHaveBeenCalledWith('P1', 'ENVIADA')
    expect(h.enviar.mock.invocationCallOrder[0]).toBeLessThan(h.cambiar.mock.invocationCallOrder[0])
  })

  it('NEGATIVO · si Resend falla: 502 y la propuesta NO cambia', async () => {
    h.enviar.mockImplementation(async () => {
      throw new Error('Resend 500')
    })
    await expect(enviarPropuestaCtrl('P1', { para: 'cliente@x.com' }, CTX)).rejects.toMatchObject({ status: 502 })
    expect(h.cambiar).not.toHaveBeenCalled()
  })

  it('sin correo configurado: solo cambia el estatus y lo dice', async () => {
    h.habilitado = false
    const r = await enviarPropuestaCtrl('P1', { para: 'cliente@x.com' }, CTX)
    expect(r.correo).toBe('no_configurado')
    expect(h.enviar).not.toHaveBeenCalled()
    expect(h.cambiar).toHaveBeenCalledWith('P1', 'ENVIADA')
  })

  it('se puede REENVIAR una ENVIADA; una APROBADA no (409)', async () => {
    h.fila.estatus = 'ENVIADA'
    await expect(enviarPropuestaCtrl('P1', { para: 'cliente@x.com' }, CTX)).resolves.toMatchObject({ correo: 'enviado' })
    h.fila.estatus = 'APROBADA'
    await expect(enviarPropuestaCtrl('P1', { para: 'cliente@x.com' }, CTX)).rejects.toMatchObject({ status: 409 })
  })

  it('NEGATIVO · un correo con forma inválida da 400 y no manda nada', async () => {
    await expect(enviarPropuestaCtrl('P1', { para: 'no-es-correo' }, CTX)).rejects.toMatchObject({ status: 400 })
    expect(h.enviar).not.toHaveBeenCalled()
    expect(h.cambiar).not.toHaveBeenCalled()
  })

  it('no se manda copia a uno mismo cuando el destinatario es quien envía', async () => {
    await enviarPropuestaCtrl('P1', { para: 'ana@sol.mx' }, CTX)
    expect(h.enviar.mock.calls[0][0].cc).toBeNull()
  })
})

describe('el correo', () => {
  const base = {
    orgNombre: 'Medios <script>',
    logoUrl: null,
    propuestaNombre: 'Verano "2026"',
    folio: 'PR-1',
    liga: 'https://app.test/spaces-dooh/p/t/',
    vigenteHasta: '28/11/2026',
    mensaje: '<img src=x onerror=alert(1)>',
    remitenteNombre: 'Ana',
  }

  it('escapa todo lo que escribe una persona', () => {
    const html = htmlCorreoPropuesta(base)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    expect(html).toContain('28/11/2026')
  })

  it('el asunto no lleva saltos de línea (una cabecera rota o inyectada)', () => {
    expect(asuntoCorreoPropuesta({ orgNombre: 'Sol', propuestaNombre: 'A\r\nBcc: x@y.z' })).not.toMatch(/[\r\n]/)
  })
})
