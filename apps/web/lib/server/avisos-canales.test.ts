import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  AVISOS-CANAL (12/11) · un aviso nuevo de la campana sale tambien por correo
//  a quien lo encendio. Lo que se vigila: a quien, con que remitente, y que
//  nunca rompe la operacion que lo provoco.
// ============================================================================

const enviarEmail = vi.fn()
let habilitado = true
vi.mock('./email', async (original) => ({
  ...(await original<typeof import('./email')>()),
  emailHabilitado: () => habilitado,
  enviarEmail: (...a: unknown[]) => enviarEmail(...a),
  remitenteDeOrganizacion: (n: string) => `"${n}" <no@plataforma.com>`,
}))
vi.mock('./idioma-instancia', () => ({ idiomaDeLaInstancia: async () => 'es' }))
vi.mock('./avisos-repo', () => ({
  destinatariosDeAviso: vi.fn(),
  identidadDeOrg: vi.fn(),
  destinatariosDeAvisoSinSesion: vi.fn(),
  identidadDeOrgSinSesion: vi.fn(),
}))

import { avisarPorCanales, estadoCanales, CANALES_QUE_SE_GUARDAN } from './avisos-canales'

const ORG = { nombre: 'Pixeled', email_remitente: 'hola@pixeled.mx', logo_token: null }
const AVISO = { tipo: 'FACTURA', titulo: 'Factura emitida', detalle: 'F-1 · 100', link: '/finanzas' }

function deps(dest: { email: string; nombre: string; telefono: string | null }[]) {
  return {
    destinatarios: vi.fn(async () => dest),
    identidad: vi.fn(async () => ORG),
    base: 'https://app.ej.com',
  }
}

beforeEach(() => {
  enviarEmail.mockReset()
  enviarEmail.mockResolvedValue(undefined)
  habilitado = true
})

describe('avisarPorCanales', () => {
  it('manda un correo a cada quien lo encendio, a nombre de la organizacion', async () => {
    const d = deps([{ email: 'a@x.com', nombre: 'A', telefono: null }, { email: 'b@x.com', nombre: 'B', telefono: null }])
    const r = await avisarPorCanales('t1', AVISO, d)
    await r.enviando
    expect(d.destinatarios).toHaveBeenCalledWith('t1', 'FACTURA', 'correo')
    expect(r.correo).toBe(2)
    expect(enviarEmail).toHaveBeenCalledTimes(2)
    const m = enviarEmail.mock.calls[0][0]
    expect(m.to).toBe('a@x.com')
    expect(m.from).toBe('"Pixeled" <no@plataforma.com>')
    expect(m.replyTo).toBe('hola@pixeled.mx')
    expect(m.subject).toBe('Factura emitida · Pixeled')
    expect(m.html).toContain('https://app.ej.com/spaces-dooh/finanzas/')
  })

  it('un tipo que no es de los avisos (p. ej. contratos) no consulta ni manda nada', async () => {
    const d = deps([{ email: 'a@x.com', nombre: 'A', telefono: null }])
    const r = await avisarPorCanales('t1', { ...AVISO, tipo: 'contrato:VENCIDO:123' }, d)
    await r.enviando
    expect(d.destinatarios).not.toHaveBeenCalled()
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('sin correo configurado no consulta la base: no hay nada que hacer', async () => {
    habilitado = false
    const d = deps([{ email: 'a@x.com', nombre: 'A', telefono: null }])
    const r = await avisarPorCanales('t1', AVISO, d)
    await r.enviando
    expect(d.destinatarios).not.toHaveBeenCalled()
    expect(r.correo).toBe(0)
  })

  it('sin destinatarios no lee la organizacion ni manda', async () => {
    const d = deps([])
    const r = await avisarPorCanales('t1', AVISO, d)
    await r.enviando
    expect(d.identidad).not.toHaveBeenCalled()
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('un correo que falla no impide los demas, y no lanza', async () => {
    enviarEmail.mockRejectedValueOnce(new Error('Brevo 401: llave'))
    const d = deps([{ email: 'a@x.com', nombre: 'A', telefono: null }, { email: 'b@x.com', nombre: 'B', telefono: null }])
    const r = await avisarPorCanales('t1', AVISO, d)
    await expect(r.enviando).resolves.toBeUndefined()
    expect(enviarEmail).toHaveBeenCalledTimes(2)
  })

  it('sin base (APP_URL) el correo sale igual, sin boton', async () => {
    const d = { ...deps([{ email: 'a@x.com', nombre: 'A', telefono: null }]), base: '' }
    const r = await avisarPorCanales('t1', AVISO, d)
    await r.enviando
    expect(enviarEmail.mock.calls[0][0].html).not.toContain('href=')
  })
})

describe('WhatsApp, sembrado', () => {
  it('aparece como canal, pero no configurado', () => {
    expect(estadoCanales().whatsapp).toEqual({ configurado: false, sembrado: true })
  })
  it('todavia no se puede guardar una preferencia por WhatsApp', () => {
    expect(CANALES_QUE_SE_GUARDAN).toEqual(['correo'])
  })
})
