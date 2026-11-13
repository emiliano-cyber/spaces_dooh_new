import { describe, it, expect } from 'vitest'
import { proveedorDeCorreo, llaveDelProveedor, pedidoDeCorreo, partesDelRemitente } from './correo-proveedor'

// ============================================================================
//  AVISOS-CANAL (12/11) · el correo sale por Resend O por Brevo.
// ----------------------------------------------------------------------------
//  Decision del dueno: dejar los dos listos sin contratar ninguno. Lo que se
//  prueba aqui es lo unico que cambia entre uno y otro: a donde se manda, con
//  que cabecera va la llave y que forma tiene el cuerpo.
// ============================================================================

const MSG = {
  from: '"Pixeled" <no-responder@ejemplo.com>',
  to: 'ana@cliente.com',
  subject: 'Factura emitida',
  html: '<p>hola</p>',
}

describe('proveedorDeCorreo', () => {
  it('sin EMAIL_PROVEEDOR es Resend, que es lo que ya tenia toda la flota', () => {
    expect(proveedorDeCorreo({})).toBe('resend')
    expect(proveedorDeCorreo({ EMAIL_PROVEEDOR: '' })).toBe('resend')
  })
  it('acepta brevo y resend sin importar mayusculas ni espacios', () => {
    expect(proveedorDeCorreo({ EMAIL_PROVEEDOR: ' Brevo ' })).toBe('brevo')
    expect(proveedorDeCorreo({ EMAIL_PROVEEDOR: 'RESEND' })).toBe('resend')
  })
  it('un valor desconocido NO cae a Resend: apaga el correo', () => {
    // Si un error de dedo cayera a Resend, el servidor intentaria mandar con
    // una llave que no existe y el fallo se veria como «Resend 401», que
    // manda a buscar en el sitio equivocado.
    expect(proveedorDeCorreo({ EMAIL_PROVEEDOR: 'brebo' })).toBeNull()
  })
})

describe('llaveDelProveedor', () => {
  it('cada proveedor lee SU variable', () => {
    const env = { RESEND_API_KEY: 're_x', BREVO_API_KEY: 'xkeysib-y' }
    expect(llaveDelProveedor('resend', env)).toBe('re_x')
    expect(llaveDelProveedor('brevo', env)).toBe('xkeysib-y')
  })
  it('sin proveedor valido no hay llave', () => {
    expect(llaveDelProveedor(null, { RESEND_API_KEY: 're_x' })).toBe('')
  })
})

describe('partesDelRemitente', () => {
  it('separa el nombre citado y la direccion', () => {
    expect(partesDelRemitente('"Pixeled" <no@ej.com>')).toEqual({ nombre: 'Pixeled', email: 'no@ej.com' })
  })
  it('desescapa las comillas que mete remitenteConNombre', () => {
    expect(partesDelRemitente('"La \\"Gran\\" Pantalla" <no@ej.com>')).toEqual({ nombre: 'La "Gran" Pantalla', email: 'no@ej.com' })
  })
  it('acepta el nombre sin comillas y la direccion sola', () => {
    expect(partesDelRemitente('SPACE OS <no@ej.com>')).toEqual({ nombre: 'SPACE OS', email: 'no@ej.com' })
    expect(partesDelRemitente('no@ej.com')).toEqual({ nombre: null, email: 'no@ej.com' })
  })
})

describe('pedidoDeCorreo · Resend', () => {
  it('va a la API de Resend con Bearer y el cuerpo de siempre', () => {
    const p = pedidoDeCorreo('resend', 're_x', MSG)
    expect(p.url).toBe('https://api.resend.com/emails')
    expect(p.headers.Authorization).toBe('Bearer re_x')
    expect(JSON.parse(p.body)).toEqual({ from: MSG.from, to: MSG.to, subject: MSG.subject, html: MSG.html })
  })
  it('reply_to y cc solo si hay: un null hace que Resend conteste 422', () => {
    const p = JSON.parse(pedidoDeCorreo('resend', 'k', { ...MSG, replyTo: 'r@ej.com', cc: 'c@ej.com' }).body)
    expect(p.reply_to).toBe('r@ej.com')
    expect(p.cc).toBe('c@ej.com')
    const sin = JSON.parse(pedidoDeCorreo('resend', 'k', { ...MSG, replyTo: null, cc: null }).body)
    expect('reply_to' in sin).toBe(false)
    expect('cc' in sin).toBe(false)
  })
})

describe('pedidoDeCorreo · Brevo', () => {
  it('va a la API de Brevo con la cabecera api-key, no con Bearer', () => {
    const p = pedidoDeCorreo('brevo', 'xkeysib-y', MSG)
    expect(p.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(p.headers['api-key']).toBe('xkeysib-y')
    expect(p.headers.Authorization).toBeUndefined()
  })
  it('el remitente y los destinatarios van como objetos, y el HTML en htmlContent', () => {
    const p = JSON.parse(pedidoDeCorreo('brevo', 'k', MSG).body)
    expect(p).toEqual({
      sender: { name: 'Pixeled', email: 'no-responder@ejemplo.com' },
      to: [{ email: 'ana@cliente.com' }],
      subject: 'Factura emitida',
      htmlContent: '<p>hola</p>',
    })
  })
  it('replyTo y cc como objetos, y ausentes si no hay', () => {
    const p = JSON.parse(pedidoDeCorreo('brevo', 'k', { ...MSG, replyTo: 'r@ej.com', cc: 'c@ej.com' }).body)
    expect(p.replyTo).toEqual({ email: 'r@ej.com' })
    expect(p.cc).toEqual([{ email: 'c@ej.com' }])
    const sin = JSON.parse(pedidoDeCorreo('brevo', 'k', MSG).body)
    expect('replyTo' in sin).toBe(false)
    expect('cc' in sin).toBe(false)
  })
  it('un remitente sin nombre manda solo la direccion', () => {
    const p = JSON.parse(pedidoDeCorreo('brevo', 'k', { ...MSG, from: 'no@ej.com' }).body)
    expect(p.sender).toEqual({ email: 'no@ej.com' })
  })
})
